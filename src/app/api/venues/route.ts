import { NextResponse } from "next/server";
import { getVenueSummaries } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const venues = await getVenueSummaries();
    return NextResponse.json({
      source: isSupabaseConfigured ? "supabase" : "demo",
      count: venues.length,
      venues,
    });
  } catch (err) {
    console.error("[api/venues]", err);
    return NextResponse.json({ error: "Failed to load venues" }, { status: 500 });
  }
}
