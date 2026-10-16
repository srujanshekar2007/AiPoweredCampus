-- Add the interactive campus geometry used by the Digital Twin.
-- Run after schema.sql and secure-onboarding.sql in the Supabase project
-- configured for this app. This migration does not create or modify auth,
-- campus_profiles, campus_issues, or any existing issue policies.

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position_x double precision not null default 0,
  position_z double precision not null default 0,
  size_x double precision not null check (size_x > 0),
  size_y double precision not null check (size_y > 0),
  size_z double precision not null check (size_z > 0),
  floor_count integer not null default 1 check (floor_count between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  floor_number integer not null check (floor_number between 1 and 100),
  plan_image_url text,
  created_at timestamptz not null default now(),
  unique (building_id, floor_number)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  floor_id uuid not null references public.floors(id) on delete cascade,
  name text not null,
  room_type text not null default 'general',
  created_at timestamptz not null default now(),
  unique (floor_id, name)
);

create index if not exists floors_building_id_idx on public.floors(building_id);
create index if not exists rooms_floor_id_idx on public.rooms(floor_id);

alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.rooms enable row level security;

-- Replace the permissive demo geometry policies if the supplied standalone
-- Twin schema was previously applied. This preserves all rows and tables.
drop policy if exists "buildings_read" on public.buildings;
drop policy if exists "buildings_admin_write" on public.buildings;
drop policy if exists "floors_read" on public.floors;
drop policy if exists "floors_admin_write" on public.floors;
drop policy if exists "rooms_read" on public.rooms;
drop policy if exists "rooms_admin_write" on public.rooms;

-- The standalone source schema also had self-editable role profiles and a
-- second, permissive `issues` table. The app does not use either table. If
-- present, keep every table and row but remove those demo API policies so
-- they cannot bypass this app's verified campus_profiles/campus_issues flow.
do $$ begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists "profiles_select_own" on public.profiles';
    execute 'drop policy if exists "profiles_update_own" on public.profiles';
  end if;
  if to_regclass('public.issues') is not null then
    execute 'drop policy if exists "issues_read" on public.issues';
    execute 'drop policy if exists "issues_insert_self" on public.issues';
    execute 'drop policy if exists "issues_update_worker_or_admin" on public.issues';
    execute 'drop policy if exists "issues_admin_delete" on public.issues';
  end if;
end $$;

grant select, insert, update, delete on public.buildings, public.floors, public.rooms to authenticated;

-- Campus geometry is visible only to signed-in campus users with a trusted
-- app_metadata role or a verified campus_profiles record.
drop policy if exists "Verified campus users read buildings" on public.buildings;
create policy "Verified campus users read buildings" on public.buildings
for select to authenticated using (
  auth.jwt() -> 'app_metadata' ->> 'role' in ('student', 'worker', 'admin')
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid()
      and p.verification_status = 'verified'
      and p.role in ('student', 'worker', 'admin')
  )
);
drop policy if exists "Verified admins manage buildings" on public.buildings;
create policy "Verified admins manage buildings" on public.buildings
for all to authenticated
using (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid() and p.verification_status = 'verified' and p.role = 'admin'
  )
)
with check (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid() and p.verification_status = 'verified' and p.role = 'admin'
  )
);

drop policy if exists "Verified campus users read floors" on public.floors;
create policy "Verified campus users read floors" on public.floors
for select to authenticated using (
  auth.jwt() -> 'app_metadata' ->> 'role' in ('student', 'worker', 'admin')
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid()
      and p.verification_status = 'verified'
      and p.role in ('student', 'worker', 'admin')
  )
);
drop policy if exists "Verified admins manage floors" on public.floors;
create policy "Verified admins manage floors" on public.floors
for all to authenticated
using (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid() and p.verification_status = 'verified' and p.role = 'admin'
  )
)
with check (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid() and p.verification_status = 'verified' and p.role = 'admin'
  )
);

drop policy if exists "Verified campus users read rooms" on public.rooms;
create policy "Verified campus users read rooms" on public.rooms
for select to authenticated using (
  auth.jwt() -> 'app_metadata' ->> 'role' in ('student', 'worker', 'admin')
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid()
      and p.verification_status = 'verified'
      and p.role in ('student', 'worker', 'admin')
  )
);
drop policy if exists "Verified admins manage rooms" on public.rooms;
create policy "Verified admins manage rooms" on public.rooms
for all to authenticated
using (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid() and p.verification_status = 'verified' and p.role = 'admin'
  )
)
with check (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or exists (
    select 1 from public.campus_profiles p
    where p.user_id = auth.uid() and p.verification_status = 'verified' and p.role = 'admin'
  )
);

-- Illustrative starter model: four numbered buildings in a circle, each with
-- four floors and four rooms per floor. Replace with surveyed geometry before
-- operational use.
insert into public.buildings (id, name, position_x, position_z, size_x, size_y, size_z, floor_count)
select * from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, '1', 0, -18, 10, 12, 10, 4),
  ('10000000-0000-4000-8000-000000000002'::uuid, '2', 18, 0, 10, 12, 10, 4),
  ('10000000-0000-4000-8000-000000000003'::uuid, '3', 0, 18, 10, 12, 10, 4),
  ('10000000-0000-4000-8000-000000000004'::uuid, '4', -18, 0, 10, 12, 10, 4)
) as seed
where not exists (select 1 from public.buildings)
on conflict (id) do nothing;

insert into public.floors (building_id, floor_number)
select b.id, gs.floor_number
from public.buildings b
cross join generate_series(1, 4) as gs(floor_number)
where b.id in (
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004'
)
and not exists (select 1 from public.floors)
on conflict (building_id, floor_number) do nothing;

insert into public.rooms (floor_id, name, room_type)
select f.id,
       'Room ' || f.floor_number::text || lpad(gs.room_number::text, 2, '0'),
       case gs.room_number
         when 1 then 'classroom'
         when 2 then 'laboratory'
         when 3 then 'study'
         else 'general'
       end
from public.floors f
cross join generate_series(1, 4) as gs(room_number)
where f.building_id in (
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004'
)
and not exists (select 1 from public.rooms)
on conflict (floor_id, name) do nothing;
