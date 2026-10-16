import { notFound } from "next/navigation";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { getAuthenticatedIdentity } from "@/lib/authz";
import { redirect } from "next/navigation";
import { getCampusData } from "@/lib/campus-store";

const allowedRoles = new Set(["student", "worker", "admin"]);

export default async function NotificationsPage({ params }: PageProps<"/workspace/[role]/notifications">) {
  const { role } = await params;
  if (!allowedRoles.has(role)) notFound();
  const { issues, auditLog } = await getCampusData();
  const identity = await getAuthenticatedIdentity();
  if (!identity || identity.role !== role) redirect("/login?error=workspace_access_denied");
  const visibleIssues = role === "admin" ? issues : role === "worker"
    ? issues.filter((issue) => issue.assigneeId === identity.id)
    : issues.filter((issue) => issue.reporterId === identity.id);
  return <NotificationCenter role={role} issues={visibleIssues} auditLog={auditLog} readScope={identity.id} />;
}
