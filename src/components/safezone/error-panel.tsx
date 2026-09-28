"use client";

/**
 * Shared error-boundary panel — what a crashed segment renders instead of a
 * white screen. Branded, bilingual, no stack traces to the user (the error
 * itself is already logged by Next.js on the server/console side).
 */

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCw, ShieldAlert } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";

export function ErrorPanel({
  error,
  reset,
  title,
  hint,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  hint?: string;
}) {
  const { lang } = useLang();

  // Surface the digest server-side/console-side for debugging without ever
  // showing a stack trace in the UI.
  useEffect(() => {
    console.error("[safezone] render error:", error?.message, error?.digest ?? "");
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-risk-urgent-soft">
        <ShieldAlert className="h-7 w-7 text-risk-urgent" aria-hidden />
      </div>
      <div className="max-w-md space-y-1.5">
        <h2 className="text-lg font-bold text-ink">
          {title ?? tr(lang, "error_boundary_title")}
        </h2>
        <p className="text-sm text-ink-muted">{hint ?? tr(lang, "error_boundary_hint")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {reset && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-navy-hover"
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            {tr(lang, "error_retry")}
          </button>
        )}
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-edge bg-surface px-5 text-sm font-medium text-ink shadow-card transition-colors hover:border-navy/40"
        >
          <Home className="h-4 w-4" aria-hidden />
          {tr(lang, "error_back_home")}
        </Link>
      </div>
    </div>
  );
}
