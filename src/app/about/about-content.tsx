"use client";

/**
 * /about — "About SafeZone" product page.
 *
 * Editorial composition: hero, four capability cards (the semantic category
 * system), a five-step workflow (horizontal on desktop, vertical timeline on
 * mobile), the four real roles the app supports, the actual report journey,
 * and a capabilities index. Detail lives in ONE InfoDialog at a time —
 * workflow steps, role cards and the two "what does this mean?" infos all
 * feed the same polished dialog (bottom sheet on mobile).
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BadgeCheck, Bell, Camera, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, ClipboardCheck, Eye, Landmark, Lightbulb, MapPin, Megaphone,
  Route, Send, ShieldCheck, Sparkles, Users, type LucideIcon,
} from "lucide-react";
import { useLang } from "@/hooks/use-lang";
import { SiteHeader } from "@/components/safezone/site-header";
import { InfoDialog } from "@/components/safezone/info-dialog";
import {
  InfoCard, SectionHeading, SemanticIcon, type CategoryVariant,
} from "@/components/safezone/design";
import { ABOUT, type L } from "@/lib/about-content";
import { cn } from "@/lib/utils";

// Page-local bilingual microcopy (kept next to the page that uses it).
const UI = {
  details: { en: "Details", hi: "विवरण" },
  canDo: { en: "What they can do", hi: "वे क्या कर सकते हैं" },
  provides: { en: "What they provide", hi: "वे क्या देते हैं" },
  receives: { en: "What they get back", hi: "वे क्या पाते हैं" },
  scoreLink: { en: "What does the risk score mean?", hi: "रिस्क स्कोर का क्या मतलब है?" },
};

const WHAT_ICONS: Record<string, LucideIcon> = {
  explore: MapPin, safety: ShieldCheck, ai: Sparkles, reports: Megaphone,
};
const STEP_ICONS: Record<string, LucideIcon> = {
  discover: MapPin, inspect: ClipboardCheck, analyze: Sparkles, understand: Lightbulb, decide: CheckCircle2,
};
const ROLE_ICONS: Record<string, LucideIcon> = {
  citizen: Users, inspector: ClipboardCheck, officer: Landmark, ai: Sparkles,
};
const JOURNEY_ICONS: LucideIcon[] = [Eye, Camera, Send, Route, ClipboardCheck, BadgeCheck, Bell];

type DialogState = {
  icon: LucideIcon;
  variant: CategoryVariant;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
};

export function AboutContent() {
  const { lang } = useLang();
  const t = (o: L) => (lang === "hi" ? o.hi : o.en);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const close = () => setDialog(null);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SiteHeader active="about" />

      <main className="flex-1">
        {/* ── SECTION 01 — hero ─────────────────────────────────────── */}
        <section className="border-b border-edge">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
            <div className="sz-rise max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cat-safety">
                {t(ABOUT.hero.eyebrow)}
              </div>
              <h1 className="mt-4 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
                {t(ABOUT.hero.title)}
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
                {t(ABOUT.hero.lede)}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-6 text-sm font-semibold text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-navy-hover hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  {t(ABOUT.hero.ctaPrimary)}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-edge bg-surface px-6 text-sm font-semibold text-navy shadow-card transition-all duration-200 hover:border-navy/35 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                >
                  <ChevronDown className="h-4 w-4" aria-hidden />
                  {t(ABOUT.hero.ctaSecondary)}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 02 — what SafeZone does ───────────────────────── */}
        <section className="border-b border-edge">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
            <SectionHeading
              eyebrow={t(ABOUT.whatHeading.eyebrow)}
              title={t(ABOUT.whatHeading.title)}
              lede={t(ABOUT.whatHeading.lede)}
              variant="location"
              className="sz-rise"
            />
            <div className="sz-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ABOUT.whatCards.map((card) => {
                const Icon = WHAT_ICONS[card.id] ?? MapPin;
                return (
                  <InfoCard
                    key={card.id}
                    icon={Icon}
                    variant={card.variant}
                    meta={t(card.meta)}
                    title={t(card.title)}
                    className="h-full"
                    footer={
                      "hasInfo" in card && card.hasInfo ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDialog({
                              icon: Sparkles,
                              variant: "ai",
                              eyebrow: t(ABOUT.aiInfo.eyebrow),
                              title: t(ABOUT.aiInfo.title),
                              body: t(ABOUT.aiInfo.body),
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-cat-ai transition-colors hover:text-cat-ai/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cat-ai/40"
                        >
                          <CircleHelp className="h-3.5 w-3.5" aria-hidden />
                          {t(ABOUT.aiInfo.title)}
                        </button>
                      ) : undefined
                    }
                  >
                    {t(card.body)}
                  </InfoCard>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── SECTION 03 — how it works ─────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-20 border-b border-edge bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
            <SectionHeading
              eyebrow={t(ABOUT.workflowHeading.eyebrow)}
              title={t(ABOUT.workflowHeading.title)}
              lede={t(ABOUT.workflowHeading.lede)}
              variant="safety"
              className="sz-rise"
            />

            <div className="relative mt-12">
              {/* Connector — horizontal rail through the icon tiles (lg+) */}
              <div className="absolute left-0 right-0 top-6 hidden h-px bg-edge lg:block" aria-hidden />
              <ol className="sz-stagger relative grid gap-8 lg:grid-cols-5 lg:gap-5">
                {ABOUT.workflow.map((step) => {
                  const Icon = STEP_ICONS[step.id] ?? MapPin;
                  return (
                    <li key={step.id} className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setDialog({
                            icon: Icon,
                            variant: step.variant,
                            eyebrow: `${t(ABOUT.workflowHeading.eyebrow)} · ${step.num}`,
                            title: t(step.title),
                            body: t(step.detail),
                          })
                        }
                        className="group flex w-full flex-col text-left focus-visible:outline-none lg:items-center lg:text-center"
                        aria-haspopup="dialog"
                      >
                        <SemanticIcon icon={Icon} variant={step.variant} size="lg" className="lg:mx-auto" />
                        <span className="mt-4 flex items-baseline gap-2 lg:mt-5 lg:justify-center">
                          <span className="tnums text-[11px] font-bold uppercase tracking-[0.18em] text-ink-muted">
                            {step.num}
                          </span>
                          <span className="text-[15px] font-semibold text-ink">{t(step.title)}</span>
                        </span>
                        <span className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                          {t(step.short)}
                        </span>
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-navy opacity-70 transition-all group-hover:gap-1.5 group-hover:opacity-100 group-focus-visible:opacity-100">
                          {t(UI.details)}
                          <ChevronRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Risk score info link */}
            <div className="mt-14 border-t border-edge pt-6 lg:mt-10">
              <button
                type="button"
                onClick={() =>
                  setDialog({
                    icon: Lightbulb,
                    variant: "medical",
                    eyebrow: t(ABOUT.scoreInfo.eyebrow),
                    title: t(ABOUT.scoreInfo.title),
                    body: t(ABOUT.scoreInfo.body),
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-navy transition-colors hover:text-navy-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
              >
                <CircleHelp className="h-4 w-4 text-cat-medical" aria-hidden />
                {t(UI.scoreLink)}
              </button>
            </div>
          </div>
        </section>

        {/* ── SECTION 04 — who SafeZone is for ──────────────────────── */}
        <section className="border-b border-edge">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
            <SectionHeading
              eyebrow={t(ABOUT.rolesHeading.eyebrow)}
              title={t(ABOUT.rolesHeading.title)}
              lede={t(ABOUT.rolesHeading.lede)}
              variant="community"
              className="sz-rise"
            />
            <div className="sz-stagger mt-10 grid gap-4 sm:grid-cols-2">
              {ABOUT.roles.map((role) => {
                const Icon = ROLE_ICONS[role.id] ?? Users;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      setDialog({
                        icon: Icon,
                        variant: role.variant,
                        eyebrow: t(role.meta),
                        title: t(role.title),
                        body: (
                          <div className="space-y-5">
                            <p>{t(role.short)}</p>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink">
                                {t(UI.canDo)}
                              </div>
                              <ul className="mt-2 space-y-1.5">
                                {role.canDo[lang].map((item) => (
                                  <li key={item} className="flex gap-2">
                                    <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full")} style={{ background: "var(--color-cat-" + role.variant + ")" }} />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="grid gap-4 border-t border-edge pt-4 sm:grid-cols-2">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                                  {t(UI.provides)}
                                </div>
                                <p className="mt-1.5">{t(role.provides)}</p>
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                                  {t(UI.receives)}
                                </div>
                                <p className="mt-1.5">{t(role.receives)}</p>
                              </div>
                            </div>
                          </div>
                        ),
                      })
                    }
                    className="group flex h-full flex-col rounded-xl border border-edge bg-surface p-5 text-left shadow-card transition-all hover:border-navy/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40"
                    aria-haspopup="dialog"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <SemanticIcon icon={Icon} variant={role.variant} />
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                    <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                      {t(role.meta)}
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold leading-snug text-ink">
                      {t(role.title)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(role.short)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── SECTION 05 — the report journey ───────────────────────── */}
        <section className="border-b border-edge bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
            <SectionHeading
              eyebrow={t(ABOUT.journeyHeading.eyebrow)}
              title={t(ABOUT.journeyHeading.title)}
              lede={t(ABOUT.journeyHeading.lede)}
              variant="report"
              className="sz-rise"
            />
            <ol className="sz-stagger mt-10 grid sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4 sm:[&>li:nth-child(-n+2)]:border-t-0 lg:[&>li:nth-child(-n+4)]:border-t-0">
              {ABOUT.journey.map((step, i) => {
                const Icon = JOURNEY_ICONS[i] ?? MapPin;
                const dotVariant: CategoryVariant = i >= 4 ? "education" : i >= 2 ? "safety" : "location";
                return (
                  <li
                    key={step.title.en}
                    className="flex gap-4 border-t border-edge py-5 first:border-t-0 first:pt-0 sm:py-6"
                  >
                    <SemanticIcon icon={Icon} variant={dotVariant} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="tnums text-[11px] font-bold text-ink-muted">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h3 className="text-sm font-semibold text-ink">{t(step.title)}</h3>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{t(step.body)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ── SECTION 06 — capabilities index (editorial, not card soup) ── */}
        <section className="border-b border-edge">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <div className="sz-rise">
              <SectionHeading
                eyebrow={t(ABOUT.capabilitiesHeading.eyebrow)}
                title={t(ABOUT.capabilitiesHeading.title)}
                variant="venue"
              />
              <div className="mt-8 flex flex-wrap gap-2">
                <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-ink-muted">120 venues</span>
                <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-ink-muted">4 departments</span>
                <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-ink-muted">EN · हिं</span>
                <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-ink-muted">AI photo analysis</span>
              </div>
            </div>
            <ol className="sz-stagger">
              {ABOUT.capabilities.map((cap) => (
                <li key={cap.num} className="flex gap-5 border-t border-edge py-4 first:border-t-0 first:pt-0 sm:py-5">
                  <span className="tnums text-sm font-bold text-ink-muted">{cap.num}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{t(cap.title)}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{t(cap.body)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Closing CTA ───────────────────────────────────────────── */}
        <section className="bg-navy">
          <div className="mx-auto max-w-[1200px] px-4 py-16 text-center sm:px-6 sm:py-24">
            <h2 className="sz-rise-lg mx-auto max-w-xl text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              {t(ABOUT.closing.title)}
            </h2>
            <p className="sz-rise mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/75 [animation-delay:120ms]">
              {t(ABOUT.closing.body)}
            </p>
            <Link
              href="/"
              className="sz-rise mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-navy shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 [animation-delay:200ms]"
            >
              {t(ABOUT.closing.cta)}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-edge bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-ink-muted sm:px-6">
          <span className="font-semibold text-navy">SafeZone — Bhopal Community Safety Registry</span>
          <span>Safer Places. Stronger Communities.</span>
        </div>
      </footer>

      {/* The single popup instance — workflow details, role details, AI and
          score infos all render here. Never stacks. */}
      <InfoDialog
        open={dialog !== null}
        onOpenChange={(next) => !next && close()}
        icon={dialog?.icon}
        variant={dialog?.variant ?? "neutral"}
        eyebrow={dialog?.eyebrow}
        title={dialog?.title ?? ""}
      >
        {dialog?.body}
      </InfoDialog>
    </div>
  );
}
