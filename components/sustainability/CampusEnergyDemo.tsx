"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { campusAnalytics, energyOpportunities, equipmentEnergy, generateSyntheticOccupancy, hourlyCampusEnergy, roomEnergy, SYNTHETIC_CAMPUS } from "@/lib/energy-campus";

const number = (value:number, digits=1) => value.toLocaleString(undefined,{maximumFractionDigits:digits});
const categoryLabels:Record<string,string>={lighting:"Lighting",fans:"Fans",cooling:"Air conditioning",computers:"Computers & monitors",network:"Networking",av:"Audio visual",lab_equipment:"Laboratory equipment",motors:"Motors & machines",ventilation:"Ventilation",office_equipment:"Office equipment",essential_infrastructure:"Essential infrastructure"};

export default function CampusEnergyDemo({role}:{role?:string}) {
  const [buildingId,setBuildingId]=useState("");
  const [floorId,setFloorId]=useState("");
  const [roomId,setRoomId]=useState("");
  const [days,setDays]=useState(1);
  const [selectedOff,setSelectedOff]=useState<Set<string>>(new Set());
  const [filterDepartment,setFilterDepartment]=useState("");
  const [filterCategory,setFilterCategory]=useState("");
  const analytics=useMemo(()=>campusAnalytics(days),[days]);
  const buildings=SYNTHETIC_CAMPUS.buildings;
  const floors=SYNTHETIC_CAMPUS.floors.filter(f=>!buildingId||f.buildingId===buildingId);
  const rooms=SYNTHETIC_CAMPUS.rooms.filter(r=>(!buildingId||r.buildingId===buildingId)&&(!floorId||r.floorId===floorId)&&(!filterDepartment||r.department===filterDepartment)&&(!filterCategory||r.type===filterCategory));
  const selectedRoom=SYNTHETIC_CAMPUS.rooms.find(r=>r.id===roomId&&rooms.some(candidate=>candidate.id===r.id))??rooms[0];
  const selectedBuilding=buildings.find(b=>b.id===buildingId);
  const buildingRows=analytics.perBuilding;
  const selectedStats=selectedRoom?roomEnergy(selectedRoom.id,{days,switchedOff:selectedOff}):null;
  const baseline=selectedRoom?roomEnergy(selectedRoom.id,{days}):null;
  const avoided=Math.max(0,(baseline?.kWh??0)-(selectedStats?.kWh??0));
  const roomStats=analytics.perRoom.filter(row=>(!buildingId||row.buildingId===buildingId)&&(!floorId||row.floorId===floorId)&&(!filterDepartment||row.department===filterDepartment)&&(!filterCategory||row.type===filterCategory));
  const highRoom=roomStats.slice().sort((a,b)=>b.kWh-a.kWh)[0];
  const departments=[...new Set(SYNTHETIC_CAMPUS.rooms.map(r=>r.department))].sort();
  const roomTypes=[...new Set(SYNTHETIC_CAMPUS.rooms.map(r=>r.type))].sort();
  const selectedEquip=selectedRoom?SYNTHETIC_CAMPUS.equipment.filter(e=>e.roomId===selectedRoom.id):[];
  const selectedOperatingDayFactor=selectedRoom?(selectedRoom.type==="library"||selectedRoom.type==="infrastructure"?1:selectedRoom.type==="club_lab"?6/7:5.5/7):1;
  const daysLabel=days===1?"daily":days===7?"weekly":"monthly";
  const roomOccupancy=selectedRoom?generateSyntheticOccupancy(selectedRoom,"Monday",10):null;
  const toggle=(id:string)=>setSelectedOff(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const selectBuilding=(value:string)=>{setBuildingId(value);setFloorId("");setRoomId("");setSelectedOff(new Set());};
  const selectFloor=(value:string)=>{setFloorId(value);setRoomId("");setSelectedOff(new Set());};
  const maxBuilding=Math.max(...buildingRows.map(b=>b.kWh),1);
  const categories=Object.entries(analytics.categoryKWh);
  const topBuilding=buildingRows[0];
  const topCategory=topBuilding?Object.entries(topBuilding.categoryKWh).sort((a,b)=>b[1]-a[1])[0]:undefined;
  const topCategoryShare=topBuilding&&topCategory?100*topCategory[1]/Math.max(topBuilding.kWh,0.001):0;
  const topRoomInBuilding=topBuilding?.roomsByEnergy[0];
  const opportunities=useMemo(()=>energyOpportunities(days).filter((event)=>(!buildingId||event.room.buildingId===buildingId)&&(!floorId||event.room.floorId===floorId)&&(!filterDepartment||event.room.department===filterDepartment)&&(!filterCategory||event.room.type===filterCategory)),[days,buildingId,floorId,filterDepartment,filterCategory]);
  const scheduledCapacity=SYNTHETIC_CAMPUS.sessions.reduce((sum,session)=>sum+session.capacity,0);
  const occupancyPercent=scheduledCapacity?100*SYNTHETIC_CAMPUS.sessions.reduce((sum,session)=>sum+session.expectedAttendance,0)/scheduledCapacity:0;
  const hourlyProfile=useMemo(()=>hourlyCampusEnergy(),[]);

  return <section className="energy-demo" aria-labelledby="energy-demo-title">
    <div className="energy-demo-banner"><strong>DEMO DATA · SIMULATED CAMPUS MODEL</strong><span>Equipment, timetable, occupancy and energy are synthetic examples. These are not measured electricity readings.</span></div>
    <header className="energy-demo-heading"><div><p className="eyebrow">CAMPUS ENERGY · DIGITAL TWIN MODEL</p><h2 id="energy-demo-title">Estimated campus energy</h2><p>Explore the linked room inventory, operating schedule and explainable energy estimates.</p></div>{role && <Link href={`/workspace/${role}/twin`} className="button button-outline">Open Digital Twin →</Link>}</header>
    <div className="energy-period-tabs" role="group" aria-label="Energy period">{[{days:1,label:"Daily"},{days:7,label:"Weekly"},{days:30,label:"Monthly"}].map(item=><button key={item.days} type="button" className={days===item.days?"selected":""} onClick={()=>setDays(item.days)} aria-pressed={days===item.days}>{item.label}</button>)}</div>
    <div className="energy-kpis">
      <EnergyKpi title={`${daysLabel} estimated consumption`} value={`${number(analytics.totalKWh)} kWh`} note="Calculated from equipment schedules and load factors"/>
      <EnergyKpi title="Installed electrical load" value={`${number(analytics.installedKW)} kW`} note="Connected rated power; not consumption"/>
      <EnergyKpi title="Potentially avoidable estimate" value={`${number(analytics.avoidableKWh)} kWh`} note={`${number(analytics.totalKWh?100*analytics.avoidableKWh/analytics.totalKWh:0)}% of simulated use; non-essential loads only`}/>
      <EnergyKpi title="Highest energy room" value={analytics.highestRoom?.name??"—"} note={`${analytics.highestRoom?.buildingId.replace("BLDG-","Building ")??""} · ${number(analytics.highestRoom?.kWh??0)} kWh per day`}/>
      <EnergyKpi title="Highest consuming department" value={analytics.highestDepartment?.department??"—"} note={`${number(analytics.highestDepartment?.kWh??0)} kWh/day calculated across its rooms`}/>
      <EnergyKpi title="Synthetic utilization / review items" value={`${number(occupancyPercent,0)}% · ${opportunities.length}`} note="Scheduled attendance / capacity · modeled equipment opportunities in selected scope"/>
    </div>
    <div className="energy-analysis-grid">
      <article className="panel glass-panel energy-card energy-buildings"><div className="energy-card-head"><div><p className="eyebrow">BUILDING COMPARISON</p><h3>All four buildings · {daysLabel}</h3></div><span className="energy-inline-tag">Data-derived ranking</span></div>
        {buildingRows.map((row,index)=>{const dominant=Object.entries(row.categoryKWh).sort((a,b)=>b[1]-a[1])[0];const leadRoom=row.roomsByEnergy[0];return <button className={`energy-building-row ${buildingId===row.building.id?"active":""}`} key={row.building.id} type="button" onClick={()=>selectBuilding(buildingId===row.building.id?"":row.building.id)}>
          <span className="energy-rank">{index+1}</span><span className="energy-building-name"><strong>{row.building.code} · {row.building.name}</strong><small>{row.building.floors} floors · {number(row.building.areaM2,0)} m² · {number(row.installedKW)} kW installed</small><i><b style={{width:`${Math.max(1,row.kWh/maxBuilding*100)}%`}}/></i></span><strong>{number(row.kWh)} kWh</strong><small>{number(row.avoidableKWh)} kWh potentially avoidable</small><small>Top driver: {dominant?categoryLabels[dominant[0]]??dominant[0]:"no category"} · {leadRoom?.id} {leadRoom?.name}</small>
        </button>})}
        <p className="energy-reason"><strong>Why is {topBuilding?.building.name} highest?</strong> {topCategory&&topRoomInBuilding?`${categoryLabels[topCategory[0]]??topCategory[0]} is its largest modeled load category (${number(topCategoryShare,0)}%); ${topRoomInBuilding.id} · ${topRoomInBuilding.name} is the highest-energy room at ${number(topRoomInBuilding.kWh)} kWh for this period. The ranking follows its configured inventory, rated power and simulated operating hours.`:"Energy explanations appear when equipment data is available."} Values and ranking are generated from the current synthetic inventory.</p>
      </article>
      <article className="panel glass-panel energy-card"><div className="energy-card-head"><div><p className="eyebrow">ENERGY CONTRIBUTION</p><h3>Campus load categories</h3></div></div>
        <div className="energy-categories">{categories.map(([category,value])=><div key={category}><span>{categoryLabels[category]??category}</span><i><b style={{width:`${Math.max(1,value/Math.max(1,analytics.totalKWh)*100)}%`}}/></i><strong>{number(value)} kWh</strong><small>{number(100*value/Math.max(analytics.totalKWh,0.001))}%</small></div>)}</div>
        <div className="energy-hourly"><p className="eyebrow">SYNTHETIC WEEKDAY · HOURLY ESTIMATED kWh</p><div className="energy-hourly-bars">{hourlyProfile.slice(7,21).map((value,index)=>{const hour=index+7;return <div key={hour} title={`${hour}:00 · ${number(value)} kWh`}><i style={{height:`${Math.max(4,value/Math.max(...hourlyProfile)*100)}%`}}/><small>{hour}</small></div>})}</div><small>Calculated from equipment power, load factor, active hours and standby power; outside-week schedules are handled in period totals.</small></div>
      </article>
    </div>
    <article className="panel glass-panel energy-card energy-drilldown"><div className="energy-card-head"><div><p className="eyebrow">CAMPUS → BUILDING → FLOOR → ROOM → EQUIPMENT</p><h3>Room energy and utilization explorer</h3></div><span className="energy-inline-tag">{roomStats.length} matching rooms</span></div>
      <div className="energy-selectors"><label>Building<select value={buildingId} onChange={e=>selectBuilding(e.target.value)}><option value="">All buildings</option>{buildings.map(b=><option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}</select></label><label>Floor<select value={floorId} onChange={e=>selectFloor(e.target.value)}><option value="">All floors</option>{floors.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label><label>Department<select value={filterDepartment} onChange={e=>{setFilterDepartment(e.target.value);setRoomId("");setSelectedOff(new Set())}}><option value="">All departments</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label><label>Room type<select value={filterCategory} onChange={e=>{setFilterCategory(e.target.value);setRoomId("");setSelectedOff(new Set())}}><option value="">All room types</option>{roomTypes.map(t=><option key={t}>{t.replaceAll("_"," ")}</option>)}</select></label><label>Room<select value={selectedRoom?.id??""} onChange={e=>{setRoomId(e.target.value);setSelectedOff(new Set())}}><option value="">Choose room</option>{rooms.map(r=><option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}</select></label></div>
      {selectedBuilding&&<p className="energy-building-context">{selectedBuilding.purpose}. {number(selectedBuilding.areaM2,0)} m² total floor area. {buildingRows.find(r=>r.building.id===selectedBuilding.id)?.rooms??0} modeled rooms.</p>}
      {selectedRoom&&selectedStats&&baseline&&<div className="energy-room-detail"><div className="energy-room-summary"><div><span className="eyebrow">{selectedRoom.id} · {selectedRoom.buildingId.replace("BLDG-","BUILDING ")} · {SYNTHETIC_CAMPUS.floors.find(f=>f.id===selectedRoom.floorId)?.label}</span><h4>{selectedRoom.name}</h4><p>{selectedRoom.department} · {selectedRoom.type.replaceAll("_"," ")} · {selectedRoom.areaM2} m² · capacity {selectedRoom.capacity||"n/a"}</p><small>Schedule: {selectedRoom.schedule}</small></div><div><strong>{number(baseline.kWh)} kWh</strong><span>baseline {daysLabel}</span><strong>{number(baseline.installedKW)} kW</strong><span>installed</span></div></div>
        <div className="energy-room-metrics"><span>Scheduled occupied: <b>{selectedRoom.occupiedHours} h/day</b></span><span>Simulated occupancy at Monday 10:00: <b>{roomOccupancy?.simulatedOccupancy??0}/{roomOccupancy?.capacity??0}</b></span><span>Potential off-schedule estimate: <b>{number(baseline.avoidableKWh)} kWh</b></span></div>
        <div className="energy-equipment-table"><div className="energy-table-heading"><span>Equipment inventory</span><span>Power</span><span>Schedule / state</span><span>Estimated energy · {daysLabel}</span><span>Simulation</span></div>{selectedEquip.map(item=>{const estimate=equipmentEnergy(item,days,selectedOff.has(item.id),selectedOperatingDayFactor);return <div className="energy-equipment-row" key={item.id}><span><strong>{item.name}</strong><small>{item.id} · {item.category.replaceAll("_"," ")} · {item.quantity} × {item.wattsEach} W{item.essential?" · essential":""}{item.portable?" · portable":" · installed"}</small></span><span>{number(item.quantity*item.wattsEach/1000,2)} kW</span><span>{item.hoursPerDay} active h/day · {item.state}</span><span>{number(estimate.totalKWh)} kWh</span><span>{item.essential?<em>Essential</em>:<label className="energy-switch"><input type="checkbox" checked={selectedOff.has(item.id)} onChange={()=>toggle(item.id)}/> Simulate off</label>}</span></div>})}</div>
        <div className="energy-simulation-result"><div><strong>Energy-saving scenario · {selectedOff.size} eligible item{selectedOff.size===1?"":"s"} switched off</strong><span>Software-only estimate. No equipment control command is sent. Essential networking and safety loads are exempt.</span></div><div><span>Baseline <b>{number(baseline.kWh)} kWh</b></span><span>Scenario <b>{number(selectedStats.kWh)} kWh</b></span><span>Estimated difference <b>{number(avoided)} kWh ({number(baseline.kWh?100*avoided/baseline.kWh:0)}%)</b></span></div></div>
      </div>}
    </article>
    <article className="panel glass-panel energy-card energy-opportunities"><div className="energy-card-head"><div><p className="eyebrow">TRANSPARENT RULE-BASED REVIEW</p><h3>Potential off-schedule opportunities</h3></div><span className="energy-inline-tag">Estimates · not measured waste</span></div>
      <p className="muted">Non-essential equipment hours beyond the simulated occupied window are flagged as review opportunities. Unoccupied rooms are not automatically treated as waste; equipment-specific exemptions and estimates apply.</p>
      <div className="energy-opportunity-table"><div><b>Room / equipment</b><b>Building / floor</b><b>Modeled interval</b><b>Rated load</b><b>Potentially avoidable</b><b>Reason / next step</b></div>{opportunities.slice(0,10).map(event=><div key={event.id}><span>{event.room.id} · {event.equipment.name}</span><span>{event.room.buildingId.replace("BLDG-","Building ")} · {SYNTHETIC_CAMPUS.floors.find(f=>f.id===event.room.floorId)?.label}</span><span>{event.interval}</span><span>{number(event.equipment.quantity*event.equipment.wattsEach/1000,2)} kW</span><span>{number(event.kWh)} kWh · {daysLabel}</span><span>{event.reason} {event.assumption}</span></div>)}</div>
      {highRoom&&<p className="energy-reason"><strong>Selected scope&apos;s top room:</strong> {highRoom.id} · {highRoom.name} uses an estimated {number(highRoom.kWh)} kWh per day from the current deterministic inventory and operating assumptions.</p>}
    </article>
    <p className="energy-footnote">Model assumptions: synthetic equipment ratings, deterministic schedules and load factors. Installed kW is connected rated power. kWh is calculated energy. Standby loads are separate. Estimated avoidable energy is an opportunity for human review, not confirmed waste or realized savings. Dataset seed: {SYNTHETIC_CAMPUS.seed}.</p>
  </section>;
}

function EnergyKpi({title,value,note}:{title:string;value:string;note:string}) { return <article className="panel glass-panel energy-kpi"><p className="eyebrow">{title.toUpperCase()}</p><strong>{value}</strong><small>{note}</small></article>; }
