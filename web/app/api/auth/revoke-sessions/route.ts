import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, signBackendJwt, verifySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const backend = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const sessionSecret = process.env.SESSION_SECRET || "";
  const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || "";

  if (!sessionSecret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  const rawCookie = request.cookies.get(sessionCookieName)?.value;
  const session = verifySession(rawCookie, sessionSecret);
  if (!session) {
    return NextResponse.json({ detail: "Avval hisobingizga kiring" }, { status: 401 });
  }

  let bearer = session.backendToken || "";
  if (jwtSecret) {
    bearer = signBackendJwt(
      session.userId,
      session.email || `user_${session.userId}@selloi.uz`,
      jwtSecret,
      session.tokenVersion || 1
    );
  }

  if (bearer) {
    try {
      const backendRes = await fetch(`${backend}/api/v1/auth/revoke-sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
      });
      if (!backendRes.ok && backendRes.status !== 401) {
        const errData = await backendRes.json().catch(() => ({}));
        return NextResponse.json(errData, { status: backendRes.status });
      }
    } catch {
      return NextResponse.json({ detail: "Backend bilan aloqa yo'q" }, { status: 502 });
    }
  }

  const response = NextResponse.json({
    ok: true,
    detail: "Barcha qurilmalardagi faol sessiyalar bekor qilindi",
  });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
