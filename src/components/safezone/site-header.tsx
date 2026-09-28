"use client";

/**
 * SiteHeader — the light header for informational pages (/about).
 *
 * Deliberately simpler than the app Header: no personas, no bell — just the
 * brand lockup (always back to the registry), the shared language toggle,
 * an About link and the primary "Open the app" action. Same height, border
 * and blur as the app header so page transitions feel continuous.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import { LangToggle } from "./lang-toggle";
import { ShieldMark } from "./logo";
import { cn } from "@/lib/utils";

export function SiteHeader({
  active,
  className,
}: {
  /** Marks the current informational page in the mini nav. */
  active?: "about" | null;
  className?: string;
}) {
  const { lang } = useLang();
  return (
    <header
      className={cn(
        "sticky top-0 z-[1000] border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="SafeZone — back to the registry home"
          className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge bg-surface shadow-card">
            <ShieldMark className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight tracking-tight">
              <span className="text-[#1E3A5F]">Safe</span>
              <span className="text-[#16A34A]">Zone</span>
            </div>
            <div className="hidden truncate text-xs text-ink-muted sm:block">
              {tr(lang, "tagline")}
            </div>
          </div>
        </Link>

        <nav className="ml-auto flex items-center gap-2 sm:gap-3" aria-label="Information pages">
          <Link
            href="/about"
            aria-current={active === "about" ? "page" : undefined}
            className={cn(
              "hidden h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors md:inline-flex",
              active === "about"
                ? "bg-navy-soft text-navy"
                : "text-ink-muted hover:bg-canvas hover:text-navy",
            )}
          >
            {tr(lang, "nav_about")}
          </Link>
          <LangToggle />
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-4 text-sm font-semibold text-white shadow-card transition-colors hover:bg-navy-hover"
          >
            <span className="hidden sm:inline">{tr(lang, "open_app")}</span>
            <span className="sm:hidden">
              <ArrowRight className="h-5 w-5" aria-hidden />
              <span className="sr-only">{tr(lang, "open_app")}</span>
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
