"use client";

import { SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { VenueCard } from "./venue-card";
import type { VenueSummary } from "@/lib/data";

export function VenueListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading venues">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-edge bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VenueList({
  venues,
  selectedId,
  onSelect,
  loading,
  hasMore,
}: {
  venues: VenueSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  hasMore?: (v: VenueSummary) => boolean;
}) {
  if (loading && venues.length === 0) {
    return <VenueListSkeleton />;
  }

  if (venues.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-edge bg-surface px-6 py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-canvas text-ink-muted">
          <SearchX className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-semibold text-ink">No venues match these filters</p>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-muted">
          Try a shorter search, or enable more risk tiers and venue types above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" role="list" aria-label="Venues">
      {venues.map((v) => (
        <div key={v.id} role="listitem">
          <VenueCard
            venue={v}
            selected={v.id === selectedId}
            onSelect={() => onSelect(v.id)}
          />
          {hasMore?.(v) && <div className="sr-only">More venues below</div>}
        </div>
      ))}
    </div>
  );
}
