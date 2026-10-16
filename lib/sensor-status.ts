import type { SensorMetric, SensorReading } from "@/lib/campus-store";

export const sensorCategories: { id: "dustbin" | "water" | "electricity"; name: string; icon: string; metrics: SensorMetric[] }[] = [
  { id: "dustbin", name: "Dustbin Sensor", icon: "♻", metrics: ["dustbin", "waste_diverted"] },
  { id: "water", name: "Water Level Sensor", icon: "◉", metrics: ["water_level"] },
  { id: "electricity", name: "Electricity Sensor", icon: "ϟ", metrics: ["electricity"] },
];

export type SensorCard = { id: string; name: string; icon: string; status: "NOT CONNECTED" | "CONNECTED" | "STALE"; latest: SensorReading | null };

export function buildSensorCards(readings: SensorReading[], now = Date.now(), staleAfterMs = 15 * 60 * 1000): SensorCard[] {
  const ordered = [...readings].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  return sensorCategories.map((category) => {
    const latest = ordered.find((reading) => category.metrics.includes(reading.metric)) ?? null;
    const age = latest ? now - Date.parse(latest.recordedAt) : null;
    const status: SensorCard["status"] = age === null ? "NOT CONNECTED" : age >= staleAfterMs || age < 0 ? "STALE" : "CONNECTED";
    return { id: category.id, name: category.name, icon: category.icon, status, latest };
  });
}
