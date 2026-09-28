import { NextResponse } from "next/server";
import { submitResolution } from "@/lib/data";

export const dynamic = "force-dynamic";

interface Body {
  venueId?: string;
  inspectorId?: string;
  afterActionPhotoDataUrl?: string | null;
  notice?: string | null;
  reverify?: { itemKey?: string; fixed?: boolean }[];
}

/**
 * POST /api/resolve — the corrective-action step after the audit:
 * after-action photo → report-photos bucket ({venueId}/after-{ts}.jpg →
 * inspections.after_action_photo_url) + notice; incidents verified →
 * action_taken; re-verified failed items → resolved.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.venueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
    }

    const photo =
      typeof body.afterActionPhotoDataUrl === "string" &&
      body.afterActionPhotoDataUrl.startsWith("data:image/")
        ? body.afterActionPhotoDataUrl
        : null;
    if (photo && photo.length > 12_000_000) {
      return NextResponse.json({ error: "after-action photo too large" }, { status: 413 });
    }

    const reverify = (Array.isArray(body.reverify) ? body.reverify : [])
      .filter((r): r is { itemKey: string; fixed: boolean } => typeof r?.itemKey === "string")
      .map((r) => ({ itemKey: r.itemKey, fixed: r.fixed !== false }));

    const notice = typeof body.notice === "string" && body.notice.trim() ? body.notice.trim() : null;

    const outcome = await submitResolution({
      venueId: body.venueId,
      inspectorId: body.inspectorId ?? "00000000-0000-4000-8000-001000000002",
      afterActionPhotoDataUrl: photo,
      notice,
      reverify,
    });
    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    console.error("[api/resolve]", err);
    const message = err instanceof Error ? err.message : "Failed to record resolution";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
