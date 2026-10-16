
import { authConfigured } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import type { IssueChanges } from "@/lib/issue-policy";

export type IssueStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "verified";

export type CampusIssue = {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: IssueStatus;
  reporter: string;
  reporterId: string | null;
  assignee: string | null;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  evidence: string[];
  source: "user";
};

export type AuditEvent = {
  id: string;
  issueId: string;
  actorName: string;
  action: string;
  changes: Record<string, unknown>;
  createdAt: string;
  source: "user";
};

export type SensorMetric =
  | "dustbin"
  | "water_level"
  | "electricity"
  | "water"
  | "waste_diverted";

export type SensorReading = {
  id: string;
  deviceId: string;
  metric: SensorMetric;
  value: number;
  unit: string;
  location: string;
  recordedAt: string;
  readingType: "interval_total" | "level" | "counter";
};

function requireSupabase() {
  if (!authConfigured()) {
    throw new Error(
      "Campus data is unavailable because the Supabase project is not configured."
    );
  }
}

/**
 * Converts a database issue row into the application's issue format.
 */
function mapIssue(row: any): CampusIssue {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,
    priority: row.priority,
    status: row.status,
    reporter: row.reporter,
    reporterId: row.reporter_id ?? null,
    assignee: row.assignee ?? null,
    assigneeId: row.assignee_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: row.evidence ?? [],
    source: "user",
  };
}

/**
 * Loads campus issues and audit history.
 *
 * Issue query failures are logged with full diagnostic details.
 * Audit history is optional and will not prevent issues from loading.
 */
export async function getCampusData() {
  requireSupabase();

  const supabase = await createClient();

  const [
    { data: rows, error },
    { data: events, error: auditError },
  ] = await Promise.all([
    supabase
      .from("campus_issues")
      .select("*")
      .eq("source", "user")
      .order("created_at", { ascending: false }),

    supabase
      .from("issue_audit_log")
      .select("*")
      .eq("source", "user")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (error) {
    console.error("[campus] issue records query failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    throw new Error(
      `Failed to load campus issues: ${error.message} (${error.code ?? "unknown"})`
    );
  }

  if (auditError) {
    console.warn("[campus] audit history is unavailable", {
      message: auditError.message,
      code: auditError.code,
      details: auditError.details,
      hint: auditError.hint,
    });
  }

  return {
    issues: (rows ?? []).map(mapIssue),

    auditLog: (events ?? []).map((event) => ({
      id: event.id,
      issueId: event.issue_id,
      actorName: event.actor_name,
      action: event.action,
      changes: event.changes ?? {},
      createdAt: event.created_at,
      source: "user" as const,
    })),

    auditLogAvailable: !auditError,
  };
}

/**
 * Creates a campus issue using the authenticated user's identity.
 */
export async function createIssue(
  input: {
    title: string;
    description: string;
    category: string;
    location: string;
    priority: CampusIssue["priority"];
    evidence?: string[];
  },
  reporter: { id: string; name: string }
) {
  requireSupabase();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campus_issues")
    .insert({
      title: input.title,
      description: input.description,
      category: input.category,
      location: input.location,
      priority: input.priority,
      reporter: reporter.name,
      reporter_id: reporter.id,
      evidence: input.evidence ?? [],
      source: "user",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[campus] issue creation failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    throw error;
  }

  return mapIssue(data);
}

/**
 * Updates an existing campus issue.
 */
export async function updateIssue(
  id: string,
  changes: IssueChanges
) {
  requireSupabase();

  const supabase = await createClient();

  const payload = {
    ...("status" in changes
      ? { status: changes.status }
      : {}),
    ...("assignee" in changes
      ? { assignee: changes.assignee }
      : {}),
    ...("assigneeId" in changes
      ? { assignee_id: changes.assigneeId }
      : {}),
    ...("priority" in changes
      ? { priority: changes.priority }
      : {}),
    ...("evidence" in changes
      ? { evidence: changes.evidence }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("campus_issues")
    .update(payload)
    .eq("id", id)
    .eq("source", "user")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[campus] issue update failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      issueId: id,
    });

    throw error;
  }

  if (!data) return null;

  return mapIssue(data);
}

/**
 * Atomically claims an open, unassigned issue for a worker.
 * Database policies must independently enforce worker authorization.
 */
export async function claimIssue(
  id: string,
  worker: { id: string; name: string }
) {
  requireSupabase();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campus_issues")
    .update({
      assignee_id: worker.id,
      assignee: worker.name,
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("source", "user")
    .eq("status", "open")
    .is("assignee_id", null)
    .is("assignee", null)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[campus] issue claim failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      issueId: id,
    });

    throw error;
  }

  if (!data) return null;

  return mapIssue(data);
}

/**
 * Loads sensor readings from Supabase.
 */
export async function getSensorReadings(
  limit = 300
): Promise<SensorReading[]> {
  requireSupabase();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sensor_readings")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[campus] sensor readings query failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    metric: row.metric,
    value: Number(row.value),
    unit: row.unit,
    location: row.location,
    recordedAt: row.recorded_at,
    readingType: row.reading_type,
  }));
}

/**
 * Inserts sensor readings using the server-only service role key.
 * Never expose this key to browser code.
 */
export async function addSensorReading(input: {
  deviceId: string;
  metric: SensorMetric;
  value: number;
  unit: string;
  location: string;
  readingType: SensorReading["readingType"];
}) {
  requireSupabase();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !projectUrl) {
    throw new Error(
      "Sensor ingestion requires the server-only SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const { createClient: createServiceClient } =
    await import("@supabase/supabase-js");

  const service = createServiceClient(
    projectUrl,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await service
    .from("sensor_readings")
    .insert({
      device_id: input.deviceId,
      metric: input.metric,
      value: input.value,
      unit: input.unit,
      location: input.location,
      reading_type: input.readingType,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[campus] sensor reading insertion failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });

    throw error;
  }

  return {
    id: data.id,
    deviceId: data.device_id,
    metric: data.metric as SensorMetric,
    value: Number(data.value),
    unit: data.unit,
    location: data.location,
    recordedAt: data.recorded_at,
    readingType: data.reading_type as SensorReading["readingType"],
  };
}
