"use client";

import { AppShell } from "@/components/layout/AppShell";
import ManagementClient from "@/components/admin/ManagementClient";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import ScenarioCalculator from "@/components/sustainability/ScenarioCalculator";
import SensorFeed from "@/components/sensors/SensorFeed";
import TwinScene from "@/components/twin/TwinScene";
import { DEMO_SENSOR_READINGS, DEMO_SUSTAINABILITY_RESULT, DEMO_WORKERS, getDemoWorkspaceData, SAMPLE_TWIN_DATA, type DemoRole } from "@/lib/demo-data";
import { useState, type FormEvent } from "react";

const names: Record<DemoRole, string> = { student: "Student", worker: "Campus worker", admin: "Administrator" };
const paths: Record<string, { label: string; title: string }> = {
  sustainability: { label: "Sustainability", title: "Campus resource dashboard" },
  twin: { label: "Campus Digital Twin", title: "Campus Digital Twin" },
  sensors: { label: "Sensor Feed", title: "Sensor Feed" },
  notifications: { label: "Notifications", title: "Notifications" },
  assistant: { label: "EcoTwin Help", title: "EcoTwin Help" },
  profile: { label: "Profile", title: "Profile" },
  settings: { label: "Settings", title: "Settings" },
  "manage/team": { label: "Workers", title: "Campus workers" },
  "manage/activity": { label: "Activity History", title: "Activity history" },
  "manage/verifications": { label: "User Verification", title: "User verification" },
};

export default function DemoWorkspace({ role, section }: { role: DemoRole; section: string[] }) {
  const data = getDemoWorkspaceData(role);
  const path = section.join("/");
  const destination = paths[path];
  const content = destination ? <DemoRouteContent role={role} path={path} data={data} /> : undefined;
  const routeKey = `${role}/${path || "overview"}`;

  return <AppShell
    key={routeKey}
    role={role}
    identity={data.identity}
    twinData={SAMPLE_TWIN_DATA}
    geometryUnavailable={false}
    demo
    demoData={data}
    demoContent={content}
    demoActiveLabel={destination?.label ?? "Overview"}
  />;
}

function DemoRouteContent({ role, path, data }: { role: DemoRole; path: string; data: ReturnType<typeof getDemoWorkspaceData> }) {
  if (path === "sustainability") return <ScenarioCalculator role={role} demo demoResult={DEMO_SUSTAINABILITY_RESULT} embedded />;
  if (path === "twin") return <TwinScene issues={data.issues} role={role} data={SAMPLE_TWIN_DATA} geometryUnavailable={false} demo backHref={`/demo/${role}`} />;
  if (path === "sensors") return <SensorFeed role={role as "worker" | "admin"} readings={DEMO_SENSOR_READINGS} demo backHref={`/demo/${role}`} />;
  if (path === "notifications") return <NotificationCenter role={role} issues={data.issues} auditLog={data.auditLog} readScope={`demo-${role}`} demo />;
  if (path === "manage/team" || path === "manage/activity" || path === "manage/verifications") {
    const verificationRequests = [
      { userId: "SAMPLE-PROFILE-101", fullName: "Taylor Example", phone: "+1 (202) 555-0101", campusId: "DEMO-S101", submittedAt: "2026-10-22T09:00:00.000Z" },
      { userId: "SAMPLE-PROFILE-102", fullName: "Jordan Fiction", phone: "+1 (202) 555-0102", campusId: "DEMO-W102", submittedAt: "2026-10-21T09:00:00.000Z" },
    ];
    return <ManagementClient role={role} section={path.split("/")[1]} issues={data.issues} auditLog={data.auditLog} verificationRequests={verificationRequests} verificationError="" workers={DEMO_WORKERS} demo />;
  }
  if (path === "profile") return <DemoProfile role={role} identity={data.identity} />;
  if (path === "settings") return <DemoSettings />;
  if (path === "assistant") return <DemoAssistant />;
  return <section className="panel glass-panel demo-overview-note"><p className="eyebrow">DEMO PREVIEW</p><h2>{names[role]} workspace</h2><p>This route is available inside the sample dashboard only.</p></section>;
}

function DemoProfile({ role, identity }: { role: DemoRole; identity: { name: string; email: string } }) {
  return <section className="account-page demo-account-page"><header className="account-page-header"><span className="eyebrow">DEMO · SAMPLE PROFILE</span><h1>My profile</h1><p className="muted">Fictional visitor details for the {names[role].toLowerCase()} workspace.</p></header><section className="account-card"><div className="profile-hero"><span className="profile-avatar-large">{identity.name.split(" ").map((part) => part[0]).join("")}</span><div><h2>{identity.name}</h2><p className="muted">{names[role]} · demo view</p><span className="account-status">DEMO ACCOUNT</span></div></div><div className="account-detail-grid"><div><span className="account-detail-label">Email</span><strong>{identity.email}</strong></div><div><span className="account-detail-label">Campus ID</span><strong>DEMO-{role.toUpperCase()}</strong></div><div><span className="account-detail-label">Access</span><strong>Sample preview only</strong></div><div><span className="account-detail-label">Data source</span><strong>Fictional sample data</strong></div></div><p className="account-note">This profile does not represent a real campus account and carries no campus permissions.</p></section></section>;
}

function DemoSettings() {
  return <section className="panel glass-panel demo-readonly-page"><p className="eyebrow">DEMO · PREFERENCES</p><h2>Settings preview</h2><p>Personal settings are disabled in the visitor demo. You can still switch the dashboard theme with the header control.</p></section>;
}

function DemoAssistant() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: "Welcome to the EcoTwin Help preview. Ask about sample sustainability metrics, issue reporting, or the Digital Twin." }]);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt) return;
    const lower = prompt.toLowerCase();
    const answer = lower.includes("water") || lower.includes("electric") || lower.includes("sustain")
      ? "The sustainability view combines sample electricity, water, and waste measures. Demo values are fictional and are not live sensor readings."
      : lower.includes("issue") || lower.includes("report")
        ? "The issue form creates a local preview in this demo session only; it does not contact campus staff or save a database record."
        : lower.includes("twin") || lower.includes("building")
          ? "The Digital Twin uses illustrative sample campus geometry. Explore buildings, floors, and rooms from the Twin page."
          : "This offline help preview covers the sample dashboard, resource data, issue workflow, and campus model. No AI service is contacted.";
    setMessages((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: answer }]);
    setQuestion("");
  }
  return <section className="panel glass-panel demo-assistant"><p className="eyebrow">DEMO · OFFLINE HELP</p><h2>EcoTwin Help</h2><p>Sample answers run locally in this page. Gemini and the assistant API are not called from demo mode.</p><div className="demo-assistant-messages" aria-live="polite">{messages.map((message, index) => <p className={`demo-assistant-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</p>)}</div><form onSubmit={send}><label htmlFor="demo-help-question">Ask about the preview</label><div><input id="demo-help-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Try: How is water use shown?"/><button className="button button-primary" type="submit">Ask</button></div></form></section>;
}
