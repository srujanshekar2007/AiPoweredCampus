import { authConfigured, getAuthenticatedIdentity } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const decisionSchema = z.object({ status: z.enum(["verified", "rejected"]), role: z.enum(["student", "worker"]).nullable(), reviewNote: z.string().trim().max(500).optional() }).refine((value) => value.status !== "verified" || value.role !== null, { message: "Choose a campus role before approving." });

export async function PATCH(request: Request, context: RouteContext<"/api/admin/verifications/[userId]">) {
  if (!authConfigured()) return Response.json({ error: "Profile review is unavailable because Supabase is not configured." }, { status: 503 });
  const identity = await getAuthenticatedIdentity();
  if (!identity) return Response.json({ error: "A verified campus administrator is required." }, { status: 401 });
  if (identity.role !== "admin") return Response.json({ error: "Only administrators can review campus profiles." }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose approve or reject and provide a role for approvals." }, { status: 400 });
  const { userId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return Response.json({ error: "Invalid account ID." }, { status: 400 });
  if (userId === identity.id) return Response.json({ error: "Administrators cannot review their own campus profile." }, { status: 403 });
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("campus_profiles").update({ verification_status: parsed.data.status, role: parsed.data.status === "verified" ? parsed.data.role : null, review_note: parsed.data.reviewNote ?? null, reviewed_by: identity.id, reviewed_at: new Date().toISOString() }).eq("user_id", userId).eq("verification_status", "pending").select("user_id").maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "That request is no longer pending or is not available." }, { status: 404 });
    return Response.json({ status: parsed.data.status });
  } catch { return Response.json({ error: "The review could not be saved. Check the campus profile policies and database connection." }, { status: 503 }); }
}
