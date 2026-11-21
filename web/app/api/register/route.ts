import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SessionPayload, sessionCookieName, sessionTtlSeconds } from "@/lib/session";

export async function POST(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  let email = "";
  let password = "";
  let fullName = "";

  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
    fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
  } catch {
    return NextResponse.json({ detail: "Ma'lumotlar formati noto'g'ri" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ detail: "Yaroqli email manzilini kiriting" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ detail: "Parol kamida 6 belgidan iborat bo'lishi kerak" }, { status: 400 });
  }

  try {
    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName || email.split("@")[0],
      }),
    });

    const data = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.json(
        { detail: data.detail || "Ro'yxatdan o'tishda xatolik yuz berdi" },
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
