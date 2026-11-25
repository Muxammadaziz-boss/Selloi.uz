import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionCookieName, verifySession } from "@/lib/session";

export default async function PlatformPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  if (!session) {
    redirect("/login?redirect=/admin");
  }

  if (!session.isPlatformOwner && !session.isPlatformAdmin) {
    redirect("/dashboard");
  }

  redirect("/admin");
}
