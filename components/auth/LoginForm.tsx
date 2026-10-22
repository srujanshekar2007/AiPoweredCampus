"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export default function LoginForm({ authError = "" }: { authError?: string }) {
  const router = useRouter();
  const configured = hasSupabaseConfig(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [notice, setNotice] = useState(authError); const [busy, setBusy] = useState(false);
  const signIn = async (provider: "google" | "password") => {
    setNotice("");
    if (!configured) { setNotice("To enable real sign-in, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then configure a Google provider or campus email accounts in Supabase."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      if (provider === "google") {
        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } } });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/verify");
        router.refresh();
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sign-in failed. Check your account settings and try again."); setBusy(false); }
  };
  return <>
    <div className={`auth-notice ${configured ? "auth-ready" : ""}`} role="status"><span className="notice-icon">i</span><span>{configured ? "Sign-in uses the campus Supabase identity provider. New accounts require profile verification before workspace access." : "Campus sign-in is unavailable. Add Supabase project values and configure Google OAuth or campus email accounts."}</span></div>
    {notice && <div className="auth-notice" role="alert"><span className="notice-icon">!</span><span>{notice}</span></div>}
    <div className="login-explore-entry">
      <Link className="button button-primary button-full" href="/demo/student">Explore Demo <span aria-hidden="true">→</span></Link>
      <p>Explore the campus sustainability dashboard without creating an account.</p>
    </div>
    <button className="button button-outline button-full" type="button" disabled={busy} onClick={() => void signIn("google")}><span className="google-g">G</span> Continue with Google</button>
    <div className="divider"><span>or use your college email</span></div>
    <form className="login-form" onSubmit={(event) => { event.preventDefault(); void signIn("password"); }}>
      <label htmlFor="email">College email</label><input id="email" type="email" placeholder="you@college.edu" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}/>
      <label htmlFor="password">Password</label><input id="password" type="password" placeholder="Enter your password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}/>
      <div className="form-links"><span className="muted small">Campus accounts only</span><span className="muted small">Contact your administrator for reset</span></div>
      <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </>;
}
