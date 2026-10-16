/** Deterministic, explicitly synthetic campus model used by the energy demo. */
export type EnergyBuilding = { id: string; code: string; name: string; purpose: string; floors: number; x: number; z: number; areaM2: number };
export type EnergyFloor = { id: string; buildingId: string; number: number; label: string; areaM2: number };
export type EnergyEquipment = { id: string; roomId: string; name: string; category: string; quantity: number; wattsEach: number; hoursPerDay: number; scheduleWindow: string; standbyWatts: number; loadFactor: number; state: "scheduled" | "standby" | "essential"; essential: boolean; portable: boolean };
export type EnergyRoom = { id: string; number: string; name: string; buildingId: string; floorId: string; floorNumber: number; department: string; type: string; areaM2: number; capacity: number; schedule: string; equipmentIds: string[]; occupiedHours: number; lastSimulatedUpdate: string };
export type EnergySession = { id: string; day: string; start: number; end: number; roomId: string; activity: string; department: string; studentGroup: string; expectedAttendance: number; capacity: number; sessionType: string; synthetic: true };
export type EnergyOccupancyInterval = { id: string; sessionId: string; roomId: string; day: string; start: number; end: number; scheduledOccupancy: number; simulatedOccupancy: number; capacity: number; source: "SYNTHETIC TIMETABLE SIMULATION" };
export type EnergyCampus = { provenance: string; seed: number; buildings: EnergyBuilding[]; floors: EnergyFloor[]; rooms: EnergyRoom[]; equipment: EnergyEquipment[]; sessions: EnergySession[]; occupancyIntervals: EnergyOccupancyInterval[] };

const buildingDefinitions = [
  { code: "A", name: "Main Academic Block", floors: 8, purpose: "Computing, AI, core classrooms and labs", x: 0, z: -20 },
  { code: "B", name: "Engineering Block", floors: 6, purpose: "Engineering departments, labs and workshops", x: 20, z: 0 },
  { code: "C", name: "Library & Student Activities Block", floors: 5, purpose: "Library, clubs, innovation and student activities", x: 0, z: 20 },
  { code: "D", name: "Administration & Admissions Block", floors: 5, purpose: "Admissions, administration and institutional offices", x: -20, z: 0 },
] as const;
const floorLabel = (n: number) => n === 0 ? "Ground Floor" : `${["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"][n]} Floor`;
const templates: Record<string, Array<Array<{ type: string; name: string; dept?: string }>>> = {
  A: [
    [{type:"classroom",name:"Lecture Hall",dept:"CSE"},{type:"computer_lab",name:"Computer Lab",dept:"CSE"},{type:"faculty",name:"Faculty Suite",dept:"CSE"},{type:"common",name:"Student Commons"},{type:"classroom",name:"Tutorial Room",dept:"CSE"},{type:"washroom",name:"Washroom"},{type:"infrastructure",name:"Network Closet"}],
    [{type:"computer_lab",name:"AI Computing Lab",dept:"AI & ML"},{type:"classroom",name:"Lecture Room",dept:"AI & ML"},{type:"faculty",name:"Faculty Cabin",dept:"AI & ML"},{type:"project_lab",name:"Project Studio",dept:"AI & ML"},{type:"classroom",name:"Tutorial Room",dept:"AI & ML"},{type:"common",name:"Collaboration Area"},{type:"washroom",name:"Washroom"}],
    [{type:"computer_lab",name:"Data Science Lab",dept:"Data Science"},{type:"classroom",name:"Lecture Room",dept:"ISE"},{type:"faculty",name:"Faculty Suite",dept:"ISE"},{type:"computer_lab",name:"ISE Computer Lab",dept:"ISE"},{type:"seminar",name:"Seminar Room"},{type:"common",name:"Student Commons"},{type:"washroom",name:"Washroom"}],
  ],
  B: [
    [{type:"electronics_lab",name:"Electronics Lab",dept:"ECE"},{type:"classroom",name:"Lecture Room",dept:"ECE"},{type:"faculty",name:"Department Office",dept:"ECE"},{type:"electronics_lab",name:"Communications Lab",dept:"ECE"},{type:"tutorial",name:"Tutorial Room",dept:"ECE"},{type:"washroom",name:"Washroom"},{type:"infrastructure",name:"Electrical Riser"}],
    [{type:"electronics_lab",name:"Electrical Machines Lab",dept:"EEE"},{type:"classroom",name:"Lecture Room",dept:"EEE"},{type:"faculty",name:"Faculty Cabin",dept:"EEE"},{type:"electronics_lab",name:"Power Systems Lab",dept:"EEE"},{type:"project_lab",name:"Instrumentation Lab",dept:"Instrumentation"},{type:"common",name:"Project Bay"}],
    [{type:"workshop",name:"Mechanical Workshop",dept:"Mechanical"},{type:"workshop",name:"Materials Lab",dept:"Mechanical"},{type:"classroom",name:"Lecture Room",dept:"Mechanical"},{type:"faculty",name:"Department Office",dept:"Mechanical"},{type:"project_lab",name:"CAD Lab",dept:"Mechanical"},{type:"washroom",name:"Washroom"}],
    [{type:"civil_lab",name:"Civil Materials Lab",dept:"Civil"},{type:"civil_lab",name:"Surveying Lab",dept:"Civil"},{type:"classroom",name:"Lecture Room",dept:"Civil"},{type:"faculty",name:"Faculty Suite",dept:"Civil"},{type:"project_lab",name:"Structures Lab",dept:"Civil"},{type:"common",name:"Design Studio"}],
    [{type:"chemistry_lab",name:"Process Lab",dept:"Chemical"},{type:"classroom",name:"Lecture Room",dept:"Chemical"},{type:"faculty",name:"Faculty Cabin",dept:"Chemical"},{type:"physics_lab",name:"Engineering Physics Lab",dept:"Engineering Physics"},{type:"project_lab",name:"Interdisciplinary Lab"},{type:"washroom",name:"Washroom"}],
  ],
  C: [
    [{type:"library",name:"Library Issue Counter",dept:"Library"},{type:"library",name:"Open Reading Hall",dept:"Library"},{type:"common",name:"Library Lounge"},{type:"library",name:"Book Stack Room",dept:"Library"},{type:"washroom",name:"Washroom"},{type:"infrastructure",name:"Library IT Room"},{type:"common",name:"Entrance Lobby"}],
    [{type:"library",name:"Quiet Reading Room",dept:"Library"},{type:"library",name:"Digital Library",dept:"Library"},{type:"study",name:"Group Study Room",dept:"Library"},{type:"library",name:"Reference Room",dept:"Library"},{type:"common",name:"Reading Lounge"},{type:"washroom",name:"Washroom"}],
    [{type:"club_lab",name:"Robotics Club Lab",dept:"Student Activities"},{type:"club_lab",name:"Electronics Club Lab",dept:"Student Activities"},{type:"club_lab",name:"Coding Club Room",dept:"Student Activities"},{type:"meeting",name:"Club Meeting Room"},{type:"common",name:"Student Activity Hall"},{type:"washroom",name:"Washroom"}],
    [{type:"innovation",name:"Innovation Studio",dept:"Student Activities"},{type:"project_lab",name:"Project Development Lab"},{type:"seminar",name:"Multipurpose Hall"},{type:"meeting",name:"Seminar Room"},{type:"common",name:"Collaboration Lounge"},{type:"infrastructure",name:"AV Control Room"}],
    [{type:"library",name:"Extended Hours Study Hall",dept:"Library"},{type:"study",name:"Quiet Study Room"},{type:"meeting",name:"Student Club HQ",dept:"Student Activities"},{type:"common",name:"Student Lounge"},{type:"washroom",name:"Washroom"},{type:"infrastructure",name:"Network Room"}],
  ],
  D: [
    [{type:"office",name:"Reception and Enquiry",dept:"Admissions"},{type:"office",name:"Admissions Office",dept:"Admissions"},{type:"common",name:"Visitor Waiting Area"},{type:"office",name:"Records Office",dept:"Administration"},{type:"meeting",name:"Interview Room"},{type:"washroom",name:"Washroom"},{type:"infrastructure",name:"Security Desk"}],
    [{type:"office",name:"Registrar Office",dept:"Administration"},{type:"office",name:"Academic Administration",dept:"Administration"},{type:"faculty",name:"Director Office",dept:"Administration"},{type:"meeting",name:"Conference Room"},{type:"office",name:"Administrative Support",dept:"Administration"},{type:"common",name:"Staff Lounge"}],
    [{type:"office",name:"Accounts and Finance",dept:"Accounts"},{type:"office",name:"Examination Section",dept:"Examinations"},{type:"office",name:"Human Resources",dept:"Human Resources"},{type:"meeting",name:"Meeting Room"},{type:"office",name:"Document Records"},{type:"washroom",name:"Washroom"}],
    [{type:"office",name:"Admissions Processing",dept:"Admissions"},{type:"meeting",name:"Interview Suite"},{type:"office",name:"Academic Records",dept:"Administration"},{type:"office",name:"Faculty Administration",dept:"Administration"},{type:"common",name:"Visitor Lounge"},{type:"infrastructure",name:"IT Support Room"}],
    [{type:"office",name:"Accounts Office",dept:"Accounts"},{type:"office",name:"Examination Records",dept:"Examinations"},{type:"meeting",name:"Board Conference Room"},{type:"office",name:"Human Resources Suite",dept:"Human Resources"},{type:"office",name:"Administrative Archive"},{type:"common",name:"Staff Commons"}],
  ],
};

function hash(seed: number, text: string) { let value = seed >>> 0; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0; return value >>> 0; }
const between = (seed: number, key: string, min: number, max: number) => min + hash(seed,key) % (max-min+1);

function equipmentFor(seed: number, roomId: string, type: string, area: number, next: () => string): EnergyEquipment[] {
  const list: EnergyEquipment[] = [];
  const scheduleWindow=type==="infrastructure"?"00:00–24:00 · continuous":type==="library"?"08:00–21:00 · library hours":type==="club_lab"?"16:00–20:00 · club schedule":"09:00–16:00 · academic schedule; Saturday 09:00–13:00";
  const add = (name:string,category:string,quantity:number,wattsEach:number,hoursPerDay:number,loadFactor=1,essential=false,portable=false,standbyWatts=0)=>list.push({ id:next(),roomId,name,category,quantity,wattsEach,hoursPerDay,scheduleWindow,standbyWatts,loadFactor,state:essential?"essential":"scheduled",essential,portable });
  const lights = Math.max(2,Math.ceil(area/18)); add("LED lighting","lighting",lights,20,9,0.95,false,false,0);
  if (["classroom","tutorial","seminar","meeting","office","faculty","common","study","library","club_lab","innovation"].includes(type)) add("Ceiling fans","fans",Math.max(2,Math.ceil(area/28)),65,8,0.8,false,false,4);
  if (["classroom","computer_lab","project_lab","electronics_lab","library","office","seminar","meeting","club_lab","innovation"].includes(type) && area >= 65) add("Split air-conditioning","cooling",Math.max(1,Math.ceil(area/90)),1500,6,0.72,false,false,80);
  if (["computer_lab","project_lab","club_lab","innovation","library"].includes(type)) {
    const count = type === "computer_lab" ? Math.max(16,Math.min(36,Math.floor(area/3.5))) : type === "library" ? 18 : 12;
    add("Desktop computers (tower)","computers",count,170,7,0.68,false,true,2);
    add("Desktop monitors","computers",count,28,7,0.7,false,true,1);
    add("Network switch","network",2,45,24,0.82,true,false,0);
  }
  if (["classroom","seminar","meeting"].includes(type)) add("Projector / display","av",1,280,4,0.85,false,true,5);
  if (type === "electronics_lab") { add("Oscilloscope benches","lab_equipment",8,90,4,0.45,false,true,2); add("Bench power supplies","lab_equipment",8,120,4,0.55,false,true,3); add("Function generators","lab_equipment",6,35,4,0.4,false,true,2); add("Fume extraction","ventilation",2,600,3,0.6,false,false,0); }
  if (type === "workshop") { add("Workshop machines","motors",5,1800,3,0.38,false,true,0); add("Local extraction","ventilation",2,900,3,0.6,false,false,0); }
  if (["civil_lab","chemistry_lab","physics_lab"].includes(type)) { add("Laboratory instruments","lab_equipment",8,180,4,0.5,false,true,4); add("Ventilation system","ventilation",1,850,4,0.72,false,false,0); }
  if (["office","faculty"].includes(type)) { add("Office computers","computers",Math.max(2,Math.ceil(area/18)),150,7,0.62,false,true,2); add("Printer standby","office_equipment",1,45,1,0.5,false,true,8); }
  if (["infrastructure"].includes(type)) add("Network / controls rack","essential_infrastructure",1,240,24,0.78,true,false,0);
  if (type === "library") { add("Book circulation terminals","office_equipment",3,75,12,0.45,false,true,4); }
  if (["washroom","common"].includes(type)) add("Ventilation fans","ventilation",1,180,8,0.6,false,false,0);
  return list;
}

export function generateSyntheticCampus(seed = 20261016): EnergyCampus {
  const buildings: EnergyBuilding[] = buildingDefinitions.map((b) => ({ id:`BLDG-${b.code}`,code:b.code,name:b.name,purpose:b.purpose,floors:b.floors,x:b.x,z:b.z,areaM2:b.floors*(b.code === "A" ? 1150 : 950) }));
  const floors: EnergyFloor[] = [];
  const rooms: EnergyRoom[] = [];
  const equipment: EnergyEquipment[] = [];
  for (const building of buildings) {
    let roomCounter = 0, equipmentCounter = 0;
    const nextEquipment = () => `EQ-${building.code}-${String(++equipmentCounter).padStart(4,"0")}`;
    for (let n=0;n<building.floors;n++) {
      const id = `${building.code}-F${String(n).padStart(2,"0")}`;
      const floor: EnergyFloor = { id,buildingId:building.id,number:n,label:floorLabel(n),areaM2:building.areaM2/building.floors };
      floors.push(floor);
      const base = templates[building.code][Math.min(templates[building.code].length-1,Math.floor(n*templates[building.code].length/building.floors))];
      const items = [...base];
      if (n === 0) items.unshift({type:"common",name:"Entrance Lobby"});
      if (building.code === "A" && n >= 4 && !items.some((item)=>item.type==="computer_lab")) items.splice(1,0,{type:"computer_lab",name:"Computing Laboratory",dept:n%2?"CSE":"ISE"});
      if (building.code === "A" && n === 7) items.push({type:"seminar",name:"Project Demonstration Hall",dept:"AI & ML"});
      if (building.code === "B" && n===5) items.push({type:"infrastructure",name:"Lift and Pump Controls"});
      const localCounts = new Map<string,number>();
      for (const item of items) {
        const order = (localCounts.get(item.name) ?? 0)+1; localCounts.set(item.name,order);
        const idRoom = `${building.code}-${String(++roomCounter).padStart(3,"0")}`;
        const area = item.type.includes("lab") || item.type==="workshop" ? between(seed,idRoom,90,150) : item.type==="classroom" ? between(seed,idRoom,65,95) : between(seed,idRoom,18,65);
        const capacity = item.type==="classroom"?between(seed,idRoom+"cap",35,60):item.type.includes("lab")?between(seed,idRoom+"cap",18,32):item.type==="library"?between(seed,idRoom+"cap",20,70):item.type==="common"?between(seed,idRoom+"cap",10,45):item.type==="office"||item.type==="faculty"?between(seed,idRoom+"cap",2,12):item.type==="meeting"||item.type==="seminar"?between(seed,idRoom+"cap",10,80):0;
        const name = `${item.name}${order>1?` ${order}`:""}`;
        const generated = equipmentFor(seed,idRoom,item.type,area,nextEquipment);
        equipment.push(...generated);
        const schedule = building.code === "C" && item.type === "library" ? "Mon–Fri 08:00–21:00; Sat 09:00–17:00; Sun 10:00–16:00" : building.code === "D" ? "Mon–Fri 09:00–16:00; Sat 09:00–13:00" : item.type === "infrastructure" ? "Essential continuous operation" : item.type === "club_lab" ? "Mon–Fri 16:00–20:00; Sat 09:00–13:00" : "Mon–Fri 09:00–16:00; Sat 09:00–13:00";
        rooms.push({id:idRoom,number:idRoom,name,buildingId:building.id,floorId:id,floorNumber:n,department:item.dept??"Shared Facilities",type:item.type,areaM2:area,capacity,schedule,equipmentIds:generated.map((entry)=>entry.id),occupiedHours:item.type==="office"||item.type==="faculty"?6:item.type==="library"?9:item.type==="infrastructure"?24:between(seed,idRoom+"occ",1,6),lastSimulatedUpdate:"2026-10-16T09:00:00+05:30"});
      }
    }
  }
  const dayNames = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const sessions: EnergySession[] = [];
  const groupHours = new Map<string,Set<string>>();
  for (const room of rooms.filter((r)=>r.capacity>0 && !["office","common","study","infrastructure","washroom"].includes(r.type))) {
    const activeDays = room.type==="library" ? [...dayNames,"Sunday"] : dayNames;
    for (const day of activeDays) {
      const count = room.type==="library" ? 1 : day === "Saturday" ? 1 : between(seed,room.id+day,1,3);
      const used = new Set<number>();
      const studentGroup=room.type==="library"?`OPEN-${room.id}`:`${deptIdForGroup(room.department)}-S${(room.floorNumber%4)+1}`;
      const groupKey=`${day}:${studentGroup}`;
      const usedGroup=groupHours.get(groupKey)??new Set<string>();
      groupHours.set(groupKey,usedGroup);
      for(let i=0;i<count;i++) {
        const candidates = room.type==="library" ? day==="Sunday"?[10]:[8] : day === "Saturday" ? [9,10,11,12] : room.type==="club_lab" ? [16,17,18,19] : [9,10,11,12,14,15];
        const duration = room.type==="library" ? (day==="Sunday"?6:day==="Saturday"?8:13) : room.type.includes("lab")||room.type==="workshop" ? 2 : 1;
        const start = candidates.find((hour)=>!used.has(hour)&&Array.from({length:duration},(_,k)=>String(hour+k)).every(slot=>!usedGroup.has(slot))); if(start===undefined) continue;
        if(Array.from({length:duration},(_,k)=>start+k).some((hour)=>used.has(hour) || (day==="Saturday"&&room.type!=="library"&&hour>=13))) continue;
        for(let k=0;k<duration;k++){used.add(start+k);usedGroup.add(String(start+k));}
        const id = `SESSION-${room.id}-${day.slice(0,2).toUpperCase()}-${start}`;
        const departmentsAssigned = room.department;
        sessions.push({id,day,start,end:start+duration,roomId:room.id,activity:room.type.includes("lab")?"Scheduled practical session":room.type==="workshop"?"Workshop session":room.type==="seminar"?"Seminar / project review":room.type==="library"?"Library opening and study session":"Scheduled lecture",department:departmentsAssigned,studentGroup,expectedAttendance:Math.min(room.capacity,Math.max(1,Math.round(room.capacity*(0.72+between(seed,id,0,20)/100)))),capacity:room.capacity,sessionType:room.type.includes("lab")?"laboratory":room.type,synthetic:true});
      }
    }
  }
  const occupancyIntervals:EnergyOccupancyInterval[]=sessions.map((session)=>({id:`OCC-${session.id}`,sessionId:session.id,roomId:session.roomId,day:session.day,start:session.start,end:session.end,scheduledOccupancy:session.expectedAttendance,simulatedOccupancy:Math.max(0,Math.min(session.capacity,session.expectedAttendance+between(seed,`${session.id}att`,-1,1))),capacity:session.capacity,source:"SYNTHETIC TIMETABLE SIMULATION"}));
  return { provenance:"SYNTHETIC DEMONSTRATION DATA — not measured campus electricity, occupancy, or equipment telemetry.",seed,buildings,floors,rooms,equipment,sessions,occupancyIntervals };
}

function deptIdForGroup(department:string){return department.toUpperCase().replaceAll("&","AND").replace(/[^A-Z0-9]+/g,"_").replace(/^_|_$/g,"");}
export const SYNTHETIC_CAMPUS = generateSyntheticCampus();

export type EnergyTotals = { kWh:number; installedKW:number; avoidableKWh:number; categoryKWh:Record<string,number>; occupiedHours:number };
export function equipmentEnergy(item:EnergyEquipment, periodDays=1, simulatedOff=false, operatingDayFactor=1) {
  const effectiveHours = Math.max(0,Math.min(item.hoursPerDay,24))*Math.max(0,periodDays)*Math.max(0,operatingDayFactor);
  const active = item.quantity*item.wattsEach*effectiveHours*item.loadFactor/1000;
  const standbyHours = Math.max(0,24-Math.min(24,effectiveHours));
  const standby = simulatedOff ? 0 : item.quantity*item.standbyWatts*standbyHours*Math.max(0,periodDays)/1000;
  return {activeKWh:active,standbyKWh:standby,totalKWh:active+standby};
}
export function roomEnergy(roomId:string, options:{days?:number; switchedOff?:ReadonlySet<string>}={}):EnergyTotals {
  const days=options.days??1, room=SYNTHETIC_CAMPUS.rooms.find((item)=>item.id===roomId);
  if(!room) return {kWh:0,installedKW:0,avoidableKWh:0,categoryKWh:{},occupiedHours:0};
  const weeklyOpenDays=room.type==="library"?7:room.type==="infrastructure"?7:room.type==="club_lab"?6:5.5;
  // Normal teaching/office use is five full days plus a half Saturday; Sunday is closed.
  const scheduledDayEquivalent=days*weeklyOpenDays/7;
  let kWh=0,installedW=0,avoidableKWh=0; const categoryKWh:Record<string,number>={};
  for(const id of room.equipmentIds){const item=SYNTHETIC_CAMPUS.equipment.find((x)=>x.id===id);if(!item)continue;installedW+=item.quantity*item.wattsEach;
    const usage=equipmentEnergy(item,days,options.switchedOff?.has(id),weeklyOpenDays/7);kWh+=usage.totalKWh;categoryKWh[item.category]=(categoryKWh[item.category]??0)+usage.totalKWh;
    if(!item.essential&&!options.switchedOff?.has(id)){const outsideHours=Math.max(0,item.hoursPerDay-room.occupiedHours);avoidableKWh+=item.quantity*item.wattsEach*outsideHours*scheduledDayEquivalent*item.loadFactor/1000;}
  }
  return {kWh,installedKW:installedW/1000,avoidableKWh:Math.min(kWh,avoidableKWh),categoryKWh,occupiedHours:room.occupiedHours*scheduledDayEquivalent};
}
export function campusAnalytics(days=1) {
  const perRoom = SYNTHETIC_CAMPUS.rooms.map((room)=>({...room,...roomEnergy(room.id,{days})}));
  const perBuilding = SYNTHETIC_CAMPUS.buildings.map((building)=>{
    const rows=perRoom.filter((row)=>row.buildingId===building.id);const categoryKWh:Record<string,number>={};
    for(const row of rows)for(const [category,value]of Object.entries(row.categoryKWh))categoryKWh[category]=(categoryKWh[category]??0)+value;
    return {building,kWh:rows.reduce((sum,row)=>sum+row.kWh,0),installedKW:rows.reduce((sum,row)=>sum+row.installedKW,0),avoidableKWh:rows.reduce((sum,row)=>sum+row.avoidableKWh,0),rooms:rows.length,categoryKWh,roomsByEnergy:[...rows].sort((a,b)=>b.kWh-a.kWh)};
  });
  const categories=Object.entries(perBuilding.reduce<Record<string,number>>((total,b)=>{for(const[k,v]of Object.entries(b.categoryKWh))total[k]=(total[k]??0)+v;return total;},{})).sort((a,b)=>b[1]-a[1]);
  return {perRoom,perBuilding:perBuilding.sort((a,b)=>b.kWh-a.kWh),totalKWh:perBuilding.reduce((s,b)=>s+b.kWh,0),installedKW:perBuilding.reduce((s,b)=>s+b.installedKW,0),avoidableKWh:perBuilding.reduce((s,b)=>s+b.avoidableKWh,0),categoryKWh:Object.fromEntries(categories),highestRoom:perRoom.slice().sort((a,b)=>b.kWh-a.kWh)[0],highestDepartment:[...new Set(perRoom.map(r=>r.department))].map(department=>({department,kWh:perRoom.filter(r=>r.department===department).reduce((s,r)=>s+r.kWh,0)})).sort((a,b)=>b.kWh-a.kWh)[0]};
}
export function hourlyCampusEnergy() {
  const hours=Array.from({length:24},()=>0);
  for(const room of SYNTHETIC_CAMPUS.rooms){
    const start=room.type==="infrastructure"?0:room.buildingId==="BLDG-C"&&room.type==="library"?8:room.type==="club_lab"?16:9;
    for(const id of room.equipmentIds){const item=SYNTHETIC_CAMPUS.equipment.find((entry)=>entry.id===id);if(!item)continue;
      const activeHours=Math.min(24,item.hoursPerDay);
      const activeSet=new Set<number>();
      for(let offset=0;offset<activeHours;offset++){const hour=(start+offset)%24;activeSet.add(hour);hours[hour]+=item.quantity*item.wattsEach*item.loadFactor/1000;}
      if(item.standbyWatts>0)for(let h=0;h<24;h++)if(!activeSet.has(h))hours[h]+=item.quantity*item.standbyWatts/1000;
    }
  }
  return hours;
}
export function energyOpportunities(days=1) {
  return SYNTHETIC_CAMPUS.rooms.flatMap((room)=>SYNTHETIC_CAMPUS.equipment.filter((item)=>item.roomId===room.id&&!item.essential).map((item)=>{
    const outsideHours=Math.max(0,item.hoursPerDay-room.occupiedHours);
    const kWh=item.quantity*item.wattsEach*outsideHours*days*(room.type==="library"?1:room.type==="club_lab"?6/7:5.5/7)*item.loadFactor/1000;
    return {id:`OPP-${item.id}`,room,equipment:item,kWh,interval:`Estimated ${numberHours(room.occupiedHours)} occupied h vs ${item.hoursPerDay} modeled active h/day`,reason:"Non-essential load is modeled as active beyond the room's simulated occupied window.",assumption:"The room schedule and equipment state are synthetic; compare with approved operating exceptions before action.",confidence:"Synthetic estimate" as const};
  })).filter((event)=>event.kWh>0).sort((a,b)=>b.kWh-a.kWh);
}
function numberHours(value:number){return Number.isInteger(value)?String(value):value.toFixed(1);}
export function generateSyntheticOccupancy(room:EnergyRoom,day:string,hour:number) {
  const session=SYNTHETIC_CAMPUS.sessions.find((item)=>item.roomId===room.id&&item.day===day&&hour>=item.start&&hour<item.end);
  const scheduledOccupancy=session?.expectedAttendance??0;
  const variance=session?between(SYNTHETIC_CAMPUS.seed,`${room.id}${day}${hour}att`, -1,1):0;
  const simulatedOccupancy=Math.max(0,Math.min(room.capacity,scheduledOccupancy+variance));
  return {scheduledOccupancy,simulatedOccupancy,capacity:room.capacity,source:"SYNTHETIC TIMETABLE SIMULATION",quality:"illustrative" as const};
}
