import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import { resolveEffectiveSessionClaims } from "@/lib/authSession";
import Dashboard from "../Dashboard";

export const metadata: Metadata = {
  title: "Admin Panel — Platforma boshqaruvi",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPortalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  if (!session) {
    redirect("/login?redirect=/admin");
  }

  const claims = await resolveEffectiveSessionClaims(session);

  // Strictly only Sayt egasi (Owner) and Owner-appointed Sayt Adminlari can enter /admin
  if (!claims.isPlatformOwner && !claims.isPlatformAdmin) {
    redirect("/dashboard");
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
      initialZone="platform"
      initialTab="platform"
    />
  );
}
