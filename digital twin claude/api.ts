import { getSupabase } from '@/lib/supabase/client';
import type { Building, Floor, Issue, Room, TwinData } from '@/types/digital-twin';

/**
 * Loads the whole campus dataset. The four tables are fetched in parallel.
 * NOTE: PostgREST returns at most 1000 rows per request by default; if a campus
 * outgrows that for rooms or issues, page these queries with .range().
 */
export async function fetchTwinData(): Promise<TwinData> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  const [buildings, floors, rooms, issues] = await Promise.all([
    supabase.from('buildings').select('*').order('name'),
    supabase.from('floors').select('*').order('floor_number'),
    supabase.from('rooms').select('*').order('name'),
    supabase.from('issues').select('*').order('created_at', { ascending: false }),
  ]);

  const failed = [buildings, floors, rooms, issues].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  return {
    buildings: (buildings.data ?? []) as Building[],
    floors: (floors.data ?? []) as Floor[],
    rooms: (rooms.data ?? []) as Room[],
    issues: (issues.data ?? []) as Issue[],
  };
}
