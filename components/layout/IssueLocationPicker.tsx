"use client";

import { useMemo, useState } from "react";
import TwinScene from "@/components/twin/TwinScene";
import { formatFloorLabel } from "@/components/twin/layout";
import type { TwinData, TwinLocationSelection } from "@/components/twin/types";

type Props = {
  data: TwinData;
  geometryUnavailable: boolean;
  role: string;
  value: string;
  selection: Omit<TwinLocationSelection, "location"> | null;
  onChange: (selection: TwinLocationSelection | null) => void;
};

export default function IssueLocationPicker({ data, geometryUnavailable, role, value, selection, onChange }: Props) {
  const [mode, setMode] = useState<"lists" | "twin">("lists");
  const [buildingId, setBuildingId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [roomId, setRoomId] = useState("");

  const buildings = useMemo(() => [...data.buildings].sort((a, b) => a.name.localeCompare(b.name)), [data.buildings]);
  const building = buildings.find((item) => item.id === buildingId);
  const floors = useMemo(
    () => data.floors.filter((item) => item.building_id === buildingId).sort((a, b) => a.floor_number - b.floor_number),
    [data.floors, buildingId],
  );
  const floor = floors.find((item) => item.id === floorId);
  const rooms = useMemo(
    () => data.rooms.filter((item) => item.floor_id === floorId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [data.rooms, floorId],
  );

  const chooseBuilding = (id: string) => {
    setBuildingId(id);
    setFloorId("");
    setRoomId("");
    onChange(null);
  };

  const chooseFloor = (id: string) => {
    setFloorId(id);
    setRoomId("");
    onChange(null);
  };

  const chooseRoom = (roomId: string) => {
    const room = rooms.find((item) => item.id === roomId);
    if (building && floor && room) {
      setRoomId(room.id);
      onChange({ buildingId: building.id, floorId: floor.id, roomId: room.id, location: `${building.name} · ${formatFloorLabel(floor.floor_number)} · ${room.name}` });
    }
  };

  const chooseTwinLocation = (selected: TwinLocationSelection) => {
    setBuildingId(selected.buildingId);
    setFloorId(selected.floorId);
    setRoomId(selected.roomId);
    onChange(selected);
  };

  return (
    <section className="issue-location-picker" aria-label="Choose issue location">
      <div className="issue-location-modes" role="group" aria-label="Location selection method">
        <button type="button" aria-pressed={mode === "lists"} onClick={() => setMode("lists")}>Choose from options</button>
        <button type="button" aria-pressed={mode === "twin"} onClick={() => setMode("twin")}>Choose on Digital Twin</button>
      </div>

      {mode === "lists" ? (
        <div className="issue-location-selects">
          <label>Building
            <select required value={selection?.buildingId ?? buildingId} onChange={(event) => chooseBuilding(event.target.value)}>
              <option value="">Choose a building</option>
              {buildings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Floor
            <select required disabled={!buildingId} value={selection?.floorId ?? floorId} onChange={(event) => chooseFloor(event.target.value)}>
              <option value="">{buildingId ? "Choose a floor" : "Choose a building first"}</option>
              {floors.map((item) => <option key={item.id} value={item.id}>{formatFloorLabel(item.floor_number)}</option>)}
            </select>
          </label>
          <label>Room
            <select required disabled={!floorId} value={selection?.roomId ?? roomId} onChange={(event) => chooseRoom(event.target.value)}>
              <option value="">{floorId ? "Choose a room" : "Choose a floor first"}</option>
              {rooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      ) : (
        <div className="issue-location-twin">
          <TwinScene
            issues={[]}
            role={role}
            data={data}
            geometryUnavailable={geometryUnavailable}
            selectionOnly
            onLocationSelect={chooseTwinLocation}
          />
        </div>
      )}

      <label className="issue-location-selected">Selected location
        <input required readOnly value={value} placeholder="Choose a building, floor and room above" />
      </label>
    </section>
  );
}
