'use client';

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Edges, Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import {
  getBuildingIssues,
  getFloorIssues,
  getRoomIssues,
  useTwinStore,
} from '@/store/useTwinStore';
import { getFloorBaseY, getFloorHeight, layoutRooms, type RoomSlot } from '@/lib/twin/layout';
import { summarizeIssues, type Building, type Room, type StatusSummary } from '@/types/digital-twin';
import { StatusMarkers } from './StatusMarkers';

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

/** Ignore clicks that were really the end of a camera drag. */
const DRAG_THRESHOLD_PX = 5;
const isDrag = (e: ThreeEvent<MouseEvent>) => e.delta > DRAG_THRESHOLD_PX;

const NO_RAYCAST = () => null;

const ROOM_COLORS = {
  none: '#cbd5e1',
  red: '#fca5a5',
  green: '#86efac',
  selected: '#60a5fa',
} as const;

/** Loads an optional floor-plan image without suspending the whole scene. */
function usePlanTexture(url: string | null | undefined) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      },
      undefined,
      () => {
        if (!cancelled) setTexture(null); // bad URL: silently fall back to a plain plate
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => () => texture?.dispose(), [texture]);

  return texture;
}

/* ---------------------------------------------------------------------- */
/* Room block (floor / room level)                                        */
/* ---------------------------------------------------------------------- */

interface RoomBlockProps {
  room: Room;
  slot: RoomSlot;
  baseY: number;
  height: number;
  summary: StatusSummary;
  selected: boolean;
  onSelect: (roomId: string) => void;
}

function RoomBlock({ room, slot, baseY, height, summary, selected, onSelect }: RoomBlockProps) {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered]);

  const color = selected ? ROOM_COLORS.selected : ROOM_COLORS[summary.marker];
  const centerY = baseY + height / 2;
  const topY = baseY + height;

  return (
    <group position={[slot.x, 0, slot.z]}>
      <mesh
        position={[0, centerY, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          if (isDrag(e)) return;
          e.stopPropagation();
          onSelect(room.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[slot.width, height, slot.depth]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered || selected ? 0.35 : 0.05}
          roughness={0.7}
        />
        <Edges color={selected ? '#1d4ed8' : '#475569'} />
      </mesh>

      <Html position={[0, topY + 0.05, 0]} center distanceFactor={12} pointerEvents="none" zIndexRange={[20, 0]}>
        <span className="whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 shadow">
          {room.name}
        </span>
      </Html>

      <StatusMarkers position={[0, topY + 0.9, 0]} summary={summary} size="sm" />
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* Cut-away floor (floor / room level, selected building only)            */
/* ---------------------------------------------------------------------- */

interface FloorCutawayProps {
  building: Building;
  floorId: string;
}

function FloorCutaway({ building, floorId }: FloorCutawayProps) {
  const data = useTwinStore((s) => s.data);
  const selectedRoomId = useTwinStore((s) => s.selectedRoomId);
  const selectRoom = useTwinStore((s) => s.selectRoom);

  const floor = useMemo(() => data.floors.find((f) => f.id === floorId), [data.floors, floorId]);
  const rooms = useMemo(() => data.rooms.filter((r) => r.floor_id === floorId), [data.rooms, floorId]);
  const slots = useMemo(() => layoutRooms(building, rooms), [building, rooms]);
  const planTexture = usePlanTexture(floor?.plan_image_url);

  if (!floor) return null;

  const { size_x: sx, size_z: sz } = building;
  const fh = getFloorHeight(building);
  const baseY = getFloorBaseY(building, floor.floor_number);
  const plateH = 0.15;
  const roomH = Math.min(fh * 0.6, 2.4);
  const roomBaseY = baseY + plateH;

  return (
    <group>
      {/* Everything beneath the selected floor, as a translucent plinth. */}
      {baseY > 0 && (
        <mesh position={[0, baseY / 2, 0]} raycast={NO_RAYCAST}>
          <boxGeometry args={[sx, baseY, sz]} />
          <meshStandardMaterial color="#94a3b8" transparent opacity={0.3} depthWrite={false} />
          <Edges color="#64748b" />
        </mesh>
      )}

      {/* Floor plate */}
      <mesh position={[0, baseY + plateH / 2, 0]} receiveShadow castShadow raycast={NO_RAYCAST}>
        <boxGeometry args={[sx, plateH, sz]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>

      {/* Optional uploaded floor plan, laid on top of the plate. */}
      {planTexture && (
        <mesh position={[0, baseY + plateH + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
          <planeGeometry args={[sx, sz]} />
          <meshBasicMaterial map={planTexture} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      )}

      {/* Ghost outline of the storey's volume. */}
      <mesh position={[0, baseY + fh / 2, 0]} raycast={NO_RAYCAST}>
        <boxGeometry args={[sx, fh, sz]} />
        <meshBasicMaterial visible={false} />
        <Edges color="#334155" />
      </mesh>

      {/* Rooms */}
      {slots.map((slot) => {
        const room = rooms.find((r) => r.id === slot.roomId);
        if (!room) return null;
        return (
          <RoomBlock
            key={room.id}
            room={room}
            slot={slot}
            baseY={roomBaseY}
            height={roomH}
            summary={summarizeIssues(getRoomIssues(data, room.id))}
            selected={room.id === selectedRoomId}
            onSelect={selectRoom}
          />
        );
      })}
    </group>
  );
}

/* ---------------------------------------------------------------------- */
/* ProceduralBuilding                                                     */
/* ---------------------------------------------------------------------- */

interface ProceduralBuildingProps {
  /** Row from the `buildings` table. Size and position come only from here. */
  building: Building;
}

export function ProceduralBuilding({ building }: ProceduralBuildingProps) {
  const level = useTwinStore((s) => s.currentLevel);
  const selectedBuildingId = useTwinStore((s) => s.selectedBuildingId);
  const selectedFloorId = useTwinStore((s) => s.selectedFloorId);
  const isHovered = useTwinStore((s) => s.hoveredBuildingId === building.id);
  const data = useTwinStore((s) => s.data);
  const selectBuilding = useTwinStore((s) => s.selectBuilding);
  const selectFloor = useTwinStore((s) => s.selectFloor);
  const setHoveredBuilding = useTwinStore((s) => s.setHoveredBuilding);

  const { id, name, position_x: px, position_z: pz, size_x: sx, size_y: sy, size_z: sz, floor_count } = building;

  const isSelected = selectedBuildingId === id;
  const isDimmed = selectedBuildingId !== null && !isSelected;
  const showCutaway = isSelected && (level === 'floor' || level === 'room') && selectedFloorId !== null;

  const floors = useMemo(
    () =>
      data.floors
        .filter((f) => f.building_id === id)
        .sort((a, b) => a.floor_number - b.floor_number),
    [data.floors, id],
  );

  const summary = useMemo(() => summarizeIssues(getBuildingIssues(data, id)), [data, id]);

  const floorHeight = getFloorHeight(building);

  // Pointer cursor while hovering a clickable building.
  useEffect(() => {
    if (!isHovered) return;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [isHovered]);

  // A hovered building that becomes non-interactive must release the hover state.
  useEffect(() => {
    if (showCutaway && isHovered) setHoveredBuilding(null);
  }, [showCutaway, isHovered, setHoveredBuilding]);

  const interactive = !showCutaway && (level === 'campus' || level === 'building');

  const bodyColor = isHovered && interactive ? '#7dd3c0' : isSelected ? '#cfd8e3' : '#d6dde6';
  const bodyOpacity = isDimmed ? 0.18 : isSelected ? 0.92 : 1;

  return (
    <group position={[px, 0, pz]}>
      {/* ------------------------------ Solid body ------------------------------ */}
      {!showCutaway && (
        <>
          <mesh
            position={[0, sy / 2, 0]}
            castShadow
            receiveShadow
            raycast={interactive ? undefined : NO_RAYCAST}
            onClick={(e) => {
              if (isDrag(e)) return;
              e.stopPropagation();
              if (!isSelected || level !== 'building') selectBuilding(id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredBuilding(id);
            }}
            onPointerOut={() => setHoveredBuilding(null)}
          >
            <boxGeometry args={[sx, sy, sz]} />
            <meshStandardMaterial
              color={bodyColor}
              roughness={0.65}
              metalness={0.05}
              transparent={bodyOpacity < 1}
              opacity={bodyOpacity}
              depthWrite={bodyOpacity >= 1}
            />
            <Edges color={isSelected ? '#0f766e' : '#64748b'} />
          </mesh>

          {/* Storey dividers so floor_count is visible on the facade. */}
          {Array.from({ length: Math.max(0, floor_count - 1) }, (_, i) => (
            <mesh key={i} position={[0, (i + 1) * floorHeight, 0]} raycast={NO_RAYCAST}>
              <boxGeometry args={[sx + 0.08, 0.07, sz + 0.08]} />
              <meshStandardMaterial color="#64748b" transparent opacity={isDimmed ? 0.15 : 0.8} />
            </mesh>
          ))}

          {/* Roof cap */}
          <mesh position={[0, sy + 0.1, 0]} castShadow raycast={NO_RAYCAST}>
            <boxGeometry args={[sx + 0.2, 0.2, sz + 0.2]} />
            <meshStandardMaterial color="#475569" transparent={isDimmed} opacity={isDimmed ? 0.2 : 1} />
          </mesh>
        </>
      )}

      {/* ----------------------------- Cut-away floor ----------------------------- */}
      {showCutaway && selectedFloorId && <FloorCutaway building={building} floorId={selectedFloorId} />}

      {/* ------------------------------- Campus UI ------------------------------- */}
      {level === 'campus' && (
        <>
          <Html position={[0, sy + 0.7, 0]} center distanceFactor={14} pointerEvents="none" zIndexRange={[20, 0]}>
            <span className="whitespace-nowrap rounded-md bg-slate-900/80 px-2 py-1 text-xs font-semibold text-white shadow-lg">
              {name}
            </span>
          </Html>
          <StatusMarkers position={[0, sy + 2.1, 0]} summary={summary} size="lg" />
        </>
      )}

      {/* ----------------- Building level: one marker per floor ----------------- */}
      {isSelected &&
        level === 'building' &&
        floors.map((floor) => {
          const floorSummary = summarizeIssues(getFloorIssues(data, floor.id));
          return (
            <StatusMarkers
              key={floor.id}
              position={[sx / 2 + 0.6, getFloorBaseY(building, floor.floor_number) + floorHeight / 2, sz / 2 + 0.6]}
              summary={floorSummary}
              label={`F${floor.floor_number}`}
              size="md"
              onClick={() => selectFloor(floor.id)}
            />
          );
        })}
    </group>
  );
}
