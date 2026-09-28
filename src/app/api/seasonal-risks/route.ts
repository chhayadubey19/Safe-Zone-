import { NextResponse } from "next/server";
import { getSeasonalRisks } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/seasonal-risks — the /gov Seasonal Risks panel.
 *
 * Rule-based monsoon / waterlogging indicator: venues with ≥ 2 reports in
 * the last 12 months whose text (or their incident's title) mentions any
 * waterlogging keyword. Read-only derived view — no weather API, no disaster
 * prediction, no risk-formula change.
 */
export async function GET() {
  try {
    const venues = await getSeasonalRisks();
    return NextResponse.json({ venues });
  } catch (err) {
    console.error("[api/seasonal-risks]", err);
    return NextResponse.json({ error: "Failed to load seasonal risks" }, { status: 500 });
  }
}
