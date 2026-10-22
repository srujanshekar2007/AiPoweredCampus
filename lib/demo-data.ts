import type { AuditEvent, CampusIssue, SensorReading } from "@/lib/campus-store";
import { SAMPLE_TWIN_DATA } from "@/components/twin/sample-data";
import type { SustainabilityPageResult } from "@/components/sustainability/ScenarioCalculator";
import { buildSensorCards } from "@/lib/sensor-status";

export type DemoRole = "student" | "worker" | "admin";
export type DemoWorkspaceData = {
  identity: { id: string; name: string; email: string };
  issues: CampusIssue[];
  auditLog: AuditEvent[];
  readings: SensorReading[];
  sensors: ReturnType<typeof buildSensorCards>;
  workers: { userId: string; fullName: string; campusId: string }[];
};

const SAMPLE_TIME = "2026-10-23T08:00:00.000Z";
const sampleIssues: CampusIssue[] = [
  { id: "DEMO-1041", title: "Recycling station is overflowing", description: "The mixed recycling bin near the library entrance needs collection.", category: "Waste", location: "Library · Ground floor · East entrance", priority: "high", status: "open", reporter: "Maya Demo", reporterId: "demo-student", assignee: null, assigneeId: null, createdAt: SAMPLE_TIME, updatedAt: SAMPLE_TIME, evidence: [], source: "user" },
  { id: "DEMO-1042", title: "Water leak near wash area", description: "A tap continues to drip after it is turned off.", category: "Water", location: "Engineering Block · Floor 2 · E-204", priority: "medium", status: "assigned", reporter: "Maya Demo", reporterId: "demo-student", assignee: "Arjun Sample", assigneeId: "demo-worker", createdAt: SAMPLE_TIME, updatedAt: SAMPLE_TIME, evidence: [], source: "user" },
  { id: "DEMO-1043", title: "Lights left on after the last class", description: "Several corridor lights remained on overnight.", category: "Electrical", location: "Academic Block · Floor 4 · A-412", priority: "low", status: "in_progress", reporter: "Nisha Example", reporterId: "sample-student-2", assignee: "Arjun Sample", assigneeId: "demo-worker", createdAt: SAMPLE_TIME, updatedAt: SAMPLE_TIME, evidence: [], source: "user" },
  { id: "DEMO-1044", title: "Compost bin lid needs repair", description: "The lid hinge is loose at the student commons collection point.", category: "Waste", location: "Student Commons · Courtyard", priority: "medium", status: "resolved", reporter: "Ravi Sample", reporterId: "sample-student-3", assignee: "Leena Sample", assigneeId: "demo-worker-2", createdAt: SAMPLE_TIME, updatedAt: SAMPLE_TIME, evidence: [], source: "user" },
  { id: "DEMO-1045", title: "Tank sensor reading fluctuating", description: "The north reservoir level indicator is inconsistent in this sample scenario.", category: "Water", location: "North reservoir", priority: "low", status: "verified", reporter: "Campus Demo", reporterId: "sample-student-3", assignee: "Arjun Sample", assigneeId: "demo-worker", createdAt: SAMPLE_TIME, updatedAt: SAMPLE_TIME, evidence: [], source: "user" },
];

export const DEMO_WORKERS = [
  { userId: "demo-worker", fullName: "Arjun Sample", campusId: "DEMO-W01" },
  { userId: "demo-worker-2", fullName: "Leena Sample", campusId: "DEMO-W02" },
];

export const DEMO_SENSOR_READINGS: SensorReading[] = [
  { id: "DEMO-S01", deviceId: "DEMO-POWER-A", metric: "electricity", value: 2140, unit: "kWh", location: "Academic Block", recordedAt: SAMPLE_TIME, readingType: "interval_total" },
  { id: "DEMO-S02", deviceId: "DEMO-WATER-C", metric: "water", value: 13600, unit: "L", location: "Library", recordedAt: SAMPLE_TIME, readingType: "interval_total" },
  { id: "DEMO-S03", deviceId: "DEMO-TANK-N", metric: "water_level", value: 78, unit: "%", location: "North reservoir", recordedAt: SAMPLE_TIME, readingType: "level" },
  { id: "DEMO-S04", deviceId: "DEMO-WASTE-01", metric: "waste_diverted", value: 64, unit: "kg", location: "Student Commons", recordedAt: SAMPLE_TIME, readingType: "interval_total" },
];

const sampleAuditLog: AuditEvent[] = sampleIssues.slice(0, 4).map((issue, index) => ({
  id: `DEMO-EVENT-${index + 1}`,
  issueId: issue.id,
  actorName: index % 2 ? "Arjun Sample" : "Maya Demo",
  action: ["reported", "assigned", "started", "marked_resolved"][index],
  changes: {},
  createdAt: SAMPLE_TIME,
  source: "user",
}));

export function getDemoWorkspaceData(role: DemoRole): DemoWorkspaceData {
  const identity = role === "student"
    ? { id: "demo-student", name: "Maya Demo", email: "maya@example.invalid" }
    : role === "worker"
      ? { id: "demo-worker", name: "Arjun Sample", email: "arjun@example.invalid" }
      : { id: "demo-admin", name: "Casey Sample", email: "casey@example.invalid" };

  const issues = role === "student"
    ? sampleIssues.filter((issue) => issue.reporterId === identity.id)
    : role === "worker"
      ? sampleIssues.filter((issue) => issue.status === "open" || issue.assigneeId === identity.id)
      : sampleIssues;
  const visibleIds = new Set(issues.map((issue) => issue.id));

  return {
    identity,
    issues,
    auditLog: sampleAuditLog.filter((event) => visibleIds.has(event.issueId)),
    readings: DEMO_SENSOR_READINGS,
    sensors: buildSensorCards(DEMO_SENSOR_READINGS),
    workers: role === "admin" ? DEMO_WORKERS : [],
  };
}

const reading = (id: string, metric: string, value: number, unit: string, day: number): SustainabilityPageResult["readings"][number] => ({
  id, deviceId: `DEMO-${metric.toUpperCase()}`, metric, value, unit,
  location: metric === "water" ? "Library meter" : "Academic Block meter",
  recordedAt: new Date(Date.parse(SAMPLE_TIME) - day * 60 * 60 * 1000).toISOString(),
  readingType: "interval_total",
});

export const DEMO_SUSTAINABILITY_RESULT: SustainabilityPageResult = {
  period: "today",
  error: "",
  readings: [
    reading("DEMO-R01", "electricity", 1420, "kWh", 2), reading("DEMO-R02", "water", 11200, "L", 3),
    reading("DEMO-R03", "electricity", 1580, "kWh", 4), reading("DEMO-R04", "waste_generated", 76, "kg", 5),
    reading("DEMO-R05", "water", 12800, "L", 6), reading("DEMO-R06", "waste_diverted", 52, "kg", 7),
    reading("DEMO-R07", "electricity", 1710, "kWh", 8), reading("DEMO-R08", "water", 13600, "L", 9),
  ],
  data: {
    period: "today", timezone: "Asia/Kolkata", start: new Date(Date.parse(SAMPLE_TIME) - 24 * 60 * 60 * 1000).toISOString(), end: SAMPLE_TIME,
    previousStart: new Date(Date.parse(SAMPLE_TIME) - 48 * 60 * 60 * 1000).toISOString(), previousEnd: new Date(Date.parse(SAMPLE_TIME) - 24 * 60 * 60 * 1000).toISOString(),
    electricity: { unit: "kWh", current: 12480, previous: 13620 },
    water: { unit: "L", current: 86200, previous: 90900 },
    wasteGenerated: { unit: "kg", current: 540, previous: 575 },
    wasteDiverted: { unit: "kg", current: 388, previous: 362 },
  },
};

export { SAMPLE_TWIN_DATA };
