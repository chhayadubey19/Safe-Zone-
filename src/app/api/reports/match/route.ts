import { NextResponse } from "next/server";
import { findIncidentMatch } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * POST /api/reports/match — Phase 4 dedup.
 *
 * Match a not-yet-filed report against the venue's UNRESOLVED incidents:
 * same issue_key OR complaint-text token overlap > 0.5. Feeds the
 * confirm-screen banner ("Possible existing issue found — N similar reports
 * at this location."); never files anything.
 *
 * Body: { venueId: string, issueKey?: string | null, text?: string | null }
 * Response: { match: { incidentId, title, reportCount, matchedBy, similarity } | null }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      venueId?: string;
      issueKey?: string | null;
      text?: string | null;
    };
    if (!body.venueId) {
      return NextResponse.json({ error: "venueId is required" }, { status: 400 });
    }
    const match = await findIncidentMatch(body.venueId, {
      issueKey: body.issueKey ?? null,
      text: typeof body.text === "string" ? body.text : null,
    });
    return NextResponse.json({ match });
  } catch (err) {
    console.error("[api/reports/match]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to match incidents" },
      { status: 500 },
    );
  }
}
