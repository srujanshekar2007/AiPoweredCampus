import { getAuthenticatedIdentity, authConfigured } from "@/lib/authz";
import { addSensorReading, getSensorReadings, type SensorMetric } from "@/lib/campus-store";
import { buildSensorCards } from "@/lib/sensor-status";
import { z } from "zod";

const schema = z.object({
  deviceId: z.string().trim().min(2).max(80),
  metric: z.enum(["dustbin", "water_level", "electricity", "water", "waste_diverted"]),
  readingType: z.enum(["interval_total", "level", "counter"]),
  value: z.number().finite().min(0).max(1_000_000),
  unit: z.string().trim().min(1).max(16),
  location: z.string().trim().min(2).max(120),
}).superRefine((reading, ctx) => {
  const units: Record<SensorMetric, string[]> = {
    dustbin: ["kg", "%"], water_level: ["L", "m", "cm", "%"], electricity: ["kWh", "W"], water: ["L", "m3"], waste_diverted: ["kg"],
  };
  if (!units[reading.metric].includes(reading.unit)) ctx.addIssue({ code: "custom", path: ["unit"], message: "Unit does not match the sensor metric." });
  if ((reading.metric === "water" || reading.metric === "electricity" || reading.metric === "waste_diverted") && reading.readingType !== "interval_total") ctx.addIssue({ code: "custom", path: ["readingType"], message: "Resource totals must be submitted as interval totals." });
});

export async function GET() {
  if (!authConfigured()) return Response.json({ error: "Sensor feed is unavailable because Supabase is not configured." }, { status: 503 });
  const identity = await getAuthenticatedIdentity();
  if (!identity) return Response.json({ error: "A verified campus account is required." }, { status: 401 });
  if (identity.role !== "worker" && identity.role !== "admin") return Response.json({ error: "The sensor feed is available only to campus workers and administrators." }, { status: 403 });
  try {
    const readings = await getSensorReadings();
    return Response.json({ sensors: buildSensorCards(readings), readings, staleAfterMinutes: 15 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Sensor readings could not be loaded. Check the sensor table and staff read policy." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!authConfigured()) return Response.json({ error: "Sensor ingestion is unavailable because Supabase is not configured." }, { status: 503 });
  const token = process.env.SENSOR_INGEST_TOKEN;
  if (!token) return Response.json({ error: "Sensor ingestion is disabled until SENSOR_INGEST_TOKEN is configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${token}`) return Response.json({ error: "Unauthorized sensor." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid sensor reading.", details: parsed.error.flatten() }, { status: 400 });
  try { return Response.json({ reading: await addSensorReading(parsed.data) }, { status: 201 }); }
  catch { return Response.json({ error: "Sensor reading could not be stored. Check the server-side service key and sensor schema." }, { status: 503 }); }
}
