import type { CampusIssue, IssueStatus } from "@/lib/campus-store";
import type { CampusRole } from "@/lib/authz";

export type IssueChanges = Partial<Pick<CampusIssue, "status" | "assignee" | "assigneeId" | "priority" | "evidence">>;

export function canClaimIssue(role: CampusRole, issue: CampusIssue): boolean {
  return role === "worker" && issue.source === "user" && issue.status === "open" && issue.assigneeId === null && issue.assignee === null;
}

export function isValidTransition(from: IssueStatus, to: IssueStatus, role: CampusRole): boolean {
  if (from === to) return true;
  if (role === "worker") return (from === "assigned" && to === "in_progress") || (from === "in_progress" && to === "resolved");
  if (role !== "admin") return false;
  return (from === "open" && to === "assigned") || (from === "assigned" && (to === "open" || to === "in_progress")) || (from === "in_progress" && to === "resolved") || (from === "resolved" && (to === "verified" || to === "in_progress")) || (from === "verified" && to === "in_progress");
}

export function canUpdateIssue(role: CampusRole, issue: CampusIssue, changes: IssueChanges, actorName: string, actorId?: string): boolean {
  const keys = Object.keys(changes);
  if (role === "student") return false;
  if (role === "admin") return changes.status === undefined || isValidTransition(issue.status, changes.status, role);
  if (role === "worker") return (issue.assigneeId === actorId || (!issue.assigneeId && issue.assignee === actorName)) && keys.every((key) => key === "status" || key === "evidence") && (changes.status === undefined || isValidTransition(issue.status, changes.status, role));
  return false;
}

export function auditAction(changes: IssueChanges): string {
  if (changes.assignee !== undefined) return changes.assignee ? "assigned" : "unassigned";
  if (changes.status === "in_progress") return "started";
  if (changes.status === "resolved") return "marked_resolved";
  if (changes.status === "verified") return "verified";
  if (changes.status === "open") return "reopened";
  if (changes.priority !== undefined) return "priority_changed";
  if (changes.evidence !== undefined) return "evidence_added";
  return "updated";
}
