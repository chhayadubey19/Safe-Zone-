"use client";

/**
 * /gov — the officer review queue (read-only demo view).
 *
 * Department-mapped incident queue with a department filter + chip per row;
 * each row opens the case file: responsible department, citizen reports,
 * evidence gallery (stored photo URLs), inspection records and the
 * incident's history. Writes (verify / resolve) still require Supabase auth
 * — this surface is for triage and transparency.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Building2, Camera, CheckCircle2, ClipboardCheck, CloudRain, Droplets, FileText,
  Landmark, Search, ShieldCheck, Users,
} from "lucide-react";
import { BackButton } from "@/components/safezone/back-button";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  CATEGORY_META, applicableKeys, normalizeVenueType,
} from "@/lib/checklist";
import { tr, trParams } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import {
  DepartmentChip, EventIcon, LocationUnverifiedChip, MonsoonChip, PhotoThumb, TierBadge, TrustChip,
  VENUE_TYPE_LABELS, VenueTypeIcon,
} from "@/components/safezone/tokens";
import type { IncidentCase, IncidentQueueItem, SeasonalRiskItem } from "@/lib/data";

const relTime = (iso: string) => {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return iso.slice(0, 10);
  }
};

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

const INCIDENT_STATUS_LABEL_KEYS: Record<string, "status_open" | "status_verified" | "status_action_taken" | "status_resolved"> = {
  open: "status_open",
  verified: "status_verified",
  action_taken: "status_action_taken",
  resolved: "status_resolved",
};

export default function GovQueuePage() {
  const { lang } = useLang();
  const [incidents, setIncidents] = useState<IncidentQueueItem[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalRiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<IncidentCase | null>(null);
  const [caseState, setCaseState] = useState<"idle" | "loading" | "open" | "missing">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [incidentsRes, seasonalRes] = await Promise.all([
          fetch("/api/incidents"),
          fetch("/api/seasonal-risks"),
        ]);
        const incidentsData = (await incidentsRes.json()) as { incidents: IncidentQueueItem[] };
        const seasonalData = (await seasonalRes.json()) as { venues: SeasonalRiskItem[] };
        if (!cancelled) {
          setIncidents(incidentsData.incidents ?? []);
          setSeasonal(seasonalData.venues ?? []);
        }
      } catch (err) {
        console.error("[gov] failed to load queue", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Department filter options come from the incidents' routed departments.
  const departmentOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of incidents) counts.set(i.department, (counts.get(i.department) ?? 0) + 1);
    return [
      { key: "all", label: tr(lang, "all_departments"), count: incidents.length },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, label: key, count })),
    ];
  }, [incidents, lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents
      .filter((i) => department === "all" || i.department === department)
      .filter(
        (i) =>
          q === "" ||
          i.venueName.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.venueWard.toLowerCase().includes(q),
      );
  }, [incidents, department, query]);

  const openCase = (id: string) => {
    setCaseId(id);
    setCaseData(null);
    setCaseState("loading");
    fetch(`/api/incidents/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("missing"))))
      .then((data: IncidentCase) => {
        setCaseData(data);
        setCaseState("open");
      })
      .catch(() => setCaseState("missing"));
  };

  const criticals = filtered.filter((i) => i.severity === "critical").length;
  const caseIncident = caseData?.incident;
  const caseVenueType = caseData ? normalizeVenueType(caseData.venue.type as string) : "other";
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <BackButton fallbackHref="/" />
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy shadow-card">
              <Landmark className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold leading-tight text-navy">Officer review queue</div>
              <div className="hidden truncate text-xs text-ink-muted sm:block">
                Department-routed incidents across the Bhopal registry
              </div>
            </div>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-edge bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-muted md:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-navy" aria-hidden />
            officer@demo.com
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        {/* Stats strip */}
        <section aria-label="Queue summary" className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-edge bg-surface p-4 shadow-card">
            <div className="tnums text-2xl font-extrabold text-risk-urgent">{incidents.length}</div>
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">open incidents</div>
          </div>
          <div className="rounded-xl border border-edge bg-surface p-4 shadow-card">
            <div className="tnums text-2xl font-extrabold text-navy">{criticals}</div>
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">critical in view</div>
          </div>
          <div className="rounded-xl border border-edge bg-surface p-4 shadow-card">
            <div className="tnums text-2xl font-extrabold text-ink">
              {incidents.reduce((n, i) => n + i.reportCount, 0)}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">citizen reports</div>
          </div>
        </section>

        {/* Seasonal Risks — rule-based monsoon / waterlogging indicator */}
        <section aria-label="Seasonal risks" className="rounded-xl border border-risk-verification/50 bg-risk-verification-soft/60 p-4 shadow-card">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <CloudRain className="h-4 w-4" aria-hidden />
            {tr(lang, "seasonal_risks")}
          </div>
          {loading && seasonal.length === 0 ? (
            <Skeleton className="mt-3 h-12 w-full rounded-lg" />
          ) : seasonal.length === 0 ? (
            <p className="mt-2 text-xs text-ink-muted">{tr(lang, "no_seasonal_risks")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {seasonal.map((v) => {
                return (
                  <li
                    key={v.venueId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-risk-verification/40 bg-surface px-3 py-2"
                  >
                    <VenueTypeIcon type={v.type} className="h-4 w-4 shrink-0 text-amber-700" />
                    <span className="text-sm font-medium text-ink">{v.name}</span>
                    <span className="text-[11px] text-ink-muted">{v.ward}</span>
                    <span className="tnums inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                      <Droplets className="h-3.5 w-3.5" aria-hidden />
                      {trParams(lang, "waterlogging_reports", {
                        count: v.reportCount,
                        s: v.reportCount === 1 ? "" : "s",
                      })}
                    </span>
                    <span className="ml-auto text-[11px] text-ink-muted">
                      {trParams(lang, "last_report", { date: relTime(v.lastReportAt) })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-[11px] leading-snug text-amber-800/80">
            {tr(lang, "monsoon_banner")}
          </p>
        </section>

        {/* Search + department filter */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search venue, ward or issue…"
              aria-label="Search the queue"
              className="h-12 rounded-xl border-edge bg-surface pl-10 pr-4 text-sm shadow-card"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by department">
            {departmentOptions.map((d) => {
              const active = department === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => setDepartment(d.key)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-card transition-colors",
                    active
                      ? "border-navy bg-navy text-white"
                      : "border-edge bg-surface text-ink-muted hover:border-navy/40 hover:text-navy",
                  )}
                >
                  <Landmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="max-w-56 truncate">{d.label}</span>
                  <span className={cn("tnums", active ? "text-white/70" : "text-ink-muted/70")}>
                    {d.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Queue rows */}
        <section aria-label="Incident queue" className="space-y-2 pb-8">
          {loading &&
            incidents.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}

          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-edge bg-surface p-8 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-trust-verified" aria-hidden />
              <p className="mt-3 text-sm font-semibold text-ink">
                {incidents.length === 0 ? "All clear — no open incidents" : "Nothing in this filter"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
                {incidents.length === 0
                  ? "Every reported issue across the registry has been resolved. New citizen reports will queue here for department action."
                  : "No unresolved incidents match the selected department or search."}
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-4 h-11 gap-1.5 rounded-xl border-edge"
              >
                <Link href="/">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  View the registry map
                </Link>
              </Button>
            </div>
          )}

          {filtered.map((inc) => (
            <button
              key={inc.id}
              onClick={() => openCase(inc.id)}
              className="w-full rounded-xl border border-edge bg-surface p-4 text-left shadow-card transition-all hover:border-navy/40 hover:shadow-card-hover"
            >
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
                  {tr(lang, INCIDENT_STATUS_LABEL_KEYS[inc.status] ?? "status_open")}
                </span>
                <DepartmentChip department={inc.department} />
                {inc.monsoonFlagged && <MonsoonChip />}
                <span className="ml-auto text-[11px] text-ink-muted">
                  opened {relTime(inc.createdAt)}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-ink">{inc.title}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" aria-hidden />
                  {inc.venueName} · {inc.venueWard}
                </span>
                <span className="inline-flex items-center gap-1 tnums">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {inc.reportCount} report{inc.reportCount === 1 ? "" : "s"}
                </span>
                {inc.photos > 0 && (
                  <span className="inline-flex items-center gap-1 tnums">
                    <Camera className="h-3.5 w-3.5 text-trust-citizen" aria-hidden />
                    {inc.photos} photo{inc.photos === 1 ? "" : "s"}
                  </span>
                )}
                <span className="ml-auto">
                  <TierBadge tier={inc.venueRiskTier} />
                  <span className="tnums ml-1.5 font-semibold text-ink">{inc.venueRiskScore}</span>
                </span>
              </div>
            </button>
          ))}
        </section>
      </main>

      {/* Case file */}
      <Sheet
        open={caseState === "open" || caseState === "loading" || caseState === "missing"}
        onOpenChange={(o) => !o && setCaseState("idle")}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-edge bg-canvas p-0 scrollbar-subtle sm:max-w-xl"
        >
          {caseState === "loading" && (
            <div className="space-y-4 p-6">
              {/* Title for the loading frame — Radix requires the sheet to be
                  labelled even while the case file loads (a11y). */}
              <SheetHeader className="space-y-0 p-0">
                <SheetTitle className="sr-only">Loading case file…</SheetTitle>
              </SheetHeader>
              <Skeleton className="h-12 w-2/3" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          )}
          {caseState === "missing" && (
            <SheetHeader className="px-6 pt-6">
              <SheetTitle>Case not found</SheetTitle>
              <SheetDescription>
                This incident may have been resolved or the link is incomplete.
              </SheetDescription>
            </SheetHeader>
          )}
          {caseState === "open" && caseData && caseIncident && (
            <>
              <SheetHeader className="sticky top-0 z-10 space-y-0 border-b border-edge bg-surface/95 px-6 pb-4 pt-6 backdrop-blur">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-soft">
                    {caseData && <VenueTypeIcon type={caseData.venue.type} className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg font-bold leading-snug text-ink">
                      {caseData.venue.name}
                    </SheetTitle>
                    <SheetDescription className="mt-0.5 text-xs text-ink-muted">
                      {VENUE_TYPE_LABELS[caseData.venue.type as string] ?? caseData.venue.type} ·{" "}
                      {caseData.venue.ward} · case file
                    </SheetDescription>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase",
                      SEVERITY_STYLES[caseIncident.severity],
                    )}
                  >
                    {caseIncident.severity}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      INCIDENT_STATUS_STYLES[caseIncident.status],
                    )}
                  >
                    {tr(lang, INCIDENT_STATUS_LABEL_KEYS[caseIncident.status] ?? "status_open")}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5">
                    <TierBadge tier={caseData.venue.risk.tier} />
                    <span className="tnums text-sm font-bold text-ink">{caseData.venue.risk.score}</span>
                  </span>
                </div>
              </SheetHeader>

              <div className="space-y-5 px-6 py-6">
                {/* Responsible department */}
                <section
                  aria-label="Responsible department"
                  className="flex items-start gap-3 rounded-xl border border-navy/25 bg-navy-soft p-4"
                >
                  <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden />
                  <div>
                    <div className="text-sm font-semibold text-navy">
                      Responsible department: {caseIncident.department}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      Routed by category —{" "}
                      {CATEGORY_META[caseIncident.category as keyof typeof CATEGORY_META]?.label ?? caseIncident.category}
                      {caseIncident.issueKey !== "other" && ` · ${caseIncident.issueKey.replaceAll("_", " ")}`}
                    </div>
                  </div>
                </section>

                {/* Evidence gallery */}
                {caseData.evidence.length > 0 && (
                  <section aria-label="Evidence gallery" className="space-y-2">
                    <h3 className="px-1 text-sm font-semibold text-ink">Evidence gallery</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {caseData.evidence.map((ev, i) => (
                        <figure key={`${ev.url}-${i}`} className="space-y-1">
                          <PhotoThumb
                            src={ev.url}
                            alt={ev.caption}
                            caption={ev.caption}
                            className="h-24 w-full"
                          />
                          <figcaption className="truncate text-[10px] text-ink-muted">{ev.caption}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </section>
                )}

                {/* Citizen reports */}
                {caseData.reports.length > 0 && (
                  <section aria-label="Citizen reports" className="space-y-2">
                    <h3 className="px-1 text-sm font-semibold text-ink">Citizen reports</h3>
                    {caseData.reports.map((r) => (
                      <figure key={r.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
                        <figcaption className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-ink">{r.reporterName}</span>
                          <span className="text-ink-muted">· reputation {r.reporterReputation}</span>
                          {r.locationUnverified && <LocationUnverifiedChip />}
                          <span className="ml-auto text-ink-muted">{relTime(r.createdAt)}</span>
                        </figcaption>
                        <blockquote className="mt-2 border-l-2 border-trust-citizen/60 pl-3 text-sm text-ink">
                          {r.inputText}
                        </blockquote>
                        {r.photoUrl && (
                          <div className="mt-2">
                            <PhotoThumb src={r.photoUrl} alt={`Evidence from ${r.reporterName}`} caption="Photo evidence" />
                          </div>
                        )}
                        <div className="mt-2">
                          <TrustChip variant={r.confirmed ? "verified" : "citizen"}>
                            {r.confirmed ? "Confirmed" : "Unverified"}
                          </TrustChip>
                        </div>
                      </figure>
                    ))}
                  </section>
                )}

                {/* Inspection records */}
                {caseData.inspections.length > 0 && (
                  <section aria-label="Inspections" className="space-y-2">
                    <h3 className="px-1 text-sm font-semibold text-ink">Inspection records</h3>
                    {caseData.inspections.slice(0, 3).map((ins) => (
                      <div key={ins.id} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
                        <div className="flex items-center gap-2 text-sm font-medium text-ink">
                          <ClipboardCheck className="h-4 w-4 text-navy" aria-hidden />
                          {ins.inspectorName} · {relTime(ins.createdAt)}
                        </div>
                        <div className="tnums mt-1 text-[11px] text-ink-muted">
                          {Object.keys((ins.results ?? {}) as Record<string, unknown>).filter((k) => k !== "_photos").length} of{" "}
                          {applicableKeys(caseVenueType).length} applicable items assessed
                        </div>
                        {ins.notice && (
                          <div className="mt-2 rounded-lg border-l-4 border-risk-urgent/70 bg-risk-urgent-soft/50 px-3 py-2 text-xs text-ink">
                            {ins.notice}
                          </div>
                        )}
                        {ins.afterActionPhotoUrl && (
                          <div className="mt-2">
                            <PhotoThumb
                              src={ins.afterActionPhotoUrl}
                              alt="After-action photo"
                              caption="After-action photo"
                              className="h-20 w-28"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </section>
                )}

                {/* Incident history */}
                {caseData.history.length > 0 && (
                  <section aria-label="Case history" className="space-y-2">
                    <h3 className="px-1 text-sm font-semibold text-ink">Case history</h3>
                    <ol className="relative space-y-3 border-l-2 border-edge pl-5">
                      {caseData.history.map((h) => (
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

                <p className="rounded-xl border border-edge bg-surface p-4 text-xs text-ink-muted">
                  <FileText className="mr-1 inline h-3.5 w-3.5 text-navy" aria-hidden />
                  Phase 3: conduct the inspection from the venue case file — the audit form records
                  verified checklist state, moves incidents through the lifecycle and notifies reporters.
                </p>
              </div>

              <div className="sticky bottom-0 border-t border-edge bg-surface/95 p-4 backdrop-blur">
                <div className="flex flex-col gap-2">
                  <Button
                    asChild
                    className="h-12 w-full gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover"
                  >
                    <Link href={`/gov/venue/${caseData.venue.id}`}>
                      <ClipboardCheck className="h-4 w-4" aria-hidden />
                      Open venue case file — conduct inspection
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 w-full gap-2 rounded-xl border-edge"
                  >
                    <Link href={`/?v=${encodeURIComponent(caseData.venue.id)}`}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      Open venue passport
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
