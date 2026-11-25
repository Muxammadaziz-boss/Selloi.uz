import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SessionPayload, sessionCookieName, sessionTtlSeconds } from "@/lib/session";

// In-memory rate limiting tracker: ip/identifier -> timestamp[]
const loginAttempts = new Map<string, number[]>();

function checkRateLimit(key: string, maxAttempts = (process.env.NODE_ENV === "production" ? 10 : 100), windowMs = 60000): boolean {
  const now = Date.now();
  const attempts = (loginAttempts.get(key) || []).filter((t) => now - t < windowMs);
  if (attempts.length >= maxAttempts) {
    return false;
  }
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
  let telegramIdNum: number | undefined = undefined;
  let email = "admin@aisales.uz";
  let orgId: number | undefined = undefined;

  try {
    const body = await request.json();
    supplied = typeof body.password === "string" ? body.password : "";
    if (body.telegram_id) {
      const parsed = Number(body.telegram_id);
      if (Number.isFinite(parsed) && parsed > 0) {
        telegramIdNum = parsed;
      }
    }
    if (typeof body.email === "string" && body.email.includes("@")) {
      email = body.email.trim().toLowerCase();
    }
    if (typeof body.organization_id === "number" && body.organization_id > 0) {
      orgId = body.organization_id;
    }
  } catch {
    return NextResponse.json({ detail: "Login ma'lumoti noto'g'ri" }, { status: 400 });
  }

  // 1. Try individual backend authentication (/api/v1/auth/login)
  let backendToken: string | undefined = undefined;
  let authenticatedUserId: number | undefined = undefined;
  let authenticatedFullName: string | undefined = undefined;
  let authenticatedRole = "member";
  let isTruePlatformOwner = false;

  try {
    const backendRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: supplied }),
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      backendToken = data.access_token;
      authenticatedUserId = data.user_id;
      if (data.full_name) {
        authenticatedFullName = data.full_name;
      }

      // Authoritative profile claim verification: ONLY backend profile claim grants Platform Owner
      const profileRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${backendToken}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        if (profile?.full_name) {
          authenticatedFullName = profile.full_name;
        }
        // Strict equality check: only authenticated boolean claim true grants Platform Owner
        if (profile && profile.is_platform_owner === true) {
          isTruePlatformOwner = true;
          authenticatedRole = "platform_owner";
        } else {
          isTruePlatformOwner = false;
          // Tenant role "owner" must NEVER imply Platform Owner
          authenticatedRole = profile?.role || "owner";
        }
        if (profile?.telegram_user_id) {
          telegramIdNum = profile.telegram_user_id;
        }

        // Resolve organization without assuming Org 1
        if (!orgId) {
          try {
            const orgsRes = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/organizations`, {
              headers: { Authorization: `Bearer ${backendToken}` },
            });
            if (orgsRes.ok) {
              const orgs = await orgsRes.json();
              if (Array.isArray(orgs) && orgs.length > 0 && orgs[0]?.id) {
                orgId = orgs[0].id;
              }
            }
          } catch {
            // Ignore org resolution errors
          }
        }
      } else {
        // Failed backend profile verification MUST NOT grant elevated privileges
        isTruePlatformOwner = false;
        authenticatedRole = "owner";
      }
    }
  } catch {
    // Backend unreachable; fail safe without elevated privileges
    isTruePlatformOwner = false;
  }

  // Master dashboard password login removed; require valid backend user credentials
  if (!backendToken) {
    return NextResponse.json({ detail: "Email yoki parol noto'g'ri" }, { status: 401 });
  }

  const sessionPayload: SessionPayload = {
    userId: authenticatedUserId || 1,
    telegramUserId: telegramIdNum,
    email: email || "admin@selloi.uz",
    fullName: authenticatedFullName,
    role: authenticatedRole,
    isPlatformOwner: isTruePlatformOwner,
    organizationId: orgId,
    backendToken,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  const response = NextResponse.json({
    ok: true,
    user: {
      userId: sessionPayload.userId,
      telegramUserId: sessionPayload.telegramUserId,
      email: sessionPayload.email,
      role: sessionPayload.role,
      organizationId: sessionPayload.organizationId,
      isPlatformOwner: isTruePlatformOwner,
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
}
