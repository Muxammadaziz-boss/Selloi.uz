import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import { resolveEffectiveSessionClaims } from "@/lib/authSession";
import Dashboard from "../../Dashboard";

export const metadata: Metadata = {
  title: "Obuna va To'lovlar",
  robots: {
    index: false,
    follow: false,
  },
};

interface SettingsBillingPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsBillingPage({ searchParams }: SettingsBillingPageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedPlan = typeof resolvedParams.plan === "string" ? resolvedParams.plan : undefined;
  const rawCycle = typeof resolvedParams.cycle === "string" ? resolvedParams.cycle.toLowerCase().trim() : undefined;
  const requestedCycle: "monthly" | "yearly" | undefined =
    rawCycle === "yearly" ? "yearly" : rawCycle === "monthly" ? "monthly" : undefined;

  const billingQuery = new URLSearchParams();
  if (requestedPlan) billingQuery.set("plan", requestedPlan);
  if (requestedCycle) billingQuery.set("cycle", requestedCycle);
  const billingReturnPath = billingQuery.toString()
    ? `/settings/billing?${billingQuery.toString()}`
    : "/settings/billing";

  if (!session) {
    redirect(`/login?redirect=${encodeURIComponent(billingReturnPath)}`);
  }

  const claims = await resolveEffectiveSessionClaims(session);
  if (!claims.fullyVerified) {
    redirect(`/login?step=complete&redirect=${encodeURIComponent(billingReturnPath)}`);
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
      initialTab="billing"
      initialPlan={requestedPlan}
      initialBillingCycle={requestedCycle}
    />
  );
}
