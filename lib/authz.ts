import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CampusRole = "student" | "worker" | "admin";
export function authConfigured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export type SignedInUser = { id: string; email: string; name: string; metadataRole: CampusRole | null };
function toRole(value: unknown): CampusRole | null { return value === "student" || value === "worker" || value === "admin" ? value : null; }

export const getSignedInUser = cache(async function getSignedInUser(): Promise<SignedInUser | null> {
  if (!authConfigured()) return null;
  const supabase = await createClient(); const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "", name: data.user.app_metadata.name ?? data.user.user_metadata.full_name ?? data.user.email ?? "Campus user", metadataRole: toRole(data.user.app_metadata.role) };
});

export const getAuthenticatedIdentity = cache(async function getAuthenticatedIdentity(): Promise<{ role: CampusRole; id: string; email: string; name: string } | null> {
  const user = await getSignedInUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("campus_profiles").select("verification_status, role, full_name").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Campus profile verification is unavailable. Apply the secure onboarding migration and check Supabase access.");
  if (profile?.verification_status === "verified" && toRole(profile.role)) return { id: user.id, email: user.email, name: profile.full_name || user.name, role: profile.role };
  if (profile && user.metadataRole === "admin") return { id: user.id, email: user.email, name: profile.full_name || user.name, role: "admin" };
  // Existing, trusted role claims remain valid during migration; new OAuth users have no app_metadata role.
  if (!profile && user.metadataRole) return { id: user.id, email: user.email, name: user.name, role: user.metadataRole };
  return null;
});
export async function getAuthenticatedRole(): Promise<CampusRole | null> { return (await getAuthenticatedIdentity())?.role ?? null; }

export async function getTrustedAdminUser(): Promise<SignedInUser | null> {
  const user = await getSignedInUser();
  if (!user) return null;
  const identity = await getAuthenticatedIdentity();
  return identity?.role === "admin" || user.metadataRole === "admin" ? user : null;
}
