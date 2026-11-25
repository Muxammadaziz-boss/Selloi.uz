import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
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

  // Strictly only Sayt egasi (Owner) and Owner-appointed Sayt Adminlari can enter /admin
  if (!session.isPlatformOwner && !session.isPlatformAdmin) {
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
        role: session.role,
        organizationId: session.organizationId,
        isPlatformOwner: Boolean(session.isPlatformOwner),
        isPlatformAdmin: Boolean(session.isPlatformAdmin),
      }}
      initialZone="platform"
      initialTab="platform"
    />
  );
}
