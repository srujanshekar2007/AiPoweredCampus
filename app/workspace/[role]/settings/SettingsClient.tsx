"use client";
import { useState } from "react";
import Link from "next/link";

export default function SettingsClient({ role }: { role: "student" | "worker" | "admin" }) {
  const [theme, setTheme] = useState("light");
  const [notifications, setNotifications] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);
  const [saved, setSaved] = useState(false);
  function save() {
    localStorage.setItem("ecotwin-theme", theme);
    localStorage.setItem("ecotwin-notifications", notifications ? "on" : "off");
    localStorage.setItem("ecotwin-weekly-summary", weeklySummary ? "on" : "off");
    setSaved(true);
  }
  return <section className="account-card settings-card"><div className="settings-section"><div><h2>Appearance</h2><p className="muted">Choose the look used by your workspace.</p></div><label className="setting-control"><span>Theme</span><select value={theme} onChange={(event) => { setTheme(event.target.value); setSaved(false); }}><option value="light">Light</option><option value="dark">Dark</option></select></label></div><div className="settings-section"><div><h2>Notifications</h2><p className="muted">Choose which notification preferences to save on this device.</p></div><div className="setting-toggles"><label className="setting-toggle"><span><strong>In-app notifications</strong><small>Show updates about issues and tasks.</small></span><input type="checkbox" checked={notifications} onChange={(event) => { setNotifications(event.target.checked); setSaved(false); }}/></label><label className="setting-toggle"><span><strong>Weekly sustainability summary</strong><small>Save your preference for a weekly summary feature.</small></span><input type="checkbox" checked={weeklySummary} onChange={(event) => { setWeeklySummary(event.target.checked); setSaved(false); }}/></label></div></div><div className="settings-section"><div><h2>Privacy and AI</h2><p className="muted">Review AI suggestions before acting on them. Avoid uploading personal or sensitive information in issue photos.</p></div><Link className="text-button" href={`/workspace/${role}/assistant`}>Open AI assistant →</Link></div><div className="account-actions"><button className="button button-primary" type="button" onClick={save}>Save preferences</button><Link className="button button-outline" href={`/workspace/${role}`}>Return to workspace</Link></div>{saved && <p className="settings-saved" role="status">Preferences saved on this device. Reopen your workspace to apply the theme.</p>}<p className="account-note">These preferences are stored in this browser only. Notification delivery and weekly email summaries are not sent by EcoTwin.</p></section>;
}
