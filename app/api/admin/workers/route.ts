import { authConfigured, getAuthenticatedIdentity } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!authConfigured()) return Response.json({ error: "Campus directory is unavailable because Supabase is not configured." }, { status: 503 });
  const identity = await getAuthenticatedIdentity();
  if (!identity) return Response.json({ error: "A verified campus account is required." }, { status: 401 });
  if (identity.role !== "admin") return Response.json({ error: "Only administrators can view the campus worker directory." }, { status: 403 });
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("campus_profiles").select("user_id,full_name,campus_id").eq("verification_status", "verified").eq("role", "worker").order("full_name");
    if (error) throw error;
    return Response.json({ workers: (data ?? []).map((worker) => ({ userId: worker.user_id, fullName: worker.full_name, campusId: worker.campus_id })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Campus worker directory could not be loaded. Check the profile migration and administrator access." }, { status: 503 }); }
}
