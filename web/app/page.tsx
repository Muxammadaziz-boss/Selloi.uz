import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import LandingPage from "./components/landing/LandingPage";

export const metadata = {
  title: {
    absolute: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
  },
  description:
    "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.",
  keywords: [
    "Selloi",
    "Selloi.uz",
    "Selloi AI",
    "AI sotuvchi",
    "Telegram AI sotuvchi",
    "Telegram uchun AI sotuvchi",
    "Telegram do‘kon avtomatlashtirish",
    "Sun’iy intellekt sotuvchi",
    "O‘zbekistonda AI sotuvchi",
    "Telegram bot sotuvchi",
    "Telegram do'kon",
    "Telegram CRM",
  ],
  alternates: {
    canonical: "https://selloi.uz/",
    languages: {
      "uz": "https://selloi.uz/",
      "x-default": "https://selloi.uz/",
    },
  },
  openGraph: {
    title: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
    description:
      "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.",
    url: "https://selloi.uz/",
    siteName: "Selloi.uz",
    locale: "uz_UZ",
    type: "website",
    images: [
      {
        url: "https://selloi.uz/og-image.png",
        width: 1200,
        height: 630,
        alt: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Selloi.uz — Telegram uchun 24/7 AI sotuvchi",
    description:
      "Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.",
    images: ["https://selloi.uz/og-image.png"],
  },
};

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  const session = verifySession(token, process.env.SESSION_SECRET || "");

  return <LandingPage isAuthenticated={!!session} />;
}
