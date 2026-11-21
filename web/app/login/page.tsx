import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import LoginPageClient from "./LoginPageClient";

export const metadata: Metadata = {
  title: "Kirish",
  description: "Selloi boshqaruv paneliga xavfsiz kirish va ro'yxatdan o'tish.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "/login",
  },
  openGraph: {
    title: "Kirish | Selloi",
    description: "Selloi boshqaruv paneliga xavfsiz kirish va ro'yxatdan o'tish.",
    url: "https://selloi.uz/login",
  },
};

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
