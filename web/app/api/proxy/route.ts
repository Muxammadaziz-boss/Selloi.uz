import { NextRequest, NextResponse } from "next/server";
import { extractTokenVersionFromJwt, sessionCookieName, signBackendJwt, verifySession } from "@/lib/session";

async function proxy(request: NextRequest) {
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

  const path = request.nextUrl.searchParams.get("path") || "";
  const isPublicRoute =
    path === "/api/organizations/verify-token" ||
    path === "/api/organizations/verify-channel" ||
    path === "/api/saas/organizations" ||
    path.startsWith("/api/onboarding/") ||
    path === "/api/plans" ||
    path.startsWith("/api/plans?") ||
    path.startsWith("/api/plans/");

  // All proxy endpoints require a session, except public SaaS onboarding/verification routes and public catalog
  if (!sessionData && !isPublicRoute) {
    return NextResponse.json({ detail: "Avval admin panelga kiring" }, { status: 401 });
  }

  if (!path.startsWith("/admin/") && !path.startsWith("/api/")) {
    return NextResponse.json({ detail: "Proxy path ruxsat etilmagan" }, { status: 400 });
  }

  // Prevent directory traversal, protocol injection, and open proxy abuse
  if (path.includes("..") || path.includes("://") || path.startsWith("//")) {
    return NextResponse.json({ detail: "Noto'g'ri proxy formati" }, { status: 400 });
  }

  // Strict 2-part separation at BFF layer: regular store owners cannot call /api/platform/*
  if (path.startsWith("/api/platform")) {
    const hasPlatformAccess = Boolean(sessionData?.isPlatformOwner || sessionData?.isPlatformAdmin);
    if (!hasPlatformAccess) {
      return NextResponse.json(
        { detail: "Faqat Sayt egasi (Owner) yoki tayinlangan Sayt Admini kirishi mumkin" },
        { status: 403 }
      );
    }
  }

  // Request body payload size guard (max 10MB)
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 10 * 1024 * 1024) {
    return NextResponse.json(
      { detail: "Yuklanayotgan ma'lumot hajmi juda katta (maksimal 10MB)" },
      { status: 413 }
    );
  }

  // CSRF defense for cookie-authenticated state-changing requests
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (isMutation && sessionData) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("host") || "";
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host && !host.startsWith("localhost") && !originHost.startsWith("localhost") && !host.includes("127.0.0.1")) {
          return NextResponse.json({ detail: "CSRF tekshiruvidan o'tmadi: Origin mos kelmadi" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ detail: "Noto'g'ri Origin formati" }, { status: 400 });
      }
    } else if (referer) {
      try {
        const refererHost = new URL(referer).host;
        if (refererHost !== host && !host.startsWith("localhost") && !refererHost.startsWith("localhost") && !host.includes("127.0.0.1")) {
          return NextResponse.json({ detail: "CSRF tekshiruvidan o'tmadi: Referer mos kelmadi" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ detail: "Noto'g'ri Referer formati" }, { status: 400 });
      }
    }
  }

  const target = `${backend.replace(/\/$/, "")}${path}`;
  const requestedOrgId =
    request.headers.get("x-organization-id") || request.nextUrl.searchParams.get("organization_id");

  // Extract trustworthy client IP from connection headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip") || (forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Real-IP": realIp,
    "X-Forwarded-For": realIp,
  };

  // Attach identity: Forward cryptographically signed JWT with token_version (tv)
  if (sessionData && jwtSecret) {
    const userId = sessionData.userId;
    const userEmail = sessionData.email || `user_${sessionData.userId}@aisales.uz`;
    const tv = sessionData.tokenVersion ?? extractTokenVersionFromJwt(sessionData.backendToken);
    const userJwt = signBackendJwt(userId, userEmail, jwtSecret, tv);
    headers["Authorization"] = `Bearer ${userJwt}`;
  } else if (sessionData?.backendToken) {
    headers["Authorization"] = `Bearer ${sessionData.backendToken}`;
  } else if (!isPublicRoute) {
    return NextResponse.json(
      { detail: "JWT_SECRET sozlanmagan: autentifikatsiya amalga oshirilmadi" },
      { status: 500 }
    );
  }

  // Tenant scoping: Forward target organization ID (backend verifies user's membership)
  const targetOrgId = requestedOrgId || (sessionData?.organizationId ? String(sessionData.organizationId) : null);
  if (targetOrgId) {
    headers["X-Organization-Id"] = targetOrgId;
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const response = await fetch(target, init);
    const contentType = response.headers.get("content-type") || "application/json";
    const data = await response.arrayBuffer();
    const resHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": response.headers.get("cache-control") || "no-store",
    };
    const contentDisposition = response.headers.get("content-disposition");
    if (contentDisposition) {
      resHeaders["Content-Disposition"] = contentDisposition;
    }
    return new NextResponse(data, {
      status: response.status,
      headers: resHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "Backend serveri bilan aloqa yo'q.",
          request_id: `proxy_${Date.now()}`,
          retryable: true,
        },
        detail: "Backend bilan aloqa yo'q",
      },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
