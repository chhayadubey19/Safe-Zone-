"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { TierBadge, VENUE_TYPE_LABELS } from "./tokens";
import { VenueTypeTile } from "./design";
import type { VenueSummary } from "@/lib/data";
import type { VenueStatus } from "@/lib/scoring";

const STATUS_DOT: Record<VenueStatus, string> = {
  "SAFETY CONCERN CONFIRMED": "bg-risk-urgent",
  "CRITICAL ISSUE REPORTED (unverified)": "bg-risk-verification",
  "Some safety information needs verification": "bg-risk-verification",
  "All safety checks passing": "bg-trust-verified",
  "Insufficient data": "bg-trust-unverified",
};

const STATUS_TEXT: Record<VenueStatus, string> = {
  "SAFETY CONCERN CONFIRMED": "Concern confirmed by inspection",
  "CRITICAL ISSUE REPORTED (unverified)": "Critical reported — unconfirmed",
  "Some safety information needs verification": "Needs verification",
  "All safety checks passing": "All checks passing",
  "Insufficient data": "Insufficient data",
};

export function VenueCard({
  venue,
  selected,
  onSelect,
}: {
  venue: VenueSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-xl border bg-surface p-4 text-left shadow-card transition-all",
        selected
          ? "border-navy ring-2 ring-navy/25"
          : "border-edge hover:border-navy/40 hover:shadow-card-hover",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type tile — semantic category colour per venue type (education
            indigo for schools, medical blue for clinics, venue sand for
            cafés…), replacing the single pale-navy tile every card used to
            share. One shared component, one mapping. */}
        <VenueTypeTile type={venue.type} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{venue.name}</div>
              <div className="mt-0.5 truncate text-xs text-ink-muted">
                {VENUE_TYPE_LABELS[venue.type] ?? venue.type} · {venue.ward}
              </div>
            </div>
            <TierBadge tier={venue.risk.tier} className="shrink-0" />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[venue.status])} aria-hidden />
              <span className="truncate">{STATUS_TEXT[venue.status]}</span>
              {venue.reportCount > 0 && (
                <span className="hidden shrink-0 items-center gap-1 sm:inline-flex tnums">
                  · <Users className="h-3 w-3" aria-hidden /> {venue.reportCount}
                </span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="tnums text-lg font-bold leading-none text-navy">{venue.risk.score}</span>
              <span className="ml-1 text-[10px] uppercase tracking-wide text-ink-muted">risk</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
