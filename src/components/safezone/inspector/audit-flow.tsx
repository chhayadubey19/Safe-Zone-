"use client";

/**
 * Inspector audit + resolution flow — /gov/inspect/[id].
 *
 *   Stage 1  AUDIT — the venue's applicable checklist grouped by category with
 *           department labels; each item pass / fail / not-visible + optional
 *           camera photo (reuse of the fixed CameraCaptureCard, file fallback
 *           included). Submit → POST /api/inspect.
 *   Stage 2  RESOLUTION — corrective action: after-action photo → the
 *           report-photos bucket ({venueId}/after-{ts}.jpg) + notice; quick
 *           re-verify of the items that failed. Submit → POST /api/resolve.
 *   Stage 3  DONE — outcome summary (risk before → after, incidents resolved).
 *
 * The inspector persona is the server-side demo choice (inspector@demo.com),
 * same pattern as the citizen persona in the report flow.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2, CalendarClock, Camera, CheckCircle2, ChevronDown, ClipboardCheck,
  FileText, Loader2, ShieldCheck, Users, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/safezone/back-button";
import {
  DepartmentChip, PhotoThumb, TierBadge, TrustChip, VENUE_TYPE_LABELS,
} from "@/components/safezone/tokens";
import { VenueTypeTile } from "@/components/safezone/design";
import { CameraCaptureCard, type GeoState } from "@/components/safezone/report-flow/camera-capture";
import type { InspectorContext, InspectionOutcome, ResolutionOutcome } from "@/lib/data";
import type { ItemKey } from "@/lib/checklist";

type AuditStatus = "pass" | "fail" | "not_verified";

const STATUS_BUTTON: Record<AuditStatus, { label: string; active: string; icon: typeof CheckCircle2 }> = {
  pass: { label: "Pass", active: "bg-trust-verified text-white border-trust-verified", icon: CheckCircle2 },
  fail: { label: "Fail", active: "bg-risk-urgent text-white border-risk-urgent", icon: Wrench },
  not_verified: { label: "Not visible", active: "bg-slate-500 text-white border-slate-500", icon: ChevronDown },
};

const NO_GEO: GeoState = { status: "unsupported", lat: null, lng: null };

export function AuditFlow({ context }: { context: InspectorContext }) {
  const { toast } = useToast();
  const [inspectorId, setInspectorId] = useState<string | null>(null);

  const [stage, setStage] = useState<"audit" | "resolving" | "done">("audit");
  const [statuses, setStatuses] = useState<Partial<Record<ItemKey, AuditStatus>>>({});
  const [photos, setPhotos] = useState<Partial<Record<ItemKey, string>>>({});
  const [photoItemKey, setPhotoItemKey] = useState<ItemKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inspectionOutcome, setInspectionOutcome] = useState<InspectionOutcome | null>(null);

  // Resolution stage
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
  const [afterCapturedAt, setAfterCapturedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [reverify, setReverify] = useState<Partial<Record<ItemKey, boolean>>>({});
  const [resolutionOutcome, setResolutionOutcome] = useState<ResolutionOutcome | null>(null);

  // Resolve the demo inspector persona once (server-side choice, like /report).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/personas");
        const data = (await res.json()) as { personas: { id: string; role: string }[] };
        const inspector = data.personas?.find((p) => p.role === "inspector");
        if (!cancelled) setInspectorId(inspector?.id ?? null);
      } catch {
        if (!cancelled) setInspectorId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allItems = useMemo(
    () => context.checklist.flatMap((c) => c.rows.map((r) => r.item)),
    [context.checklist],
  );
  const assessedCount = Object.keys(statuses).length;
  const failedKeys = (Object.entries(statuses) as [ItemKey, AuditStatus][])
    .filter(([, s]) => s === "fail")
    .map(([k]) => k);

  const submitAudit = async () => {
    if (!inspectorId) {
      toast({ title: "Inspector identity unavailable", description: "Could not resolve the demo inspector persona." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: context.venue.id,
          inspectorId,
          items: allItems
            .filter((i) => statuses[i.key])
            .map((i) => ({
              itemKey: i.key,
              status: statuses[i.key],
              photoDataUrl: photos[i.key] ?? null,
            })),
        }),
      });
      const body = (await res.json()) as InspectionOutcome & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to submit inspection");
      setInspectionOutcome(body);
      // Default re-verify: everything the audit failed is now fixed.
      setReverify(Object.fromEntries(failedKeys.map((k) => [k, true])));
      setStage("resolving");
      toast({
        title: "Audit submitted",
        description: `Risk ${body.riskBefore} → ${body.riskAfter} · ${body.verifiedIncidents.length} incident(s) verified · ${body.notifiedReporters.length} reporter(s) notified.`,
      });
    } catch (err) {
      toast({
        title: "Could not submit the audit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const submitResolution = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: context.venue.id,
          inspectorId: inspectorId ?? undefined,
          afterActionPhotoDataUrl: afterPhoto,
          notice: notice.trim() || null,
          reverify: failedKeys.map((k) => ({ itemKey: k, fixed: reverify[k] !== false })),
        }),
      });
      const body = (await res.json()) as ResolutionOutcome & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to record resolution");
      setResolutionOutcome(body);
      setStage("done");
      toast({
        title: "Resolution recorded",
        description: `${body.resolvedIncidents.length} incident(s) resolved · risk ${body.riskBefore} → ${body.riskAfter}.`,
      });
    } catch (err) {
      toast({
        title: "Could not record the resolution",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const venueId = context.venue.id;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <BackButton fallbackHref={`/gov/venue/${venueId}`} />
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy shadow-card">
              <ClipboardCheck className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold leading-tight text-navy">Safety inspection</div>
              <div className="hidden truncate text-xs text-ink-muted sm:block">
                inspector@demo.com ·{" "}
                {stage === "audit" ? "audit form" : stage === "resolving" ? "corrective action" : "complete"}
              </div>
            </div>
          </div>
          <span className="ml-auto">
            <TierBadge tier={context.venue.risk.tier} />
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        {/* Case header */}
        <section aria-label="Case header" className="rounded-xl border border-edge bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <VenueTypeTile type={context.venueType} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold leading-snug text-ink">{context.venue.name}</h1>
              <div className="mt-0.5 text-xs text-ink-muted">
                {VENUE_TYPE_LABELS[context.venueType as string] ?? context.venueType} · {context.venue.ward} ·{" "}
                {context.venue.address}
              </div>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-edge bg-canvas p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Open incidents</dt>
              <dd className="tnums mt-1 text-lg font-bold text-ink">
                {context.openCritical + context.openMinor}
                <span className="ml-1 text-[10px] font-medium text-ink-muted">
                  ({context.openCritical}C / {context.openMinor}m)
                </span>
              </dd>
            </div>
            <div className="rounded-lg border border-edge bg-canvas p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Citizen reports</dt>
              <dd className="tnums mt-1 flex items-center gap-1 text-lg font-bold text-ink">
                <Users className="h-4 w-4 text-trust-citizen" aria-hidden />
                {context.totalReports}
              </dd>
            </div>
            <div className="rounded-lg border border-edge bg-canvas p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Last inspection</dt>
              <dd className="mt-1 flex items-center gap-1 text-sm font-bold text-ink">
                <CalendarClock className="h-4 w-4 text-navy" aria-hidden />
                {context.lastInspectedDays === null ? "Never" : `${context.lastInspectedDays}d ago`}
              </dd>
            </div>
            <div className="rounded-lg border border-edge bg-canvas p-3">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Risk score</dt>
              <dd className="tnums mt-1 text-lg font-bold text-navy">{context.venue.risk.score}</dd>
            </div>
          </dl>
          {context.openIncidents.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {context.openIncidents.map((inc) => (
                <li
                  key={inc.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-canvas px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-ink">{inc.title}</span>
                  <span className="text-ink-muted">
                    · {inc.reportCount} report{inc.reportCount === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <DepartmentChip department={inc.department} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------------- Stage 1: the audit form ---------------- */}
        {stage === "audit" && (
          <>
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold text-ink">Audit form — applicable checklist</h2>
              <span className="tnums text-xs text-ink-muted">
                {assessedCount}/{allItems.length} assessed
              </span>
            </div>

            {context.checklist.map(({ category, department, rows }) => (
              <section
                key={category.key}
                aria-label={category.label}
                className="overflow-hidden rounded-xl border border-edge bg-surface shadow-card"
              >
                <header className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
                  <h3 className="text-sm font-semibold text-ink">{category.label}</h3>
                  <DepartmentChip department={department} />
                  <span className="ml-auto text-[11px] text-ink-muted">
                    {rows.filter((r) => statuses[r.item.key]).length}/{rows.length}
                  </span>
                </header>
                <ul className="divide-y divide-edge">
                  {rows.map(({ item, state }) => {
                    const current = statuses[item.key];
                    const photo = photos[item.key];
                    return (
                      <li key={item.key} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-ink">{item.label}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {item.severity === "major" && (
                                <span className="rounded bg-navy-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-navy">
                                  major
                                </span>
                              )}
                              {state?.source && (
                                <TrustChip variant={state.source === "inspection" ? "verified" : "citizen"}>
                                  {state.source === "inspection"
                                    ? `Verified: ${state.status}`
                                    : `Citizen: ${state.status}`}
                                </TrustChip>
                              )}
                              {!state && <span className="text-[11px] text-ink-muted">no prior signal</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(Object.keys(STATUS_BUTTON) as AuditStatus[]).map((s) => {
                              const meta = STATUS_BUTTON[s];
                              const Icon = meta.icon;
                              const active = current === s;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  aria-pressed={active}
                                  aria-label={`${item.label}: ${meta.label}`}
                                  onClick={() => setStatuses((prev) => ({ ...prev, [item.key]: s }))}
                                  className={cn(
                                    "flex h-10 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                                    active
                                      ? meta.active
                                      : "border-edge bg-canvas text-ink-muted hover:border-navy/40 hover:text-navy",
                                  )}
                                >
                                  <Icon className="h-3.5 w-3.5" aria-hidden />
                                  <span className="hidden sm:inline">{meta.label}</span>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              aria-label={`${photo ? "Replace" : "Add"} photo for ${item.label}`}
                              onClick={() => setPhotoItemKey(item.key)}
                              className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                                photo
                                  ? "border-navy bg-navy-soft text-navy"
                                  : "border-edge bg-canvas text-ink-muted hover:border-navy/40 hover:text-navy",
                              )}
                            >
                              <Camera className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                        {photo && (
                          <div className="mt-2">
                            <PhotoThumb
                              src={photo}
                              alt={`Audit photo — ${item.label}`}
                              caption="Audit photo"
                              className="h-20 w-28"
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            <div className="sticky bottom-4 rounded-xl border border-edge bg-surface/95 p-3 shadow-card-hover backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={assessedCount >= allItems.length || submitting}
                  onClick={() =>
                    setStatuses((prev) => {
                      const next = { ...prev };
                      for (const item of allItems) if (!next[item.key]) next[item.key] = "not_verified";
                      return next;
                    })
                  }
                  className="h-12 rounded-xl border-edge"
                >
                  Mark remaining not visible
                </Button>
                <Button
                  onClick={() => void submitAudit()}
                  disabled={assessedCount === 0 || submitting}
                  className="h-12 flex-1 gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ClipboardCheck className="h-4 w-4" aria-hidden />
                  )}
                  {submitting
                    ? "Submitting…"
                    : assessedCount < allItems.length
                      ? `Submit partial audit (${assessedCount})`
                      : "Submit inspection"}
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                Submitting records the inspection (source=&quot;inspection&quot; — the verified trust tier), marks the
                venue&apos;s open incidents verified, notifies every reporter, and recomputes risk.
              </p>
            </div>
          </>
        )}

        {/* ---------------- Stage 2: resolution ---------------- */}
        {stage === "resolving" && (
          <>
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold text-ink">Corrective action — resolution step</h2>
              {inspectionOutcome && (
                <span className="tnums rounded-full bg-navy-soft px-2.5 py-1 text-[11px] font-semibold text-navy">
                  audit risk {inspectionOutcome.riskBefore} → {inspectionOutcome.riskAfter}
                </span>
              )}
            </div>

            {failedKeys.length === 0 ? (
              <div className="rounded-xl border border-trust-verified/40 bg-trust-verified-soft p-4 text-sm text-green-900">
                <span className="font-semibold">No failures recorded in this audit.</span>{" "}
                Record the corrective action below to close the loop (notice + after-action photo).
              </div>
            ) : (
              <section
                aria-label="Re-verify failed items"
                className="rounded-xl border border-edge bg-surface p-4 shadow-card"
              >
                <h3 className="text-sm font-semibold text-ink">Quick re-verify of failed items</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Confirm what has been fixed since the audit. Fixed items flip the checklist to a verified pass
                  and resolve their incidents.
                </p>
                <ul className="mt-3 space-y-2">
                  {failedKeys.map((key) => {
                    const item = allItems.find((i) => i.key === key);
                    if (!item) return null;
                    const fixed = reverify[key] !== false;
                    return (
                      <li
                        key={key}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-canvas px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 text-sm font-medium text-ink">{item.label}</span>
                        <div className="flex overflow-hidden rounded-lg border border-edge">
                          <button
                            type="button"
                            aria-pressed={fixed}
                            onClick={() => setReverify((p) => ({ ...p, [key]: true }))}
                            className={cn(
                              "h-10 px-3 text-xs font-semibold transition-colors",
                              fixed ? "bg-trust-verified text-white" : "bg-canvas text-ink-muted hover:text-navy",
                            )}
                          >
                            Fixed
                          </button>
                          <button
                            type="button"
                            aria-pressed={!fixed}
                            onClick={() => setReverify((p) => ({ ...p, [key]: false }))}
                            className={cn(
                              "h-10 px-3 text-xs font-semibold transition-colors",
                              !fixed ? "bg-risk-urgent text-white" : "bg-canvas text-ink-muted hover:text-navy",
                            )}
                          >
                            Still failing
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section
              aria-label="Corrective action record"
              className="space-y-4 rounded-xl border border-edge bg-surface p-4 shadow-card"
            >
              <div className="space-y-2">
                <Label className="text-sm font-medium text-ink">Notice to citizens</Label>
                <Textarea
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                  placeholder="e.g. Notice issued — exit cleared and extinguisher serviced within 48 hours."
                  className="min-h-20 rounded-xl border-edge bg-canvas text-sm"
                />
              </div>
              <CameraCaptureCard
                photo={afterPhoto}
                onPhotoChange={setAfterPhoto}
                geo={NO_GEO}
                capturedAt={afterCapturedAt}
                onCapturedAtChange={setAfterCapturedAt}
              />
              <p className="text-[11px] leading-relaxed text-ink-muted">
                The after-action photo uploads to the existing report-photos bucket at{" "}
                <code className="rounded bg-canvas px-1 py-0.5">{venueId}/after-[timestamp].jpg</code> and is
                stored on the inspection record.
              </p>
            </section>

            <div className="sticky bottom-4 rounded-xl border border-edge bg-surface/95 p-3 shadow-card-hover backdrop-blur">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void submitResolution()}
                  disabled={submitting}
                  className="h-12 flex-1 gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  )}
                  {submitting ? "Recording…" : "Record resolution"}
                </Button>
                <Button
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setStage("done")}
                  className="h-12 rounded-xl border-edge"
                >
                  Later
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                Incidents move verified → action_taken → resolved (all failed items fixed). Every reporter of
                this venue is notified at each transition.
              </p>
            </div>
          </>
        )}

        {/* ---------------- Stage 3: done ---------------- */}
        {stage === "done" && (
          <section aria-label="Outcome" className="space-y-4 pb-8">
            <div className="rounded-xl border border-trust-verified/40 bg-trust-verified-soft p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-trust-verified" aria-hidden />
                <div>
                  <h2 className="text-base font-bold text-green-900">Inspection complete</h2>
                  <p className="mt-0.5 text-sm text-green-900/90">
                    {inspectionOutcome
                      ? `Risk score ${inspectionOutcome.riskBefore} → ${inspectionOutcome.riskAfter}. ${inspectionOutcome.verifiedIncidents.length} incident(s) verified, ${inspectionOutcome.notifiedReporters.length} reporter(s) notified.`
                      : "Audit recorded — the venue passport and officer queue are up to date."}
                  </p>
                </div>
              </div>
            </div>

            {resolutionOutcome && (
              <div className="rounded-xl border border-edge bg-surface p-4 shadow-card">
                <h3 className="text-sm font-semibold text-ink">Resolution summary</h3>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Action taken on</dt>
                    <dd className="tnums font-semibold text-ink">
                      {resolutionOutcome.actionTakenIncidents.length} incident(s)
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Resolved</dt>
                    <dd className="tnums font-semibold text-green-800">
                      {resolutionOutcome.resolvedIncidents.length} incident(s)
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Re-verified passing</dt>
                    <dd className="tnums font-semibold text-ink">
                      {resolutionOutcome.reverifiedPass.length} item(s)
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">After-action photo</dt>
                    <dd className="text-right font-semibold text-ink">
                      {resolutionOutcome.photoUpload === "storage"
                        ? "uploaded to report-photos"
                        : resolutionOutcome.photoUpload === "data-url"
                          ? "kept inline (demo mode)"
                          : resolutionOutcome.photoUpload === "failed"
                            ? "upload failed — see console"
                            : "not attached"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-muted">Risk after</dt>
                    <dd className="tnums font-bold text-navy">{resolutionOutcome.riskAfter}</dd>
                  </div>
                </dl>
              </div>
            )}

            {!resolutionOutcome && failedKeys.length > 0 && (
              <p className="rounded-xl border border-edge bg-surface p-4 text-xs text-ink-muted">
                The resolution step is still pending — reopen this page from the venue case file to record
                corrective action and re-verify the failed items.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                className="h-12 flex-1 gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover"
              >
                <Link href={`/gov/venue/${venueId}`}>
                  <Building2 className="h-4 w-4" aria-hidden /> Venue case file
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 gap-2 rounded-xl border-edge">
                <Link href="/gov">
                  <FileText className="h-4 w-4" aria-hidden /> Officer queue
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>

      {/* Per-item photo sheet — reuse of the fixed camera card */}
      <Sheet open={photoItemKey !== null} onOpenChange={(o) => !o && setPhotoItemKey(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[88vh] overflow-y-auto rounded-t-2xl border-edge bg-canvas p-0 scrollbar-subtle"
        >
          <SheetHeader className="px-4 pt-4 sm:px-6">
            <SheetTitle className="text-left text-base text-ink">
              {photoItemKey
                ? `Audit photo — ${allItems.find((i) => i.key === photoItemKey)?.label ?? photoItemKey}`
                : "Audit photo"}
            </SheetTitle>
            <SheetDescription className="text-left">
              Optional evidence for this checklist item — the same camera component as the citizen flow (live
              capture or camera-app fallback).
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 sm:p-6">
            {photoItemKey && (
              <>
                <CameraCaptureCard
                  photo={photos[photoItemKey] ?? null}
                  onPhotoChange={(p) =>
                    setPhotos((prev) => {
                      const next = { ...prev };
                      if (p) next[photoItemKey] = p;
                      else delete next[photoItemKey];
                      return next;
                    })
                  }
                  geo={NO_GEO}
                  capturedAt={null}
                  onCapturedAtChange={() => undefined}
                />
                <Button
                  variant="outline"
                  onClick={() => setPhotoItemKey(null)}
                  className="mt-3 h-12 w-full rounded-xl border-edge"
                >
                  Done
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
