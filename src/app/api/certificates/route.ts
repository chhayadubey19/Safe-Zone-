import { NextResponse } from "next/server";
import { isCertType, isIsoDate } from "@/lib/certificates";
import { getVenueDetail, saveCertificate } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/certificates?venueId=… — the certificates on record for a venue
 * (officer case file list). Returns [] before migration_phase5.sql has run.
 *
 * POST /api/certificates — save an officer-confirmed certificate.
 * The officer has ALREADY reviewed/edited the OCR-extracted fields; this
 * writes the row and uploads the photo to the report-photos bucket at
 * {venueId}/cert-{ts}.jpg. Body:
 *   { venueId, certType, certNumber?, issueDate?, expiryDate?, authority?, photoDataUrl? }
 * Dates must be YYYY-MM-DD or null. Display-only — never touches the risk formula.
 */

export async function GET(req: Request) {
  try {
    const venueId = new URL(req.url).searchParams.get("venueId");
    if (!venueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
    }
    const detail = await getVenueDetail(venueId);
    if (!detail) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    return NextResponse.json({ certificates: detail.certificates });
  } catch (err) {
    console.error("[api/certificates GET]", err);
    return NextResponse.json({ error: "Failed to load certificates" }, { status: 500 });
  }
}

const cleanOptionalString = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

const cleanOptionalDate = (v: unknown): string | null | undefined =>
  v === null || v === "" ? null : isIsoDate(v) ? v : undefined; // undefined = invalid

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      venueId?: unknown;
      certType?: unknown;
      certNumber?: unknown;
      issueDate?: unknown;
      expiryDate?: unknown;
      authority?: unknown;
      photoDataUrl?: unknown;
    } | null;

    if (!body || typeof body.venueId !== "string" || !body.venueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
    }
    if (!isCertType(body.certType)) {
      return NextResponse.json(
        { error: "certType must be one of fire_noc, health_license, trade_license" },
        { status: 400 },
      );
    }
    const issueDate = cleanOptionalDate(body.issueDate);
    const expiryDate = cleanOptionalDate(body.expiryDate);
    if (issueDate === undefined || expiryDate === undefined) {
      return NextResponse.json(
        { error: "issueDate / expiryDate must be valid YYYY-MM-DD dates or null" },
        { status: 400 },
      );
    }
    if (body.photoDataUrl != null && typeof body.photoDataUrl !== "string") {
      return NextResponse.json({ error: "photoDataUrl must be a data URL string or null" }, { status: 400 });
    }

    const outcome = await saveCertificate({
      venueId: body.venueId,
      certType: body.certType,
      certNumber: cleanOptionalString(body.certNumber),
      issueDate,
      expiryDate,
      authority: cleanOptionalString(body.authority),
      photoDataUrl:
        typeof body.photoDataUrl === "string" && body.photoDataUrl.startsWith("data:image/")
          ? body.photoDataUrl
          : null,
    });
    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    console.error("[api/certificates POST]", err);
    const message = err instanceof Error ? err.message : "Failed to save certificate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
