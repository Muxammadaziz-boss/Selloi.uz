import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import LandingPage from "./components/landing/LandingPage";

export const metadata = {
  title: "Selloi: Telegram do'koningiz uchun Sun'iy Intellekt sotuvchisi",
  description:
    "Mijozlaringiz bilan o'zbek tilida erkin muloqot qiladi, rasmdagi mahsulotlarni taniydi, buyurtmalarni qabul qiladi va biznesingizni avtomatlashtirishga yordam beradi.",
  keywords: [
    "Selloi",
    "Selloi.uz",
    "Selloi AI",
    "Selloi Telegram AI",
    "Selloi AI sotuvchi",
    "Telegram do'kon",
    "Telegram bot sotuvchi",
    "Telegram AI",
    "O'zbekiston AI",
    "Telegram CRM",
  ],
  alternates: {
    canonical: "https://selloi.uz/",
  },
  openGraph: {
    title: "Selloi: Telegram do'koningiz uchun Sun'iy Intellekt sotuvchisi",
    description:
      "24/7 ishlovchi AI sotuvchi. Rasmlarni taniydi, tabiiy tilda javob beradi va buyurtmalarni qabul qiladi.",
    url: "https://selloi.uz/",
    siteName: "Selloi.uz",
    locale: "uz_UZ",
    type: "website",
    images: [
      {
        url: "https://selloi.uz/og-image.png",
        width: 1200,
        height: 630,
        alt: "Selloi: Telegram do'konlari uchun AI sotuvchi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Selloi: Telegram do'koningiz uchun Sun'iy Intellekt sotuvchisi",
    description:
      "24/7 ishlovchi AI sotuvchi. Rasmlarni taniydi, tabiiy tilda javob beradi va buyurtmalarni qabul qiladi.",
    images: ["https://selloi.uz/og-image.png"],
  },
};

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  return <LandingPage isAuthenticated={!!session} />;
}
