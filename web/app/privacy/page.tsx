import type { Metadata } from "next";
import PrivacyPolicyClient from "./PrivacyPolicyClient";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati (Privacy Policy)",
  description:
    "Selloi.uz platformasining shaxsiy ma'lumotlarni yig'ish, qayta ishlash va himoya qilish bo'yicha rasmiy maxfiylik siyosati. Google API Services User Data Policy talablariga to'liq muvofiq.",
  alternates: {
    canonical: "https://selloi.uz/privacy",
  },
  openGraph: {
    title: "Maxfiylik siyosati (Privacy Policy) | Selloi",
    description:
      "Selloi.uz platformasining shaxsiy ma'lumotlarni yig'ish, qayta ishlash va himoya qilish bo'yicha rasmiy maxfiylik siyosati.",
    url: "https://selloi.uz/privacy",
    siteName: "Selloi",
    locale: "uz_UZ",
    type: "article",
  },
  twitter: {
    card: "summary",
    title: "Maxfiylik siyosati (Privacy Policy) | Selloi",
    description:
      "Selloi.uz platformasining shaxsiy ma'lumotlarni yig'ish, qayta ishlash va himoya qilish bo'yicha rasmiy maxfiylik siyosati.",
  },
};

export default function PrivacyPage() {
  return <PrivacyPolicyClient />;
}
