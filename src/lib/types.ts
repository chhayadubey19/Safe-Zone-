/**
 * SafeZone — shared domain types.
 *
 * These types mirror the Supabase schema in `supabase/migration.sql` and are
 * consumed by the pure scoring/risk libraries, the seed script and the UI.
 */

export type Role = "citizen" | "inspector" | "officer";

/**
 * Venue types. "other" is the catch-all for venues outside the modelled set —
 * AI classification and the officer queue fall back to it rather than crash on
 * free-text types (e.g. values from an un-migrated live database).
 */
export type VenueType = "cafe" | "coaching" | "school" | "mall" | "gym" | "hall" | "other";

export type ItemStatus = "pass" | "fail" | "not_verified";

/** Trust ladder — WHO recorded the state. Never mix with severity. */
export type ItemSource = "inspection" | "citizen";

export type Severity = "critical" | "minor";

export type IncidentStatus = "open" | "verified" | "action_taken" | "resolved";

export type ReportStatus = "pending" | "confirmed" | "resolved" | "rejected";

/** Risk tiers (RISK ladder) — priority of attention, not trust. */
export type RiskTier = "URGENT" | "HIGH" | "NEEDS_VERIFICATION" | "INSUFFICIENT_DATA";

export interface Profile {
  id: string;
  email?: string;
  role: Role;
  reputation: number;
  name: string;
}

export interface Venue {
  id: string;
  name: string;
  type: VenueType;
  address: string;
  ward: string;
  lat: number;
  lng: number;
}

export interface ItemState {
  venueId: string;
  itemKey: string;
  status: ItemStatus;
  source: ItemSource | null;
  updatedAt: string;
}

export interface Incident {
  id: string;
  venueId: string;
  category: string;
  issueKey: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  reportCount: number;
  createdAt: string;
}

export interface Report {
  id: string;
  incidentId: string | null;
  venueId: string;
  reporterId: string;
  inputText: string;
  photoUrl: string | null;
  aiLanguage: unknown;
  aiVision: unknown;
  confirmed: boolean;
  lat: number | null;
  lng: number | null;
  status: ReportStatus;
  createdAt: string;
  /** Phase 4 — soft location-honesty flag (>200 m from the venue). */
  locationUnverified?: boolean | null;
  /**
   * Phase 5 — in-memory only (never persisted): which checklist items this
   * report marked as citizen-fails, so demo-mode deletion can revert the
   * overlay item states the report wrote. Live rows leave it undefined.
   */
  failedItemKeys?: string[];
}

export interface Inspection {
  id: string;
  venueId: string;
  inspectorId: string;
  results: unknown;
  afterActionPhotoUrl: string | null;
  notice: string | null;
  createdAt: string;
}

export interface HistoryEvent {
  id: string;
  venueId: string;
  incidentId: string | null;
  eventType: string;
  description: string;
  createdAt: string;
}

export interface ReporterFeedback {
  reportId: string;
  verdict: "fixed" | "still_exists";
  createdAt: string;
}

/**
 * Citizen notification — inspector/resolution updates about the venues a
 * citizen reported on. Phase 3 loop: inspection → action → resolution →
 * "You helped fix this".
 */
export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  body: string | null;
  reportId: string | null;
  incidentId: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Compliance certificate / NOC on a venue — Phase 5 spec completion.
 * Status is DERIVED from expiry_date (never stored): 🟢 Valid ·
 * 🟡 Expiring soon (< 60 days) · 🔴 Expired. Display-only: never enters
 * the risk formula.
 */
export interface Certificate {
  id: string;
  venueId: string;
  certType: "fire_noc" | "health_license" | "trade_license";
  certNumber: string | null;
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  issueDate: string | null;
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  expiryDate: string | null;
  authority: string | null;
  /** report-photos bucket URL ({venueId}/cert-{ts}.jpg) or an inline data URL in demo mode. */
  photoUrl: string | null;
  createdAt: string;
}

/**
 * Monsoon / waterlogging risk signal — rule-based (Phase 5 spec completion):
 * a venue is flagged when ≥ 2 of its reports in the last 12 months match the
 * waterlogging keyword list. Derived on read; never stored, never scored.
 */
export interface MonsoonFlag {
  venueId: string;
  /** Matching reports in the 12-month window (≥ 2 when flagged). */
  reportCount: number;
  /** ISO timestamp of the most recent matching report. */
  lastReportAt: string;
}

/** Full snapshot of the registry — the shape persisted by scripts/seed.ts. */
export interface Dataset {
  seededAt: string;
  profiles: Profile[];
  venues: Venue[];
  itemStates: ItemState[];
  incidents: Incident[];
  reports: Report[];
  inspections: Inspection[];
  historyEvents: HistoryEvent[];
  reporterFeedback: ReporterFeedback[];
  /** Phase 3 — may be absent in older snapshots; fetchers default to []. */
  notifications?: Notification[];
  /** Phase 5 spec completion — may be absent in older snapshots; fetchers default to []. */
  certificates?: Certificate[];
}
