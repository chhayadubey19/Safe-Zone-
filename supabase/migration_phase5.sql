-- ============================================================================
-- SafeZone — Phase 5 (spec completion) migration: Certificates / NOC tracking
--
-- Run AFTER supabase/migration.sql (SQL Editor → paste → Run). Idempotent —
-- safe to run repeatedly and on any existing SafeZone database.
--
-- WHAT THIS DOES
--   Creates the `certificates` table backing the venue passport's compliance
--   section: Fire NOC / Health licence / Trade licence per venue, with the
--   certificate number, issue/expiry dates, issuing authority and a photo of
--   the document (report-photos bucket, {venueId}/cert-{timestamp}.jpg).
--   The passport derives the status chip from expiry_date:
--     🟢 Valid · 🟡 Expiring soon (< 60 days) · 🔴 Expired
--
-- WHAT THIS DOES *NOT* DO (data safety)
--   * NO DELETE, DROP TABLE or TRUNCATE on any existing table.
--   * No risk-formula change — certificates are display-only compliance
--     metadata and never enter the risk score.
--
-- RLS (the lesson from the Phase 5 RLS fix):
--   The app writes EXCLUSIVELY through the server-side service-role client
--   (which bypasses RLS) — the browser never talks to Supabase directly and
--   there is no supabase.auth session, so `to authenticated` policies never
--   match app traffic. These permissive policies exist so the table is never
--   a hard-denial for authenticated dashboard/SQL-editor sessions, mirroring
--   the pattern applied to the rest of the registry after the RLS bug fix.
-- ============================================================================

create table if not exists public.certificates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  cert_type   text not null check (cert_type in ('fire_noc', 'health_license', 'trade_license')),
  cert_number text,
  issue_date  date,
  expiry_date date,
  authority   text,
  photo_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists certificates_venue_idx
  on public.certificates (venue_id, created_at desc);

alter table public.certificates enable row level security;

-- Same permissive pattern as the rest of the app after the RLS fix:
-- everything for `authenticated`, with check (true) / using (true).
drop policy if exists "certificates_select_authenticated" on public.certificates;
create policy "certificates_select_authenticated"
  on public.certificates for select
  to authenticated using (true);

drop policy if exists "certificates_insert_authenticated" on public.certificates;
create policy "certificates_insert_authenticated"
  on public.certificates for insert
  to authenticated with check (true);

drop policy if exists "certificates_update_authenticated" on public.certificates;
create policy "certificates_update_authenticated"
  on public.certificates for update
  to authenticated using (true) with check (true);

drop policy if exists "certificates_delete_authenticated" on public.certificates;
create policy "certificates_delete_authenticated"
  on public.certificates for delete
  to authenticated using (true);

-- READ ACCESS for the anon client (added after live verification caught the
-- same class of RLS issue the Phase 5 fix addressed — this time on reads):
-- every other table in the registry is readable by the anon client (public
-- registry design: the citizen passport renders server-side through the anon
-- client when only URL + anon key are configured). The app itself now prefers
-- the service-role client for certificate reads (src/lib/data.ts), so this
-- policy only matters for read-only-live-mode deployments and direct anon
-- REST reads. Idempotent — safe to re-run.
drop policy if exists "certificates_select_anon" on public.certificates;
create policy "certificates_select_anon"
  on public.certificates for select
  to anon using (true);
