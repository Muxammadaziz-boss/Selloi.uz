import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, signBackendJwt, verifySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const sessionSecret = process.env.SESSION_SECRET;
  const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  const session = request.cookies.get(sessionCookieName)?.value;

  if (session && sessionSecret) {
    const sessionData = verifySession(session, sessionSecret);
    if (sessionData) {
      const bearer = jwtSecret
        ? signBackendJwt(
            sessionData.userId,
            sessionData.email || `user_${sessionData.userId}@selloi.uz`,
            jwtSecret,
            sessionData.tokenVersion || 1
          )
        : sessionData.backendToken || "";
      if (bearer) {
        try {
          await fetch(`${backend.replace(/\/$/, "")}/api/v1/auth/logout`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${bearer}`,
              "Content-Type": "application/json",
            },
          });
        } catch {
          // Best effort backend session invalidation
        }
      }
    }
  }

  const response = NextResponse.json({ ok: true, detail: "Muvaffaqiyatli chiqildi" });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
