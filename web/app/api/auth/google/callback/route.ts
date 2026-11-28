import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildInternalGoogleAuthSignature, buildVerifiedSessionPayload, attachSessionCookie } from "@/lib/authSession";
import { sessionCookieName, verifySession } from "@/lib/session";

function getBaseUrl(request: NextRequest): string {
  const configured = (process.env.PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) {
    return configured;
  }
  const host = request.headers.get("host") || "selloi.uz";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return `http://${host}`;
  }
  return `https://${host}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const returnedState = searchParams.get("state") || "";
  const expectedState = request.cookies.get("selloi_oauth_state")?.value || "";
  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=google_cancelled", baseUrl));
  }

  const stateValid =
    expectedState.length > 0 &&
    returnedState.length === expectedState.length &&
    timingSafeEqual(Buffer.from(expectedState), Buffer.from(returnedState));
  if (!stateValid) {
    const resp = NextResponse.redirect(new URL("/login?error=google_state_invalid", baseUrl));
    resp.cookies.delete("selloi_oauth_state");
    resp.cookies.delete("selloi_google_link");
    return resp;
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

    const linkCookie = request.cookies.get("selloi_google_link")?.value;
    const rawSessionCookie = request.cookies.get(sessionCookieName)?.value;
    const existingSession = verifySession(rawSessionCookie, secret);
    const linkUserId = linkCookie === "1" && existingSession ? existingSession.userId : undefined;

    const internalSig = buildInternalGoogleAuthSignature(email, googleId, linkUserId);
    const backendHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (internalSig) {
      backendHeaders["X-Internal-Google-Auth"] = internalSig;
    }

    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/google`, {
      method: "POST",
      headers: backendHeaders,
      body: JSON.stringify({
        email,
        full_name: fullName,
        google_id: googleId,
        avatar_url: profile.picture || null,
        link_user_id: linkUserId ?? null,
      }),
    });

    const data = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      const errCode = backendRes.status === 409 ? "google_already_bound_other_tg" : "google_register_failed";
      const errPath = linkUserId ? `/login?step=complete&error=${errCode}` : `/login?error=${errCode}`;
      const errResp = NextResponse.redirect(new URL(errPath, baseUrl));
      errResp.cookies.delete("selloi_google_link");
      return errResp;
    }

    const { payload, defaultRedirect } = await buildVerifiedSessionPayload({
      backendUrl,
      backendToken: data.access_token,
      userId: data.user_id,
      telegramUserId: data.telegram_user_id,
      email: data.email,
      fullName: data.full_name || fullName,
    });

    const redirectTarget = new URL(defaultRedirect, baseUrl);
    const response = NextResponse.redirect(redirectTarget);
    attachSessionCookie(response, payload, secret);
    response.cookies.delete("selloi_google_link");
    response.cookies.delete("selloi_oauth_state");
    return response;
  } catch (err) {
    return NextResponse.redirect(new URL("/login?error=google_error", baseUrl));
  }
}
