import { notFound } from "next/navigation";
import DemoWorkspace from "@/components/demo/DemoWorkspace";
import type { DemoRole } from "@/lib/demo-data";

const roles = new Set<DemoRole>(["student", "worker", "admin"]);

export default async function DemoWorkspacePage({ params }: { params: Promise<{ role: string; section?: string[] }> }) {
  const { role, section = [] } = await params;
  if (!roles.has(role as DemoRole)) notFound();
  const allowed = new Set(["sustainability", "twin", "sensors", "notifications", "assistant", "profile", "settings", "manage"]);
  if (section[0] && !allowed.has(section[0])) notFound();
  if (section[0] === "sensors" && role === "student") notFound();
  if (section[0] === "manage" && role !== "admin") notFound();
  if (section[0] === "manage" && !["team", "activity", "verifications"].includes(section[1] ?? "")) notFound();
  if (section.length > 2) notFound();

  return <DemoWorkspace role={role as DemoRole} section={section} />;
}
