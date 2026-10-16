import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getAuthenticatedIdentity } from "@/lib/authz";
import { getTwinGeometry } from "@/lib/twin-data";
import { SAMPLE_TWIN_DATA } from "@/components/twin/sample-data";

const validRoles = ["student", "worker", "admin"] as const;
type WorkspaceRole = (typeof validRoles)[number];

export default async function WorkspacePage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!validRoles.includes(role as WorkspaceRole)) notFound();
  const identity = await getAuthenticatedIdentity();
  if (!identity) redirect("/verify");
  if (identity.role !== role) redirect("/login?error=workspace_access_denied");
  const geometry = await getTwinGeometry();
  return <AppShell role={role as WorkspaceRole} identity={identity} twinData={geometry.data ?? SAMPLE_TWIN_DATA} geometryUnavailable={geometry.unavailable} />;
}
