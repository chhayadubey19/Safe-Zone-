"use client";

/**
 * /gov/venue/[id] — the officer case file for one venue: risk passport header,
 * "Conduct inspection" entry into the audit flow, the Phase 3 resolution
 * progress (evidence → inspection → after-action photo → resolved) and the
 * Phase 5 spec-completion Certificates / NOC panel.
 *
 * Client + /api/venues/[id] (same pattern as /gov, /report).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Building2, CheckCircle2, CircleHelp, ClipboardCheck, Coffee, Dumbbell,
  GraduationCap, Landmark, School, Store, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/safezone/back-button";
import { CertificatePanel } from "@/components/safezone/certificate-panel";
import {
  DepartmentChip, EventIcon, MonsoonChip, PhotoThumb, StatusBanner, TierBadge,
} from "@/components/safezone/tokens";
import { CATEGORY_META, departmentOf } from "@/lib/checklist";
import type { VenueDetail } from "@/lib/data";

const TYPE_ICONS: Record<string, typeof Coffee> = {
  cafe: Coffee,
  coaching: GraduationCap,
  school: School,
  mall: Store,
  gym: Dumbbell,
  hall: Building2,
  other: CircleHelp,
};
const TYPE_LABELS: Record<string, string> = {
  cafe: "Cafe",
  coaching: "Coaching centre",
  school: "School",
  mall: "Mall",
  gym: "Gym",
  hall: "Community hall",
  other: "Other venue",
};

const relTime = (iso: string) => {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return iso.slice(0, 10);
  }
};

const INCIDENT_STATUS_STYLES: Record<string, string> = {
  open: "border-risk-urgent/40 text-risk-urgent bg-risk-urgent-soft/50",
  verified: "border-navy/30 text-navy bg-navy-soft",
  action_taken: "border-risk-verification/50 text-amber-800 bg-risk-verification-soft",
  resolved: "border-trust-verified/40 text-green-800 bg-trust-verified-soft",
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: "Reported",
  verified: "Verified",
  action_taken: "Action taken",
  resolved: "Resolved",
};

export default function OfficerVenuePage() {
  const params = useParams<{ id: string }>();
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  const loadVenue = useCallback(async (id: string, signal?: { cancelled: boolean }) => {
    try {
      const res = await fetch(`/api/venues/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { venue: VenueDetail };
      if (!signal?.cancelled) {
        setVenue(data.venue);
        setState("ok");
      }
    } catch {
      if (!signal?.cancelled) setState("missing");
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    loadVenue(params.id, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [params.id, loadVenue]);

  if (state !== "ok" || !venue) {
    return (
      <div className="flex min-h-dvh flex-col bg-canvas">
        <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6 sm:px-6">
          {state === "missing" ? (
            <div className="rounded-xl border border-dashed border-edge bg-surface p-10 text-center">
              <p className="text-sm font-semibold text-ink">Venue not found</p>
              <p className="mt-1 text-xs text-ink-muted">
                The venue may have been removed or the link is incomplete.
              </p>
            </div>
          ) : (
            <>
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </>
          )}
        </main>
      </div>
    );
  }

  const TypeIcon = TYPE_ICONS[venue.type as string] ?? TYPE_ICONS.other;
  const latestInspection = venue.inspections[0] ?? null;
  const latestResults = (latestInspection?.results ?? {}) as Record<string, unknown>;
  const itemPhotos = ((latestResults._photos as Record<string, string> | undefined) ?? {}) as Record<string, string>;
  const assessedKeys = Object.keys(latestResults).filter((k) => k !== "_photos");
  const resolvedIncidents = venue.incidents.filter((i) => i.status === "resolved");
  const evidence = venue.reports.filter((r) => r.photoUrl);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <BackButton fallbackHref="/gov" />
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy shadow-card">
              <Landmark className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold leading-tight text-navy">Venue case file</div>
              <div className="hidden truncate text-xs text-ink-muted sm:block">
                officer@demo.com · triage, inspection and resolution
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        {/* Venue header */}
        <section aria-label="Venue header" className="rounded-xl border border-edge bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-soft">
              <TypeIcon className="h-6 w-6 text-navy" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-snug text-ink">{venue.name}</h1>
              <p className="mt-0.5 text-xs text-ink-muted">
                {TYPE_LABELS[venue.type as string] ?? venue.type} · {venue.address} · {venue.ward}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TierBadge tier={venue.risk.tier} />
                <span className="tnums text-sm font-bold text-ink">{venue.risk.score}</span>
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">risk</span>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {venue.reportCount} report{venue.reportCount === 1 ? "" : "s"} ·{" "}
                  {venue.openCritical}C / {venue.openMinor}m open
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <StatusBanner status={venue.status} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              className="h-12 flex-1 gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover sm:flex-none sm:px-6"
            >
              <Link href={`/gov/inspect/${venue.id}`}>
                <ClipboardCheck className="h-4 w-4" aria-hidden />
                Conduct inspection
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 gap-2 rounded-xl border-edge">
              <Link href={`/?v=${encodeURIComponent(venue.id)}`}>
                <Building2 className="h-4 w-4" aria-hidden /> Venue passport
              </Link>
            </Button>
          </div>
        </section>

        {/* Certificates / NOC — officer upload (OCR → review → confirm) */}
        <CertificatePanel
          venueId={venue.id}
          certificates={venue.certificates}
          onSaved={() => loadVenue(venue.id)}
        />

        {/* Incidents */}
        <section aria-label="Incidents" className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-ink">Incidents</h2>
          {venue.monsoon && (
            <div className="rounded-xl border border-risk-verification/50 bg-risk-verification-soft p-3">
              <MonsoonChip />
              <p className="mt-1 text-xs text-amber-900">
                {venue.monsoon.reportCount} waterlogging report
                {venue.monsoon.reportCount === 1 ? "" : "s"} in the last 12 months — last{" "}
                {relTime(venue.monsoon.lastReportAt)}.
              </p>
            </div>
          )}
          {venue.incidents.length === 0 && (
            <p className="rounded-xl border border-dashed border-edge bg-surface p-6 text-center text-sm text-ink-muted">
              No incidents on record for this venue.
            </p>
          )}
          {venue.incidents.map((inc) => (
            <div key={inc.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    INCIDENT_STATUS_STYLES[inc.status] ?? INCIDENT_STATUS_STYLES.open,
                  )}
                >
                  {INCIDENT_STATUS_LABELS[inc.status] ?? inc.status}
                </span>
                <DepartmentChip department={departmentOf(inc.category)} />
                <span className="text-[11px] text-ink-muted">
                  {CATEGORY_META[inc.category as keyof typeof CATEGORY_META]?.label ?? inc.category} ·{" "}
                  {inc.reportCount} report{inc.reportCount === 1 ? "" : "s"}
                </span>
                <span className="ml-auto text-[11px] text-ink-muted">opened {relTime(inc.createdAt)}</span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-ink">{inc.title}</div>
            </div>
          ))}
        </section>

        {/* Resolution progress — evidence → inspection → after-action → resolved */}
        <section aria-label="Resolution progress" className="space-y-3">
          <h2 className="px-1 text-sm font-semibold text-ink">Resolution progress</h2>

          {/* Step 1 — citizen evidence */}
          <div className="rounded-xl border border-edge bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-soft text-xs font-bold text-navy">
                1
              </span>
              Citizen evidence
            </div>
            {evidence.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">No photo evidence filed by citizens yet.</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {evidence.slice(0, 8).map((r) => (
                  <figure key={r.id} className="space-y-1">
                    <PhotoThumb
                      src={r.photoUrl!}
                      alt={`Evidence from ${r.reporterName}`}
                      caption={`Evidence — ${r.reporterName}`}
                      className="h-24 w-full"
                    />
                    <figcaption className="truncate text-[10px] text-ink-muted">{r.reporterName}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>

          {/* Step 2 — inspection */}
          <div className="rounded-xl border border-edge bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-soft text-xs font-bold text-navy">
                2
              </span>
              Inspection results
            </div>
            {!latestInspection ? (
              <p className="mt-2 text-xs text-ink-muted">
                No inspection recorded yet — conduct one to verify the citizen reports.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-ink-muted">
                  {latestInspection.inspectorName} · {relTime(latestInspection.createdAt)} ·{" "}
                  {assessedKeys.length} item{assessedKeys.length === 1 ? "" : "s"} assessed
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {assessedKeys.map((key) => {
                    const status = String(latestResults[key] ?? "");
                    return (
                      <span
                        key={key}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          status === "pass" && "border-trust-verified/40 bg-trust-verified-soft text-green-800",
                          status === "fail" && "border-risk-urgent/40 bg-risk-urgent-soft text-risk-urgent",
                          status === "not_verified" &&
                            "border-dashed border-trust-unverified bg-canvas text-slate-500",
                        )}
                      >
                        {key.replaceAll("_", " ")}: {status === "not_verified" ? "not visible" : status}
                      </span>
                    );
                  })}
                </div>
                {(Object.keys(itemPhotos).length > 0 || latestInspection.notice) && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(itemPhotos).map(([key, url]) => (
                      <figure key={key} className="flex items-center gap-2">
                        <PhotoThumb
                          src={url}
                          alt={`Audit photo — ${key}`}
                          caption="Audit photo"
                          className="h-16 w-24"
                        />
                        <figcaption className="text-[10px] uppercase tracking-wide text-ink-muted">
                          {key.replaceAll("_", " ")}
                        </figcaption>
                      </figure>
                    ))}
                    {latestInspection.notice && (
                      <div className="rounded-lg border-l-4 border-risk-urgent/70 bg-risk-urgent-soft/50 px-3 py-2 text-xs text-ink">
                        {latestInspection.notice}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Step 3 — after-action photo */}
          <div className="rounded-xl border border-edge bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-soft text-xs font-bold text-navy">
                3
              </span>
              After-action photo
            </div>
            {!latestInspection?.afterActionPhotoUrl ? (
              <p className="mt-2 text-xs text-ink-muted">
                Recorded in the resolution step of the inspection flow (report-photos bucket,{" "}
                <code className="rounded bg-canvas px-1">{venue.id.slice(-6)}…/after-[timestamp].jpg</code>).
              </p>
            ) : (
              <div className="mt-3">
                <PhotoThumb
                  src={latestInspection.afterActionPhotoUrl}
                  alt="After-action photo"
                  caption="After-action photo"
                  className="h-40 w-full"
                />
              </div>
            )}
          </div>

          {/* Step 4 — resolved */}
          <div
            className={cn(
              "rounded-xl border p-4 shadow-card",
              resolvedIncidents.length > 0
                ? "border-trust-verified/40 bg-trust-verified-soft"
                : "border-edge bg-surface",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
                  resolvedIncidents.length > 0
                    ? "bg-trust-verified text-white"
                    : "bg-canvas text-ink-muted border border-dashed border-trust-unverified",
                )}
              >
                4
              </span>
              Resolved status
            </div>
            {resolvedIncidents.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">
                Pending — incidents resolve when their failed items are re-verified as fixed.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-green-900">
                {resolvedIncidents.map((inc) => (
                  <li key={inc.id} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-trust-verified" aria-hidden />
                    {inc.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Case history */}
        {venue.history.length > 0 && (
          <section aria-label="Case history" className="space-y-2 pb-8">
            <h2 className="px-1 text-sm font-semibold text-ink">Case history</h2>
            <ol className="relative space-y-3 border-l-2 border-edge pl-5">
              {venue.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[1.9rem] flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-surface shadow-card">
                    <EventIcon eventType={h.eventType} className="h-3.5 w-3.5 text-navy" />
                  </span>
                  <div className="text-sm text-ink">{h.description}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-muted">
                    {h.eventType.replace(/_/g, " ")} · {relTime(h.createdAt)}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
