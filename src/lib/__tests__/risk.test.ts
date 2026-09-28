import { describe, expect, test } from "bun:test";
import { computeRisk, occupancyWeight, riskTier } from "../risk";
import type { Incident, Report } from "../types";

const DAY = 86_400_000;
const NOW = new Date("2026-09-15T10:00:00.000Z");

const incident = (over: Partial<Incident>): Incident => ({
  id: "inc-1",
  venueId: "v-1",
  category: "FIRE_SAFETY",
  issueKey: "exit_accessibility",
  title: "Emergency exit obstruction",
  severity: "critical",
  status: "open",
  reportCount: 4,
  createdAt: new Date(NOW.getTime() - 12 * DAY).toISOString(),
  ...over,
});

const report = (over: Partial<Report>): Report => ({
  id: "rep-1",
  incidentId: "inc-1",
  venueId: "v-1",
  reporterId: "p-1",
  inputText: "The exit is blocked.",
  photoUrl: null,
  aiLanguage: null,
  aiVision: null,
  confirmed: false,
  lat: 23.24,
  lng: 77.43,
  status: "pending",
  createdAt: new Date(NOW.getTime() - 12 * DAY).toISOString(),
  ...over,
});

// ---------------------------------------------------------------------------
// ABC Coaching Centre, exactly as seeded:
//   1 open critical incident ("Emergency exit obstruction", 4 reports)
//   4 distinct reporters, 2 with photos
//   coaching centre (occupancy weight 1), last inspection 240 days ago
//   → 40 + 32 + 8 + 10 + 36 = 126 → URGENT
// ---------------------------------------------------------------------------
const ABC_VENUE = {
  type: "coaching",
  lastInspectedAt: new Date(NOW.getTime() - 240 * DAY).toISOString(),
};
const ABC_INCIDENTS = [incident({ reportCount: 4 })];
const ABC_REPORTS = [
  report({ id: "r1", reporterId: "p1", photoUrl: "https://x/p1.jpg" }),
  report({ id: "r2", reporterId: "p2", photoUrl: "https://x/p2.jpg" }),
  report({ id: "r3", reporterId: "p3" }),
  report({ id: "r4", reporterId: "p4" }),
];

describe("computeRisk — ABC Coaching Centre", () => {
  const result = computeRisk(ABC_VENUE, ABC_INCIDENTS, ABC_REPORTS, NOW);

  test("computes URGENT with the exact expected score", () => {
    expect(result.score).toBe(126);
    expect(result.tier).toBe("URGENT");
  });

  test("breakdown is explainable and matches the required factors", () => {
    expect(result.breakdown[0]).toBe("1 unresolved critical issue");
    expect(result.breakdown).toContain("4 independent reports");
    expect(result.breakdown).toContain("2 photos attached");
    expect(result.breakdown).toContain("inspection 240 days old");
  });

  test("every point is accounted for in the factors", () => {
    const total = result.factors.reduce((sum, f) => sum + f.points, 0);
    expect(Math.round(total)).toBe(result.score);
  });
});

describe("computeRisk — formula behaviour", () => {
  test("resolved incidents contribute nothing", () => {
    const resolved = computeRisk(
      ABC_VENUE,
      [incident({ status: "resolved" })],
      ABC_REPORTS,
      NOW,
    );
    // 126 − 40 (critical resolved) = 86
    expect(resolved.score).toBe(86);
    expect(resolved.tier).toBe("HIGH");
  });

  test("distinct reporters cap at 5 (XYZ School: 7 reports → 5+)", () => {
    const xyz = computeRisk(
      { type: "school", lastInspectedAt: new Date(NOW.getTime() - 120 * DAY).toISOString() },
      [incident({ severity: "critical", title: "Waterlogging in premises", issueKey: "drainage" })],
      Array.from({ length: 7 }, (_, i) => report({ id: `x${i}`, reporterId: `p${i}` })),
      NOW,
    );
    // 40 (critical) + 40 (5 capped reporters) + 0 photos + 10 (school) + 18 = 108
    expect(xyz.score).toBe(108);
    expect(xyz.tier).toBe("URGENT");
    expect(xyz.breakdown).toContain("5+ independent reports");
  });

  test("never-inspected venue carries no staleness points but discloses it", () => {
    const fresh = computeRisk({ type: "cafe", lastInspectedAt: null }, [], [], NOW);
    expect(fresh.score).toBe(5); // occupancy weight only
    expect(fresh.tier).toBe("INSUFFICIENT_DATA");
    expect(fresh.breakdown).toContain("no inspection on record");
  });

  test("staleness is capped at 400 days", () => {
    const stale = computeRisk(
      { type: "coaching", lastInspectedAt: new Date(NOW.getTime() - 900 * DAY).toISOString() },
      [],
      [],
      NOW,
    );
    expect(stale.score).toBe(70); // 60 (capped staleness) + 10 (coaching)
    expect(stale.breakdown).toContain("inspection 400+ days old");
  });

  test("photos cap at 5", () => {
    const manyPhotos = computeRisk(
      { type: "cafe", lastInspectedAt: null },
      [],
      Array.from({ length: 9 }, (_, i) => report({ id: `p${i}`, reporterId: `r${i}`, photoUrl: `https://x/${i}.jpg` })),
      NOW,
    );
    // 9 distinct reporters → 40, photos capped → 20, cafe → 5 = 65
    expect(manyPhotos.score).toBe(65);
  });
});

describe("riskTier boundaries", () => {
  test.each([
    [100, "URGENT"],
    [99, "HIGH"],
    [60, "HIGH"],
    [59, "NEEDS_VERIFICATION"],
    [25, "NEEDS_VERIFICATION"],
    [24, "INSUFFICIENT_DATA"],
    [0, "INSUFFICIENT_DATA"],
  ] as const)("score %d → %s", (score, tier) => {
    expect(riskTier(score)).toBe(tier);
  });
});

describe("occupancyWeight", () => {
  test.each([
    ["coaching", 1],
    ["school", 1],
    ["mall", 0.8],
    ["gym", 0.8],
    ["hall", 0.8],
    ["cafe", 0.5],
    ["unknown", 0.5],
  ] as const)("%s → %d", (type, weight) => {
    expect(occupancyWeight(type)).toBe(weight);
  });
});
