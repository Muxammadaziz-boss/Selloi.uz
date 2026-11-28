import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  extractTokenVersionFromJwt,
  SessionPayload,
  sessionCookieName,
  sessionTtlSeconds,
  signBackendJwt,
  verifySession,
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

export function isRealEmailClient(email?: string | null): boolean {
  const clean = (email || "").trim().toLowerCase();
  if (!clean || !clean.includes("@")) return false;
  const domain = clean.split("@").pop() || "";
  if (!domain.includes(".")) return false;
  return !(
    clean.endsWith("@telegram.selloi.uz") ||
    clean.endsWith("@merged.selloi.uz") ||
    clean.endsWith("@telegram.local") ||
    clean.endsWith(".invalid")
  );
}

/**
 * Resolve authoritative user role claims, 2-factor verification flags,
 * and default organization from the FastAPI backend to build a signed session.
 */
export async function buildVerifiedSessionPayload(params: BuildSessionParams): Promise<{
  payload: SessionPayload;
  defaultRedirect: "/admin" | "/dashboard" | "/login?step=complete";
}> {
  const baseUrl = params.backendUrl.replace(/\/$/, "");
  let isPlatformOwner = false;
  let isPlatformAdmin = false;
  let resolvedUserId = params.userId;
  let resolvedEmail = (params.email || "user@selloi.uz").trim().toLowerCase();
  let fullName = params.fullName;
  let telegramUserId = params.telegramUserId;
  let orgId = params.organizationId;
  let emailVerified = false;
  let hasRealEmail = isRealEmailClient(resolvedEmail);
  let fullyVerified = false;
  let missingSteps: string[] = [];
  let tokenVersion = extractTokenVersionFromJwt(params.backendToken);

  try {
    const profileRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${params.backendToken}` },
      cache: "no-store",
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      if (profile?.id) resolvedUserId = Number(profile.id);
      if (profile?.email) resolvedEmail = String(profile.email).trim().toLowerCase();
      isPlatformOwner = profile?.is_platform_owner === true;
      isPlatformAdmin = profile?.is_platform_admin === true;
      if (profile?.full_name) fullName = profile.full_name;
      if (profile?.telegram_user_id) telegramUserId = profile.telegram_user_id;
      emailVerified = profile?.email_verified === true;
      hasRealEmail = profile?.has_real_email === true;
      fullyVerified = profile?.fully_verified === true;
      missingSteps = Array.isArray(profile?.missing_steps) ? profile.missing_steps : [];
      const tv = Number(profile?.token_version);
      if (Number.isInteger(tv) && tv >= 1) tokenVersion = tv;
    }
  } catch {
    // Fail closed: keep elevated and verified flags false if profile lookup fails
  }

  if (fullyVerified && !orgId) {
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
    userId: resolvedUserId,
    telegramUserId,
    email: resolvedEmail,
    fullName,
    username: params.username,
    role,
    emailVerified,
    hasRealEmail,
    fullyVerified,
    missingSteps,
    isPlatformOwner,
    isPlatformAdmin,
    organizationId: orgId,
    tokenVersion,
    backendToken: params.backendToken,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  const defaultRedirect = !fullyVerified
    ? "/login?step=complete"
    : isPlatformOwner || isPlatformAdmin
    ? "/admin"
    : "/dashboard";
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

/**
 * Resolve freshest platform role & 2-factor verification flags from FastAPI /api/v1/auth/me,
 * falling back cleanly to signed cookie claims when offline.
 */
export async function resolveEffectiveSessionClaims(session: SessionPayload): Promise<{
  isPlatformOwner: boolean;
  isPlatformAdmin: boolean;
  fullyVerified: boolean;
  emailVerified: boolean;
  hasRealEmail: boolean;
  telegramUserId?: number;
  email?: string;
  missingSteps: string[];
  revoked?: boolean;
}> {
  const cookieHasRealEmail = session.hasRealEmail ?? isRealEmailClient(session.email);
  const cookieEmailVerified = session.emailVerified ?? cookieHasRealEmail;
  const cookieTg = session.telegramUserId;
  const cookieMissing = Array.isArray(session.missingSteps)
    ? session.missingSteps
    : [
        ...(!(cookieEmailVerified && cookieHasRealEmail) ? ["email"] : []),
        ...(!cookieTg ? ["telegram"] : []),
      ];
  const fallbackFullyVerified =
    typeof session.fullyVerified === "boolean"
      ? session.fullyVerified
      : cookieMissing.length === 0;

  const fallback = {
    isPlatformOwner: Boolean(session.isPlatformOwner),
    isPlatformAdmin: Boolean(session.isPlatformAdmin),
    fullyVerified: fallbackFullyVerified,
    emailVerified: Boolean(cookieEmailVerified && cookieHasRealEmail),
    hasRealEmail: Boolean(cookieHasRealEmail),
    telegramUserId: cookieTg,
    email: session.email,
    missingSteps: cookieMissing,
    revoked: false,
  };

  const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || "";
  const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  let bearer = session.backendToken || "";
  if (jwtSecret) {
    bearer = signBackendJwt(
      session.userId,
      session.email || `user_${session.userId}@selloi.uz`,
      jwtSecret,
      session.tokenVersion || 1
    );
  }
  if (!bearer) return fallback;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return {
        isPlatformOwner: false,
        isPlatformAdmin: false,
        fullyVerified: false,
        emailVerified: false,
        hasRealEmail: false,
        telegramUserId: undefined,
        email: session.email,
        missingSteps: ["email", "telegram"],
        revoked: true,
      };
    }
    if (!res.ok) return fallback;
    const data = await res.json();
    const realEmail = typeof data?.has_real_email === "boolean" ? data.has_real_email : isRealEmailClient(data?.email);
    const verifiedEmail = Boolean(data?.email_verified) && realEmail;
    const tgId = data?.telegram_user_id ? Number(data.telegram_user_id) : undefined;
    const missing = Array.isArray(data?.missing_steps)
      ? data.missing_steps
      : [
          ...(!verifiedEmail ? ["email"] : []),
          ...(!tgId ? ["telegram"] : []),
        ];
    return {
      isPlatformOwner: Boolean(data?.is_platform_owner),
      isPlatformAdmin: Boolean(data?.is_platform_admin),
      fullyVerified: typeof data?.fully_verified === "boolean" ? data.fully_verified : missing.length === 0,
      emailVerified: verifiedEmail,
      hasRealEmail: Boolean(realEmail),
      telegramUserId: tgId,
      email: data?.email || session.email,
      missingSteps: missing,
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Forward an authenticated POST request from a signed sales_session user to FastAPI
 * (used for linking Telegram or binding/confirming Email in the Verification Gate).
 */
export async function forwardAuthedAuthAction(
  request: NextRequest,
  endpointPath: string,
  body: Record<string, any>,
  options: { refreshSessionOnToken?: boolean } = {}
): Promise<NextResponse> {
  const secret = process.env.SESSION_SECRET || "";
  const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || "";

  if (!secret) {
    return NextResponse.json({ detail: "SESSION_SECRET sozlanmagan" }, { status: 500 });
  }

  const rawCookie = request.cookies.get(sessionCookieName)?.value;
  const session = verifySession(rawCookie, secret);
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
  if (!bearer) {
    return NextResponse.json({ detail: "Avtorizatsiya tokeni topilmadi" }, { status: 401 });
  }

  try {
    const backendRes = await fetch(`${backendUrl}${endpointPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(body),
    });
    const data = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    if (options.refreshSessionOnToken && data?.access_token) {
      const { payload, defaultRedirect } = await buildVerifiedSessionPayload({
        backendUrl,
        backendToken: data.access_token,
        userId: Number(data.user_id || session.userId),
        email: data.email || session.email,
        fullName: data.full_name || session.fullName,
        username: data.username || session.username,
        telegramUserId: data.telegram_user_id ?? session.telegramUserId,
        organizationId: session.organizationId,
      });
      const response = NextResponse.json({
        ...data,
        ok: true,
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

    return NextResponse.json(data, { status: backendRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || "Server bilan bog'lanishda xatolik" },
      { status: 500 }
    );
  }
}

/**
 * Create a short-lived HMAC-SHA256 header proving a Google OAuth user exchange
 * was verified by the Next.js BFF before calling the backend `/api/v1/auth/google`.
 */
export function buildInternalGoogleAuthSignature(
  email: string,
  googleId: string,
  linkUserId?: number
): string | null {
  const jwtSecret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || "";
  if (!jwtSecret) return null;
  const ts = Math.floor(Date.now() / 1000);
  const cleanEmail = email.trim().toLowerCase();
  const cleanGoogleId = (googleId || "").trim();
  const message =
    typeof linkUserId === "number" && linkUserId > 0
      ? `google-auth:${ts}:${cleanEmail}:${cleanGoogleId}:${linkUserId}`
      : `google-auth:${ts}:${cleanEmail}:${cleanGoogleId}`;
  const sig = createHmac("sha256", jwtSecret).update(message).digest("hex");
  return `${ts}.${sig}`;
}
