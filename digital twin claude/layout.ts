import type { Building, CameraPose, Floor, Room, TwinLevel, Vec3 } from '@/types/digital-twin';

/* ---------------------------------------------------------------------- */
/* Shared geometry + camera maths. Pure functions, no React / Three deps.   */
/* Both the camera controller and the 3D meshes use these so they always    */
/* agree on where a floor or a room physically sits in the scene.           */
/* ---------------------------------------------------------------------- */

export const CAMERA_FOV = 45;

/** Height of a single storey, derived from the building's size and floor count. */
export function getFloorHeight(building: Building): number {
  return building.size_y / Math.max(1, building.floor_count);
}

/** Y coordinate of the bottom of a floor (floor_number is 1-based). */
export function getFloorBaseY(building: Building, floorNumber: number): number {
  return (floorNumber - 1) * getFloorHeight(building);
}

/* ------------------------------ Campus bounds ------------------------------ */

export interface CampusBounds {
  center: Vec3;
  /** Radius of a circle (on the ground plane) that encloses every building. */
  radius: number;
  maxHeight: number;
}

export function getCampusBounds(buildings: readonly Building[]): CampusBounds {
  if (buildings.length === 0) return { center: [0, 0, 0], radius: 20, maxHeight: 10 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let maxHeight = 0;

  for (const b of buildings) {
    minX = Math.min(minX, b.position_x - b.size_x / 2);
    maxX = Math.max(maxX, b.position_x + b.size_x / 2);
    minZ = Math.min(minZ, b.position_z - b.size_z / 2);
    maxZ = Math.max(maxZ, b.position_z + b.size_z / 2);
    maxHeight = Math.max(maxHeight, b.size_y);
  }

  return {
    center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    radius: Math.max(0.5 * Math.hypot(maxX - minX, maxZ - minZ), maxHeight, 8),
    maxHeight,
  };
}

/* ------------------------------ Room layout ------------------------------ */

/** A room's footprint in BUILDING-LOCAL coordinates (origin = building centre). */
export interface RoomSlot {
  roomId: string;
  x: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * Rooms have no coordinates in the database, so they are laid out on a grid
 * that fills the floor footprint. Ordering is deterministic (name, then id)
 * so a room always lands in the same cell between renders and sessions.
 */
export function layoutRooms(building: Building, rooms: readonly Room[]): RoomSlot[] {
  if (rooms.length === 0) return [];

  const sorted = [...rooms].sort(
    (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.id.localeCompare(b.id),
  );

  const innerW = building.size_x * 0.92;
  const innerD = building.size_z * 0.92;
  const aspect = innerW / innerD;

  const cols = Math.min(sorted.length, Math.max(1, Math.round(Math.sqrt(sorted.length * aspect))));
  const rows = Math.ceil(sorted.length / cols);
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const gap = Math.min(cellW, cellD) * 0.08;

  return sorted.map((room, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      roomId: room.id,
      x: -innerW / 2 + cellW * (col + 0.5),
      z: -innerD / 2 + cellD * (row + 0.5),
      width: cellW - gap,
      depth: cellD - gap,
    };
  });
}

/* ------------------------------ Camera poses ------------------------------ */

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function placeCamera(target: Vec3, direction: Vec3, distance: number): CameraPose {
  const d = normalize(direction);
  return {
    target,
    position: [target[0] + d[0] * distance, target[1] + d[1] * distance, target[2] + d[2] * distance],
  };
}

export interface PoseContext {
  level: TwinLevel;
  buildings: readonly Building[];
  building?: Building;
  floor?: Floor;
  roomSlot?: RoomSlot;
}

/** Isometric elevation (~35 degrees) used for the campus overview. */
const ISO_DIRECTION: Vec3 = [1, 0.82, 1];

export function computeCameraPose({ level, buildings, building, floor, roomSlot }: PoseContext): CameraPose {
  if (level !== 'campus' && building) {
    const { position_x: bx, position_z: bz, size_x: sx, size_y: sy, size_z: sz } = building;

    // Building: frame the whole bounding box from an isometric-ish angle.
    if (level === 'building' || !floor) {
      const radius = 0.5 * Math.hypot(sx, sy, sz);
      return placeCamera([bx, sy / 2, bz], [1, 0.7, 1], radius * 2.5 + 3);
    }

    const fh = getFloorHeight(building);
    const baseY = getFloorBaseY(building, floor.floor_number);

    // Floor: steep, near top-down view of the cut-away floor plate.
    if (level === 'floor' || !roomSlot) {
      const radius = 0.5 * Math.hypot(sx, sz);
      return placeCamera([bx, baseY + fh * 0.25, bz], [0.3, 1.25, 0.75], radius * 2.3 + 3);
    }

    // Room: close-up on the selected room's cell.
    const radius = 0.5 * Math.hypot(roomSlot.width, roomSlot.depth);
    return placeCamera(
      [bx + roomSlot.x, baseY + fh * 0.25, bz + roomSlot.z],
      [0.35, 1, 0.8],
      Math.max(radius * 3.2, 5),
    );
  }

  // Campus: isometric overview of every building.
  const bounds = getCampusBounds(buildings);
  return placeCamera(bounds.center, ISO_DIRECTION, bounds.radius * 2.5 + 8);
}
