"use client";

/**
 * /venue/[id] — the venue passport page: the full venue detail (risk, checklist,
 * incidents, citizen reports, history, inspections) on its own URL.
 *
 * The home page keeps its quick-look sheet overlay (unchanged); this page is
 * the deep-linkable venue record and the back-navigation target from /report
 * (?v=<id> with no history) — Phase 5 back-navigation spec.
 *
 * Client + /api/venues/[id] (same pattern as /gov/venue/[id]).
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, MessageSquareQuote, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/safezone/back-button";
import { DetailSkeleton, VenueDetailBody } from "@/components/safezone/venue-detail";
import { VENUE_TYPE_LABELS, VenueTypeIcon } from "@/components/safezone/tokens";
import type { VenueDetail } from "@/lib/data";

export default function VenuePassportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<VenueDetail | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/venues/${encodeURIComponent(params.id)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { venue: VenueDetail };
        if (!cancelled) {
          setDetail(data.venue);
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

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <BackButton fallbackHref="/" />
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy shadow-card">
              {detail ? (
                <VenueTypeIcon type={detail.type} className="h-5 w-5 text-white" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-bold leading-tight text-navy">
                {detail ? detail.name : "Venue passport"}
              </div>
              {detail && (
                <div className="hidden truncate text-xs text-ink-muted sm:block">
                  {VENUE_TYPE_LABELS[detail.type] ?? detail.type} · {detail.ward}
                </div>
              )}
            </div>
          </div>
          {detail && (
            <div className="ml-auto hidden items-center gap-2 text-xs text-ink-muted md:flex">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {detail.lastInspectedDays === null
                ? "Never inspected"
                : `Inspected ${detail.lastInspectedDays}d ago`}
              {detail.reportCount > 0 && (
                <>
                  <Users className="ml-1 h-3.5 w-3.5" aria-hidden />
                  <span className="tnums">{detail.reportCount}</span>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {state === "loading" && (
          <>
            <Skeleton className="h-12 w-2/3 rounded-xl" />
            <DetailSkeleton />
          </>
        )}

        {state === "missing" && (
          <div className="rounded-xl border border-dashed border-edge bg-surface p-10 text-center">
            <p className="text-sm font-semibold text-ink">Venue not found</p>
            <p className="mt-1 text-xs text-ink-muted">
              The venue may have been removed or the link is incomplete.
            </p>
          </div>
        )}

        {state === "ok" && detail && (
          <>
            <VenueDetailBody detail={detail} />
            <div className="sticky bottom-4">
              <Button
                onClick={() => router.push(`/report?v=${encodeURIComponent(detail.id)}`)}
                className="h-12 w-full gap-2 rounded-xl bg-navy font-semibold text-white shadow-card hover:bg-navy-hover"
              >
                <MessageSquareQuote className="h-4 w-4" aria-hidden />
                Report an issue at this venue
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
