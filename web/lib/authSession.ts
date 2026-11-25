import { NextResponse } from "next/server";
import {
  createSessionToken,
  SessionPayload,
  sessionCookieName,
  sessionTtlSeconds,
} from "./session";

export interface BuildSessionParams {
  backendUrl: string;
  backendToken: string;
  userId: number;
  email?: string;
  fullName?: string;
  username?: string;
  telegramUserId?: number;
  organizationId?: number;
}

/**
 * Resolve authoritative user role claims (isPlatformOwner / isPlatformAdmin)
 * and default organization from the FastAPI backend to build a signed session.
 */
export async function buildVerifiedSessionPayload(params: BuildSessionParams): Promise<{
  payload: SessionPayload;
  defaultRedirect: "/admin" | "/dashboard";
}> {
  const baseUrl = params.backendUrl.replace(/\/$/, "");
  let isPlatformOwner = false;
  let isPlatformAdmin = false;
  let fullName = params.fullName;
  let telegramUserId = params.telegramUserId;
  let orgId = params.organizationId;

  try {
    const profileRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${params.backendToken}` },
      cache: "no-store",
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      isPlatformOwner = profile?.is_platform_owner === true;
      isPlatformAdmin = profile?.is_platform_admin === true;
      if (profile?.full_name) fullName = profile.full_name;
      if (profile?.telegram_user_id) telegramUserId = profile.telegram_user_id;
    }
  } catch {
    // Fail closed: keep elevated flags false if profile lookup fails
  }

  if (!orgId) {
    try {
      const orgsRes = await fetch(`${baseUrl}/api/v1/organizations`, {
        headers: { Authorization: `Bearer ${params.backendToken}` },
        cache: "no-store",
      });
      if (orgsRes.ok) {
        const orgs = await orgsRes.json();
        if (Array.isArray(orgs) && orgs.length > 0 && orgs[0]?.id) {
          orgId = orgs[0].id;
        }
      }
    } catch {
      // Non-critical if user has no organization yet (e.g. Site Admin)
    }
  }

  const role = isPlatformOwner
    ? "platform_owner"
    : isPlatformAdmin
    ? "platform_admin"
    : "owner";

  const payload: SessionPayload = {
    userId: params.userId,
    telegramUserId,
    email: params.email || "user@selloi.uz",
    fullName,
    username: params.username,
    role,
    isPlatformOwner,
    isPlatformAdmin,
    organizationId: orgId,
    backendToken: params.backendToken,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  const defaultRedirect = isPlatformOwner || isPlatformAdmin ? "/admin" : "/dashboard";
  return { payload, defaultRedirect };
}

export function attachSessionCookie(response: NextResponse, payload: SessionPayload, secret: string): void {
  response.cookies.set(sessionCookieName, createSessionToken(payload, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds,
  });
}
