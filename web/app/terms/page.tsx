import type { Metadata } from "next";
import TermsClient from "./TermsClient";

export const metadata: Metadata = {
  title: "Foydalanish shartlari (Terms of Service)",
  description:
    "Selloi.uz platformasidan foydalanish bo'yicha rasmiy shartlar va qoidalar. Telegram AI sotuvchi xizmatlarining huquqiy asosi.",
  alternates: {
    canonical: "https://selloi.uz/terms",
  },
  openGraph: {
    title: "Foydalanish shartlari (Terms of Service) | Selloi",
    description:
      "Selloi.uz platformasidan foydalanish bo'yicha rasmiy shartlar va qoidalar. Telegram AI sotuvchi xizmatlarining huquqiy asosi.",
    url: "https://selloi.uz/terms",
    siteName: "Selloi",
    locale: "uz_UZ",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Foydalanish shartlari (Terms of Service) | Selloi",
    description:
      "Selloi.uz platformasidan foydalanish bo'yicha rasmiy shartlar va qoidalar.",
  },
};

export default function TermsPage() {
  return <TermsClient />;
}
