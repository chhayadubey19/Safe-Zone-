import { NextResponse } from "next/server";
import { getCitizenReports, getDataset, resolveDemoPersonas } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/my-reports?reporterId=… — the citizen's own report cards with
 * lifecycle status + timeline (feeds /my-reports). Falls back to the demo
 * citizen persona (same resolution as the header switcher) when no
 * reporterId is given — the demo snapshot id does not exist in live mode,
 * where profile ids were remapped at seed time.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let reporterId = searchParams.get("reporterId");
    if (!reporterId) {
      const data = await getDataset();
      reporterId =
        resolveDemoPersonas(data.profiles).find((p) => p.role === "citizen")?.id ??
        "00000000-0000-4000-8000-001000000001";
    }
    const cards = await getCitizenReports(reporterId);
    return NextResponse.json({
      reports: cards,
      // Phase 4 — the reporter's reputation, for the /my-reports trust badge.
      reporterReputation: cards[0]?.reporterReputation ?? null,
    });
  } catch (err) {
    console.error("[api/my-reports]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load reports" },
      { status: 500 },
    );
  }
}
