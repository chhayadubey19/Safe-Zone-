"use client";

/**
 * Civic Trust — shared display primitives.
 *
 * TWO colour ladders, never mixed:
 *  - TRUST (source of info): verified #16A34A · citizen-reported #F59E0B ·
 *    not-verified = dashed #94A3B8 border chip.
 *  - RISK (priority): urgent #DC2626 · high #EA580C · verification #F59E0B ·
 *    insufficient #94A3B8.
 * Severity ≠ trust: a citizen-reported critical is rendered as an amber row
 * with a RED AlertTriangle (unconfirmed) — never solid red.
 */

import { useState } from "react";
import {
  Accessibility, AlertTriangle, BedDouble, BookOpen, Bug, Building2, Bus, Cable,
  Camera, CheckCircle2, CircleDashed, CircleHelp, Clapperboard, ClipboardCheck,
  Coffee, Cross, DoorOpen, Droplets, Dumbbell, FileText, Flag, Flame,
  FireExtinguisher, GraduationCap, HardHat, HeartPulse, History, Landmark,
  Lightbulb, MapPin, MapPinOff, Megaphone, MessageSquareQuote, Route,
  ShieldAlert, ShieldCheck, ShoppingBag, Signpost, Siren, Sparkles, Toilet,
  Trash2, Trees, Users, Wrench, GlassWater, Clock, Waves, UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskTier } from "@/lib/types";
import type { VenueStatus } from "@/lib/scoring";
import { tr, type StringKey } from "@/lib/i18n";
import { useLang } from "@/hooks/use-lang";

// ---------------------------------------------------------------------------
// Icon registries
// ---------------------------------------------------------------------------

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  droplets: Droplets,
  siren: Siren,
};

export const ITEM_ICONS: Record<string, LucideIcon> = {
  fire_extinguisher: FireExtinguisher,
  emergency_exit: DoorOpen,
  exit_accessibility: Accessibility,
  emergency_lighting: Lightbulb,
  evacuation_plan: Route,
  drinking_water: GlassWater,
  washroom_cleanliness: Toilet,
  surface_cleanliness: Sparkles,
  waste_disposal: Trash2,
  pest_control: Bug,
  exit_signage: Signpost,
  first_aid: Cross,
  assembly_point: Flag,
  no_overcrowding: Users,
  electrical_wiring: Cable,
};

export const VENUE_TYPE_ICONS: Record<string, LucideIcon> = {
  school: GraduationCap,
  coaching: BookOpen,
  gym: Dumbbell,
  clinic: HeartPulse,
  mall: ShoppingBag,
  cinema: Clapperboard,
  restaurant: UtensilsCrossed,
  hotel: BedDouble,
  office: Building2,
  bus_stand: Bus,
  park: Trees,
  pool: Waves,
  construction: HardHat,
  // In-data types outside the spec list — same clean lucide weight.
  cafe: Coffee,
  hall: Building2,
  // The VenueType union's catch-all — venues outside the modelled set
  // (AI classification / un-migrated live rows) must still render an icon.
  other: MapPin,
};

export const EVENT_ICONS: Record<string, LucideIcon> = {
  inspection_completed: ClipboardCheck,
  notice_issued: FileText,
  incident_opened: AlertTriangle,
  report_corroborated: Users,
  action_taken: Wrench,
  incident_resolved: CheckCircle2,
  citizen_report_filed: Megaphone,
  inspection_stale: Clock,
  inspection_pending: Clock,
  feedback_received: MessageSquareQuote,
  // Phase 3 lifecycle transitions
  incident_verified: ShieldCheck,
  incident_reopened: ShieldAlert,
};

export const VENUE_TYPE_LABELS: Record<string, string> = {
  cafe: "Cafe",
  coaching: "Coaching centre",
  school: "School",
  mall: "Mall",
  gym: "Gym",
  hall: "Community hall",
  other: "Other venue",
  // Types outside the current union (AI classification / live rows) —
  // labels kept so no surface ever renders a raw key.
  clinic: "Clinic",
  cinema: "Cinema",
  restaurant: "Restaurant",
  hotel: "Hotel",
  office: "Office",
  bus_stand: "Bus stand",
  park: "Park",
  pool: "Pool",
  construction: "Construction site",
};

/** The types actually present in the data model (filter dropdown order). */
export const FILTERABLE_TYPES: string[] = [
  "cafe", "coaching", "school", "mall", "gym", "hall", "other",
];

/**
 * ONE shared venue-type icon — same icon, same default size (h-5) and colour
 * on every surface: list cards, passport, gov queue, my-reports, audit flow.
 * Call sites may override size/colour for hero contexts (h-6 on page
 * headers); the icon mapping itself is never duplicated anywhere else.
 */
export function VenueTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = VENUE_TYPE_ICONS[type] ?? VENUE_TYPE_ICONS.other;
  return <Icon className={cn("h-5 w-5 text-navy", className)} aria-hidden />;
}

// ---------------------------------------------------------------------------
// RISK ladder — tier badge
// ---------------------------------------------------------------------------

const TIER_STYLES: Record<RiskTier, string> = {
  URGENT: "bg-risk-urgent text-white",
  HIGH: "bg-risk-high text-white",
  NEEDS_VERIFICATION: "bg-risk-verification-soft text-amber-800 border border-risk-verification/50",
  INSUFFICIENT_DATA: "bg-risk-insufficient-soft text-slate-500 border border-dashed border-risk-insufficient",
};

/** Solid-background tiers render their icon in white for contrast. */
const TIER_SOLID: Record<RiskTier, boolean> = {
  URGENT: true,
  HIGH: true,
  NEEDS_VERIFICATION: false,
  INSUFFICIENT_DATA: false,
};

/**
 * THE tier-icon registry — single source of truth for the lucide icon and
 * brand colour of every risk tier on every surface (filter chips, map
 * legend, TierBadge, cards, passport banners). Zero duplicated mappings.
 */
export const TIER_ICON_META: Record<RiskTier, { icon: LucideIcon; color: string }> = {
  URGENT: { icon: Siren, color: "#DC2626" },
  HIGH: { icon: AlertTriangle, color: "#EA580C" },
  NEEDS_VERIFICATION: { icon: ClipboardCheck, color: "#F59E0B" },
  INSUFFICIENT_DATA: { icon: CircleDashed, color: "#94A3B8" },
};

/**
 * ONE shared tier icon — Siren / AlertTriangle / ClipboardCheck /
 * CircleDashed in the tier's brand colour. `color` overrides for contrast
 * on dark surfaces (e.g. white inside solid badges / active filter chips).
 */
export function TierIcon({
  tier,
  className,
  color,
}: {
  tier: RiskTier;
  className?: string;
  color?: string;
}) {
  const { icon: Icon, color: tierColor } = TIER_ICON_META[tier];
  return <Icon className={className} style={{ color: color ?? tierColor }} aria-hidden />;
}

/**
 * Canonical tier names — THE single source of truth for how each risk tier is
 * labelled on every surface (list filters, cards, map legend, badges).
 * Same tier, same name, everywhere — dev, published and shared builds.
 */
export const TIER_DISPLAY: Record<RiskTier, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NEEDS_VERIFICATION: "Verify",
  INSUFFICIENT_DATA: "No data",
};

const TIER_SHORT: Record<RiskTier, string> = {
  URGENT: "URGENT",
  HIGH: "HIGH",
  NEEDS_VERIFICATION: "VERIFY",
  INSUFFICIENT_DATA: "NO DATA",
};

const TIER_LONG: Record<RiskTier, string> = {
  URGENT: "Urgent attention",
  HIGH: "High priority",
  NEEDS_VERIFICATION: "Needs verification",
  INSUFFICIENT_DATA: "Insufficient data",
};

export function TierBadge({
  tier,
  className,
  long = false,
}: {
  tier: RiskTier;
  className?: string;
  long?: boolean;
}) {
  const { lang } = useLang();
  const key: StringKey =
    tier === "URGENT"
      ? "tier_urgent"
      : tier === "HIGH"
        ? "tier_high"
        : tier === "NEEDS_VERIFICATION"
          ? "tier_verify"
          : "tier_no_data";
  return (
    <span
      title={TIER_LONG[tier]}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        TIER_STYLES[tier],
        className,
      )}
    >
      <TierIcon tier={tier} className="h-3 w-3" color={TIER_SOLID[tier] ? "#FFFFFF" : undefined} />
      {long ? TIER_LONG[tier] : lang === "en" ? TIER_SHORT[tier] : tr(lang, key)}
    </span>
  );
}

export const TIER_COLORS: Record<RiskTier, string> = {
  URGENT: "#dc2626",
  HIGH: "#ea580c",
  NEEDS_VERIFICATION: "#f59e0b",
  INSUFFICIENT_DATA: "#94a3b8",
};

// ---------------------------------------------------------------------------
// TRUST ladder — source chips
// ---------------------------------------------------------------------------

export function TrustChip({
  variant,
  className,
  children,
}: {
  variant: "verified" | "citizen" | "not_verified";
  className?: string;
  children?: React.ReactNode;
}) {
  const styles: Record<typeof variant, string> = {
    verified: "bg-trust-verified text-white",
    citizen: "bg-trust-citizen-soft text-amber-800 border border-trust-citizen/60",
    not_verified: "bg-transparent text-slate-500 border border-dashed border-trust-unverified",
  };
  const labels: Record<typeof variant, string> = {
    verified: "Verified",
    citizen: "Citizen-reported",
    not_verified: "Not verified",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[variant],
        className,
      )}
    >
      {children ?? labels[variant]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status banner — the "loud status" on the calm interface
// ---------------------------------------------------------------------------

export function StatusBanner({ status, className }: { status: VenueStatus; className?: string }) {
  const common = "sz-rise flex items-start gap-3 rounded-xl p-4 text-sm font-medium";

  switch (status) {
    case "SAFETY CONCERN CONFIRMED":
      return (
        <div className={cn(common, "bg-risk-urgent text-white", className)} role="alert">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <div className="font-bold uppercase tracking-wide">Safety concern confirmed</div>
            <div className="mt-0.5 text-red-50/90 font-normal">
              Verified by municipal inspection. Follow-up action required.
            </div>
          </div>
        </div>
      );
    case "CRITICAL ISSUE REPORTED (unverified)":
      return (
        <div
          className={cn(common, "bg-trust-citizen-soft text-ink border-l-4 border-risk-urgent", className)}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-risk-urgent" aria-hidden />
          <div>
            <div className="font-bold uppercase tracking-wide">
              Critical issue reported <span className="text-risk-urgent">(unconfirmed)</span>
            </div>
            <div className="mt-0.5 text-ink-muted font-normal">
              Reported by citizens — awaiting inspector verification.
            </div>
          </div>
        </div>
      );
    case "Some safety information needs verification":
      return (
        <div className={cn(common, "bg-risk-verification-soft text-amber-900", className)}>
          <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-risk-verification" aria-hidden />
          <div>
            <div className="font-semibold">Some safety information needs verification</div>
            <div className="mt-0.5 text-amber-800/80 font-normal">
              Unverified items or citizen reports pending follow-up.
            </div>
          </div>
        </div>
      );
    case "All safety checks passing":
      return (
        <div className={cn(common, "bg-trust-verified-soft text-green-900", className)}>
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-trust-verified" aria-hidden />
          <div>
            <div className="font-semibold">All safety checks passing</div>
            <div className="mt-0.5 text-green-800/80 font-normal">No open issues on record.</div>
          </div>
        </div>
      );
    default:
      return (
        <div className={cn(common, "bg-risk-insufficient-soft text-slate-600 border border-dashed border-trust-unverified", className)}>
          <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-trust-unverified" aria-hidden />
          <div>
            <div className="font-semibold">Insufficient data</div>
            <div className="mt-0.5 text-slate-500 font-normal">
              Never inspected — no citizen reports on record.
            </div>
          </div>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Photo evidence — stored URLs (Supabase Storage) and inline data URLs (demo)
// ---------------------------------------------------------------------------

/**
 * Evidence photo with graceful degradation: demo placeholder URLs that no
 * longer resolve (or never did) fall back to a calm "unavailable" tile
 * instead of a broken-image icon.
 */
export function PhotoThumb({
  src,
  alt,
  caption,
  className,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-edge bg-canvas p-2 text-ink-muted",
          className,
        )}
        aria-label={alt}
      >
        <Camera className="h-4 w-4" aria-hidden />
        <span className="px-1 text-center text-[10px] leading-tight">
          {caption ?? "Photo unavailable"}
        </span>
      </div>
    );
  }

  return (
    // Plain <img> on purpose: evidence photos are inline data URLs (demo) or
    // foreign Storage URLs, not assets the Next image optimizer can serve.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn("rounded-xl border border-edge object-cover", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Departments — municipal routing chips (officer queue / case files)
// ---------------------------------------------------------------------------

const DEPARTMENT_STYLES: Record<string, { icon: LucideIcon; className: string }> = {
  Fire: { icon: Flame, className: "border-risk-urgent/30 bg-risk-urgent-soft text-risk-urgent" },
  Health: { icon: HeartPulse, className: "border-trust-verified/30 bg-trust-verified-soft text-green-800" },
  Municipal: { icon: Landmark, className: "border-navy/25 bg-navy-soft text-navy" },
  Building: { icon: Building2, className: "border-risk-verification/40 bg-risk-verification-soft text-amber-800" },
};

export function DepartmentChip({
  department,
  className,
}: {
  department: string;
  className?: string;
}) {
  const { lang } = useLang();
  const meta = DEPARTMENT_STYLES[department] ?? DEPARTMENT_STYLES.Municipal;
  const Icon = meta.icon;
  const label =
    department === "Fire"
      ? tr(lang, "dept_fire")
      : department === "Health"
        ? tr(lang, "dept_health")
        : department === "Building"
          ? tr(lang, "dept_building")
          : tr(lang, "dept_municipal");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Phase 4 — location honesty: the report's geolocation was >200 m from the
 * venue. Shown to inspectors in the case file; never blocks anything.
 */
export function LocationUnverifiedChip({ className }: { className?: string }) {
  return (
    <span
      title="Report geolocation was more than 200 m from the venue"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-dashed border-trust-unverified bg-canvas px-2 py-0.5 text-[11px] font-medium text-slate-500",
        className,
      )}
    >
      <MapPinOff className="h-3 w-3" aria-hidden />
      Location unverified
    </span>
  );
}

// ---------------------------------------------------------------------------
// Phase 5 spec completion — certificates & monsoon chips
// ---------------------------------------------------------------------------

/** Cert-type label keys (i18n-aware everywhere they render). */
export const CERT_TYPE_KEYS: Record<string, StringKey> = {
  fire_noc: "cert_fire_noc",
  health_license: "cert_health_license",
  trade_license: "cert_trade_license",
};

export function CertTypeChip({ certType, className }: { certType: string; className?: string }) {
  const { lang } = useLang();
  const key = CERT_TYPE_KEYS[certType];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-navy/30 bg-navy-soft px-2 py-0.5 text-[11px] font-medium text-navy",
        className,
      )}
    >
      <FileText className="h-3 w-3" aria-hidden />
      {key ? tr(lang, key) : certType}
    </span>
  );
}

/**
 * The derived certificate status chip — 🟢 Valid · 🟡 Expiring soon (<60 d) ·
 * 🔴 Expired (per spec). Derived from expiry_date at render time; never
 * stored, never part of the risk formula.
 */
export function CertStatusChip({
  status,
  className,
}: {
  status: "valid" | "expiring_soon" | "expired" | "unknown";
  className?: string;
}) {
  const { lang } = useLang();
  const meta = {
    valid: {
      label: tr(lang, "cert_valid"),
      cls: "border-trust-verified/40 bg-trust-verified-soft text-green-800",
      dot: "🟢",
    },
    expiring_soon: {
      label: tr(lang, "cert_expiring_soon"),
      cls: "border-risk-verification/50 bg-risk-verification-soft text-amber-800",
      dot: "🟡",
    },
    expired: {
      label: tr(lang, "cert_expired"),
      cls: "border-risk-urgent/40 bg-risk-urgent-soft text-risk-urgent",
      dot: "🔴",
    },
    unknown: {
      label: tr(lang, "cert_unknown_expiry"),
      cls: "border-dashed border-trust-unverified bg-canvas text-slate-500",
      dot: "⚪",
    },
  }[status];
  return (
    <span
      title={status === "expiring_soon" ? "Expiry is less than 60 days away" : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        meta.cls,
        className,
      )}
    >
      <span aria-hidden>{meta.dot}</span>
      {meta.label}
    </span>
  );
}

/** The small Droplets chip on flagged venues in the inspection queue. */
export function MonsoonChip({ className }: { className?: string }) {
  const { lang } = useLang();
  return (
    <span
      title={tr(lang, "monsoon_banner")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-risk-verification/50 bg-risk-verification-soft px-2 py-0.5 text-[11px] font-medium text-amber-800",
        className,
      )}
    >
      <Droplets className="h-3 w-3" aria-hidden />
      {tr(lang, "monsoon_chip")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// History timeline icon
// ---------------------------------------------------------------------------

export function EventIcon({ eventType, className }: { eventType: string; className?: string }) {
  const Icon = EVENT_ICONS[eventType] ?? History;
  return <Icon className={className} aria-hidden />;
}
