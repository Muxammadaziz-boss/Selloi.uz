import { NextRequest, NextResponse } from "next/server";
import { extractTokenVersionFromJwt, sessionCookieName, signBackendJwt, verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const sessionSecret = process.env.SESSION_SECRET;
  const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;

  if (!sessionSecret) {
    return NextResponse.json(
      { detail: "Server sozlamasida xatolik: SESSION_SECRET mavjud emas" },
      { status: 500 }
    );
  }

  const session = request.cookies.get(sessionCookieName)?.value;
  const sessionData = verifySession(session, sessionSecret);

  if (!sessionData) {
    return NextResponse.json({ detail: "Avval admin panelga kiring" }, { status: 401 });
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip") || (forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1");

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Real-IP": realIp,
    "X-Forwarded-For": realIp,
  };

  if (jwtSecret) {
    const userEmail = sessionData.email || `user_${sessionData.userId}@aisales.uz`;
    const tv = sessionData.tokenVersion ?? extractTokenVersionFromJwt(sessionData.backendToken);
    headers["Authorization"] = `Bearer ${signBackendJwt(sessionData.userId, userEmail, jwtSecret, tv)}`;
  } else if (sessionData.backendToken) {
    headers["Authorization"] = `Bearer ${sessionData.backendToken}`;
  } else {
    return NextResponse.json(
      { detail: "JWT_SECRET sozlanmagan: autentifikatsiya amalga oshirilmadi" },
      { status: 500 }
    );
  }

  const requestedOrgId =
    request.headers.get("x-organization-id") || request.nextUrl.searchParams.get("organization_id");
  const targetOrgId = requestedOrgId || (sessionData.organizationId ? String(sessionData.organizationId) : null);
  if (targetOrgId) {
    headers["X-Organization-Id"] = targetOrgId;
  }

  try {
    const response = await fetch(`${backend.replace(/\/$/, "")}/admin/events`, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: request.signal,
    });

    if (!response.ok || !response.body) {
      let detail = "Real-vaqt oqimiga ulanib bo'lmadi";
      try {
        const text = await response.text();
        if (text && text.length < 300) detail = text;
      } catch {
        // Ignore body parse errors
      }
      return NextResponse.json({ detail }, { status: response.status || 502 });
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ detail: "Real-vaqt aloqasi uzildi" }, { status: 502 });
  }
}
