import assert from "node:assert/strict";
import test from "node:test";
import { auditAction, canClaimIssue, canUpdateIssue, isValidTransition } from "@/lib/issue-policy";
import type { CampusIssue } from "@/lib/campus-store";
import { countUnreadNotifications, newestNotificationDate } from "@/lib/notification-policy";
import type { AuditEvent } from "@/lib/campus-store";
import { buildActivityCsv } from "@/lib/activity-export";

const issue: CampusIssue = {
  id: "ET-TEST", title: "Leaking tap", description: "Water is pooling", category: "Water", location: "Block A",
  priority: "medium", status: "assigned", reporter: "Aarav Nair", reporterId: "student-1", assignee: "Ravi Kumar", assigneeId: "worker-1",
  createdAt: "2026-10-15T00:00:00.000Z", updatedAt: "2026-10-15T00:00:00.000Z", evidence: [], source: "user",
};

test("worker can move assigned work into progress and resolve it", () => {
  assert.equal(isValidTransition("assigned", "in_progress", "worker"), true);
  assert.equal(isValidTransition("in_progress", "resolved", "worker"), true);
  assert.equal(isValidTransition("assigned", "verified", "worker"), false);
});

test("admin can assign and verify while students cannot update issues", () => {
  assert.equal(canUpdateIssue("admin", { ...issue, status: "open", assignee: null }, { status: "assigned", assignee: "Ravi Kumar" }, "Meera Rao"), true);
  assert.equal(canUpdateIssue("admin", { ...issue, status: "resolved" }, { status: "verified" }, "Meera Rao"), true);
  assert.equal(canUpdateIssue("student", issue, { status: "in_progress" }, "Aarav Nair"), false);
});

test("workers can only update their own assigned task and evidence", () => {
  assert.equal(canUpdateIssue("worker", issue, { status: "in_progress" }, "Ravi Kumar", "worker-1"), true);
  assert.equal(canUpdateIssue("worker", issue, { status: "in_progress" }, "Ananya Das", "worker-2"), false);
  assert.equal(canUpdateIssue("worker", issue, { priority: "urgent" }, "Ravi Kumar", "worker-1"), false);
});

test("verified workers can claim only open, unassigned student reports", () => {
  const available = { ...issue, status: "open" as const, assignee: null, assigneeId: null };
  assert.equal(canClaimIssue("worker", available), true);
  assert.equal(canClaimIssue("student", available), false);
  assert.equal(canClaimIssue("admin", available), false);
  assert.equal(canClaimIssue("worker", issue), false);
  assert.equal(canClaimIssue("worker", { ...available, status: "resolved" }), false);
  assert.equal(canClaimIssue("worker", { ...available, assignee: "Ravi Kumar" }), false);
  assert.equal(canClaimIssue("worker", { ...available, assigneeId: "worker-1" }), false);
});

test("audit action labels describe common workflow updates", () => {
  assert.equal(auditAction({ assignee: "Ravi Kumar" }), "assigned");
  assert.equal(auditAction({ status: "verified" }), "verified");
  assert.equal(auditAction({ priority: "high" }), "priority_changed");
});

test("read-through timestamp counts only newer issue notifications as unread", () => {
  const events: AuditEvent[] = [
    { id: "a", issueId: issue.id, actorName: "Meera Rao", action: "assigned", changes: {}, createdAt: "2026-10-15T10:00:00.000Z", source: "user" },
    { id: "b", issueId: issue.id, actorName: "Ravi Kumar", action: "started", changes: {}, createdAt: "2026-10-15T11:00:00.000Z", source: "user" },
  ];
  assert.equal(countUnreadNotifications(events, "2026-10-15T10:30:00.000Z"), 1);
  assert.equal(countUnreadNotifications(events, null), 2);
  assert.equal(newestNotificationDate(events), "2026-10-15T11:00:00.000Z");
});

test("activity export quotes fields and neutralizes spreadsheet formulas", () => {
  const event: AuditEvent = { id: "evt-1", issueId: issue.id, actorName: "=HYPERLINK(\"https://bad.example\")", action: "reported", changes: { note: "water, valve" }, createdAt: "2026-10-15T10:00:00.000Z", source: "user" };
  const csv = buildActivityCsv([event], [{ ...issue, title: "Tap, east wing" }]);
  assert.match(csv, /"'=/);
  assert.match(csv, /"Tap, east wing"/);
  assert.match(csv, /"\{""note"":""water, valve""\}"/);
  assert.equal(csv.split("\r\n").length, 2);
});
