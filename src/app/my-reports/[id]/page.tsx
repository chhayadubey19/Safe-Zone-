"use client";

/**
 * /my-reports/[id] — post-submit confirmation.
 *
 * The final step of the AI citizen report flow: success animation, the filed
 * report receipt (with the stored AI payloads), and the venue's recalculated
 * risk profile. Reports filed in a demo overlay that has since been reset are
 * handled gracefully.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2, Camera, CheckCircle2, ChevronLeft, ClipboardCheck, Clock, Loader2,
  MapPin, Megaphone, Sparkles, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/safezone/back-button";
import { StatusBanner, TierBadge, TrustChip, PhotoThumb } from "@/components/safezone/tokens";
import { VenueTypeIcon } from "@/components/safezone/tokens";
import type { VenueSummary } from "@/lib/data";
import type { Classification, VisionItems } from "@/components/safezone/report-flow/types";

interface ReportView {
  id: string;
  venueId: string;
  venueName: string;
  ward: string;
  reporterName: string;
  inputText: string;
  photoUrl: string | null;
  aiLanguage: Classification | null;
  aiVision: { items: VisionItems } | null;
  confirmed: boolean;
  lat: number | null;
  lng: number | null;
  status: string;
  createdAt: string;
}

interface Payload {
  report: ReportView;
  venue: VenueSummary;
}

function ReceiptRow({ icon: Icon, label, children }: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-edge py-3 last:border-b-0 last:pb-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
        <div className="mt-0.5 text-sm text-ink">{children}</div>
      </div>
    </div>
  );
}

export default function MyReportPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reports/${params.id}`);
        if (!res.ok) throw new Error(String(res.status));
        const payload = (await res.json()) as Payload;
        if (!cancelled) {
          setData(payload);
          setState("ok");
        }
      } catch {
        if (!cancelled) setState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const report = data?.report;
  const vision = report?.aiVision?.items;
  const visionCounts = vision
    ? {
        fail: Object.values(vision).filter((v) => v.status === "fail").length,
        pass: Object.values(vision).filter((v) => v.status === "pass").length,
        nv: Object.values(vision).filter((v) => v.status === "not_visible").length,
      }
    : null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <BackButton fallbackHref="/my-reports" />
          <div className="min-w-0 text-base font-bold text-navy">Your report</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        {state === "loading" && (
          <div className="space-y-4">
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-navy" aria-label="Loading report" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        )}

        {state === "missing" && (
          <section className="rounded-xl border border-dashed border-trust-unverified bg-surface p-6 text-center shadow-card">
            <Megaphone className="mx-auto h-8 w-8 text-ink-muted" aria-hidden />
            <h1 className="mt-3 text-lg font-bold text-navy">This report isn&apos;t available</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              It may have been filed in an earlier demo session (demo-mode reports are kept in
              memory) or the link is incomplete. Reports filed against the live Supabase project
              stay available permanently.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/">
                <Button className="h-12 rounded-xl bg-navy font-semibold text-white hover:bg-navy-hover">
                  Back to the registry
                </Button>
              </Link>
              <Link href="/report">
                <Button variant="outline" className="h-12 rounded-xl border-edge">
                  File a new report
                </Button>
              </Link>
            </div>
          </section>
        )}

        {state === "ok" && data && report && (
          <>
            {/* Success hero — calm interface, loud confirmation */}
            <section className="sz-rise overflow-hidden rounded-xl border border-edge bg-surface shadow-card">
              <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span
                    className="sz-ring absolute inset-0 rounded-full bg-trust-verified/30"
                    aria-hidden
                  />
                  <span className="sz-check-pop flex h-16 w-16 items-center justify-center rounded-full bg-trust-verified">
                    <CheckCircle2 className="h-9 w-9 text-white" aria-hidden />
                  </span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-navy">Report filed — thank you</h1>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
                    Your report is now part of {report.venueName}&apos;s public safety record and
                    its risk score has been recalculated.
                  </p>
                </div>
                <TrustChip variant="citizen">Unverified citizen report</TrustChip>
              </div>
            </section>

            {/* Receipt */}
            <section className="rounded-xl border border-edge bg-surface shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ClipboardCheck className="h-4 w-4 text-navy" aria-hidden />
                  Report receipt
                </div>
                <span className="font-mono text-[11px] text-ink-muted">
                  {report.id.slice(0, 8)}
                </span>
              </div>
              <div className="px-4 py-2">
                <ReceiptRow icon={Building2} label="Venue">
                  <span className="font-medium">{report.venueName}</span>
                  <span className="text-ink-muted"> · {report.ward}, Bhopal</span>
                </ReceiptRow>
                {report.inputText && (
                  <ReceiptRow icon={Megaphone} label="Your description">
                    “{report.inputText}”
                  </ReceiptRow>
                )}
                {report.photoUrl && (
                  <ReceiptRow icon={Camera} label="Photo evidence">
                    {/* Rendered for both stored URLs (Supabase Storage) and
                        inline data URLs (demo mode). */}
                    <div className="w-full max-w-xs overflow-hidden rounded-xl border border-edge">
                      <PhotoThumb
                        src={report.photoUrl}
                        alt="Photo evidence you captured"
                        caption="Photo evidence"
                        className="h-40 w-full max-w-xs border-0"
                      />
                    </div>
                  </ReceiptRow>
                )}
                {report.aiLanguage && (
                  <ReceiptRow icon={Sparkles} label="AI text classification (Gemini Flash)">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-navy-soft px-2 py-0.5 text-[11px] font-medium text-navy">
                        {report.aiLanguage.issue_label}
                      </span>
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                        {report.aiLanguage.category.replaceAll("_", " ").toLowerCase()}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          report.aiLanguage.severity === "CRITICAL"
                            ? "bg-risk-urgent-soft text-risk-urgent"
                            : "bg-risk-verification-soft text-amber-800",
                        )}
                      >
                        {report.aiLanguage.severity}
                      </span>
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                        {report.aiLanguage.department} dept.
                      </span>
                    </div>
                  </ReceiptRow>
                )}
                {visionCounts && (
                  <ReceiptRow icon={Camera} label="AI photo assessment (Gemini Flash vision)">
                    <span className="text-sm text-ink">
                      {visionCounts.fail > 0 && (
                        <span className="font-semibold text-risk-urgent">
                          {visionCounts.fail} possible failure{visionCounts.fail === 1 ? "" : "s"}{" "}
                          flagged
                        </span>
                      )}
                      {visionCounts.fail === 0 && (
                        <span className="text-ink-muted">No visible failures flagged</span>
                      )}
                      <span className="text-ink-muted">
                        {" "}· {visionCounts.pass} passed · {visionCounts.nv} not in frame
                      </span>
                    </span>
                  </ReceiptRow>
                )}
                <ReceiptRow icon={Clock} label="Filed at">
                  {new Date(report.createdAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </ReceiptRow>
                <ReceiptRow icon={MapPin} label="Location">
                  {report.lat != null && report.lng != null
                    ? `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)} (auto-captured)`
                    : "Venue coordinates"}
                </ReceiptRow>
              </div>
            </section>

            {/* Live impact */}
            <section className="rounded-xl border border-edge bg-surface shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <VenueTypeIcon type={data.venue.type} className="h-4 w-4" />
                  Live impact on {report.venueName}
                </div>
                <span className="inline-flex items-center gap-1.5">
                  <TierBadge tier={data.venue.risk.tier} />
                  <span className="text-sm font-bold tabular-nums text-ink">
                    {data.venue.risk.score}
                  </span>
                </span>
              </div>
              <div className="space-y-3 p-4">
                <StatusBanner status={data.venue.status} />
                {data.venue.risk.breakdown.length > 0 && (
                  <p className="text-xs text-ink-muted">{data.venue.risk.breakdown.join(" · ")}</p>
                )}
              </div>
            </section>

            {/* What happens next */}
            <section className="rounded-xl border border-edge bg-surface shadow-card">
              <div className="border-b border-edge px-4 py-3 text-sm font-semibold text-ink">
                What happens next
              </div>
              <ol className="space-y-3 p-4 text-sm">
                <li className="flex gap-3">
                  <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
                  <span className="text-ink-muted">
                    An inspector can verify the issue on-site — a confirmed critical turns the
                    venue <span className="font-semibold text-risk-urgent">solid red</span>, while
                    your report stays honest amber until then.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
                  <span className="text-ink-muted">
                    Other citizens corroborating the same issue raise the venue&apos;s risk score
                    and the municipal department&apos;s attention.
                  </span>
                </li>
                <li className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
                  <span className="text-ink-muted">
                    Once action is taken, you&apos;ll be asked for feedback — &ldquo;fixed&rdquo;
                    or &ldquo;still exists&rdquo; — to close the loop.
                  </span>
                </li>
              </ol>
            </section>

            <div className="flex flex-wrap gap-2 pb-2">
              <Link href="/my-reports" className="flex-1 sm:flex-none">
                <Button className="h-12 w-full gap-2 rounded-xl bg-navy px-5 font-semibold text-white shadow-card hover:bg-navy-hover sm:w-auto">
                  <ChevronLeft className="h-4 w-4" aria-hidden /> Back to my reports
                </Button>
              </Link>
              <Link href="/report" className="flex-1 sm:flex-none">
                <Button variant="outline" className="h-12 w-full rounded-xl border-edge sm:w-auto">
                  <Megaphone className="h-4 w-4" aria-hidden /> File another report
                </Button>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
