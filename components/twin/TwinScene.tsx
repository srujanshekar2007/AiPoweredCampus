"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CampusIssue } from "@/lib/campus-store";
import type { TwinData, TwinLevel, TwinLocationSelection } from "@/components/twin/types";
import { formatFloorLabel } from "@/components/twin/layout";
import { campusAnalytics, generateSyntheticOccupancy, roomEnergy, SYNTHETIC_CAMPUS } from "@/lib/energy-campus";

const Scene = dynamic(() => import("./TwinSceneCanvas"), { ssr: false, loading: () => <div className="scene-loading">Preparing the interactive campus model…</div> });

export default function TwinScene({ issues, role, data, geometryUnavailable, selectionOnly = false, onLocationSelect }: { issues: CampusIssue[]; role: string; data: TwinData; geometryUnavailable: boolean; selectionOnly?: boolean; onLocationSelect?: (selection: TwinLocationSelection) => void }) {
  const [level, setLevel] = useState<TwinLevel>("campus");
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [floorId, setFloorId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<CampusIssue | null>(null);
  const building = data.buildings.find((item) => item.id === buildingId);
  const floors = useMemo(() => data.floors.filter((item) => item.building_id === buildingId).sort((a, b) => a.floor_number - b.floor_number), [data.floors, buildingId]);
  const floor = data.floors.find((item) => item.id === floorId);
  const rooms = useMemo(() => data.rooms.filter((item) => item.floor_id === floorId), [data.rooms, floorId]);
  const room = data.rooms.find((item) => item.id === roomId);
  const energyBuildingCode = building?.name.match(/^([A-D])\s·/)?.[1];
  const energyBuilding = SYNTHETIC_CAMPUS.buildings.find((item) => item.code === energyBuildingCode);
  const energyFloor = floor && energyBuilding ? SYNTHETIC_CAMPUS.floors.find((item) => item.buildingId === energyBuilding.id && item.number === floor.floor_number) : null;
  const roomCode = room?.name.match(/\b([A-D]-\d{3})\b/)?.[1];
  const energyRoom = SYNTHETIC_CAMPUS.rooms.find((item) => item.id === roomCode);
  const energySummary = useMemo(() => campusAnalytics(1), []);
  const visibleIssues = issues.filter((item) => item.status !== "verified");
  const goCampus = () => { setLevel("campus"); setBuildingId(null); setFloorId(null); setRoomId(null); setSelectedIssue(null); };
  const goBuilding = (id = buildingId) => { setBuildingId(id); setFloorId(null); setRoomId(null); setLevel("building"); setSelectedIssue(null); };
  const goFloor = (id: string) => { setFloorId(id); setRoomId(null); setLevel("floor"); setSelectedIssue(null); };
  const goRoom = (id: string) => { setRoomId(id); setLevel("room"); setSelectedIssue(null); };
  const crumbs: { label: string; action: () => void; current: boolean }[] = [{ label: "Campus", action: goCampus, current: level === "campus" }];
  if (building) crumbs.push({ label: building.name, action: () => goBuilding(building.id), current: level === "building" });
  if (floor) crumbs.push({ label: formatFloorLabel(floor.floor_number), action: () => goFloor(floor.id), current: level === "floor" });
  if (room) crumbs.push({ label: room.name, action: () => goRoom(room.id), current: level === "room" });
  const activeStep = level === "campus" ? 1 : level === "building" ? 2 : 3;

  return <main className={`twin-page twin-workspace${selectionOnly ? " twin-picker-page" : ""}`}>
    {selectionOnly ? <div className="twin-picker-intro"><strong>Choose a location on the Digital Twin</strong><span>Select a building, then a floor and room. Confirm the room to attach it to your report.</span></div> : <header className="twin-page-header"><Link href={`/workspace/${role}`} className="back-link">← Workspace</Link><div><p className="eyebrow">ECOTWIN · CAMPUS MODEL</p><h1>Campus Digital Twin</h1><p>Explore buildings, floors and rooms. Issue markers use authorized campus records.</p></div><span className="source-tag">{geometryUnavailable ? "STARTER MODEL · DEMO GEOMETRY" : "CAMPUS MODEL"}</span></header>}
    {geometryUnavailable && <div className="twin-notice" role="status">Campus geometry could not be loaded, so this page is showing the built-in illustrative model. Apply <code>supabase/digital-twin.sql</code> if it has not been run; otherwise check the geometry table permissions. Existing Supabase auth, profiles and issue records are unchanged.</div>}
    <section className="twin-model-card">
      <div className="twin-toolbar"><nav aria-label="Campus model location" className="twin-breadcrumbs">{crumbs.map((crumb, index) => <span key={`${crumb.label}-${index}`}>{index > 0 && <b>›</b>}<button type="button" aria-current={crumb.current ? "page" : undefined} onClick={crumb.action}>{crumb.label}</button></span>)}</nav><span className="twin-role-chip">Verified {role} access</span></div>
      <section className="twin-selection-flow" aria-label="Choose a campus location">
        <div className="twin-flow-heading">
          <p className="eyebrow">CAMPUS EXPLORER</p>
          <strong>{level === "campus" ? "Choose a building" : level === "building" ? "Choose a floor" : level === "floor" ? "Choose a room" : "Room selected"}</strong>
          <span>{level === "campus" ? "Select a building in the 3D model or from this list." : level === "building" ? `Now choose a floor in ${building?.name}.` : level === "floor" ? `Now choose a room on ${building?.name}, ${floor ? formatFloorLabel(floor.floor_number) : ""}.` : `Viewing ${room?.name} in ${building?.name}, ${floor ? formatFloorLabel(floor.floor_number) : ""}.`}</span>
        </div>
        <ol className="twin-flow-steps" aria-label="Building, floor and room steps">
          {["Building", "Floor", "Room"].map((label, index) => {
            const step = index + 1;
            const done = step < activeStep || (level === "room" && step === 3);
            return <li key={label} className={step === activeStep ? "current" : done ? "done" : ""} aria-current={step === activeStep ? "step" : undefined}><i>{done ? "✓" : step}</i>{label}</li>;
          })}
        </ol>
        <div className="twin-flow-options">
          {level === "campus" && data.buildings.map((item) => {
            const buildingFloors = data.floors.filter((floorItem) => floorItem.building_id === item.id);
            return <button type="button" key={item.id} onClick={() => goBuilding(item.id)}><strong>{item.name}</strong><span>{buildingFloors.length} {buildingFloors.length === 1 ? "floor" : "floors"} · Select building →</span></button>;
          })}
          {level === "building" && floors.map((item) => <button type="button" key={item.id} onClick={() => goFloor(item.id)}><strong>{formatFloorLabel(item.floor_number)}</strong><span>{data.rooms.filter((roomItem) => roomItem.floor_id === item.id).length} rooms · Select floor →</span></button>)}
          {level === "floor" && rooms.map((item) => <button type="button" key={item.id} onClick={() => goRoom(item.id)}><strong>{item.name}</strong><span>{item.room_type} · Select room →</span></button>)}
          {level === "room" && <><div className="twin-flow-selected"><strong>{room?.name ?? "Room"}</strong><span>{room?.room_type ?? "Room details"} · Selected</span></div>{rooms.filter((item) => item.id !== roomId).map((item) => <button type="button" key={item.id} onClick={() => goRoom(item.id)}><strong>{item.name}</strong><span>{item.room_type} · Select room →</span></button>)}<button type="button" className="twin-flow-back" onClick={() => floor && goFloor(floor.id)}>← Choose another floor</button></>}
          {selectionOnly && level === "room" && building && floor && room && <button type="button" className="twin-flow-confirm" onClick={() => onLocationSelect?.({ buildingId: building.id, floorId: floor.id, roomId: room.id, location: `${building.name} · ${formatFloorLabel(floor.floor_number)} · ${room.name}` })}>Use this location →</button>}
          {level === "building" && !floors.length && <p className="twin-flow-empty">No floors are available for this building yet.</p>}
          {level === "floor" && !rooms.length && <p className="twin-flow-empty">No rooms are available on this floor yet.</p>}
        </div>
      </section>
      {data.buildings.length ? <div className="twin-viewport"><Scene data={data} issues={visibleIssues} level={level} building={building} floor={floor} room={room} onBuilding={(id) => goBuilding(id)} onRoom={goRoom} onIssue={setSelectedIssue} /><div className="twin-legend"><span><i className="twin-dot red"/>Active issue</span><span><i className="twin-dot green"/>No active issue</span><span>Drag to orbit · scroll to zoom · select a marker</span></div></div> : <div className="twin-empty-model"><strong>{geometryUnavailable ? "Model geometry needs setup" : "No campus buildings yet"}</strong><p>{geometryUnavailable ? "The scene will become interactive when the geometry migration is installed." : "Add buildings, floors and rooms to the campus geometry tables."}</p></div>}
      {!selectionOnly && <div className="twin-context-grid">
        <section className="twin-context-panel"><p className="eyebrow">{level === "campus" ? "CAMPUS OVERVIEW" : level === "building" ? "BUILDING" : level === "floor" ? "FLOOR PLAN" : "ROOM"}</p>
          <h2>{room?.name ?? (floor ? `${building?.name} · ${formatFloorLabel(floor.floor_number)}` : building?.name ?? "Explore campus")}</h2>
          {level === "campus" && <><p>{data.buildings.length} buildings · {data.floors.length} floors · {data.rooms.length} rooms</p><p className="twin-muted">DEMO DATA · synthetic energy inventory. Estimated campus consumption: {energySummary.totalKWh.toFixed(1)} kWh/day; not measured telemetry.</p></>}
          {level === "building" && building && <><p>{floors.length} {floors.length === 1 ? "floor" : "floors"} · {issues.filter((item) => item.location.toLowerCase().includes(building.name.toLowerCase())).length} linked issue records</p>{energyBuilding && <p className="twin-energy-summary">DEMO estimate · {energyBuilding.purpose}<br/>{energySummary.perBuilding.find((item)=>item.building.id===energyBuilding.id)?.kWh.toFixed(1)} kWh/day · {energySummary.perBuilding.find((item)=>item.building.id===energyBuilding.id)?.installedKW.toFixed(1)} kW installed · {energyBuilding.areaM2.toLocaleString()} m² floor area</p>}<p className="twin-muted">Choose a floor from the campus explorer above.</p></>}
          {level === "floor" && floor && <><p>{rooms.length} rooms on this floor.</p>{energyFloor && <p className="twin-energy-summary">{energyFloor.label} · {energyFloor.areaM2.toLocaleString()} m² · {SYNTHETIC_CAMPUS.rooms.filter((item)=>item.floorId===energyFloor.id).length} synthetic rooms</p>}<p className="twin-muted">Choose a room from the campus explorer above or select it in the 3D model.</p></>}
          {level === "room" && room && <><p>{room.room_type} · {issues.filter((item) => item.location.toLowerCase().includes(room.name.toLowerCase())).length} matching issue records</p>{energyRoom && <><p className="twin-energy-summary">SYNTHETIC DEMO · {energyRoom.department} · {energyRoom.areaM2} m² · capacity {energyRoom.capacity || "n/a"}<br/>{roomEnergy(energyRoom.id).kWh.toFixed(2)} estimated kWh/day · {roomEnergy(energyRoom.id).installedKW.toFixed(2)} kW installed · {roomEnergy(energyRoom.id).avoidableKWh.toFixed(2)} kWh potential off-schedule review</p><ul className="twin-equipment-list">{energyRoom.equipmentIds.map(id=>SYNTHETIC_CAMPUS.equipment.find(item=>item.id===id)).filter((item)=>item!==undefined).map(item=><li key={item.id}><b>{item.quantity} × {item.name}</b> · {item.wattsEach} W each{item.essential?" · essential":""}</li>)}</ul><p className="twin-muted">Timetable: {SYNTHETIC_CAMPUS.sessions.filter(item=>item.roomId===energyRoom.id).length} synthetic sessions/week · occupancy estimate: {generateSyntheticOccupancy(energyRoom,"Monday",10).simulatedOccupancy}/{energyRoom.capacity} at Monday 10:00. Occupancy and equipment status are simulations, not sensor/camera observations.</p></>}<p className="twin-muted">Issue-to-room matching uses the issue location text; unmatched records appear at the campus level as approximate markers.</p></>}
        </section>
        <section className="twin-context-panel twin-issue-panel"><p className="eyebrow">{selectedIssue ? "SELECTED ISSUE" : "CAMPUS ISSUE RECORDS"}</p>{selectedIssue ? <><h2>{selectedIssue.title}</h2><p>{selectedIssue.description}</p><p className="twin-muted">{selectedIssue.id} · {selectedIssue.location} · {selectedIssue.category} · {selectedIssue.priority.toUpperCase()}</p><span className={`twin-status ${selectedIssue.status === "verified" || selectedIssue.status === "resolved" ? "resolved" : "open"}`}>{selectedIssue.status.replaceAll("_", " ")}</span><button className="twin-text-button" type="button" onClick={() => setSelectedIssue(null)}>Back to issue list</button></> : visibleIssues.length ? <div className="twin-issue-list">{visibleIssues.slice(0, 6).map((item) => <button key={item.id} type="button" onClick={() => setSelectedIssue(item)}><span><strong>{item.title}</strong><small>{item.location} · {item.status.replaceAll("_", " ")}</small></span><i className={item.priority === "urgent" || item.priority === "high" ? "red" : "amber"}/></button>)}</div> : <p className="twin-muted">There are no issue records visible to this account.</p>}</section>
      </div>}
      {!selectionOnly && <p className="twin-disclaimer">Illustrative geometry is not surveyed campus data. Do not use it for navigation, evacuation or engineering decisions.</p>}
    </section>
  </main>;
}
