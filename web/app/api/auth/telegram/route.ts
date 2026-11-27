import { NextRequest, NextResponse } from "next/server";
import { buildVerifiedSessionPayload, attachSessionCookie } from "@/lib/authSession";

export async function POST(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  try {
    const body = await request.json();

    // 1. Init action: create auth session
    if (body.action === "init") {
      const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/telegram/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await backendRes.json();
      if (!backendRes.ok) {
        return NextResponse.json(
          { detail: data.detail || "Telegram avtorizatsiya sessiyasini yaratishda xatolik" },
          { status: backendRes.status }
        );
      }
      return NextResponse.json({
        ok: true,
        code: data.code,
        bot_username: data.bot_username,
        bot_url: data.bot_url,
      });
    }

    // 2. Poll action: check if bot verified the code
    if (body.action === "poll" && body.code) {
      const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/telegram/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: body.code }),
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
        const { payload, defaultRedirect } = await buildVerifiedSessionPayload({
          backendUrl,
          backendToken: data.access_token,
          userId: data.user_id,
          telegramUserId: data.telegram_user_id,
          email: data.email,
          fullName: data.full_name,
          username: data.username,
        });

        const response = NextResponse.json({
          ok: true,
          verified: true,
          redirect: defaultRedirect,
          user: {
            userId: payload.userId,
            telegramUserId: payload.telegramUserId,
            email: payload.email,
            fullName: payload.fullName,
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
      }
      return NextResponse.json({ ok: true, verified: false, status: "pending" });
    }

    // Direct username login without bot verification is strictly rejected
    return NextResponse.json(
      { detail: "Xavfsizlik yuzasidan Telegram orqali kirish bot tasdig'i orqali amalga oshirilishi shart." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { detail: "Server bilan bog'lanishda xatolik: " + err.message },
      { status: 500 }
    );
  }
}
