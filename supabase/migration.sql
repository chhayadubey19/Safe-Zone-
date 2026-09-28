-- ============================================================================
-- SafeZone — Supabase migration
-- Civic safety registry for Bhopal: venues, checklist states, citizen reports,
-- inspections, incident history and reporter feedback.
--
-- RLS summary (per brief):
--   * citizens        → INSERT on reports only (reporter must be self)
--   * inspectors      → write inspections + item_states (source must be 'inspection')
--   * officers        → manage incidents / venues / history, confirm reports
--   * everything      → publicly readable (transparency by design)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text   not null check (role in ('citizen', 'inspector', 'officer')),
  reputation  integer not null default 50 check (reputation between 0 and 100),
  name        text   not null default '',
  created_at  timestamptz not null default now()
);

create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('cafe', 'coaching', 'school', 'mall', 'gym', 'hall')),
  address     text not null default '',
  ward        text not null,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  created_at  timestamptz not null default now()
);

-- Latest recorded state per (venue, checklist item). 15 items per venue max.
-- `source` is the TRUST ladder: 'inspection' (verified) vs 'citizen' (reported).
-- `source` is nullable: 'not_verified' rows carry no source of information.
create table public.item_states (
  venue_id    uuid not null references public.venues (id) on delete cascade,
  item_key    text not null,
  status      text not null check (status in ('pass', 'fail', 'not_verified')),
  source      text check (source in ('inspection', 'citizen')),
  updated_at  timestamptz not null default now(),
  primary key (venue_id, item_key)
);

create table public.incidents (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  category    text not null,
  issue_key   text not null,
  title       text not null,
  severity    text not null check (severity in ('critical', 'minor')),
  status      text not null default 'open' check (status in ('open', 'verified', 'action_taken', 'resolved')),
  report_count integer not null default 1 check (report_count >= 1),
  created_at  timestamptz not null default now()
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents (id) on delete set null,
  venue_id    uuid not null references public.venues (id) on delete cascade,
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  input_text  text not null default '',
  photo_url   text,
  ai_language  jsonb,
  ai_vision    jsonb,
  confirmed   boolean not null default false,
  lat         double precision,
  lng         double precision,
  status      text not null default 'pending' check (status in ('pending', 'confirmed', 'resolved', 'rejected')),
  created_at  timestamptz not null default now()
);

create table public.inspections (
  id                    uuid primary key default gen_random_uuid(),
  venue_id              uuid not null references public.venues (id) on delete cascade,
  inspector_id          uuid not null references public.profiles (id) on delete cascade,
  results               jsonb not null default '{}'::jsonb,
  after_action_photo_url text,
  notice                text,
  created_at            timestamptz not null default now()
);

create table public.history_events (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  incident_id  uuid references public.incidents (id) on delete set null,
  event_type  text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table public.reporter_feedback (
  report_id   uuid primary key references public.reports (id) on delete cascade,
  verdict     text not null check (verdict in ('fixed', 'still_exists')),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index venues_ward_idx      on public.venues (ward);
create index venues_type_idx      on public.venues (type);
create index incidents_venue_idx  on public.incidents (venue_id, status);
create index reports_venue_idx    on public.reports (venue_id);
create index reports_incident_idx on public.reports (incident_id);
create index reports_reporter_idx on public.reports (reporter_id);
create index inspections_venue_idx on public.inspections (venue_id, created_at desc);
create index history_venue_idx    on public.history_events (venue_id, created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger item_states_touch_updated_at
  before update on public.item_states
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.venues            enable row level security;
alter table public.item_states       enable row level security;
alter table public.incidents         enable row level security;
alter table public.reports           enable row level security;
alter table public.inspections       enable row level security;
alter table public.history_events    enable row level security;
alter table public.reporter_feedback enable row level security;

-- Helper: role of the authenticated user (security definer avoids recursive RLS).
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- profiles: public directory; users may update their own row.
create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update using (id = auth.uid());

-- venues: public read; inspectors/officers manage the registry.
create policy "venues are publicly readable"
  on public.venues for select using (true);
create policy "inspectors and officers manage venues"
  on public.venues for all to authenticated
  using (public.my_role() in ('inspector', 'officer'))
  with check (public.my_role() in ('inspector', 'officer'));

-- item_states: public read; ONLY inspectors may write, and only with
-- source = 'inspection' — citizens can never fabricate verified state.
create policy "item_states are publicly readable"
  on public.item_states for select using (true);
create policy "inspectors insert item_states"
  on public.item_states for insert to authenticated
  with check (source = 'inspection' and public.my_role() = 'inspector');
create policy "inspectors update item_states"
  on public.item_states for update to authenticated
  using (public.my_role() = 'inspector');

-- incidents: public read; officers/inspectors manage lifecycle.
create policy "incidents are publicly readable"
  on public.incidents for select using (true);
create policy "officers and inspectors manage incidents"
  on public.incidents for all to authenticated
  using (public.my_role() in ('officer', 'inspector'))
  with check (public.my_role() in ('officer', 'inspector'));

-- reports: public read; citizens insert ONLY here and only as themselves.
create policy "reports are publicly readable"
  on public.reports for select using (true);
create policy "citizens insert their own reports"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.my_role() = 'citizen');
create policy "officers update reports (confirm / resolve)"
  on public.reports for update to authenticated
  using (public.my_role() = 'officer');

-- inspections: public read; inspectors log them as themselves.
create policy "inspections are publicly readable"
  on public.inspections for select using (true);
create policy "inspectors log inspections"
  on public.inspections for insert to authenticated
  with check (inspector_id = auth.uid() and public.my_role() = 'inspector');

-- history_events: public read; officers/inspectors append the audit trail.
create policy "history_events are publicly readable"
  on public.history_events for select using (true);
create policy "officers and inspectors append history events"
  on public.history_events for insert to authenticated
  with check (public.my_role() in ('officer', 'inspector'));

-- reporter_feedback: public read.
-- Brief: "citizens insert reports only" — strictly kept. Feedback verdicts are
-- filed by officers/inspectors relaying the reporter's response; tighten or
-- relax to the report author as product policy evolves.
create policy "reporter_feedback is publicly readable"
  on public.reporter_feedback for select using (true);
create policy "officers and inspectors record reporter feedback"
  on public.reporter_feedback for insert to authenticated
  with check (public.my_role() in ('officer', 'inspector'));
