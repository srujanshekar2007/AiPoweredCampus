import { notFound } from "next/navigation";
import AssistantClient from "@/components/assistant/AssistantClient";

export default async function AssistantPage({ params }: PageProps<"/workspace/[role]/assistant">) {
  const { role } = await params;
  if (role !== "student" && role !== "worker" && role !== "admin") notFound();
  return <AssistantClient role={role}/>;
}
