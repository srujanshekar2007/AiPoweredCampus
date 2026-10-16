"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { AuditEvent, CampusIssue } from "@/lib/campus-store";
import { countUnreadNotifications, newestNotificationDate } from "@/lib/notification-policy";
import { markNotificationEventsRead, useNotificationReadThrough } from "@/components/notifications/useNotificationReadState";

const labels: Record<string, string> = { reported: "New report submitted", assigned: "Issue assigned", unassigned: "Assignment removed", started: "Work started", marked_resolved: "Work marked resolved", verified: "Completion verified", reopened: "Issue reopened", priority_changed: "Priority changed", evidence_added: "Evidence added", updated: "Issue updated" };

export default function NotificationCenter({ role, issues, auditLog, readScope }: { role: string; issues: CampusIssue[]; auditLog: AuditEvent[]; readScope: string }) {
  const readThrough = useNotificationReadThrough(readScope);
  const visibleIds = useMemo(() => new Set(issues.map((issue) => issue.id)), [issues]);
  const notifications = useMemo(() => auditLog.filter((event) => visibleIds.has(event.issueId)), [auditLog, visibleIds]);
  const unreadCount = countUnreadNotifications(notifications, readThrough);

  function markAllRead() {
    const newest = newestNotificationDate(notifications) ?? new Date().toISOString();
    markNotificationEventsRead(readScope, newest);
  }

  return <main className="management-page"><Link className="back-link" href={`/workspace/${role}`}>← Workspace</Link><header><p className="eyebrow">CAMPUS UPDATES</p><h1>Notifications</h1><p>Issue activity for records visible to this workspace. Read status is saved in this browser for this account.</p></header><section className="panel glass-panel management-card"><div className="panel-heading"><div><p className="eyebrow">ISSUE ACTIVITY</p><h2>{notifications.length} recent update{notifications.length === 1 ? "" : "s"}{unreadCount > 0 ? ` · ${unreadCount} unread` : ""}</h2></div><div className="notification-tools"><span className="source-tag">RECORD-BASED</span><button className="mini-action" type="button" disabled={unreadCount === 0} onClick={markAllRead}>Mark all read</button></div></div>{notifications.length ? notifications.map((event) => { const issue = issues.find((item) => item.id === event.issueId); const unread = !readThrough || Date.parse(event.createdAt) > Date.parse(readThrough); return <Link className={`notification-item${unread ? " unread" : ""}`} href={`/workspace/${role}#${event.issueId}`} key={event.id}><span className="notification-icon">{event.action === "verified" ? "✓" : event.action === "marked_resolved" ? "↗" : "◷"}</span><span className="notification-copy"><strong>{labels[event.action] ?? "Issue updated"} · {event.issueId}</strong><span>{issue?.title ?? "Issue record"} · {event.actorName}</span><small>{new Date(event.createdAt).toLocaleString()}</small></span>{unread && <span className="notification-unread" aria-label="Unread"/>}<span className="issue-chevron">›</span></Link>; }) : <div className="empty-state"><strong>No issue updates yet</strong><p>New reports, assignments, and task changes will appear here.</p></div>}</section></main>;
}
