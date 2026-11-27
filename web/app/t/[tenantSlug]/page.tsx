import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import { resolveEffectiveSessionClaims } from "@/lib/authSession";
import Dashboard from "../../Dashboard";

export const metadata: Metadata = {
  title: "Do'kon paneli",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TenantPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(`/t/${tenantSlug}`)}`);
  }

  const claims = await resolveEffectiveSessionClaims(session);
  if (!claims.fullyVerified) {
    redirect("/login?step=complete");
  }

  return (
    <Dashboard
      initialAuthenticated={true}
      initialUser={{
        userId: session.userId,
        telegramUserId: session.telegramUserId,
        email: session.email,
        fullName: session.fullName,
        username: session.username,
        role: claims.isPlatformOwner ? "platform_owner" : claims.isPlatformAdmin ? "platform_admin" : session.role,
        organizationId: session.organizationId,
        isPlatformOwner: claims.isPlatformOwner,
        isPlatformAdmin: claims.isPlatformAdmin,
      }}
      initialZone="tenant"
      initialTenantSlug={tenantSlug}
    />
  );
}
