import { NextResponse } from "next/server";
import { getVenueDetail } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const venue = await getVenueDetail(id);
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
    return NextResponse.json({ venue: venue });
  } catch (err) {
    console.error("[api/venues/:id]", err);
    return NextResponse.json({ error: "Failed to load venue" }, { status: 500 });
  }
}
