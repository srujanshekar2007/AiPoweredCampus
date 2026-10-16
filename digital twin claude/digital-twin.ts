
 // =====================================================================
 // EcoTwin Digital Twin - shared TypeScript types
 // Compatible with the existing campus_issues schema
 // =====================================================================

/* ------------------------------ Navigation ------------------------------ */

export type TwinLevel = 'campus' | 'building' | 'floor' | 'room';

export type UserRole = 'student' | 'worker' | 'admin';

/* ------------------------------ Database rows ------------------------------ */

export type IssueStatus = 'pending' | 'in_progress' | 'resolved';

export interface Building {
  id: string;
  name: string;
  position_x: number;
  position_z: number;
  size_x: number;
  size_y: number;
  size_z: number;
  floor_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface Floor {
  id: string;
  building_id: string;
  floor_number: number;
  plan_image_url: string | null;
  created_at?: string;
}

export interface Room {
  id: string;
  floor_id: string;
  name: string;
  room_type: string;
  created_at?: string;
}

/**
 * Matches public.campus_issues.
 * room_id is the nullable relationship added for the Digital Twin.
 */
export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  priority: string;
  status: IssueStatus;
  reporter: string;
  reporter_id: string | null;
  assignee: string | null;
  assignee_id: string | null;
  evidence: unknown;
  source: string;
  room_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the client supplies when reporting a new issue. */
export interface NewIssueInput {
  title: string;
  description: string;
  category: string;
  location: string;
  priority: string;
  reporter: string;
  reporter_id: string | null;
  evidence?: unknown;
  source?: string;
  room_id?: string | null;
}

/* ------------------------------ Aggregated data ------------------------------ */

export interface TwinData {
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  issues: Issue[];
}

export const EMPTY_TWIN_DATA: TwinData = {
  buildings: [],
  floors: [],
  rooms: [],
  issues: [],
};

/* ------------------------------ Status markers ------------------------------ */

export type MarkerStatus = 'red' | 'green' | 'none';

export interface StatusSummary {
  marker: MarkerStatus;
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
}

export const UNRESOLVED_STATUSES: readonly IssueStatus[] = [
  'pending',
  'in_progress',
];

export function isUnresolved(status: IssueStatus): boolean {
  return status !== 'resolved';
}

export function summarizeIssues(issues: readonly Issue[]): StatusSummary {
  const totalIssues = issues.length;
  const openIssues = issues.reduce(
    (count, issue) => count + (isUnresolved(issue.status) ? 1 : 0),
    0
  );

  const marker: MarkerStatus =
    totalIssues === 0 ? 'none' : openIssues > 0 ? 'red' : 'green';

  return {
    marker,
    totalIssues,
    openIssues,
    resolvedIssues: totalIssues - openIssues,
  };
}

/* ------------------------------ Camera ------------------------------ */

export type Vec3 = [number, number, number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/* ------------------------------ Breadcrumbs ------------------------------ */

export interface BreadcrumbItem {
  level: TwinLevel;
  label: string;
}

/* ------------------------------ Mock session ------------------------------ */

export interface TwinUser {
  id: string | null;
  name: string;
  role: UserRole;
}
