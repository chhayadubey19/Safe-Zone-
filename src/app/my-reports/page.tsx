"use client";

/**
 * /my-reports — the citizen's own reports (citizen@demo.com): cards with
 * venue, issue, photo thumbnail, date and status chip; tap for the vertical
 * progress timeline; resolved reports get the "You helped fix this" closure
 * banner with Fixed / Still exists → reporter_feedback.
 *
 * Phase 4: header shows the reporter trust badge — "Trusted reporter" (70+),
 * nothing (30–69), "New reporter" (<30).
 *
 * Client + /api/my-reports (same pattern as /gov, /report).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Megaphone, ShieldCheck, Sprout } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import type { CitizenReportCard } from "@/lib/data";
import { MyReportsList } from "@/components/safezone/my-reports-list";
import { BackButton } from "@/components/safezone/back-button";
import type { Persona } from "@/components/safezone/header";

export default function MyReportsPage() {
  const { lang } = useLang();
  const [cards, setCards] = useState<CitizenReportCard[] | null>(null);
  const [citizen, setCitizen] = useState<Persona | null>(null);
  const [reputation, setReputation] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve the citizen persona first, then load THEIR reports — the
        // demo-snapshot id does not exist in live mode (ids were remapped).
        const personasRes = await fetch("/api/personas");
        const personasData = (await personasRes.json()) as { personas: Persona[] };
        const citizen = personasData.personas?.find((p) => p.role === "citizen") ?? null;
        const reportsRes = await fetch(
          citizen ? `/api/my-reports?reporterId=${encodeURIComponent(citizen.id)}` : "/api/my-reports",
        );
        const reportsData = (await reportsRes.json()) as {
          reports: CitizenReportCard[];
          reporterReputation?: number | null;
        };
        if (!cancelled) {
          setCitizen(citizen);
          setCards(reportsData.reports ?? []);
          setReputation(reportsData.reporterReputation ?? null);
        }
      } catch {
        if (!cancelled) setCards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Trust badge: 70+ "Trusted reporter" · 30–69 nothing · <30 "New reporter".
  const badge =
    reputation === null
      ? null
      : reputation >= 70
        ? { key: "trusted_reporter" as const, icon: BadgeCheck, className: "border-trust-verified/40 bg-trust-verified-soft text-green-800" }
        : reputation < 30
          ? { key: "new_reporter" as const, icon: Sprout, className: "border-risk-verification/40 bg-risk-verification-soft text-amber-800" }
          : null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <BackButton fallbackHref="/" />
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy shadow-card">
              <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-bold leading-tight text-navy">
                  {tr(lang, "my_reports")}
                </span>
                {badge && (
                  <span
                    title={`Reporter reputation: ${reputation}`}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      badge.className,
                    )}
                  >
                    <badge.icon className="h-3 w-3" aria-hidden />
                    {tr(lang, badge.key)}
                  </span>
                )}
              </div>
              <div className="hidden truncate text-xs text-ink-muted sm:block">
                {citizen
                  ? `${citizen.name} · ${cards?.length ?? 0} filed`
                  : "citizen@demo.com"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {cards === null ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-edge bg-surface p-10 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-ink-muted" aria-hidden />
            <h1 className="mt-3 text-base font-semibold text-ink">No reports yet</h1>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
              When you report a safety issue, you can follow its progress here — from the first
              citizen report all the way to resolution.
            </p>
            <Link
              href="/report"
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white shadow-card hover:bg-navy-hover"
            >
              <Megaphone className="h-4 w-4" aria-hidden /> Report an issue
            </Link>
          </div>
        ) : (
          <MyReportsList
            cards={cards}
            onDeleted={(reportId) =>
              setCards((prev) => (prev ? prev.filter((c) => c.report.id !== reportId) : prev))
            }
          />
        )}
      </main>
    </div>
  );
}
