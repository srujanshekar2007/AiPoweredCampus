import { createIssue, getCampusData } from "@/lib/campus-store";
import { authConfigured, getAuthenticatedIdentity } from "@/lib/authz";
import { createIssuePostHandler } from "@/lib/issue-report-route";

export async function GET() {
  if (!authConfigured()) return Response.json({ error: "Campus data is unavailable because Supabase is not configured." }, { status: 503 });
  let identity;
  try { identity = await getAuthenticatedIdentity(); }
  catch {
    return Response.json({ error: "Campus verification could not be checked. Apply supabase/secure-onboarding.sql and confirm the campus_profiles table and access policies are available." }, { status: 503 });
  }
  if (!identity) return Response.json({ error: "A verified campus account is required." }, { status: 401 });
  try { return Response.json(await getCampusData(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    const errorMessage = code === "42P01" || code === "PGRST205"
      ? "The campus issue table is missing. Run supabase/schema.sql in the Supabase project configured for this app."
      : code === "42703" || code === "PGRST204"
        ? "The campus database schema is out of date. Run the project migrations in order, then refresh."
        : code === "42501"
          ? "Campus records are blocked by database access policies. Check supabase/secure-onboarding.sql and the verified account status."
          : "Campus records could not be loaded. Check the Supabase project connection and database migrations.";
    return Response.json({ error: errorMessage }, { status: 503 });
  }
}

export const POST = createIssuePostHandler({ authConfigured, getAuthenticatedIdentity, createIssue });
