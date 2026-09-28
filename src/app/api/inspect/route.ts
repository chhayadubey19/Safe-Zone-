import { NextResponse } from "next/server";
import { getInspectorContext, submitInspection } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/inspect?venueId=… — the audit-form context for /gov/inspect/[id]
 * (case header + applicable checklist + open incidents + reporters).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    if (!venueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
    }
    const context = await getInspectorContext(venueId);
    if (!context) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    return NextResponse.json(context);
  } catch (err) {
    console.error("[api/inspect GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load inspection context" },
      { status: 500 },
    );
  }
}

interface Body {
  venueId?: string;
  inspectorId?: string;
  items?: { itemKey?: string; status?: string; photoDataUrl?: string | null }[];
}

/**
 * POST /api/inspect — submit the full safety audit from /gov/inspect/[id].
 * Server-only: writes through the admin client (RLS stays on for real
 * sessions); the inspector persona is a server-side choice, like the citizen
 * persona in POST /api/reports.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.venueId || !body.inspectorId) {
      return NextResponse.json(
        { error: "venueId and inspectorId are required" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "items (the audit results) are required" },
        { status: 400 },
      );
    }

    const items = body.items
      .filter(
        (r): r is { itemKey: string; status: "pass" | "fail" | "not_verified"; photoDataUrl?: string | null } =>
          typeof r?.itemKey === "string" &&
          (r.status === "pass" || r.status === "fail" || r.status === "not_verified"),
      )
      .map((r) => ({
        itemKey: r.itemKey,
        status: r.status,
        photoDataUrl:
          typeof r.photoDataUrl === "string" && r.photoDataUrl.startsWith("data:image/")
            ? r.photoDataUrl
            : null,
      }));

    if (items.length === 0) {
      return NextResponse.json({ error: "no valid audit items" }, { status: 400 });
    }

    // Cap the inline photo payload below the serverless request-body limit
    // (~4.5 MB on Vercel). The client pipeline bounds each photo to ~1.8 MB —
    // this is the server-side second gate across ALL per-item photos.
    const bytes = items.reduce((n, r) => n + (r.photoDataUrl?.length ?? 0), 0);
    if (bytes > 4_000_000) {
      return NextResponse.json(
        { error: "Inspection photos are too large — retake with fewer or smaller photos." },
        { status: 413 },
      );
    }

    const outcome = await submitInspection({
      venueId: body.venueId,
      inspectorId: body.inspectorId,
      items,
    });
    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    console.error("[api/inspect]", err);
    const message = err instanceof Error ? err.message : "Failed to submit inspection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
