import { notFound } from "next/navigation";
import ScenarioCalculator from "@/components/sustainability/ScenarioCalculator";

export default async function SustainabilityPage({ params }: PageProps<"/workspace/[role]/sustainability">) {
  const { role } = await params;
  if (role !== "student" && role !== "worker" && role !== "admin") notFound();
  return <ScenarioCalculator role={role}/>;
}
