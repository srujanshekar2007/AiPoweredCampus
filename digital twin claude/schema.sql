-- =====================================================================
-- EcoTwin Digital Twin - Supabase schema
-- Run in the Supabase SQL editor (or as a migration).
-- Hierarchy: buildings -> floors -> rooms -> issues
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type public.issue_status as enum ('pending', 'in_progress', 'resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('student', 'worker', 'admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles (role lookup; hook the frontend userRole to this later)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        public.user_role not null default 'student',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- buildings
-- position_x / position_z: centre of the building footprint on the ground plane
-- size_x / size_y / size_z: width, height, depth in scene units
-- ---------------------------------------------------------------------
create table if not exists public.buildings (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  position_x   double precision not null default 0,
  position_z   double precision not null default 0,
  size_x       double precision not null check (size_x > 0),
  size_y       double precision not null check (size_y > 0),
  size_z       double precision not null check (size_z > 0),
  floor_count  integer not null default 1 check (floor_count >= 1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger buildings_set_updated_at
  before update on public.buildings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- floors
-- ---------------------------------------------------------------------
create table if not exists public.floors (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references public.buildings (id) on delete cascade,
  floor_number   integer not null,
  plan_image_url text,
  created_at     timestamptz not null default now(),
  unique (building_id, floor_number)
);

create index if not exists floors_building_id_idx on public.floors (building_id);

-- ---------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  floor_id   uuid not null references public.floors (id) on delete cascade,
  name       text not null,
  room_type  text not null default 'general',
  created_at timestamptz not null default now()
);

create index if not exists rooms_floor_id_idx on public.rooms (floor_id);

-- ---------------------------------------------------------------------
-- issues
-- ---------------------------------------------------------------------
create table if not exists public.issues (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  status       public.issue_status not null default 'pending',
  description  text not null check (char_length(description) > 0),
  reported_by  uuid references auth.users (id) on delete set null,
  assigned_to  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index if not exists issues_room_id_idx     on public.issues (room_id);
create index if not exists issues_status_idx      on public.issues (status);
create index if not exists issues_assigned_to_idx on public.issues (assigned_to);
create index if not exists issues_reported_by_idx on public.issues (reported_by);

create or replace function public.issues_track_resolution()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'resolved' and (tg_op = 'INSERT' or old.status <> 'resolved') then
    new.resolved_at = now();
  elsif new.status <> 'resolved' then
    new.resolved_at = null;
  end if;
  return new;
end;
$$;

create trigger issues_track_resolution_trg
  before insert or update on public.issues
  for each row execute function public.issues_track_resolution();

-- ---------------------------------------------------------------------
-- Derived status views
-- Marker rule: red if ANY unresolved (pending / in_progress) issue exists,
-- green if there are issues and ALL are resolved, 'none' if no issues at all.
-- ---------------------------------------------------------------------
create or replace view public.room_status
with (security_invoker = true) as
select
  r.id                                                          as room_id,
  r.floor_id,
  count(i.id)                                                   as total_issues,
  count(i.id) filter (where i.status <> 'resolved')             as open_issues,
  case
    when count(i.id) = 0 then 'none'
    when count(i.id) filter (where i.status <> 'resolved') > 0 then 'red'
    else 'green'
  end                                                           as marker
from public.rooms r
left join public.issues i on i.room_id = r.id
group by r.id, r.floor_id;

create or replace view public.floor_status
with (security_invoker = true) as
select
  f.id                                                          as floor_id,
  f.building_id,
  count(i.id)                                                   as total_issues,
  count(i.id) filter (where i.status <> 'resolved')             as open_issues,
  case
    when count(i.id) = 0 then 'none'
    when count(i.id) filter (where i.status <> 'resolved') > 0 then 'red'
    else 'green'
  end                                                           as marker
from public.floors f
left join public.rooms r  on r.floor_id = f.id
left join public.issues i on i.room_id = r.id
group by f.id, f.building_id;

create or replace view public.building_status
with (security_invoker = true) as
select
  b.id                                                          as building_id,
  count(i.id)                                                   as total_issues,
  count(i.id) filter (where i.status <> 'resolved')             as open_issues,
  case
    when count(i.id) = 0 then 'none'
    when count(i.id) filter (where i.status <> 'resolved') > 0 then 'red'
    else 'green'
  end                                                           as marker
from public.buildings b
left join public.floors f  on f.building_id = b.id
left join public.rooms r   on r.floor_id = f.id
left join public.issues i  on i.room_id = r.id
group by b.id;

-- ---------------------------------------------------------------------
-- Row Level Security (PLACEHOLDER POLICIES - tighten before production)
-- ---------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.buildings enable row level security;
alter table public.floors    enable row level security;
alter table public.rooms     enable row level security;
alter table public.issues    enable row level security;

-- Helper to read the caller's role
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'student'::public.user_role
  );
$$;

-- profiles: users read/update their own row
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- campus geometry: readable by any authenticated user, writable by admins
create policy "buildings_read" on public.buildings
  for select to authenticated using (true);
create policy "buildings_admin_write" on public.buildings
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "floors_read" on public.floors
  for select to authenticated using (true);
create policy "floors_admin_write" on public.floors
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "rooms_read" on public.rooms
  for select to authenticated using (true);
create policy "rooms_admin_write" on public.rooms
  for all to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- issues: everyone authenticated can read (needed for campus-wide markers)
create policy "issues_read" on public.issues
  for select to authenticated using (true);

-- students (and anyone) can report an issue as themselves
create policy "issues_insert_self" on public.issues
  for insert to authenticated
  with check (reported_by = auth.uid());

-- workers can update issues assigned to them; admins can update any
create policy "issues_update_worker_or_admin" on public.issues
  for update to authenticated
  using (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'worker' and assigned_to = auth.uid())
  )
  with check (
    public.current_user_role() = 'admin'
    or (public.current_user_role() = 'worker' and assigned_to = auth.uid())
  );

create policy "issues_admin_delete" on public.issues
  for delete to authenticated
  using (public.current_user_role() = 'admin');

-- NOTE: while the frontend uses a mocked role and no auth, you can test with
-- the anon key by temporarily replacing "to authenticated" with "to anon, authenticated".

-- ---------------------------------------------------------------------
-- Realtime (so markers update live)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.issues;

-- ---------------------------------------------------------------------
-- Sample seed data (safe to delete)
-- ---------------------------------------------------------------------
with b as (
  insert into public.buildings (name, position_x, position_z, size_x, size_y, size_z, floor_count)
  values
    ('Science Block', -12,  -6, 10, 9, 8, 3),
    ('Library',         6,  -8, 12, 6, 9, 2),
    ('Admin Building',  0,  10,  9, 7, 7, 2),
    ('Hostel A',       16,   6,  8, 12, 8, 4)
  returning id, name, floor_count
),
f as (
  insert into public.floors (building_id, floor_number)
  select b.id, gs
  from b, generate_series(1, b.floor_count) as gs
  returning id, building_id, floor_number
),
r as (
  insert into public.rooms (floor_id, name, room_type)
  select f.id, 'Room ' || f.floor_number || '0' || n, case when n = 1 then 'lab' else 'classroom' end
  from f, generate_series(1, 3) as n
  returning id
)
insert into public.issues (room_id, status, description)
select id,
       (array['pending','in_progress','resolved']::public.issue_status[])[1 + floor(random() * 3)::int],
       'Sample issue: ' || (array['Leaking tap','Faulty light','AC not cooling','Broken window'])[1 + floor(random() * 4)::int]
from (select id from r order by random() limit 8) picked;
