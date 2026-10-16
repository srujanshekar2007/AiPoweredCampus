'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { fetchTwinData } from '@/lib/twin/api';
import { useTwinStore } from '@/store/useTwinStore';
import type { Issue } from '@/types/digital-twin';

/**
 * Hydrates the store from Supabase and keeps it live:
 *  - initial load of buildings / floors / rooms / issues
 *  - realtime: issue changes are merged in place (markers flip colour live);
 *    geometry-table changes trigger a debounced refetch
 *  - picks up the signed-in user's id (the role stays mocked in the store)
 *
 * Call once, from the page.
 */
export function useTwinData() {
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { setData, setLoading, setError } = useTwinStore.getState();
    setLoading(true);
    try {
      setData(await fetchTwinData());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campus data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void load();
  }, [load]);

  // Session -> currentUserId (role is mocked for now; see userRole in the store)
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      useTwinStore.getState().setCurrentUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      useTwinStore.getState().setCurrentUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Realtime
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const scheduleRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void load(), 400);
    };

    const channel = supabase
      .channel('twin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, (payload) => {
        const { upsertIssue, removeIssue } = useTwinStore.getState();
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as Partial<Issue>).id;
          if (id) removeIssue(id);
        } else {
          upsertIssue(payload.new as Issue);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'floors' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { reload: load, isConfigured: isSupabaseConfigured };
}

/* ---------------------------------------------------------------------- */
/* Workers (for admin assignment)                                         */
/* ---------------------------------------------------------------------- */

export interface WorkerProfile {
  id: string;
  full_name: string | null;
}

/** Lists users with role = worker. Needs the admin read policy in schema_patch_01.sql. */
export function useWorkers(enabled: boolean): WorkerProfile[] {
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;
    void supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'worker')
      .then(({ data }) => {
        if (!cancelled && data) setWorkers(data as WorkerProfile[]);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return workers;
}
