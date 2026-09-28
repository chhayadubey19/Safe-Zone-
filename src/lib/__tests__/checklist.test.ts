import { describe, expect, test } from "bun:test";
import { CATEGORIES, CHECKLIST, MAJOR_ITEMS } from "../checklist";

describe("checklist", () => {
  test("has exactly 15 items across 3 categories", () => {
    expect(CHECKLIST.length).toBe(15);
    expect(CATEGORIES.length).toBe(3);
    expect(CATEGORIES.map((c) => c.items.length)).toEqual([5, 5, 5]);
  });

  test("categories are FIRE_SAFETY / HYGIENE / EMERGENCY_PREPAREDNESS with icons", () => {
    expect(CATEGORIES.map((c) => c.key)).toEqual(["FIRE_SAFETY", "HYGIENE", "EMERGENCY_PREPAREDNESS"]);
    expect(CATEGORIES.map((c) => c.icon)).toEqual(["flame", "droplets", "siren"]);
  });

  test("has 5 major items", () => {
    expect([...MAJOR_ITEMS].sort()).toEqual(
      ["electrical_wiring", "emergency_exit", "exit_accessibility", "fire_extinguisher", "no_overcrowding"],
    );
  });

  test("hygiene items are all minor", () => {
    const hygiene = CATEGORIES.find((c) => c.key === "HYGIENE")!;
    expect(hygiene.items.every((i) => i.severity === "minor")).toBe(true);
  });
});
