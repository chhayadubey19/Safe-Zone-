import { NextResponse } from "next/server";
import { getIncidentQueue } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/incidents — the officer review queue.
 * Unresolved incidents across the registry, sorted by severity → corroboration
 * → age, each carrying its responsible department (department column or
 * derived from CATEGORY_META).
 */
export async function GET() {
  try {
    const incidents = await getIncidentQueue();
    return NextResponse.json({ count: incidents.length, incidents });
  } catch (err) {
    console.error("[api/incidents]", err);
    return NextResponse.json({ error: "Failed to load the incident queue" }, { status: 500 });
  }
}
