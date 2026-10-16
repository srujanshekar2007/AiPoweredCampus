import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedIdentity } from "@/lib/authz";
import type { SensorReading } from "@/lib/campus-store";
import { aggregateSustainability } from "@/lib/sustainability-analytics";
import { authConfigured } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  if (!authConfigured()) return Response.json({error:"Campus data is unavailable until Supabase is configured."},{status:503});
  try {
    const identity=await getAuthenticatedIdentity();
    if (!identity) return Response.json({error:"Sign in with a verified campus account to view sustainability data."},{status:401});
    const period=z.enum(["today","week","month","all"]).catch("today").parse(request.nextUrl.searchParams.get("period"));
    const supabase=await createClient();
    const {data,error}=await supabase.from("sensor_readings").select("id,device_id,metric,value,unit,location,recorded_at,reading_type").order("recorded_at",{ascending:false}).limit(10000).abortSignal(AbortSignal.timeout(12_000));
    if(error) throw error;
    const readings:SensorReading[]=(data??[]).map(x=>({id:x.id,deviceId:x.device_id,metric:x.metric,value:Number(x.value),unit:x.unit,location:x.location,recordedAt:x.recorded_at,readingType:x.reading_type}));
    return Response.json({data:aggregateSustainability(readings,new Date(),period),readings,totalReadings:readings.length},{headers:{"Cache-Control":"no-store"}});
  } catch (cause) {
    const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
    console.error("[sustainability] Supabase readings query failed", { code: code || "unknown" });
    if (code === "42P01" || code === "PGRST205") return Response.json({error:"The sensor_readings table is missing. Run supabase/schema.sql in the Supabase project."},{status:503});
    if (code === "42703" || code === "PGRST204") return Response.json({error:"The sensor data schema is out of date. Run supabase/secure-onboarding.sql, then reload this page."},{status:503});
    if (code === "42501") return Response.json({error:"Supabase blocked sensor data under row-level security. Run the updated supabase/secure-onboarding.sql to enable verified campus accounts to read sustainability data."},{status:503});
    if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return Response.json({error:"Supabase took too long to return sensor readings. Check the database connection and retry."},{status:504});
    return Response.json({error:"Sustainability data could not be loaded. Check the signed-in account and Supabase sensor table."},{status:503});
  }
}
