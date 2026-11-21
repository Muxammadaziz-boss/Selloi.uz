import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import Dashboard from "../../Dashboard";

interface SettingsBillingPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SettingsBillingPage({ searchParams }: SettingsBillingPageProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");
  const resolvedParams = searchParams ? await searchParams : {};
  const requestedPlan = typeof resolvedParams.plan === "string" ? resolvedParams.plan : undefined;

  if (!session) {
    const redirectUrl = requestedPlan
      ? `/login?redirect=${encodeURIComponent(`/settings/billing?plan=${requestedPlan}`)}`
      : "/login?redirect=/settings/billing";
    redirect(redirectUrl);
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
      }}
      initialZone="tenant"
      initialTab="billing"
      initialPlan={requestedPlan}
    />
  );
}
