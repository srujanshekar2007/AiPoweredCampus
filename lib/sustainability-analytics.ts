import type { SensorReading } from "@/lib/campus-store";

export type Period = "today" | "week" | "month" | "all";
const OFFSET = 330 * 60_000; // campus timezone Asia/Kolkata
export function periodRanges(now: Date, period: Period) {
  if (period === "all") return { start: new Date(0), end: now, previousStart: new Date(0), previousEnd: new Date(0) };
  const local = new Date(now.getTime() + OFFSET);
  const y=local.getUTCFullYear(), m=local.getUTCMonth(), d=local.getUTCDate();
  let startLocal: number;
  if (period === "today") startLocal = Date.UTC(y,m,d);
  else if (period === "week") { const day=local.getUTCDay() || 7; startLocal=Date.UTC(y,m,d-day+1); }
  else startLocal=Date.UTC(y,m,1);
  const start = new Date(startLocal - OFFSET);
  const elapsed = Math.max(0, now.getTime()-start.getTime());
  const previousStart = period === "today" ? new Date(start.getTime()-86400000) : period === "week" ? new Date(start.getTime()-7*86400000) : new Date(Date.UTC(y,m-1,1)-OFFSET);
  return { start, end: now, previousStart, previousEnd: new Date(previousStart.getTime()+elapsed) };
}
export function aggregateSustainability(readings: SensorReading[], now: Date, period: Period) {
  const r=periodRanges(now,period);
  const sum=(metric: SensorReading["metric"], unit: string, from: Date, to: Date) => {
    const rows=readings.filter(x=>x.metric===metric && (x.unit===unit || (metric==="water" && unit==="L" && x.unit==="m3")) && x.readingType==="interval_total" && Date.parse(x.recordedAt)>=from.getTime() && Date.parse(x.recordedAt)<to.getTime());
    return rows.length ? rows.reduce((total,x)=>total+x.value*(metric==="water"&&x.unit==="m3"?1000:1),0) : null;
  };
  return {
    period, timezone:"Asia/Kolkata", start:r.start.toISOString(), end:r.end.toISOString(), previousStart:r.previousStart.toISOString(), previousEnd:r.previousEnd.toISOString(),
    electricity:{unit:"kWh",current:sum("electricity","kWh",r.start,r.end),previous:sum("electricity","kWh",r.previousStart,r.previousEnd)},
    water:{unit:"L",current:sum("water","L",r.start,r.end),previous:sum("water","L",r.previousStart,r.previousEnd)},
    wasteGenerated:{unit:"kg",current:sum("dustbin","kg",r.start,r.end),previous:sum("dustbin","kg",r.previousStart,r.previousEnd)},
    wasteDiverted:{unit:"kg",current:sum("waste_diverted","kg",r.start,r.end),previous:sum("waste_diverted","kg",r.previousStart,r.previousEnd)},
  };
}
