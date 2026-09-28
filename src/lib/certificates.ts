/**
 * Phase 5 spec completion — Certificate / NOC tracking, PURE logic.
 *
 * Everything here is dependency-free (no Supabase, no Gemini, no React) so it
 * is unit-testable and safe to import from both the server routes and client
 * components. The derived status NEVER enters the risk formula — certificates
 * are display-only compliance metadata.
 */

import type { Certificate } from "./types";

export type CertType = Certificate["certType"];

export const CERT_TYPES: CertType[] = ["fire_noc", "health_license", "trade_license"];

export function isCertType(value: unknown): value is CertType {
  return typeof value === "string" && (CERT_TYPES as string[]).includes(value);
}

/** How many days ahead an expiry stays "expiring soon" (per spec: < 60 days). */
export const EXPIRING_SOON_DAYS = 60;

export type CertStatus = "valid" | "expiring_soon" | "expired" | "unknown";

/**
 * Derive the status chip from expiry_date — the ONLY source of truth:
 *   🟢 valid          expiry ≥ 60 days from today
 *   🟡 expiring_soon  0 ≤ expiry < 60 days from today (boundary: exactly
 *                     60 days out is still Valid — "expiring soon" is
 *                     strictly < 60)
 *   🔴 expired        expiry before today
 *   ⚪ unknown        no expiry date on record
 *
 * Dates are compared calendar-day-wise (YYYY-MM-DD), so a certificate that
 * expires today is on its last valid day (🟡), and one that expired
 * yesterday is 🔴.
 */
export function certStatus(
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): CertStatus {
  if (!expiryDate) return "unknown";
  const expiry = parseIsoDate(expiryDate);
  if (!expiry) return "unknown";
  const today = startOfDay(now);
  const diffDays = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "expired";
  if (diffDays < EXPIRING_SOON_DAYS) return "expiring_soon";
  return "valid";
}

/** Parse a strict YYYY-MM-DD calendar date (no rollover, no timezone drift). */
export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  // JS silently rolls over calendar-invalid input ("2026-02-30" → Mar 2) —
  // a date that round-trips to different components is NOT a real date.
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  return parsed;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** True when the string is a well-formed YYYY-MM-DD calendar date. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && parseIsoDate(value) !== null;
}

// ---------------------------------------------------------------------------
// OCR — the Gemini vision contract
// ---------------------------------------------------------------------------

/**
 * The EXACT extraction prompt sent to Gemini (verbatim per spec). The route
 * appends the certificate photo as inline_data; this text stays the single
 * source of truth so tests can pin it.
 */
export const CERT_OCR_PROMPT =
  'Extract from this Indian safety/compliance certificate image: certificate number, ' +
  "issue date, expiry date, issuing authority. Return ONLY JSON: " +
  '{"cert_number": "...", "issue_date": "YYYY-MM-DD"|null, "expiry_date": "YYYY-MM-DD"|null, ' +
  '"authority": "..."} — null when not clearly readable, NEVER guess.';

/** The shape the OCR route returns (all fields nullable — never guessed). */
export interface CertOcrResult {
  cert_number: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  authority: string | null;
}

/**
 * Normalise the Gemini reply into the OCR contract:
 *   * strings are trimmed; empty → null
 *   * dates must be strict YYYY-MM-DD — anything else (garbled text, another
 *     format the model ignored the instruction on) → null, NEVER guessed
 *   * non-string/non-null types → null
 */
export function normalizeCertOcrReply(raw: unknown): CertOcrResult {
  const src = (raw ?? {}) as Record<string, unknown>;
  return {
    cert_number: cleanString(src.cert_number),
    issue_date: isIsoDate(src.issue_date) ? src.issue_date : null,
    expiry_date: isIsoDate(src.expiry_date) ? src.expiry_date : null,
    authority: cleanString(src.authority),
  };
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
