"use client";

/**
 * SafeZone semantic design system — the 2024/25 UI layer.
 *
 * Three colour ladders, each with a job (see globals.css @theme):
 *  - CATEGORY (`cat-*`)  — WHAT a thing is about (explore, AI, education…).
 *    Very light background + dark icon of the same hue. Used by icon tiles,
 *    feature cards and informational pages. Never carries risk state.
 *  - RISK (`risk-*`)    — priority of attention (urgent/high/verify/no-data).
 *  - TRUST (`trust-*`)  — source of information (verified/citizen/unverified).
 *
 * This module exposes the reusable presentation primitives so no surface
 * hand-rolls its own icon background again:
 *  - SemanticIcon  — one icon tile, variant-driven colour ("location",
 *    "safety", "ai", "report", "medical", "education", "community", "venue").
 *  - InfoCard      — a card with a variant-tinted icon, title and body.
 *  - SectionHeading — eyebrow + display heading + lede, editorial rhythm.
 *  - venueTypeCategory — venue type → category mapping (kills the old
 *    "every card has the same pale navy tile" repetition).
 */

import type { LucideIcon } from "lucide-react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { VENUE_TYPE_ICONS } from "./tokens";

// ---------------------------------------------------------------------------
// Category registry
// ---------------------------------------------------------------------------

export type CategoryVariant =
  | "location"
  | "safety"
  | "ai"
  | "report"
  | "medical"
  | "education"
  | "community"
  | "venue"
  | "neutral";

/** Tile classes: soft background + dark icon, plus a hairline of the same hue. */
const CATEGORY_TILE: Record<CategoryVariant, string> = {
  location: "bg-cat-location-soft text-cat-location",
  safety: "bg-cat-safety-soft text-cat-safety",
  ai: "bg-cat-ai-soft text-cat-ai",
  report: "bg-cat-report-soft text-cat-report",
  medical: "bg-cat-medical-soft text-cat-medical",
  education: "bg-cat-education-soft text-cat-education",
  community: "bg-cat-community-soft text-cat-community",
  venue: "bg-cat-venue-soft text-cat-venue",
  neutral: "bg-cat-neutral-soft text-cat-neutral",
};

/** Accent text/border utilities for the same nine categories. */
const CATEGORY_TEXT: Record<CategoryVariant, string> = {
  location: "text-cat-location border-cat-location/25",
  safety: "text-cat-safety border-cat-safety/25",
  ai: "text-cat-ai border-cat-ai/25",
  report: "text-cat-report border-cat-report/25",
  medical: "text-cat-medical border-cat-medical/25",
  education: "text-cat-education border-cat-education/25",
  community: "text-cat-community border-cat-community/25",
  venue: "text-cat-venue border-cat-venue/25",
  neutral: "text-cat-neutral border-cat-neutral/25",
};

/**
 * Venue type → category. The one mapping every surface uses to break the
 * "identical pale icon tile on every card" pattern while staying cohesive.
 */
const VENUE_TYPE_CATEGORY: Record<string, CategoryVariant> = {
  school: "education",
  coaching: "education",
  clinic: "medical",
  mall: "venue",
  cinema: "venue",
  restaurant: "venue",
  cafe: "venue",
  hotel: "venue",
  office: "venue",
  gym: "venue",
  hall: "community",
  bus_stand: "community",
  park: "location",
  pool: "location",
  construction: "safety",
  other: "neutral",
};

export function venueTypeCategory(type: string): CategoryVariant {
  return VENUE_TYPE_CATEGORY[type] ?? "neutral";
}

/**
 * THE venue-type icon tile — icon + semantic colour in one component.
 * Replaces the old pattern where every surface hand-rolled a pale navy
 * square. Use for venue hero headers, cards, case files and report lists;
 * same icon registry (tokens.VENUE_TYPE_ICONS), same colours everywhere.
 */
export function VenueTypeTile({
  type,
  size = "md",
  className,
}: {
  type: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = VENUE_TYPE_ICONS[type] ?? VENUE_TYPE_ICONS.other;
  return (
    <SemanticIcon icon={Icon} variant={venueTypeCategory(type)} size={size} className={className} />
  );
}

// ---------------------------------------------------------------------------
// SemanticIcon — THE icon tile
// ---------------------------------------------------------------------------

/**
 * One icon tile for the whole app: soft tinted square, dark icon of the
 * same hue, rounded corners on the 8px grid. `size` is the tile side
 * (the icon is ~60% of it, lucide-consistent stroke).
 */
export function SemanticIcon({
  icon: Icon,
  variant = "neutral",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  variant?: CategoryVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims =
    size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-xl" : "h-10 w-10 rounded-lg";
  const glyph = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        dims,
        CATEGORY_TILE[variant],
        className,
      )}
    >
      <Icon className={glyph} aria-hidden />
    </span>
  );
}

// ---------------------------------------------------------------------------
// InfoCard — variant-tinted feature/information card
// ---------------------------------------------------------------------------

/**
 * Reusable information card: semantic icon tile, title, body, optional
 * eyebrow/meta line and optional footer slot. Border + surface, one soft
 * shadow, no hover gymnastics unless `interactive`.
 */
export function InfoCard({
  icon,
  variant = "neutral",
  title,
  meta,
  children,
  footer,
  interactive = false,
  className,
}: {
  icon: LucideIcon;
  variant?: CategoryVariant;
  title: string;
  meta?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-xl border border-edge bg-surface p-5 shadow-card",
        interactive && "transition-all hover:border-navy/30 hover:shadow-card-hover",
        className,
      )}
    >
      <SemanticIcon icon={icon} variant={variant} />
      {meta && (
        <div className={cn("mt-4 text-[11px] font-semibold uppercase tracking-[0.14em]", CATEGORY_TEXT[variant].split(" ")[0])}>
          {meta}
        </div>
      )}
      <h3 className="mt-1.5 text-base font-semibold leading-snug text-ink">{title}</h3>
      {children && <div className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</div>}
      {footer && <div className="mt-4 pt-1">{footer}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeading — editorial rhythm for informational pages
// ---------------------------------------------------------------------------

/**
 * Eyebrow (small caps, category-accented) + display heading + optional
 * lede. `align` mirrors print editorial layouts; default left.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  variant = "neutral",
  align = "left",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  variant?: CategoryVariant;
  align?: "left" | "center";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <div
          className={cn(
            "text-[11px] font-semibold uppercase tracking-[0.18em]",
            CATEGORY_TEXT[variant].split(" ")[0],
          )}
        >
          {eyebrow}
        </div>
      )}
      <Tag className="mt-2 text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
        {title}
      </Tag>
      {lede && (
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{lede}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill — quiet inline label with an icon
// ---------------------------------------------------------------------------

export function Pill({
  icon: Icon = MapPin,
  children,
  variant = "neutral",
  className,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: CategoryVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-xs font-medium",
        CATEGORY_TEXT[variant],
        className,
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </span>
  );
}
