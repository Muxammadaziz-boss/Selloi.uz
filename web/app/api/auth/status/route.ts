import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySession } from "@/lib/session";
import { resolveEffectiveSessionClaims } from "@/lib/authSession";

export async function GET(request: NextRequest) {
  const secret = process.env.SESSION_SECRET || "";
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = verifySession(token, secret);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null });
  }
  const claims = await resolveEffectiveSessionClaims(session);
  return NextResponse.json({
    authenticated: true,
    user: {
      userId: session.userId,
      telegramUserId: claims.telegramUserId ?? session.telegramUserId,
      email: claims.email || session.email,
      fullName: session.fullName,
      username: session.username,
      role: claims.isPlatformOwner ? "platform_owner" : claims.isPlatformAdmin ? "platform_admin" : session.role,
      organizationId: session.organizationId,
      emailVerified: claims.emailVerified,
      hasRealEmail: claims.hasRealEmail,
      fullyVerified: claims.fullyVerified,
      missingSteps: claims.missingSteps,
      isPlatformOwner: claims.isPlatformOwner,
      isPlatformAdmin: claims.isPlatformAdmin,
    },
  });
}
