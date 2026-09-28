import { NextResponse } from "next/server";
import { getReportById, deleteReport, ReportLockedError } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/[id] — one filed report + the venue's current risk summary.
 * Feeds the my-reports confirmation page after the AI-assisted flow.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await getReportById(id);
    if (!result) {
      return NextResponse.json(
        { error: "Report not found — it may have been filed in an earlier demo session." },
        { status: 404 },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/reports/[id]]", err);
    return NextResponse.json({ error: "Failed to load report" }, { status: 500 });
  }
}

/**
 * DELETE /api/reports/[id] — Phase 5 "delete my report" (citizen).
 *
 * Body: { reporterId } — the report must belong to that reporter (the demo
 * persona; SafeZone has no login screen, same as every other write).
 * Rules (see lib/data.ts deleteReport):
 *   • deletable only pre-inspection (incident 'open' + report 'pending')
 *   • linked incident: report_count −1, removed entirely at 0
 *   • evidence photo removed from the report-photos bucket
 *   • venue risk recomputed
 * 409 when the report is locked after inspection (government record).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    let reporterId: string | null = null;
    try {
      const body = (await req.json()) as { reporterId?: string };
      reporterId = body.reporterId ?? null;
    } catch {
      // no / invalid body — handled by the guard below
    }
    if (!reporterId) {
      return NextResponse.json(
        { error: "reporterId is required in the request body." },
        { status: 400 },
      );
    }

    const outcome = await deleteReport(id, reporterId);
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof ReportLockedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Failed to delete report";
    if (/belongs to another reporter/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (/^Report not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    console.error("[api/reports/[id]] DELETE", err);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
