"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuditEvent, CampusIssue } from "@/lib/campus-store";
import { buildActivityCsv } from "@/lib/activity-export";

type VerificationRequest = { userId: string; fullName: string; phone: string; campusId: string; submittedAt: string };
type CampusWorker = { userId: string; fullName: string; campusId: string };

export default function ManagementClient({ role, section, issues, auditLog, verificationRequests, verificationError, workers, demo = false }: { role: string; section: string; issues: CampusIssue[]; auditLog: AuditEvent[]; verificationRequests: VerificationRequest[]; verificationError: string; workers: CampusWorker[]; demo?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [reviewingId, setReviewingId] = useState("");
  const [pendingRequests, setPendingRequests] = useState(verificationRequests);
  const title = section === "team" ? "Campus workers" : section === "verifications" ? "User verification" : "Activity history";

  const exportActivity = () => {
    const blob = new Blob([buildActivityCsv(auditLog, issues)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = `ecotwin-activity-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  async function review(request: VerificationRequest, status: "verified" | "rejected", selectedRole?: "student" | "worker") {
    setReviewingId(request.userId); setMessage("");
    if (demo) {
      setPendingRequests((current) => current.filter((item) => item.userId !== request.userId));
      setMessage(`Demo preview: ${request.fullName}'s sample request was marked ${status} locally. Nothing was saved.`);
      setReviewingId("");
      return;
    }
    try {
      const response = await fetch(`/api/admin/verifications/${request.userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, role: status === "verified" ? selectedRole : null }) });
      const text = await response.text(); let data: { error?: string };
      try { data = JSON.parse(text); } catch { throw new Error(`Profile review returned an unreadable response (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(data.error ?? `Profile review failed (HTTP ${response.status}).`);
      setMessage(`${request.fullName}'s request was ${status}.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Profile review failed."); }
    finally { setReviewingId(""); }
  }

  const workspaceHref = demo ? `/demo/${role}` : `/workspace/${role}`;
  return <main className="management-page">{!demo && <Link className="back-link" href={workspaceHref}>← Workspace</Link>}<header><p className="eyebrow">{demo ? "DEMO · SAMPLE ADMINISTRATION" : "CAMPUS ADMINISTRATION"}</p><h1>{title}</h1><p>{demo ? "Fictional records for exploring the admin interface. Local preview actions do not grant access or save changes." : "Administrative access is limited to verified campus administrators."}</p></header>
    {section === "activity" && <section className="panel glass-panel management-card"><div className="panel-heading activity-export-heading"><div><p className="eyebrow">APPEND-ONLY ISSUE AUDIT</p><h2>Activity history</h2></div><button className="button button-outline" type="button" onClick={exportActivity} disabled={!auditLog.length}>Download CSV</button></div><div className="data-banner"><span className="data-mark">i</span><div><strong>ISSUE AUDIT</strong><span>Shows report creation and changes to assignment, priority, status, and evidence count.</span></div><span className="source-tag">{demo ? "SAMPLE DATA" : "AUDIT"}</span></div>{auditLog.length ? auditLog.map((event) => { const issue = issues.find((item) => item.id === event.issueId); return <div className="update-item" key={event.id}><span className="update-icon mint">↗</span><div><strong>{event.issueId} · {event.action.replaceAll("_", " ")}{issue ? ` · ${issue.title}` : ""}</strong><p>{event.actorName} · {Object.keys(event.changes).length ? JSON.stringify(event.changes) : "No field changes"}</p></div><time>{new Date(event.createdAt).toLocaleString()}</time></div>; }) : <p className="muted">{demo ? "No sample audit events in this view." : "No authorized audit events recorded yet."}</p>}</section>}
    {section === "team" && <section className="panel glass-panel management-card"><div className="panel-heading"><div><p className="eyebrow">{demo ? "SAMPLE CAMPUS ACCOUNTS" : "VERIFIED CAMPUS ACCOUNTS"}</p><h2>Workers</h2></div></div>{workers.length ? <div className="management-table"><div className="management-row table-head"><span>Name</span><span>Campus ID</span><span>Open assignments</span><span>Access</span></div>{workers.map((worker) => <div className="management-row" key={worker.userId}><strong>{worker.fullName}</strong><span>{worker.campusId}</span><span>{issues.filter((issue) => issue.assignee === worker.fullName && issue.status !== "verified").length}</span><span className="source-tag">{demo ? "SAMPLE" : "VERIFIED"}</span></div>)}</div> : <div className="empty-state"><strong>No workers are listed in this view</strong></div>}</section>}
    {section === "verifications" && <section className="panel glass-panel management-card"><div className="data-banner"><span className="data-mark">i</span><div><strong>{demo ? "SIMULATED PROFILE REVIEW" : "MANUAL IDENTITY REVIEW"}</strong><span>{demo ? "Sample profiles only. Review buttons update this screen locally and do not issue accounts or permissions." : "Compare each submission with authorized campus identity records before approval. Approvals assign student or worker access."}</span></div><span className="source-tag">{demo ? "SAMPLE" : "PENDING"}</span></div>{verificationError && !demo ? <p className="auth-notice" role="alert">{verificationError}</p> : pendingRequests.length ? pendingRequests.map((request) => <VerificationCard key={request.userId} request={request} busy={reviewingId === request.userId} onReview={review}/> ) : <div className="empty-state"><strong>{demo ? "No sample profiles remain in this preview" : "No pending verification requests"}</strong><p>{demo ? "Reload the demo to restore the example rows." : "New requests will appear after users submit their campus profile."}</p></div>}{message && <p className="auth-notice" role="status">{message}</p>}</section>}
  </main>;
}

function VerificationCard({ request, busy, onReview }: { request: VerificationRequest; busy: boolean; onReview: (request: VerificationRequest, status: "verified" | "rejected", role?: "student" | "worker") => void }) {
  const [role, setRole] = useState<"student" | "worker">("student");
  return <article className="verification-request"><div><p className="eyebrow">SUBMITTED {new Date(request.submittedAt).toLocaleString()}</p><h2>{request.fullName}</h2><dl><div><dt>College ID</dt><dd>{request.campusId}</dd></div><div><dt>Phone</dt><dd>{request.phone}</dd></div></dl><p className="muted small">Confirm these details against authorized campus records before approving.</p></div><div className="verification-actions"><label>Workspace role<select value={role} onChange={(event) => setRole(event.target.value as "student" | "worker")}><option value="student">Student</option><option value="worker">Worker</option></select></label><button className="button button-primary" type="button" disabled={busy} onClick={() => onReview(request, "verified", role)}>{busy ? "Saving…" : "Verify and assign"}</button><button className="button button-outline" type="button" disabled={busy} onClick={() => onReview(request, "rejected")}>Reject</button></div></article>;
}
