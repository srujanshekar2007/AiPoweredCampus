import Link from "next/link";
import { redirect } from "next/navigation";
import VerificationForm from "@/components/auth/VerificationForm";
import { authConfigured, getAuthenticatedIdentity, getSignedInUser } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export default async function VerificationPage() {
  if (!authConfigured()) redirect("/login?error=auth_not_configured");
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  let identity: Awaited<ReturnType<typeof getAuthenticatedIdentity>> = null;
  let profileError = false;
  try { identity = await getAuthenticatedIdentity(); } catch { profileError = true; }
  if (identity) redirect(`/workspace/${identity.role}`);
  let profile: { full_name: string; campus_id: string; verification_status: "pending" | "verified" | "rejected"; role: "student" | "worker" | "admin" | null; review_note: string | null } | null = null;
  try {
    if (profileError) throw new Error("Profile migration unavailable");
    const supabase = await createClient();
    const { data, error } = await supabase.from("campus_profiles").select("full_name,campus_id,verification_status,role,review_note").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    profile = data;
  } catch { profileError = true; }
  return <main className="account-page"><header className="account-page-header"><Link href="/login" className="account-back">← Sign in</Link><span className="eyebrow">CAMPUS ACCOUNT</span><h1>Verify your campus identity</h1><p className="muted">Signed in as {user.email}. Workspace access requires campus verification and an assigned role.</p></header><section className="account-card verification-card">
    {profileError ? <div className="auth-notice" role="alert">Campus verification is not ready. Apply <code>supabase/secure-onboarding.sql</code> after the existing schema and audit migration, then refresh.</div>
      : profile?.verification_status === "pending" ? <div className="verification-status pending"><span className="status-pill amber">PENDING REVIEW</span><h2>Information received</h2><p>Your details are waiting for an authorized campus administrator to check the identity record and assign your role.</p><dl><div><dt>Full name</dt><dd>{profile.full_name}</dd></div><div><dt>Campus ID</dt><dd>{profile.campus_id}</dd></div><div><dt>Status</dt><dd>Pending</dd></div></dl></div>
      : profile?.verification_status === "rejected" ? <div className="verification-status rejected"><span className="status-pill coral">REVIEW REQUIRED</span><h2>Verification was not approved</h2><p>{profile.review_note || "Contact campus support to resolve the identity record."}</p><p>Your account has no workspace access.</p></div>
      : <><h2>Complete your campus profile</h2><p className="muted">An authorized administrator will compare your information with college records before assigning a workspace.</p><VerificationForm /></>}
    <p className="account-note">Submitting details does not automatically verify an identity. Profile details are visible to the account holder and authorized campus administrators.</p>
  </section></main>;
}
