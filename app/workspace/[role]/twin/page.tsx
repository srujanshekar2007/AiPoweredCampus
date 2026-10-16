import { notFound } from "next/navigation";
import { getCampusData } from "@/lib/campus-store";
import { getTwinGeometry } from "@/lib/twin-data";
import TwinScene from "@/components/twin/TwinScene";
import { SAMPLE_TWIN_DATA } from "@/components/twin/sample-data";

export default async function TwinPage({ params }: PageProps<"/workspace/[role]/twin">) {
  const { role } = await params;
  if (role !== "student" && role !== "worker" && role !== "admin") notFound();
  const [{ issues }, geometry] = await Promise.all([getCampusData(), getTwinGeometry()]);
  return <TwinScene issues={issues} role={role} data={geometry.data ?? SAMPLE_TWIN_DATA} geometryUnavailable={geometry.unavailable} />;
}
