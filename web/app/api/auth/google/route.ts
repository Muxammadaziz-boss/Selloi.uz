import { NextRequest, NextResponse } from "next/server";
import { buildInternalGoogleAuthSignature, buildVerifiedSessionPayload, attachSessionCookie } from "@/lib/authSession";

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "selloi.uz";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }
  return `https://${host}`;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const baseUrl = getBaseUrl(request);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const linkMode = request.nextUrl.searchParams.get("mode") === "link";

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

  const res = NextResponse.redirect(googleAuthUrl.toString());
  if (linkMode) {
    res.cookies.set("selloi_google_link", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
  } else {
    res.cookies.delete("selloi_google_link");
  }
  return res;
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

    const internalSig = buildInternalGoogleAuthSignature(email, googleId);
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

    const { payload: sessionPayload, defaultRedirect } = await buildVerifiedSessionPayload({
      backendUrl,
      backendToken: data.access_token,
      userId: data.user_id,
      telegramUserId: data.telegram_user_id,
      email: data.email,
      fullName: data.full_name || fullName,
    });

    const response = NextResponse.json({
      ok: true,
      redirect: defaultRedirect,
      user: {
        userId: sessionPayload.userId,
        email: sessionPayload.email,
        role: sessionPayload.role,
        emailVerified: Boolean(sessionPayload.emailVerified),
        hasRealEmail: Boolean(sessionPayload.hasRealEmail),
        fullyVerified: Boolean(sessionPayload.fullyVerified),
        missingSteps: sessionPayload.missingSteps || [],
        isPlatformOwner: Boolean(sessionPayload.isPlatformOwner),
        isPlatformAdmin: Boolean(sessionPayload.isPlatformAdmin),
      },
    });

    attachSessionCookie(response, sessionPayload, secret);
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { detail: "Server bilan bog'lanishda xatolik: " + err.message },
      { status: 500 }
    );
  }
}
