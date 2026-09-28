"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, ClipboardCheck, FileText, Landmark, Megaphone, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";
import { tr } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import { NotificationBell } from "./notifications-bell";
import { LangToggle } from "./lang-toggle";
import { ShieldMark } from "./logo";

export interface Persona {
  id: string;
  name: string;
  role: Role;
  email: string;
}

const PERSONA_META: Record<Role, { label: string; icon: typeof User; hint: string }> = {
  citizen: { label: "Citizen", icon: User, hint: "citizen@demo.com" },
  inspector: { label: "Inspector", icon: ClipboardCheck, hint: "inspector@demo.com" },
  officer: { label: "Officer", icon: Landmark, hint: "officer@demo.com" },
};

export function Header({
  personas,
  activePersonaId,
  onPersonaChange,
  onReport,
}: {
  personas: Persona[];
  activePersonaId: string | null;
  onPersonaChange: (id: string) => void;
  onReport: () => void;
}) {
  const router = useRouter();
  const { lang } = useLang();
  const active = personas.find((p) => p.id === activePersonaId);
  const role = active?.role ?? "citizen";

  const primaryAction = () => {
    if (role === "citizen") {
      onReport();
    } else {
      // Phase 3 — inspector and officer workflows are real now
      // (audit form, resolution, queue). The persona is a server-side
      // choice, writes go through the admin client.
      router.push("/gov");
    }
  };

  /* z-[1000]: stays above the isolated map (z-0) and everything else in
     normal page flow; modals/sheets live at z-[1100] so they still
     dim + cover the header when open. */
  return (
    <header className="sticky top-0 z-[1000] border-b border-edge bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        {/* Brand lockup — shield mark + "Safe"Zone wordmark, always home */}
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

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Phase 4 — EN | हिं language toggle (visible on every width —
              compact enough for 375px; the persona switcher hides below sm) */}
          <LangToggle />

          {/* Citizen surface — notifications bell + my reports (Phase 3). */}
          {role === "citizen" && (
            <>
              <Link
                href="/my-reports"
                className="hidden h-11 items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 text-sm font-medium text-ink-muted shadow-card transition-colors hover:text-navy md:inline-flex"
                title="Your filed reports and their progress"
              >
                <FileText className="h-4 w-4" aria-hidden />
                <span className="hidden lg:inline">{tr(lang, "my_reports")}</span>
              </Link>
              <NotificationBell recipientId={active?.id ?? null} />
            </>
          )}

          {/* Informational pages — About SafeZone (desktop; mobile reaches it
              from the footer and the first-visit welcome). */}
          <Link
            href="/about"
            className="hidden h-11 items-center rounded-xl px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 md:inline-flex"
          >
            {tr(lang, "nav_about")}
          </Link>

          {/* Persona switcher — tap targets ≥ 48px */}
          <div
            role="radiogroup"
            aria-label="Demo persona"
            className="hidden items-center rounded-xl border border-edge bg-canvas p-1 sm:flex"
          >
            {personas.map((p) => {
              const meta = PERSONA_META[p.role];
              const Icon = meta.icon;
              const isActive = p.id === activePersonaId;
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={isActive}
                  title={`Viewing as ${meta.label} (${meta.hint})`}
                  onClick={() => onPersonaChange(p.id)}
                  className={cn(
                    "flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-navy text-white shadow-card"
                      : "text-ink-muted hover:bg-surface hover:text-navy",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span className="hidden lg:inline">{meta.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            onClick={primaryAction}
            className="h-12 gap-2 rounded-xl bg-navy px-4 font-semibold text-white shadow-card transition-colors hover:bg-navy-hover"
          >
            {role === "citizen" ? (
              <Megaphone className="h-4 w-4" aria-hidden />
            ) : role === "inspector" ? (
              <ClipboardCheck className="h-4 w-4" aria-hidden />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            )}
            <span className="hidden sm:inline">
              {role === "citizen"
                ? tr(lang, "report_issue")
                : role === "inspector"
                  ? "Log inspection"
                  : "Review queue"}
            </span>
            <span className="sm:hidden">
              {role === "citizen" ? tr(lang, "report_short") : role === "inspector" ? "Inspect" : "Review"}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
