/**
 * SafeZone scoring — checklist scores + venue status.
 *
 * Two ladders, never mixed:
 *  - TRUST (source of info): verified / citizen-reported / not-verified.
 *  - RISK  (priority):        urgent / high / verification / insufficient.
 *
 * A citizen-reported critical issue is displayed differently from an
 * inspector-confirmed one: severity ≠ trust.
 */

import { CATEGORIES, isMajor, type CategoryKey } from "./checklist";
import type { ItemState } from "./types";

export const VENUE_STATUSES = [
  "SAFETY CONCERN CONFIRMED",
  "CRITICAL ISSUE REPORTED (unverified)",
  "Some safety information needs verification",
  "All safety checks passing",
  "Insufficient data",
] as const;

export type VenueStatus = (typeof VENUE_STATUSES)[number];

/**
 * Category score on a 0–10 scale:
 * round(passes / total × 10). Items with no recorded state do not count as passes.
 */
export function categoryScore(
  states: ItemState[] | Record<string, ItemState>,
  category: CategoryKey,
): number {
  const total = CATEGORIES.find((c) => c.key === category)?.items.length ?? 0;
  if (total === 0) return 0;

  const byKey = Array.isArray(states)
    ? new Map(states.map((s) => [s.itemKey, s]))
    : new Map(Object.entries(states).map(([k, v]) => [k, v]));

  const items = CATEGORIES.find((c) => c.key === category)!.items;
  const passes = items.filter((item) => byKey.get(item.key)?.status === "pass").length;
  return Math.round((passes / total) * 10);
}

/**
 * Venue status, per the SafeZone rules:
 *
 *  1. Never inspected and no reports (i.e. nothing recorded at all)
 *     → "Insufficient data". A report-only venue is NOT insufficient — its
 *     unverified claims need verification instead.
 *  2. Any MAJOR fail:
 *     - sourced from an inspection  → "SAFETY CONCERN CONFIRMED" (solid red)
 *     - sourced only from citizens  → "CRITICAL ISSUE REPORTED (unverified)"
 *       (amber row + red AlertTriangle — unconfirmed, never solid red)
 *  3. Any remaining fail or not-verified item → "Some safety information
 *     needs verification".
 *  4. Otherwise → "All safety checks passing".
 */
export function venueStatus(itemStates: ItemState[], hasReports: boolean): VenueStatus {
  if (itemStates.length === 0) {
    return hasReports ? "Some safety information needs verification" : "Insufficient data";
  }

  const majorFails = itemStates.filter((s) => s.status === "fail" && isMajor(s.itemKey));
  if (majorFails.length > 0) {
    const confirmedByInspection = majorFails.some((s) => s.source === "inspection");
    return confirmedByInspection
      ? "SAFETY CONCERN CONFIRMED"
      : "CRITICAL ISSUE REPORTED (unverified)";
  }

  if (itemStates.some((s) => s.status === "fail" || s.status === "not_verified")) {
    return "Some safety information needs verification";
  }

  return "All safety checks passing";
}
