import { NextRequest, NextResponse } from "next/server";
import { buildVerifiedSessionPayload, attachSessionCookie } from "@/lib/authSession";

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

    if (data.verification_required || !data.access_token) {
      return NextResponse.json({
        ok: true,
        verification_required: true,
        email: data.email || email,
        detail: data.detail || "Email manzilingizga 6 xonali tasdiqlash kodi yuborildi.",
      });
    }

    const { payload, defaultRedirect } = await buildVerifiedSessionPayload({
      backendUrl,
      backendToken: data.access_token,
      userId: data.user_id,
      email: data.email,
      fullName: fullName || data.full_name,
      telegramUserId: data.telegram_user_id,
    });

    const response = NextResponse.json({
      ok: true,
      redirect: defaultRedirect,
      user: {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        emailVerified: Boolean(payload.emailVerified),
        hasRealEmail: Boolean(payload.hasRealEmail),
        fullyVerified: Boolean(payload.fullyVerified),
        missingSteps: payload.missingSteps || [],
        isPlatformOwner: Boolean(payload.isPlatformOwner),
        isPlatformAdmin: Boolean(payload.isPlatformAdmin),
      },
    });

    attachSessionCookie(response, payload, secret);
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { detail: "Server bilan bog'lanishda xatolik: " + err.message },
      { status: 500 }
    );
  }
}
