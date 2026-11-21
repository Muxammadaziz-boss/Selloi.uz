import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import LoginPageClient from "./LoginPageClient";

interface LoginPageProps {
  searchParams?: Promise<{
    redirect?: string;
    tab?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(sessionCookieName);
  const secret = process.env.SESSION_SECRET || "";

  if (sessionCookie && secret) {
    const session = verifySession(sessionCookie.value, secret);
    if (session) {
      const resolvedParams = searchParams ? await searchParams : {};
      const targetUrl = resolvedParams.redirect || "/dashboard";
      redirect(targetUrl);
    }
  }

  const resolvedParams = searchParams ? await searchParams : {};
  return (
    <LoginPageClient
      initialRedirect={resolvedParams.redirect || "/dashboard"}
      initialTab={resolvedParams.tab || "login"}
      initialError={resolvedParams.error}
    />
  );
}
