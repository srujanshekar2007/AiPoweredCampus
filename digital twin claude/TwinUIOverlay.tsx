'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { assignIssue, reportIssue, setIssueStatus } from '@/lib/twin/actions';
import { layoutRooms } from '@/lib/twin/layout';
import { useWorkers, type WorkerProfile } from '@/hooks/useTwinData';
import { getBuildingIssues, getFloorIssues, getRoomIssues, useTwinStore } from '@/store/useTwinStore';
import {
  summarizeIssues,
  type Building,
  type Floor,
  type Issue,
  type IssueStatus,
  type MarkerStatus,
  type Room,
  type UserRole,
} from '@/types/digital-twin';

/* ---------------------------------------------------------------------- */
/* Small shared pieces                                                    */
/* ---------------------------------------------------------------------- */

const STATUS_LABEL: Record<IssueStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

const STATUS_STYLE: Record<IssueStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  in_progress: 'bg-sky-100 text-sky-800 ring-sky-200',
  resolved: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
};

const MARKER_DOT: Record<MarkerStatus, string> = {
  red: 'bg-red-500',
  green: 'bg-emerald-500',
  none: 'bg-slate-300',
};

const MARKER_FILL: Record<MarkerStatus, string> = {
  red: '#fca5a5',
  green: '#86efac',
  none: '#e2e8f0',
};

const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Student',
  worker: 'Worker',
  admin: 'Admin',
};

const panelClass =
  'pointer-events-auto rounded-2xl border border-white/60 bg-white/90 p-4 shadow-xl backdrop-blur-md';

function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'green' }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
      <div className={`text-xl font-bold leading-none ${color}`}>{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Header: breadcrumbs + demo role switcher                               */
/* ---------------------------------------------------------------------- */

function Breadcrumbs() {
  const level = useTwinStore((s) => s.currentLevel);
  const data = useTwinStore((s) => s.data);
  const buildingId = useTwinStore((s) => s.selectedBuildingId);
  const floorId = useTwinStore((s) => s.selectedFloorId);
  const roomId = useTwinStore((s) => s.selectedRoomId);
  const goToLevel = useTwinStore((s) => s.goToLevel);

  const crumbs = useMemo(() => {
    const items: { level: 'campus' | 'building' | 'floor' | 'room'; label: string }[] = [
      { level: 'campus', label: 'Campus' },
    ];
    const b = data.buildings.find((x) => x.id === buildingId);
    const f = data.floors.find((x) => x.id === floorId);
    const r = data.rooms.find((x) => x.id === roomId);
    if (b) items.push({ level: 'building', label: b.name });
    if (f) items.push({ level: 'floor', label: `Floor ${f.floor_number}` });
    if (r) items.push({ level: 'room', label: r.name });
    return items;
  }, [data, buildingId, floorId, roomId]);

  return (
    <nav aria-label="Breadcrumb" className="pointer-events-auto rounded-full border border-white/60 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-md">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const isCurrent = crumb.level === level;
          return (
            <li key={crumb.level} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-400">&gt;</span>}
              {isCurrent ? (
                <span aria-current="page" className="font-semibold text-slate-900">
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => goToLevel(crumb.level)}
                  className="text-slate-600 underline-offset-2 hover:text-teal-700 hover:underline"
                >
                  {crumb.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function RoleSwitcher() {
  const role = useTwinStore((s) => s.userRole);
  const setUserRole = useTwinStore((s) => s.setUserRole);

  return (
    <label className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/60 bg-white/90 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
      <span className="font-medium text-slate-500">Demo role</span>
      <select
        value={role}
        onChange={(e) => setUserRole(e.target.value as UserRole)}
        className="rounded-md bg-transparent font-semibold text-slate-900 focus:outline-none"
      >
        {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ---------------------------------------------------------------------- */
/* Building context panel                                                 */
/* ---------------------------------------------------------------------- */

function BuildingPanel({ building }: { building: Building }) {
  const data = useTwinStore((s) => s.data);
  const selectedFloorId = useTwinStore((s) => s.selectedFloorId);
  const selectFloor = useTwinStore((s) => s.selectFloor);
  const resetToCampus = useTwinStore((s) => s.resetToCampus);

  const summary = useMemo(() => summarizeIssues(getBuildingIssues(data, building.id)), [data, building.id]);

  const floors = useMemo(
    () =>
      data.floors
        .filter((f) => f.building_id === building.id)
        .sort((a, b) => a.floor_number - b.floor_number)
        .map((f) => ({ floor: f, summary: summarizeIssues(getFloorIssues(data, f.id)) })),
    [data, building.id],
  );

  return (
    <motion.section
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.25 }}
      className={panelClass}
    >
      <button type="button" onClick={resetToCampus} className="mb-2 text-xs font-medium text-teal-700 hover:underline">
        &larr; Back to campus
      </button>

      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${MARKER_DOT[summary.marker]}`} />
        <h2 className="text-lg font-bold text-slate-900">{building.name}</h2>
      </div>
      <p className="text-xs text-slate-500">
        {building.floor_count} floor{building.floor_count === 1 ? '' : 's'}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatCard label="Total issues" value={summary.totalIssues} />
        <StatCard label="Open" value={summary.openIssues} tone={summary.openIssues > 0 ? 'red' : undefined} />
        <StatCard label="Resolved" value={summary.resolvedIssues} tone={summary.resolvedIssues > 0 ? 'green' : undefined} />
      </div>

      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Floors</h3>
      <div className="grid grid-cols-3 gap-2">
        {floors.map(({ floor, summary: fs }) => {
          const active = floor.id === selectedFloorId;
          return (
            <button
              key={floor.id}
              type="button"
              onClick={() => selectFloor(floor.id)}
              className={`flex flex-col items-start rounded-xl px-3 py-2 text-left ring-1 transition ${
                active ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-800 ring-slate-200 hover:ring-teal-400'
              }`}
            >
              <span className="text-sm font-semibold">Floor {floor.floor_number}</span>
              <span className="mt-1 flex items-center gap-1 text-[11px]">
                <span className={`h-2 w-2 rounded-full ${MARKER_DOT[fs.marker]}`} />
                {fs.marker === 'none' ? 'No issues' : fs.openIssues > 0 ? `${fs.openIssues} open` : 'All clear'}
              </span>
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}

/* ---------------------------------------------------------------------- */
/* Floor plan view (2D overlay with clickable rooms)                      */
/* ---------------------------------------------------------------------- */

function FloorPlanView({ building, floor }: { building: Building; floor: Floor }) {
  const data = useTwinStore((s) => s.data);
  const selectedRoomId = useTwinStore((s) => s.selectedRoomId);
  const selectRoom = useTwinStore((s) => s.selectRoom);

  const rooms = useMemo(() => data.rooms.filter((r) => r.floor_id === floor.id), [data.rooms, floor.id]);
  const slots = useMemo(() => layoutRooms(building, rooms), [building, rooms]);

  const { size_x: sx, size_z: sz } = building;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.25 }}
      className={panelClass}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-slate-900">Floor {floor.floor_number} plan</h3>
        <span className="text-[11px] text-slate-500">{rooms.length} rooms</span>
      </div>

      {rooms.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">No rooms on this floor yet.</p>
      ) : (
        <svg viewBox={`${-sx / 2} ${-sz / 2} ${sx} ${sz}`} className="w-full rounded-lg bg-slate-100 ring-1 ring-slate-200" role="group" aria-label={`Floor ${floor.floor_number} plan`}>
          <rect x={-sx / 2} y={-sz / 2} width={sx} height={sz} fill="none" stroke="#64748b" strokeWidth={sx * 0.008} />
          {slots.map((slot) => {
            const room = rooms.find((r) => r.id === slot.roomId);
            if (!room) return null;
            const marker = summarizeIssues(getRoomIssues(data, room.id)).marker;
            const active = room.id === selectedRoomId;
            const fontSize = Math.min(slot.width, slot.depth) * 0.17;
            return (
              <g
                key={room.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${room.name}`}
                className="cursor-pointer outline-none"
                onClick={() => selectRoom(room.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectRoom(room.id);
                  }
                }}
              >
                <rect
                  x={slot.x - slot.width / 2}
                  y={slot.z - slot.depth / 2}
                  width={slot.width}
                  height={slot.depth}
                  rx={slot.width * 0.04}
                  fill={active ? '#60a5fa' : MARKER_FILL[marker]}
                  stroke={active ? '#1d4ed8' : '#475569'}
                  strokeWidth={Math.min(sx, sz) * 0.006}
                  className="transition-opacity hover:opacity-80"
                />
                <text
                  x={slot.x}
                  y={slot.z}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight={600}
                  fill="#0f172a"
                  pointerEvents="none"
                >
                  {room.name}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </motion.section>
  );
}

/* ---------------------------------------------------------------------- */
/* Room detail & issue panel (role-based)                                 */
/* ---------------------------------------------------------------------- */

function IssueCard({ issue, children }: { issue: Issue; children?: React.ReactNode }) {
  return (
    <li className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-slate-800">{issue.description}</p>
        <StatusBadge status={issue.status} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">Reported {formatDate(issue.created_at)}</p>
      {children && <div className="mt-2">{children}</div>}
    </li>
  );
}

function ReportIssueForm({ room, onDone }: { room: Room; onDone: () => void }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const ok = await reportIssue(room.id, text); // room.id pre-filled
    setSubmitting(false);
    if (ok) {
      setText('');
      onDone();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="text-xs text-slate-500">
        Room: <span className="font-semibold text-slate-800">{room.name}</span>
      </div>
      <label htmlFor="issue-description" className="sr-only">
        Describe the issue
      </label>
      <textarea
        id="issue-description"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What's wrong? e.g. Leaking tap near the window"
        className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}

function MarkCompleteButton({ issue }: { issue: Issue }) {
  const [busy, setBusy] = useState(false);
  if (issue.status === 'resolved') return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await setIssueStatus(issue.id, 'resolved');
        setBusy(false);
      }}
      className="w-full rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
    >
      {busy ? 'Saving…' : 'Mark Complete'}
    </button>
  );
}

function AdminControls({ issue, workers }: { issue: Issue; workers: WorkerProfile[] }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-500">
          Status
          <select
            value={issue.status}
            onChange={(e) => void setIssueStatus(issue.id, e.target.value as IssueStatus)}
            className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
          >
            {(Object.keys(STATUS_LABEL) as IssueStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-500">
          Assigned to
          <select
            value={issue.assigned_to ?? ''}
            onChange={(e) => void assignIssue(issue.id, e.target.value || null)}
            className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
          >
            <option value="">Unassigned</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.full_name ?? w.id.slice(0, 8)}
              </option>
            ))}
            {/* Keep an assignee visible even if they are not in the loaded worker list. */}
            {issue.assigned_to && !workers.some((w) => w.id === issue.assigned_to) && (
              <option value={issue.assigned_to}>{issue.assigned_to.slice(0, 8)}…</option>
            )}
          </select>
        </label>
      </div>
      <MarkCompleteButton issue={issue} />
    </div>
  );
}

function RoomPanel({ room }: { room: Room }) {
  const role = useTwinStore((s) => s.userRole);
  const currentUserId = useTwinStore((s) => s.currentUserId);
  const data = useTwinStore((s) => s.data);
  const goBack = useTwinStore((s) => s.goBack);

  const [showForm, setShowForm] = useState(false);
  const workers = useWorkers(role === 'admin');

  useEffect(() => setShowForm(false), [room.id]);

  const issues = useMemo(() => getRoomIssues(data, room.id), [data, room.id]);
  const summary = useMemo(() => summarizeIssues(issues), [issues]);
  const assignedToMe = useMemo(
    () => (currentUserId ? issues.filter((i) => i.assigned_to === currentUserId) : []),
    [issues, currentUserId],
  );

  return (
    <motion.aside
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.25 }}
      className={`${panelClass} flex max-h-full flex-col`}
    >
      <button type="button" onClick={goBack} className="mb-2 self-start text-xs font-medium text-teal-700 hover:underline">
        &larr; Back to floor
      </button>

      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${MARKER_DOT[summary.marker]}`} />
        <h2 className="text-lg font-bold text-slate-900">{room.name}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-600">{room.room_type}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {summary.totalIssues === 0
          ? 'No issues on record'
          : `${summary.openIssues} open · ${summary.resolvedIssues} resolved`}
        <span className="mx-1">·</span>
        Viewing as {ROLE_LABEL[role]}
      </p>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* ------------------------------- Student ------------------------------- */}
        {role === 'student' && (
          <>
            {showForm ? (
              <ReportIssueForm room={room} onDone={() => setShowForm(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="w-full rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-teal-700"
              >
                Report New Issue
              </button>
            )}
            <IssueList issues={issues} empty="Nothing reported for this room yet." />
          </>
        )}

        {/* ------------------------------- Worker -------------------------------- */}
        {role === 'worker' && (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">My assigned tasks</h3>
            {!currentUserId ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                Sign in as a worker to see tasks assigned to you.
              </p>
            ) : assignedToMe.length === 0 ? (
              <p className="py-2 text-sm text-slate-500">No tasks assigned to you in this room.</p>
            ) : (
              <ul className="space-y-2">
                {assignedToMe.map((issue) => (
                  <IssueCard key={issue.id} issue={issue}>
                    <MarkCompleteButton issue={issue} />
                  </IssueCard>
                ))}
              </ul>
            )}
            {issues.length - assignedToMe.length > 0 && (
              <p className="text-[11px] text-slate-400">
                {issues.length - assignedToMe.length} other issue(s) in this room are not assigned to you.
              </p>
            )}
          </>
        )}

        {/* -------------------------------- Admin -------------------------------- */}
        {role === 'admin' && (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              All issues ({issues.length})
            </h3>
            {issues.length === 0 ? (
              <p className="py-2 text-sm text-slate-500">Nothing reported for this room yet.</p>
            ) : (
              <ul className="space-y-2">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue}>
                    <AdminControls issue={issue} workers={workers} />
                  </IssueCard>
                ))}
              </ul>
            )}
            {workers.length === 0 && (
              <p className="text-[11px] text-slate-400">
                No workers found. Set a profile&apos;s role to &apos;worker&apos; and apply schema_patch_01.sql.
              </p>
            )}
          </>
        )}
      </div>
    </motion.aside>
  );
}

function IssueList({ issues, empty }: { issues: Issue[]; empty: string }) {
  if (issues.length === 0) return <p className="py-2 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------- */
/* Status toasts                                                          */
/* ---------------------------------------------------------------------- */

function StatusToasts() {
  const isLoading = useTwinStore((s) => s.isLoading);
  const error = useTwinStore((s) => s.error);
  const setError = useTwinStore((s) => s.setError);
  const buildingCount = useTwinStore((s) => s.data.buildings.length);

  // Mutation errors fade on their own; load errors stay until dismissed.
  useEffect(() => {
    if (!error || buildingCount === 0) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error, buildingCount, setError]);

  return (
    <>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-slate-900/85 px-4 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            Loading campus…
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            role="alert"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="pointer-events-auto absolute bottom-4 left-1/2 flex max-w-md -translate-x-1/2 items-start gap-3 rounded-xl bg-red-600 px-4 py-3 text-sm text-white shadow-xl"
          >
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="font-bold leading-none">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoading && !error && buildingCount === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-xl bg-white/90 px-5 py-3 text-sm text-slate-600 shadow-lg">
            No buildings found. Run schema.sql (it includes sample data) in Supabase.
          </p>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* TwinUIOverlay                                                          */
/* ---------------------------------------------------------------------- */

export function TwinUIOverlay() {
  const level = useTwinStore((s) => s.currentLevel);
  const data = useTwinStore((s) => s.data);
  const selectedBuildingId = useTwinStore((s) => s.selectedBuildingId);
  const selectedFloorId = useTwinStore((s) => s.selectedFloorId);
  const selectedRoomId = useTwinStore((s) => s.selectedRoomId);
  const goBack = useTwinStore((s) => s.goBack);

  const building = useMemo(
    () => (selectedBuildingId ? data.buildings.find((b) => b.id === selectedBuildingId) : undefined),
    [data.buildings, selectedBuildingId],
  );
  const floor = useMemo(
    () => (selectedFloorId ? data.floors.find((f) => f.id === selectedFloorId) : undefined),
    [data.floors, selectedFloorId],
  );
  const room = useMemo(
    () => (selectedRoomId ? data.rooms.find((r) => r.id === selectedRoomId) : undefined),
    [data.rooms, selectedRoomId],
  );

  // Escape steps back one level.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === 'Escape' && tag !== 'TEXTAREA' && tag !== 'INPUT' && tag !== 'SELECT') goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack]);

  const showBuilding = level !== 'campus' && building;
  const showPlan = (level === 'floor' || level === 'room') && building && floor;
  const showRoom = level === 'room' && room;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Header */}
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
        <Breadcrumbs />
        <RoleSwitcher />
      </div>

      {/* Left column: building context + floor plan */}
      <div className="absolute bottom-4 left-4 top-20 flex w-80 flex-col gap-3 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {showBuilding && <BuildingPanel key={`building-${building.id}`} building={building} />}
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          {showPlan && <FloorPlanView key={`plan-${floor.id}`} building={building} floor={floor} />}
        </AnimatePresence>
      </div>

      {/* Right column: room detail */}
      <div className="absolute bottom-4 right-4 top-20 flex w-[22rem] flex-col">
        <AnimatePresence mode="wait">{showRoom && <RoomPanel key={`room-${room.id}`} room={room} />}</AnimatePresence>
      </div>

      <StatusToasts />
    </div>
  );
}

export default TwinUIOverlay;
