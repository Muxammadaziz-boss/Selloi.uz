import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SessionPayload, sessionCookieName, sessionTtlSeconds } from "@/lib/session";

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "selloi.uz";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }
  return `https://${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=google_cancelled", baseUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", baseUrl));
  }
  if (!secret) {
    return NextResponse.redirect(new URL("/login?error=session_secret_missing", baseUrl));
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.redirect(new URL("/login?error=google_token_failed", baseUrl));
    }

    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(new URL("/login?error=google_user_failed", baseUrl));
    }

    const profile = await userInfoRes.json();
    const email = profile.email ? profile.email.toLowerCase() : "";
    const fullName = profile.name || profile.given_name || email.split("@")[0] || "Google Foydalanuvchisi";
    const googleId = profile.sub || "";

    if (!email) {
      return NextResponse.redirect(new URL("/login?error=google_no_email", baseUrl));
    }

    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName,
        google_id: googleId,
        avatar_url: profile.picture || null,
      }),
    });

    const data = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.redirect(new URL("/login?error=google_register_failed", baseUrl));
    }

    const sessionPayload: SessionPayload = {
      userId: data.user_id,
      email: data.email,
      role: "owner",
      isPlatformOwner: false,
      backendToken: data.access_token,
      issuedAt: Math.floor(Date.now() / 1000),
    };

    const redirectTarget = new URL("/dashboard", baseUrl);
    const response = NextResponse.redirect(redirectTarget);

    response.cookies.set(sessionCookieName, createSessionToken(sessionPayload, secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionTtlSeconds,
    });

    return response;
  } catch (err) {
    return NextResponse.redirect(new URL("/login?error=google_error", baseUrl));
  }
}
