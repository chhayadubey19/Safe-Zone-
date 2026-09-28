"use client";

/**
 * AI-assisted citizen report flow — shared types + display helpers.
 *
 * Flow: /report
 *   Step 1 — capture (camera photo via getUserMedia, camera-app fallback,
 *           optional text)
 *   Step 2 — "AI analyzing…" shimmer while /api/classify + /api/analyze run
 *   Step 3 — confirm: merged, citizen-correctable findings
 *   Step 4 — submit (existing POST /api/reports) → /my-reports/[id]
 */

import type { ItemKey } from "@/lib/checklist";

/** /api/classify response (Gemini Flash). */
export interface Classification {
  category: "FIRE_SAFETY" | "HYGIENE" | "EMERGENCY_PREPAREDNESS" | "PUBLIC_SITE_SAFETY" | "OTHER";
  issue_key: string;
  issue_label: string;
  severity: "CRITICAL" | "MINOR";
  department: "Fire" | "Health" | "Municipal" | "Building";
}

export type VisionStatus = "pass" | "fail" | "not_visible";

/** /api/analyze response (Gemini Flash vision), keyed by checklist item. */
export type VisionItems = Partial<Record<ItemKey, { status: VisionStatus; confidence: number }>>;

export type CallState = "idle" | "running" | "done" | "failed";

/**
 * Human phrases for the confirm banner — "AI detected a possible …".
 * exit_accessibility maps exactly to the spec example:
 * "AI detected a possible blocked emergency exit. Please confirm."
 */
export const FAIL_PHRASES: Record<string, string> = {
  // Fire safety
  fire_extinguisher: "missing or unserviced fire extinguisher",
  emergency_exit: "locked or missing emergency exit",
  kitchen_fire_safety: "unsafe kitchen fire setup",
  // Hygiene
  drinking_water: "unsafe drinking water",
  washroom_cleanliness: "unclean washrooms",
  surface_cleanliness: "unclean surfaces",
  waste_disposal: "poorly managed waste disposal",
  pest_control: "pest activity",
  food_prep_cleanliness: "unsanitary food preparation",
  ventilation: "inadequate ventilation",
  pool_water_hygiene: "poor pool water hygiene",
  biomedical_waste: "mishandled biomedical waste",
  // Emergency preparedness
  exit_accessibility: "blocked emergency exit",
  emergency_lighting: "faulty emergency lighting",
  exit_signage: "poor or missing exit signage",
  evacuation_plan: "missing evacuation plan",
  no_overcrowding: "overcrowding beyond capacity",
  electrical_wiring: "unsafe electrical wiring",
  first_aid: "inadequate first-aid provisions",
  assembly_point: "unmarked assembly point",
  stairwell_clear: "blocked stairwell",
  escalator_elevator_safety: "unsafe escalator or lift",
  emergency_access: "blocked emergency access",
  accessibility: "missing accessibility provisions",
  aisle_clear: "blocked aisles",
  room_emergency_info: "missing room emergency information",
  equipment_condition: "equipment in poor condition",
  floor_trip_hazards: "trip hazards on walkways",
  // Public site safety
  structural_condition: "unsafe structure",
  pathway_condition: "damaged pathways",
  boundary_security: "insecure boundary",
  children_equipment_safety: "unsafe children's equipment",
  public_lighting: "non-functional public lighting",
  walkway_obstruction: "obstructed walkways",
  public_info_signage: "missing public information signage",
  barricading: "unbarricaded worksite",
  warning_signage: "missing warning signage",
  pedestrian_safety: "pedestrians at risk",
  falling_object_risk: "risk of falling objects",
  road_obstruction: "obstructed road or access",
  lifeguard_availability: "no lifeguard on duty",
  pool_barriers: "missing pool barriers",
  rescue_equipment: "missing rescue equipment",
  depth_signage: "missing depth markings",
  other: "safety hazard",
};
