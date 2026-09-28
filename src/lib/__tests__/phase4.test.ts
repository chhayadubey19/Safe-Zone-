import { beforeEach, describe, expect, test } from "bun:test";
import {
  addReport, findIncidentMatch, getDataset, getCitizenReports, resetDemoOverlay, submitInspection,
} from "../data";
import { jaccard, tokenize, findBestMatch, OVERLAP_THRESHOLD, type MatchCandidate } from "../dedup";
import { haversineM, isLocationUnverified, LOCATION_HONESTY_METERS } from "../geo";
import { STRINGS, loadLang, saveLang, tr, LANG_STORAGE_KEY } from "../i18n";

// Deterministic demo ids (scripts/seed.ts keeps these stable).
const ABC = "00000000-0000-4000-8000-002000000001"; // hero venue, URGENT
const CITIZEN = "00000000-0000-4000-8000-001000000001"; // Priya Sharma
const INSPECTOR = "00000000-0000-4000-8000-001000000002"; // R.K. Verma

/** Venue of the citizen's open electrical-wiring report (citizen_fail signal). */
async function citizenWiringVenue(): Promise<string> {
  const data = await getDataset();
  const report = data.reports.find(
    (r) =>
      r.reporterId === CITIZEN &&
      r.incidentId &&
      data.incidents.some((i) => i.id === r.incidentId && i.issueKey === "electrical_wiring" && i.status === "open"),
  );
  return report!.venueId;
}

beforeEach(() => {
  resetDemoOverlay();
});

// ---------------------------------------------------------------------------
// 1. Dedup / incident linking
// ---------------------------------------------------------------------------

describe("Phase 4 — dedup token overlap", () => {
  test("tokenize strips stopwords, punctuation and single characters (en + hi)", () => {
    const tokens = tokenize("The exit is blocked by chairs! का के नहीं exit बंद है");
    expect(tokens).toContain("exit");
    expect(tokens).toContain("blocked");
    expect(tokens).toContain("chairs");
    expect(tokens).toContain("बंद");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("का");
    expect(tokens).not.toContain("नहीं");
    expect(tokens.every((t) => t.length >= 2)).toBe(true);
  });

  test("jaccard: identical = 1, disjoint = 0, overlaps scale", () => {
    expect(jaccard(tokenize("fire exit blocked"), tokenize("fire exit blocked"))).toBe(1);
    expect(jaccard(tokenize("fire exit blocked"), tokenize("washroom tiles stained"))).toBe(0);
    expect(jaccard(tokenize("fire exit blocked"), tokenize("fire exit locked"))).toBeGreaterThan(0.3);
  });

  test("findBestMatch: same issue_key wins; text similarity gates at > 0.5", () => {
    const candidates: MatchCandidate[] = [
      {
        incidentId: "inc-1",
        title: "Fire extinguisher expired",
        issueKey: "fire_extinguisher",
        status: "open",
        reportCount: 3,
        texts: ["The fire extinguisher near the entrance has expired and the needle is in the red zone"],
      },
      {
        incidentId: "inc-2",
        title: "Blocked exit",
        issueKey: "exit_accessibility",
        status: "open",
        reportCount: 1,
        texts: ["The rear exit corridor is used as a storeroom now"],
      },
    ];

    // same issue key matches regardless of wording
    const byKey = findBestMatch(candidates, { issueKey: "fire_extinguisher", text: "something totally different" });
    expect(byKey?.incidentId).toBe("inc-1");
    expect(byKey?.matchedBy).toBe("issue_key");

    // similar text matches even with a different issue selected
    const byText = findBestMatch(candidates, {
      issueKey: "other",
      text: "The fire extinguisher near the entrance is expired — needle sits in the red zone",
    });
    expect(byText?.incidentId).toBe("inc-1");
    expect(byText?.matchedBy).toBe("text");
    expect(byText?.similarity).toBeGreaterThan(OVERLAP_THRESHOLD);

    // dissimilar text, no issue key → no match
    expect(findBestMatch(candidates, { issueKey: "other", text: "Washroom tiles are stained" })).toBeNull();
    // no signals at all → no match
    expect(findBestMatch(candidates, {})).toBeNull();
  });
});

describe("Phase 4 — addReport links similar reports to the existing incident", () => {
  test("second similar report: banner match → link → report_count +1, no new incident", async () => {
    // baseline: unresolved incidents at ABC
    const before = (await getDataset()).incidents.filter((i) => i.venueId === ABC && i.status !== "resolved");
    const text = "The fire extinguisher beside the reception desk has expired and the pressure needle is deep in the red zone";

    // 1st report: no fire_extinguisher incident exists at ABC → creates one
    const first = await addReport({
      venueId: ABC, itemKey: "fire_extinguisher", title: "Fire extinguisher expired",
      description: text, severity: "minor", hasPhoto: false, reporterId: CITIZEN,
    });
    expect(first.persisted).toBe("demo");
    expect(first.createdIncident).toBe(true);

    // dedup lookup now finds it (same issue, and by wording)
    const match = await findIncidentMatch(ABC, { issueKey: "fire_extinguisher", text });
    expect(match?.incidentId).toBe(first.incidentId);
    const matchByText = await findIncidentMatch(ABC, { issueKey: "other", text: `Warning: ${text} please replace` });
    expect(matchByText?.incidentId).toBe(first.incidentId);
    expect(matchByText?.matchedBy).toBe("text");

    // 2nd similar report: citizen confirmed the banner → linked, count bumped
    const beforeCount = (await getDataset()).incidents.find((i) => i.id === first.incidentId)!.reportCount;
    const second = await addReport({
      venueId: ABC, itemKey: "fire_extinguisher", title: "Fire extinguisher expired",
      description: "Fire extinguisher beside the reception desk is expired, pressure needle in the red zone",
      severity: "minor", hasPhoto: false, reporterId: CITIZEN,
      linkToIncidentId: first.incidentId,
    });
    expect(second.createdIncident).toBe(false);
    expect(second.incidentId).toBe(first.incidentId);

    const after = (await getDataset()).incidents.filter((i) => i.venueId === ABC && i.status !== "resolved");
    expect(after.length).toBe(before.length + 1); // exactly one new incident overall
    expect((await getDataset()).incidents.find((i) => i.id === first.incidentId)!.reportCount).toBe(beforeCount + 1);
  });

  test("'different issue' forces a separate incident even with the same issue key", async () => {
    const text = "The first-aid kit on the second floor is empty and unlocked";
    const first = await addReport({
      venueId: ABC, itemKey: "first_aid", title: "First-aid kit empty",
      description: text, severity: "minor", hasPhoto: false, reporterId: CITIZEN,
    });
    expect(first.createdIncident).toBe(true);

    const second = await addReport({
      venueId: ABC, itemKey: "first_aid", title: "Different first-aid problem",
      description: "A different first-aid box near the entrance is also completely unstocked",
      severity: "minor", hasPhoto: false, reporterId: CITIZEN,
      forceNewIncident: true,
    });
    expect(second.createdIncident).toBe(true);
    expect(second.incidentId).not.toBe(first.incidentId);
  });
});

// ---------------------------------------------------------------------------
// 2. Reporter reputation (+5 verified / −10 contradicted)
// ---------------------------------------------------------------------------

describe("Phase 4 — inspection adjusts reporter reputation", () => {
  test("audit confirms the citizen's claim (fail) → +5 (clamped at 100)", async () => {
    const venueId = await citizenWiringVenue();
    const repBefore = (await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation;
    const expected = Math.min(100, repBefore + 5); // schema check: 0–100

    const outcome = await submitInspection({
      venueId,
      inspectorId: INSPECTOR,
      items: [
        { itemKey: "electrical_wiring", status: "fail" }, // confirms the citizen's report
        { itemKey: "fire_extinguisher", status: "pass" },
      ],
    });

    const change = outcome.reputationChanges.find((c) => c.reporterId === CITIZEN);
    expect(change).toBeDefined();
    expect(change!.delta).toBe(expected - repBefore);
    expect(change!.before).toBe(repBefore);

    const after = (await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation;
    expect(after).toBe(expected);

    // the /my-reports cards carry the updated reputation
    const cards = await getCitizenReports(CITIZEN);
    expect(cards[0]?.reporterReputation).toBe(expected);
  });

  test("audit contradicts the citizen's claim (pass on a reported fail) → −10", async () => {
    const venueId = await citizenWiringVenue();
    const repBefore = (await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation;

    const outcome = await submitInspection({
      venueId,
      inspectorId: INSPECTOR,
      items: [
        { itemKey: "electrical_wiring", status: "pass" }, // contradicts the citizen's report
        { itemKey: "fire_extinguisher", status: "pass" },
      ],
    });

    const change = outcome.reputationChanges.find((c) => c.reporterId === CITIZEN);
    expect(change).toBeDefined();
    expect(change!.delta).toBe(-10);

    const after = (await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation;
    expect(after).toBe(repBefore - 10);
  });

  test("'not_verified' neither confirms nor contradicts (no adjustment)", async () => {
    const venueId = await citizenWiringVenue();
    const repBefore = (await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation;

    const outcome = await submitInspection({
      venueId,
      inspectorId: INSPECTOR,
      items: [{ itemKey: "electrical_wiring", status: "not_verified" }],
    });

    expect(outcome.reputationChanges.find((c) => c.reporterId === CITIZEN)).toBeUndefined();
    expect((await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation).toBe(repBefore);
  });

  test("one verification per incident — repeated audits never double-count", async () => {
    const venueId = await citizenWiringVenue();
    const repBefore = (await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation;

    // Repeated audits on the same venue: only the FIRST one has an open
    // incident to verify → exactly one +5, never stacked.
    let adjustments = 0;
    let totalDelta = 0;
    for (let i = 0; i < 12; i++) {
      const outcome = await submitInspection({
        venueId,
        inspectorId: INSPECTOR,
        items: [{ itemKey: "electrical_wiring", status: "fail" }],
      });
      const change = outcome.reputationChanges.find((c) => c.reporterId === CITIZEN);
      if (change) {
        adjustments++;
        totalDelta += change.delta;
      }
    }

    expect(adjustments).toBe(1);
    expect(totalDelta).toBe(Math.min(100, repBefore + 5) - repBefore);
    // the clamp matches the live schema's profiles_reputation_check (0–100)
    expect((await getDataset()).profiles.find((p) => p.id === CITIZEN)!.reputation).toBe(
      Math.min(100, repBefore + 5),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Location honesty (soft flag, never a block)
// ---------------------------------------------------------------------------

describe("Phase 4 — location honesty", () => {
  test("haversine sanity: 1° lat ≈ 111 km; 0.001° ≈ 111 m", () => {
    expect(Math.round(haversineM(23.0, 77.0, 24.0, 77.0) / 1000)).toBe(111);
    expect(haversineM(23.2419, 77.4366, 23.2429, 77.4366)).toBeGreaterThan(100);
    expect(haversineM(23.2419, 77.4366, 23.2419, 77.4366)).toBe(0);
  });

  test("isLocationUnverified gates at 200 m", () => {
    const VENUE = { lat: 23.2419, lng: 77.4366 };
    expect(isLocationUnverified(null, null, VENUE.lat, VENUE.lng)).toBe(false); // no geo → no flag
    expect(isLocationUnverified(23.2419, 77.4366, VENUE.lat, VENUE.lng)).toBe(false); // at the venue
    expect(isLocationUnverified(23.2439, 77.4366, VENUE.lat, VENUE.lng)).toBe(true); // ~222 m → flagged
    expect(isLocationUnverified(23.25, 77.44, VENUE.lat, VENUE.lng)).toBe(true); // > 1 km
    expect(LOCATION_HONESTY_METERS).toBe(200);
  });

  test("far-away report is still filed, flagged; on-site report is not flagged", async () => {
    // ~25 km away from ABC (Bhopal center scatter) — way past 200 m
    const far = await addReport({
      venueId: ABC, itemKey: "first_aid", title: "No first-aid box",
      description: "There is no first-aid box anywhere in the building",
      severity: "minor", hasPhoto: false, reporterId: CITIZEN,
      lat: 23.0, lng: 77.5,
    });
    expect(far.locationUnverified).toBe(true); // flagged, NOT blocked
    const farReport = (await getDataset()).reports.find((r) => r.id === far.reportId);
    expect(farReport?.locationUnverified).toBe(true);

    // at the venue → no flag
    const venueRow = (await getDataset()).venues.find((v) => v.id === ABC)!;
    const near = await addReport({
      venueId: ABC, itemKey: "first_aid", title: "No first-aid box",
      description: "There is no first-aid box anywhere in the building",
      severity: "minor", hasPhoto: false, reporterId: CITIZEN,
      lat: venueRow.lat + 0.0005, lng: venueRow.lng, // ~55 m
    });
    expect(near.locationUnverified).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Hindi toggle persistence
// ---------------------------------------------------------------------------

describe("Phase 4 — language toggle persists", () => {
  test("saveLang/loadLang roundtrip via localStorage", () => {
    const backing = new Map<string, string>();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    };
    try {
      expect(loadLang()).toBe("en"); // default
      saveLang("hi");
      expect(backing.get(LANG_STORAGE_KEY)).toBe("hi");
      expect(loadLang()).toBe("hi");
      saveLang("en");
      expect(loadLang()).toBe("en");
    } finally {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  });

  test("dictionary completeness: every key has non-empty en + hi; core labels covered", () => {
    const entries = Object.entries(STRINGS) as [keyof typeof STRINGS, { en: string; hi: string }][];
    expect(entries.length).toBeGreaterThanOrEqual(20);
    for (const [, v] of entries) {
      expect(v.en.trim().length).toBeGreaterThan(0);
      expect(v.hi.trim().length).toBeGreaterThan(0);
    }
    // the spec's named labels exist
    for (const key of [
      "my_reports", "report_issue", "tier_urgent", "tier_high", "tier_verify", "tier_no_data",
      "status_reported", "status_verified", "status_resolved", "helped_fix",
      "dept_fire", "dept_health", "dept_municipal", "trusted_reporter", "new_reporter",
    ] as const) {
      expect(STRINGS[key]).toBeDefined();
    }
    // tr() falls back to English values and translates Hindi
    expect(tr("en", "helped_fix")).toBe("You helped fix this");
    expect(tr("hi", "helped_fix")).toBe("आपकी मदद से यह ठीक हुआ");
    expect(tr("hi", "tier_urgent")).toBe("अत्यावश्यक");
  });
});
