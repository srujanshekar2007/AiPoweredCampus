import { redirect } from "next/navigation";
import { authConfigured, getAuthenticatedIdentity, getSignedInUser } from "@/lib/authz";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/workspace/[role]">) {
  if (!authConfigured()) redirect("/login?error=auth_not_configured");
  const { role } = await params;
  let identity: Awaited<ReturnType<typeof getAuthenticatedIdentity>> = null;
  let profileUnavailable = false;
  try { identity = await getAuthenticatedIdentity(); } catch { profileUnavailable = true; }
  if (!identity) {
    const user = await getSignedInUser();
    if (user && profileUnavailable) redirect("/login?error=profile_unavailable");
    if (user) redirect("/verify");
    redirect("/login?error=workspace_access_denied");
  }
  if (!identity) {
    const user = await getSignedInUser();
    if (user) redirect("/verify");
    redirect("/login?error=workspace_access_denied");
  }
  if (identity.role !== role) redirect("/login?error=workspace_access_denied");
  return children;
}
