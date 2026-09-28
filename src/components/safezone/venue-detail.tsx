"use client";

/**
 * Venue detail content — shared by the home sheet overlay and the
 * /venue/[id] passport page (Phase 5) so both render identically.
 */

import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle, BadgeCheck, Camera, CheckCircle2, CircleDashed, ClipboardCheck, Clock,
  Droplets, MessageSquareQuote, ShieldAlert, Users, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CATEGORY_ICONS, CertStatusChip, CertTypeChip, EventIcon, ITEM_ICONS, StatusBanner, TierBadge, TrustChip,
  VENUE_TYPE_LABELS,
} from "./tokens";
import { VenueTypeTile } from "./design";
import { certStatus } from "@/lib/certificates";
import { tr, trParams } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import type { VenueDetail } from "@/lib/data";

const relTime = (iso: string) => {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return iso.slice(0, 10);
  }
};

// ---------------------------------------------------------------------------
// Checklist row — severity × trust, resolved into one calm cell
// ---------------------------------------------------------------------------

function ChecklistRow({ row }: { row: VenueDetail["checklist"][number]["rows"][number] }) {
  const Icon = ITEM_ICONS[row.item.key] ?? CircleDashed;
  const { item, state, display } = row;

  const rowTint =
    display === "confirmed_fail"
      ? "border-l-4 border-risk-urgent bg-risk-urgent-soft/60"
      : display === "citizen_fail"
        ? "border-l-4 border-trust-citizen bg-trust-citizen-soft/70"
        : display === "not_verified"
          ? "bg-risk-insufficient-soft/40"
          : "bg-surface";

  return (
    <li
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-xl border border-edge px-3 py-2.5 shadow-card",
        rowTint,
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0",
          display === "confirmed_fail" ? "text-risk-urgent" : "text-ink-muted",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{item.label}</div>
        <div className="text-[11px] text-ink-muted">
          {item.severity === "major" ? "Major item" : "Minor item"}
          {state && ` · updated ${relTime(state.updatedAt)}`}
        </div>
      </div>

      {/* Status cell — loud, but the ladder depends on WHO said it */}
      <div className="flex shrink-0 items-center gap-1.5">
        {display === "confirmed_fail" && (
          <>
            <XCircle className="h-5 w-5 text-risk-urgent" aria-label="Confirmed fail" />
            <span className="inline-flex items-center rounded-full bg-risk-urgent px-2 py-0.5 text-[11px] font-semibold text-white">
              Confirmed fail
            </span>
          </>
        )}
        {display === "citizen_fail" && (
          <>
            {/* citizen-reported critical: amber row + RED triangle (unconfirmed) */}
            <AlertTriangle className="h-5 w-5 text-risk-urgent" aria-label="Unconfirmed citizen report" />
            <TrustChip variant="citizen" />
          </>
        )}
        {display === "verified_pass" && (
          <>
            <CheckCircle2 className="h-5 w-5 text-trust-verified" aria-label="Verified pass" />
            <TrustChip variant="verified" />
          </>
        )}
        {display === "citizen_pass" && (
          <>
            <CheckCircle2 className="h-5 w-5 text-trust-citizen" aria-label="Citizen-reported pass" />
            <TrustChip variant="citizen">Reported OK</TrustChip>
          </>
        )}
        {display === "not_verified" && <TrustChip variant="not_verified" />}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Skeleton (shared by the sheet and the /venue/[id] page)
// ---------------------------------------------------------------------------

export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading venue details">
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared body — sections 1–7 of the venue detail (risk, checklist, incidents,
// citizen reports, history, inspections). Rendered inside the home sheet and
// on the /venue/[id] passport page.
// ---------------------------------------------------------------------------

const SEVERITY_STYLES = {
  critical: "bg-risk-urgent text-white",
  minor: "bg-risk-verification-soft text-amber-800 border border-risk-verification/40",
} as const;

const INCIDENT_STATUS_STYLES: Record<string, string> = {
  open: "border-risk-urgent/40 text-risk-urgent bg-risk-urgent-soft/50",
  verified: "border-navy/30 text-navy bg-navy-soft",
  action_taken: "border-risk-verification/50 text-amber-800 bg-risk-verification-soft",
  resolved: "border-trust-verified/40 text-green-800 bg-trust-verified-soft",
};

const INCIDENT_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  verified: "Verified",
  action_taken: "Action taken",
  resolved: "Resolved",
};

export function VenueDetailBody({ detail }: { detail: VenueDetail }) {
  const { lang } = useLang();
  return (
    <>
      {/* 0 — monsoon / waterlogging banner (rule-based, ≥ 2 recent reports) */}
      {detail.monsoon && (
        <div
          role="status"
          className="sz-rise flex items-start gap-3 rounded-xl border border-risk-verification/60 bg-risk-verification-soft p-4 text-sm text-amber-900"
        >
          <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-risk-verification" aria-hidden />
          <div>
            <div className="font-semibold">{tr(lang, "monsoon_banner")}</div>
            <div className="mt-0.5 text-xs text-amber-800/80 tnums">
              {trParams(lang, "waterlogging_reports", {
                count: detail.monsoon.reportCount,
                s: detail.monsoon.reportCount === 1 ? "" : "s",
              })}{" · "}
              {trParams(lang, "last_report", { date: relTime(detail.monsoon.lastReportAt) })}
            </div>
          </div>
        </div>
      )}

      {/* 1 — loud status banner */}
      <StatusBanner status={detail.status} />

      {/* 2 — risk panel */}
      <section aria-label="Risk assessment" className="sz-rise rounded-xl border border-edge bg-surface p-4 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="tnums text-3xl font-extrabold text-navy">{detail.risk.score}</span>
              <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">risk score</span>
            </div>
            <TierBadge tier={detail.risk.tier} long className="mt-1.5" />
          </div>
          <div className="flex gap-2 text-center">
            <div className="rounded-xl bg-canvas px-3 py-2">
              <div className="tnums text-lg font-bold text-risk-urgent">{detail.openCritical}</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">critical</div>
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2">
              <div className="tnums text-lg font-bold text-risk-high">{detail.openMinor}</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-muted">minor</div>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Why this score — every point explainable
        </div>
        <ul className="mt-2 space-y-1.5">
          {detail.risk.factors.map((f) => (
            <li key={f.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-ink">{f.label}</span>
              <span className="tnums shrink-0 font-semibold text-ink-muted">
                +{Math.round(f.points)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 3 — category scores */}
      <section aria-label="Category scores" className="grid grid-cols-3 gap-3">
        {detail.checklist.map(({ category, score }) => {
          const Icon = CATEGORY_ICONS[category.icon];
          const bar =
            score >= 8 ? "bg-trust-verified" : score >= 5 ? "bg-risk-verification" : "bg-risk-urgent";
          return (
            <div key={category.key} className="sz-rise rounded-xl border border-edge bg-surface p-4 shadow-card">
              <Icon className="h-5 w-5 text-navy" aria-hidden />
              <div className="mt-2 flex items-baseline gap-1">
                <span className="tnums text-xl font-bold text-ink">{score}</span>
                <span className="text-[10px] text-ink-muted">/10</span>
              </div>
              <div className="mt-1 text-[11px] font-medium leading-tight text-ink-muted">
                {category.label}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas" role="presentation">
                <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${score * 10}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      {/* 4 — checklist */}
      <section aria-label="Safety checklist" className="space-y-4">
        {detail.checklist.map(({ category, rows }) => (
          <div key={category.key}>
            <div className="mb-2 flex items-center gap-2 px-1">
              {(() => {
                const Icon = CATEGORY_ICONS[category.icon];
                return <Icon className="h-4 w-4 text-navy" aria-hidden />;
              })()}
              <h3 className="text-sm font-semibold text-ink">{category.label}</h3>
            </div>
            <ul className="space-y-2">
              {rows.map((row) => (
                <ChecklistRow key={row.item.key} row={row} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* 5 — certificates (read-only; recorded by officers) */}
      {detail.certificates.length > 0 && (
        <section aria-label="Certificates" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-ink">{tr(lang, "certificates")}</h3>
          {detail.certificates.map((cert) => (
            <div key={cert.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <CertTypeChip certType={cert.certType} />
                <CertStatusChip status={certStatus(cert.expiryDate)} />
                {cert.expiryDate && (
                  <span className="ml-auto text-xs font-medium text-ink">
                    {trParams(lang, "cert_valid_until", { date: cert.expiryDate })}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                {cert.certNumber && <span className="tnums">#{cert.certNumber}</span>}
                {cert.authority && <span>· {cert.authority}</span>}
                <span className="inline-flex items-center gap-1 text-navy">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  {tr(lang, "officer_verified")}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 5 — incidents */}
      {detail.incidents.length > 0 && (
        <section aria-label="Incidents" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-ink">Incidents</h3>
          {detail.incidents
            .sort((a, b) => (a.severity === b.severity ? b.createdAt.localeCompare(a.createdAt) : a.severity === "critical" ? -1 : 1))
            .map((inc) => (
              <div key={inc.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                      SEVERITY_STYLES[inc.severity],
                    )}
                  >
                    {inc.severity}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      INCIDENT_STATUS_STYLES[inc.status],
                    )}
                  >
                    {INCIDENT_STATUS_LABELS[inc.status]}
                  </span>
                  <span className="ml-auto text-[11px] text-ink-muted">{relTime(inc.createdAt)}</span>
                </div>
                <div className="mt-1.5 text-sm font-medium text-ink">{inc.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  <span className="tnums">
                    {inc.reportCount} independent report{inc.reportCount === 1 ? "" : "s"}
                  </span>
                  {inc.reporterNames.length > 0 && (
                    <span className="hidden sm:inline">· {inc.reporterNames.slice(0, 3).join(", ")}</span>
                  )}
                </div>
              </div>
            ))}
        </section>
      )}

      {/* 6 — recent citizen reports */}
      {detail.reports.length > 0 && (
        <section aria-label="Citizen reports" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-ink">Citizen reports</h3>
          {detail.reports.slice(0, 6).map((r) => (
            <figure key={r.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
              <figcaption className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-ink">{r.reporterName}</span>
                <span className="text-ink-muted">· reputation {r.reporterReputation}</span>
                <span className="ml-auto text-ink-muted">{relTime(r.createdAt)}</span>
              </figcaption>
              <blockquote className="mt-2 border-l-2 border-trust-citizen/60 pl-3 text-sm text-ink">
                {r.inputText}
              </blockquote>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-muted">
                {r.photoUrl && (
                  <span className="inline-flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5 text-trust-citizen" aria-hidden /> photo attached
                  </span>
                )}
                <span className={cn("inline-flex items-center gap-1", r.confirmed ? "text-trust-verified" : "")}>
                  {r.confirmed ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> confirmed by officer</>
                  ) : (
                    <><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> unverified</>
                  )}
                </span>
              </div>
            </figure>
          ))}
        </section>
      )}

      {/* 7 — history timeline */}
      {detail.history.length > 0 && (
        <section aria-label="History" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-ink">History</h3>
          <ol className="relative space-y-3 border-l-2 border-edge pl-5">
            {detail.history.slice(0, 10).map((h) => (
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

      {detail.inspections.length > 0 && (
        <section aria-label="Inspections" className="space-y-2">
          <h3 className="px-1 text-sm font-semibold text-ink">Inspection records</h3>
          {detail.inspections.map((ins) => (
            <div key={ins.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <ClipboardCheck className="h-4 w-4 text-navy" aria-hidden />
                {ins.inspectorName} · {relTime(ins.createdAt)}
              </div>
              {ins.notice && (
                <div className="mt-2 rounded-lg border-l-4 border-risk-urgent/70 bg-risk-urgent-soft/50 px-3 py-2 text-xs text-ink">
                  <ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-risk-urgent" aria-hidden />
                  {ins.notice}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Detail sheet (the home-page overlay — behaviour unchanged)
// ---------------------------------------------------------------------------

export function VenueDetail({
  venueId,
  open,
  onClose,
  onReportHere,
  refreshKey = 0,
}: {
  venueId: string | null;
  open: boolean;
  onClose: () => void;
  onReportHere: (venueId: string) => void;
  refreshKey?: number;
}) {
  const [detail, setDetail] = useState<VenueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showSkeleton = open && !detail;

  useEffect(() => {
    if (!venueId || !open) return;
    let cancelled = false;

    // stale-while-revalidate: previous detail stays visible while fetching
    fetch(`/api/venues/${venueId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => {
        if (!cancelled) {
          setDetail(data.venue as VenueDetail);
          setError(null);
        }
      })
      .catch((err) => {
        console.error("[venue-detail]", err);
        if (!cancelled) setError("Could not load this venue. Please try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [venueId, open, refreshKey]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto border-edge bg-canvas p-0 sm:max-w-xl scrollbar-subtle"
      >
        <SheetHeader className="sticky top-0 z-10 space-y-0 border-b border-edge bg-surface/95 px-6 pb-4 pt-6 backdrop-blur">
          {detail ? (
            <>
              <div className="flex items-start gap-3">
                <VenueTypeTile type={detail.type} size="lg" />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg font-bold leading-snug text-ink">{detail.name}</SheetTitle>
                  <SheetDescription className="mt-0.5 text-xs text-ink-muted">
                    {VENUE_TYPE_LABELS[detail.type] ?? detail.type} · {detail.ward} · {detail.address}
                  </SheetDescription>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {detail.lastInspectedDays === null
                  ? "Never inspected"
                  : `Last inspected ${detail.lastInspectedDays} day${detail.lastInspectedDays === 1 ? "" : "s"} ago`}
                {detail.reportCount > 0 && (
                  <>
                    <Users className="ml-2 h-3.5 w-3.5" aria-hidden />
                    <span className="tnums">{detail.reportCount} citizen report{detail.reportCount === 1 ? "" : "s"}</span>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Title for the loading frame — Radix requires the sheet to be
                  labelled even before the venue detail arrives (a11y). */}
              <SheetTitle className="sr-only">Loading venue…</SheetTitle>
              <Skeleton className="h-12 w-full" />
            </>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-6 px-6 py-6">
          {error && (
            <div className="rounded-xl border border-risk-urgent/40 bg-risk-urgent-soft p-4 text-sm text-risk-urgent" role="alert">
              {error}
            </div>
          )}
          {showSkeleton && <DetailSkeleton />}
          {detail && <VenueDetailBody detail={detail} />}
        </div>

        {detail && (
          <div className="sticky bottom-0 border-t border-edge bg-surface/95 p-4 backdrop-blur">
            <Button
              onClick={() => onReportHere(detail.id)}
              className="h-12 w-full gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover"
            >
              <MessageSquareQuote className="h-4 w-4" aria-hidden />
              Report an issue at this venue
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
