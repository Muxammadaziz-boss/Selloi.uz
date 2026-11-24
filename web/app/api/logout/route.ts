import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const sessionSecret = process.env.SESSION_SECRET;
  const session = request.cookies.get(sessionCookieName)?.value;

  if (session && sessionSecret) {
    const sessionData = verifySession(session, sessionSecret);
    if (sessionData?.backendToken) {
      try {
        await fetch(`${backend.replace(/\/$/, "")}/api/v1/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionData.backendToken}`,
            "Content-Type": "application/json",
          },
        });
      } catch {
        // Best effort backend session invalidation
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
