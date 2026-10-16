import type { AuditEvent, CampusIssue } from "@/lib/campus-store";

function safeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  const protectedValue = /^[\s]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function buildActivityCsv(events: AuditEvent[], issues: CampusIssue[]): string {
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const header = ["event_id", "occurred_at", "actor", "action", "issue_id", "issue_title", "category", "location", "source", "changes"];
  const rows = events.map((event) => {
    const issue = issueById.get(event.issueId);
    return [event.id, event.createdAt, event.actorName, event.action, event.issueId, issue?.title ?? "", issue?.category ?? "", issue?.location ?? "", event.source, JSON.stringify(event.changes)];
  });
  return [header, ...rows].map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
}
