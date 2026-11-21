import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, FileText, Globe, Mail, ShieldCheck } from "lucide-react";
import "../privacy/legal.css";

export const metadata: Metadata = {
  title: "Foydalanish shartlari (Terms of Service) | Selloi",
  description:
    "Selloi.uz platformasidan foydalanish bo'yicha rasmiy shartlar va qoidalar. Telegram AI sotuvchi xizmatlarining huquqiy asosi.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="selloi-legal-wrapper">
      <div className="selloi-legal-glow-top" />
      <div className="selloi-legal-glow-bottom" />

      <div className="selloi-legal-container">
        {/* Navigation Bar */}
        <header className="selloi-legal-header">
          <Link href="/" className="selloi-legal-logo">
            <Image
              src="/figma/selloi-logo.png"
              alt="Selloi"
              width={34}
              height={34}
              priority
            />
            <span>Selloi</span>
          </Link>

          <Link href="/" className="selloi-legal-back-btn">
            <ArrowLeft size={16} />
            <span>Bosh sahifaga qaytish</span>
          </Link>
        </header>

        {/* Title Header */}
        <div className="selloi-legal-title-block">
          <div className="selloi-legal-badge">
            <FileText size={13} />
            <span>Huquqiy kelishuv</span>
          </div>
          <h1 className="selloi-legal-title">Foydalanish shartlari / Terms of Service</h1>
          <p className="selloi-legal-subtitle">
            Selloi (selloi.uz) xizmatlaridan foydalanish shartlari, huquq va majburiyatlar bo'yicha ommaviy oferta.
          </p>
          <div className="selloi-legal-meta">
            <span>
              <Calendar size={14} /> Oxirgi yangilanish: 2026-yil 21-noyabr
            </span>
            <span>
              <Globe size={14} /> Manzil: selloi.uz
            </span>
          </div>
        </div>

        {/* Main Document Content */}
        <article className="selloi-legal-card">
          {/* Section 1 */}
          <section className="selloi-legal-section">
            <h2>1. Shartlarning qabul qilinishi (Acceptance of Terms)</h2>
            <p>
              Ushbu Foydalanish shartlari (keyingi o'rinlarda "Shartlar") <strong>Selloi</strong> (keyingi o'rinlarda "Selloi", "Biz" yoki "Platforma") veb-sayti (<strong>https://selloi.uz</strong>) va uning dasturiy ta'minotidan foydalanish qoidalarini belgilaydi.
            </p>
            <p>
              Platformada ro'yxatdan o'tish, tizimga kirish (jumladan, Google yoki Telegram orqali) yoki xizmatlardan foydalanish orqali siz ushbu Shartlarga to'liq va so'zsiz rozilik bildirasiz. Agar siz ushbu shartlarga rozi bo'lmasangiz, xizmatlardan foydalanmasligingiz lozim.
            </p>
          </section>

          {/* Section 2 */}
          <section className="selloi-legal-section">
            <h2>2. Xizmat tavsifi (Description of Service)</h2>
            <p>
              Selloi — Telegram messenjeridagi savdo do'konlari, kanallari va guruhlari uchun sun'iy intellektga asoslangan virtual sotuvchi va savdoni avtomatlashtirish platformasidir. Xizmat quyidagi imkoniyatlarni taqdim etadi:
            </p>
            <ul>
              <li>Mijozlarning savollariga o'zbek, rus va ingliz tillarida 24/7 rejimida tezkor javob berish;</li>
              <li>Fotosuratdagi tovarlarni aniqlash (Vision AI) va ombor bazasidan mos mahsulotlarni topish;</li>
              <li>Buyurtmalarni shakllantirish, mijoz ma'lumotlarini to'plash va do'kon boshqaruv paneliga uzatish;</li>
              <li>Do'kon tahlili, muloqotlar tarixi va sotuv statistikasini yuritish.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="selloi-legal-section">
            <h2>3. Akkaunt xavfsizligi va majburiyatlar (User Accounts)</h2>
            <p>
              Xizmatlardan to'liq foydalanish uchun foydalanuvchi akkaunt yaratishi talab etiladi. Siz quyidagilarga rozilik bildirasiz:
            </p>
            <ul>
              <li>Ro'yxatdan o'tish paytida aniq, to'g'ri va dolzarb ma'lumotlarni taqdim etish;</li>
              <li>O'z hisobingiz paroli va ulanish kalitlarining maxfiyligini saqlash;</li>
              <li>Hisobingiz orqali amalga oshirilgan barcha harakatlar uchun to'liq javobgar bo'lish;</li>
              <li>Hisobingizga ruxsatsiz kirish holatlari aniqlanganda darhol <a href="mailto:support@selloi.uz">support@selloi.uz</a> ga xabar berish.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="selloi-legal-section">
            <h2>4. Qonuniy foydalanish qoidalari (Acceptable Use Policy)</h2>
            <p>Foydalanuvchilarga quyidagi harakatlar qat'iyan taqiqlanadi:</p>
            <ul>
              <li>O'zbekiston Respublikasi va xalqaro qonunchilikka zid bo'lgan tovarlar yoki xizmatlarni (noqonuniy moddalar, qurol, qalbaki mahsulotlar va h.k.) sotish uchun platformadan foydalanish;</li>
              <li>Platforma orqali spamm, firibgarlik yoki zararli dasturlarni tarqatish;</li>
              <li>Selloi serverlari, xavfsizlik tizimi yoki API infratuzilmasiga ruxsatsiz aralashish yoki yuklama berish;</li>
              <li>Uchinchi shaxslarning mualliflik yoki shaxsiy huquqlarini buzish.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="selloi-legal-section">
            <h2>5. To'lovlar va obuna shartlari (Pricing & Subscriptions)</h2>
            <p>
              Selloi platformasida yangi foydalanuvchilar uchun <strong>7 kunlik bepul sinov muddati</strong> mavjud. Sinov muddatidan so'ng, xizmatlardan foydalanish tanlangan tarif rejasi (Start, Standart, Pro, Ultra) asosida oylik obuna to'lovi bilan amalga oshiriladi.
            </p>
            <p>
              To'lovlar O'zbekiston to'lov tizimlari orqali xavfsiz qabul qilinadi. Obuna bekor qilinganda, foydalanuvchi joriy to'langan davr oxirigacha xizmatlardan foydalanish huquqiga ega bo'ladi.
            </p>
          </section>

          {/* Section 6 */}
          <section className="selloi-legal-section">
            <h2>6. Intellektual mulk (Intellectual Property)</h2>
            <p>
              Selloi veb-sayti, dasturiy kodi, logotiplari, dizayn elementlari va sun'iy intellekt algoritmlari Selloi'ning mutlaq mulki hisoblanadi. Foydalanuvchilar o'z do'koni tovarlari, logotiplari va matnlari bo'yicha to'liq intellektual mulk huquqlarini o'zlarida saqlab qoladilar.
            </p>
          </section>

          {/* Section 7 */}
          <section className="selloi-legal-section">
            <h2>7. Mas'uliyatning cheklanishi (Limitation of Liability)</h2>
            <p>
              Selloi xizmatlari "boricha" (as is) tamoyili asosida taqdim etiladi. Biz uchinchi tomon xizmatlari (Telegram API, to'lov tizimlari, internet provayderlari) faoliyatidagi uzilishlar yoki fors-major holatlari sababli yuzaga kelgan bevosita yoki bilvosita zararlar uchun javobgarlikni o'z zimmamizga olmaymiz.
            </p>
          </section>

          {/* Section 8 */}
          <section className="selloi-legal-section">
            <h2>8. Bog'lanish (Contact Us)</h2>
            <p>
              Ushbu Foydalanish shartlari bo'yicha savollaringiz bo'lsa, rasmiy elektron pochtamiz orqali bog'lanishingiz mumkin:
            </p>
            <div className="selloi-contact-box">
              <div className="selloi-contact-item">
                <Mail size={16} color="#FF4C63" />
                <span>
                  Elektron pochta: <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                </span>
              </div>
              <div className="selloi-contact-item">
                <Globe size={16} color="#FF4C63" />
                <span>
                  Veb-sayt: <a href="https://selloi.uz">https://selloi.uz</a>
                </span>
              </div>
            </div>
          </section>
        </article>

        {/* Footer */}
        <footer className="selloi-legal-footer">
          <div>© Selloi. Barcha huquqlar himoyalangan.</div>
          <div className="selloi-legal-footer-links">
            <Link href="/terms">Foydalanish shartlari</Link>
            <Link href="/privacy">Maxfiylik siyosati</Link>
            <Link href="/login">Kirish</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
