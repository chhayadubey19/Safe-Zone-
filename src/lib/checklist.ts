/**
 * SafeZone safety checklist — 15 items across 3 categories.
 *
 * Categories carry lucide-react icon names (resolved in the UI layer so this
 * module stays a pure, React-free dependency used by tests and the seed script).
 */

import type { VenueType } from "./types";

export type { VenueType };

export type CategoryKey =
  | "FIRE_SAFETY"
  | "HYGIENE"
  | "EMERGENCY_PREPAREDNESS";

export type ItemKey =
  | "fire_extinguisher"
  | "emergency_exit"
  | "exit_accessibility"
  | "emergency_lighting"
  | "evacuation_plan"
  | "drinking_water"
  | "washroom_cleanliness"
  | "surface_cleanliness"
  | "waste_disposal"
  | "pest_control"
  | "exit_signage"
  | "first_aid"
  | "assembly_point"
  | "no_overcrowding"
  | "electrical_wiring";

export interface ChecklistItem {
  key: ItemKey;
  category: CategoryKey;
  label: string;
  /** Major items can single-handedly confirm a safety concern. */
  severity: "major" | "minor";
  icon: string;
}

export interface ChecklistCategory {
  key: CategoryKey;
  label: string;
  icon: string;
  items: ChecklistItem[];
}

export const CATEGORIES: ChecklistCategory[] = [
  {
    key: "FIRE_SAFETY",
    label: "Fire Safety",
    icon: "flame",
    items: [
      { key: "fire_extinguisher", category: "FIRE_SAFETY", label: "Fire extinguisher available & serviced", severity: "major", icon: "fire-extinguisher" },
      { key: "emergency_exit", category: "FIRE_SAFETY", label: "Emergency exit present & unlocked", severity: "major", icon: "door-open" },
      { key: "exit_accessibility", category: "FIRE_SAFETY", label: "Exit accessibility (clear, unobstructed)", severity: "major", icon: "accessibility" },
      { key: "emergency_lighting", category: "FIRE_SAFETY", label: "Emergency lighting functional", severity: "minor", icon: "lightbulb" },
      { key: "evacuation_plan", category: "FIRE_SAFETY", label: "Evacuation plan displayed", severity: "minor", icon: "route" },
    ],
  },
  {
    key: "HYGIENE",
    label: "Hygiene",
    icon: "droplets",
    items: [
      { key: "drinking_water", category: "HYGIENE", label: "Drinking water safe", severity: "minor", icon: "glass-water" },
      { key: "washroom_cleanliness", category: "HYGIENE", label: "Washrooms clean", severity: "minor", icon: "toilet" },
      { key: "surface_cleanliness", category: "HYGIENE", label: "Surfaces clean", severity: "minor", icon: "sparkles" },
      { key: "waste_disposal", category: "HYGIENE", label: "Waste disposal managed", severity: "minor", icon: "trash-2" },
      { key: "pest_control", category: "HYGIENE", label: "Pest control current", severity: "minor", icon: "bug" },
    ],
  },
  {
    key: "EMERGENCY_PREPAREDNESS",
    label: "Emergency Preparedness",
    icon: "siren",
    items: [
      { key: "exit_signage", category: "EMERGENCY_PREPAREDNESS", label: "Exit signage visible & lit", severity: "minor", icon: "signpost" },
      { key: "first_aid", category: "EMERGENCY_PREPAREDNESS", label: "First-aid kit stocked", severity: "minor", icon: "cross" },
      { key: "assembly_point", category: "EMERGENCY_PREPAREDNESS", label: "Assembly point marked", severity: "minor", icon: "flag" },
      { key: "no_overcrowding", category: "EMERGENCY_PREPAREDNESS", label: "No overcrowding beyond capacity", severity: "major", icon: "users" },
      { key: "electrical_wiring", category: "EMERGENCY_PREPAREDNESS", label: "Electrical wiring safe", severity: "major", icon: "cable" },
    ],
  },
];

/** Flat list of all 15 checklist items. */
export const CHECKLIST: ChecklistItem[] = CATEGORIES.flatMap((c) => c.items);

export const CHECKLIST_MAP: Record<ItemKey, ChecklistItem> = Object.fromEntries(
  CHECKLIST.map((item) => [item.key, item]),
) as Record<ItemKey, ChecklistItem>;

export const CATEGORY_MAP: Record<CategoryKey, ChecklistCategory> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, ChecklistCategory>;

export const MAJOR_ITEMS: ItemKey[] = CHECKLIST.filter((i) => i.severity === "major").map((i) => i.key);

export function isMajor(itemKey: string): boolean {
  return CHECKLIST_MAP[itemKey as ItemKey]?.severity === "major";
}

// ---------------------------------------------------------------------------
// Venue-type layer — used by the AI report flow (/report) and officer queue.
// The current 15-item checklist applies to every venue type; these helpers
// keep that policy explicit in one place so a per-type checklist can slot in
// later without touching the routes or UI.
// ---------------------------------------------------------------------------

/** The modelled venue types, plus the "other" catch-all. */
export const VENUE_TYPES: VenueType[] = ["cafe", "coaching", "school", "mall", "gym", "hall", "other"];

const MODELLED_TYPES = new Set<string>(VENUE_TYPES.filter((t) => t !== "other"));

/** Map any stored / free-text venue type onto the union; unknown → "other". */
export function normalizeVenueType(type: string): VenueType {
  return MODELLED_TYPES.has(type) ? (type as VenueType) : "other";
}

/** Checklist items that exist for a venue type (all 15 today). */
export function applicableItems(_type: VenueType): ChecklistItem[] {
  return CHECKLIST;
}

/** Keys of `applicableItems` — the reference list the AI classifies against. */
export function applicableKeys(type: VenueType): ItemKey[] {
  return applicableItems(type).map((i) => i.key);
}

/** Whether a checklist item exists for a venue type (all items today). */
export function isApplicable(_item: ChecklistItem, _type: VenueType): boolean {
  return true;
}

/** Whether a checklist category exists for a venue type (all categories today). */
export function hasCategory(_type: VenueType, _category: CategoryKey): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Department routing — which municipal department owns a checklist category.
// Mirrors supabase/migration_departments.sql. The AI classifier also returns a
// department; incidents from the seed derive theirs from the category here.
// ---------------------------------------------------------------------------

export type Department = "Fire" | "Health" | "Municipal" | "Building";

export interface DepartmentMeta {
  label: string;
  department: Department;
  departmentShort: string;
}

export const CATEGORY_META: Record<string, DepartmentMeta> = {
  FIRE_SAFETY: { label: "Fire Safety", department: "Fire", departmentShort: "Fire" },
  HYGIENE: { label: "Hygiene", department: "Health", departmentShort: "Health" },
  EMERGENCY_PREPAREDNESS: { label: "Emergency Preparedness", department: "Municipal", departmentShort: "Mun." },
  PUBLIC_SITE_SAFETY: { label: "Public Site Safety", department: "Municipal", departmentShort: "Mun." },
};

/** Department responsible for a category (default: Municipal). */
export function departmentOf(category: string): Department {
  return CATEGORY_META[category]?.department ?? "Municipal";
}
