import { NextResponse } from "next/server";
import { getNotificationsFor, markNotificationsRead } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?recipientId=… — the citizen bell dropdown.
 * POST /api/notifications { recipientId, ids: string[] | "all" } — mark read.
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const recipientId = searchParams.get("recipientId");
    if (!recipientId) {
      return NextResponse.json({ error: "recipientId is required" }, { status: 400 });
    }
    const notifications = await getNotificationsFor(recipientId);
    return NextResponse.json({
      notifications,
      unread: notifications.filter((n) => n.readAt === null).length,
    });
  } catch (err) {
    console.error("[api/notifications GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load notifications" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { recipientId?: string; ids?: string[] | "all" };
    if (!body.recipientId || (body.ids !== "all" && !Array.isArray(body.ids))) {
      return NextResponse.json(
        { error: "recipientId and ids (string[] | 'all') are required" },
        { status: 400 },
      );
    }
    const marked = await markNotificationsRead(body.recipientId, body.ids ?? "all");
    return NextResponse.json({ marked });
  } catch (err) {
    console.error("[api/notifications POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark notifications" },
      { status: 500 },
    );
  }
}
