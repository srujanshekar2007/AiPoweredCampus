import Link from "next/link";
import { notFound } from "next/navigation";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role !== "student" && role !== "worker" && role !== "admin") notFound();
  return <main className="account-page"><header className="account-page-header"><Link href={`/workspace/${role}`} className="account-back">← Back to workspace</Link><span className="eyebrow">PREFERENCES</span><h1>Settings</h1><p className="muted">Personalize your EcoTwin experience.</p></header><SettingsClient role={role}/></main>;
}
