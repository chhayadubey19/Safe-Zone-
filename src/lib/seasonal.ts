/**
 * Phase 5 spec completion — Monsoon / waterlogging risk indicator, PURE logic.
 *
 * Rule-based only (no weather API, no disaster prediction):
 *   matcher  report/incident text contains any of the waterlogging keywords
 *   flag     the venue has ≥ 2 matching reports in the last 12 months
 *
 * The flag is DERIVED on read — never stored, never part of the risk formula,
 * never a role/permission change. It surfaces as the amber passport banner,
 * the /gov Seasonal Risks panel and the Droplets chip on queue rows.
 */

import type { Incident, MonsoonFlag, Report } from "./types";

/** Per spec — matched case-insensitively against report + incident text. */
export const WATERLOGGING_KEYWORDS: readonly string[] = [
  "waterlogging",
  "water logging",
  "flooding",
  "flood",
  "paani",
  "jaljamav",
  "जलजमाव",
  "नाली",
];

/** True when the text mentions any waterlogging keyword (case-insensitive). */
export function matchesWaterloggingText(text: string | null | undefined): boolean {
  if (!text) return false;
  const haystack = text.toLowerCase();
  return WATERLOGGING_KEYWORDS.some((kw) => haystack.includes(kw.toLowerCase()));
}

/** A venue is flagged at ≥ 2 matching reports within the window. */
export const MONSOON_MIN_REPORTS = 2;
/** Reports older than 12 months do not count towards the flag. */
export const MONSOON_WINDOW_DAYS = 365;

/**
 * The monsoon flag rule for one venue.
 *
 * A report matches when its own text OR its linked incident's title mentions
 * a keyword ("report/incident text" per spec — a bare report whose incident
 * was titled "Waterlogging in premises" counts even if its own prose drifted).
 * Only reports created within the last 12 months count. Photos, reputation,
 * severity and the risk formula are all irrelevant here — recurrence is the
 * signal, so 2 independent mentions light the flag up.
 */
export function computeMonsoonFlag(
  venueId: string,
  reports: Pick<Report, "venueId" | "inputText" | "incidentId" | "createdAt">[],
  incidents: Pick<Incident, "id" | "title">[],
  now: Date = new Date(),
  opts: { minReports?: number; windowDays?: number } = {},
): MonsoonFlag | null {
  const minReports = opts.minReports ?? MONSOON_MIN_REPORTS;
  const windowMs = (opts.windowDays ?? MONSOON_WINDOW_DAYS) * 86_400_000;

  const titleOf = new Map(incidents.map((i) => [i.id, i.title]));
  const matching: string[] = [];
  for (const r of reports) {
    if (r.venueId !== venueId) continue;
    const created = Date.parse(r.createdAt);
    if (!Number.isFinite(created) || now.getTime() - created > windowMs) continue;
    if (
      matchesWaterloggingText(r.inputText) ||
      matchesWaterloggingText(r.incidentId ? titleOf.get(r.incidentId) : null)
    ) {
      matching.push(r.createdAt);
    }
  }

  if (matching.length < minReports) return null;
  return {
    venueId,
    reportCount: matching.length,
    lastReportAt: matching.sort().at(-1)!,
  };
}
