import { notFound } from "next/navigation";
import ManagementClient from "@/components/admin/ManagementClient";
import { getCampusData } from "@/lib/campus-store";
import { createClient } from "@/lib/supabase/server";

const allowedSections = new Set(["team", "activity", "verifications"]);

export default async function ManagementPage({ params }: PageProps<"/workspace/[role]/manage/[section]">) {
  const { role, section } = await params;
  if (role !== "admin" || !allowedSections.has(section)) notFound();
  const { issues, auditLog } = await getCampusData();
  let verificationRequests: { userId: string; fullName: string; phone: string; campusId: string; submittedAt: string }[] = [];
  let workers: { userId: string; fullName: string; campusId: string }[] = [];
  let verificationError = "";
  if (section === "verifications" || section === "team") {
    try {
      const supabase = await createClient();
      if (section === "verifications") {
        const { data, error } = await supabase.from("campus_profiles").select("user_id,full_name,phone,campus_id,submitted_at").eq("verification_status", "pending").order("submitted_at", { ascending: true });
        if (error) throw error;
        verificationRequests = (data ?? []).map((row) => ({ userId: row.user_id, fullName: row.full_name, phone: row.phone, campusId: row.campus_id, submittedAt: row.submitted_at }));
      } else {
        const { data, error } = await supabase.from("campus_profiles").select("user_id,full_name,campus_id").eq("verification_status", "verified").eq("role", "worker").order("full_name");
        if (error) throw error;
        workers = (data ?? []).map((row) => ({ userId: row.user_id, fullName: row.full_name, campusId: row.campus_id }));
      }
    } catch { verificationError = "Verification requests are unavailable. Apply the secure onboarding migration and check administrator access."; }
  }
  return <ManagementClient role={role} section={section} issues={issues} auditLog={auditLog} verificationRequests={verificationRequests} verificationError={verificationError} workers={workers}/>;
}
