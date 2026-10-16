-- Apply after schema.sql and audit-log.sql. Existing authorized app_metadata role
-- claims remain a trusted migration path; new accounts cannot set roles themselves.
create table if not exists public.campus_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  campus_id text not null check (length(trim(campus_id)) between 3 and 80),
  role text check (role in ('student','worker','admin')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_note text,
  check (verification_status <> 'verified' or role is not null)
);
create unique index if not exists campus_profiles_campus_id_unique on public.campus_profiles(lower(trim(campus_id)));
create index if not exists campus_profiles_status_idx on public.campus_profiles(verification_status, submitted_at);
alter table public.campus_profiles enable row level security;
drop policy if exists "Users read own profile and admins review profiles" on public.campus_profiles;
create policy "Users read own profile and admins review profiles" on public.campus_profiles
for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users submit pending profile once" on public.campus_profiles;
create policy "Users submit pending profile once" on public.campus_profiles
for insert to authenticated with check (user_id = auth.uid() and verification_status = 'pending' and role is null and reviewed_by is null and reviewed_at is null);
revoke update, delete on public.campus_profiles from authenticated;
grant select, insert, update on public.campus_profiles to authenticated;

-- Verified profiles are the role source for new users. Existing trusted role
-- claims continue working until their profile is submitted for verification.
alter table public.campus_issues add column if not exists assignee_id uuid references auth.users(id) on delete set null;
create or replace function public.current_campus_role()
returns text language plpgsql stable security definer set search_path = public, auth as $$
declare p record; claim_role text;
begin
  select verification_status, role into p from public.campus_profiles where user_id = auth.uid();
  claim_role := auth.jwt() -> 'app_metadata' ->> 'role';
  if found then
    if p.verification_status = 'verified' then return p.role; end if;
    if claim_role = 'admin' then return 'admin'; end if;
    return null;
  end if;
  if claim_role in ('student','worker','admin') then return claim_role; end if;
  return null;
end;
$$;
revoke all on function public.current_campus_role() from public;
grant execute on function public.current_campus_role() to authenticated;
drop policy if exists "Users read own profile and admins review profiles" on public.campus_profiles;
create policy "Users read own profile and admins review profiles" on public.campus_profiles
for select to authenticated using (user_id = auth.uid() or public.current_campus_role() = 'admin');
drop policy if exists "Trusted admins review profiles" on public.campus_profiles;
create policy "Trusted admins review profiles" on public.campus_profiles
for update to authenticated using (public.current_campus_role() = 'admin')
with check (public.current_campus_role() = 'admin');
create or replace function public.guard_campus_profile_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_campus_role() = 'admin' and (
    old.verification_status <> 'pending' or new.verification_status not in ('verified','rejected') or
    new.role not in ('student','worker') and new.verification_status = 'verified' or
    new.user_id is distinct from old.user_id or new.full_name is distinct from old.full_name or
    new.phone is distinct from old.phone or new.campus_id is distinct from old.campus_id or
    new.submitted_at is distinct from old.submitted_at or new.reviewed_by is distinct from auth.uid() or new.reviewed_at is null
  ) then raise exception 'Campus profiles can only be reviewed as student or worker'; end if;
  return new;
end;
$$;
drop trigger if exists guard_campus_profile_review on public.campus_profiles;
create trigger guard_campus_profile_review before update on public.campus_profiles
for each row execute function public.guard_campus_profile_review();

-- Replace old issue/sensor policies. Students can read only their own reports;
-- the sensor feed is limited to verified workers and administrators.
drop policy if exists "Campus roles read authorized issues" on public.campus_issues;
drop policy if exists "Students and admins report issues" on public.campus_issues;
drop policy if exists "Admins manage issues" on public.campus_issues;
drop policy if exists "Assigned workers update their issues" on public.campus_issues;
drop policy if exists "Verified roles read authorized issues" on public.campus_issues;
drop policy if exists "Verified students and admins report issues" on public.campus_issues;
drop policy if exists "Admins manage campus issues" on public.campus_issues;
drop policy if exists "Assigned workers update authorized issues" on public.campus_issues;
create policy "Verified roles read authorized issues" on public.campus_issues for select to authenticated using (
  public.current_campus_role() = 'admin'
  or (public.current_campus_role() = 'student' and reporter_id = auth.uid())
  or (public.current_campus_role() = 'worker' and (
    assignee_id = auth.uid()
    or (assignee_id is null and assignee = coalesce((select full_name from public.campus_profiles where user_id = auth.uid()), auth.jwt() -> 'app_metadata' ->> 'name'))
    or (source = 'user' and status = 'open' and assignee_id is null and assignee is null)
  ))
);
create policy "Verified students and admins report issues" on public.campus_issues for insert to authenticated with check (
  reporter_id = auth.uid() and public.current_campus_role() in ('student','admin')
);
-- These grants enable the client role to reach the policies; they do not bypass
-- the authenticated identity or row-level checks above.
grant select, insert, update on public.campus_issues to authenticated;
create policy "Admins manage campus issues" on public.campus_issues for all to authenticated using (public.current_campus_role() = 'admin') with check (public.current_campus_role() = 'admin');
create policy "Assigned workers update authorized issues" on public.campus_issues for update to authenticated using (
  public.current_campus_role() = 'worker' and (
    assignee_id = auth.uid()
    or (assignee_id is null and assignee = coalesce((select full_name from public.campus_profiles where user_id = auth.uid()), auth.jwt() -> 'app_metadata' ->> 'name'))
    or (source = 'user' and status = 'open' and assignee_id is null and assignee is null)
  )
) with check (
  public.current_campus_role() = 'worker' and (
    assignee_id = auth.uid()
    or (assignee_id is null and assignee = coalesce((select full_name from public.campus_profiles where user_id = auth.uid()), auth.jwt() -> 'app_metadata' ->> 'name'))
  )
);

create or replace function public.guard_campus_issue_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.current_campus_role() = 'worker' and (
    new.reporter_id is distinct from old.reporter_id or new.reporter is distinct from old.reporter or
    ((new.assignee_id is distinct from old.assignee_id or new.assignee is distinct from old.assignee) and not (
      old.source = 'user' and old.status = 'open' and old.assignee_id is null and old.assignee is null and
      new.assignee_id = auth.uid() and new.assignee = coalesce((select full_name from public.campus_profiles where user_id = auth.uid()), auth.jwt() -> 'app_metadata' ->> 'name') and
      new.status = 'in_progress'
    )) or
    new.priority is distinct from old.priority or new.title is distinct from old.title or
    new.description is distinct from old.description or new.category is distinct from old.category or
    new.location is distinct from old.location or new.source is distinct from old.source
  ) then raise exception 'Workers may only update task status and evidence'; end if;
  return new;
end;
$$;
drop trigger if exists guard_campus_issue_columns on public.campus_issues;
create trigger guard_campus_issue_columns before update on public.campus_issues
for each row execute function public.guard_campus_issue_columns();

drop policy if exists "Admins and workers read sensor data" on public.sensor_readings;
drop policy if exists "Verified staff read sensor data" on public.sensor_readings;
drop policy if exists "Verified campus roles read sensor data" on public.sensor_readings;
create policy "Verified campus roles read sensor data" on public.sensor_readings for select to authenticated using (public.current_campus_role() in ('student','worker','admin'));
grant select on public.sensor_readings to authenticated;

alter table public.sensor_readings add column if not exists reading_type text not null default 'interval_total';
alter table public.sensor_readings drop constraint if exists sensor_readings_metric_check;
alter table public.sensor_readings add constraint sensor_readings_metric_check check (metric in ('dustbin','water_level','electricity','water','waste_diverted'));
alter table public.sensor_readings drop constraint if exists sensor_readings_reading_type_check;
alter table public.sensor_readings add constraint sensor_readings_reading_type_check check (reading_type in ('interval_total','level','counter'));

-- Existing demo rows are preserved, but the application excludes source='demo'.
