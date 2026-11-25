import { NextRequest, NextResponse } from "next/server";
import { buildVerifiedSessionPayload, attachSessionCookie } from "@/lib/authSession";

const loginAttempts = new Map<string, number[]>();

function checkRateLimit(
  key: string,
  maxAttempts = process.env.NODE_ENV === "production" ? 10 : 100,
  windowMs = 60000
): boolean {
  const now = Date.now();
  const attempts = (loginAttempts.get(key) || []).filter((t) => now - t < windowMs);
  if (attempts.length >= maxAttempts) return false;
  attempts.push(now);
  loginAttempts.set(key, attempts);
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "anonymous";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { detail: "Juda ko'p urinishlar qilindi. 1 daqiqadan so'ng qayta urinib ko'ring." },
      { status: 429 }
    );
  }

  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  let supplied = "";
  let email = "";
  let orgId: number | undefined = undefined;

  try {
    const body = await request.json();
    supplied = typeof body.password === "string" ? body.password : "";
    if (typeof body.email === "string" && body.email.includes("@")) {
      email = body.email.trim().toLowerCase();
    }
    if (typeof body.organization_id === "number" && body.organization_id > 0) {
      orgId = body.organization_id;
    }
  } catch {
    return NextResponse.json({ detail: "Login ma'lumoti noto'g'ri" }, { status: 400 });
  }

  if (!email || !supplied) {
    return NextResponse.json({ detail: "Email va parolni kiriting" }, { status: 400 });
  }

  try {
    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: supplied }),
    });

    if (!backendRes.ok) {
      return NextResponse.json({ detail: "Email yoki parol noto'g'ri" }, { status: 401 });
    }

    const data = await backendRes.json();
    const { payload, defaultRedirect } = await buildVerifiedSessionPayload({
      backendUrl,
      backendToken: data.access_token,
      userId: data.user_id,
      email: data.email || email,
      fullName: data.full_name,
      organizationId: orgId,
    });

    const response = NextResponse.json({
      ok: true,
      redirect: defaultRedirect,
      user: {
        userId: payload.userId,
        telegramUserId: payload.telegramUserId,
        email: payload.email,
        fullName: payload.fullName,
        role: payload.role,
        organizationId: payload.organizationId,
        isPlatformOwner: Boolean(payload.isPlatformOwner),
        isPlatformAdmin: Boolean(payload.isPlatformAdmin),
      },
    });
    attachSessionCookie(response, payload, secret);
    return response;
  } catch {
    return NextResponse.json({ detail: "Server bilan bog'lanishda xatolik" }, { status: 502 });
  }
}
