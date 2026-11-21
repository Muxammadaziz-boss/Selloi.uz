import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SessionPayload, sessionCookieName, sessionTtlSeconds } from "@/lib/session";

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "selloi.uz";
  const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", baseUrl));
  }

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("access_type", "online");
  googleAuthUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(googleAuthUrl.toString());
}

export async function POST(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const expectedAudience = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  let credential = "";
  try {
    const body = await request.json();
    credential = typeof body.credential === "string" ? body.credential.trim() : "";
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }

  if (!credential) {
    return NextResponse.json({ detail: "Google token topilmadi" }, { status: 400 });
  }

  try {
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!tokenInfoRes.ok) {
      return NextResponse.json({ detail: "Google tokenini tasdiqlab bo'lmadi" }, { status: 401 });
    }

    const payload = await tokenInfoRes.json();
    if (expectedAudience && payload.aud !== expectedAudience) {
      return NextResponse.json({ detail: "Google client ID mos kelmadi" }, { status: 401 });
    }

    const email = payload.email ? payload.email.toLowerCase() : "";
    const fullName = payload.name || payload.given_name || email.split("@")[0] || "Google Foydalanuvchisi";
    const googleId = payload.sub || "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ detail: "Google hisobida email topilmadi" }, { status: 400 });
    }

    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName,
        google_id: googleId,
        avatar_url: payload.picture || null,
      }),
    });

    const data = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.json(
        { detail: data.detail || "Google orqali kirishda xatolik yuz berdi" },
        { status: backendRes.status }
      );
    }

    const sessionPayload: SessionPayload = {
      userId: data.user_id,
      email: data.email,
      role: "owner",
      isPlatformOwner: false,
      backendToken: data.access_token,
      issuedAt: Math.floor(Date.now() / 1000),
    };

    const response = NextResponse.json({
      ok: true,
      redirect: "/dashboard",
      user: {
        userId: sessionPayload.userId,
        email: sessionPayload.email,
        role: sessionPayload.role,
      },
    });

    response.cookies.set(sessionCookieName, createSessionToken(sessionPayload, secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionTtlSeconds,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { detail: "Server bilan bog'lanishda xatolik: " + err.message },
      { status: 500 }
    );
  }
}
