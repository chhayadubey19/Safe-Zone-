/**
 * Phase 5 spec completion — server-only certificate OCR.
 *
 * Gemini Flash vision extraction of a certificate photo (GEMINI_API_KEY stays
 * on the server — this module is only imported by route handlers). The prompt
 * is verbatim per spec (CERT_OCR_PROMPT in lib/certificates.ts); the reply is
 * normalized to the strict OCR contract (null when not clearly readable,
 * NEVER guessed).
 */

import { CERT_OCR_PROMPT, normalizeCertOcrReply, type CertOcrResult } from "./certificates";
import { geminiGenerate, parseJsonReply } from "./gemini";

export interface OcrPhotoPayload {
  mimeType: string;
  base64: string;
}

/**
 * Validate a request body's photo field (data URL) — shared by the route and
 * the contract tests. Returns the decoded payload or the HTTP error to send.
 */
export function validateOcrPhoto(
  body: unknown,
): { ok: true; photo: OcrPhotoPayload } | { ok: false; status: number; error: string } {
  const parsed = (body ?? {}) as { photo?: unknown };
  if (typeof parsed.photo !== "string" || !parsed.photo.startsWith("data:image/")) {
    return {
      ok: false,
      status: 400,
      error: "photo must be a certificate image data URL (data:image/...)",
    };
  }
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(parsed.photo);
  if (!match) {
    return { ok: false, status: 400, error: "photo is not a valid base64 data URL" };
  }
  const [, mimeType, base64] = match;
  // Hard cap: serverless request bodies are limited (~4.5 MB on Vercel) —
  // reject anything near that boundary with a clean, actionable error.
  if (base64.length > 4_000_000) {
    return {
      ok: false,
      status: 413,
      error: "That photo is too large — camera photos are compressed automatically, so use a smaller image.",
    };
  }
  return { ok: true, photo: { mimeType, base64 } };
}

/** Run the OCR extraction against Gemini and normalize the reply. */
export async function extractCertificateFromPhoto(photo: OcrPhotoPayload): Promise<CertOcrResult> {
  const reply = await geminiGenerate([
    { text: CERT_OCR_PROMPT },
    { inline_data: { mime_type: photo.mimeType, data: photo.base64 } },
  ]);
  return normalizeCertOcrReply(parseJsonReply<unknown>(reply));
}
