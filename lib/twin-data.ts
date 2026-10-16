import { createClient } from "@/lib/supabase/server";
import type { TwinData } from "@/components/twin/types";

/** Reads only the campus geometry tables. Issue records continue to use campus_issues. */
export async function getTwinGeometry(): Promise<{ data: TwinData | null; unavailable: boolean }> {
  const supabase = await createClient();
  const [buildings, floors, rooms] = await Promise.all([
    supabase.from("buildings").select("id,name,position_x,position_z,size_x,size_y,size_z,floor_count").order("name"),
    supabase.from("floors").select("id,building_id,floor_number,plan_image_url").order("floor_number"),
    supabase.from("rooms").select("id,floor_id,name,room_type").order("name"),
  ]);
  if (buildings.error || floors.error || rooms.error) {
    const errors = [buildings.error, floors.error, rooms.error].filter(Boolean);
    const missing = errors.some((error) => error?.code === "42P01" || error?.code === "PGRST205");
    if (!missing) console.error("[twin] geometry query failed", { codes: errors.map((error) => error?.code ?? "unknown") });
    return { data: null, unavailable: true };
  }
  return {
    data: {
      buildings: (buildings.data ?? []) as TwinData["buildings"],
      floors: (floors.data ?? []) as TwinData["floors"],
      rooms: (rooms.data ?? []) as TwinData["rooms"],
    },
    unavailable: false,
  };
}
