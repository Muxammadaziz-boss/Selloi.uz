import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";
import { resolveEffectiveSessionClaims } from "@/lib/authSession";
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
    step?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(sessionCookieName);
  const secret = process.env.SESSION_SECRET || "";
  const resolvedParams = searchParams ? await searchParams : {};

  let initialCompletionState:
    | {
        email: string;
        telegramUserId?: number;
        emailVerified: boolean;
        hasRealEmail: boolean;
        missingSteps: string[];
      }
    | undefined = undefined;

  if (sessionCookie && secret) {
    const session = verifySession(sessionCookie.value, secret);
    if (session) {
      const claims = await resolveEffectiveSessionClaims(session);
      if (claims.fullyVerified) {
        const hasAdminAccess = claims.isPlatformOwner || claims.isPlatformAdmin;
        const requested = resolvedParams.redirect || "";
        if (hasAdminAccess) {
          if (
            requested &&
            (requested.startsWith("/admin") || requested.startsWith("/platform") || requested.startsWith("/t/")) &&
            !requested.startsWith("//")
          ) {
            redirect(requested);
          }
          redirect("/admin");
        }
        if (requested && requested.startsWith("/") && !requested.startsWith("//")) {
          if (requested.startsWith("/admin") || requested.startsWith("/platform")) {
            redirect("/dashboard");
          }
          redirect(requested);
        }
        redirect("/dashboard");
      }

      initialCompletionState = {
        email: claims.email || session.email || "",
        telegramUserId: claims.telegramUserId ?? session.telegramUserId,
        emailVerified: claims.emailVerified,
        hasRealEmail: claims.hasRealEmail,
        missingSteps: claims.missingSteps,
      };
    }
  }

  return (
    <LoginPageClient
      initialRedirect={resolvedParams.redirect || ""}
      initialTab={resolvedParams.tab || "login"}
      initialError={resolvedParams.error}
      initialStep={resolvedParams.step}
      initialCompletionState={initialCompletionState}
    />
  );
}
