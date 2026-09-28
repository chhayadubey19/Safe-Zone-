-- ============================================================================
-- SafeZone — Phase 3 migration: citizen notifications
--
-- Run AFTER supabase/migration.sql (SQL Editor → paste → Run). Idempotent —
-- safe to run repeatedly and on any existing SafeZone database.
--
-- WHAT THIS DOES
--   Creates the notifications table backing the citizen bell icon:
--   inspector inspected your report · action taken · issue resolved.
--   One row per (recipient, event). read_at null = unread.
--
-- WHAT THIS DOES *NOT* DO (data safety)
--   * NO DELETE, DROP TABLE or TRUNCATE on any existing table.
--   * incidents already supports the full lifecycle
--     (open → verified → action_taken → resolved) since migration.sql —
--     no constraint change needed.
--
-- RLS: public read (transparency, same as every other SafeZone table).
-- Writes happen through the server-side service-role client (RLS bypass),
-- the same pattern reports/inspections already use for demo personas.
-- ============================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  body         text,
  report_id    uuid references public.reports (id) on delete set null,
  incident_id  uuid references public.incidents (id) on delete set null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications are publicly readable" on public.notifications;
create policy "notifications are publicly readable"
  on public.notifications for select using (true);
