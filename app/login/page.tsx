import LoginForm from "@/components/auth/LoginForm";
import Link from "next/link";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const authError = error === "workspace_access_denied" ? "Your account does not have access to that workspace." : error === "auth_not_configured" ? "Campus sign-in is unavailable. Configure the Supabase project before signing in." : error === "profile_unavailable" ? "Campus verification could not be checked. Apply the onboarding database migration and try again." : error === "authentication_failed" ? "Campus sign-in could not be completed. Check the Google OAuth settings and try again." : "";
  return (
    <main className="login-layout">
      <section className="login-story" aria-labelledby="welcome-title">
        <Link href="/login" className="brand-lockup" aria-label="EcoTwin home">
          <span className="brand-mark">E</span><span>EcoTwin</span>
        </Link>
        <div className="story-copy">
          <p className="eyebrow">A CAMPUS THAT THINKS AHEAD</p>
          <h1 id="welcome-title">Small actions.<br /><em>Lasting impact.</em></h1>
          <p className="story-description">A shared place to care for the spaces, resources, and people that make campus feel like home.</p>
          <div className="campus-illustration" aria-label="Illustration of an energy-aware campus" role="img">
            <span className="sun-disc" />
            <span className="tree tree-one" /><span className="tree tree-two" />
            <div className="building building-a"><i /><i /><i /><i /></div>
            <div className="building building-b"><i /><i /><i /></div>
            <div className="building building-c"><i /><i /><i /><i /><i /></div>
            <span className="path-line" />
          </div>
          <div className="story-proof"><span className="proof-dot" /> <span>See what needs attention. Help make it better.</span></div>
        </div>
        <div className="story-footer">Built for the campus community <span>·</span> VibeCoders</div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <div className="mobile-brand brand-lockup"><span className="brand-mark">E</span><span>EcoTwin</span></div>
          <p className="eyebrow">YOUR CAMPUS, CONNECTED</p>
          <h2 id="login-title">Welcome back</h2>
          <p className="muted">Sign in with your college account to continue.</p>
          <LoginForm authError={authError} />
          <p className="help-line">Need help? <a href="mailto:campus-support@example.edu">Contact campus support</a></p>
        </div>
      </section>
    </main>
  );
}
