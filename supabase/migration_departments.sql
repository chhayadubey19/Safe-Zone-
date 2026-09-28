-- ============================================================================
-- SafeZone — department routing migration
--
-- Run AFTER supabase/migration.sql (SQL Editor → paste → Run). Idempotent —
-- safe to run repeatedly and on any existing SafeZone database.
--
-- WHAT THIS DOES
--   Adds incidents.department and backfills it with the canonical values the
--   application itself derives (src/lib/checklist.ts → CATEGORY_META):
--
--       FIRE_SAFETY            → 'Fire'
--       HYGIENE                → 'Health'
--       EMERGENCY_PREPAREDNESS → 'Municipal'
--       PUBLIC_SITE_SAFETY     → 'Municipal'   (reserved for future categories)
--
--   These short names are what the UI's department chips render and style,
--   so the stored column and the application never disagree. Earlier draft
--   migrations wrote long names ("Fire Department",
--   "Municipal Corporation (Buildings & Roads)" …) — this backfill normalizes
--   them to the canonical short names.
--
-- WHAT THIS DOES *NOT* DO (data safety)
--   * NO DELETE FROM item_states — the original draft of this migration
--     deleted rows whose item_key was not applicable per venue type, but the
--     current checklist applies all 15 items to every venue type, so that
--     delete would have destroyed valid inspection data. It is removed.
--   * NO DROP TABLE, TRUNCATE, or any removal of existing SafeZone data.
--
--   department is a derived cache of incidents.category (no UI writes it),
--   so re-running the backfill is always safe and converges.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. incidents.department — add if missing, backfill canonically
-- ----------------------------------------------------------------------------
alter table public.incidents add column if not exists department text;

update public.incidents set department = case category
  when 'FIRE_SAFETY' then 'Fire'
  when 'HYGIENE'     then 'Health'
  else 'Municipal'  -- EMERGENCY_PREPAREDNESS + PUBLIC_SITE_SAFETY + legacy values
end;

create index if not exists incidents_department_idx
  on public.incidents (department, status);
