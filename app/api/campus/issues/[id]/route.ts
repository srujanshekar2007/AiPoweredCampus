import { claimIssue, updateIssue } from "@/lib/campus-store";
import { z } from "zod";
import { authConfigured, getAuthenticatedIdentity } from "@/lib/authz";
import { getCampusData } from "@/lib/campus-store";
import { canClaimIssue, canUpdateIssue } from "@/lib/issue-policy";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  status: z.enum(["open", "assigned", "in_progress", "resolved", "verified"]).optional(),
  assignee: z.string().trim().min(1).max(80).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  evidence: z.array(z.string().max(500)).max(10).optional(),
}).refine((value) => Object.keys(value).length > 0).refine((value) => (value.assignee === undefined) === (value.assigneeId === undefined), { message: "Assignment name and user ID must be updated together." });

export async function PATCH(request: Request, context: RouteContext<"/api/campus/issues/[id]">) {
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid issue update." }, { status: 400 });
  if (!authConfigured()) return Response.json({ error: "Issue updates are unavailable because Supabase is not configured." }, { status: 503 });
  const identity = await getAuthenticatedIdentity();
  if (!identity) return Response.json({ error: "A verified campus account is required." }, { status: 401 });
  try {
    const current = (await getCampusData()).issues.find((item) => item.id === id);
    if (!current) return Response.json({ error: "Issue not found." }, { status: 404 });
    // A worker claims a shared, unassigned report using their authenticated
    // session identity. Never accept worker identity or assignment from a client.
    if (identity.role === "worker" && parsed.data.status === "in_progress" && canClaimIssue(identity.role, current)) {
      const claimed = await claimIssue(id, { id: identity.id, name: identity.name });
      if (!claimed) return Response.json({ error: "This report was already claimed. Refresh the worker queue and choose another report." }, { status: 409 });
      return Response.json({ issue: claimed });
    }
    if (identity.role === "admin" && parsed.data.assigneeId) {
      const supabase = await createClient();
      const { data: worker, error } = await supabase.from("campus_profiles").select("full_name").eq("user_id", parsed.data.assigneeId).eq("verification_status", "verified").eq("role", "worker").maybeSingle();
      if (error) throw error;
      if (!worker || parsed.data.assignee !== worker.full_name) return Response.json({ error: "Choose a verified campus worker from the assignment list." }, { status: 400 });
    }
    if (!canUpdateIssue(identity.role, current, parsed.data, identity.name, identity.id)) return Response.json({ error: "This account cannot make that update, or the status transition is invalid." }, { status: 403 });
    const issue = await updateIssue(id, parsed.data);
    if (!issue) return Response.json({ error: "Issue not found." }, { status: 404 });
    return Response.json({ issue });
  } catch { return Response.json({ error: "Issue update failed. Check the campus database connection and access policies." }, { status: 503 }); }
}
