-- Run this in the Supabase SQL editor before enabling authenticated EcoTwin.
create table if not exists public.campus_issues (
  id text primary key default ('ET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  title text not null check (length(title) between 5 and 120),
  description text not null check (length(description) between 10 and 1000),
  category text not null check (category in ('Water','Electrical','Waste','Grounds','Safety','Other')),
  location text not null check (length(location) between 2 and 160),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','assigned','in_progress','resolved','verified')),
  reporter text not null,
  reporter_id uuid references auth.users(id) on delete set null,
  assignee text,
  assignee_id uuid references auth.users(id) on delete set null,
  evidence jsonb not null default '[]'::jsonb,
  source text not null default 'user' check (source in ('user','demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campus_issues_status_idx on public.campus_issues(status, priority);
create index if not exists campus_issues_reporter_idx on public.campus_issues(reporter_id, created_at desc);
alter table public.campus_issues enable row level security;
-- Table privileges only make these operations available to authenticated users;
-- the row-level policies below still restrict which records they can access.
grant select, insert, update on public.campus_issues to authenticated;

drop policy if exists "Campus roles read authorized issues" on public.campus_issues;
create policy "Campus roles read authorized issues" on public.campus_issues
for select to authenticated using (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or reporter_id = auth.uid()
  or (auth.jwt() -> 'app_metadata' ->> 'role' = 'worker' and (
    assignee = auth.jwt() -> 'app_metadata' ->> 'name'
    or (source = 'user' and status = 'open' and assignee_id is null and assignee is null)
  ))
);
drop policy if exists "Students and admins report issues" on public.campus_issues;
create policy "Students and admins report issues" on public.campus_issues
for insert to authenticated with check (
  reporter_id = auth.uid() and (auth.jwt() -> 'app_metadata' ->> 'role' in ('student','admin'))
);
drop policy if exists "Admins manage issues" on public.campus_issues;
create policy "Admins manage issues" on public.campus_issues
for all to authenticated using (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
with check (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');
drop policy if exists "Assigned workers update their issues" on public.campus_issues;
create policy "Assigned workers update their issues" on public.campus_issues
for update to authenticated using (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'worker' and (
    assignee = auth.jwt() -> 'app_metadata' ->> 'name'
    or (source = 'user' and status = 'open' and assignee_id is null and assignee is null)
  )
) with check (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'worker' and (
    assignee_id = auth.uid() and assignee = auth.jwt() -> 'app_metadata' ->> 'name'
    or assignee = auth.jwt() -> 'app_metadata' ->> 'name'
  )
);

create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  metric text not null check (metric in ('dustbin','water_level','electricity','water','waste_diverted')),
  value numeric not null check (value >= 0),
  unit text not null,
  location text not null,
  reading_type text not null default 'interval_total' check (reading_type in ('interval_total','level','counter')),
  recorded_at timestamptz not null default now()
);
create index if not exists sensor_readings_time_idx on public.sensor_readings(recorded_at desc);
alter table public.sensor_readings enable row level security;
drop policy if exists "Admins and workers read sensor data" on public.sensor_readings;
create policy "Admins and workers read sensor data" on public.sensor_readings
for select to authenticated using (auth.jwt() -> 'app_metadata' ->> 'role' in ('admin','worker','student'));
grant select on public.sensor_readings to authenticated;

-- Set app_metadata.role to student, worker, or admin from a trusted admin process.
-- Worker app_metadata.name must match campus_issues.assignee for their assignments.
-- Never set roles through user-editable user_metadata or a browser request.

-- Secure onboarding adds campus_profiles and verified-profile role policies.
-- Apply supabase/secure-onboarding.sql after schema.sql and audit-log.sql.
