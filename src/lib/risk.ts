/**
 * SafeZone risk model — explainable by design.
 *
 *   score = 40 × open_critical
 *         + 12 × open_minor
 *         +  8 × min(distinct_reporters, 5)
 *         +  4 × min(photos, 5)
 *         + 10 × occupancyWeight
 *         +  0.15 × min(days_since_inspection, 400)
 *
 * Tiers (RISK ladder — priority, not trust):
 *   ≥ 100  URGENT
 *   60–99  HIGH
 *   25–59  NEEDS_VERIFICATION
 *   < 25   INSUFFICIENT_DATA
 *
 * A venue that has never been inspected contributes no staleness points: its
 * unknowns surface through "Insufficient data" status and low engagement
 * instead of inflating the risk score. The breakdown still discloses
 * "no inspection on record" so every point stays explainable.
 */

import type { Incident, Report, RiskTier, VenueType } from "./types";

export interface RiskVenue {
  type: VenueType | string;
  /** ISO date of the most recent inspection, or null when never inspected. */
  lastInspectedAt: string | null;
}

export interface RiskFactor {
  label: string;
  points: number;
}

export interface RiskResult {
  score: number;
  tier: RiskTier;
  /** Human-readable explanation, e.g. "inspection 240 days old". */
  breakdown: string[];
  /** Machine-readable factors (label + exact points) for UI display. */
  factors: RiskFactor[];
}

/**
 * Occupancy weight by venue type.
 * coaching/school = 1 (dense child occupancy), mall = 0.8, cafe = 0.5.
 * gym/hall default to 0.8 (large gatherings) — not pinned in the brief.
 */
export function occupancyWeight(type: VenueType | string): number {
  switch (type) {
    case "coaching":
    case "school":
      return 1;
    case "mall":
    case "gym":
    case "hall":
      return 0.8;
    case "cafe":
      return 0.5;
    default:
      return 0.5;
  }
}

export function riskTier(score: number): RiskTier {
  if (score >= 100) return "URGENT";
  if (score >= 60) return "HIGH";
  if (score >= 25) return "NEEDS_VERIFICATION";
  return "INSUFFICIENT_DATA";
}

export function computeRisk(
  venue: RiskVenue,
  incidents: Incident[],
  reports: Report[],
  now: Date = new Date(),
): RiskResult {
  // Unresolved incidents still demand attention (open / verified / action_taken).
  const unresolved = incidents.filter((i) => i.status !== "resolved");
  const openCritical = unresolved.filter((i) => i.severity === "critical").length;
  const openMinor = unresolved.filter((i) => i.severity === "minor").length;

  const distinctReporters = new Set(reports.map((r) => r.reporterId)).size;
  const reportersCapped = Math.min(distinctReporters, 5);

  const photos = reports.filter((r) => Boolean(r.photoUrl)).length;
  const photosCapped = Math.min(photos, 5);

  const weight = occupancyWeight(venue.type);

  const days = venue.lastInspectedAt
    ? Math.floor((now.getTime() - new Date(venue.lastInspectedAt).getTime()) / 86_400_000)
    : null;
  const stalenessDays = days === null ? 0 : Math.min(days, 400);
  const staleness = 0.15 * stalenessDays;

  const score = Math.round(
    40 * openCritical +
      12 * openMinor +
      8 * reportersCapped +
      4 * photosCapped +
      10 * weight +
      staleness,
  );

  const factors: RiskFactor[] = [];
  if (openCritical > 0) {
    factors.push({
      label: `${openCritical} unresolved critical issue${openCritical > 1 ? "s" : ""}`,
      points: 40 * openCritical,
    });
  }
  if (openMinor > 0) {
    factors.push({
      label: `${openMinor} unresolved minor issue${openMinor > 1 ? "s" : ""}`,
      points: 12 * openMinor,
    });
  }
  if (distinctReporters > 0) {
    factors.push({
      label: `${reportersCapped}${distinctReporters > 5 ? "+" : ""} independent report${reportersCapped > 1 ? "s" : ""}`,
      points: 8 * reportersCapped,
    });
  }
  if (photos > 0) {
    factors.push({
      label: `${photosCapped}${photos > 5 ? "+" : ""} photo${photosCapped > 1 ? "s" : ""} attached`,
      points: 4 * photosCapped,
    });
  }
  factors.push({
    label:
      weight >= 1
        ? "high-occupancy venue (children present)"
        : weight >= 0.8
          ? "high-occupancy venue"
          : "low-occupancy venue",
    points: 10 * weight,
  });
  if (days === null) {
    factors.push({ label: "no inspection on record", points: 0 });
  } else {
    factors.push({
      label: `inspection ${stalenessDays}${days > 400 ? "+" : ""} days old`,
      points: Math.round(staleness * 100) / 100,
    });
  }

  return {
    score,
    tier: riskTier(score),
    breakdown: factors.map((f) => f.label),
    factors,
  };
}
