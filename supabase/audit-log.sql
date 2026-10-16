-- Apply after schema.sql. Safe to re-run as an upgrade migration.
create table if not exists public.issue_audit_log (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  source text not null default 'user' check (source in ('user','demo')),
  created_at timestamptz not null default now()
);
create index if not exists issue_audit_issue_time_idx on public.issue_audit_log(issue_id, created_at desc);
alter table public.issue_audit_log enable row level security;
drop policy if exists "Read audit events for authorized campus issues" on public.issue_audit_log;
create policy "Read audit events for authorized campus issues" on public.issue_audit_log
for select to authenticated using (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  or actor_id = auth.uid()
  or exists (select 1 from public.campus_issues i where i.id = issue_audit_log.issue_id)
);
revoke update, delete, truncate on public.issue_audit_log from authenticated;
grant select on public.issue_audit_log to authenticated;

create or replace function public.capture_issue_audit_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  change_data jsonb;
  action_name text;
begin
  if tg_op = 'INSERT' then
    action_name := 'reported';
    change_data := '{}'::jsonb;
  else
    change_data := jsonb_strip_nulls(jsonb_build_object(
      'status', case when old.status is distinct from new.status then jsonb_build_object('from', old.status, 'to', new.status) end,
      'assignee', case when old.assignee is distinct from new.assignee then jsonb_build_object('from', old.assignee, 'to', new.assignee) end,
      'priority', case when old.priority is distinct from new.priority then jsonb_build_object('from', old.priority, 'to', new.priority) end,
      'evidence_count', case when old.evidence is distinct from new.evidence then jsonb_build_object('from', jsonb_array_length(old.evidence), 'to', jsonb_array_length(new.evidence)) end
    ));
    action_name := case
      when old.assignee is distinct from new.assignee and new.assignee is not null then 'assigned'
      when old.assignee is distinct from new.assignee then 'unassigned'
      when old.status is distinct from new.status and new.status = 'in_progress' then 'started'
      when old.status is distinct from new.status and new.status = 'resolved' then 'marked_resolved'
      when old.status is distinct from new.status and new.status = 'verified' then 'verified'
      when old.status is distinct from new.status and new.status = 'open' then 'reopened'
      when old.priority is distinct from new.priority then 'priority_changed'
      when old.evidence is distinct from new.evidence then 'evidence_added'
      else 'updated'
    end;
  end if;

  insert into public.issue_audit_log(issue_id, actor_id, actor_name, action, changes, source)
  values (
    new.id,
    auth.uid(),
    coalesce(auth.jwt() -> 'app_metadata' ->> 'name', auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() ->> 'email', 'Campus system'),
    action_name,
    change_data,
    new.source
  );
  return new;
end;
$$;

drop trigger if exists campus_issue_audit_insert on public.campus_issues;
drop trigger if exists campus_issue_audit_update on public.campus_issues;
create trigger campus_issue_audit_insert after insert on public.campus_issues
for each row execute function public.capture_issue_audit_event();
create trigger campus_issue_audit_update after update on public.campus_issues
for each row execute function public.capture_issue_audit_event();
