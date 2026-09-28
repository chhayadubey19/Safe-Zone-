import { NextResponse } from "next/server";
import { getIncidentCase } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents/[id] — the officer case file for one incident:
 * incident + venue summary, citizen reports, inspections, incident history
 * and the photo evidence gallery (stored URLs).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await getIncidentCase(id);
    if (!result) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/incidents/[id]]", err);
    return NextResponse.json({ error: "Failed to load the case file" }, { status: 500 });
  }
}
