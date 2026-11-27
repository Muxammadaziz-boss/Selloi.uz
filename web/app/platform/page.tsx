import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveEffectiveSessionClaims } from "@/lib/authSession";
import { sessionCookieName, verifySession } from "@/lib/session";

export default async function PlatformPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  if (!session) {
    redirect("/login?redirect=/admin");
  }

  const claims = await resolveEffectiveSessionClaims(session);
  if (!claims.fullyVerified) {
    redirect("/login?step=complete");
  }

  if (!claims.isPlatformOwner && !claims.isPlatformAdmin) {
    redirect("/dashboard");
  }

  redirect("/admin");
}
