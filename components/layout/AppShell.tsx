"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuditEvent, CampusIssue, SensorReading } from "@/lib/campus-store";
import { createClient } from "@/lib/supabase/client";
import { useNotificationReadThrough } from "@/components/notifications/useNotificationReadState";
import { countUnreadNotifications } from "@/lib/notification-policy";
import AssistantDock from "@/components/assistant/AssistantDock";
import IssueLocationPicker from "@/components/layout/IssueLocationPicker";
import IssueCameraCapture from "@/components/layout/IssueCameraCapture";
import type { TwinData } from "@/components/twin/types";
import type { TwinLocationSelection } from "@/components/twin/types";
import { submitIssueReport } from "@/lib/issue-report-client";

type Role = "student" | "worker" | "admin";
const navs: Record<Role, string[]> = {
  student: ["Overview", "Campus Digital Twin", "Report an Issue", "My Reports", "Sustainability", "Notifications", "EcoTwin Help"],
  worker: ["Overview", "My Tasks", "My Schedule", "Campus Digital Twin", "Sensor Feed", "Sustainability", "Notifications", "EcoTwin Help"],
  admin: ["Overview", "All Issues", "Workers", "Assignments", "Campus Digital Twin", "Sensor Feed", "User Verification", "Notifications", "Sustainability", "Activity History", "EcoTwin Help"],
};
const navRoutes: Record<string, string> = { "EcoTwin Help": "assistant", Sustainability: "sustainability", Notifications: "notifications", Workers: "manage/team", "User Verification": "manage/verifications", "Activity History": "manage/activity", "Sensor Feed": "sensors", Profile: "profile", Settings: "settings" };
const titleOf = (issue: CampusIssue) => issue.title;
const statusLabel: Record<CampusIssue["status"], string> = { open: "Needs review", assigned: "Assigned", in_progress: "In progress", resolved: "Resolved · awaiting review", verified: "Verified" };

export function AppShell({ role, identity, twinData, geometryUnavailable }: { role: Role; identity: { id: string; name: string; email: string }; twinData: TwinData; geometryUnavailable: boolean }) {
  const router = useRouter();
  const name = identity.name; const [active, setActive] = useState("Overview");
  const [issues, setIssues] = useState<CampusIssue[]>([]); const [auditLog, setAuditLog] = useState<AuditEvent[]>([]); const [auditLogAvailable, setAuditLogAvailable] = useState(true); const [readings, setReadings] = useState<SensorReading[]>([]); const [sensors, setSensors] = useState<{ id: string; name: string; icon: string; status: string; latest: SensorReading | null }[]>([]); const [workers, setWorkers] = useState<{userId:string;fullName:string;campusId:string}[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [sensorError, setSensorError] = useState(""); const [reportOpen, setReportOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [dark, setDark] = useState(false); const [assistantOpen, setAssistantOpen] = useState(true);
  const [form, setForm] = useState({ title: "", description: "", category: "Water", location: "", locationSelection: null as Omit<TwinLocationSelection, "location"> | null, priority: "medium" });
  const [reportStep, setReportStep] = useState<"photo" | "review">("photo");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [photoAnalysisMessage, setPhotoAnalysisMessage] = useState("");
  const [photoDetected, setPhotoDetected] = useState<boolean | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const reportSubmitLock = useRef(false);
  const [reportSubmitNotice, setReportSubmitNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/campus", { cache: "no-store" }); const text = await response.text();
      let data: { error?: string; issues?: CampusIssue[]; auditLog?: AuditEvent[]; auditLogAvailable?: boolean };
      try { data = JSON.parse(text); } catch { throw new Error(`Campus data service returned an unreadable response (HTTP ${response.status}).`); }
      if (!response.ok) throw new Error(data.error ?? `Campus data service failed (HTTP ${response.status}).`);
      setIssues(data.issues ?? []); setAuditLog(data.auditLog ?? []); setAuditLogAvailable(data.auditLogAvailable !== false); setError("");
      if (role === "worker" || role === "admin") {
        const sensorResponse = await fetch("/api/sensors", { cache: "no-store" }); const sensorText = await sensorResponse.text();
        let sensorData: { error?: string; sensors?: typeof sensors; readings?: SensorReading[] };
        try { sensorData = JSON.parse(sensorText); } catch { throw new Error(`Sensor service returned an unreadable response (HTTP ${sensorResponse.status}).`); }
        if (!sensorResponse.ok) { setSensorError(sensorData.error ?? `Sensor service failed (HTTP ${sensorResponse.status}).`); setSensors([]); setReadings([]); }
        else { setSensors(sensorData.sensors ?? []); setReadings(sensorData.readings ?? []); setSensorError(""); }
      } else { setSensors([]); setReadings([]); }
      if (role === "admin") { try { const wr = await fetch("/api/admin/workers", {cache:"no-store"}); const wt=await wr.text(); const wd=JSON.parse(wt); if(!wr.ok) throw new Error(wd.error ?? "Verified worker list could not be loaded."); setWorkers(wd.workers ?? []); } catch { setWorkers([]); } }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Campus data service is unavailable. Check authentication and database configuration."); }
    finally { setLoading(false); }
  }, [role]);

  useEffect(() => { void Promise.resolve().then(() => { setDark(localStorage.getItem("ecotwin-theme") === "dark"); return reload(); }); }, [reload]);
  
  useEffect(() => {
    if (role !== "worker") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [role, reload]);

  const visibleIssues = useMemo(() => issues, [issues]);
  const notificationScope = identity.id;
  const readThrough = useNotificationReadThrough(notificationScope);
  const visibleIssueIds = useMemo(() => new Set(visibleIssues.map((issue) => issue.id)), [visibleIssues]);
  const visibleNotifications = useMemo(() => auditLog.filter((event) => visibleIssueIds.has(event.issueId)), [auditLog, visibleIssueIds]);
  const unreadNotifications = countUnreadNotifications(visibleNotifications, readThrough);
  
  const updateIssue = async (id: string, patch: Record<string, unknown>) => { 
    const response = await fetch(`/api/campus/issues/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); 
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error ?? `Issue update failed (HTTP ${response.status}).`); return; } 
    await reload(); 
  };

  const signOut = async () => { await createClient().auth.signOut(); router.push("/login"); router.refresh(); };
  
  const resetReportWizard = () => {
    setForm({ title: "", description: "", category: "Water", location: "", locationSelection: null, priority: "medium" });
    setReportStep("photo"); setPhotoDataUrl(""); setPhotoName(""); setAnalyzingPhoto(false); setPhotoAnalysisMessage(""); setPhotoDetected(null);
  };

  const selectIssuePhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhotoAnalysisMessage("Choose an image file such as JPG, PNG, or WebP."); return; }
    if (file.size > 10 * 1024 * 1024) { setPhotoAnalysisMessage("This photo is larger than 10 MB. Choose a smaller image."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not process this image.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const compressed = canvas.toDataURL("image/jpeg", 0.72);
      if (compressed.length > 4_000_000) throw new Error("The processed photo is still too large. Choose a smaller image.");
      setPhotoDataUrl(compressed); setPhotoName(file.name); setPhotoAnalysisMessage(""); setPhotoDetected(null);
    } catch (e) { setPhotoAnalysisMessage(e instanceof Error ? e.message : "Could not read this image."); }
  };

  const analyzeIssuePhoto = async () => {
    if (!photoDataUrl) { setPhotoAnalysisMessage("Upload a photo before continuing."); return; }
    setAnalyzingPhoto(true); setPhotoAnalysisMessage("Analyzing the photo. You can review and correct every suggestion.");
    try {
      const response = await fetch("/api/campus/analyze-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl: photoDataUrl }) });
      const text = await response.text(); let data; try { data = JSON.parse(text); } catch { throw new Error("Photo analysis returned an unreadable response."); }
      if (!response.ok || !data.suggestion) {
        setPhotoAnalysisMessage(data.error ?? "The photo could not be analyzed. You can enter the issue manually.");
        setPhotoDetected(false); setReportStep("review"); return;
      }
      const suggestion = data.suggestion;
      setForm((current) => ({ ...current, title: suggestion.title || current.title, description: suggestion.description || current.description, category: suggestion.category || "Other", priority: suggestion.priority || "medium" }));
      setPhotoDetected(suggestion.detected === true && suggestion.confidence >= 0.65);
      const confidencePercent = Math.round(suggestion.confidence * 100);
      setPhotoAnalysisMessage(suggestion.detected && suggestion.confidence >= 0.65 ? `AI suggestion ready (${confidencePercent}% confidence). Please verify it before submitting.` : "The issue was not identified confidently. Please describe and classify it manually; you can correct any field below.");
      setReportStep("review");
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "AI image analysis could not be reached.";
      setPhotoAnalysisMessage(`${reason} You can retry the analysis or continue with manual details.`); setPhotoDetected(false); setReportStep("review");
    } finally { setAnalyzingPhoto(false); }
  };

  const submitReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reportSubmitLock.current) return;
    if (!photoDataUrl) { setReportStep("photo"); setPhotoAnalysisMessage("A photo is required to start a report. Please upload one first."); return; }
    reportSubmitLock.current = true;
    setReportSubmitting(true); setReportSubmitNotice(null);
    try {
      const issue = await submitIssueReport({ ...form, evidence: [photoDataUrl] });
      const reference = issue.id!.slice(0, 8).toUpperCase();
      setReportSubmitNotice({ type: "success", message: `Report submitted successfully. Reference: ${reference}.` });
      resetReportWizard(); setReportOpen(false); setActive(role === "student" ? "My Reports" : "All Issues");
      await reload();
    } catch (cause) {
      setReportSubmitNotice({ type: "error", message: cause instanceof Error ? cause.message : "Report submission failed. Check your connection and try again." });
    } finally {
      reportSubmitLock.current = false;
      setReportSubmitting(false);
    }
  };

  const counts = { open: issues.filter((i) => i.status === "open").length, working: issues.filter((i) => i.status === "in_progress" || i.status === "assigned").length, done: issues.filter((i) => i.status === "resolved" || i.status === "verified").length };

  return (
    <div className={`workspace-root ${dark ? "theme-dark" : ""}`}>
      <header className="topbar">
        <div className="topbar-brand">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
          <Link href="/login" className="brand-lockup"><span className="brand-mark">E</span><span>EcoTwin</span></Link>
          <span className="topbar-divider"/><span className="campus-name">Campus operations</span>
        </div>
        <div className="topbar-actions">
          <span className="emergency-chip"><span className="emergency-dot"/> Emergency <a className="emergency-number" href="tel:112">112</a></span>
          <button className="icon-button" aria-label="Toggle color theme" onClick={() => { const next = !dark; setDark(next); localStorage.setItem("ecotwin-theme", next ? "dark" : "light"); }}>{dark ? "☼" : "◐"}</button>
          <button className="icon-button" aria-label="Refresh campus data" onClick={() => void reload()}>↻</button>
          <div className="profile-chip">
            <span className="profile-avatar">{name.split(" ").map((s) => s[0]).join("")}</span>
            <span className="profile-name">{name}<small>{role === "admin" ? "Administrator" : role === "worker" ? "Campus worker" : "Student"}</small></span>
          </div>
        </div>
      </header>
      <div className={`workspace-grid ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-nav-open" : ""} ${assistantOpen ? "assistant-open" : "assistant-closed"}`}>
        <aside className="sidebar glass-panel" aria-label="Workspace navigation">
          <div className="workspace-switcher">
            <span className="switcher-icon">{role === "student" ? "S" : role === "worker" ? "W" : "A"}</span>
            <span className="switcher-copy"><strong>{role === "admin" ? "Administrator" : role === "worker" ? "Campus worker" : "Student"}</strong><small>Campus workspace</small></span>
          </div>
          <p className="nav-caption">WORKSPACE</p>
          <nav className="side-nav">
            {navs[role].map((item, i) => navRoutes[item] ? (
              <Link key={item} href={`/workspace/${role}/${navRoutes[item]}`} className={`nav-item ${item === "Sustainability" ? "sustainability-nav-item" : ""}`}>
                <span className="nav-icon">{item === "EcoTwin Help" ? "✳" : "◌"}</span>
                <span className="nav-label">{item}</span>
                {item === "Notifications" && unreadNotifications > 0 && <span className="nav-count" aria-label={`${unreadNotifications} unread notifications`}>{unreadNotifications}</span>}
              </Link>
            ) : (
              <button key={item} className={`nav-item ${active === item ? "active" : ""}`} onClick={() => { setActive(item); setMobileOpen(false); if (item === "Report an Issue") setReportOpen(true); }}>
                <span className="nav-icon">{["⌂", "◈", "+", "▤", "◌", "♧", "◷", "▦", "₹", "↗"][i] ?? "•"}</span>
                <span className="nav-label">{item}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-spacer"/>
          <p className="nav-caption account-caption">ACCOUNT</p>
          <nav className="side-nav account-nav" aria-label="Account navigation">
            <Link href={`/workspace/${role}/profile`} className={`nav-item ${active === "Profile" ? "active" : ""}`} onClick={() => { setActive("Profile"); setMobileOpen(false); }} title={collapsed ? "Profile" : undefined}><span className="nav-icon" aria-hidden="true">◎</span><span className="nav-label">Profile</span></Link>
            <Link href={`/workspace/${role}/settings`} className={`nav-item ${active === "Settings" ? "active" : ""}`} onClick={() => { setActive("Settings"); setMobileOpen(false); }} title={collapsed ? "Settings" : undefined}><span className="nav-icon" aria-hidden="true">⚙</span><span className="nav-label">Settings</span></Link>
          </nav>
          <div className="sidebar-bottom">
            <span className="mini-avatar">{name.split(" ").map((s) => s[0]).join("")}</span>
            <span className="sidebar-user"><strong>{name}</strong><small>Verified campus account</small></span>
            <button type="button" className="signout-link" onClick={() => void signOut()} aria-label="Sign out" title="Sign out">⇥</button>
          </div>
          <button type="button" className="collapse-button" onClick={() => { setCollapsed((value) => !value); setMobileOpen(false); }} aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <span className="collapse-glyph" aria-hidden="true">{collapsed ? "»" : "«"}</span>
            <span>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
        </aside>
        <main className="main-content">
          <div className="breadcrumb"><span>EcoTwin</span><span>›</span><span>{role === "admin" ? "Administrator" : role === "worker" ? "Campus worker" : "Student"}</span><span>›</span><strong>{active}</strong></div>
          <div className="welcome-row">
            <div>
              <p className="eyebrow">CAMPUS OPERATIONS</p>
              <h1>{active === "Overview" ? `Good morning, ${name.split(" ")[0]}` : active}</h1>
              <p className="muted">{active === "Overview" ? "Your campus reports and operations, connected in one place." : `${visibleIssues.length} shared issue records · updates appear across role workspaces.`}</p>
            </div>
            <button className="button button-primary" onClick={() => setReportOpen(true)}><span>＋</span>{role === "student" ? "Report an issue" : role === "worker" ? "Open my tasks" : "Review issues"}</button>
          </div>
          
          {error && <div className="auth-notice" role="alert"><span className="notice-icon">!</span><span>{error}</span><button className="text-button" onClick={() => setError("")}>Dismiss</button></div>}
          {!error && !auditLogAvailable && <div className="auth-notice" role="status"><span className="notice-icon">i</span><span>Campus reports loaded, but activity history is unavailable. Run <code>supabase/audit-log.sql</code> to enable notifications and activity history.</span></div>}
          
          <section className="metric-grid" aria-label="Campus operations">
            <Metric label={role === "student" ? "Open reports" : "Open issues"} value={loading || error ? "—" : String(counts.open)} note="Needs triage" icon="▤"/>
            <Metric label="Assigned / in progress" value={loading || error ? "—" : String(counts.working)} note="Shared work queue" icon="◷"/>
            <Metric label="Resolved" value={loading || error ? "—" : String(counts.done)} note="Awaiting / passed verification" icon="✓"/>
            {role !== "student" && <Metric label="Sensor readings" value={loading ? "—" : String(readings.length)} note={readings.length ? "Device-submitted values" : "No live devices connected"} icon="ϟ"/>}
          </section>

          {active === "Campus Digital Twin" ? <TwinPreview issues={issues}/> : (
            <section className="content-grid">
              <article className="panel glass-panel issues-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">SHARED ISSUE REGISTER</p>
                    <h2>{role === "student" ? "My campus reports" : role === "worker" ? "Available reports & my tasks" : "Issues needing attention"}</h2>
                  </div>
                  <button className="text-button" onClick={() => void reload()}>Refresh ↻</button>
                </div>
                {loading ? <p className="muted">Loading campus records…</p> : error ? <div className="empty-state"><strong>Campus records unavailable</strong><p>Refresh after checking the Supabase database migrations and access policies.</p></div> : visibleIssues.length === 0 ? <div className="empty-state"><strong>{role === "worker" ? "No available reports or tasks yet" : role === "student" ? "No reports yet" : "No issues need attention"}</strong><p>{role === "worker" ? "New student reports will appear here automatically." : role === "student" ? "Reports you submit will appear in this list." : "Refresh to check for newly submitted campus reports."}</p></div> : (
                  <div className="issue-list">
                    {visibleIssues.map((issue) => (
                      <div className="issue-row" id={issue.id} key={issue.id}>
                        <span className={`issue-symbol ${issue.priority === "urgent" || issue.priority === "high" ? "coral" : issue.priority === "medium" ? "amber" : "blue"}`}>{issue.priority === "urgent" ? "!" : "◌"}</span>
                        <div className="issue-main">
                          <div className="issue-title-line">
                            <strong>{titleOf(issue)}</strong>
                            <span className={`status-pill ${issue.status === "open" ? "coral" : issue.status === "in_progress" ? "amber" : "blue"}`}>{statusLabel[issue.status]}</span>
                          </div>
                          <span className="issue-meta">{issue.id} · {issue.location} · {issue.category} · REPORTED{issue.assignee ? ` · ${issue.assignee}` : ""}</span>
                          <p className="issue-description">{issue.description}</p>
                          <div className="issue-actions">
                            {role === "admin" && (
                              <>
                                <select aria-label={`Assign ${issue.id}`} value={issue.assigneeId ?? ""} onChange={(e) => { const worker = workers.find((w) => w.userId === e.target.value); void updateIssue(issue.id, { assigneeId: worker?.userId ?? null, assignee: worker?.fullName ?? null, status: worker ? "assigned" : "open" }); }}>
                                  <option value="">Unassigned</option>
                                  {workers.map((worker) => <option key={worker.userId} value={worker.userId}>{worker.fullName} · {worker.campusId}</option>)}
                                </select>
                                <select aria-label={`Priority ${issue.id}`} value={issue.priority} onChange={(e) => void updateIssue(issue.id, { priority: e.target.value })}>
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                  <option value="urgent">Urgent</option>
                                </select>
                              </>
                            )}
                            {role === "worker" && issue.status !== "resolved" && issue.status !== "verified" && (
                              <button className="mini-action" onClick={() => void updateIssue(issue.id, { status: issue.status === "in_progress" ? "resolved" : "in_progress" })}>
                                {issue.status === "in_progress" ? "Mark resolved" : issue.status === "open" ? "Claim and start" : "Start task"}
                              </button>
                            )}
                            {role === "admin" && issue.status === "resolved" && (
                              <button className="mini-action" onClick={() => void updateIssue(issue.id, { status: "verified" })}>Verify completion</button>
                            )}
                            {role === "student" && (
                              <details>
                                <summary>View report details</summary>
                                <p>Reported by {issue.reporter}. Updated {new Date(issue.updatedAt).toLocaleString()}.</p>
                              </details>
                            )}
                          </div>
                        </div>
                        <span className="issue-chevron">›</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="panel-footer-note"><span className="tiny-info">i</span> Reports and status updates come from authorized campus records.</div>
              </article>
              <article className="panel glass-panel twin-card">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">CAMPUS AT A GLANCE</p>
                    <h2>Digital Twin</h2>
                  </div>
                  <Link className="expand-button" aria-label="Open campus view" href={`/workspace/${role}/twin`}>↗</Link>
                </div>
                <TwinPreview issues={issues}/>
                <Link className="button button-outline button-full" href={`/workspace/${role}/twin`}>Explore interactive campus <span>→</span></Link>
              </article>
            </section>
          )}

          {(role === "worker" || role === "admin") && (
            <>
              <div className="auth-notice" role="status">{sensorError || "Sensor recency is shown only when device readings are available."}</div>
              <section className="sensor-card-grid" aria-label="Campus sensor status">
                {sensors.map((sensor) => (
                  <article className="panel glass-panel sensor-status-card" key={sensor.id}>
                    <p className="eyebrow">{sensor.name}</p>
                    <strong>{sensor.status}</strong>
                    {sensor.latest ? <p>{sensor.latest.value} {sensor.latest.unit} · {sensor.latest.location}<br/><time>{new Date(sensor.latest.recordedAt).toLocaleString()}</time></p> : <p>No reading received. Values are unavailable.</p>}
                  </article>
                ))}
              </section>
            </>
          )}

          <button type="button" className="button button-primary impact-link" onClick={() => router.push(`/workspace/${role}/sustainability`)}>
            View sustainability →
          </button>

          <footer className="workspace-footer">
            <span>EcoTwin · campus operations</span>
            <span><a href="mailto:campus-support@example.edu">Support</a><i>·</i><Link href={`/workspace/${role}/profile`}>Profile</Link></span>
          </footer>
        </main>

        {assistantOpen ? <AssistantDock onClose={() => setAssistantOpen(false)} /> : <button type="button" className="assistant-reopen" onClick={() => setAssistantOpen(true)} aria-label="Open EcoTwin website help" title="Open EcoTwin Help">✳ <span>Ask EcoTwin Help</span></button>}
      </div>

      {reportOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !reportSubmitLock.current) { setReportOpen(false); resetReportWizard(); } }}>
          <form className="report-modal glass-panel" onSubmit={reportStep === "review" ? submitReport : (e) => { e.preventDefault(); void analyzeIssuePhoto(); }}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">CAMPUS CARE · STEP {reportStep === "photo" ? "1 OF 2" : "2 OF 2"}</p>
                <h2>Report an issue</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => { if (!reportSubmitLock.current) { setReportOpen(false); resetReportWizard(); } }} aria-label="Close report form" disabled={reportSubmitting}>×</button>
            </div>
            
            {reportSubmitNotice?.type === "error" && <p className="report-submit-error" role="alert">{reportSubmitNotice.message}</p>}
            
            {reportStep === "photo" ? (
              <>
                <p className="muted">Capture a clear photo of the problem or choose one from your device. EcoTwin AI will suggest what it detects; you will review the result before submitting.</p>
                <IssueCameraCapture onCapture={(file) => void selectIssuePhoto(file)}/>
                <label className="photo-upload-box photo-upload-secondary">
                  <span className="photo-upload-icon">＋</span>
                  <strong>{photoDataUrl ? "Choose a different photo" : "Choose a photo from your device"}</strong>
                  <span className="muted small">JPG, PNG or WebP · up to 10 MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => void selectIssuePhoto(e.target.files?.[0])}/>
                </label>
                {photoDataUrl && (
                  <div className="issue-photo-preview">
                    <Image unoptimized width={100} height={84} src={photoDataUrl} alt="Photo attached to issue report"/>
                    <div>
                      <strong>{photoName || "Issue photo"}</strong>
                      <p className="muted small">Photo resized for analysis and attached as report evidence.</p>
                      <button type="button" className="text-button" onClick={() => { setPhotoDataUrl(""); setPhotoName(""); setPhotoAnalysisMessage(""); }}>Remove photo</button>
                    </div>
                  </div>
                )}
                {photoAnalysisMessage && <p className="photo-analysis-note" role="status">{photoAnalysisMessage}</p>}
                <div className="modal-actions">
                  <button className="button button-outline" type="button" onClick={() => { setReportOpen(false); resetReportWizard(); }}>Cancel</button>
                  <button className="button button-primary" type="submit" disabled={!photoDataUrl || analyzingPhoto}>{analyzingPhoto ? "Analyzing photo…" : "Analyze photo →"}</button>
                </div>
              </>
            ) : (
              <>
                <div className="photo-review-banner">
                  <strong>{photoDetected ? "AI suggestion — please verify" : "Manual issue details"}</strong>
                  <p>{photoAnalysisMessage || "Review the suggested details and correct anything that is inaccurate."}</p>
                  {photoDataUrl && <button type="button" className="text-button photo-analysis-retry" onClick={() => void analyzeIssuePhoto()} disabled={analyzingPhoto}>{analyzingPhoto ? "Retrying photo analysis…" : "Try photo analysis again"}</button>}
                </div>
                {photoDataUrl && (
                  <div className="issue-photo-preview compact-preview">
                    <Image unoptimized width={68} height={60} src={photoDataUrl} alt="Uploaded issue evidence"/>
                    <div>
                      <strong>{photoName || "Issue photo"}</strong>
                      <button type="button" className="text-button" onClick={() => setReportStep("photo")}>Change photo</button>
                    </div>
                  </div>
                )}
                <label>Short title<input required minLength={5} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Water leak in Block A"/></label>
                <label>What happened? <span className="muted small">Correct the AI or describe it yourself.</span><textarea required minLength={10} maxLength={1000} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what you observed…"/></label>
                <div className="form-two">
                  <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{["Water", "Electrical", "Waste", "Grounds", "Safety", "Other"].map((x) => <option key={x}>{x}</option>)}</select></label>
                  <label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["low", "medium", "high", "urgent"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></label>
                </div>
                <IssueLocationPicker data={twinData} geometryUnavailable={geometryUnavailable} role={role} value={form.location} selection={form.locationSelection} onChange={(selection) => setForm((current) => ({ ...current, location: selection?.location ?? "", locationSelection: selection ? { buildingId: selection.buildingId, floorId: selection.floorId, roomId: selection.roomId } : null }))}/>
                <p className="muted small">The AI can be wrong. Check all details and manually correct them before submitting. Photo evidence will be attached to the report.</p>
                <div className="modal-actions">
                  <button className="button button-outline" type="button" onClick={() => setReportStep("photo")}>← Back</button>
                  <button className="button button-primary" type="submit" disabled={reportSubmitting}>{reportSubmitting ? "Submitting report…" : "Submit report"}</button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
      
      {reportSubmitNotice?.type === "success" && (
        <div className="report-success-toast" role="status" aria-live="polite">
          <span className="report-success-mark" aria-hidden="true">✓</span>
          <span>{reportSubmitNotice.message}</span>
          <button type="button" aria-label="Dismiss confirmation" onClick={() => setReportSubmitNotice(null)}>×</button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: string }) { 
  return (
    <article className="metric-card glass-panel">
      <div className="metric-top"><span>{label}</span><span className="metric-icon">{icon}</span></div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-caption">{note}</span>
    </article>
  ); 
}

function TwinPreview({ issues }: { issues: CampusIssue[] }) { 
  return (
    <div className="twin-art twin-live" aria-label="Interactive campus issue map">
      <div className="twin-block block-one"><span>ACADEMIC A</span><i/><i/><i/><i/></div>
      <div className="twin-block block-two"><span>LIBRARY</span><i/><i/><i/></div>
      <div className="twin-block block-three"><span>RESIDENCE</span><i/><i/><i/><i/></div>
      <span className="twin-tree tree-left"/><span className="twin-tree tree-mid"/><span className="map-path"/>
      {issues.slice(0, 8).map((issue, i) => (
        <button 
          key={issue.id} 
          title={`${issue.title} · ${statusLabel[issue.status]}`} 
          className={`map-marker twin-marker ${issue.status === "verified" ? "marker-ok" : "marker-alert"}`} 
          style={{ left: `${22 + (i * 23) % 66}%`, top: `${22 + (i * 29) % 55}%` }}
        >
          {issue.status === "verified" ? "✓" : "!"}
        </button>
      ))}
    </div>
  ); 
}
