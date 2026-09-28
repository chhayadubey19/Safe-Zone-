-- ============================================================================
-- SafeZone — venue types alignment migration
--
-- Run AFTER supabase/migration.sql (SQL Editor → paste → Run). Idempotent —
-- safe to run repeatedly and on any existing SafeZone database.
--
-- WHAT THIS DOES
--   Aligns the database's venue-type system with the application's canonical
--   system (src/lib/types.ts → VenueType):
--
--       cafe | coaching | school | mall | gym | hall | other
--
--   "other" is the application's catch-all for venues outside the modelled
--   set (AI classification and free-text venue types fall back to it).
--
-- WHAT THIS DOES *NOT* DO (data safety)
--   * NO DELETE — item_states, reports, incidents and every other table are
--     left untouched. The current checklist (src/lib/checklist.ts) applies
--     all 15 items to every venue type, so every existing item_states row is
--     valid data under the canonical system.
--   * NO checklist key renames or retirements.
--
-- LEGACY VALUE REMAPS (one-time, information-preserving)
--   Earlier draft migrations used different type sets. If your database ran
--   one of them, stray values are folded back onto the canonical set:
--       university → school          (draft v2)
--       restaurant → cafe            (draft v3 had remapped cafe → restaurant)
--       clinic | cinema | hotel | office | bus_stand | park | pool |
--         construction → other        (draft v3-only types, no app equivalent)
--   These UPDATEs are no-ops on a database that never ran those drafts, and
--   converge to the same result when re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fold stray venue-type values onto the canonical set (no rows removed)
-- ----------------------------------------------------------------------------
update public.venues set type = 'school' where type = 'university';
update public.venues set type = 'cafe'   where type = 'restaurant';
update public.venues set type = 'other'  where type in (
  'clinic', 'cinema', 'hotel', 'office', 'bus_stand', 'park', 'pool', 'construction'
);

-- ----------------------------------------------------------------------------
-- 2. Widen the check constraint to the canonical 7 types
--    (drop + re-add makes repeated execution safe; the remaps above guarantee
--     every existing row already satisfies the new constraint)
-- ----------------------------------------------------------------------------
alter table public.venues drop constraint if exists venues_type_check;

alter table public.venues
  add constraint venues_type_check
  check (type in ('cafe', 'coaching', 'school', 'mall', 'gym', 'hall', 'other'));
