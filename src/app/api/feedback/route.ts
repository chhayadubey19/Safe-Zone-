import { NextResponse } from "next/server";
import { submitReporterFeedback } from "@/lib/data";

export const dynamic = "force-dynamic";

interface Body {
  reportId?: string;
  verdict?: "fixed" | "still_exists";
}

/**
 * POST /api/feedback — citizen closure verdict on a resolved report.
 * 'still_exists' reopens the incident (status 'open', report_count + 1);
 * 'fixed' records the confirmation ("You helped fix this").
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.reportId || (body.verdict !== "fixed" && body.verdict !== "still_exists")) {
      return NextResponse.json(
        { error: "reportId and verdict ('fixed' | 'still_exists') are required" },
        { status: 400 },
      );
    }

    const outcome = await submitReporterFeedback(body.reportId, body.verdict);
    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    console.error("[api/feedback]", err);
    const message = err instanceof Error ? err.message : "Failed to record feedback";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
