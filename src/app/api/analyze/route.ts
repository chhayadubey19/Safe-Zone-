import { NextResponse } from "next/server";
import { applicableItems, normalizeVenueType, type ItemKey } from "@/lib/checklist";
import { getDataset } from "@/lib/data";
import { AIError, geminiGenerate, parseJsonReply } from "@/lib/gemini";

export const dynamic = "force-dynamic";

/**
 * POST /api/analyze — server-only.
 *
 * Gemini Flash vision assessment of a citizen's camera photo against the
 * SafeZone checklist. The prompt is verbatim per spec; the checklist keys are
 * appended as reference context because the model cannot see checklist.ts.
 * The API key and the photo both stay on the server.
 *
 * Body: { photo: string (data URL), venueId?: string }
 *   When venueId is given, only the keys APPLICABLE to that venue's type are
 *   referenced and accepted — the AI assesses only those.
 */

const PROMPT = `You are a public safety inspection assistant. Analyze this photo from a commercial venue in India. For each item assessable from the image — use the 15 keys from checklist.ts — return pass | fail | not_visible with confidence 0–1. Use not_visible whenever not clearly in frame — NEVER guess. Return ONLY JSON {"items":{"<key>":{"status":"...","confidence":0.0}}}.`;

type VisionStatus = "pass" | "fail" | "not_visible";
const VALID_STATUSES = new Set<VisionStatus>(["pass", "fail", "not_visible"]);

interface VisionReply {
  items?: Record<string, { status?: unknown; confidence?: unknown }>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { photo?: string; venueId?: string }
      | null;
    const photo = body?.photo;

    if (typeof photo !== "string" || !photo.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "photo must be a captured image data URL (data:image/...)" },
        { status: 400 },
      );
    }

    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(photo);
    if (!match) {
      return NextResponse.json({ error: "photo is not a valid base64 data URL" }, { status: 400 });
    }
    const [, mimeType, base64] = match;

    // Hard cap: serverless request bodies are limited (~4.5 MB on Vercel).
    // The client pipeline bounds photos to ~1.8 MB — this is the server-side
    // second gate, returning a clean error instead of a platform 413.
    if (base64.length > 4_000_000) {
      return NextResponse.json(
        { error: "That photo is too large — the app compresses camera photos automatically. Please retake or pick a smaller image." },
        { status: 413 },
      );
    }

    // Restrict the reference keys to the venue's applicable checklist items.
    const referenceItems = await (async () => {
      if (body?.venueId) {
        const data = await getDataset();
        const venue = data.venues.find((v) => v.id === body.venueId);
        if (venue) return applicableItems(normalizeVenueType(venue.type as string));
      }
      return applicableItems("other");
    })();

    const KEY_REFERENCE = `The ${referenceItems.length} checklist keys from checklist.ts applicable to this venue (assess only these keys):
${referenceItems.map((i) => `- ${i.key} — ${i.label}`).join("\n")}`;
    const VALID_ITEM_KEYS = new Set<string>(referenceItems.map((i) => i.key));

    const reply = await geminiGenerate([
      { text: `${PROMPT}\n\n${KEY_REFERENCE}` },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ]);
    const parsed = parseJsonReply<VisionReply>(reply);

    const items: Partial<Record<ItemKey, { status: VisionStatus; confidence: number }>> = {};
    for (const [key, value] of Object.entries(parsed.items ?? {})) {
      if (!VALID_ITEM_KEYS.has(key)) continue; // drop hallucinated / non-applicable keys
      const status = VALID_STATUSES.has(value?.status as VisionStatus)
        ? (value?.status as VisionStatus)
        : "not_visible"; // never guess
      const confidence = Math.min(1, Math.max(0, Number(value?.confidence) || 0));
      items[key as ItemKey] = { status, confidence: Math.round(confidence * 100) / 100 };
    }

    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof AIError) {
      console.error("[api/analyze]", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/analyze]", err);
    return NextResponse.json({ error: "Photo analysis failed" }, { status: 500 });
  }
}
