"use client";

/**
 * Step 2 — the "AI analyzing…" shimmer.
 *
 * Per-modality rows (text classification, photo vision) flip from spinner to
 * tick or warning as each server-only API call resolves, above a shimmer
 * skeleton that previews the confirm screen's shape. Calm interface, clear
 * progress — nothing is filed yet.
 */

import { AlertTriangle, Camera, CheckCircle2, Loader2, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallState } from "./types";

function CallRow({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof PenLine;
  label: string;
  state: CallState;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-xl border border-edge bg-surface px-4 text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-soft text-navy">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="flex-1 font-medium text-ink">{label}</span>
      {state === "running" && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin text-navy" aria-hidden /> Analyzing…
        </span>
      )}
      {state === "done" && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Done
        </span>
      )}
      {state === "failed" && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-risk-urgent">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Unavailable
        </span>
      )}
      {state === "idle" && <span className="text-xs text-ink-muted">Skipped</span>}
    </div>
  );
}

function ShimmerRow({ className }: { className?: string }) {
  return (
    <div className={cn("sz-map-loading h-11 rounded-xl border border-transparent", className)} />
  );
}

export function AnalyzingPanel({
  hasText,
  hasPhoto,
  classifyState,
  visionState,
}: {
  hasText: boolean;
  hasPhoto: boolean;
  classifyState: CallState;
  visionState: CallState;
}) {
  return (
    <section
      className="space-y-4 rounded-xl border border-edge bg-surface p-4 shadow-card sm:p-6"
      aria-live="polite"
      aria-label="AI analysis in progress"
    >
      <div>
        <h2 className="text-lg font-bold text-navy">AI analyzing your report…</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Gemini Flash is reading your evidence on the server. Every finding is a
          suggestion — <span className="font-medium text-ink">you confirm the final report.</span>
        </p>
      </div>

      <div className="space-y-2">
        {hasText && <CallRow icon={PenLine} label="Classifying your description" state={classifyState} />}
        {hasPhoto && <CallRow icon={Camera} label="Inspecting your photo" state={visionState} />}
      </div>

      {/* Shimmer skeleton — previews the confirm screen shape */}
      <div className="space-y-2" aria-hidden>
        <ShimmerRow className="h-14" />
        <ShimmerRow />
        <ShimmerRow />
        <ShimmerRow className="w-4/5" />
      </div>
    </section>
  );
}
