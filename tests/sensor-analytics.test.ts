import assert from "node:assert/strict";
import test from "node:test";
import { aggregateSustainability } from "@/lib/sustainability-analytics";
import { buildSensorCards } from "@/lib/sensor-status";
import type { SensorReading } from "@/lib/campus-store";

const reading=(metric:SensorReading["metric"],value:number,recordedAt:string,unit="kWh",readingType:SensorReading["readingType"]="interval_total"):SensorReading=>({id:`${metric}-${value}`,deviceId:"meter-1",metric,value,unit,location:"Block A",recordedAt,readingType});
test("sensor cards report exact categories and NOT CONNECTED without real readings",()=>{
 const cards=buildSensorCards([],Date.parse("2026-10-16T04:00:00Z"));
 assert.deepEqual(cards.map(x=>x.name),["Dustbin Sensor","Water Level Sensor","Electricity Sensor"]);
 assert.ok(cards.every(x=>x.status==="NOT CONNECTED"&&x.latest===null));
});
test("sensor cards distinguish recent and stale readings",()=>{
 const now=Date.parse("2026-10-16T04:00:00Z");
 const cards=buildSensorCards([reading("electricity",3,"2026-10-16T03:50:00Z")],now);
 assert.equal(cards[2].status,"CONNECTED");
 const stale=buildSensorCards([reading("electricity",3,"2026-10-16T03:40:00Z")],now);
 assert.equal(stale[2].status,"STALE");
});
test("sustainability aggregates only matching-unit interval totals in the requested window",()=>{
 const now=new Date("2026-10-16T04:00:00Z");
 const data=aggregateSustainability([
  reading("electricity",3,"2026-10-16T03:00:00Z"),
  reading("electricity",4,"2026-10-09T03:00:00Z"),
  reading("electricity",99,"2026-10-16T03:00:00Z","W"),
  reading("electricity",500,"2026-10-16T03:00:00Z","kWh","counter"),
 ],now,"week");
 assert.equal(data.electricity.current,3);
 assert.equal(data.electricity.previous,4);
 assert.equal(data.water.current,null);
});
test("all-data sustainability view compares the full imported interval dataset",()=>{
 const now=new Date("2026-10-16T04:00:00Z");
 const data=aggregateSustainability([
  reading("electricity",3,"2026-10-16T03:00:00Z"),
  reading("electricity",8,"2025-04-12T03:00:00Z"),
  reading("electricity",99,"2025-04-12T03:00:00Z","kWh","counter"),
 ],now,"all");
 assert.equal(data.electricity.current,11);
 assert.equal(data.electricity.previous,null);
});
