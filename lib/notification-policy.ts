import type { AuditEvent } from "@/lib/campus-store";

export function countUnreadNotifications(events: AuditEvent[], readThrough: string | null): number {
  if (!readThrough) return events.length;
  const cutoff = Date.parse(readThrough);
  if (Number.isNaN(cutoff)) return events.length;
  return events.filter((event) => Date.parse(event.createdAt) > cutoff).length;
}

export function newestNotificationDate(events: AuditEvent[]): string | null {
  return events.reduce<string | null>((newest, event) =>
    !newest || Date.parse(event.createdAt) > Date.parse(newest) ? event.createdAt : newest, null);
}
