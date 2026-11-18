import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import LandingPage from "./components/landing/LandingPage";

export const metadata = {
  title: "Selloi.uz — Telegram do‘koningiz uchun Sun’iy Intellekt sotuvchisi",
  description:
    "Mijozlaringiz bilan o‘zbek tilida erkin muloqot qiladi, rasmdagi mahsulotlarni taniydi, buyurtmalarni qabul qiladi va biznesingizni avtomatlashtirishga yordam beradi.",
  keywords: [
    "Telegram do'kon",
    "Telegram bot sotuvchi",
    "AI sotuvchi",
    "Selloi",
    "Selloi.uz",
    "Telegram AI",
    "O'zbekiston AI",
    "Telegram CRM",
  ],
  openGraph: {
    title: "Selloi.uz — Telegram do‘koningiz uchun Sun’iy Intellekt sotuvchisi",
    description:
      "24/7 ishlovchi AI sotuvchi. Rasmlarni taniydi, tabiiy tilda javob beradi va buyurtmalarni qabul qiladi.",
    url: "https://selloi.uz",
    siteName: "Selloi.uz",
    locale: "uz_UZ",
    type: "website",
  },
};

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  return <LandingPage isAuthenticated={!!session} />;
}
