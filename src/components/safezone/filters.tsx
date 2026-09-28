"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FILTERABLE_TYPES, TIER_DISPLAY, TierIcon, VENUE_TYPE_LABELS } from "./tokens";
import { tr, type StringKey } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import type { RiskTier, VenueType } from "@/lib/types";

export type TypeFilter = VenueType | "all";

const TIER_ORDER: RiskTier[] = ["URGENT", "HIGH", "NEEDS_VERIFICATION", "INSUFFICIENT_DATA"];
const TIER_LABEL_KEYS: Record<RiskTier, StringKey> = {
  URGENT: "tier_urgent",
  HIGH: "tier_high",
  NEEDS_VERIFICATION: "tier_verify",
  INSUFFICIENT_DATA: "tier_no_data",
};

export function Filters({
  query,
  onQueryChange,
  tiers,
  onTierToggle,
  tierCounts,
  type,
  onTypeChange,
  resultCount,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  tiers: Set<RiskTier>;
  onTierToggle: (t: RiskTier) => void;
  tierCounts: Record<RiskTier, number>;
  type: TypeFilter;
  onTypeChange: (t: TypeFilter) => void;
  resultCount: number;
}) {
  const { lang } = useLang();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search venue, ward or type…"
            aria-label="Search venues"
            className="h-12 rounded-xl border-edge bg-surface pl-10 pr-10 text-base shadow-card"
          />
          {query && (
            <button
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <Select value={type} onValueChange={(v) => onTypeChange(v as TypeFilter)}>
          <SelectTrigger
            aria-label="Filter by venue type"
            className="h-12 w-[9.5rem] rounded-xl border-edge bg-surface text-sm shadow-card sm:w-40"
          >
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-edge">
            <SelectItem value="all" className="h-11">All types</SelectItem>
            {FILTERABLE_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="h-11">
                {VENUE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tier chips double as the distribution strip — tap targets ≥ 48px */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by risk tier">
        {TIER_ORDER.map((tier) => {
          const active = tiers.has(tier);
          return (
            <button
              key={tier}
              onClick={() => onTierToggle(tier)}
              aria-pressed={active}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-card transition-colors",
                active
                  ? "border-navy bg-navy text-white"
                  : "border-edge bg-surface text-ink-muted hover:border-navy/40 hover:text-navy",
              )}
            >
              <TierIcon tier={tier} className="h-4 w-4" color={active ? "#FFFFFF" : undefined} />
              <span className="tnums">
                {lang === "en" ? TIER_DISPLAY[tier] : tr(lang, TIER_LABEL_KEYS[tier])}
                <span className={cn("ml-1.5", active ? "text-white/70" : "text-ink-muted/70")}>
                  {tierCounts[tier]}
                </span>
              </span>
            </button>
          );
        })}
        <span className="ml-auto hidden text-xs text-ink-muted sm:block tnums" aria-live="polite">
          {resultCount}{" "}
          {lang === "en"
            ? `venue${resultCount === 1 ? "" : "s"}`
            : tr(lang, "venues")}
        </span>
      </div>
    </div>
  );
}
