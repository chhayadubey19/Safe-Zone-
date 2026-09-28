-- ============================================================================
-- SafeZone — Supabase Storage: public report-photos bucket
--
-- Run AFTER supabase/migration.sql (SQL Editor → paste → Run). Idempotent —
-- safe to run repeatedly and on any existing project. No files, buckets or
-- tables are ever deleted; existing objects are untouched.
--
-- Bucket: report-photos (public read) — citizen evidence photos land at
--   ${venueId}/${timestamp}-${reporterId}.jpg  → reports.photo_url
-- and inspector after-action photos → inspections.after_action_photo_url.
-- The app uploads through the server-side service-role client, so inserts
-- work regardless of storage policies; the policies below additionally
-- allow authenticated clients to insert and owners to delete their objects.
--
-- OWNERSHIP FIELD NOTE
--   The ownership check uses storage.objects.owner_id — the current Supabase
--   Storage schema field (uuid). The legacy owner text column is deprecated
--   and no longer populated for new uploads, so policies keyed on it would
--   silently never match.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do update set public = true;

-- Objects are publicly readable via
-- /storage/v1/object/public/report-photos/<path>
drop policy if exists "report photos are publicly readable" on storage.objects;
create policy "report photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'report-photos');

-- Authenticated users can upload into the bucket.
drop policy if exists "authenticated users can upload report photos" on storage.objects;
create policy "authenticated users can upload report photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos');

-- Owners can delete their own objects (owner_id is the current storage schema
-- field; the legacy owner column is deprecated and stays null on new uploads).
drop policy if exists "owners can delete their own report photos" on storage.objects;
create policy "owners can delete their own report photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'report-photos' and owner_id = auth.uid());
