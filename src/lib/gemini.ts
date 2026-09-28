/**
 * Server-only AI client for the citizen-report flow — explicit provider
 * selection, no silent switching.
 *
 *   AI_PROVIDER=gemini  (default) Google Gemini generateContent — the
 *                        production path for Vercel / any standard host.
 *                        Requires GEMINI_API_KEY.
 *   AI_PROVIDER=zai     z-ai-web-dev-sdk (GLM) — for deployment platforms
 *                        that provide the SDK's credentials (e.g. z.ai).
 *                        Selected EXPLICITLY; never auto-falls-back to it,
 *                        because a runtime that cannot initialise the SDK
 *                        must surface a clean error instead of hiding it.
 *
 * Contract for every provider:
 *   - Returns the raw reply text (caller parses with parseJsonReply).
 *   - Throws AIError with a user-safe message + HTTP-ish status on failure.
 *   - The API key and the photo never reach the browser — these helpers are
 *     only imported by route handlers.
 * - Enforces a per-call timeout so the UI can fall back to manual checklist
 *   selection when the model is slow or unavailable.
 */

// Default model: current general-purpose Gemini model ID (verified against
// Google's model lineup — 3.6 Flash took over the high-throughput role from
// 3.5 Flash in 2026). Overridable via GEMINI_MODEL if Google renames it again.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export const AI_TIMEOUT_MS = 25_000;

/** Which provider serves AI requests. Explicit, env-driven, never inferred
 *  from a runtime failure. */
export type AIProviderName = "gemini" | "zai";
export const AI_PROVIDER: AIProviderName =
  process.env.AI_PROVIDER === "zai" ? "zai" : "gemini";

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  error?: { message?: string };
}

/** Call Gemini generateContent. Returns the raw text of the first candidate. */
async function geminiDirect(parts: GeminiPart[], systemHint?: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new AIError("Gemini is not configured (GEMINI_API_KEY missing)", 503);
  }

  let res: Response;
  try {
    res = await fetch(GEMINI_ENDPOINT(GEMINI_MODEL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        ...(systemHint ? { systemInstruction: { parts: [{ text: systemHint }] } } : {}),
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new AIError("Gemini request timed out", 504);
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new AIError("Gemini request was aborted", 504);
    }
    throw new AIError(`Gemini request failed: ${err instanceof Error ? err.message : "unknown"}`, 502);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as GeminiResponse | null;
    const detail = body?.error?.message ?? `HTTP ${res.status}`;
    // Server-side diagnostic (no secrets — status + provider message only).
    console.warn(`[ai:gemini] request failed: HTTP ${res.status} — ${detail}`);
    if (/location is not supported/i.test(detail)) {
      throw new AIError(
        "Gemini is not available from this server's region — the report falls back to manual checklist selection.",
        502,
      );
    }
    if (/API key not valid|API_KEY_INVALID/i.test(detail) || res.status === 401 || res.status === 403) {
      throw new AIError("Gemini rejected the configured API key — check GEMINI_API_KEY.", 502);
    }
    if (res.status === 404 || /not found|not supported/i.test(detail)) {
      throw new AIError(
        `Gemini model "${GEMINI_MODEL}" is unavailable — set GEMINI_MODEL to a current model ID.`,
        502,
      );
    }
    if (res.status === 429) {
      throw new AIError("Gemini is rate-limited right now — please retry in a moment.", 429);
    }
    throw new AIError(`Gemini error: ${detail}`, 502);
  }

  // Defensive parse: if the endpoint (or an intermediary proxy) ever returns
  // a non-JSON body — an SSE stream ("data: {…"), an HTML error page — we
  // raise a clean AIError instead of leaking a raw SyntaxError to the client.
  const data = (await res.json().catch(() => null)) as GeminiResponse | null;
  if (!data) {
    throw new AIError("Gemini returned a non-JSON response (endpoint or proxy mismatch)", 502);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new AIError("Gemini returned an empty response", 502);
  }
  return text;
}

// GLM vision model for the zai provider (proven working via the platform CLI).
// Text chat needs no model (SDK default); vision requires one.
const GLM_VISION_MODEL = process.env.GLM_VISION_MODEL ?? "glm-5v-turbo";

/**
 * z.ai SDK provider (GLM). Server-only, dynamically imported so the bundle
 * never pulls it into client code — and so runtimes that do not provide the
 * SDK's credentials only fail WHEN this provider is explicitly selected,
 * never as a side effect of the default Gemini path.
 */
async function zaiGenerate(parts: GeminiPart[], systemHint?: string): Promise<string> {
  let ZAI: { create: () => Promise<ZaiClient> };
  try {
    const mod = (await import("z-ai-web-dev-sdk")) as unknown as {
      default: { create: () => Promise<ZaiClient> };
    };
    ZAI = mod.default;
  } catch (err) {
    console.warn("[ai:zai] SDK import failed:", err instanceof Error ? err.message : err);
    throw new AIError("The z.ai SDK is not available in this runtime (AI_PROVIDER=zai)", 503);
  }

  let zai: ZaiClient;
  try {
    zai = await ZAI.create();
  } catch (err) {
    console.warn("[ai:zai] SDK initialisation failed:", err instanceof Error ? err.message : err);
    throw new AIError(
      "The z.ai SDK could not initialise in this runtime (no platform credentials) — set AI_PROVIDER=gemini.",
      503,
    );
  }

  const text = [
    ...(systemHint ? [systemHint] : []),
    ...parts.map((p) => p.text ?? ""),
  ].filter(Boolean).join("\n\n");

  const hasImage = parts.some((p) => p.inline_data);
  const content = hasImage
    ? [
        { type: "text", text: text || "Analyze this photo." },
        ...parts
          .filter((p) => p.inline_data)
          .map((p) => ({
            type: "image_url" as const,
            image_url: { url: `data:${p.inline_data!.mime_type};base64,${p.inline_data!.data}` },
          })),
      ]
    : text;

  const messages = [{ role: "user" as const, content }];

  const call = hasImage
    ? zai.chat.completions.createVision({
        model: GLM_VISION_MODEL,
        messages: messages as never[],
        thinking: { type: "disabled" },
      })
    : zai.chat.completions.create({
        messages: messages as never[],
        stream: false,
        thinking: { type: "disabled" },
      });

  // The SDK call takes no abort signal — race it against the same timeout
  // budget the Gemini path uses.
  const res = (await Promise.race([
    call,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new AIError("GLM request timed out", 504)), AI_TIMEOUT_MS),
    ),
  ])) as { choices?: { message?: { content?: string } }[] };

  const reply = res.choices?.[0]?.message?.content ?? "";
  if (!reply.trim()) {
    throw new AIError("GLM returned an empty response", 502);
  }
  return reply;
}

/** Minimal structural type for the dynamically imported SDK client. */
interface ZaiClient {
  chat: {
    completions: {
      create: (body: { messages: unknown[]; stream: false; thinking: { type: string } }) => Promise<unknown>;
      createVision: (body: { model: string; messages: unknown[]; thinking: { type: string } }) => Promise<unknown>;
    };
  };
}

/**
 * Call the selected AI provider. Explicit dispatch — a failing provider
 * surfaces its own clean AIError (the UI then degrades to manual checklist
 * selection); it is NEVER silently retried on the other provider.
 */
export async function geminiGenerate(parts: GeminiPart[], systemHint?: string): Promise<string> {
  return AI_PROVIDER === "zai" ? zaiGenerate(parts, systemHint) : geminiDirect(parts, systemHint);
}

/**
 * Parse JSON out of a model reply. Gemini in JSON mode usually returns clean
 * JSON; a fenced ```json block is tolerated just in case.
 */
export function parseJsonReply<T>(text: string): T {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new AIError("Gemini returned an unparseable response", 502);
  }
}
