import { z } from "zod";

export const issueSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(10).max(1000),
  category: z.enum(["Water", "Electrical", "Waste", "Grounds", "Safety", "Other"]),
  location: z.string().trim().min(2).max(160),
  locationSelection: z.object({
    buildingId: z.string().trim().min(1).max(100),
    floorId: z.string().trim().min(1).max(100),
    roomId: z.string().trim().min(1).max(100),
  }),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  evidence: z.array(z.string().max(4_500_000)).max(3).optional(),
});

type CampusIdentity = { role: "student" | "worker" | "admin"; id: string; name: string };
type IssueInput = Omit<z.infer<typeof issueSchema>, "locationSelection">;
type IssueCreator = (input: IssueInput, reporter: { id: string; name: string }) => Promise<{ id: string }>;

export function createIssuePostHandler(dependencies: {
  authConfigured: () => boolean;
  getAuthenticatedIdentity: () => Promise<CampusIdentity | null>;
  createIssue: IssueCreator;
}) {
  return async function POST(request: Request) {
    if (!dependencies.authConfigured()) return Response.json({ error: "Issue reporting is unavailable because Supabase is not configured." }, { status: 503 });
    let identity: CampusIdentity | null;
    try {
      identity = await dependencies.getAuthenticatedIdentity();
    } catch {
      return Response.json({ error: "Campus verification could not be checked. Apply supabase/secure-onboarding.sql and confirm the campus_profiles table and access policies are available." }, { status: 503 });
    }
    if (!identity) return Response.json({ error: "A verified campus account is required." }, { status: 401 });
    if (identity.role !== "student" && identity.role !== "admin") return Response.json({ error: "A student or administrator account is required to submit reports." }, { status: 403 });

    let requestBody: unknown;
    try { requestBody = await request.json(); }
    catch { return Response.json({ error: "Please check the issue details and try again." }, { status: 400 }); }
    const parsed = issueSchema.safeParse(requestBody);
    if (!parsed.success) return Response.json({ error: "Please check the issue details and choose a building, floor, and room.", details: parsed.error.flatten() }, { status: 400 });

    try {
      // locationSelection is validated as complete above. Keep reporting in the
      // existing campus_issues table; the geometry IDs are selection metadata.
      const { title, description, category, location, priority, evidence } = parsed.data;
      const issueInput = { title, description, category, location, priority, evidence };
      const issue = await dependencies.createIssue(issueInput, { id: identity.id, name: identity.name });
      return Response.json({ issue }, { status: 201 });
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      const databaseMessage = typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
      const missingTableGrant = code === "42501" && /permission denied for (?:table|relation) [\"]?campus_issues[\"]?/i.test(databaseMessage);
      const rowPolicyRejected = code === "42501" && /row-level security policy/i.test(databaseMessage);
      console.error("[campus] issue creation failed", { code: code || "unknown", cause: missingTableGrant ? "table_grant" : rowPolicyRejected ? "row_policy" : "other" });
      const message = code === "PGRST205"
        ? "The campus issue table is missing. Run supabase/schema.sql in the Supabase project configured for this app."
        : code === "42P01"
          ? "A campus reporting or audit table is missing. Run supabase/schema.sql, then supabase/audit-log.sql, in the Supabase project configured for this app."
          : missingTableGrant
            ? "The authenticated database role is missing access to campus_issues. Apply supabase/secure-onboarding.sql; its row-level policies will continue to control which reports can be written."
            : rowPolicyRejected
              ? "Supabase rejected this report under row-level security. Confirm that this account is verified as a student or administrator in the same Supabase project."
              : code === "42501"
                ? "Supabase denied access to campus_issues. Confirm supabase/secure-onboarding.sql is applied and this account has a verified student or administrator role."
            : code === "23514"
              ? "Some report details do not match the campus database rules. Review the title, description, category, priority, and location, then try again."
              : "The report could not be saved. Check the Supabase connection and migrations, then try again.";
      return Response.json({ error: message }, { status: 503 });
    }
  };
}
