import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SessionPayload, sessionCookieName, sessionTtlSeconds } from "@/lib/session";

export async function POST(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  let username = "";
  let telegramId: number | undefined = undefined;
  let fullName = "";

  try {
    const body = await request.json();
    if (typeof body.username === "string") {
      username = body.username.trim();
    }
    if (typeof body.telegram_id === "number" && body.telegram_id > 0) {
      telegramId = body.telegram_id;
    } else if (typeof body.telegram_id === "string") {
      const parsed = Number(body.telegram_id);
      if (Number.isFinite(parsed) && parsed > 0) {
        telegramId = parsed;
      }
    }
    if (typeof body.full_name === "string") {
      fullName = body.full_name.trim();
    }
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }

  if (!username && !telegramId) {
    return NextResponse.json({ detail: "Telegram username yoki ID raqamini kiriting" }, { status: 400 });
  }

  try {
    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        telegram_id: telegramId,
        full_name: fullName,
      }),
    });

    const data = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.json(
        { detail: data.detail || "Telegram orqali kirishda xatolik yuz berdi" },
        { status: backendRes.status }
      );
    }

    const sessionPayload: SessionPayload = {
      userId: data.user_id,
      telegramUserId: telegramId,
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
