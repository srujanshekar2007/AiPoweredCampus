import assert from "node:assert/strict";
import test from "node:test";
import { campusAnalytics, energyOpportunities, equipmentEnergy, generateSyntheticCampus, generateSyntheticOccupancy, roomEnergy, SYNTHETIC_CAMPUS } from "@/lib/energy-campus";

test("synthetic campus has the configured four buildings and 24 floors",()=>{
  assert.deepEqual(SYNTHETIC_CAMPUS.buildings.map(({code,floors})=>[code,floors]),[["A",8],["B",6],["C",5],["D",5]]);
  assert.equal(SYNTHETIC_CAMPUS.floors.length,24);
  for(const building of SYNTHETIC_CAMPUS.buildings) assert.equal(SYNTHETIC_CAMPUS.floors.filter(f=>f.buildingId===building.id).length,building.floors);
});

test("generated room and equipment links are unique and valid",()=>{
  const roomIds=new Set(SYNTHETIC_CAMPUS.rooms.map(r=>r.id));
  assert.equal(roomIds.size,SYNTHETIC_CAMPUS.rooms.length);
  assert.ok(SYNTHETIC_CAMPUS.rooms.length>=150);
  const equipmentIds=new Set(SYNTHETIC_CAMPUS.equipment.map(e=>e.id));
  assert.equal(equipmentIds.size,SYNTHETIC_CAMPUS.equipment.length);
  for(const room of SYNTHETIC_CAMPUS.rooms){assert.ok(SYNTHETIC_CAMPUS.floors.some(f=>f.id===room.floorId&&f.buildingId===room.buildingId));assert.ok(room.equipmentIds.every(id=>SYNTHETIC_CAMPUS.equipment.some(e=>e.id===id&&e.roomId===room.id)));assert.ok(room.areaM2>0);assert.ok(room.capacity>=0);}
  for(const item of SYNTHETIC_CAMPUS.equipment){assert.ok(item.quantity>0);assert.ok(item.wattsEach>0);assert.ok(item.hoursPerDay>=0&&item.hoursPerDay<=24);assert.ok(roomIds.has(item.roomId));}
});

test("timetable references valid rooms, fits capacity and has no same-room overlap",()=>{
  const rooms=new Map(SYNTHETIC_CAMPUS.rooms.map(room=>[room.id,room]));
  const sessions=[...SYNTHETIC_CAMPUS.sessions].sort((a,b)=>a.roomId.localeCompare(b.roomId)||a.day.localeCompare(b.day)||a.start-b.start);
  for(const session of sessions){const room=rooms.get(session.roomId);assert.ok(room);assert.ok(session.end>session.start);assert.ok(session.expectedAttendance<=session.capacity);assert.equal(session.capacity,room?.capacity);}
  assert.equal(SYNTHETIC_CAMPUS.occupancyIntervals.length,SYNTHETIC_CAMPUS.sessions.length);
  for(const interval of SYNTHETIC_CAMPUS.occupancyIntervals){assert.ok(rooms.has(interval.roomId));assert.ok(SYNTHETIC_CAMPUS.sessions.some(session=>session.id===interval.sessionId));assert.ok(interval.simulatedOccupancy<=interval.capacity);assert.ok(interval.scheduledOccupancy<=interval.capacity);}
  for(let i=1;i<sessions.length;i++){const prior=sessions[i-1],current=sessions[i];if(prior.roomId===current.roomId&&prior.day===current.day)assert.ok(prior.end<=current.start);}
  const byGroup=[...SYNTHETIC_CAMPUS.sessions].sort((a,b)=>a.day.localeCompare(b.day)||a.studentGroup.localeCompare(b.studentGroup)||a.start-b.start);
  for(let i=1;i<byGroup.length;i++){const prior=byGroup[i-1],current=byGroup[i];if(prior.studentGroup===current.studentGroup&&prior.day===current.day)assert.ok(prior.end<=current.start,`${prior.id} overlaps ${current.id}`);}
  assert.ok(sessions.some(session=>session.day==="Saturday"));
  assert.ok(sessions.some(session=>session.day==="Sunday"&&session.roomId.startsWith("C-")));
  assert.ok(!sessions.some(session=>session.day==="Sunday"&&!session.roomId.startsWith("C-")));
});

test("same seed regenerates an identical dataset without duplicate records",()=>{
  const first=generateSyntheticCampus(42);const second=generateSyntheticCampus(42);
  assert.deepEqual(first,second);
  for(const key of ["rooms","equipment","sessions"] as const){const ids=first[key].map(row=>row.id);assert.equal(new Set(ids).size,ids.length);}
});

test("equipment energy, category aggregation and building totals reconcile",()=>{
  const item=SYNTHETIC_CAMPUS.equipment[0];
  assert.equal(equipmentEnergy({...item,quantity:2,wattsEach:100,hoursPerDay:5,loadFactor:1,standbyWatts:0},1).totalKWh,1);
  assert.ok(Math.abs(equipmentEnergy({...item,quantity:1,wattsEach:100,hoursPerDay:2,loadFactor:1,standbyWatts:10},1).totalKWh-0.42)<1e-10);
  const first=SYNTHETIC_CAMPUS.rooms[0];const result=roomEnergy(first.id);
  assert.equal(result.installedKW,first.equipmentIds.reduce((sum,id)=>{const e=SYNTHETIC_CAMPUS.equipment.find(x=>x.id===id)!;return sum+e.quantity*e.wattsEach/1000;},0));
  assert.ok(Math.abs(result.kWh-Object.values(result.categoryKWh).reduce((a,b)=>a+b,0))<1e-8);
  const summary=campusAnalytics(1);
  assert.equal(summary.perBuilding.length,4);
  assert.ok(Math.abs(summary.totalKWh-summary.perBuilding.reduce((s,b)=>s+b.kWh,0))<1e-8);
  assert.ok(Math.abs(summary.installedKW-summary.perBuilding.reduce((s,b)=>s+b.installedKW,0))<1e-8);
  assert.equal(summary.perBuilding[0].kWh,Math.max(...summary.perBuilding.map(b=>b.kWh)));
});

test("classroom and computer-lab estimates include each inventory item exactly once",()=>{
  const classroom=SYNTHETIC_CAMPUS.rooms.find(room=>room.type==="classroom")!;
  const classroomItems=SYNTHETIC_CAMPUS.equipment.filter(item=>item.roomId===classroom.id);
  assert.ok(classroomItems.some(item=>item.category==="lighting"));
  assert.ok(classroomItems.some(item=>item.category==="fans"));
  const classroomTotal=classroomItems.reduce((sum,item)=>sum+equipmentEnergy(item,1,false,5.5/7).totalKWh,0);
  assert.ok(Math.abs(roomEnergy(classroom.id).kWh-classroomTotal)<1e-8);
  const lab=SYNTHETIC_CAMPUS.rooms.find(room=>room.type==="computer_lab")!;
  const labItems=SYNTHETIC_CAMPUS.equipment.filter(item=>item.roomId===lab.id);
  const tower=labItems.find(item=>item.name.includes("tower"));
  const monitors=labItems.find(item=>item.name.includes("monitors"));
  assert.ok(tower&&monitors);
  assert.equal(tower?.quantity,monitors?.quantity);
  const categorySum=Object.values(roomEnergy(lab.id).categoryKWh).reduce((sum,value)=>sum+value,0);
  assert.ok(Math.abs(roomEnergy(lab.id).kWh-categorySum)<1e-8);
});

test("opportunity rules do not classify essential loads as avoidable",()=>{
  const opportunities=energyOpportunities(1);
  assert.ok(opportunities.length>0);
  assert.ok(opportunities.every(item=>!item.equipment.essential&&item.kWh>0));
  assert.ok(opportunities.every(item=>item.reason.length>0&&item.assumption.length>0));
});

test("essential infrastructure is excluded from avoidable estimates and simulation is bounded",()=>{
  const room=SYNTHETIC_CAMPUS.rooms.find(r=>r.type==="infrastructure")!;
  const essential=SYNTHETIC_CAMPUS.equipment.find(e=>e.roomId===room.id&&e.essential)!;
  assert.ok(roomEnergy(room.id).avoidableKWh>=0);
  const original=roomEnergy(room.id).kWh;
  const switched=roomEnergy(room.id,{switchedOff:new Set([essential.id])}).kWh;
  assert.equal(switched,original);
  const classRoom=SYNTHETIC_CAMPUS.rooms.find(r=>r.type==="computer_lab")!;
  const eligible=classRoom.equipmentIds[0];
  const baseline=roomEnergy(classRoom.id).kWh;
  const scenario=roomEnergy(classRoom.id,{switchedOff:new Set([eligible])}).kWh;
  assert.ok(scenario<=baseline);
  assert.ok(baseline-scenario<=baseline);
});

test("occupancy simulation is deterministic and never exceeds room capacity",()=>{
  const room=SYNTHETIC_CAMPUS.rooms.find(r=>r.capacity>0)!;
  const a=generateSyntheticOccupancy(room,"Monday",10);const b=generateSyntheticOccupancy(room,"Monday",10);
  assert.deepEqual(a,b);assert.ok(a.simulatedOccupancy>=0);assert.ok(a.simulatedOccupancy<=room.capacity);assert.ok(a.scheduledOccupancy<=room.capacity);assert.match(a.source,/SYNTHETIC/);
});
