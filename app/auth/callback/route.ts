
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedIdentity } from "@/lib/authz";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!code || !projectUrl || !anonKey) {
    return NextResponse.redirect(
      new URL("/login?error=auth_not_configured", url.origin)
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(projectUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        items.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[Auth callback] Code exchange failed:", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });

    return NextResponse.redirect(
      new URL("/login?error=authentication_failed", url.origin)
    );
  }

  try {
    const identity = await getAuthenticatedIdentity();

    if (identity) {
      return NextResponse.redirect(
        new URL(`/workspace/${identity.role}`, url.origin)
      );
    }

    return NextResponse.redirect(new URL("/verify", url.origin));
  } catch (error) {
    console.error("[Auth callback] Identity lookup failed:", error);

    return NextResponse.redirect(
      new URL("/login?error=profile_unavailable", url.origin)
    );
  }
}
