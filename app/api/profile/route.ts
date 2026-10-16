import { authConfigured, getSignedInUser } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).regex(/^[\p{L}\p{M} .'-]+$/u, "Enter your name using letters and standard punctuation."),
  phone: z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/, "Enter a valid international phone number, including country code."),
  campusId: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9/-]*$/, "Use only letters, numbers, hyphens, and slashes."),
});

export async function POST(request: Request) {
  if (!authConfigured()) return Response.json({ error: "Profile verification is unavailable because Supabase is not configured." }, { status: 503 });
  const user = await getSignedInUser();
  if (!user) return Response.json({ error: "Sign in before submitting your campus profile." }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the highlighted profile details and try again.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const supabase = await createClient();
    const { data: existing, error: lookupError } = await supabase.from("campus_profiles").select("user_id,verification_status").eq("user_id", user.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return Response.json({ error: "A campus profile has already been submitted. Contact campus support if it needs correction." }, { status: 409 });
    const { error } = await supabase.from("campus_profiles").insert({ user_id: user.id, full_name: parsed.data.fullName, phone: parsed.data.phone, campus_id: parsed.data.campusId, verification_status: "pending", role: null });
    if (error?.code === "23505") return Response.json({ error: "That campus ID is already associated with an account. Contact campus support if this is a mistake." }, { status: 409 });
    if (error) throw error;
    return Response.json({ status: "pending" }, { status: 201 });
  } catch {
    return Response.json({ error: "The profile could not be submitted. Check the secure onboarding migration and database connection." }, { status: 503 });
  }
}
