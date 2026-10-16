
"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  CameraControls,
  Edges,
  Text,
  AdaptiveDpr,
  Grid,
} from "@react-three/drei";

import type { CampusIssue } from "@/lib/campus-store";
import type {
  Building,
  Floor,
  Room,
  TwinData,
  TwinLevel,
} from "@/components/twin/types";

import {
  CAMERA_FOV,
  computeCameraPose,
  getCampusBounds,
  getFloorBaseY,
  getFloorHeight,
  layoutRooms,
} from "@/components/twin/layout";

type Position3 = [number, number, number];

function CameraRig({
  data,
  level,
  building,
  floor,
  room,
}: {
  data: TwinData;
  level: TwinLevel;
  building?: Building;
  floor?: Floor;
  room?: Room;
}) {
  const controls = useRef<React.ElementRef<typeof CameraControls>>(null);
  const buildingFloorNumbers = building
    ? data.floors
        .filter((item) => item.building_id === building.id)
        .map((item) => item.floor_number)
    : [];
  const firstFloorNumber = buildingFloorNumbers.length
    ? Math.min(...buildingFloorNumbers)
    : 1;

  const pose = useMemo(() => {
    const slots =
      building && floor
        ? layoutRooms(
            building,
            data.rooms.filter((item) => item.floor_id === floor.id)
          )
        : [];

    const roomSlot = room
      ? slots.find((slot) => slot.roomId === room.id)
      : undefined;

    return computeCameraPose({
      level,
      buildings: data.buildings,
      building,
      floor,
      roomSlot,
      firstFloorNumber,
    });
  }, [data, level, building, floor, room, firstFloorNumber]);

  const poseKey = [
    ...pose.position,
    ...pose.target,
  ].join(":");

  useEffect(() => {
    let cancelled = false;

    const updateCamera = async () => {
      const control = controls.current;
      if (!control || cancelled) return;

      const [x, y, z] = pose.position;
      const [tx, ty, tz] = pose.target;

      try {
        await control.setLookAt(
          x,
          y,
          z,
          tx,
          ty,
          tz,
          true
        );
      } catch (error) {
        if (!cancelled) {
          console.error("[twin] Camera update failed", error);
        }
      }
    };

    void updateCamera();

    return () => {
      cancelled = true;
    };
  }, [poseKey, pose]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.55}
      minDistance={3}
      maxDistance={300}
      maxPolarAngle={Math.PI / 2.05}
    />
  );
}

function IssuePin({
  issue,
  position,
  onSelect,
}: {
  issue: CampusIssue;
  position: Position3;
  onSelect: (issue: CampusIssue) => void;
}) {
  const color =
    issue.status === "resolved"
      ? "#69a37e"
      : issue.priority === "urgent" || issue.priority === "high"
        ? "#d96f5f"
        : "#d6a24f";

  return (
    <group
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(issue);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.35, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0, 0.43, 0]}>
        <sphereGeometry args={[0.2, 18, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>

      <Text
        position={[0, 0.78, 0]}
        fontSize={0.34}
        color="#385546"
        anchorX="center"
        anchorY="middle"
      >
        {issue.id}
      </Text>
    </group>
  );
}

function CampusModel({
  data,
  issues,
  level,
  building,
  floor,
  room,
  onBuilding,
  onRoom,
  onIssue,
}: {
  data: TwinData;
  issues: CampusIssue[];
  level: TwinLevel;
  building?: Building;
  floor?: Floor;
  room?: Room;
  onBuilding: (id: string) => void;
  onRoom: (id: string) => void;
  onIssue: (issue: CampusIssue) => void;
}) {
  const bounds = useMemo(
    () => getCampusBounds(data.buildings),
    [data.buildings]
  );

  const radius = bounds.radius;

  const selectedRooms =
    building && floor
      ? data.rooms.filter((item) => item.floor_id === floor.id)
      : [];

  const buildingFloorNumbers = building
    ? data.floors
        .filter((item) => item.building_id === building.id)
        .map((item) => item.floor_number)
    : [];
  const firstFloorNumber = buildingFloorNumbers.length
    ? Math.min(...buildingFloorNumbers)
    : 1;

  const slots = building
    ? layoutRooms(building, selectedRooms)
    : [];

  const cutaway = Boolean(
    building &&
      floor &&
      (level === "floor" || level === "room")
  );

  const matchedBuilding = (issue: CampusIssue) =>
    data.buildings.find((item) =>
      issue.location
        .toLowerCase()
        .includes(item.name.toLowerCase())
    );

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  return (
    <>
      <color attach="background" args={["#e8f1eb"]} />

      <fog
        attach="fog"
        args={["#e8f1eb", radius * 5, radius * 13]}
      />

      <hemisphereLight
        args={["#ffffff", "#91a898", 1.4]}
      />

      <directionalLight
        position={[
          bounds.center[0] + radius,
          radius * 2,
          bounds.center[2] + radius,
        ]}
        intensity={2}
        castShadow
        shadow-mapSize={[1536, 1536]}
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[
          bounds.center[0],
          -0.05,
          bounds.center[2],
        ]}
        receiveShadow
      >
        <planeGeometry args={[radius * 7, radius * 7]} />
        <meshStandardMaterial color="#dce9df" />
      </mesh>

      <Grid
        position={[
          bounds.center[0],
          -0.025,
          bounds.center[2],
        ]}
        args={[radius * 5, radius * 5]}
        cellSize={2}
        cellColor="#b7cbbb"
        sectionSize={10}
        sectionColor="#9fb8a6"
        fadeDistance={radius * 5}
        infiniteGrid
      />

      {data.buildings
        .filter((item) => !cutaway || item.id === building?.id)
        .map((item) => {
        const selected = item.id === building?.id;

        const linked = issues.filter(
          (issue) => matchedBuilding(issue)?.id === item.id
        );

        const active = linked.some(
          (issue) => issue.status !== "resolved"
        );

        const y = item.size_y / 2;
        const color = active
          ? "#d9a38e"
          : selected
            ? "#77ad91"
            : "#a9cdb7";

        const floorHeight = getFloorHeight(item);

        return (
          <group
            key={item.id}
            position={[
              item.position_x,
              0,
              item.position_z,
            ]}
          >
            {!(cutaway && selected) && (
              <>
                <mesh
                  position={[0, y, 0]}
                  castShadow
                  receiveShadow
                  onClick={(event) => {
                    event.stopPropagation();
                    onBuilding(item.id);
                  }}
                  onPointerOver={() => {
                    document.body.style.cursor = "pointer";
                  }}
                  onPointerOut={() => {
                    document.body.style.cursor = "auto";
                  }}
                >
                  <boxGeometry
                    args={[
                      item.size_x,
                      item.size_y,
                      item.size_z,
                    ]}
                  />
                  <meshStandardMaterial
                    color={color}
                    roughness={0.78}
                  />
                  <Edges
                    color={
                      selected ? "#26745c" : "#73927e"
                    }
                  />
                </mesh>

                {Array.from(
                  {
                    length: Math.max(
                      0,
                      item.floor_count - 1
                    ),
                  },
                  (_, i) => (
                    <mesh
                      key={i}
                      position={[
                        0,
                        (i + 1) * floorHeight,
                        0,
                      ]}
                    >
                      <boxGeometry
                        args={[
                          item.size_x + 0.05,
                          0.055,
                          item.size_z + 0.05,
                        ]}
                      />
                      <meshStandardMaterial color="#668d76" />
                    </mesh>
                  )
                )}

                <mesh
                  position={[0, item.size_y + 0.1, 0]}
                >
                  <boxGeometry
                    args={[
                      item.size_x + 0.16,
                      0.2,
                      item.size_z + 0.16,
                    ]}
                  />
                  <meshStandardMaterial color="#6a8873" />
                </mesh>
              </>
            )}

            {cutaway && selected && floor && (
              <>
                <mesh
                  position={[
                    0,
                    getFloorBaseY(
                      item,
                      floor.floor_number,
                      firstFloorNumber
                    ) + 0.08,
                    0,
                  ]}
                >
                  <boxGeometry
                    args={[
                      item.size_x,
                      0.16,
                      item.size_z,
                    ]}
                  />
                  <meshStandardMaterial color="#edf2e9" />
                </mesh>

                {slots.map((slot) => {
                  const roomItem = selectedRooms.find(
                    (candidate) =>
                      candidate.id === slot.roomId
                  );

                  if (!roomItem) return null;

                  const roomIssues = issues.filter(
                    (issue) =>
                      issue.location
                        .toLowerCase()
                        .includes(
                          roomItem.name.toLowerCase()
                        )
                  );

                  const roomActive = roomIssues.some(
                    (issue) =>
                      issue.status !== "resolved" &&
                      issue.status !== "verified"
                  );

                  const roomColor = roomActive
                    ? "#d98d7e"
                    : roomIssues.length
                      ? "#84b993"
                      : roomItem.id === room?.id
                        ? "#73aa91"
                        : "#b8d5c1";
                  const selected = roomItem.id === room?.id;
                  const roomHeight = Math.min(
                    floorHeight * (selected ? 0.6 : 0.45),
                    1.2
                  );

                  return (
                    <group
                      key={roomItem.id}
                      position={[
                        slot.x,
                        getFloorBaseY(
                          item,
                          floor.floor_number,
                          firstFloorNumber
                        ) + 0.24,
                        slot.z,
                      ]}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRoom(roomItem.id);
                      }}
                    >
                      <mesh castShadow>
                        <boxGeometry
                          args={[
                            slot.width,
                            roomHeight,
                            slot.depth,
                          ]}
                        />
                        <meshStandardMaterial
                          color={roomColor}
                        />
                        <Edges color="#759481" />
                      </mesh>

                      <Text
                        position={[0, roomHeight / 2 + 0.16, 0]}
                        fontSize={selected ? 0.32 : 0.27}
                        maxWidth={slot.width * 0.88}
                        color="#385546"
                        anchorX="center"
                        anchorY="middle"
                      >
                        {roomItem.name}
                      </Text>
                    </group>
                  );
                })}
              </>
            )}

            {level === "campus" && (
              <Text
                position={[0, item.size_y + 1.3, 0]}
                fontSize={0.72}
                color="#385546"
                anchorX="center"
                anchorY="middle"
              >
                {item.name}{active ? " · active issues" : ""}
              </Text>
            )}

            {!cutaway && linked.map((issue, index) => (
              <IssuePin
                key={issue.id}
                issue={issue}
                position={[
                  item.size_x * 0.45,
                  item.size_y +
                    1.2 +
                    (index % 3) * 0.45,
                  item.size_z * 0.45,
                ]}
                onSelect={onIssue}
              />
            ))}
          </group>
        );
      })}

      {(level === "campus" || level === "building") && issues
        .filter((issue) => !matchedBuilding(issue))
        .map((issue, index) => (
          <IssuePin
            key={issue.id}
            issue={issue}
            position={[
              bounds.center[0],
              1.2 + (index % 3) * 0.45,
              bounds.center[2],
            ]}
            onSelect={onIssue}
          />
        ))}

      <CameraRig
        data={data}
        level={level}
        building={building}
        floor={floor}
        room={room}
      />
    </>
  );
}

export default function TwinSceneCanvas(props: {
  data: TwinData;
  issues: CampusIssue[];
  level: TwinLevel;
  building?: Building;
  floor?: Floor;
  room?: Room;
  onBuilding: (id: string) => void;
  onRoom: (id: string) => void;
  onIssue: (issue: CampusIssue) => void;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      camera={{
        fov: CAMERA_FOV,
        near: 0.1,
        far: 900,
        position: [45, 38, 45],
      }}
    >
      <AdaptiveDpr pixelated />
      <Suspense fallback={null}>
        <CampusModel {...props} />
      </Suspense>
    </Canvas>
  );
}
