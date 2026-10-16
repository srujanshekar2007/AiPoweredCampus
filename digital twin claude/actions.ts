import { getSupabase } from '@/lib/supabase/client';
import { useTwinStore } from '@/store/useTwinStore';
import type { Issue, IssueStatus } from '@/types/digital-twin';

/**
 * Issue mutations: optimistic update in the store first, then persist to
 * Supabase, rolling back if the write fails. Without Supabase configured they
 * stay local-only, which is handy for demos.
 *
 * Each function resolves to true on success and false on failure (the error
 * message is also pushed to the store so the UI can show it).
 */

const store = () => useTwinStore.getState();

function fail(message: string): false {
  store().setError(message);
  return false;
}

export async function reportIssue(roomId: string, description: string): Promise<boolean> {
  const text = description.trim();
  if (!text) return false;

  const reporter = store().currentUserId;
  const optimistic = store().addLocalIssue({ room_id: roomId, description: text, reported_by: reporter });

  const supabase = getSupabase();
  if (!supabase) return true;

  const { data, error } = await supabase
    .from('issues')
    .insert({ room_id: roomId, description: text, reported_by: reporter })
    .select()
    .single();

  store().removeIssue(optimistic.id);
  if (error || !data) return fail(`Could not report the issue: ${error?.message ?? 'no data returned'}`);

  store().upsertIssue(data as Issue);
  return true;
}

export async function setIssueStatus(issueId: string, status: IssueStatus): Promise<boolean> {
  const previous = store().data.issues.find((i) => i.id === issueId);
  if (!previous) return false;

  store().updateIssueStatus(issueId, status);

  const supabase = getSupabase();
  if (!supabase) return true;

  // .select() lets us detect a write that RLS silently filtered to zero rows.
  const { data, error } = await supabase.from('issues').update({ status }).eq('id', issueId).select('id');

  if (error || !data || data.length === 0) {
    store().upsertIssue(previous); // roll back
    return fail(`Could not update the issue: ${error?.message ?? 'you do not have permission'}`);
  }
  return true;
}

export async function assignIssue(issueId: string, workerId: string | null): Promise<boolean> {
  const previous = store().data.issues.find((i) => i.id === issueId);
  if (!previous) return false;

  store().assignIssue(issueId, workerId);
  const next = store().data.issues.find((i) => i.id === issueId);

  const supabase = getSupabase();
  if (!supabase) return true;

  const { data, error } = await supabase
    .from('issues')
    .update({ assigned_to: workerId, status: next?.status ?? previous.status })
    .eq('id', issueId)
    .select('id');

  if (error || !data || data.length === 0) {
    store().upsertIssue(previous);
    return fail(`Could not assign the issue: ${error?.message ?? 'you do not have permission'}`);
  }
  return true;
}
