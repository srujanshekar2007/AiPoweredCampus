'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CameraControls } from '@react-three/drei';
import { useTwinStore } from '@/store/useTwinStore';
import { computeCameraPose, layoutRooms } from '@/lib/twin/layout';

/**
 * Drives drei's <CameraControls> from the navigation state in the Zustand store.
 *
 *   campus   -> isometric overview of every building
 *   building -> frames the selected building's bounding box
 *   floor    -> steep view of the selected floor plate
 *   room     -> close-up on the selected room
 *
 * Any state change (store action, breadcrumb click, panel button) results in a
 * smooth transition, because the pose is derived from state, not from clicks.
 */
export function CameraController() {
  const controlsRef = useRef<React.ElementRef<typeof CameraControls>>(null);
  const hasPositioned = useRef(false);

  const level = useTwinStore((s) => s.currentLevel);
  const selectedBuildingId = useTwinStore((s) => s.selectedBuildingId);
  const selectedFloorId = useTwinStore((s) => s.selectedFloorId);
  const selectedRoomId = useTwinStore((s) => s.selectedRoomId);
  const data = useTwinStore((s) => s.data);

  const pose = useMemo(() => {
    const building = data.buildings.find((b) => b.id === selectedBuildingId);
    const floor = data.floors.find((f) => f.id === selectedFloorId);

    let roomSlot;
    if (building && floor && selectedRoomId) {
      const floorRooms = data.rooms.filter((r) => r.floor_id === floor.id);
      roomSlot = layoutRooms(building, floorRooms).find((slot) => slot.roomId === selectedRoomId);
    }

    return computeCameraPose({ level, buildings: data.buildings, building, floor, roomSlot });
  }, [level, selectedBuildingId, selectedFloorId, selectedRoomId, data.buildings, data.floors, data.rooms]);

  // Stable primitive key so the effect only fires when the pose really changes.
  const poseKey = [...pose.position, ...pose.target].map((n) => n.toFixed(2)).join('|');

  useEffect(() => {
    const controls = controlsRef.current;
    // Wait for data: with no buildings the "campus" pose is meaningless.
    if (!controls || data.buildings.length === 0) return;

    const [px, py, pz] = pose.position;
    const [tx, ty, tz] = pose.target;

    // First placement snaps (no fly-in from the origin); later ones animate.
    void controls.setLookAt(px, py, pz, tx, ty, tz, hasPositioned.current);
    hasPositioned.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseKey, data.buildings.length]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.55}
      draggingSmoothTime={0.12}
      minDistance={3}
      maxDistance={260}
      // Keep the camera above the ground plane.
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI / 2.05}
      dollySpeed={0.6}
    />
  );
}
