import { describe, expect, test } from "bun:test";
import type { ItemState } from "../types";
import { categoryScore, venueStatus } from "../scoring";

const state = (
  itemKey: string,
  status: ItemState["status"],
  source: ItemState["source"],
): ItemState => ({
  venueId: "v-test",
  itemKey,
  status,
  source,
  updatedAt: new Date().toISOString(),
});

// The ABC Coaching Centre checklist, exactly as seeded:
// fire_extinguisher pass · emergency_exit pass · exit_accessibility FAIL (inspection)
// emergency_lighting / evacuation_plan not_verified · hygiene mostly pass · rest pass.
const ABC_STATES: ItemState[] = [
  state("fire_extinguisher", "pass", "inspection"),
  state("emergency_exit", "pass", "inspection"),
  state("exit_accessibility", "fail", "inspection"),
  state("emergency_lighting", "not_verified", null),
  state("evacuation_plan", "not_verified", null),
  state("drinking_water", "pass", "inspection"),
  state("washroom_cleanliness", "pass", "inspection"),
  state("surface_cleanliness", "pass", "inspection"),
  state("waste_disposal", "pass", "inspection"),
  state("pest_control", "not_verified", null),
  state("exit_signage", "pass", "inspection"),
  state("first_aid", "pass", "inspection"),
  state("assembly_point", "pass", "inspection"),
  state("no_overcrowding", "pass", "inspection"),
  state("electrical_wiring", "pass", "inspection"),
];

describe("categoryScore", () => {
  test("ABC Fire Safety scores 4/10 (2 of 5 pass)", () => {
    expect(categoryScore(ABC_STATES, "FIRE_SAFETY")).toBe(4);
  });

  test("ABC Hygiene scores 8/10 (4 of 5 pass)", () => {
    expect(categoryScore(ABC_STATES, "HYGIENE")).toBe(8);
  });

  test("ABC Emergency Preparedness scores 10/10", () => {
    expect(categoryScore(ABC_STATES, "EMERGENCY_PREPAREDNESS")).toBe(10);
  });

  test("empty states score 0 in every category", () => {
    for (const c of ["FIRE_SAFETY", "HYGIENE", "EMERGENCY_PREPAREDNESS"] as const) {
      expect(categoryScore([], c)).toBe(0);
    }
  });

  test("full pass scores 10", () => {
    const allPass = ["fire_extinguisher", "emergency_exit", "exit_accessibility", "emergency_lighting", "evacuation_plan"]
      .map((k) => state(k, "pass", "inspection"));
    expect(categoryScore(allPass, "FIRE_SAFETY")).toBe(10);
  });
});

describe("venueStatus", () => {
  test("inspector-confirmed major fail → SAFETY CONCERN CONFIRMED (solid red)", () => {
    expect(venueStatus(ABC_STATES, true)).toBe("SAFETY CONCERN CONFIRMED");
  });

  test("citizen-only major fail → CRITICAL ISSUE REPORTED (unverified), never confirmed-red", () => {
    const citizenOnly: ItemState[] = [
      state("fire_extinguisher", "pass", "inspection"),
      state("emergency_exit", "fail", "citizen"),
      state("exit_accessibility", "pass", "inspection"),
    ];
    expect(venueStatus(citizenOnly, true)).toBe("CRITICAL ISSUE REPORTED (unverified)");
    expect(venueStatus(citizenOnly, true)).not.toBe("SAFETY CONCERN CONFIRMED");
  });

  test("mixed sources on major fails — inspection evidence wins (confirmed)", () => {
    const mixed: ItemState[] = [
      state("exit_accessibility", "fail", "citizen"),
      state("electrical_wiring", "fail", "inspection"),
    ];
    expect(venueStatus(mixed, true)).toBe("SAFETY CONCERN CONFIRMED");
  });

  test("citizen-major + inspection-minor fails → still unverified-critical (severity ≠ trust)", () => {
    const states: ItemState[] = [
      state("no_overcrowding", "fail", "citizen"),
      state("washroom_cleanliness", "fail", "inspection"),
    ];
    expect(venueStatus(states, true)).toBe("CRITICAL ISSUE REPORTED (unverified)");
  });

  test("minor fails only → needs verification", () => {
    const minor: ItemState[] = [
      state("drinking_water", "pass", "inspection"),
      state("pest_control", "fail", "citizen"),
    ];
    expect(venueStatus(minor, true)).toBe("Some safety information needs verification");
  });

  test("never inspected and no reports → Insufficient data", () => {
    expect(venueStatus([], false)).toBe("Insufficient data");
  });

  test("report-only venue → unverified claims need verification (not 'all passing')", () => {
    expect(venueStatus([], true)).toBe("Some safety information needs verification");
  });

  test("all checks passing → All safety checks passing", () => {
    const allPass: ItemState[] = ABC_STATES.map((s) =>
      s.status === "pass" ? s : { ...s, status: "pass" as const, source: "inspection" as const },
    );
    expect(venueStatus(allPass, false)).toBe("All safety checks passing");
  });
});
