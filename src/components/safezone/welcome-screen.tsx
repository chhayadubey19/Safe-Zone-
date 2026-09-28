"use client";

/**
 * First-visit welcome — a FULLSCREEN takeover, not a boxed modal.
 *
 * Composition: asymmetric split. Left carries the SafeZone identity,
 * the display headline, supporting copy and the CTAs; right is a purely
 * coded abstract map (SVG streets, blocks, the Upper Lake, tier pins and
 * radius rings) plus one floating product card — no photos, no generated
 * art, no heavy libraries. On mobile the map collapses into a compact
 * band under the CTAs so the primary action is immediately reachable.
 *
 * First-visit logic: localStorage flags (`safezone_has_seen_welcome`,
 * plus the legacy `safezone_onboarded_v1` so returning users are never
 * re-nagged). The flag is read only after mount, so SSR and the first
 * client render agree — no hydration flash or mismatch.
 *
 * Motion: one choreography pass — headline rises, streets draw in, pins
 * pop sequentially, rings breathe. Every animation is disabled under
 * prefers-reduced-motion (see globals.css).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { tr } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";
import { SemanticIcon } from "./design";
import { ShieldMark } from "./logo";

const WELCOME_KEY = "safezone_has_seen_welcome";
const LEGACY_KEY = "safezone_onboarded_v1";

/** Tiny tier dot for the floating venue card (matches the app's marker colours). */
const TIER_DOT: Record<string, string> = {
  safe: "bg-trust-verified",
  verify: "bg-risk-verification",
  urgent: "bg-risk-urgent",
};

export function WelcomeScreen() {
  const router = useRouter();
  const { lang } = useLang();
  // Start closed — the flags are only readable client-side after mount, so
  // SSR and first client render agree (no hydration mismatch, no flash for
  // returning visitors).
  const [show, setShow] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);

  const seenBefore = () => {
    try {
      return Boolean(
        window.localStorage.getItem(WELCOME_KEY) || window.localStorage.getItem(LEGACY_KEY),
      );
    } catch {
      // Private mode / blocked storage — never nag: treat as seen.
      return true;
    }
  };

  const markSeen = () => {
    try {
      window.localStorage.setItem(WELCOME_KEY, "true");
      window.localStorage.setItem(LEGACY_KEY, "1");
    } catch {
      /* storage blocked — the welcome still closes for this visit */
    }
  };

  const dismiss = () => {
    markSeen();
    setShow(false);
  };

  const learnMore = () => {
    markSeen();
    setShow(false);
    router.push("/about");
  };

  useEffect(() => {
    // One-shot read of an external store (localStorage) that must happen
    // AFTER mount — reading during render would fork SSR and client output
    // (hydration mismatch). This is the documented pattern for first-visit-only
    // overlays, so the compiler rule is disabled for this read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seenBefore()) setShow(true);
  }, []);

  // Escape accepts — keyboard users are never trapped.
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  // Lock the page behind the takeover; focus the primary CTA.
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ctaRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="sz-fade fixed inset-0 z-[3000] overflow-y-auto bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to SafeZone"
    >
      <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[1.06fr_0.94fr]">
        {/* ── LEFT — identity, headline, CTAs ─────────────────────────────── */}
        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 lg:px-14 xl:px-20 lg:py-12">
          {/* Brand lockup */}
          <div className="sz-rise flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-edge bg-surface shadow-card">
              <ShieldMark className="h-9 w-9" />
            </div>
            <div>
              <div className="text-xl font-bold leading-none tracking-tight">
                <span className="text-[#1E3A5F]">Safe</span>
                <span className="text-[#16A34A]">Zone</span>
              </div>
              <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                {tr(lang, "tagline")}
              </div>
            </div>
          </div>

          {/* Display headline */}
          <h1
            className="sz-rise-lg mt-10 max-w-[13ch] text-[2.5rem] font-bold leading-[1.08] tracking-tight text-ink [animation-delay:80ms] sm:text-5xl lg:text-[3.4rem]"
          >
            {tr(lang, "welcome_headline")}
          </h1>

          {/* Supporting copy — three short lines, no wall of text */}
          <p className="sz-rise mt-5 max-w-md text-[15px] leading-relaxed text-ink-muted [animation-delay:160ms] sm:text-base">
            {tr(lang, "welcome_subtitle")}
          </p>

          {/* CTAs — primary accepts, secondary teaches */}
          <div className="sz-rise mt-8 flex flex-col gap-3 [animation-delay:240ms] sm:flex-row sm:items-center">
            <button
              ref={ctaRef}
              type="button"
              onClick={dismiss}
              className="group inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-navy px-7 text-[15px] font-semibold text-white shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:bg-navy-hover hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2 active:translate-y-0"
            >
              {tr(lang, "welcome_get_started")}
              <ArrowRight
                className="h-4.5 w-4.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={learnMore}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-edge bg-surface px-5 text-[15px] font-semibold text-navy shadow-card transition-all duration-200 hover:border-navy/35 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2"
            >
              {tr(lang, "welcome_how_it_works")}
            </button>
          </div>

          {/* Three capability chips — the semantic category system, visible
              from the very first screen (location green / safety amber /
              AI violet). Staggered entrance. */}
          <ul className="sz-stagger mt-12 grid gap-3 border-t border-edge pt-8 sm:grid-cols-3">
            <li className="flex items-center gap-3 rounded-xl border border-edge bg-surface p-3.5 shadow-card">
              <SemanticIcon icon={MapPin} variant="location" size="sm" />
              <span className="text-[13px] font-medium leading-snug text-ink">
                {tr(lang, "welcome_chips_explore")}
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-edge bg-surface p-3.5 shadow-card">
              <SemanticIcon icon={ShieldCheck} variant="safety" size="sm" />
              <span className="text-[13px] font-medium leading-snug text-ink">
                {tr(lang, "welcome_chips_records")}
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-edge bg-surface p-3.5 shadow-card">
              <SemanticIcon icon={Sparkles} variant="ai" size="sm" />
              <span className="text-[13px] font-medium leading-snug text-ink">
                {tr(lang, "welcome_chips_ai")}
              </span>
            </li>
          </ul>

          <p className="mt-8 text-xs text-ink-muted">
            120 Bhopal venues · 4 departments · English &amp; हिंदी
          </p>
        </div>

        {/* ── RIGHT — the coded map (full-height panel on desktop, compact
              band on mobile — never a literal map clone, always secondary) ── */}
        <div className="relative h-60 border-t border-edge bg-surface sm:h-72 lg:h-auto lg:min-h-0 lg:border-l lg:border-t-0">
          <WelcomeMapViz />

          {/* Floating product card — desktop only, staggered in after the pins */}
          <div
            className="sz-rise absolute bottom-8 left-8 hidden w-64 rounded-xl border border-edge bg-surface/95 p-4 shadow-card-hover backdrop-blur-sm lg:block [animation-delay:900ms]"
            aria-hidden
          >
            <div className="flex items-start gap-3">
              <SemanticIcon icon={MapPin} variant="education" size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">Sunbeam Public School</div>
                <div className="mt-0.5 text-xs text-ink-muted">Ward 66 · School</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-trust-verified-soft px-2 py-0.5 text-[11px] font-medium text-green-800">
                  <span className={TIER_DOT.safe + " h-1.5 w-1.5 rounded-full"} />
                  All checks passing
                </div>
              </div>
            </div>
          </div>

          {/* Small stat pill — desktop only, balances the card */}
          <div
            className="sz-rise absolute right-8 top-8 hidden items-center gap-2 rounded-full border border-edge bg-surface/95 px-3.5 py-2 text-xs font-medium text-ink shadow-card backdrop-blur-sm lg:inline-flex [animation-delay:1050ms]"
            aria-hidden
          >
            <Sparkles className="h-3.5 w-3.5 text-cat-ai" aria-hidden />
            AI photo analysis
            <span className="text-ink-muted">·</span>
            <span className="text-ink-muted">24/7</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The coded map illustration — SVG only, no assets.
 * A quiet grid, the Upper Lake, two boulevards that draw themselves in,
 * city blocks, three tier pins (green with breathing radius rings, amber,
 * slate) and tiny ward labels. Reads instantly as "safety map" without
 * imitating any real basemap.
 */
function WelcomeMapViz() {
  return (
    <svg
      className="h-full w-full"
      viewBox="0 0 640 640"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* The quiet street grid */}
        <pattern id="wz-grid" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#eef2f7" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Base + grid */}
      <rect width="640" height="640" fill="#ffffff" />
      <rect width="640" height="640" fill="url(#wz-grid)" />

      {/* The Upper Lake — Bhopal's landmark, abstract */}
      <path
        d="M -20 96 C 40 52, 128 58, 168 96 C 208 134, 196 196, 150 216 C 104 236, 28 226, -8 184 C -34 153, -44 122, -20 96 Z"
        fill="#ddebF7"
        stroke="#c3d9ec"
        strokeWidth="1.5"
      />
      <text x="34" y="128" fontSize="9" fill="#8aa8c4" letterSpacing="2">
        UPPER LAKE
      </text>

      {/* City blocks — light plates between the streets */}
      <g fill="#f4f7fa" stroke="#e6ebf1" strokeWidth="1">
        <rect x="228" y="82" width="104" height="66" rx="6" />
        <rect x="402" y="98" width="84" height="88" rx="6" />
        <rect x="212" y="236" width="96" height="74" rx="6" />
        <rect x="64" y="300" width="88" height="80" rx="6" />
        <rect x="396" y="292" width="110" height="64" rx="6" />
        <rect x="252" y="428" width="90" height="70" rx="6" />
        <rect x="96" y="476" width="104" height="60" rx="6" />
        <rect x="418" y="452" width="88" height="78" rx="6" />
      </g>

      {/* Boulevards — draw themselves in on load */}
      <g fill="none" strokeLinecap="round">
        <path
          className="sz-draw"
          style={{ "--sz-draw-len": "760", animationDelay: "180ms" } as React.CSSProperties}
          d="M -20 356 C 120 336, 220 396, 330 380 C 440 364, 520 306, 660 332"
          stroke="#cdd7e1"
          strokeWidth="5"
        />
        <path
          className="sz-draw"
          style={{ "--sz-draw-len": "700", animationDelay: "320ms" } as React.CSSProperties}
          d="M 322 -20 C 310 110, 344 214, 330 330 C 316 446, 344 556, 322 660"
          stroke="#cdd7e1"
          strokeWidth="5"
        />
        <path
          className="sz-draw"
          style={{ "--sz-draw-len": "700", animationDelay: "460ms" } as React.CSSProperties}
          d="M -20 176 C 160 160, 360 190, 660 158"
          stroke="#e2e8f0"
          strokeWidth="3"
        />
        <path
          className="sz-draw"
          style={{ "--sz-draw-len": "700", animationDelay: "560ms" } as React.CSSProperties}
          d="M -20 520 C 180 502, 380 546, 660 500"
          stroke="#e2e8f0"
          strokeWidth="3"
        />
      </g>

      {/* Ward labels */}
      <g fontSize="9" fill="#a3aebc" letterSpacing="2">
        <text x="240" y="70">WARD 28</text>
        <text x="424" y="82">NEW MARKET</text>
        <text x="266" y="540">MP NAGAR</text>
      </g>

      {/* A quiet dashed route between two pins */}
      <path
        d="M 456 232 C 400 268, 320 300, 258 296"
        fill="none"
        stroke="#1e3a5f"
        strokeOpacity="0.35"
        strokeWidth="1.75"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />

      {/* The green pin — breathing radius rings (the "safe zone" itself) */}
      <g>
        <circle className="sz-ring-breathe" cx="258" cy="296" r="30" fill="none" stroke="#16a34a" strokeWidth="1.5" />
        <circle
          className="sz-ring-breathe"
          style={{ animationDelay: "1.4s" }}
          cx="258"
          cy="296"
          r="30"
          fill="none"
          stroke="#16a34a"
          strokeWidth="1.5"
        />
        <circle cx="258" cy="296" r="28" fill="#16a34a" fillOpacity="0.08" />
      </g>

      {/* Tier pins — pop in sequentially */}
      <g className="sz-pin-pop" style={{ animationDelay: "640ms" }}>
        <circle cx="258" cy="296" r="11" fill="#16a34a" stroke="#ffffff" strokeWidth="3" />
        <circle cx="258" cy="296" r="3.4" fill="#ffffff" />
      </g>
      <g className="sz-pin-pop" style={{ animationDelay: "790ms" }}>
        <circle cx="456" cy="232" r="11" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" />
        <circle cx="456" cy="232" r="3.4" fill="#ffffff" />
      </g>
      <g className="sz-pin-pop" style={{ animationDelay: "940ms" }}>
        <circle cx="140" cy="392" r="11" fill="#94a3b8" stroke="#ffffff" strokeWidth="3" />
        <circle cx="140" cy="392" r="3.4" fill="#ffffff" />
      </g>
      <g className="sz-pin-pop" style={{ animationDelay: "1080ms" }}>
        <circle cx="360" cy="492" r="11" fill="#1e3a5f" stroke="#ffffff" strokeWidth="3" />
        <circle cx="360" cy="492" r="3.4" fill="#ffffff" />
      </g>
    </svg>
  );
}
