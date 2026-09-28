import { NextResponse } from "next/server";
import {
  applicableItems, normalizeVenueType,
} from "@/lib/checklist";
import { getDataset } from "@/lib/data";
import { AIError, geminiGenerate, parseJsonReply } from "@/lib/gemini";

export const dynamic = "force-dynamic";

/**
 * POST /api/classify — server-only.
 *
 * Classifies a citizen complaint (Hindi / English / mixed) into the SafeZone
 * checklist taxonomy using Gemini Flash. The GEMINI_API_KEY never leaves the
 * server. The prompt below is verbatim per spec; the checklist keys are
 * appended as reference context because the model cannot see checklist.ts.
 *
 * Body: { text: string, venueId?: string }
 *   When venueId is given, the reference list is restricted to the keys
 *   APPLICABLE to that venue's type — the AI classifies only those.
 */

const PROMPT = `You are a public-safety complaint classifier for Indian cities. Input is a citizen complaint in Hindi, English, or mixed. Return ONLY JSON: {"category": "FIRE_SAFETY"|"HYGIENE"|"EMERGENCY_PREPAREDNESS"|"OTHER", "issue_key": "<best match from checklist.ts keys, else 'other'>", "issue_label": "<short English label>", "severity": "CRITICAL"|"MINOR", "department": "Fire"|"Health"|"Municipal"|"Building"}. If unclear: severity MINOR, issue_key "other". Never invent specifics.`;

const VALID_CATEGORIES = new Set(["FIRE_SAFETY", "HYGIENE", "EMERGENCY_PREPAREDNESS", "PUBLIC_SITE_SAFETY", "OTHER"]);
const VALID_DEPARTMENTS = new Set(["Fire", "Health", "Municipal", "Building"]);

interface Classification {
  category: string;
  issue_key: string;
  issue_label: string;
  severity: string;
  department: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { text?: string; venueId?: string }
      | null;
    const text = body?.text?.trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
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

    const KEY_REFERENCE = `The ${referenceItems.length} checklist keys from checklist.ts applicable to this venue (choose issue_key from these, else "other"):
${referenceItems.map((i) => `- ${i.key} — ${i.label} (${i.category}, ${i.severity})`).join("\n")}`;
    const VALID_KEYS = new Set([...referenceItems.map((i) => i.key), "other"]);

    const reply = await geminiGenerate([
      { text: `${PROMPT}\n\n${KEY_REFERENCE}\n\nCitizen complaint:\n${text}` },
    ]);
    const parsed = parseJsonReply<Partial<Classification>>(reply);

    // Defensive normalisation — the model's verdict is a suggestion, never gospel.
    const category = VALID_CATEGORIES.has(String(parsed.category)) ? String(parsed.category) : "OTHER";
    const issue_key = VALID_KEYS.has(String(parsed.issue_key)) ? String(parsed.issue_key) : "other";
    const severity = String(parsed.severity).toUpperCase() === "CRITICAL" ? "CRITICAL" : "MINOR";
    const department = VALID_DEPARTMENTS.has(String(parsed.department)) ? String(parsed.department) : "Municipal";
    const issue_label = String(parsed.issue_label ?? "Safety concern").slice(0, 80) || "Safety concern";

    return NextResponse.json({ category, issue_key, issue_label, severity, department });
  } catch (err) {
    if (err instanceof AIError) {
      console.error("[api/classify]", err.status, err.message);
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/classify]", err);
    return NextResponse.json({ error: "Classification failed" }, { status: 500 });
  }
}
