"use client";

/**
 * The citizen's report cards with expandable progress timelines and the
 * closure feedback loop: resolved reports show the green "You helped fix
 * this" banner with Fixed / Still exists buttons → POST /api/feedback.
 * "Still exists" reopens the incident (server-side) — accountability for
 * unresolved claims.
 *
 * Phase 5 — delete my report: pre-inspection cards ('reported' / loose) get a
 * trash button (confirm dialog → DELETE /api/reports/[id]); inspected reports
 * (verified / action_taken / resolved) show a small "Locked after inspection"
 * note instead — the government record stays intact.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Building2, CheckCircle2, ChevronDown, Loader2, Lock, Megaphone, ShieldCheck, Trash2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { tr } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import {
  EventIcon, PhotoThumb, VENUE_TYPE_LABELS,
} from "@/components/safezone/tokens";
import { VenueTypeTile } from "@/components/safezone/design";
import type { CitizenReportCard } from "@/lib/data";

const LIFECYCLE_CHIP: Record<string, { key: "status_reported" | "status_inspected" | "status_action_taken" | "status_resolved" | "status_filed"; className: string }> = {
  reported: { key: "status_reported", className: "border-risk-verification/50 text-amber-800 bg-risk-verification-soft" },
  verified: { key: "status_inspected", className: "border-navy/30 text-navy bg-navy-soft" },
  action_taken: { key: "status_action_taken", className: "border-risk-verification/50 text-amber-800 bg-risk-verification-soft" },
  resolved: { key: "status_resolved", className: "border-trust-verified/40 text-green-800 bg-trust-verified-soft" },
};

const when = (iso: string) => {
  try {
    return format(new Date(iso), "d MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
};
const relTime = (iso: string) => {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return iso.slice(0, 10);
  }
};

interface DeleteOutcome {
  reportId: string;
  incidentDeleted: boolean;
  incidentReportCount: number | null;
  venue: { name: string; risk: { score: number } };
}

/**
 * Deletable only before inspection: the report itself is still 'pending' AND
 * the linked incident is still 'reported' (lifecycle 'reported' = 'open') or
 * the report never linked to an incident. Mirrors lib/data.ts isReportDeletable
 * (kept local so the client bundle stays lean — the API enforces it anyway).
 */
function isLocked(card: CitizenReportCard): boolean {
  if (card.report.status !== "pending") return true;
  return card.lifecycle !== null && card.lifecycle !== "reported";
}

export function MyReportsList({
  cards,
  onDeleted,
}: {
  cards: CitizenReportCard[];
  onDeleted?: (reportId: string) => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { lang } = useLang();
  const [expanded, setExpanded] = useState<string | null>(cards[0]?.report.id ?? null);
  const [sending, setSending] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, "fixed" | "still_exists">>({});

  // Phase 5 — delete-my-report state
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sendFeedback = async (reportId: string, verdict: "fixed" | "still_exists") => {
    setSending(reportId + verdict);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, verdict }),
      });
      const body = (await res.json()) as {
        error?: string;
        reopenedIncidentId: string | null;
        venue: { name: string } | null;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to record feedback");

      setFeedbackSent((prev) => ({ ...prev, [reportId]: verdict }));
      toast({
        title:
          verdict === "fixed"
            ? "Thank you for confirming"
            : "Reported — inspection re-opened",
        description:
          verdict === "fixed"
            ? `Glad ${body.venue?.name ?? "the venue"} is safe now. Your report counts towards your reputation.`
            : `${body.venue?.name ?? "The venue"}'s incident was re-opened with an extra report — the department stays accountable.`,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "Could not record your answer",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  };

  const deleteThis = async (card: CitizenReportCard) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${card.report.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporterId: card.report.reporterId }),
      });
      const body = (await res.json()) as DeleteOutcome & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not delete the report");

      setConfirmId(null);
      onDeleted?.(card.report.id);
      toast({
        title: tr(lang, "report_deleted"),
        description: body.incidentDeleted
          ? `No other reports referenced this issue — it was removed from ${body.venue?.name ?? "the venue"}. Risk score is now ${body.venue?.risk.score ?? "—"}.`
          : body.incidentReportCount != null
            ? `The issue's report count is now ${body.incidentReportCount}. Risk score at ${body.venue?.name ?? "the venue"} is now ${body.venue?.risk.score ?? "—"}.`
            : undefined,
      });
    } catch (err) {
      toast({
        title: "Could not delete this report",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const confirmCard = cards.find((c) => c.report.id === confirmId) ?? null;

  return (
    <ul className="space-y-3 pb-8">
      {cards.map((card) => {
        const open = expanded === card.report.id;
        const chip = card.lifecycle ? LIFECYCLE_CHIP[card.lifecycle] : null;
        const given = feedbackSent[card.report.id] ?? card.feedback?.verdict ?? null;
        const isResolved = card.lifecycle === "resolved";
        const locked = isLocked(card);

        return (
          <li
            key={card.report.id}
            className={cn(
              "overflow-hidden rounded-xl border bg-surface shadow-card transition-colors",
              open ? "border-navy/40" : "border-edge hover:border-navy/30",
            )}
          >
            {/* Card — the expand toggle + the delete control side by side
                (the trash stays OUTSIDE the toggle: no nested buttons) */}
            <div className="flex items-start">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : card.report.id)}
                className="min-w-0 flex-1 p-4 text-left"
              >
                <div className="flex items-start gap-3">
                  <VenueTypeTile type={card.venueType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{card.issueTitle}</div>
                        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted">
                          <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                          {card.venueName} · {card.ward}
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-ink-muted transition-transform",
                          open && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {chip ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            chip.className,
                          )}
                        >
                          {tr(lang, chip.key)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-dashed border-trust-unverified px-2 py-0.5 text-[11px] text-slate-500">
                          {tr(lang, "status_filed")}
                        </span>
                      )}
                      {/* Government record — deletable only before inspection */}
                      {locked && (
                        <span
                          title="Government record"
                          className="inline-flex items-center gap-1 rounded-full border border-edge bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                        >
                          <Lock className="h-3 w-3" aria-hidden />
                          <span className="hidden min-[420px]:inline">{tr(lang, "locked_after_inspection")}</span>
                        </span>
                      )}
                      <span className="text-[11px] text-ink-muted">
                        filed {relTime(card.report.createdAt)}
                      </span>
                      {card.report.photoUrl && (
                        <PhotoThumb
                          src={card.report.photoUrl}
                          alt="Your evidence photo"
                          caption="Your photo"
                          className="ml-auto h-10 w-14"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </button>

              {!locked && (
                <div className="shrink-0 py-3 pr-3">
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmId(card.report.id)}
                    disabled={deleting}
                    aria-label={tr(lang, "delete_report_title")}
                    title={tr(lang, "delete_report_title")}
                    className="h-11 w-11 rounded-xl p-0 text-ink-muted transition-colors hover:bg-risk-urgent-soft hover:text-risk-urgent"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              )}
            </div>

            {/* Timeline + closure */}
            {open && (
              <div className="space-y-4 border-t border-edge bg-canvas/60 px-4 py-4">
                {/* Vertical timeline: report + history events */}
                <ol className="relative space-y-3 border-l-2 border-edge pl-5">
                  <li className="relative">
                    <span className="absolute -left-[1.9rem] flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-surface shadow-card">
                      <Megaphone className="h-3.5 w-3.5 text-navy" aria-hidden />
                    </span>
                    <div className="text-sm text-ink">
                      You reported this issue{card.report.inputText ? ` — “${card.report.inputText.slice(0, 120)}${card.report.inputText.length > 120 ? "…" : ""}”` : ""}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-muted">
                      reported · {when(card.report.createdAt)}
                    </div>
                  </li>
                  {card.timeline.map((ev, i) => (
                    <li key={`${ev.at}-${i}`} className="relative">
                      <span className="absolute -left-[1.9rem] flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-surface shadow-card">
                        <EventIcon eventType={ev.eventType} className="h-3.5 w-3.5 text-navy" />
                      </span>
                      <div className="text-sm text-ink">{ev.description}</div>
                      <div className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-muted">
                        {ev.eventType.replace(/_/g, " ")} · {when(ev.at)}
                      </div>
                    </li>
                  ))}
                </ol>

                {card.report.photoUrl && (
                  <PhotoThumb
                    src={card.report.photoUrl}
                    alt="Your evidence photo"
                    caption="Your evidence photo"
                    className="h-44 w-full"
                  />
                )}

                {/* RESOLVED — the closure loop */}
                {isResolved && (
                  <div className="rounded-xl border border-trust-verified/40 bg-trust-verified-soft p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-trust-verified" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-green-900">{tr(lang, "helped_fix")}</div>
                        <p className="mt-0.5 text-xs text-green-900/85">
                          The {VENUE_TYPE_LABELS[card.venueType as string] ?? "venue"} you reported was
                          inspected, corrected and resolved. Is it really fixed on the ground?
                        </p>

                        {given ? (
                          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-900">
                            {given === "fixed" ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Thanks — you
                                confirmed the fix.
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 shrink-0 text-risk-urgent" aria-hidden /> You
                                reported it still exists — the incident was re-opened.
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              onClick={() => void sendFeedback(card.report.id, "fixed")}
                              disabled={sending !== null}
                              className="h-11 flex-1 gap-1.5 rounded-xl bg-trust-verified font-semibold text-white hover:bg-trust-verified/90"
                            >
                              {sending === card.report.id + "fixed" ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                              )}
                              {tr(lang, "fixed")}
                            </Button>
                            <Button
                              onClick={() => void sendFeedback(card.report.id, "still_exists")}
                              disabled={sending !== null}
                              variant="outline"
                              className="h-11 flex-1 gap-1.5 rounded-xl border-risk-urgent/40 font-semibold text-risk-urgent hover:bg-risk-urgent-soft hover:text-risk-urgent"
                            >
                              {sending === card.report.id + "still_exists" ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <XCircle className="h-4 w-4" aria-hidden />
                              )}
                              {tr(lang, "still_exists")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="h-11 gap-1.5 rounded-xl border-edge">
                    <Link href={`/my-reports/${card.report.id}`}>{tr(lang, "full_receipt")}</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 gap-1.5 rounded-xl border-edge">
                    <Link href={`/?v=${encodeURIComponent(card.report.venueId)}`}>{tr(lang, "venue_passport")}</Link>
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}

      {/* Phase 5 — delete confirmation (single dialog for the whole list) */}
      <AlertDialog open={confirmCard !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr(lang, "delete_report_title")}</AlertDialogTitle>
            <AlertDialogDescription>{tr(lang, "delete_report_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tr(lang, "cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open while the request runs
                if (confirmCard) void deleteThis(confirmCard);
              }}
              disabled={deleting}
              className="bg-destructive font-semibold text-white hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {tr(lang, "delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ul>
  );
}
