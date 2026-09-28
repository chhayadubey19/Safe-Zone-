import { NextResponse } from "next/server";
import { addReport, type ReportInput } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ItemKey } from "@/lib/checklist";

export const dynamic = "force-dynamic";

interface Body {
  venueId?: string;
  itemKey?: string | null;
  title?: string;
  description?: string;
  severity?: "critical" | "minor";
  hasPhoto?: boolean;
  reporterId?: string;
  // /report flow extras (all optional — the classic dialog keeps working)
  photoDataUrl?: string | null;
  aiLanguage?: unknown;
  aiVision?: unknown;
  lat?: number | null;
  lng?: number | null;
  capturedAt?: string | null;
  extraCitizenFails?: string[];
  // Phase 4 dedup — the citizen's choice from the confirm-screen banner
  linkToIncidentId?: string | null;
  forceNewIncident?: boolean;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body.venueId || !body.description?.trim() || !body.title?.trim()) {
      return NextResponse.json(
        { error: "venueId, title and description are required" },
        { status: 400 },
      );
    }

    // reports.reporter_id is a uuid FK → profiles. The "demo-citizen"
    // default only exists for demo mode; in Supabase mode a missing/invalid
    // reporterId would die on the FK with an opaque message — fail fast instead.
    const reporterId = body.reporterId?.trim();
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (isSupabaseConfigured && !UUID_RE.test(reporterId ?? "")) {
      return NextResponse.json(
        { error: "A valid reporterId (persona profile id) is required when Supabase is enabled" },
        { status: 400 },
      );
    }

    // Evidence photo must be a base64 data URL, capped well below body limits.
    const photoDataUrl =
      typeof body.photoDataUrl === "string" && body.photoDataUrl.startsWith("data:image/")
        ? body.photoDataUrl
        : null;
    if (photoDataUrl && photoDataUrl.length > 4_000_000) {
      return NextResponse.json(
        { error: "That photo is too large — the app compresses camera photos automatically. Please retake or pick a smaller image." },
        { status: 413 },
      );
    }

    const input: ReportInput = {
      venueId: body.venueId,
      itemKey: (body.itemKey ?? null) as ItemKey | null,
      title: body.title.trim(),
      description: body.description.trim(),
      severity: body.severity === "critical" ? "critical" : "minor",
      hasPhoto: Boolean(body.hasPhoto) || Boolean(photoDataUrl),
      reporterId: reporterId ?? "demo-citizen",
      photoDataUrl,
      aiLanguage: body.aiLanguage ?? null,
      aiVision: body.aiVision ?? null,
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
      capturedAt: typeof body.capturedAt === "string" ? body.capturedAt : null,
      extraCitizenFails: Array.isArray(body.extraCitizenFails)
        ? body.extraCitizenFails.filter((k): k is string => typeof k === "string")
        : [],
      // Phase 4 — dedup choice (validated uuid-shape; addReport re-validates
      // that the incident exists, belongs to this venue and is unresolved).
      linkToIncidentId:
        typeof body.linkToIncidentId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.linkToIncidentId)
          ? body.linkToIncidentId
          : null,
      forceNewIncident: body.forceNewIncident === true,
    };

    const outcome = await addReport(input);
    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    console.error("[api/reports]", err);
    const message = err instanceof Error ? err.message : "Failed to file report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
