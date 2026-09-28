"use client";

/**
 * EN | हिं segmented toggle for the header. Choice persists in localStorage
 * (see lib/i18n.ts) and every mounted translated label follows via useLang().
 */

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/use-lang";

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div
      role="radiogroup"
      aria-label="Language / भाषा"
      title="Switch language / भाषा बदलें"
      className={cn(
        "flex h-11 items-center rounded-xl border border-edge bg-canvas p-1",
        className,
      )}
    >
      <span className="sr-only">Language</span>
      <Languages className="mx-1.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
      {(["en", "hi"] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={code === "en" ? "English" : "हिंदी"}
            onClick={() => setLang(code)}
            className={cn(
              "flex h-9 min-w-10 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors",
              active
                ? "bg-navy text-white shadow-card"
                : "text-ink-muted hover:bg-surface hover:text-navy",
            )}
          >
            {code === "en" ? "EN" : "हिं"}
          </button>
        );
      })}
    </div>
  );
}
