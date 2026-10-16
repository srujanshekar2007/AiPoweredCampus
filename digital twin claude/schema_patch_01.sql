-- =====================================================================
-- EcoTwin Digital Twin - schema patch 01 (run AFTER schema.sql)
-- Supports the admin "assign to worker" control and live updates.
-- =====================================================================

-- Admins can list every profile (needed to pick a worker to assign).
-- Uses the SECURITY DEFINER helper from schema.sql, so no policy recursion.
create policy "profiles_admin_read_all" on public.profiles
  for select to authenticated
  using (public.current_user_role() = 'admin');

-- Auto-create a profile row (role = student) whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime for the geometry tables (issues was added in schema.sql).
-- Each statement errors harmlessly if the table is already in the publication.
alter publication supabase_realtime add table public.buildings;
alter publication supabase_realtime add table public.floors;
alter publication supabase_realtime add table public.rooms;

-- Promote a user to worker/admin (replace the UUID):
-- update public.profiles set role = 'worker' where id = '00000000-0000-0000-0000-000000000000';
