-- ---------------------------------------------------------------------------
-- SafeZone — Phase 4 migration: Trust & Integrity
--
-- Run after migration_phase3.sql. Idempotent, data-preserving (no deletes,
-- no drops, no constraint changes). Safe to re-run.
--
--   1. reports.location_unverified — soft location-honesty flag. Set when a
--      report's geolocation is >200 m from the venue it is filed against.
--      NEVER blocks submission; inspectors see the flag in the case file.
--      (Until this runs, live report inserts fall back gracefully and file
--      without the flag — see data.ts addReport.)
--
--   2. profiles.reputation default 50 — the Phase 4 reporter-trust baseline
--      for any profile created outside the seed.
-- ---------------------------------------------------------------------------

alter table public.reports
  add column if not exists location_unverified boolean not null default false;

comment on column public.reports.location_unverified is
  'Soft flag: report geolocation was >200 m from the venue (set at submit time; never blocks submission; shown to inspectors in the case file).';

alter table public.profiles
  alter column reputation set default 50;
