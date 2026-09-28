/**
 * SafeZone data access layer.
 *
 * Primary source: Supabase (when NEXT_PUBLIC_SUPABASE_URL + key are set).
 * Fallback: the deterministic demo snapshot written by scripts/seed.ts.
 *
 * Demo-mode mutations (citizen reports) are kept in an in-memory overlay so
 * the report → risk pipeline is fully interactive without a backend; with
 * Supabase configured the same call performs a real insert (subject to RLS:
 * citizens insert reports only).
 */

import { CATEGORIES, CATEGORY_META, CHECKLIST, CHECKLIST_MAP, departmentOf, type CategoryKey, type ChecklistItem, type ItemKey } from "./checklist";
import { isCertType, type CertType } from "./certificates";
import { findBestMatch, type IncidentMatchResult, type MatchCandidate } from "./dedup";
import { isLocationUnverified } from "./geo";
import { computeRisk, type RiskResult } from "./risk";
import { categoryScore, venueStatus, type VenueStatus } from "./scoring";
import { computeMonsoonFlag } from "./seasonal";
import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabase-admin";
import {
  deleteReportPhotoByUrl, uploadCertificatePhoto, uploadEvidencePhoto, uploadReportPhoto,
} from "./storage";
import type {
  Certificate, Dataset, HistoryEvent, Incident, Inspection, ItemState, MonsoonFlag, Notification,
  Profile, Report, ReporterFeedback, RiskTier, Role, Venue,
} from "./types";
import demoSnapshot from "@/data/demo-data.json";

// ---------------------------------------------------------------------------
// Overlay (demo-mode mutations) — overlay rows win over the base snapshot.
//
// The overlay + dataset cache live on globalThis: Next's dev server compiles
// routes into separate bundles that can each get their own module instance
// after HMR, which would otherwise split the in-memory store (a report filed
// through one route would be invisible to another). globalThis is shared by
// every bundle in the process — dev, published build, worker or otherwise.
// ---------------------------------------------------------------------------

interface OverlayStore {
  reports: Map<string, Report>;
  incidents: Map<string, Incident>;
  itemStates: Map<string, ItemState>; // key: `${venueId}:${itemKey}`
  historyEvents: Map<string, HistoryEvent>;
  inspections: Map<string, Inspection>;
  notifications: Map<string, Notification>;
  feedback: Map<string, ReporterFeedback>;
  /** Phase 4 — reporter reputation adjustments (profileId → new value). */
  reputation: Map<string, number>;
  /** Phase 5 — tombstones: seeded-snapshot rows deleted in demo mode. */
  deletedReports: Set<string>;
  deletedIncidents: Set<string>;
  deletedHistoryEvents: Set<string>;
  deletedNotifications: Set<string>;
  deletedFeedback: Set<string>; // key: reportId
  /** Phase 5 spec completion — officer-uploaded certificates (demo mode). */
  certificates: Map<string, Certificate>;
}

interface SafeZoneStore {
  overlay: OverlayStore;
  cached: Dataset | null;
}

const g = globalThis as unknown as { __safezoneStore?: SafeZoneStore };
const store: SafeZoneStore = (g.__safezoneStore ??= {
  overlay: {
    reports: new Map<string, Report>(),
    incidents: new Map<string, Incident>(),
    itemStates: new Map<string, ItemState>(),
    historyEvents: new Map<string, HistoryEvent>(),
    inspections: new Map<string, Inspection>(),
    notifications: new Map<string, Notification>(),
    feedback: new Map<string, ReporterFeedback>(),
    reputation: new Map<string, number>(),
    deletedReports: new Set<string>(),
    deletedIncidents: new Set<string>(),
    deletedHistoryEvents: new Set<string>(),
    deletedNotifications: new Set<string>(),
    deletedFeedback: new Set<string>(),
    certificates: new Map<string, Certificate>(),
  },
  cached: null,
});
const overlay = store.overlay;

// ---------------------------------------------------------------------------
// Supabase fetch + mapping
// ---------------------------------------------------------------------------

/**
 * Unwrap a Supabase query result, surfacing real errors instead of letting
 * them masquerade as empty arrays. A failed query (missing table, bad RLS
 * setup, network) is logged with its table context and thrown so callers
 * handle it explicitly — never silently cached as "no data".
 */
function unwrap<T>(table: string, res: { data: T | null; error: { message: string; code?: string } | null }): T | null {
  if (res.error) {
    console.error(
      `[safezone] Supabase query failed on "${table}"${res.error.code ? ` (${res.error.code})` : ""}:`,
      res.error.message,
    );
    throw new Error(`Supabase query failed on "${table}": ${res.error.message}`);
  }
  return res.data;
}

/**
 * Notifications read for the live project — tolerant of a missing table (the
 * Phase 3 migration may not have run yet): logs a hint and returns [].
 */
async function fetchNotificationsTolerant(): Promise<Notification[]> {
  if (!supabase) return [];
  try {
    const res = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (unwrap("notifications", res) ?? []) as unknown as Record<string, unknown>[];
    return rows.map((n) => ({
      id: n.id as string,
      recipientId: n.recipient_id as string,
      title: n.title as string,
      body: (n.body ?? null) as string | null,
      reportId: (n.report_id ?? null) as string | null,
      incidentId: (n.incident_id ?? null) as string | null,
      readAt: (n.read_at ?? null) as string | null,
      createdAt: n.created_at as string,
    }));
  } catch (err) {
    console.warn(
      "[safezone] notifications unavailable (run supabase/migration_phase3.sql to add the table):",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/**
 * Certificates read for the live project — tolerant of a missing table (the
 * Phase 5 spec-completion migration may not have run yet): logs a hint and
 * returns [] so the rest of the venue detail keeps rendering.
 *
 * RLS NOTE (the lesson from the RLS fix, applied to reads): the certificates
 * policies are `to authenticated`, and the app has NO auth session anywhere —
 * the anon client silently reads 0 rows through them. Reads therefore prefer
 * the service-role client (which bypasses RLS), degrading to the anon client
 * in read-only live mode (URL + anon key only), exactly like the write paths
 * prefer supabaseAdmin.
 */
async function fetchCertificatesTolerant(): Promise<Certificate[]> {
  const reader = supabaseAdmin ?? supabase;
  if (!reader) return [];
  try {
    const res = await reader
      .from("certificates")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(2000);
    const rows = (unwrap("certificates", res) ?? []) as unknown as Record<string, unknown>[];
    return rows.map((c) => ({
      id: c.id as string,
      venueId: c.venue_id as string,
      certType: c.cert_type as Certificate["certType"],
      certNumber: (c.cert_number ?? null) as string | null,
      issueDate: (c.issue_date ?? null) as string | null,
      expiryDate: (c.expiry_date ?? null) as string | null,
      authority: (c.authority ?? null) as string | null,
      photoUrl: (c.photo_url ?? null) as string | null,
      createdAt: c.created_at as string,
    }));
  } catch (err) {
    console.warn(
      "[safezone] certificates unavailable (run supabase/migration_phase5.sql to add the table):",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

async function fetchFromSupabase(): Promise<Dataset> {
  if (!supabase) throw new Error("supabase not configured");

  const [venues, itemStates, incidents, reports, inspections, history, feedback, profileRows] =
    await Promise.all([
      supabase.from("venues").select("*").then((r) => unwrap("venues", r)),
      supabase.from("item_states").select("*").then((r) => unwrap("item_states", r)),
      supabase.from("incidents").select("*").order("created_at", { ascending: true }).then((r) => unwrap("incidents", r)),
      supabase.from("reports").select("*").order("created_at", { ascending: true }).then((r) => unwrap("reports", r)),
      supabase.from("inspections").select("*").then((r) => unwrap("inspections", r)),
      supabase.from("history_events").select("*").order("created_at", { ascending: true }).then((r) => unwrap("history_events", r)),
      supabase.from("reporter_feedback").select("*").then((r) => unwrap("reporter_feedback", r)),
      supabase.from("profiles").select("*").then((r) => unwrap("profiles", r)),
    ]);

  // Phase 3 — notifications are fetched separately + tolerantly: before
  // migration_phase3.sql has run the table does not exist live, and that must
  // not sink the whole dataset into the demo fallback.
  const notifications = await fetchNotificationsTolerant();

  // Phase 5 spec completion — same tolerance for certificates (migration_phase5.sql).
  const certificates = await fetchCertificatesTolerant();

  return {
    seededAt: new Date().toISOString(),
    // public.profiles carries no email column (emails live in auth.users),
    // so email stays undefined here — names/reputation/role are what the UI needs.
    profiles: (profileRows as unknown as Record<string, unknown>[]).map((p) => ({
      id: p.id as string,
      email: (p.email ?? undefined) as Profile["email"],
      role: p.role as Profile["role"],
      reputation: p.reputation as number,
      name: (p.name ?? "") as string,
    })),
    venues: venues as unknown as Venue[],
    itemStates: (itemStates as unknown as Record<string, unknown>[]).map((s) => ({
      venueId: s.venue_id as string,
      itemKey: s.item_key as string,
      status: s.status as ItemState["status"],
      source: (s.source ?? null) as ItemState["source"],
      updatedAt: s.updated_at as string,
    })),
    incidents: (incidents as unknown as Record<string, unknown>[]).map((i) => ({
      id: i.id as string,
      venueId: i.venue_id as string,
      category: i.category as string,
      issueKey: i.issue_key as string,
      title: i.title as string,
      severity: i.severity as Incident["severity"],
      status: i.status as Incident["status"],
      reportCount: i.report_count as number,
      createdAt: i.created_at as string,
    })),
    reports: (reports as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      incidentId: (r.incident_id ?? null) as string | null,
      venueId: r.venue_id as string,
      reporterId: r.reporter_id as string,
      inputText: r.input_text as string,
      photoUrl: (r.photo_url ?? null) as string | null,
      aiLanguage: r.ai_language,
      aiVision: r.ai_vision,
      confirmed: r.confirmed as boolean,
      lat: (r.lat ?? null) as number | null,
      lng: (r.lng ?? null) as number | null,
      status: r.status as Report["status"],
      createdAt: r.created_at as string,
      locationUnverified: (r.location_unverified ?? null) as boolean | null,
    })),
    inspections: (inspections as unknown as Record<string, unknown>[]).map((i) => ({
      id: i.id as string,
      venueId: i.venue_id as string,
      inspectorId: i.inspector_id as string,
      results: i.results,
      afterActionPhotoUrl: (i.after_action_photo_url ?? null) as string | null,
      notice: (i.notice ?? null) as string | null,
      createdAt: i.created_at as string,
    })),
    historyEvents: (history as unknown as Record<string, unknown>[]).map((h) => ({
      id: h.id as string,
      venueId: h.venue_id as string,
      incidentId: (h.incident_id ?? null) as string | null,
      eventType: h.event_type as string,
      description: h.description as string,
      createdAt: h.created_at as string,
    })),
    reporterFeedback: (feedback as unknown as Record<string, unknown>[]).map((f) => ({
      reportId: f.report_id as string,
      verdict: f.verdict as "fixed" | "still_exists",
      createdAt: f.created_at as string,
    })),
    notifications,
    certificates,
  };
}

// NOTE: the dataset cache lives on the shared globalThis store (see above).
const readCache = () => store.cached;
const writeCache = (d: Dataset | null) => { store.cached = d; };

function mergeDemoSnapshot(): Dataset {
  const base = demoSnapshot as unknown as Dataset;
  const byId = <T extends { id: string }>(rows: T[], extra: Map<string, T>, gone: Set<string>): T[] => {
    const map = new Map(rows.map((r) => [r.id, r]));
    for (const [id, row] of extra) map.set(id, row);
    return [...map.values()].filter((r) => !gone.has(r.id));
  };
  const itemStates = (() => {
    const map = new Map(base.itemStates.map((s) => [`${s.venueId}:${s.itemKey}`, s]));
    for (const [k, s] of overlay.itemStates) map.set(k, s);
    return [...map.values()];
  })();
  return {
    ...base,
    profiles: base.profiles.map((p) =>
      overlay.reputation.has(p.id) ? { ...p, reputation: overlay.reputation.get(p.id)! } : p,
    ),
    reports: byId(base.reports, overlay.reports, overlay.deletedReports),
    incidents: byId(base.incidents, overlay.incidents, overlay.deletedIncidents),
    itemStates,
    historyEvents: byId(base.historyEvents, overlay.historyEvents, overlay.deletedHistoryEvents),
    inspections: byId(base.inspections, overlay.inspections, new Set()),
    notifications: (byId(base.notifications ?? [], overlay.notifications, overlay.deletedNotifications)),
    certificates: byId(base.certificates ?? [], overlay.certificates, new Set()),
    reporterFeedback: (
      (() => {
        const map = new Map((base.reporterFeedback ?? []).map((f) => [f.reportId, f]));
        for (const [id, row] of overlay.feedback) map.set(id, row);
        return [...map.values()].filter((f) => !overlay.deletedFeedback.has(f.reportId));
      })()
    ),
  };
}

export async function getDataset(): Promise<Dataset> {
  const hit = readCache();
  if (hit) return hit;
  if (supabase) {
    try {
      const live = await fetchFromSupabase();
      writeCache(live);
      return live;
    } catch (err) {
      console.warn("[safezone] Supabase fetch failed, falling back to demo snapshot:", err);
    }
  }
  const merged = mergeDemoSnapshot();
  writeCache(merged);
  return merged;
}

export function resetDemoOverlay(): void {
  overlay.reports.clear();
  overlay.incidents.clear();
  overlay.itemStates.clear();
  overlay.historyEvents.clear();
  overlay.inspections.clear();
  overlay.notifications.clear();
  overlay.feedback.clear();
  overlay.reputation.clear();
  overlay.deletedReports.clear();
  overlay.deletedIncidents.clear();
  overlay.deletedHistoryEvents.clear();
  overlay.deletedNotifications.clear();
  overlay.deletedFeedback.clear();
  overlay.certificates.clear();
  writeCache(null);
}

// ---------------------------------------------------------------------------
// Phase 4 — demo persona resolution (stable across demo snapshot / live)
// ---------------------------------------------------------------------------

/** The canonical demo trio — scripts/seed.ts creates exactly these accounts. */
export const DEMO_PERSONA_NAMES: Record<Role, string> = {
  citizen: "Priya Sharma",
  inspector: "R.K. Verma",
  officer: "Anjali Mehta",
};

/**
 * Resolve the three demo personas (citizen/inspector/officer@demo.com) from
 * the profile list, in that order:
 *   1. @demo.com emails — the demo snapshot carries them
 *   2. canonical names — live mode: public.profiles has no email column, but
 *      the seed pushes the trio under stable names
 *   3. highest-reputation per role — last-resort fallback (any dataset)
 *
 * The name match matters beyond cosmetics: reputation moves with audits
 * (+5/−10), so ordering by reputation alone would silently swap the citizen
 * persona mid-demo and orphan their reports/notifications.
 */
export function resolveDemoPersonas(profiles: Profile[]): Profile[] {
  const ROLE_ORDER: Role[] = ["citizen", "inspector", "officer"];

  const byEmail = new Map<string, Profile>();
  for (const p of profiles) {
    if (p.email?.endsWith("@demo.com")) byEmail.set(p.role, p);
  }
  if ([...byEmail.keys()].length >= 3) {
    return ROLE_ORDER.flatMap((r) => (byEmail.has(r) ? [byEmail.get(r)!] : []));
  }

  const byName = new Map(profiles.map((p) => [p.name, p]));
  const named = ROLE_ORDER.flatMap((r) => {
    const p = byName.get(DEMO_PERSONA_NAMES[r]);
    return p && p.role === r ? [p] : [];
  });
  if (named.length === 3) return named;

  const best = new Map<Role, Profile>();
  for (const p of profiles) {
    const cur = best.get(p.role);
    if (!cur || p.reputation > cur.reputation || (p.reputation === cur.reputation && p.name < cur.name)) {
      best.set(p.role, p);
    }
  }
  return ROLE_ORDER.flatMap((r) => (best.has(r) ? [best.get(r)!] : []));
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

export interface VenueSummary {
  id: string;
  name: string;
  type: Venue["type"];
  address: string;
  ward: string;
  lat: number;
  lng: number;
  risk: RiskResult;
  status: VenueStatus;
  lastInspectedDays: number | null;
  openCritical: number;
  openMinor: number;
  reportCount: number;
  categoryScores: Record<CategoryKey, number>;
}

export function buildSummary(venue: Venue, data: Dataset): VenueSummary {
  const inspections = data.inspections.filter((i) => i.venueId === venue.id);
  const lastInspection = inspections
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const incidents = data.incidents.filter((i) => i.venueId === venue.id);
  const reports = data.reports.filter((r) => r.venueId === venue.id);
  const itemStates = data.itemStates.filter((s) => s.venueId === venue.id);

  const lastInspectedDays = lastInspection
    ? Math.floor((Date.now() - new Date(lastInspection.createdAt).getTime()) / 86_400_000)
    : null;
  const unresolved = incidents.filter((i) => i.status !== "resolved");

  return {
    id: venue.id,
    name: venue.name,
    type: venue.type,
    address: venue.address,
    ward: venue.ward,
    lat: venue.lat,
    lng: venue.lng,
    risk: computeRisk(
      { type: venue.type, lastInspectedAt: lastInspection?.createdAt ?? null },
      incidents,
      reports,
    ),
    status: venueStatus(itemStates, reports.length > 0),
    lastInspectedDays,
    openCritical: unresolved.filter((i) => i.severity === "critical").length,
    openMinor: unresolved.filter((i) => i.severity === "minor").length,
    reportCount: reports.length,
    categoryScores: {
      FIRE_SAFETY: categoryScore(itemStates, "FIRE_SAFETY"),
      HYGIENE: categoryScore(itemStates, "HYGIENE"),
      EMERGENCY_PREPAREDNESS: categoryScore(itemStates, "EMERGENCY_PREPAREDNESS"),
    },
  };
}

export async function getVenueSummaries(): Promise<VenueSummary[]> {
  const data = await getDataset();
  return data.venues.map((v) => buildSummary(v, data));
}

export interface ChecklistRow {
  item: ChecklistItem;
  state: ItemState | null;
  /** Unified display hint: severity × trust, resolved server-side. */
  display: "confirmed_fail" | "citizen_fail" | "verified_pass" | "citizen_pass" | "not_verified";
}

export interface VenueDetail extends VenueSummary {
  checklist: { category: (typeof CATEGORIES)[number]; rows: ChecklistRow[]; score: number }[];
  incidents: (Incident & { reporterNames: string[] })[];
  reports: (Report & { reporterName: string; reporterReputation: number })[];
  inspections: (Inspection & { inspectorName: string })[];
  history: HistoryEvent[];
  /** Phase 5 spec completion — compliance certificates (read-only on the passport). */
  certificates: Certificate[];
  /** Phase 5 spec completion — monsoon/waterlogging flag (null when not flagged). */
  monsoon: MonsoonFlag | null;
}

function rowDisplay(state: ItemState | null): ChecklistRow["display"] {
  if (!state || state.status === "not_verified") return "not_verified";
  if (state.status === "fail") return state.source === "inspection" ? "confirmed_fail" : "citizen_fail";
  return state.source === "inspection" ? "verified_pass" : "citizen_pass";
}

export async function getVenueDetail(id: string): Promise<VenueDetail | null> {
  const data = await getDataset();
  const venue = data.venues.find((v) => v.id === id);
  if (!venue) return null;

  const summary = buildSummary(venue, data);
  const stateByItem = new Map(
    data.itemStates.filter((s) => s.venueId === id).map((s) => [s.itemKey, s]),
  );
  const nameOf = new Map(data.profiles.map((p) => [p.id, p]));
  const repOf = new Map(data.profiles.map((p) => [p.id, p.reputation]));

  return {
    ...summary,
    checklist: CATEGORIES.map((category) => ({
      category,
      rows: category.items.map((item) => ({
        item,
        state: stateByItem.get(item.key) ?? null,
        display: rowDisplay(stateByItem.get(item.key) ?? null),
      })),
      score: categoryScore([...stateByItem.values()], category.key),
    })),
    certificates: (data.certificates ?? [])
      .filter((c) => c.venueId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    monsoon: computeMonsoonFlag(
      id,
      data.reports.filter((r) => r.venueId === id),
      data.incidents.filter((i) => i.venueId === id),
    ),
    incidents: data.incidents
      .filter((i) => i.venueId === id)
      .map((i) => ({
        ...i,
        reporterNames: data.reports
          .filter((r) => r.incidentId === i.id)
          .map((r) => nameOf.get(r.reporterId)?.name ?? "Anonymous citizen"),
      })),
    reports: data.reports
      .filter((r) => r.venueId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        ...r,
        reporterName: nameOf.get(r.reporterId)?.name ?? "Anonymous citizen",
        reporterReputation: repOf.get(r.reporterId) ?? 50,
      })),
    inspections: data.inspections
      .filter((i) => i.venueId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({
        ...i,
        inspectorName: nameOf.get(i.inspectorId)?.name ?? "Inspector",
      })),
    history: data.historyEvents
      .filter((h) => h.venueId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

// ---------------------------------------------------------------------------
// Citizen report intake
// ---------------------------------------------------------------------------

export interface ReportInput {
  venueId: string;
  itemKey: ItemKey | null;
  title: string;
  description: string;
  severity: "critical" | "minor";
  hasPhoto: boolean;
  reporterId: string;
  /** /report flow extras — all optional so the classic dialog keeps working. */
  photoDataUrl?: string | null;
  aiLanguage?: unknown;
  aiVision?: unknown;
  lat?: number | null;
  lng?: number | null;
  capturedAt?: string | null;
  /** Extra checklist items the citizen confirmed as failing (photo flow). */
  extraCitizenFails?: string[];
  /** Phase 4 dedup — the citizen chose "add my report to this incident". */
  linkToIncidentId?: string | null;
  /** Phase 4 dedup — the citizen chose "it's a different issue". */
  forceNewIncident?: boolean;
}

export interface ReportOutcome {
  reportId: string;
  incidentId: string;
  createdIncident: boolean;
  venue: VenueSummary;
  persisted: "supabase" | "demo";
  /** How the evidence photo was handled: Storage upload / inline data URL
   *  kept in the demo overlay / no photo attached / upload attempted but failed. */
  photoUpload?: "storage" | "data-url" | "skipped" | "failed";
  /** Phase 4 — the report's geolocation was >200 m from the venue. */
  locationUnverified: boolean;
}

const genId = () =>
  (crypto.randomUUID?.() ?? `ov-${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Resolve the evidence photo for a report, never failing the report itself:
 *  - Storage upload via the service-role client when configured
 *  - inline data URL in demo mode (in-memory overlay only)
 *  - legacy placeholder for the classic dialog's hasPhoto flag
 */
async function resolvePhoto(
  input: ReportInput,
  reportId: string,
): Promise<{ photoUrl: string | null; photoUpload: ReportOutcome["photoUpload"] }> {
  if (input.photoDataUrl) {
    if (supabaseAdmin) {
      const capturedMs = input.capturedAt ? Date.parse(input.capturedAt) : NaN;
      const url = await uploadReportPhoto(
        supabaseAdmin,
        input.venueId,
        input.reporterId,
        input.photoDataUrl,
        Number.isFinite(capturedMs) ? capturedMs : Date.now(),
      );
      return url
        ? { photoUrl: url, photoUpload: "storage" }
        : { photoUrl: null, photoUpload: "failed" };
    }
    return { photoUrl: input.photoDataUrl, photoUpload: "data-url" };
  }
  if (input.hasPhoto) {
    return { photoUrl: `https://demo.safezone.app/photos/${reportId}.jpg`, photoUpload: "skipped" };
  }
  return { photoUrl: null, photoUpload: "skipped" };
}

/**
 * Resolve which incident a new report belongs to — the Phase 4 dedup choice.
 * Order: explicit link (the citizen confirmed the banner) → force-new (the
 * citizen said "different issue") → auto same-issue (the Phase 3 semantics).
 * Returns the target incident + whether it must be created.
 */
function resolveIncidentChoice(
  data: Dataset,
  input: ReportInput,
): { target: Incident | null; create: boolean } {
  const explicit = input.linkToIncidentId
    ? data.incidents.find(
        (i) =>
          i.id === input.linkToIncidentId &&
          i.venueId === input.venueId &&
          i.status !== "resolved",
      )
    : undefined;
  if (explicit) return { target: explicit, create: false };
  if (!input.forceNewIncident && input.itemKey) {
    const auto = data.incidents.find(
      (i) => i.venueId === input.venueId && i.issueKey === input.itemKey && i.status !== "resolved",
    );
    if (auto) return { target: auto, create: false };
  }
  return { target: null, create: true };
}

function newIncidentFrom(input: ReportInput, id: string, now: string): Incident {
  const item = CHECKLIST.find((c) => c.key === input.itemKey);
  return {
    id,
    venueId: input.venueId,
    category: item?.category ?? "EMERGENCY_PREPAREDNESS",
    issueKey: input.itemKey ?? "general",
    title: input.title,
    severity: input.severity,
    status: "open",
    reportCount: 1,
    createdAt: now,
  };
}

export async function addReport(input: ReportInput): Promise<ReportOutcome> {
  const data = await getDataset();
  const venue = data.venues.find((v) => v.id === input.venueId);
  if (!venue) throw new Error("Venue not found");

  const reportId = genId();
  const now = new Date().toISOString();
  const photo = await resolvePhoto(input, reportId);

  // Phase 4 — location honesty: soft flag when the report's geolocation is
  // >200 m from the venue. Never blocks submission.
  const locationUnverified = isLocationUnverified(input.lat, input.lng, venue.lat, venue.lng);

  // Phase 4 — dedup: which incident does this report belong to?
  const choice = resolveIncidentChoice(data, input);

  let persisted: ReportOutcome["persisted"] = "demo";

  if (supabaseAdmin) {
    // RLS on public.reports/incidents requires an authenticated session for
    // client inserts. SafeZone has no login screen — the active persona is a
    // server-side choice, there is NO supabase.auth session, so the anon
    // client writes as the `anon` role and is rejected by RLS (policies for
    // `authenticated` never match it). Live writes therefore go EXCLUSIVELY
    // through the service-role admin client, which bypasses RLS. When the
    // service key is absent the code below never runs — the write degrades
    // to the in-memory overlay (documented read-only-live fallback) instead
    // of dying with an opaque "RLS error on incidents".
    const writer = supabaseAdmin;
    try {
    // 1. Incident linkage (Phase 4): link / create before the report insert
    //    so the row can reference it. (Live reports previously landed with
    //    incident_id null — the overlay did the linkage; both paths share
    //    the same choice logic now.)
    let incidentId: string | null = null;
    let createdIncident = false;
    if (choice.target) {
      incidentId = choice.target.id;
      const { error: bumpErr } = await writer
        .from("incidents")
        .update({ report_count: choice.target.reportCount + 1 })
        .eq("id", incidentId);
      if (bumpErr) throw new Error(`incident report_count update failed: ${bumpErr.message}`);
    } else {
      const newIncident = newIncidentFrom(input, genId(), now);
      const { data: incInserted, error: incErr } = await writer
        .from("incidents")
        .insert({
          id: newIncident.id,
          venue_id: newIncident.venueId,
          category: newIncident.category,
          issue_key: newIncident.issueKey,
          title: newIncident.title,
          severity: newIncident.severity,
          status: newIncident.status,
          report_count: newIncident.reportCount,
          created_at: newIncident.createdAt,
        })
        .select("id")
        .single();
      if (incErr) throw new Error(`incident insert failed: ${incErr.message}`);
      incidentId = incInserted?.id ?? newIncident.id;
      createdIncident = true;
    }

    // 2. The report row. location_unverified lives in migration_phase4.sql —
    //    tolerate a not-yet-migrated database by retrying without the flag
    //    (the report is still filed; the flag is soft, never a blocker).
    const reportRow: Record<string, unknown> = {
      venue_id: input.venueId,
      reporter_id: input.reporterId,
      incident_id: incidentId,
      input_text: input.description,
      photo_url: photo.photoUrl,
      ai_language: (input.aiLanguage ?? null) as never,
      ai_vision: (input.aiVision ?? null) as never,
      confirmed: false,
      lat: input.lat ?? venue.lat,
      lng: input.lng ?? venue.lng,
      status: "pending",
      location_unverified: locationUnverified,
    };
    const attempt = async (row: Record<string, unknown>) =>
      writer.from("reports").insert(row).select("id").single();
    const first = await attempt(reportRow);
    let inserted = first.data as { id: string } | null;
    let insertError = first.error;
    if (insertError && /location_unverified/i.test(insertError.message ?? "")) {
      console.warn(
        "[safezone] reports.location_unverified is missing — run supabase/migration_phase4.sql; " +
          "filing without the location flag:",
        insertError.message,
      );
      const fallbackRow = { ...reportRow };
      delete fallbackRow.location_unverified;
      const retry = await attempt(fallbackRow);
      inserted = retry.data as { id: string } | null;
      insertError = retry.error;
    }
    if (inserted) {
      persisted = "supabase";
    } else if (insertError) {
      console.error("[safezone] report insert failed:", insertError.message);
      if (/row-level security/i.test(insertError.message)) {
        throw new Error(
          "Report insert was rejected by row-level security: the server has no authenticated citizen session. " +
            "Set SUPABASE_SERVICE_ROLE_KEY so report writes can go through the server-side admin client.",
        );
      }
      throw new Error(insertError.message);
    }

    // 3. History — same event semantics as the demo overlay path.
    await writer.from("history_events").insert({
      id: genId(),
      venue_id: input.venueId,
      incident_id: incidentId,
      event_type: createdIncident ? "incident_opened" : "report_corroborated",
      description: createdIncident
        ? `Citizen report filed — "${input.title}".`
        : "Another citizen corroborated an open issue.",
      created_at: now,
    });

    writeCache(null); // invalidate cache so the next read reflects the insert
    const fresh = await getDataset();
    const freshVenue = fresh.venues.find((v) => v.id === input.venueId)!;
    return {
      reportId: (inserted as { id: string } | null)?.id ?? reportId,
      incidentId: incidentId ?? "",
      createdIncident,
      venue: buildSummary(freshVenue, fresh),
      persisted,
      photoUpload: photo.photoUpload,
      locationUnverified,
    };
    } catch (err) {
      // Live write failed — most commonly a REVOKED or invalid
      // SUPABASE_SERVICE_ROLE_KEY (Supabase REST 401 "Unregistered API key"),
      // a network fault, or a not-yet-run migration. The citizen's report must
      // never be lost to a server-side configuration problem: it is filed on
      // the in-memory overlay instead (persisted "demo" — this process only)
      // and the exact reason is logged. Restoring a valid service key
      // reinstates live writes on the next request with no code change.
      console.error(
        "[safezone] live report write failed — filing on the in-memory overlay instead:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ---- demo overlay path (no backend needed) ----

  let incidentId: string;
  let createdIncident = false;
  if (choice.target) {
    incidentId = choice.target.id;
    overlay.incidents.set(choice.target.id, {
      ...choice.target,
      reportCount: choice.target.reportCount + 1,
    });
  } else {
    incidentId = genId();
    createdIncident = true;
    overlay.incidents.set(incidentId, newIncidentFrom(input, incidentId, now));
  }

  const report: Report = {
    id: reportId,
    incidentId,
    venueId: input.venueId,
    reporterId: input.reporterId,
    inputText: input.description,
    photoUrl: photo.photoUrl,
    aiLanguage: input.aiLanguage ?? null,
    aiVision: input.aiVision ?? null,
    confirmed: false,
    lat: input.lat ?? venue.lat,
    lng: input.lng ?? venue.lng,
    status: "pending",
    createdAt: now,
    locationUnverified,
  };

  // Citizen signals on the checklist — the unverified TRUST tier.
  // The primary issue key plus any extra confirmed fails from the photo flow;
  // a fresher citizen fail supersedes a stale inspection pass (contradiction)
  // but never downgrades an inspector-confirmed fail.
  const failKeys = [...new Set([input.itemKey, ...(input.extraCitizenFails ?? [])])]
    .filter((k): k is ItemKey => Boolean(k) && CHECKLIST.some((c) => c.key === k));
  // Phase 5 — remember which items THIS report failed so deletion can revert
  // the overlay states below (in-memory only; live writes no item states).
  report.failedItemKeys = failKeys;
  overlay.reports.set(report.id, report);
  for (const key of failKeys) {
    const current = data.itemStates.find(
      (s) => s.venueId === input.venueId && s.itemKey === key,
    );
    if (!(current && current.source === "inspection" && current.status === "fail")) {
      overlay.itemStates.set(`${input.venueId}:${key}`, {
        venueId: input.venueId,
        itemKey: key,
        status: "fail",
        source: "citizen",
        updatedAt: now,
      });
    }
  }

  const historyEvent: HistoryEvent = {
    id: genId(),
    venueId: input.venueId,
    incidentId,
    eventType: createdIncident ? "incident_opened" : "report_corroborated",
    description: createdIncident
      ? `Citizen report filed — "${input.title}".`
      : "Another citizen corroborated an open issue.",
    createdAt: now,
  };
  overlay.historyEvents.set(historyEvent.id, historyEvent);

  writeCache(null);
  const fresh = await getDataset();
  return {
    reportId: report.id,
    incidentId,
    createdIncident,
    venue: buildSummary(venue, fresh),
    persisted,
    photoUpload: photo.photoUpload,
    locationUnverified,
  };
}

// ---------------------------------------------------------------------------
// Phase 4 — dedup: match a not-yet-filed report against open incidents
// ---------------------------------------------------------------------------

export type { IncidentMatchResult };

/**
 * Match a new report (venue + issue + complaint text) against the venue's
 * UNRESOLVED incidents: same issue_key, or complaint-text token overlap
 * above 0.5. Feeds the confirm-screen banner — never files anything.
 */
export async function findIncidentMatch(
  venueId: string,
  opts: { issueKey?: string | null; text?: string | null },
): Promise<IncidentMatchResult | null> {
  const data = await getDataset();
  const candidates: MatchCandidate[] = data.incidents
    .filter((i) => i.venueId === venueId && i.status !== "resolved")
    .map((i) => ({
      incidentId: i.id,
      title: i.title,
      issueKey: i.issueKey,
      status: i.status,
      reportCount: i.reportCount,
      texts: data.reports
        .filter((r) => r.incidentId === i.id && r.inputText)
        .map((r) => r.inputText),
    }));
  return findBestMatch(candidates, opts);
}

// ---------------------------------------------------------------------------
// Phase 5 — delete my report (citizen, /my-reports)
// ---------------------------------------------------------------------------

/** Raised when a report is locked (inspected) — maps to HTTP 409. */
export class ReportLockedError extends Error {
  constructor(message = "Locked after inspection — this report is part of the government record.") {
    super(message);
    this.name = "ReportLockedError";
  }
}

/**
 * The delete gate, shared by the API and the UI: a report is deletable only
 * while it is pre-inspection — the linked incident is still 'open' (reported /
 * triaged) AND the report itself is 'pending' (no inspector verdict). A loose
 * report (no incident) was never inspected, so it stays deletable.
 */
export function isReportDeletable(
  report: Pick<Report, "status" | "incidentId">,
  incident?: Pick<Incident, "status"> | null,
): boolean {
  if (report.status !== "pending") return false; // confirmed / resolved / rejected by an inspector
  if (report.incidentId && incident && incident.status !== "open") return false; // verified / action_taken / resolved
  return true;
}

export interface DeleteReportOutcome {
  persisted: "supabase" | "demo";
  reportId: string;
  venueId: string;
  /** The incident the report was linked to, if any. */
  incidentId: string | null;
  /** Remaining report_count on the incident; null when the incident was removed. */
  incidentReportCount: number | null;
  incidentDeleted: boolean;
  /** True when a stored bucket object was actually removed. */
  photoDeleted: boolean;
  /** The venue's risk summary AFTER the deletion (recomputed on read). */
  venue: VenueSummary;
}

/**
 * Delete the citizen's OWN pre-inspection report.
 *
 *   • Locked after inspection — verified / action_taken / resolved incidents
 *     (or inspector-confirmed reports) are government record: refuse.
 *   • Linked incident → report_count −1; at 0 the incident (and its history
 *     events) is removed with it.
 *   • The evidence photo is deleted from the report-photos bucket.
 *   • The venue's risk score is recomputed (risk is derived on read — the
 *     cache invalidation below makes the next read reflect the deletion).
 */
export async function deleteReport(reportId: string, reporterId: string): Promise<DeleteReportOutcome> {
  const data = await getDataset();
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) throw new Error("Report not found — it may have been filed in an earlier demo session.");
  if (report.reporterId !== reporterId) {
    throw new Error("This report belongs to another reporter.");
  }
  const venue = data.venues.find((v) => v.id === report.venueId);
  if (!venue) throw new Error("Venue not found");

  const incident = report.incidentId
    ? data.incidents.find((i) => i.id === report.incidentId)
    : undefined;
  if (!isReportDeletable(report, incident)) throw new ReportLockedError();

  const incidentHistory = incident
    ? data.historyEvents.filter((h) => h.incidentId === incident.id)
    : [];
  const remainingCount = incident ? Math.max(0, incident.reportCount - 1) : null;
  const incidentDeleted = Boolean(incident && remainingCount !== null && remainingCount <= 0);

  let persisted: DeleteReportOutcome["persisted"] = "demo";
  let photoDeleted = false;

  if (supabaseAdmin) {
    // Service-role only — the anon client cannot delete (RLS, no auth session).
    const writer = supabaseAdmin;

    // 1. Evidence photo — remove the bucket object first (best-effort: a
    //    failed removal never blocks the report deletion).
    if (report.photoUrl && supabaseAdmin) {
      photoDeleted = await deleteReportPhotoByUrl(supabaseAdmin, report.photoUrl);
    }

    // 2. The report row. reporter_feedback cascades; notifications keep their
    //    FK contract (report_id set null, per the Phase 3 migration).
    const { error: delErr } = await writer.from("reports").delete().eq("id", reportId);
    if (delErr) throw new Error(`report delete failed: ${delErr.message}`);

    // 3. Incident decrement / removal.
    if (incident) {
      if (incidentDeleted) {
        const { error: histErr } = await writer
          .from("history_events")
          .delete()
          .eq("incident_id", incident.id);
        if (histErr) throw new Error(`incident history delete failed: ${histErr.message}`);
        const { error: incErr } = await writer.from("incidents").delete().eq("id", incident.id);
        if (incErr) throw new Error(`incident delete failed: ${incErr.message}`);
      } else {
        const { error: decErr } = await writer
          .from("incidents")
          .update({ report_count: remainingCount })
          .eq("id", incident.id);
        if (decErr) throw new Error(`incident report_count update failed: ${decErr.message}`);
      }
    }
    persisted = "supabase";
  } else {
    // ---- demo overlay path (tombstones hide seeded rows too) ----
    photoDeleted = false; // demo photos are inline data URLs — nothing stored

    overlay.reports.delete(reportId);
    overlay.deletedReports.add(reportId);
    overlay.feedback.delete(reportId);
    overlay.deletedFeedback.add(reportId);

    if (incident) {
      if (incidentDeleted) {
        overlay.incidents.delete(incident.id);
        overlay.deletedIncidents.add(incident.id);
        for (const h of incidentHistory) {
          overlay.historyEvents.delete(h.id);
          overlay.deletedHistoryEvents.add(h.id);
        }
      } else {
        // Overlay entry wins over the seeded row — carries the decremented count.
        overlay.incidents.set(incident.id, { ...incident, reportCount: remainingCount! });
      }
    }

    // Revert the overlay citizen item states THIS report wrote (identified by
    // matching timestamp + provenance; a later report's signal stays).
    for (const key of report.failedItemKeys ?? []) {
      const k = `${report.venueId}:${key}`;
      const state = overlay.itemStates.get(k);
      if (
        state &&
        state.source === "citizen" &&
        state.status === "fail" &&
        state.updatedAt === report.createdAt
      ) {
        // Removing the overlay entry restores the seeded state underneath
        // (or nothing, when the seed had no state for this item).
        overlay.itemStates.delete(k);
      }
    }
  }

  // 4. Risk recompute — the score is derived on read; invalidate the cache so
  //    the next read (list, queue, passport) reflects the deletion.
  writeCache(null);
  const fresh = await getDataset();
  const freshVenue = fresh.venues.find((v) => v.id === report.venueId)!;
  return {
    persisted,
    reportId,
    venueId: report.venueId,
    incidentId: incident?.id ?? null,
    incidentReportCount: incidentDeleted ? null : remainingCount,
    incidentDeleted,
    photoDeleted,
    venue: buildSummary(freshVenue, fresh),
  };
}

// ---------------------------------------------------------------------------
// Report receipt + officer queue views (feeds /my-reports and /gov)
// ---------------------------------------------------------------------------

export type FiledReportView = Report & {
  venueName: string;
  ward: string;
  reporterName: string;
};

/** One filed report + the venue's current risk summary (/my-reports/[id]). */
export async function getReportById(
  id: string,
): Promise<{ report: FiledReportView; venue: VenueSummary } | null> {
  const data = await getDataset();
  const report = data.reports.find((r) => r.id === id);
  if (!report) return null;
  const venue = data.venues.find((v) => v.id === report.venueId);
  if (!venue) return null;
  const reporter = data.profiles.find((p) => p.id === report.reporterId);
  return {
    report: {
      ...report,
      venueName: venue.name,
      ward: venue.ward,
      reporterName: reporter?.name ?? "Anonymous citizen",
    },
    venue: buildSummary(venue, data),
  };
}

export type IncidentQueueItem = Incident & {
  venueName: string;
  venueWard: string;
  venueRiskTier: RiskTier;
  venueRiskScore: number;
  photos: number;
  department: string;
  /** Phase 5 spec completion — the venue carries the monsoon/waterlogging flag. */
  monsoonFlagged: boolean;
};

/** Department responsible for an incident: explicit column, else category routing. */
function departmentForIncident(incident: Incident): string {
  const explicit = (incident as Incident & { department?: string }).department;
  return explicit ?? departmentOf(incident.category);
}

/** Unresolved incidents across the registry, sorted severity → corroboration → age. */
export async function getIncidentQueue(): Promise<IncidentQueueItem[]> {
  const data = await getDataset();
  const summaries = new Map(data.venues.map((v) => [v.id, buildSummary(v, data)]));
  // One monsoon-flag computation per venue — the queue chip reuses it.
  const monsoonByVenue = new Map(
    data.venues.map((v) => [
      v.id,
      computeMonsoonFlag(
        v.id,
        data.reports.filter((r) => r.venueId === v.id),
        data.incidents.filter((i) => i.venueId === v.id),
      ),
    ]),
  );

  return data.incidents
    .filter((i) => i.status !== "resolved")
    .map((i) => {
      const venue = data.venues.find((v) => v.id === i.venueId);
      const summary = i.venueId ? summaries.get(i.venueId) : undefined;
      const reports = data.reports.filter((r) => r.incidentId === i.id);
      return {
        ...i,
        department: departmentForIncident(i),
        venueName: venue?.name ?? "Unknown venue",
        venueWard: venue?.ward ?? "—",
        venueRiskTier: summary?.risk.tier ?? "INSUFFICIENT_DATA",
        venueRiskScore: summary?.risk.score ?? 0,
        photos: reports.filter((r) => r.photoUrl).length,
        monsoonFlagged: i.venueId ? monsoonByVenue.get(i.venueId) !== null : false,
      } satisfies IncidentQueueItem;
    })
    .sort((a, b) =>
      a.severity === b.severity
        ? b.reportCount - a.reportCount || a.createdAt.localeCompare(b.createdAt)
        : a.severity === "critical"
          ? -1
          : 1,
    );
}

export interface IncidentEvidence {
  url: string;
  caption: string;
}

export interface IncidentCase {
  incident: Incident & { department: string };
  venue: VenueSummary;
  evidence: IncidentEvidence[];
  reports: (Report & { reporterName: string; reporterReputation: number })[];
  inspections: (Inspection & { inspectorName: string })[];
  history: HistoryEvent[];
}

/** The officer case file for one incident. */
export async function getIncidentCase(id: string): Promise<IncidentCase | null> {
  const data = await getDataset();
  const incident = data.incidents.find((i) => i.id === id);
  if (!incident) return null;
  const venue = data.venues.find((v) => v.id === incident.venueId);
  if (!venue) return null;

  const nameOf = new Map(data.profiles.map((p) => [p.id, p.name]));
  const repOf = new Map(data.profiles.map((p) => [p.id, p.reputation]));
  const reports = data.reports.filter((r) => r.incidentId === id);

  return {
    incident: { ...incident, department: departmentForIncident(incident) },
    venue: buildSummary(venue, data),
    evidence: reports
      .filter((r) => r.photoUrl)
      .map((r) => ({
        url: r.photoUrl!,
        caption: `Evidence — ${nameOf.get(r.reporterId)?.split(" ")[0] ?? "citizen"}`,
      })),
    reports: reports
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        ...r,
        reporterName: nameOf.get(r.reporterId) ?? "Anonymous citizen",
        reporterReputation: repOf.get(r.reporterId) ?? 50,
      })),
    inspections: data.inspections
      .filter((i) => i.venueId === venue.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => ({ ...i, inspectorName: nameOf.get(i.inspectorId) ?? "Inspector" })),
    // Case history: this incident's events plus venue-wide records (notices).
    history: data.historyEvents
      .filter((h) => h.venueId === venue.id && (h.incidentId === id || h.incidentId === null))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

// ---------------------------------------------------------------------------
// Phase 5 spec completion — Certificates / NOC + Seasonal (monsoon) risks
// ---------------------------------------------------------------------------

/** A flagged venue row in the /gov Seasonal Risks panel. */
export interface SeasonalRiskItem extends MonsoonFlag {
  name: string;
  ward: string;
  type: Venue["type"];
}

/**
 * All venues carrying the monsoon/waterlogging flag (≥ 2 matching reports in
 * the last 12 months), most reports first — the /gov Seasonal Risks panel.
 * Read-only derived view: no formula, no persistence.
 */
export async function getSeasonalRisks(): Promise<SeasonalRiskItem[]> {
  const data = await getDataset();
  const flagged: SeasonalRiskItem[] = [];
  for (const venue of data.venues) {
    const flag = computeMonsoonFlag(
      venue.id,
      data.reports.filter((r) => r.venueId === venue.id),
      data.incidents.filter((i) => i.venueId === venue.id),
    );
    if (flag) flagged.push({ ...flag, name: venue.name, ward: venue.ward, type: venue.type });
  }
  return flagged.sort((a, b) => b.reportCount - a.reportCount || a.name.localeCompare(b.name));
}

export interface CertificateInput {
  venueId: string;
  certType: CertType;
  certNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  authority: string | null;
  /** The uploaded certificate photo (data URL) — stored in the report-photos bucket. */
  photoDataUrl: string | null;
}

export interface SaveCertificateOutcome {
  persisted: "supabase" | "demo";
  certificate: Certificate;
  /** How the certificate photo was handled (Storage upload / inline data URL / none). */
  photoUpload: "storage" | "data-url" | "skipped" | "failed";
}

/**
 * Save an officer-confirmed certificate for a venue.
 *
 * The officer reviews the OCR-extracted fields (or types them by hand) before
 * this is called — nothing is saved from the image automatically. The photo
 * lands in the report-photos bucket at {venueId}/cert-{timestamp}.jpg; the
 * row itself is display-only and never touches the risk formula.
 */
export async function saveCertificate(input: CertificateInput): Promise<SaveCertificateOutcome> {
  const data = await getDataset();
  const venue = data.venues.find((v) => v.id === input.venueId);
  if (!venue) throw new Error("Venue not found");
  if (!isCertType(input.certType)) throw new Error("cert_type must be fire_noc, health_license or trade_license");

  const id = genId();
  const now = new Date().toISOString();

  let photoUrl: string | null = null;
  let photoUpload: SaveCertificateOutcome["photoUpload"] = "skipped";
  if (input.photoDataUrl) {
    if (supabaseAdmin) {
      const url = await uploadCertificatePhoto(supabaseAdmin, input.venueId, input.photoDataUrl);
      photoUrl = url;
      photoUpload = url ? "storage" : "failed";
    } else {
      photoUrl = input.photoDataUrl; // inline data URL (demo overlay only)
      photoUpload = "data-url";
    }
  }

  const certificate: Certificate = {
    id,
    venueId: input.venueId,
    certType: input.certType,
    certNumber: input.certNumber,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    authority: input.authority,
    photoUrl,
    createdAt: now,
  };

  let persisted: SaveCertificateOutcome["persisted"] = "demo";
  if (supabaseAdmin) {
    // Service-role only — same RLS pattern as every other write: the browser
    // never talks to Supabase and there is no auth session, so the anon client
    // would be rejected by the `to authenticated` policies.
    const { error } = await supabaseAdmin.from("certificates").insert({
      id: certificate.id,
      venue_id: certificate.venueId,
      cert_type: certificate.certType,
      cert_number: certificate.certNumber,
      issue_date: certificate.issueDate,
      expiry_date: certificate.expiryDate,
      authority: certificate.authority,
      photo_url: certificate.photoUrl,
      created_at: certificate.createdAt,
    });
    if (error) {
      throw new Error(
        /row-level security/i.test(error.message)
          ? "Certificate insert was rejected by row-level security — writes go through the service-role key (SUPABASE_SERVICE_ROLE_KEY)."
          : `certificate insert failed: ${error.message}`,
      );
    }
    persisted = "supabase";
  } else {
    overlay.certificates.set(certificate.id, certificate);
  }

  writeCache(null); // invalidate so the next read reflects the new row
  return { persisted, certificate, photoUpload };
}

// ---------------------------------------------------------------------------
// PHASE 3 — the inspection → resolution → citizen-closure loop
//
// Status lifecycle used everywhere:
//   reported/open → triaged → verified → action_taken → resolved
// ('open' is the stored synonym of the 'reported'/'triaged' stages — the DB
//  constraint and every existing reader keep working unchanged.)
//
// All writes go through the service-role admin client (same pattern as
// addReport: RLS stays on, the demo personas are a server-side choice) and
// mirror into the in-memory overlay when no backend is configured.
// ---------------------------------------------------------------------------

export type AuditItemStatus = "pass" | "fail" | "not_verified";

export interface AuditItemInput {
  itemKey: string;
  status: AuditItemStatus;
  photoDataUrl?: string | null;
}

export interface InspectionOutcome {
  inspectionId: string;
  persisted: "supabase" | "demo";
  /** Item keys recorded with source='inspection' (verified tier). */
  updatedItems: string[];
  /** Incident ids moved open → verified. */
  verifiedIncidents: string[];
  /** Profile ids that received a notification. */
  notifiedReporters: string[];
  photoUploads: { storage: number; dataUrl: number; failed: number };
  riskBefore: number;
  riskAfter: number;
  venue: VenueSummary;
  /** Phase 4 — reporter reputation earned on the verified incidents
   *  (+5 claim confirmed by a fail, −10 contradicted by a pass). */
  reputationChanges: { reporterId: string; before: number; after: number; delta: number }[];
}

export interface InspectionInput {
  venueId: string;
  inspectorId: string;
  items: AuditItemInput[];
}

/** Case header + audit form context for /gov/inspect/[id]. */
export interface InspectorContext {
  venue: VenueSummary;
  venueType: Venue["type"];
  checklist: { category: (typeof CATEGORIES)[number]; department: string; rows: ChecklistRow[] }[];
  openIncidents: (Incident & { department: string; reportCount: number })[];
  openCritical: number;
  openMinor: number;
  totalReports: number;
  lastInspectionAt: string | null;
  lastInspectedDays: number | null;
  reporters: { id: string; name: string }[];
}

export async function getInspectorContext(venueId: string): Promise<InspectorContext | null> {
  const data = await getDataset();
  const venue = data.venues.find((v) => v.id === venueId);
  if (!venue) return null;

  const summary = buildSummary(venue, data);
  const stateByItem = new Map(
    data.itemStates.filter((s) => s.venueId === venueId).map((s) => [s.itemKey, s]),
  );
  const openIncidents = data.incidents
    .filter((i) => i.venueId === venueId && i.status !== "resolved" && i.status !== "action_taken")
    .map((i) => ({ ...i, department: departmentForIncident(i) }));

  const reporterIds = [...new Set(data.reports.filter((r) => r.venueId === venueId).map((r) => r.reporterId))];
  const lastInspection = data.inspections
    .filter((i) => i.venueId === venueId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return {
    venue: summary,
    venueType: venue.type,
    checklist: CATEGORIES.map((category) => ({
      category,
      department: departmentOf(category.key),
      rows: category.items.map((item) => ({
        item,
        state: stateByItem.get(item.key) ?? null,
        display: rowDisplay(stateByItem.get(item.key) ?? null),
      })),
    })),
    openIncidents,
    openCritical: openIncidents.filter((i) => i.severity === "critical").length,
    openMinor: openIncidents.filter((i) => i.severity === "minor").length,
    totalReports: data.reports.filter((r) => r.venueId === venueId).length,
    lastInspectionAt: lastInspection?.createdAt ?? null,
    lastInspectedDays: summary.lastInspectedDays,
    reporters: reporterIds.map((id) => ({
      id,
      name: data.profiles.find((p) => p.id === id)?.name ?? "Anonymous citizen",
    })),
  };
}

/**
 * Submit a full safety audit (the /gov/inspect/[id] form).
 *
 * Effects: inspections row inserted; item_states upserted with
 * source='inspection' (verified tier, overrides citizen data); the venue's
 * open incidents → 'verified'; history_events written; every reporter of the
 * venue notified; risk + venue status recomputed on the next read.
 */
export async function submitInspection(input: InspectionInput): Promise<InspectionOutcome> {
  const data = await getDataset();
  const venue = data.venues.find((v) => v.id === input.venueId);
  if (!venue) throw new Error("Venue not found");
  if (!input.inspectorId) throw new Error("Inspector identity missing");
  const valid = input.items.filter(
    (r) => CHECKLIST.some((c) => c.key === r.itemKey) && ["pass", "fail", "not_verified"].includes(r.status),
  );
  if (valid.length === 0) throw new Error("No checklist items assessed");

  const before = buildSummary(venue, data);
  const now = new Date().toISOString();

  // -- resolve per-item photos (Storage upload when configured) --------------
  const photoUploads = { storage: 0, dataUrl: 0, failed: 0 };
  const photos: Record<string, string> = {};
  for (const row of valid) {
    if (!row.photoDataUrl) continue;
    if (supabaseAdmin) {
      const url = await uploadEvidencePhoto(
        supabaseAdmin,
        `${input.venueId}/inspect-${row.itemKey}-${Date.now()}.jpg`,
        row.photoDataUrl,
      );
      if (url) {
        photos[row.itemKey] = url;
        photoUploads.storage++;
      } else {
        photoUploads.failed++;
      }
    } else {
      photos[row.itemKey] = row.photoDataUrl; // inline data URL (demo overlay)
      photoUploads.dataUrl++;
    }
  }

  const results: Record<string, string> = Object.fromEntries(valid.map((r) => [r.itemKey, r.status]));

  const inspectionId = genId();
  const inspection: Inspection = {
    id: inspectionId,
    venueId: input.venueId,
    inspectorId: input.inspectorId,
    results: { ...results, ...(Object.keys(photos).length > 0 ? { _photos: photos } : {}) },
    afterActionPhotoUrl: null,
    notice: null,
    createdAt: now,
  };

  // -- incidents to verify + reporters to notify ----------------------------
  const toVerify = data.incidents.filter((i) => i.venueId === input.venueId && i.status === "open");
  const failedItems = valid.filter((r) => r.status === "fail").map((r) => r.itemKey);
  const verifiedReports = data.reports.filter((r) => r.venueId === input.venueId);

  // -- Phase 4 — reporter reputation on the verified incidents ---------------
  // The audit is the moment of truth for citizen claims: the reporter of a
  // claim the inspector CONFIRMS (audit fail on the incident's issue) earns
  // +5; a claim the audit CONTRADICTS (audit pass where they reported a fail)
  // costs −10. 'not_verified' neither confirms nor contradicts. Only the
  // incidents being verified in THIS call (open → verified) earn adjustments,
  // so a re-inspection cannot double-count. Clamped to [0, 100] — the live
  // schema's profiles_reputation_check (migration.sql) enforces exactly that.
  const repDeltas = new Map<string, number>();
  for (const inc of toVerify) {
    const audited = results[inc.issueKey];
    if (audited !== "fail" && audited !== "pass") continue;
    const linked = data.reports.filter((r) => r.incidentId === inc.id);
    for (const rid of new Set(linked.map((r) => r.reporterId))) {
      repDeltas.set(rid, (repDeltas.get(rid) ?? 0) + (audited === "fail" ? 5 : -10));
    }
  }
  const repBefore = new Map(data.profiles.map((p) => [p.id, p.reputation]));
  const reputationChanges = [...repDeltas.entries()]
    .map(([reporterId, delta]) => {
      const before = repBefore.get(reporterId) ?? 50;
      const after = Math.max(0, Math.min(100, before + delta));
      return { reporterId, before, after, delta: after - before };
    })
    .filter((c) => c.delta !== 0);

  const newEvents: HistoryEvent[] = [];
  for (const inc of toVerify) {
    newEvents.push({
      id: genId(),
      venueId: input.venueId,
      incidentId: inc.id,
      eventType: "incident_verified",
      description: `Inspector verified: ${inc.title.toLowerCase()}.`,
      createdAt: now,
    });
  }
  newEvents.push({
    id: genId(),
    venueId: input.venueId,
    incidentId: null,
    eventType: "inspection_completed",
    description: `Safety inspection completed — ${valid.filter((r) => r.status === "pass").length} of ${valid.length} applicable items passed${failedItems.length > 0 ? `; failed: ${failedItems.map((k) => CHECKLIST_MAP[k as ItemKey]?.label ?? k).join(", ")}` : ""}.`,
    createdAt: now,
  });

  const notified = [...new Set(verifiedReports.map((r) => r.reporterId))].map((reporterId) => ({
    id: genId(),
    recipientId: reporterId,
    title: `Inspection completed at ${venue.name}`,
    body: `Your report at ${venue.name} was inspected by the ${departmentOf(toVerify[0]?.category ?? "FIRE_SAFETY")} department. Verified findings have been recorded.`,
    reportId: verifiedReports.find((r) => r.reporterId === reporterId)?.id ?? null,
    incidentId: toVerify[0]?.id ?? null,
    readAt: null,
    createdAt: now,
  }));

  let persisted: InspectionOutcome["persisted"] = "demo";

  if (supabaseAdmin) {
    // Service-role only — the anon client cannot write (RLS, no auth session).
    const writer = supabaseAdmin;

    const { error: insErr } = await writer.from("inspections").insert({
      id: inspectionId,
      venue_id: input.venueId,
      inspector_id: input.inspectorId,
      results: inspection.results,
      after_action_photo_url: null,
      notice: null,
      created_at: now,
    });
    if (insErr) throw new Error(`inspection insert failed: ${insErr.message}`);

    const { error: stateErr } = await writer
      .from("item_states")
      .upsert(
        valid.map((r) => ({
          venue_id: input.venueId,
          item_key: r.itemKey,
          status: r.status,
          source: "inspection",
          updated_at: now,
        })),
        { onConflict: "venue_id,item_key" },
      );
    if (stateErr) throw new Error(`item_states upsert failed: ${stateErr.message}`);

    if (toVerify.length > 0) {
      const { error: incErr } = await writer
        .from("incidents")
        .update({ status: "verified" })
        .in("id", toVerify.map((i) => i.id));
      if (incErr) throw new Error(`incident update failed: ${incErr.message}`);

      const linkedReports = data.reports.filter((r) => toVerify.some((i) => i.id === r.incidentId));
      if (linkedReports.length > 0) {
        const { error: repErr } = await writer
          .from("reports")
          .update({ status: "confirmed" })
          .in("id", linkedReports.map((r) => r.id));
        if (repErr) throw new Error(`report update failed: ${repErr.message}`);
      }
    }

    if (newEvents.length > 0) {
      const { error: histErr } = await writer.from("history_events").insert(
        newEvents.map((h) => ({
          id: h.id,
          venue_id: h.venueId,
          incident_id: h.incidentId,
          event_type: h.eventType,
          description: h.description,
          created_at: h.createdAt,
        })),
      );
      if (histErr) throw new Error(`history insert failed: ${histErr.message}`);
    }

    if (notified.length > 0) {
      const { error: notifErr } = await writer.from("notifications").insert(
        notified.map((n) => ({
          id: n.id,
          recipient_id: n.recipientId,
          title: n.title,
          body: n.body,
          report_id: n.reportId,
          incident_id: n.incidentId,
          read_at: null,
          created_at: n.createdAt,
        })),
      );
      if (notifErr) console.warn("[safezone] notifications insert failed:", notifErr.message);
    }

    // Phase 4 — reputation adjustments (warn-only: a failed update must never
    // fail the audit itself; the re-read below reflects whatever landed).
    for (const change of reputationChanges) {
      const { error: repErr } = await writer
        .from("profiles")
        .update({ reputation: change.after })
        .eq("id", change.reporterId);
      if (repErr) console.warn("[safezone] reputation update failed:", repErr.message);
    }

    persisted = "supabase";
  }

  // ---- demo overlay mirror (no backend, no service key, or the live
  //      write degrades because the anon client cannot pass RLS) ---------
  if (persisted === "demo") {
    overlay.inspections.set(inspectionId, inspection);
    for (const r of valid) {
      overlay.itemStates.set(`${input.venueId}:${r.itemKey}`, {
        venueId: input.venueId,
        itemKey: r.itemKey,
        status: r.status,
        source: "inspection",
        updatedAt: now,
      });
    }
    for (const inc of toVerify) {
      overlay.incidents.set(inc.id, { ...inc, status: "verified" });
      for (const rep of data.reports.filter((r) => r.incidentId === inc.id)) {
        overlay.reports.set(rep.id, { ...rep, status: "confirmed" });
      }
    }
    for (const h of newEvents) overlay.historyEvents.set(h.id, h);
    for (const n of notified) overlay.notifications.set(n.id, n);
    for (const change of reputationChanges) {
      overlay.reputation.set(change.reporterId, change.after);
    }
  }

  writeCache(null);
  const fresh = await getDataset();
  const freshVenue = fresh.venues.find((v) => v.id === input.venueId)!;
  return {
    inspectionId,
    persisted,
    updatedItems: valid.map((r) => r.itemKey),
    verifiedIncidents: toVerify.map((i) => i.id),
    notifiedReporters: notified.map((n) => n.recipientId),
    photoUploads,
    riskBefore: before.risk.score,
    riskAfter: buildSummary(freshVenue, fresh).risk.score,
    venue: buildSummary(freshVenue, fresh),
    reputationChanges,
  };
}

export interface ResolutionInput {
  venueId: string;
  inspectorId: string;
  /** Corrective-action photo (camera capture / file fallback data URL). */
  afterActionPhotoDataUrl?: string | null;
  /** Official notice text shown to citizens. */
  notice?: string | null;
  /** Items that failed the audit, re-verified after the fix. */
  reverify: { itemKey: string; fixed: boolean }[];
}

export interface ResolutionOutcome {
  persisted: "supabase" | "demo";
  actionTakenIncidents: string[];
  resolvedIncidents: string[];
  reverifiedPass: string[];
  stillFailing: string[];
  photoUpload: "storage" | "data-url" | "failed" | "skipped";
  notifiedReporters: string[];
  riskBefore: number;
  riskAfter: number;
  venue: VenueSummary;
}

/**
 * Resolution step (after the audit, same flow): after-action photo →
 * report-photos bucket at {venueId}/after-{timestamp}.jpg →
 * inspections.after_action_photo_url + notice; incidents 'verified' →
 * 'action_taken'; re-verified failed items flip to passing (source =
 * inspection) and their incidents → 'resolved'. History + notifications at
 * each transition.
 */
export async function submitResolution(input: ResolutionInput): Promise<ResolutionOutcome> {
  const data = await getDataset();
  const venue = data.venues.find((v) => v.id === input.venueId);
  if (!venue) throw new Error("Venue not found");

  const before = buildSummary(venue, data);
  const now = new Date().toISOString();
  const department = departmentOf(data.incidents.find((i) => i.venueId === input.venueId)?.category ?? "FIRE_SAFETY");

  // -- after-action photo → existing report-photos bucket --------------------
  let photoUpload: ResolutionOutcome["photoUpload"] = "skipped";
  let afterActionUrl: string | null = null;
  if (input.afterActionPhotoDataUrl) {
    if (supabaseAdmin) {
      afterActionUrl = await uploadEvidencePhoto(
        supabaseAdmin,
        `${input.venueId}/after-${Date.now()}.jpg`,
        input.afterActionPhotoDataUrl,
      );
      photoUpload = afterActionUrl ? "storage" : "failed";
    } else {
      afterActionUrl = input.afterActionPhotoDataUrl;
      photoUpload = "data-url";
    }
  }

  const fixedKeys = input.reverify.filter((r) => r.fixed).map((r) => r.itemKey);
  const stillFailing = input.reverify.filter((r) => !r.fixed).map((r) => r.itemKey);

  // Latest inspection for this venue gets the after-action record.
  const latestInspection = data.inspections
    .filter((i) => i.venueId === input.venueId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  // -- transitions ------------------------------------------------------------
  const inProgress = data.incidents.filter((i) => i.venueId === input.venueId && i.status === "verified");
  const resolvable = data.incidents.filter(
    (i) =>
      i.venueId === input.venueId &&
      (i.status === "verified" || i.status === "action_taken") &&
      fixedKeys.includes(i.issueKey),
  );

  const venueReports = data.reports.filter((r) => r.venueId === input.venueId);
  const notified: Notification[] = [];
  const newEvents: HistoryEvent[] = [];

  for (const inc of inProgress) {
    newEvents.push({
      id: genId(),
      venueId: input.venueId,
      incidentId: inc.id,
      eventType: "action_taken",
      description: `Corrective action taken${input.notice ? ` — ${input.notice}` : ""}.`,
      createdAt: now,
    });
  }
  for (const inc of resolvable) {
    newEvents.push({
      id: genId(),
      venueId: input.venueId,
      incidentId: inc.id,
      eventType: "incident_resolved",
      description: `Issue resolved and re-verified on site — "${inc.title}".`,
      createdAt: now,
    });
  }

  const recipientIds = [...new Set(venueReports.map((r) => r.reporterId))];
  for (const recipientId of recipientIds) {
    if (resolvable.length > 0) {
      notified.push({
        id: genId(),
        recipientId,
        title: `You helped fix ${venue.name}`,
        body: `The issue you reported at ${venue.name} has been resolved by the ${department} department.`,
        reportId: venueReports.find((r) => r.reporterId === recipientId)?.id ?? null,
        incidentId: resolvable[0]?.id ?? null,
        readAt: null,
        createdAt: now,
      });
    } else if (inProgress.length > 0) {
      notified.push({
        id: genId(),
        recipientId,
        title: `Action taken at ${venue.name}`,
        body: `The ${department} department has started corrective action at ${venue.name}${input.notice ? `: ${input.notice}` : "."}`,
        reportId: venueReports.find((r) => r.reporterId === recipientId)?.id ?? null,
        incidentId: inProgress[0]?.id ?? null,
        readAt: null,
        createdAt: now,
      });
    }
  }

  let persisted: ResolutionOutcome["persisted"] = "demo";

  if (supabaseAdmin) {
    // Service-role only — the anon client cannot write (RLS, no auth session).
    const writer = supabaseAdmin;

    if (latestInspection) {
      const { error } = await writer
        .from("inspections")
        .update({ after_action_photo_url: afterActionUrl, notice: input.notice ?? null })
        .eq("id", latestInspection.id);
      if (error) throw new Error(`inspection update failed: ${error.message}`);
    }

    const { error: stateErr } = await writer
      .from("item_states")
      .upsert(
        fixedKeys.map((itemKey) => ({
          venue_id: input.venueId,
          item_key: itemKey,
          status: "pass",
          source: "inspection",
          updated_at: now,
        })),
        { onConflict: "venue_id,item_key" },
      );
    if (stateErr) throw new Error(`item_states upsert failed: ${stateErr.message}`);

    if (inProgress.length > 0) {
      const { error } = await writer
        .from("incidents")
        .update({ status: "action_taken" })
        .in("id", inProgress.map((i) => i.id));
      if (error) throw new Error(`incident update failed: ${error.message}`);
    }
    if (resolvable.length > 0) {
      const { error } = await writer
        .from("incidents")
        .update({ status: "resolved" })
        .in("id", resolvable.map((i) => i.id));
      if (error) throw new Error(`incident update failed: ${error.message}`);

      const linkedReports = data.reports.filter((r) => resolvable.some((i) => i.id === r.incidentId));
      if (linkedReports.length > 0) {
        const { error: repErr } = await writer
          .from("reports")
          .update({ status: "resolved" })
          .in("id", linkedReports.map((r) => r.id));
        if (repErr) throw new Error(`report update failed: ${repErr.message}`);
      }
    }

    if (newEvents.length > 0) {
      const { error } = await writer.from("history_events").insert(
        newEvents.map((h) => ({
          id: h.id,
          venue_id: h.venueId,
          incident_id: h.incidentId,
          event_type: h.eventType,
          description: h.description,
          created_at: h.createdAt,
        })),
      );
      if (error) throw new Error(`history insert failed: ${error.message}`);
    }

    if (notified.length > 0) {
      const { error } = await writer.from("notifications").insert(
        notified.map((n) => ({
          id: n.id,
          recipient_id: n.recipientId,
          title: n.title,
          body: n.body,
          report_id: n.reportId,
          incident_id: n.incidentId,
          read_at: null,
          created_at: n.createdAt,
        })),
      );
      if (error) console.warn("[safezone] notifications insert failed:", error.message);
    }

    persisted = "supabase";
  }

  // ---- demo overlay mirror ---------------------------------------------------
  if (persisted === "demo") {
    if (latestInspection) {
      overlay.inspections.set(latestInspection.id, {
        ...latestInspection,
        afterActionPhotoUrl: afterActionUrl,
        notice: input.notice ?? null,
      });
    }
    for (const itemKey of fixedKeys) {
      overlay.itemStates.set(`${input.venueId}:${itemKey}`, {
        venueId: input.venueId,
        itemKey,
        status: "pass",
        source: "inspection",
        updatedAt: now,
      });
    }
    for (const inc of inProgress) overlay.incidents.set(inc.id, { ...inc, status: "action_taken" });
    for (const inc of resolvable) {
      overlay.incidents.set(inc.id, { ...inc, status: "resolved" });
      for (const rep of data.reports.filter((r) => r.incidentId === inc.id)) {
        overlay.reports.set(rep.id, { ...rep, status: "resolved" });
      }
    }
    for (const h of newEvents) overlay.historyEvents.set(h.id, h);
    for (const n of notified) overlay.notifications.set(n.id, n);
  }

  writeCache(null);
  const fresh = await getDataset();
  const freshVenue = fresh.venues.find((v) => v.id === input.venueId)!;
  return {
    persisted,
    actionTakenIncidents: inProgress.map((i) => i.id),
    resolvedIncidents: resolvable.map((i) => i.id),
    reverifiedPass: fixedKeys,
    stillFailing,
    photoUpload,
    notifiedReporters: notified.map((n) => n.recipientId),
    riskBefore: before.risk.score,
    riskAfter: buildSummary(freshVenue, fresh).risk.score,
    venue: buildSummary(freshVenue, fresh),
  };
}

// ---------------------------------------------------------------------------
// Citizen surface — /my-reports cards, timeline, closure feedback
// ---------------------------------------------------------------------------

export type LifecycleStage = "reported" | "verified" | "action_taken" | "resolved";

export interface CitizenReportCard {
  report: Report;
  venueName: string;
  venueType: Venue["type"];
  ward: string;
  reporterName: string;
  /** Phase 4 — the reporter's current reputation (trust badge on /my-reports). */
  reporterReputation: number;
  issueTitle: string;
  incidentId: string | null;
  /** Derived from the linked incident ('open' → 'reported'); null when loose. */
  lifecycle: LifecycleStage | null;
  timeline: { at: string; eventType: string; description: string }[];
  feedback: ReporterFeedback | null;
}

const stageOf = (incident: Incident | undefined): LifecycleStage | null => {
  if (!incident) return null;
  if (incident.status === "resolved") return "resolved";
  if (incident.status === "action_taken") return "action_taken";
  if (incident.status === "verified") return "verified";
  return "reported"; // 'open' = reported/triaged
};

/** The citizen's own reports, newest first — /my-reports. */
export async function getCitizenReports(reporterId: string): Promise<CitizenReportCard[]> {
  const data = await getDataset();
  const reporter = data.profiles.find((p) => p.id === reporterId);
  const reporterName = reporter?.name ?? "You";
  const reporterReputation = reporter?.reputation ?? 50;

  return data.reports
    .filter((r) => r.reporterId === reporterId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((report) => {
      const venue = data.venues.find((v) => v.id === report.venueId);
      const incident = data.incidents.find((i) => i.id === report.incidentId);
      const timeline = data.historyEvents
        .filter(
          (h) =>
            h.incidentId === report.incidentId &&
            h.createdAt.localeCompare(report.createdAt) >= 0,
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((h) => ({ at: h.createdAt, eventType: h.eventType, description: h.description }));

      return {
        report,
        venueName: venue?.name ?? "Unknown venue",
        venueType: venue?.type ?? "other",
        ward: venue?.ward ?? "—",
        reporterName,
        reporterReputation,
        issueTitle: incident?.title ?? report.inputText.slice(0, 60) ?? "Safety report",
        incidentId: report.incidentId,
        lifecycle: stageOf(incident),
        timeline,
        feedback: data.reporterFeedback.find((f) => f.reportId === report.id) ?? null,
      };
    });
}

export interface FeedbackOutcome {
  persisted: "supabase" | "demo";
  verdict: "fixed" | "still_exists";
  /** Set when 'still exists' reopened the incident. */
  reopenedIncidentId: string | null;
  newReportCount: number | null;
  venue: VenueSummary | null;
}

/**
 * Citizen closure feedback on a resolved report ("Fixed" / "Still exists").
 * 'still exists' reopens the incident (status 'open', report_count + 1) so
 * unresolved claims stay accountable; 'fixed' just records the confirmation.
 */
export async function submitReporterFeedback(
  reportId: string,
  verdict: "fixed" | "still_exists",
): Promise<FeedbackOutcome> {
  const data = await getDataset();
  const report = data.reports.find((r) => r.id === reportId);
  if (!report) throw new Error("Report not found");
  const venue = data.venues.find((v) => v.id === report.venueId);
  const incident = data.incidents.find((i) => i.id === report.incidentId);
  const now = new Date().toISOString();

  const feedback = { reportId, verdict, createdAt: now };
  let reopened: string | null = null;
  let newCount: number | null = null;
  const events: HistoryEvent[] = [];

  if (verdict === "still_exists" && incident && incident.status !== "open") {
    reopened = incident.id;
    newCount = incident.reportCount + 1;
    events.push({
      id: genId(),
      venueId: incident.venueId,
      incidentId: incident.id,
      eventType: "incident_reopened",
      description: "Reporter says the issue still exists — incident reopened for the department.",
      createdAt: now,
    });
  } else if (verdict === "fixed") {
    events.push({
      id: genId(),
      venueId: report.venueId,
      incidentId: report.incidentId,
      eventType: "feedback_received",
      description: "Reporter confirmed the fix — \"You helped fix this\".",
      createdAt: now,
    });
  }

  let persisted: FeedbackOutcome["persisted"] = "demo";

  if (supabaseAdmin) {
    // Service-role only — the anon client cannot write (RLS, no auth session).
    const writer = supabaseAdmin;
    const { error: fbErr } = await writer
      .from("reporter_feedback")
      .upsert({ report_id: reportId, verdict, created_at: now }, { onConflict: "report_id" });
    if (fbErr) throw new Error(`feedback insert failed: ${fbErr.message}`);

    if (reopened) {
      const { error } = await writer
        .from("incidents")
        .update({ status: "open", report_count: newCount })
        .eq("id", reopened);
      if (error) throw new Error(`incident reopen failed: ${error.message}`);
    }
    if (events.length > 0) {
      const { error } = await writer.from("history_events").insert(
        events.map((h) => ({
          id: h.id,
          venue_id: h.venueId,
          incident_id: h.incidentId,
          event_type: h.eventType,
          description: h.description,
          created_at: h.createdAt,
        })),
      );
      if (error) throw new Error(`history insert failed: ${error.message}`);
    }
    persisted = "supabase";
  }

  if (persisted === "demo") {
    overlay.feedback.set(reportId, feedback);
    if (reopened && incident) {
      overlay.incidents.set(reopened, { ...incident, status: "open", reportCount: newCount! });
    }
    for (const h of events) overlay.historyEvents.set(h.id, h);
  }

  writeCache(null);
  const fresh = await getDataset();
  const freshVenue = venue ? fresh.venues.find((v) => v.id === venue.id) : undefined;
  return {
    persisted,
    verdict,
    reopenedIncidentId: reopened,
    newReportCount: newCount,
    venue: freshVenue ? buildSummary(freshVenue, fresh) : null,
  };
}

// ---------------------------------------------------------------------------
// Notifications — bell icon, unread count, mark-as-read
// ---------------------------------------------------------------------------

export async function getNotificationsFor(recipientId: string): Promise<Notification[]> {
  const data = await getDataset();
  return (data.notifications ?? [])
    .filter((n) => n.recipientId === recipientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
}

export async function markNotificationsRead(
  recipientId: string,
  ids: string[] | "all",
): Promise<number> {
  const data = await getDataset();
  const targets = (data.notifications ?? []).filter(
    (n) =>
      n.recipientId === recipientId &&
      n.readAt === null &&
      (ids === "all" || ids.includes(n.id)),
  );
  if (targets.length === 0) return 0;
  const now = new Date().toISOString();

  if (supabaseAdmin) {
    // Service-role only — the anon client cannot write (RLS, no auth session).
    const writer = supabaseAdmin;
    const query = writer
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", recipientId)
      .is("read_at", "null");
    const { error } = ids === "all" ? await query : await query.in("id", ids);
    if (error) throw new Error(`notification update failed: ${error.message}`);
  }

  // Overlay mirror — works in demo mode AND covers the live-but-no-table case.
  for (const n of targets) {
    overlay.notifications.set(n.id, { ...n, readAt: now });
  }
  writeCache(null);
  return targets.length;
}
