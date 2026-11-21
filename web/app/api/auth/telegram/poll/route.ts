import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SessionPayload, sessionCookieName, sessionTtlSeconds } from "@/lib/session";

export async function POST(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  let code = "";
  try {
    const body = await request.json();
    if (typeof body.code === "string") {
      code = body.code.trim();
    }
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ detail: "Sessiya kodi ko'rsatilmagan" }, { status: 400 });
  }

  try {
    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/telegram/poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.json(
        { detail: data.detail || "Tasdiqlashda xatolik yuz berdi" },
        { status: backendRes.status }
      );
    }

    if (data.status === "pending") {
      return NextResponse.json({ ok: true, verified: false, status: "pending" });
    }

    if (data.status === "verified" && data.access_token) {
      const sessionPayload: SessionPayload = {
        userId: data.user_id,
        telegramUserId: data.telegram_user_id,
        email: data.email,
        fullName: data.full_name,
        username: data.username,
        role: "owner",
        isPlatformOwner: false,
        backendToken: data.access_token,
        issuedAt: Math.floor(Date.now() / 1000),
      };

      const response = NextResponse.json({
        ok: true,
        verified: true,
        redirect: "/dashboard",
        user: {
          userId: sessionPayload.userId,
          telegramUserId: sessionPayload.telegramUserId,
          email: sessionPayload.email,
          fullName: sessionPayload.fullName,
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
    }

    return NextResponse.json({ ok: true, verified: false, status: "pending" });
  } catch (err: any) {
    return NextResponse.json(
      { detail: "Server bilan bog'lanishda xatolik: " + err.message },
      { status: 500 }
    );
  }
}
