import type { CampusIssue } from "@/lib/campus-store";

export type Vec3 = [number, number, number];
export type CameraPose = { position: Vec3; target: Vec3 };
export type TwinLevel = "campus" | "building" | "floor" | "room";
export type Building = {
  id: string; name: string; position_x: number; position_z: number;
  size_x: number; size_y: number; size_z: number; floor_count: number;
};
export type Floor = { id: string; building_id: string; floor_number: number; plan_image_url: string | null };
export type Room = { id: string; floor_id: string; name: string; room_type: string };
export type TwinData = { buildings: Building[]; floors: Floor[]; rooms: Room[] };
export type TwinLocationSelection = { buildingId: string; floorId: string; roomId: string; location: string };
export type CampusTwinIssue = CampusIssue;
