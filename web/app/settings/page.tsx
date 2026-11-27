import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import { resolveEffectiveSessionClaims } from "@/lib/authSession";
import Dashboard from "../Dashboard";

export const metadata: Metadata = {
  title: "Sozlamalar",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  if (!session) {
    redirect("/login?redirect=/settings");
  }

  const claims = await resolveEffectiveSessionClaims(session);
  if (!claims.fullyVerified) {
    redirect("/login?step=complete");
  }
  if (claims.isPlatformOwner || claims.isPlatformAdmin) {
    redirect("/admin");
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
        role: session.role,
        organizationId: session.organizationId,
        isPlatformOwner: claims.isPlatformOwner,
        isPlatformAdmin: claims.isPlatformAdmin,
      }}
      initialZone="tenant"
      initialTab="settings"
    />
  );
}
