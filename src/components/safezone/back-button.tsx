"use client";

/**
 * Phase 5 — the consistent back affordance for every sub-page.
 *
 *   ChevronLeft + "Back" (Hindi-aware), top-left of the header.
 *   router.back() when an in-app history entry exists (Next.js stamps each
 *   entry with history.state.idx — 0 for the first one), otherwise navigate
 *   to the logical parent passed as `fallbackHref`.
 *
 * The label hides below the sm breakpoint (icon-only) so 375px headers stay
 * uncluttered — the same pattern the report page already used.
 */

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";

export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const { lang } = useLang();

  const goBack = () => {
    // Next.js App Router maintains `idx` on the history entry: 0 = the first
    // in-app entry (nothing earlier in THIS app to go back to). A value > 0
    // means router.back() lands on a real page of ours, not off-site.
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) router.back();
    else router.push(fallbackHref);
  };

  return (
    <Button
      variant="ghost"
      onClick={goBack}
      className="h-12 shrink-0 gap-1.5 rounded-xl px-2.5 text-ink-muted hover:text-navy"
      aria-label={tr(lang, "back")}
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{tr(lang, "back")}</span>
    </Button>
  );
}
