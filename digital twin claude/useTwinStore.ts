import { create } from 'zustand';
import type {
  Building,
  BreadcrumbItem,
  Floor,
  Issue,
  IssueStatus,
  NewIssueInput,
  Room,
  TwinData,
  TwinLevel,
  UserRole,
} from '@/types/digital-twin';
import { EMPTY_TWIN_DATA } from '@/types/digital-twin';

/* ---------------------------------------------------------------------- */
/* State shape                                                            */
/* ---------------------------------------------------------------------- */

interface TwinState {
  /* Navigation */
  currentLevel: TwinLevel;
  selectedBuildingId: string | null;
  selectedFloorId: string | null;
  selectedRoomId: string | null;
  hoveredBuildingId: string | null;

  /* Session (mocked; replace with Supabase auth later) */
  userRole: UserRole;
  currentUserId: string | null;

  /* Data (hydrated from Supabase) */
  data: TwinData;
  isLoading: boolean;
  error: string | null;
}

interface TwinActions {
  /* Navigation */
  selectBuilding: (buildingId: string) => void;
  selectFloor: (floorId: string) => void;
  selectRoom: (roomId: string) => void;
  /** Jump back to an ancestor level (used by breadcrumbs). */
  goToLevel: (level: TwinLevel) => void;
  /** Go up exactly one level. */
  goBack: () => void;
  resetToCampus: () => void;
  setHoveredBuilding: (buildingId: string | null) => void;

  /* Session */
  setUserRole: (role: UserRole) => void;
  setCurrentUserId: (userId: string | null) => void;

  /* Data */
  setData: (data: TwinData) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  /* Issue mutations (local / optimistic; the data layer persists to Supabase) */
  upsertIssue: (issue: Issue) => void;
  removeIssue: (issueId: string) => void;
  addLocalIssue: (input: NewIssueInput, id?: string) => Issue;
  updateIssueStatus: (issueId: string, status: IssueStatus) => void;
  assignIssue: (issueId: string, workerId: string | null) => void;
}

export type TwinStore = TwinState & TwinActions;

/* ---------------------------------------------------------------------- */
/* Store                                                                  */
/* ---------------------------------------------------------------------- */

const initialNavigation = {
  currentLevel: 'campus' as TwinLevel,
  selectedBuildingId: null,
  selectedFloorId: null,
  selectedRoomId: null,
};

export const useTwinStore = create<TwinStore>((set, get) => ({
  ...initialNavigation,
  hoveredBuildingId: null,

  userRole: 'admin',
  currentUserId: null,

  data: EMPTY_TWIN_DATA,
  isLoading: false,
  error: null,

  /* ----------------------------- Navigation ----------------------------- */

  selectBuilding: (buildingId) =>
    set({
      currentLevel: 'building',
      selectedBuildingId: buildingId,
      selectedFloorId: null,
      selectedRoomId: null,
    }),

  selectFloor: (floorId) => {
    const floor = get().data.floors.find((f) => f.id === floorId);
    set((s) => ({
      currentLevel: 'floor',
      selectedBuildingId: floor?.building_id ?? s.selectedBuildingId,
      selectedFloorId: floorId,
      selectedRoomId: null,
    }));
  },

  selectRoom: (roomId) => {
    const { data } = get();
    const room = data.rooms.find((r) => r.id === roomId);
    const floor = room ? data.floors.find((f) => f.id === room.floor_id) : undefined;
    set((s) => ({
      currentLevel: 'room',
      selectedBuildingId: floor?.building_id ?? s.selectedBuildingId,
      selectedFloorId: room?.floor_id ?? s.selectedFloorId,
      selectedRoomId: roomId,
    }));
  },

  goToLevel: (level) => {
    switch (level) {
      case 'campus':
        set({ ...initialNavigation });
        break;
      case 'building':
        set((s) => ({
          currentLevel: s.selectedBuildingId ? 'building' : 'campus',
          selectedFloorId: null,
          selectedRoomId: null,
        }));
        break;
      case 'floor':
        set((s) => ({
          currentLevel: s.selectedFloorId ? 'floor' : s.selectedBuildingId ? 'building' : 'campus',
          selectedRoomId: null,
        }));
        break;
      case 'room':
        // Already the deepest level; nothing to change.
        break;
    }
  },

  goBack: () => {
    const { currentLevel, goToLevel } = get();
    const parent: Record<TwinLevel, TwinLevel> = {
      room: 'floor',
      floor: 'building',
      building: 'campus',
      campus: 'campus',
    };
    goToLevel(parent[currentLevel]);
  },

  resetToCampus: () => set({ ...initialNavigation }),

  setHoveredBuilding: (buildingId) => set({ hoveredBuildingId: buildingId }),

  /* ------------------------------- Session ------------------------------- */

  setUserRole: (role) => set({ userRole: role }),
  setCurrentUserId: (userId) => set({ currentUserId: userId }),

  /* -------------------------------- Data -------------------------------- */

  setData: (data) => set({ data, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  /* ---------------------------- Issue mutations ---------------------------- */

  upsertIssue: (issue) =>
    set((s) => {
      const exists = s.data.issues.some((i) => i.id === issue.id);
      const issues = exists
        ? s.data.issues.map((i) => (i.id === issue.id ? { ...i, ...issue } : i))
        : [...s.data.issues, issue];
      return { data: { ...s.data, issues } };
    }),

  removeIssue: (issueId) =>
    set((s) => ({
      data: { ...s.data, issues: s.data.issues.filter((i) => i.id !== issueId) },
    })),

  addLocalIssue: (input, id) => {
    const issue: Issue = {
      id: id ?? crypto.randomUUID(),
      room_id: input.room_id,
      status: 'pending',
      description: input.description,
      reported_by: input.reported_by,
      assigned_to: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
    };
    get().upsertIssue(issue);
    return issue;
  },

  updateIssueStatus: (issueId, status) =>
    set((s) => ({
      data: {
        ...s.data,
        issues: s.data.issues.map((i) =>
          i.id === issueId
            ? {
                ...i,
                status,
                updated_at: new Date().toISOString(),
                resolved_at: status === 'resolved' ? new Date().toISOString() : null,
              }
            : i,
        ),
      },
    })),

  assignIssue: (issueId, workerId) =>
    set((s) => ({
      data: {
        ...s.data,
        issues: s.data.issues.map((i) =>
          i.id === issueId
            ? {
                ...i,
                assigned_to: workerId,
                // Assigning a pending issue moves it into progress.
                status: workerId && i.status === 'pending' ? 'in_progress' : i.status,
                updated_at: new Date().toISOString(),
              }
            : i,
        ),
      },
    })),
}));

/* ---------------------------------------------------------------------- */
/* Selectors (use with useTwinStore(selector) or call getState())          */
/* ---------------------------------------------------------------------- */

export const selectSelectedBuilding = (s: TwinStore): Building | undefined =>
  s.data.buildings.find((b) => b.id === s.selectedBuildingId);

export const selectSelectedFloor = (s: TwinStore): Floor | undefined =>
  s.data.floors.find((f) => f.id === s.selectedFloorId);

export const selectSelectedRoom = (s: TwinStore): Room | undefined =>
  s.data.rooms.find((r) => r.id === s.selectedRoomId);

export const selectFloorsOfBuilding =
  (buildingId: string | null) =>
  (s: TwinStore): Floor[] =>
    buildingId
      ? s.data.floors
          .filter((f) => f.building_id === buildingId)
          .sort((a, b) => a.floor_number - b.floor_number)
      : [];

export const selectRoomsOfFloor =
  (floorId: string | null) =>
  (s: TwinStore): Room[] =>
    floorId ? s.data.rooms.filter((r) => r.floor_id === floorId) : [];

/** All issues inside a building (through floors -> rooms). */
export function getBuildingIssues(data: TwinData, buildingId: string): Issue[] {
  const floorIds = new Set(data.floors.filter((f) => f.building_id === buildingId).map((f) => f.id));
  const roomIds = new Set(data.rooms.filter((r) => floorIds.has(r.floor_id)).map((r) => r.id));
  return data.issues.filter((i) => roomIds.has(i.room_id));
}

/** All issues inside a floor. */
export function getFloorIssues(data: TwinData, floorId: string): Issue[] {
  const roomIds = new Set(data.rooms.filter((r) => r.floor_id === floorId).map((r) => r.id));
  return data.issues.filter((i) => roomIds.has(i.room_id));
}

/** All issues inside a room. */
export function getRoomIssues(data: TwinData, roomId: string): Issue[] {
  return data.issues.filter((i) => i.room_id === roomId);
}

/** Breadcrumb trail, e.g. Campus > Science Block > Floor 2 > Lab 101. */
export function selectBreadcrumbs(s: TwinStore): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [{ level: 'campus', label: 'Campus' }];
  const building = selectSelectedBuilding(s);
  if (building) crumbs.push({ level: 'building', label: building.name });
  const floor = selectSelectedFloor(s);
  if (floor) crumbs.push({ level: 'floor', label: `Floor ${floor.floor_number}` });
  const room = selectSelectedRoom(s);
  if (room) crumbs.push({ level: 'room', label: room.name });
  return crumbs;
}
