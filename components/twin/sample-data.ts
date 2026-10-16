import type { TwinData } from "@/components/twin/types";
import { SYNTHETIC_CAMPUS } from "@/lib/energy-campus";

/** Local Digital Twin fallback mirrors the same labelled synthetic energy dataset. */
const buildingUuids=[
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
];
const codeIndex=new Map(SYNTHETIC_CAMPUS.buildings.map((building,index)=>[building.id,index]));
const floorId=(id:string)=>`20000000-0000-4000-8000-${String(SYNTHETIC_CAMPUS.floors.findIndex(f=>f.id===id)+1).padStart(12,"0")}`;
const roomId=(id:string)=>`30000000-0000-4000-8000-${String(SYNTHETIC_CAMPUS.rooms.findIndex(r=>r.id===id)+1).padStart(12,"0")}`;

const buildings:TwinData["buildings"]=SYNTHETIC_CAMPUS.buildings.map((building)=>({
  id:buildingUuids[codeIndex.get(building.id)??0],name:`${building.code} · ${building.name}`,
  position_x:building.x,position_z:building.z,size_x:building.code==="A"?16:14,
  size_y:building.floors*3.4,size_z:building.code==="A"?12:13,floor_count:building.floors,
}));
const floors:TwinData["floors"]=SYNTHETIC_CAMPUS.floors.map((floor)=>({
  id:floorId(floor.id),building_id:buildingUuids[codeIndex.get(floor.buildingId)??0],floor_number:floor.number,plan_image_url:null,
}));
const rooms:TwinData["rooms"]=SYNTHETIC_CAMPUS.rooms.map((room)=>({
  id:roomId(room.id),floor_id:floorId(room.floorId),name:`${room.id} · ${room.name}`,room_type:room.type,
}));
export const SAMPLE_TWIN_DATA:TwinData={buildings,floors,rooms};
