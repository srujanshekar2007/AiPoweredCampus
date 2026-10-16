"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FormErrors = { fullName?: string[]; phone?: string[]; campusId?: string[] };

export default function VerificationForm() {
  const router = useRouter();
  const [values, setValues] = useState({ fullName: "", phone: "", campusId: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setErrors({});
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const text = await response.text();
      let data: { error?: string; details?: { fieldErrors?: FormErrors }; status?: string };
      try { data = JSON.parse(text); } catch { throw new Error(text.trim() ? `Profile request returned an unreadable response (HTTP ${response.status}).` : `Profile request returned an empty response (HTTP ${response.status}).`); }
      if (!response.ok) { setErrors(data.details?.fieldErrors ?? {}); throw new Error(data.error ?? `Profile submission failed (HTTP ${response.status}).`); }
      setMessage("Your information was submitted for campus review. Workspace access will be available after an authorized administrator verifies your identity and assigns a role.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Profile submission failed. Please try again."); }
    finally { setBusy(false); }
  }

  return <form className="verification-form" onSubmit={submit} noValidate>
    <label>Full name<input autoComplete="name" required minLength={2} maxLength={120} value={values.fullName} onChange={(event) => setValues({ ...values, fullName: event.target.value })} aria-invalid={Boolean(errors.fullName?.length)} />{errors.fullName?.map((error) => <small className="field-error" key={error}>{error}</small>)}</label>
    <label>Phone number<input type="tel" autoComplete="tel" inputMode="tel" placeholder="+919876543210" required value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} aria-invalid={Boolean(errors.phone?.length)} /><small>Include the country code, for example +91…</small>{errors.phone?.map((error) => <small className="field-error" key={error}>{error}</small>)}</label>
    <label>College ID / Student or Employee ID<input autoComplete="off" required minLength={3} maxLength={80} value={values.campusId} onChange={(event) => setValues({ ...values, campusId: event.target.value })} aria-invalid={Boolean(errors.campusId?.length)} />{errors.campusId?.map((error) => <small className="field-error" key={error}>{error}</small>)}</label>
    <p className="muted small">Submitting these details does not verify your identity. A campus administrator must compare your ID with authorized college records and assign your role.</p>
    <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit for verification"}</button>
    {message && <p className="auth-notice" role="status">{message}</p>}
  </form>;
}
