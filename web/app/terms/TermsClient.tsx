"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, FileText, Globe, Mail, ShieldCheck } from "lucide-react";
import "../privacy/legal.css";

type LegalLang = "uz" | "en" | "ru";

export default function TermsClient() {
  const [lang, setLang] = useState<LegalLang>("uz");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qLang = params.get("lang");
      if (qLang === "en" || qLang === "ru" || qLang === "uz") {
        setLang(qLang);
      } else {
        const saved = localStorage.getItem("ai_sales_language") as LegalLang;
        if (saved === "en" || saved === "ru" || saved === "uz") {
          setLang(saved);
        }
      }
    }
  }, []);

  const changeLang = (newLang: LegalLang) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", newLang);
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="selloi-legal-wrapper">
      {/* Dedicated Glow Container preventing horizontal overflow & dual scrollbars */}
      <div className="selloi-legal-glow-container">
        <div className="selloi-legal-glow-top" />
        <div className="selloi-legal-glow-bottom" />
      </div>

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

          <div className="selloi-legal-actions">
            {/* Language Switcher */}
            <div className="selloi-legal-lang-switch">
              <button
                type="button"
                className={`selloi-legal-lang-btn ${lang === "uz" ? "active" : ""}`}
                onClick={() => changeLang("uz")}
              >
                O‘zbekcha
              </button>
              <button
                type="button"
                className={`selloi-legal-lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => changeLang("en")}
              >
                English
              </button>
              <button
                type="button"
                className={`selloi-legal-lang-btn ${lang === "ru" ? "active" : ""}`}
                onClick={() => changeLang("ru")}
              >
                Русский
              </button>
            </div>

            <Link href="/" className="selloi-legal-back-btn">
              <ArrowLeft size={16} />
              <span>
                {lang === "en"
                  ? "Back to Home"
                  : lang === "ru"
                  ? "На главную"
                  : "Bosh sahifaga qaytish"}
              </span>
            </Link>
          </div>
        </header>

        {/* Title Header */}
        <div className="selloi-legal-title-block">
          <div className="selloi-legal-badge">
            <FileText size={13} />
            <span>
              {lang === "en"
                ? "Legal Agreement"
                : lang === "ru"
                ? "Юридическое соглашение"
                : "Huquqiy kelishuv"}
            </span>
          </div>
          <h1 className="selloi-legal-title">
            {lang === "en"
              ? "Terms of Service"
              : lang === "ru"
              ? "Условия использования"
              : "Foydalanish shartlari"}
          </h1>
          <p className="selloi-legal-subtitle">
            {lang === "en"
              ? "Official terms of service and public offering for Selloi (selloi.uz) AI sales automation platform."
              : lang === "ru"
              ? "Официальные условия использования и публичная оферта платформы Selloi (selloi.uz)."
              : "Selloi (selloi.uz) xizmatlaridan foydalanish shartlari, huquq va majburiyatlar bo'yicha ommaviy oferta."}
          </p>
          <div className="selloi-legal-meta">
            <span>
              <Calendar size={14} />{" "}
              {lang === "en"
                ? "Last Updated: November 21, 2026"
                : lang === "ru"
                ? "Обновлено: 21 ноября 2026 г."
                : "Oxirgi yangilanish: 2026-yil 21-noyabr"}
            </span>
            <span>
              <Globe size={14} /> Manzil: https://selloi.uz
            </span>
          </div>
        </div>

        {/* =========================================================================
            UZBEK VERSION
           ========================================================================= */}
        {lang === "uz" && (
          <article className="selloi-legal-card">
            <section className="selloi-legal-section">
              <h2>1. Shartlarning qabul qilinishi (Acceptance of Terms)</h2>
              <p>
                Ushbu Foydalanish shartlari (keyingi o'rinlarda "Shartlar") <strong>Selloi</strong> (keyingi o'rinlarda "Selloi", "Biz" yoki "Platforma") veb-sayti (<strong>https://selloi.uz</strong>) va uning dasturiy ta'minotidan foydalanish qoidalarini belgilaydi.
              </p>
              <p>
                Platformada ro'yxatdan o'tish, tizimga kirish (jumladan, Google yoki Telegram orqali) yoki xizmatlardan foydalanish orqali siz ushbu Shartlarga to'liq va so'zsiz rozilik bildirasiz. Agar siz ushbu shartlarga rozi bo'lmasangiz, xizmatlardan foydalanmasligingiz lozim.
              </p>
            </section>

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

            <section className="selloi-legal-section">
              <h2>4. Taqiqlangan harakatlar (Prohibited Use)</h2>
              <p>Platformadan foydalanishda quyidagilar qat'iyan taqiqlanadi:</p>
              <ul>
                <li>O'zbekiston Respublikasi va xalqaro qonunchilikka zid tovarlar yoki xizmatlarni sotish;</li>
                <li>Taqiqlangan, noqonuniy yoki axloqqa zid kontentni tarqatish;</li>
                <li>Server tizimlariga noqonuniy kirishga urinish, xakerlik yoki DoS/DDoS hujumlarini uyushtirish;</li>
                <li>Boshqa shaxslar yoki do'konlar nomidan soxta profillar yaratish.</li>
              </ul>
            </section>

            <section className="selloi-legal-section">
              <h2>5. Obuna va to'lovlar (Subscription & Billing)</h2>
              <p>
                Selloi xizmatlari 7 kunlik imtiyozli sinov davri (Trial) va doimiy oylik/yillik tarif rejalari asosida taqdim etiladi:
              </p>
              <ul>
                <li>Yangi foydalanuvchilarga 7 kunlik imtiyozli sinov davri taqdim etiladi;</li>
                <li>Pullik tariflar oylik yoki yillik obuna asosida faollashtiriladi;</li>
                <li>To'lovlar Payme, Click yoki rasmiy bank kartalari orqali xavfsiz qabul qilinadi;</li>
                <li>Obunani istalgan vaqtda shaxsiy kabinet orqali bekor qilish mumkin.</li>
              </ul>
            </section>

            <section className="selloi-legal-section">
              <h2>6. Javobgarlikni cheklash (Limitation of Liability)</h2>
              <p>
                Selloi platformasi "xuddi shunday" ("as is") asosida taqdim etiladi. Biz platformaning uzluksiz yoki xatolarsiz ishlashiga mutlaq kafolat bermaymiz.
              </p>
              <p>
                Selloi uchinchi tomon xizmatlari (Telegram API, to'lov tizimlari yoki telekommunikatsiya provayderlari) faoliyatidagi uzilishlar tufayli yuzaga kelgan zararlar uchun javobgar bo'lmaydi.
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>7. Aloqa</h2>
              <div className="selloi-contact-box">
                <div className="selloi-contact-item">
                  <Mail size={16} color="#FF4C63" />
                  <span>
                    Yuridik va texnik qo'llab-quvvatlash: <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                  </span>
                </div>
                <div className="selloi-contact-item">
                  <Globe size={16} color="#FF4C63" />
                  <span>
                    Rasmiy veb-sayt: <a href="https://selloi.uz">https://selloi.uz</a>
                  </span>
                </div>
              </div>
            </section>
          </article>
        )}

        {/* =========================================================================
            ENGLISH VERSION
           ========================================================================= */}
        {lang === "en" && (
          <article className="selloi-legal-card">
            <section className="selloi-legal-section">
              <h2>1. Acceptance of Terms</h2>
              <p>
                These Terms of Service ("Terms") constitute a legally binding agreement between you ("User" or "You") and <strong>Selloi</strong> ("Selloi", "We", or "Platform"), governing your access to and use of <strong>https://selloi.uz</strong> and related AI sales automation services.
              </p>
              <p>
                By registering an account, authenticating via Google OAuth 2.0 or Telegram, or accessing our services, you expressly agree to be bound by these Terms. If you do not agree, you must immediately discontinue use of the Platform.
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>2. Description of Service</h2>
              <p>
                Selloi provides an intelligent AI-powered sales assistant and customer support automation engine for Telegram storefronts, groups, and channels. Core functionalities include:
              </p>
              <ul>
                <li>Automated 24/7 conversational customer interactions in Uzbek, Russian, and English;</li>
                <li>Computer vision recognition of merchandise photographs and product catalog matching;</li>
                <li>Automated checkout processing, customer data capture, and merchant dispatch;</li>
                <li>Real-time dashboard analytics, customer interaction histories, and sales reports.</li>
              </ul>
            </section>

            <section className="selloi-legal-section">
              <h2>3. User Account Security & Responsibilities</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials, Telegram bot tokens, and session secrets. You agree to immediately notify Selloi at <a href="mailto:support@selloi.uz">support@selloi.uz</a> of any unauthorized access or security breaches.
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>4. Prohibited Uses</h2>
              <p>Users may not utilize Selloi to:</p>
              <ul>
                <li>Distribute unlawful, counterfeit, or prohibited merchandise;</li>
                <li>Disseminate malicious software, conduct unauthorized penetration tests, or launch DoS/DDoS attacks;</li>
                <li>Impersonate legal entities or mislead consumers;</li>
                <li>Violate Telegram's Terms of Service or local laws of the Republic of Uzbekistan.</li>
              </ul>
            </section>

            <section className="selloi-legal-section">
              <h2>5. Billing, Subscriptions & Cancellations</h2>
              <p>
                Selloi operates on a SaaS recurring subscription model with tiered service quotas. Users may evaluate the service under a 7-day introductory promotional period (Mega Discount). Subscriptions can be managed and cancelled at any time directly through the merchant billing portal.
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>6. Limitation of Liability</h2>
              <p>
                The Platform is provided on an "AS IS" and "AS AVAILABLE" basis. To the maximum extent permitted by applicable law, Selloi disclaims all warranties, express or implied, including merchantability or fitness for a particular purpose. Selloi shall not be liable for indirect, incidental, or consequential damages resulting from downtime of third-party platforms such as Telegram or payment gateways.
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>7. Contact Information</h2>
              <div className="selloi-contact-box">
                <div className="selloi-contact-item">
                  <Mail size={16} color="#FF4C63" />
                  <span>
                    Legal & Support Inquiries: <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                  </span>
                </div>
                <div className="selloi-contact-item">
                  <Globe size={16} color="#FF4C63" />
                  <span>
                    Official Website: <a href="https://selloi.uz">https://selloi.uz</a>
                  </span>
                </div>
              </div>
            </section>
          </article>
        )}

        {/* =========================================================================
            RUSSIAN VERSION
           ========================================================================= */}
        {lang === "ru" && (
          <article className="selloi-legal-card">
            <section className="selloi-legal-section">
              <h2>1. Принятие условий</h2>
              <p>
                Настоящие Условия использования ("Условия") регулируют отношения между пользователем ("Вы") и платформой <strong>Selloi</strong> ("Мы", "Платформа") на сайте <strong>https://selloi.uz</strong>.
              </p>
              <p>
                Регистрируясь или используя сервисы Selloi (включая авторизацию через Google или Telegram), вы подтверждаете полное согласие с данными Условиями.
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>2. Описание сервиса</h2>
              <p>
                Selloi — это платформа автоматизации продаж и виртуальный консультант на базе ИИ для магазинов в Telegram:
              </p>
              <ul>
                <li>Круглосуточные консультации покупателей на узбекском, русском и английском языках;</li>
                <li>Распознавание товаров по фото (Computer Vision) и поиск по каталогу;</li>
                <li>Оформление заказов и передача данных в панель управления;</li>
                <li>Аналитика диалогов, конверсий и учет продаж.</li>
              </ul>
            </section>

            <section className="selloi-legal-section">
              <h2>3. Безопасность учетной записи</h2>
              <p>
                Пользователь несет полную ответственность за сохранность учетных данных и токенов ботов. При обнаружении несанкционированного доступа необходимо немедленно сообщить по адресу <a href="mailto:support@selloi.uz">support@selloi.uz</a>.
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>4. Запрещенная деятельность</h2>
              <p>Запрещается использовать платформу для продажи запрещенных законом товаров, спама, атак на инфраструктуру или нарушения правил Telegram.</p>
            </section>

            <section className="selloi-legal-section">
              <h2>5. Подписка и оплата</h2>
              <p>Сервис предоставляется по модели подписки с бесплатным пробным периодом. Управление тарифами доступно в личном кабинете.</p>
            </section>

            <section className="selloi-legal-section">
              <h2>6. Ограничение ответственности</h2>
              <p>
                Платформа предоставляется "как есть". Selloi не несет ответственности за перебои в работе сторонних сервисов (Telegram, платежные системы).
              </p>
            </section>

            <section className="selloi-legal-section">
              <h2>7. Контакты</h2>
              <div className="selloi-contact-box">
                <div className="selloi-contact-item">
                  <Mail size={16} color="#FF4C63" />
                  <span>
                    Поддержка: <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                  </span>
                </div>
                <div className="selloi-contact-item">
                  <Globe size={16} color="#FF4C63" />
                  <span>
                    Официальный сайт: <a href="https://selloi.uz">https://selloi.uz</a>
                  </span>
                </div>
              </div>
            </section>
          </article>
        )}

        {/* Footer */}
        <footer className="selloi-legal-footer">
          <div>© Selloi. All rights reserved. Barcha huquqlar himoyalangan.</div>
          <div className="selloi-legal-footer-links">
            <Link href="/terms">
              {lang === "en" ? "Terms of Service" : lang === "ru" ? "Условия сервиса" : "Foydalanish shartlari"}
            </Link>
            <Link href="/privacy">
              {lang === "en" ? "Privacy Policy" : lang === "ru" ? "Конфиденциальность" : "Maxfiylik siyosati"}
            </Link>
            <Link href="/login">
              {lang === "en" ? "Sign In" : lang === "ru" ? "Войти" : "Kirish"}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
