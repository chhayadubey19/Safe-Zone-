"use client";

/**
 * /gov/inspect/[id] — the inspector audit + resolution flow for one venue
 * (id = venue id). Entry: the officer venue case file's "Conduct inspection".
 * Client + /api/inspect (same pattern as /gov and /report) so behaviour is
 * identical in dev and published builds.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AuditFlow } from "@/components/safezone/inspector/audit-flow";
import { Skeleton } from "@/components/ui/skeleton";
import type { InspectorContext } from "@/lib/data";

export default function InspectPage() {
  const params = useParams<{ id: string }>();
  const [context, setContext] = useState<InspectorContext | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inspect?venueId=${encodeURIComponent(params.id)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as InspectorContext;
        if (!cancelled) {
          setContext(data);
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

  if (state === "ok" && context) return <AuditFlow context={context} />;

  return (
    <div className="min-h-dvh bg-canvas">
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {state === "missing" ? (
          <div className="rounded-xl border border-dashed border-edge bg-surface p-10 text-center">
            <p className="text-sm font-semibold text-ink">Venue not found</p>
            <p className="mt-1 text-xs text-ink-muted">
              The venue may have been removed or the link is incomplete.
            </p>
          </div>
        ) : (
          <>
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </>
        )}
      </main>
    </div>
  );
}
