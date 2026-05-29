-- =====================================================================
--  TotalFlo Jobs — Supabase schema
--  Run this in the Supabase SQL editor (Project → SQL Editor → New query).
--  Safe to re-run: uses "if not exists" / "drop policy if exists".
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
--  CLIENTS  (imported from your CSV)
-- ---------------------------------------------------------------------
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  contact_name  text,
  contact_phone text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz default now()
);
create index if not exists clients_name_idx    on clients (lower(name));
create index if not exists clients_address_idx on clients (lower(address));

-- ---------------------------------------------------------------------
--  EMPLOYEES  (the pool a manager picks crew members from)
-- ---------------------------------------------------------------------
create table if not exists employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean default true,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
--  CREWS  (1-20 persistent roster; 1-7 are mowing crews)
--  members is a JSON array of names, e.g. ["Andres","Junie"]
-- ---------------------------------------------------------------------
create table if not exists crews (
  crew_number  int primary key check (crew_number between 1 and 20),
  truck_number text,
  members      jsonb default '[]'::jsonb,
  updated_at   timestamptz default now()
);
-- seed the 20 crew slots
insert into crews (crew_number)
select g from generate_series(1,20) g
on conflict (crew_number) do nothing;

-- ---------------------------------------------------------------------
--  PROJECTS  (multi-day jobs)
-- ---------------------------------------------------------------------
create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  client_id     uuid references clients(id) on delete set null,
  address       text,
  lat           double precision,
  lng           double precision,
  notes         text,
  contact_name  text,
  contact_phone text,
  crew_number   int,
  truck_number  text,
  members       jsonb default '[]'::jsonb,
  start_date    date,
  end_date      date,
  status        text default 'active',          -- active | complete
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------
--  JOBS  (one row per crew, per day, per stop.
--         Projects expand into one job row per working day.)
-- ---------------------------------------------------------------------
create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  crew_number     int not null,
  date            date not null,
  client_id       uuid references clients(id) on delete set null,
  address         text,
  lat             double precision,
  lng             double precision,
  service_type    text,                          -- "what needs to be done"
  notes           text,
  status          text default 'scheduled',      -- scheduled | in_progress | completed | done_for_today
  is_project      boolean default false,
  project_id      uuid references projects(id) on delete cascade,
  truck_number    text,
  members         jsonb default '[]'::jsonb,
  checklist       jsonb default '{}'::jsonb,      -- {walkthrough,damage,before,after}
  sort_order      int default 0,
  started_at      timestamptz,
  completed_at    timestamptz,
  elapsed_seconds int default 0,
  created_at      timestamptz default now()
);
create index if not exists jobs_date_crew_idx on jobs (date, crew_number);
create index if not exists jobs_status_idx    on jobs (status);
create index if not exists jobs_project_idx   on jobs (project_id);

-- ---------------------------------------------------------------------
--  JOB PHOTOS  (before / after / damage / other)
-- ---------------------------------------------------------------------
create table if not exists job_photos (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid references jobs(id) on delete cascade,
  url        text not null,
  kind       text default 'other',               -- before | after | damage | other
  note       text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
--  PROJECT PHOTOS  (job-site gallery shown in the Projects tab)
-- ---------------------------------------------------------------------
create table if not exists project_photos (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  url        text not null,
  note       text,
  created_at timestamptz default now()
);

-- =====================================================================
--  STORAGE BUCKET for photos
--  (Also do this once in the dashboard: Storage → New bucket → "job-photos" → Public)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('job-photos','job-photos', true)
on conflict (id) do nothing;

-- =====================================================================
--  ROW LEVEL SECURITY
--  This is an INTERNAL tool. Crew login has no password, so the app
--  uses the public anon key. The policies below allow the anon role to
--  read/write these tables. That is fine for a private internal app but
--  means anyone with the anon key + URL can write. To lock down later,
--  switch managers to Supabase Auth and scope policies to authenticated.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['clients','employees','crews','projects','jobs','job_photos','project_photos']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "anon_all_%1$s" on %1$I;', t);
    execute format($p$create policy "anon_all_%1$s" on %1$I for all to anon using (true) with check (true);$p$, t);
    execute format('drop policy if exists "auth_all_%1$s" on %1$I;', t);
    execute format($p$create policy "auth_all_%1$s" on %1$I for all to authenticated using (true) with check (true);$p$, t);
  end loop;
end $$;

-- storage policies (public read, anon write to the job-photos bucket)
drop policy if exists "job_photos_read"   on storage.objects;
drop policy if exists "job_photos_write"  on storage.objects;
drop policy if exists "job_photos_delete" on storage.objects;
create policy "job_photos_read"   on storage.objects for select to public using (bucket_id = 'job-photos');
create policy "job_photos_write"  on storage.objects for insert to anon, authenticated with check (bucket_id = 'job-photos');
create policy "job_photos_delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'job-photos');
