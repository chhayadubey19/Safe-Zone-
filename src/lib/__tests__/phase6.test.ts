import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  CERT_OCR_PROMPT, EXPIRING_SOON_DAYS, certStatus, isCertType, isIsoDate, normalizeCertOcrReply,
} from "../certificates";
import {
  MONSOON_MIN_REPORTS, MONSOON_WINDOW_DAYS, WATERLOGGING_KEYWORDS, computeMonsoonFlag,
  matchesWaterloggingText,
} from "../seasonal";
import { validateOcrPhoto } from "../cert-ocr";
import {
  getDataset, getIncidentQueue, getSeasonalRisks, getVenueDetail, resetDemoOverlay, saveCertificate,
} from "../data";
import { buildSummary } from "../data";
import type { Incident, Report } from "../types";

// ---------------------------------------------------------------------------
// Deterministic demo ids (scripts/seed.ts keeps these stable).
// ---------------------------------------------------------------------------
const XYZ_SCHOOL = "00000000-0000-4000-8000-002000000002"; // 7 waterlogging reports
const PQR_HALL = "00000000-0000-4000-8000-002000000003"; // expired fire NOC story
const ABC = "00000000-0000-4000-8000-002000000001";
const PRISTINE = "00000000-0000-4000-8000-00200000004f"; // Bhopali Adda

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  resetDemoOverlay();
});

// ---------------------------------------------------------------------------
// Feature 1 — certificate status chip boundaries
// ---------------------------------------------------------------------------

describe("Phase 6 — certStatus boundaries (🟢 <60d rule >🔴)", () => {
  const NOW = new Date("2026-09-22T10:30:00");

  test("expiry before today → expired (🔴)", () => {
    expect(certStatus(new Date(NOW.getTime() - 1 * DAY).toISOString().slice(0, 10), NOW)).toBe("expired");
    expect(certStatus("2020-01-01", NOW)).toBe("expired");
  });

  test("expiry yesterday vs today: today is the last valid day (🟡, not 🔴)", () => {
    expect(certStatus(new Date(NOW.getTime() - 1 * DAY).toISOString().slice(0, 10), NOW)).toBe("expired");
    expect(certStatus(new Date(NOW.getTime() + 0 * DAY).toISOString().slice(0, 10), NOW)).toBe("expiring_soon");
  });

  test("0 ≤ expiry < 60 days → expiring soon (🟡)", () => {
    expect(certStatus(new Date(NOW.getTime() + 0 * DAY).toISOString().slice(0, 10), NOW)).toBe("expiring_soon");
    expect(certStatus(new Date(NOW.getTime() + 59 * DAY).toISOString().slice(0, 10), NOW)).toBe("expiring_soon");
  });

  test("expiry exactly 60 days out → still Valid (🟢 — 'expiring soon' is strictly < 60)", () => {
    expect(certStatus(new Date(NOW.getTime() + 60 * DAY).toISOString().slice(0, 10), NOW)).toBe("valid");
    expect(certStatus(new Date(NOW.getTime() + 300 * DAY).toISOString().slice(0, 10), NOW)).toBe("valid");
  });

  test("no / unreadable expiry → unknown", () => {
    expect(certStatus(null, NOW)).toBe("unknown");
    expect(certStatus(undefined, NOW)).toBe("unknown");
    expect(certStatus("", NOW)).toBe("unknown");
    expect(certStatus("not-a-date", NOW)).toBe("unknown");
    expect(certStatus("2026-02-30", NOW)).toBe("unknown"); // calendar-invalid
  });

  test("the window is exactly 60 days per spec", () => {
    expect(EXPIRING_SOON_DAYS).toBe(60);
  });

  test("isIsoDate accepts only strict YYYY-MM-DD", () => {
    expect(isIsoDate("2026-09-22")).toBe(true);
    expect(isIsoDate("2026-9-22")).toBe(false);
    expect(isIsoDate("22-09-2026")).toBe(false);
    expect(isIsoDate("2026-09-22T10:00:00")).toBe(false);
  });

  test("isCertType guards the three allowed types", () => {
    expect(isCertType("fire_noc")).toBe(true);
    expect(isCertType("health_license")).toBe(true);
    expect(isCertType("trade_license")).toBe(true);
    expect(isCertType("fire")).toBe(false);
    expect(isCertType(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Feature 2 — the waterlogging flag rule
// ---------------------------------------------------------------------------

describe("Phase 6 — waterlogging matcher (keywords)", () => {
  test("the spec keyword list is intact", () => {
    expect(WATERLOGGING_KEYWORDS).toEqual([
      "waterlogging", "water logging", "flooding", "flood", "paani", "jaljamav", "जलजमाव", "नाली",
    ]);
  });

  test("every keyword matches (case-insensitive)", () => {
    for (const kw of WATERLOGGING_KEYWORDS) {
      expect(matchesWaterloggingText(`Severe ${kw} reported`)).toBe(true);
      expect(matchesWaterloggingText(`SEVERE ${kw.toUpperCase()} REPORTED`)).toBe(true);
    }
  });

  test("natural report phrasings match", () => {
    expect(matchesWaterloggingText("Severe waterlogging every monsoon at the gate")).toBe(true);
    expect(matchesWaterloggingText("The ground floor floods after every rain")).toBe(true);
    expect(matchesWaterloggingText("नाली is choked and paani reaches ankle height")).toBe(true);
    expect(matchesWaterloggingText("Stagnant jaljamav for days")).toBe(true);
  });

  test("unrelated text never matches", () => {
    expect(matchesWaterloggingText("The campus watering can is missing")).toBe(false);
    expect(matchesWaterloggingText("Extinguisher missing near the staircase")).toBe(false);
    expect(matchesWaterloggingText("")).toBe(false);
    expect(matchesWaterloggingText(null)).toBe(false);
  });
});

const mkReport = (over: Partial<Report>): Report => ({
  id: over.id ?? "r",
  incidentId: over.incidentId ?? null,
  venueId: over.venueId ?? "v-1",
  reporterId: over.reporterId ?? "p-1",
  inputText: over.inputText ?? "",
  photoUrl: null,
  aiLanguage: null,
  aiVision: null,
  confirmed: false,
  lat: null,
  lng: null,
  status: "pending",
  createdAt: over.createdAt ?? iso(Date.now()),
});

const mkIncident = (over: Partial<Incident>): Incident => ({
  id: over.id ?? "i-1",
  venueId: over.venueId ?? "v-1",
  category: "HYGIENE",
  issueKey: "waterlogging",
  title: over.title ?? "Waterlogging in premises",
  severity: "critical",
  status: "open",
  reportCount: 1,
  createdAt: iso(Date.now()),
});

describe("Phase 6 — the monsoon flag rule (≥ 2 matching reports in 12 months)", () => {
  const NOW = new Date("2026-09-22T12:00:00");

  test("1 matching report → NO flag", () => {
    const flag = computeMonsoonFlag(
      "v-1",
      [mkReport({ inputText: "waterlogging at the gate", createdAt: iso(NOW.getTime() - 5 * DAY) })],
      [],
      NOW,
    );
    expect(flag).toBeNull();
  });

  test("2 matching reports → flagged with count + last report date", () => {
    const older = iso(NOW.getTime() - 30 * DAY);
    const newer = iso(NOW.getTime() - 3 * DAY);
    const flag = computeMonsoonFlag(
      "v-1",
      [
        mkReport({ inputText: "waterlogging at the gate", createdAt: older }),
        mkReport({ inputText: "paani everywhere", createdAt: newer }),
      ],
      [],
      NOW,
    );
    expect(flag).toEqual({ venueId: "v-1", reportCount: 2, lastReportAt: newer });
  });

  test("threshold constants per spec", () => {
    expect(MONSOON_MIN_REPORTS).toBe(2);
    expect(MONSOON_WINDOW_DAYS).toBe(365);
  });

  test("reports older than 12 months do not count", () => {
    const ancient = iso(NOW.getTime() - 400 * DAY);
    const flag = computeMonsoonFlag(
      "v-1",
      [
        mkReport({ inputText: "waterlogging", createdAt: ancient }),
        mkReport({ inputText: "flood", createdAt: ancient }),
        mkReport({ inputText: "jaljamav", createdAt: ancient }),
      ],
      [],
      NOW,
    );
    expect(flag).toBeNull();
  });

  test("an exactly-12-months-old report still counts (window is inclusive)", () => {
    const edge = iso(NOW.getTime() - 365 * DAY);
    const flag = computeMonsoonFlag(
      "v-1",
      [
        mkReport({ inputText: "waterlogging", createdAt: edge }),
        mkReport({ inputText: "flood", createdAt: iso(NOW.getTime() - 10 * DAY) }),
      ],
      [],
      NOW,
    );
    expect(flag?.reportCount).toBe(2);
  });

  test("non-matching text alone never flags — even with many reports", () => {
    const flag = computeMonsoonFlag(
      "v-1",
      Array.from({ length: 5 }, (_, i) => mkReport({ inputText: "exhaust fan broken", createdAt: iso(NOW.getTime() - i * DAY) })),
      [],
      NOW,
    );
    expect(flag).toBeNull();
  });

  test("a bare report counts via its incident's title (report/incident text)", () => {
    const flag = computeMonsoonFlag(
      "v-1",
      [
        mkReport({ inputText: "same as before", incidentId: "i-1", createdAt: iso(NOW.getTime() - 2 * DAY) }),
        mkReport({ inputText: "still the same", incidentId: "i-1", createdAt: iso(NOW.getTime() - 1 * DAY) }),
      ],
      [mkIncident({ id: "i-1", title: "Waterlogging in premises" })],
      NOW,
    );
    expect(flag?.reportCount).toBe(2);
  });

  test("only THIS venue's reports count", () => {
    const flag = computeMonsoonFlag(
      "v-1",
      [
        mkReport({ venueId: "v-1", inputText: "waterlogging", createdAt: iso(NOW.getTime() - 5 * DAY) }),
        mkReport({ venueId: "v-2", inputText: "waterlogging", createdAt: iso(NOW.getTime() - 4 * DAY) }),
      ],
      [],
      NOW,
    );
    expect(flag).toBeNull(); // 1 own report + 1 other venue's
  });
});

// ---------------------------------------------------------------------------
// The seeded dataset — both features light up
// ---------------------------------------------------------------------------

describe("Phase 6 — seeded demo data (XYZ School MUST light up)", () => {
  test("XYZ School is flagged with all 7 waterlogging reports", async () => {
    const data = await getDataset();
    const xyz = data.venues.find((v) => v.id === XYZ_SCHOOL)!;
    expect(xyz.name).toBe("XYZ School");
    const reports = data.reports.filter((r) => r.venueId === XYZ_SCHOOL);
    expect(reports).toHaveLength(7);

    const flag = computeMonsoonFlag(
      XYZ_SCHOOL,
      reports,
      data.incidents.filter((i) => i.venueId === XYZ_SCHOOL),
    );
    expect(flag).not.toBeNull();
    expect(flag!.reportCount).toBe(7);
  });

  test("exactly two venues carry the flag (XYZ School + Excel Coaching Classes)", async () => {
    const flagged = await getSeasonalRisks();
    expect(flagged).toHaveLength(2);
    expect(flagged.map((f) => f.name).sort()).toEqual(["Excel Coaching Classes", "XYZ School"]);
    expect(flagged.find((f) => f.name === "XYZ School")!.reportCount).toBe(7);
    expect(flagged.find((f) => f.name === "Excel Coaching Classes")!.reportCount).toBe(2);
  });

  test("the inspection queue carries the Droplets chip on flagged venues only", async () => {
    const queue = await getIncidentQueue();
    const flaggedRows = queue.filter((i) => i.monsoonFlagged);
    expect(flaggedRows.length).toBeGreaterThan(0);
    const flaggedVenues = new Set(flaggedRows.map((i) => i.venueName));
    expect(flaggedVenues).toEqual(new Set(["XYZ School", "Excel Coaching Classes"]));
    // rows for the SAME flagged venue are consistently flagged
    for (const row of queue.filter((i) => i.venueName === "XYZ School")) {
      expect(row.monsoonFlagged).toBe(true);
    }
    for (const row of queue.filter((i) => i.venueName === "ABC Coaching Centre")) {
      expect(row.monsoonFlagged).toBe(false);
    }
  });

  test("seeded certificates: valid / expiring-soon / expired chips derive correctly", async () => {
    const data = await getDataset();
    expect((data.certificates ?? []).length).toBe(6);

    const abc = data.certificates!.find((c) => c.venueId === ABC)!;
    expect(abc.certType).toBe("fire_noc");
    expect(certStatus(abc.expiryDate)).toBe("valid");

    const pqr = data.certificates!.find((c) => c.venueId === PQR_HALL)!;
    expect(pqr.certType).toBe("fire_noc");
    expect(certStatus(pqr.expiryDate)).toBe("expired"); // matches the outdated-fire-equipment story

    const byName = (name: string) => {
      const venue = data.venues.find((v) => v.name === name)!;
      return data.certificates!.find((c) => c.venueId === venue.id)!;
    };
    expect(certStatus(byName("Zenith Academy").expiryDate)).toBe("expiring_soon");
    expect(certStatus(byName("Grand Central Mall").expiryDate)).toBe("valid");
    expect(byName("Grand Central Mall").certType).toBe("health_license");
  });

  test("the venue detail exposes certificates + monsoon for the passport", async () => {
    const xyz = await getVenueDetail(XYZ_SCHOOL);
    expect(xyz!.certificates).toHaveLength(0); // none seeded on XYZ
    expect(xyz!.monsoon).not.toBeNull();
    expect(xyz!.monsoon!.reportCount).toBe(7);

    const pqr = await getVenueDetail(PQR_HALL);
    expect(pqr!.certificates).toHaveLength(1);
    expect(certStatus(pqr!.certificates[0].expiryDate)).toBe("expired");
  });
});

// ---------------------------------------------------------------------------
// saveCertificate — the officer write path (demo overlay)
// ---------------------------------------------------------------------------

describe("Phase 6 — saveCertificate (demo overlay)", () => {
  test("save → the certificate appears on the venue with derived status; risk untouched", async () => {
    const before = await getDataset();
    const riskBefore = buildSummary(before.venues.find((v) => v.id === PRISTINE)!, before).risk.score;

    const outcome = await saveCertificate({
      venueId: PRISTINE,
      certType: "fire_noc",
      certNumber: "MP/FNOC/2026/0001",
      issueDate: "2026-01-10",
      expiryDate: new Date(Date.now() + 120 * DAY).toISOString().slice(0, 10),
      authority: "Directorate of Fire Services, Bhopal",
      photoDataUrl: "data:image/jpeg;base64,AAAA",
    });

    expect(outcome.persisted).toBe("demo");
    expect(outcome.photoUpload).toBe("data-url"); // no service key in tests → inline
    expect(certStatus(outcome.certificate.expiryDate)).toBe("valid");
    expect(outcome.certificate.photoUrl).toBe("data:image/jpeg;base64,AAAA");

    const after = await getVenueDetail(PRISTINE);
    expect(after!.certificates).toHaveLength(1);
    expect(after!.certificates[0].certNumber).toBe("MP/FNOC/2026/0001");
    // Display-only: the risk formula never sees certificates
    const afterData = await getDataset();
    expect(
      buildSummary(afterData.venues.find((v) => v.id === PRISTINE)!, afterData).risk.score,
    ).toBe(riskBefore);
  });

  test("a photo-less certificate saves with photoUpload 'skipped'", async () => {
    const outcome = await saveCertificate({
      venueId: PRISTINE,
      certType: "trade_license",
      certNumber: null,
      issueDate: null,
      expiryDate: null,
      authority: null,
      photoDataUrl: null,
    });
    expect(outcome.photoUpload).toBe("skipped");
    expect(certStatus(outcome.certificate.expiryDate)).toBe("unknown");
  });

  test("invalid cert types are rejected", async () => {
    await expect(
      saveCertificate({
        venueId: PRISTINE,
        // @ts-expect-error deliberately malformed
        certType: "driver_license",
        certNumber: null,
        issueDate: null,
        expiryDate: null,
        authority: null,
        photoDataUrl: null,
      }),
    ).rejects.toThrow(/fire_noc/);
  });

  test("unknown venues are rejected", async () => {
    await expect(
      saveCertificate({
        venueId: "00000000-0000-4000-8000-00ff000000ff",
        certType: "fire_noc",
        certNumber: null,
        issueDate: null,
        expiryDate: null,
        authority: null,
        photoDataUrl: null,
      }),
    ).rejects.toThrow(/venue not found/i);
  });
});

// ---------------------------------------------------------------------------
// OCR route contract — request validation, prompt, reply normalization
// ---------------------------------------------------------------------------

describe("Phase 6 — OCR route contract", () => {
  test("the prompt is verbatim per spec", () => {
    expect(CERT_OCR_PROMPT).toBe(
      'Extract from this Indian safety/compliance certificate image: certificate number, ' +
        "issue date, expiry date, issuing authority. Return ONLY JSON: " +
        '{"cert_number": "...", "issue_date": "YYYY-MM-DD"|null, "expiry_date": "YYYY-MM-DD"|null, ' +
        '"authority": "..."} — null when not clearly readable, NEVER guess.',
    );
  });

  test("validateOcrPhoto: rejects missing / non-data-URL / malformed / oversized payloads", () => {
    expect(validateOcrPhoto(null)).toMatchObject({ ok: false, status: 400 });
    expect(validateOcrPhoto({})).toMatchObject({ ok: false, status: 400 });
    expect(validateOcrPhoto({ photo: "https://example.com/cert.jpg" })).toMatchObject({ ok: false, status: 400 });
    expect(validateOcrPhoto({ photo: "data:image/jpeg" })).toMatchObject({ ok: false, status: 400 }); // no base64
    expect(
      validateOcrPhoto({ photo: `data:image/jpeg;base64,${"A".repeat(8 * 1024 * 1024 + 1)}` }),
    ).toMatchObject({ ok: false, status: 413 });

    const ok = validateOcrPhoto({ photo: "data:image/png;base64,aGVsbG8=" });
    expect(ok).toMatchObject({ ok: true, photo: { mimeType: "image/png", base64: "aGVsbG8=" } });
  });

  test("normalizeCertOcrReply: keeps clean values, nulls anything unclear — NEVER guesses", () => {
    expect(
      normalizeCertOcrReply({
        cert_number: "  MP/FNOC/2024/0812 ",
        issue_date: "2026-05-01",
        expiry_date: "2027-05-01",
        authority: "Directorate of Fire Services",
      }),
    ).toEqual({
      cert_number: "MP/FNOC/2024/0812",
      issue_date: "2026-05-01",
      expiry_date: "2027-05-01",
      authority: "Directorate of Fire Services",
    });

    // unreadable → null; non-YYYY-MM-DD dates → null; empty strings → null
    expect(
      normalizeCertOcrReply({
        cert_number: "",
        issue_date: "01/05/2026",
        expiry_date: "May 2027",
        authority: 42,
      }),
    ).toEqual({ cert_number: null, issue_date: null, expiry_date: null, authority: null });

    expect(normalizeCertOcrReply(null)).toEqual({
      cert_number: null,
      issue_date: null,
      expiry_date: null,
      authority: null,
    });
    expect(normalizeCertOcrReply({ cert_number: 7 })).toEqual({
      cert_number: null,
      issue_date: null,
      expiry_date: null,
      authority: null,
    });
  });
});

describe("Phase 6 — OCR extraction against a stubbed Gemini", () => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = realKey;
  });

  test("no GEMINI_API_KEY → AIError 503 (the UI falls back to manual entry)", async () => {
    delete process.env.GEMINI_API_KEY;
    const { extractCertificateFromPhoto } = await import("../cert-ocr");
    try {
      await extractCertificateFromPhoto({ mimeType: "image/jpeg", base64: "AAAA" });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as { status: number }).status).toBe(503);
    }
  });

  test("a Gemini reply flows through parsing + normalization (fences tolerated)", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const calls: unknown[] = [];
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: '```json\n{"cert_number":"MP/FNOC/2025/0142","issue_date":"2025-02-11","expiry_date":"not readable","authority":"Directorate of Fire Services, Bhopal"}\n```' }] } },
          ],
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const { extractCertificateFromPhoto } = await import("../cert-ocr");
    const fields = await extractCertificateFromPhoto({ mimeType: "image/jpeg", base64: "QUJD" });

    expect(fields).toEqual({
      cert_number: "MP/FNOC/2025/0142",
      issue_date: "2025-02-11",
      expiry_date: null, // garbled → null, NEVER guessed
      authority: "Directorate of Fire Services, Bhopal",
    });

    // the request carried the exact prompt + the inline photo, and the key header
    const body = calls[0] as { contents: { role: string; parts: { text?: string; inline_data?: unknown }[] }[] };
    expect(body.contents[0].parts[0].text).toBe(CERT_OCR_PROMPT);
    expect(body.contents[0].parts[1].inline_data).toEqual({ mime_type: "image/jpeg", data: "QUJD" });
  });
});
