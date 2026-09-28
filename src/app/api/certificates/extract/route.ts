import { NextResponse } from "next/server";
import { extractCertificateFromPhoto, validateOcrPhoto } from "@/lib/cert-ocr";
import { AIError } from "@/lib/gemini";

export const dynamic = "force-dynamic";

/**
 * POST /api/certificates/extract — server-only.
 *
 * Gemini Flash vision OCR of a certificate photo (the officer's upload in the
 * case file). The prompt is verbatim per spec; the officer ALWAYS reviews and
 * edits the extracted fields before anything is saved — this route writes
 * nothing. The API key and the photo both stay on the server.
 *
 * Body: { photo: string (data URL) }
 * 200 → { cert_number, issue_date, expiry_date, authority } — null when not
 *       clearly readable, never guessed
 * 400/413 → bad payload · 503 → no key · 502/504/429 → Gemini failure
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const check = validateOcrPhoto(body);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const fields = await extractCertificateFromPhoto(check.photo);
    return NextResponse.json(fields);
  } catch (err) {
    if (err instanceof AIError) {
      console.error("[api/certificates/extract]", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/certificates/extract]", err);
    return NextResponse.json({ error: "Certificate extraction failed" }, { status: 500 });
  }
}
