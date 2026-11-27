import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, buildVerifiedSessionPayload } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  let body: { email?: string; code?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Noto'g'ri so'rov formati" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ detail: "To'g'ri email manzil kiriting" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ detail: "Tasdiqlash kodi 6 xonali raqam bo'lishi kerak" }, { status: 400 });
  }

  try {
    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const { payload, defaultRedirect } = await buildVerifiedSessionPayload({
      backendUrl,
      backendToken: data.access_token,
      userId: data.user_id,
      email: data.email || email,
      fullName: data.full_name,
      telegramUserId: data.telegram_user_id,
    });

    const response = NextResponse.json({
      ok: true,
      redirect: defaultRedirect,
      detail: data.detail,
      user: {
        userId: payload.userId,
        telegramUserId: payload.telegramUserId,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
        organizationId: payload.organizationId,
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
      { detail: err?.message || "Server bilan bog'lanishda xatolik" },
      { status: 500 }
    );
  }
}
