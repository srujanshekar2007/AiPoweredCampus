import { notFound } from "next/navigation";
import SensorFeed from "@/components/sensors/SensorFeed";
import { getSensorReadings, type SensorReading } from "@/lib/campus-store";

export default async function SensorsPage({ params }: PageProps<"/workspace/[role]/sensors">) {
  const { role } = await params;
  if (role !== "worker" && role !== "admin") notFound();
  let readings: SensorReading[];
  let error = "";
  try { readings = await getSensorReadings(); }
  catch { readings = []; error = "Sensor data is unavailable. Check the secure sensor migration, Supabase connection, and staff access policy."; }
  return <SensorFeed role={role} readings={readings} error={error}/>;
}
