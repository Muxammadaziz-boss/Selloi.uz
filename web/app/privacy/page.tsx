"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Shield,
  Lock,
  Trash2,
  Globe,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import "./legal.css";

type LegalLang = "uz" | "en" | "ru";

export default function PrivacyPolicyPage() {
  const [lang, setLang] = useState<LegalLang>("uz");

  useEffect(() => {
    // Check URL search params (e.g. /privacy?lang=en)
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

        {/* Global Google Compliance Card (Visible in all languages for Trust & Safety verification) */}
        <div className="selloi-compliance-card">
          <div className="selloi-compliance-header">
            <div className="selloi-compliance-icon">
              <Shield size={20} />
            </div>
            <h3 className="selloi-compliance-title">
              Google API Services User Data Policy & Limited Use Disclosure
            </h3>
          </div>
          <p className="selloi-compliance-text">
            Selloi (selloi.uz) platformasi va ilovasi Google OAuth 2.0 orqali olingan foydalanuvchi ma'lumotlariga nisbatan Google siyosatlariga qat'iy amal qiladi:
          </p>
          <div className="selloi-compliance-quote">
            "Selloi's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
            <strong>Google API Services User Data Policy</strong>, including the <strong>Limited Use requirements</strong>."
          </div>
          <p className="selloi-compliance-text" style={{ margin: 0 }}>
            Google user data (User ID, email, name, avatar) is used exclusively for secure sign-in and user identification. It is never sold, never shared with third parties, never used for advertising, and never used to train general artificial intelligence models.
          </p>
        </div>

        {/* =========================================================================
            UZBEK VERSION
           ========================================================================= */}
        {lang === "uz" && (
          <>
            <div className="selloi-legal-title-block">
              <div className="selloi-legal-badge">
                <Shield size={13} />
                <span>Rasmiy hujjat</span>
              </div>
              <h1 className="selloi-legal-title">Maxfiylik siyosati (Privacy Policy)</h1>
              <p className="selloi-legal-subtitle">
                Selloi (selloi.uz) platformasida shaxsiy ma'lumotlarni yig'ish, saqlash, qayta ishlash va himoya qilish bo'yicha rasmiy qoidalar.
              </p>
              <div className="selloi-legal-meta">
                <span>
                  <Calendar size={14} /> Oxirgi yangilanish: 2026-yil 21-noyabr
                </span>
                <span>
                  <Globe size={14} /> Rasmiy manzil: https://selloi.uz
                </span>
              </div>
            </div>

            <article className="selloi-legal-card">
              <section className="selloi-legal-section">
                <h2>1. Umumiy qoidalar</h2>
                <p>
                  Ushbu Maxfiylik siyosati (keyingi o'rinlarda "Siyosat") <strong>Selloi</strong> (keyingi o'rinlarda "Selloi", "Biz" yoki "Platforma") rasmiy veb-sayti (<strong>https://selloi.uz</strong>) va unga bog'liq barcha xizmatlardan foydalanish jarayonida foydalanuvchilarning shaxsiy ma'lumotlarini qanday to'plashimiz, saqlashimiz va himoya qilishimizni belgilaydi.
                </p>
                <p>
                  Selloi xizmatlaridan foydalanish yoki ro'yxatdan o'tish orqali siz ushbu Maxfiylik siyosati shartlariga to'liq rozilik bildirasiz.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>2. Biz to'playdigan ma'lumotlar</h2>
                <p>Platformadan foydalanish jarayonida quyidagi toifadagi ma'lumotlar to'planishi mumkin:</p>
                <ul>
                  <li>
                    <strong>Google OAuth hisobi orqali kirilganda:</strong> Google identifikatori (User ID), to'liq ism (Full Name), elektron pochta manzili (Email) va profil fotosurati (Avatar URL).
                  </li>
                  <li>
                    <strong>Ro'yxatdan o'tish ma'lumotlari:</strong> Foydalanuvchi nomi, elektron pochta manzili, xesh-shifrlangan parol (bcrypt).
                  </li>
                  <li>
                    <strong>Telegram do'kon ma'lumotlari:</strong> Telegram Bot tokeni, kanal va guruh identifikatorlari, do'kon tovarlari katalogi, narxlar va tavsiflar.
                  </li>
                  <li>
                    <strong>Mijozlar buyurtmalari:</strong> Xaridorlar tomonidan Telegram orqali yuborilgan buyurtma ma'lumotlari (telefon raqami, yetkazib berish manzili, tanlangan mahsulotlar).
                  </li>
                  <li>
                    <strong>Texnik va tizim jurnallari:</strong> IP-manzil, brauzer turi, qurilma parametrlari, tizimga kirish vaqti va xavfsizlik jurnallari.
                  </li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>3. Google OAuth 2.0 ma'lumotlari va ulardan foydalanish</h2>
                <p>
                  Selloi faqat hisobga xavfsiz kirishni ta'minlash uchun Google OAuth 2.0 autentifikatsiyasidan foydalanadi. Biz faqat eng zarur ruxsatlar (scopes) doirasida ma'lumot olamiz:
                </p>
                <table className="selloi-legal-table">
                  <thead>
                    <tr>
                      <th>Scope</th>
                      <th>Ma'lumot turi</th>
                      <th>Foydalanish maqsadi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>openid</code></td>
                      <td>Yagona Google ID</td>
                      <td>Foydalanuvchini platformada xavfsiz identifikatsiya qilish</td>
                    </tr>
                    <tr>
                      <td><code>email</code></td>
                      <td>Elektron pochta</td>
                      <td>Hisobga kirish, xavfsizlik xabarlari va hisob-faktura yuborish</td>
                    </tr>
                    <tr>
                      <td><code>profile</code></td>
                      <td>Ism va profil rasmi</td>
                      <td>Shaxsiy boshqaruv panelida foydalanuvchi profilini ko'rsatish</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Biz Google hisobingizdagi xatlar (Gmail), fayllar (Google Drive), kontaktlar (Contacts) yoki boshqa nozik shaxsiy ma'lumotlaringizga mutlaqo kirmaymiz va ularni talab qilmaymiz.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>4. Ma'lumotlardan foydalanish maqsadlari</h2>
                <p>To'plangan ma'lumotlar faqat quyidagi aniq maqsadlar uchun ishlatiladi:</p>
                <ul>
                  <li>Platformada foydalanuvchi hisobini ochish va xavfsiz autentifikatsiya qilish;</li>
                  <li>Telegram do'koningiz uchun sun'iy intellekt sotuvchi yordamchisi xizmatini taqdim etish;</li>
                  <li>Mijozlar bilan savdo muloqotlarini avtomatlashtirish va buyurtmalarni boshqarish panelida aks ettirish;</li>
                  <li>Texnik nosozliklarni aniqlash, server xavfsizligini monitoring qilish va firibgarlikning oldini olish;</li>
                  <li>Xizmat sifati, yangi funksiyalar va to'lovlar bo'yicha muhim xabarlarni yetkazish.</li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>5. Ma'lumotlarni uchinchi tomonlarga bermaslik</h2>
                <p>Selloi foydalanuvchilarning shaxsiy ma'lumotlarini qat'iy himoya qiladi:</p>
                <ul>
                  <li>
                    <strong>Sotilmaydi va ijaraga berilmaydi:</strong> Biz hech qachon shaxsiy ma'lumotlarni, jumladan Google foydalanuvchi ma'lumotlarini marketing yoki reklama kompaniyalariga sotmaymiz va bermaymiz.
                  </li>
                  <li>
                    <strong>AI model o'qitishda cheklov:</strong> Shaxsiy ma'lumotlaringiz ommaviy yoki umumiy sun'iy intellekt modellarini o'rgatish uchun ishlatilmaydi.
                  </li>
                  <li>
                    <strong>Qonuniy talablar:</strong> Ma'lumotlar faqat amaldagi qonunchilik talab qilgan hollarda qonuniy sud qaroriga asosan taqdim etilishi mumkin.
                  </li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>6. Ma'lumotlar xavfsizligi va saqlanish muddati</h2>
                <p>
                  Foydalanuvchi ma'lumotlari xavfsizligini ta'minlash uchun Selloi quyidagi choralarni ko'radi:
                </p>
                <ul>
                  <li>Barcha veb-so'rovlar <strong>256-bitli SSL/TLS shifrlash</strong> protokoli (HTTPS) orqali amalga oshiriladi;</li>
                  <li>Parollar ochiq holda saqlanmaydi, faqat zamonaviy kriptografik xeshlar (bcrypt) bilan himoyalanadi;</li>
                  <li>Autentifikatsiya sessiyalari xavfsiz HttpOnly va Secure cookie fayllari orqali boshqariladi;</li>
                  <li>Server ma'lumotlar bazasi tashqi tarmoqdan yopiq holda saqlanadi.</li>
                </ul>
                <p>
                  Ma'lumotlar foydalanuvchi akkaunti faol bo'lgan davrda yoki xizmatlarni ko'rsatish uchun zarur bo'lgan muddat davomida saqlanadi.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>7. Foydalanuvchi huquqlari va ma'lumotlarni o'chirish (Data Deletion)</h2>
                <p>Foydalanuvchi o'z ma'lumotlariga nisbatan quyidagi to'liq huquqlarga ega:</p>
                <ul>
                  <li>O'z shaxsiy ma'lumotlaridan nusxa olish va ular bilan tanishish;</li>
                  <li>Noto'g'ri yoki eskirgan ma'lumotlarni to'g'rilashni talab qilish;</li>
                  <li>
                    <strong>Ma'lumotlarni to'liq o'chirishni talab qilish (Right to be Forgotten):</strong> Istalgan vaqtda o'z hisobingizni va unga tegishli barcha Google OAuth va Telegram do'kon ma'lumotlarini o'chirishni so'rashingiz mumkin.
                  </li>
                </ul>
                <div className="selloi-contact-box">
                  <div className="selloi-contact-item">
                    <Trash2 size={16} color="#FF4C63" />
                    <span>
                      <strong>Ma'lumotlarni o'chirish so'rovi:</strong> Ma'lumotlaringizni to'liq o'chirish uchun{" "}
                      <a href="mailto:support@selloi.uz">support@selloi.uz</a> manziliga "Delete Account Data" mavzusi bilan xat yozing. So'rov 30 kun ichida to'liq ko'rib chiqiladi va barcha ma'lumotlar faol ma'lumotlar bazalarimizdan butunlay o'chirib tashlanadi.
                    </span>
                  </div>
                </div>
              </section>

              <section className="selloi-legal-section">
                <h2>8. Bog'lanish ma'lumotlari</h2>
                <p>
                  Ushbu Maxfiylik siyosati yoki shaxsiy ma'lumotlaringiz bo'yicha har qanday savol va murojaatlar uchun:
                </p>
                <div className="selloi-contact-box">
                  <div className="selloi-contact-item">
                    <Mail size={16} color="#FF4C63" />
                    <span>
                      Yordam va xavfsizlik: <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                    </span>
                  </div>
                  <div className="selloi-contact-item">
                    <Mail size={16} color="#FF4C63" />
                    <span>
                      Ma'muriyat: <a href="mailto:admin@selloi.uz">admin@selloi.uz</a>
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
          </>
        )}

        {/* =========================================================================
            ENGLISH VERSION (Full compliance for Google Trust & Safety Reviewers)
           ========================================================================= */}
        {lang === "en" && (
          <>
            <div className="selloi-legal-title-block">
              <div className="selloi-legal-badge">
                <Shield size={13} />
                <span>Official Legal Document</span>
              </div>
              <h1 className="selloi-legal-title">Privacy Policy & User Data Disclosure</h1>
              <p className="selloi-legal-subtitle">
                Official privacy guidelines detailing the collection, storage, processing, and protection of personal data on Selloi (selloi.uz).
              </p>
              <div className="selloi-legal-meta">
                <span>
                  <Calendar size={14} /> Effective Date: November 21, 2026
                </span>
                <span>
                  <Globe size={14} /> Official Domain: https://selloi.uz
                </span>
              </div>
            </div>

            <article className="selloi-legal-card">
              <section className="selloi-legal-section">
                <h2>1. Introduction & Overview</h2>
                <p>
                  This Privacy Policy governs the manner in which <strong>Selloi</strong> ("Selloi", "we", "our", or the "Platform"), accessible via <strong>https://selloi.uz</strong>, collects, uses, maintains, and protects information collected from users ("Users" or "You") of our AI-powered Telegram commerce and sales assistant platform.
                </p>
                <p>
                  By creating an account, authenticating via Google OAuth 2.0 or Telegram, or utilizing our services, you acknowledge and agree to the terms set forth in this Policy.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>2. Information We Collect</h2>
                <p>We collect only the information necessary to provide our services:</p>
                <ul>
                  <li>
                    <strong>Google Account Information (OAuth 2.0):</strong> Unique Google User ID, verified email address, full name, and avatar image URL.
                  </li>
                  <li>
                    <strong>Account Credentials:</strong> Username, email address, and strong cryptographically hashed passwords (bcrypt) for email-based accounts.
                  </li>
                  <li>
                    <strong>Telegram Commerce Data:</strong> Telegram Bot token provided by the store owner, channel and group IDs, product catalog details (titles, descriptions, pricing, inventory).
                  </li>
                  <li>
                    <strong>Customer Orders:</strong> Transactional orders submitted by shoppers through Telegram (buyer phone number, delivery address, ordered merchandise).
                  </li>
                  <li>
                    <strong>Technical & Audit Logs:</strong> IP addresses, browser specifications, operating system attributes, request timestamps, and security audit records.
                  </li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>3. Google User Data & OAuth Scopes</h2>
                <p>
                  Selloi integrates Google OAuth 2.0 strictly for federated identity verification and sign-in. We do not request any sensitive or restricted scopes. The specific scopes requested are:
                </p>
                <table className="selloi-legal-table">
                  <thead>
                    <tr>
                      <th>OAuth Scope</th>
                      <th>Data Category</th>
                      <th>Purpose & Justification</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>openid</code></td>
                      <td>Unique Google Subject ID</td>
                      <td>Secure user authentication and session management.</td>
                    </tr>
                    <tr>
                      <td><code>email</code></td>
                      <td>Verified Email Address</td>
                      <td>Account identification, passwordless login, and essential service notifications.</td>
                    </tr>
                    <tr>
                      <td><code>profile</code></td>
                      <td>Display Name & Photo URL</td>
                      <td>Rendering the user's name and avatar inside their private administration dashboard.</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  <strong>No Access to Restricted Scopes:</strong> We do not request, access, process, or store data from Gmail, Google Drive, Google Contacts, Google Calendar, or any other private Google service.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>4. Google API Services User Data Policy Compliance</h2>
                <p>
                  Selloi strictly adheres to Google's policies regarding user data:
                </p>
                <div className="selloi-compliance-quote">
                  "Selloi's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
                  <strong>Google API Services User Data Policy</strong>, including the <strong>Limited Use requirements</strong>."
                </div>
                <p>
                  Furthermore, Selloi commits to the following restrictions:
                </p>
                <ul>
                  <li>We do not transfer Google user data to third parties unless necessary to provide or improve user-facing features.</li>
                  <li>We do not use or transfer Google user data for serving advertisements, including personalized, re-targeted, or interest-based ads.</li>
                  <li>We do not allow humans to read user data unless we have obtained your affirmative agreement, it is necessary for security reasons, or required by law.</li>
                  <li>We do not use or transfer Google user data to train general-purpose machine learning or artificial intelligence models.</li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>5. Data Non-Disclosure & Sharing Restrictions</h2>
                <p>Selloi treats user information with strict confidentiality:</p>
                <ul>
                  <li>
                    <strong>No Commercial Selling:</strong> We never sell, trade, monetize, or lease personal or store information to data brokers or advertisers.
                  </li>
                  <li>
                    <strong>AI Model Integrity:</strong> Your proprietary store data and user conversations are never ingested into global public AI models.
                  </li>
                  <li>
                    <strong>Legal Requirements:</strong> We disclose data only when legally compelled by valid court orders or mandatory law enforcement proceedings.
                  </li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>6. Data Security & Retention</h2>
                <p>We maintain comprehensive security controls to safeguard your data:</p>
                <ul>
                  <li>All web traffic is encrypted end-to-end using <strong>256-bit TLS/SSL encryption (HTTPS)</strong>.</li>
                  <li>Passkeys and passwords are protected using industry-standard <strong>bcrypt hashing</strong>.</li>
                  <li>Authentication sessions utilize secure, HttpOnly, SameSite cookies to mitigate cross-site scripting (XSS) and forgery (CSRF).</li>
                  <li>Databases are hosted in isolated virtual networks with restricted administrative access.</li>
                </ul>
                <p>
                  Personal data is retained only for the duration that your account is active, or as required to fulfill contractual and operational obligations.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>7. User Rights & Complete Data Deletion (Right to be Forgotten)</h2>
                <p>You maintain full control over your personal data:</p>
                <ul>
                  <li>You have the right to inspect, export, or correct your personal information at any time.</li>
                  <li>
                    <strong>Right to Erasure / Account Deletion:</strong> You may permanently terminate your account and request complete eradication of all associated Google OAuth data and Telegram commerce data.
                  </li>
                </ul>
                <div className="selloi-contact-box">
                  <div className="selloi-contact-item">
                    <Trash2 size={16} color="#FF4C63" />
                    <span>
                      <strong>How to Request Data Deletion:</strong> Submit an email to{" "}
                      <a href="mailto:support@selloi.uz">support@selloi.uz</a> with the subject line <code>Delete Account Data</code> from your registered email address. Your request will be fulfilled within thirty (30) calendar days, and all personal records will be permanently purged from active servers and backups.
                    </span>
                  </div>
                </div>
              </section>

              <section className="selloi-legal-section">
                <h2>8. Official Contact & Regulatory Authority</h2>
                <p>
                  For any legal, privacy, or data protection inquiries, please contact:
                </p>
                <div className="selloi-contact-box">
                  <div className="selloi-contact-item">
                    <Mail size={16} color="#FF4C63" />
                    <span>
                      Security & Privacy Support: <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                    </span>
                  </div>
                  <div className="selloi-contact-item">
                    <Mail size={16} color="#FF4C63" />
                    <span>
                      Administration: <a href="mailto:admin@selloi.uz">admin@selloi.uz</a>
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
          </>
        )}

        {/* =========================================================================
            RUSSIAN VERSION
           ========================================================================= */}
        {lang === "ru" && (
          <>
            <div className="selloi-legal-title-block">
              <div className="selloi-legal-badge">
                <Shield size={13} />
                <span>Официальный документ</span>
              </div>
              <h1 className="selloi-legal-title">Политика конфиденциальности (Privacy Policy)</h1>
              <p className="selloi-legal-subtitle">
                Официальные правила сбора, хранения, обработки и защиты персональных данных на платформе Selloi (selloi.uz).
              </p>
              <div className="selloi-legal-meta">
                <span>
                  <Calendar size={14} /> Дата обновления: 21 ноября 2026 г.
                </span>
                <span>
                  <Globe size={14} /> Официальный сайт: https://selloi.uz
                </span>
              </div>
            </div>

            <article className="selloi-legal-card">
              <section className="selloi-legal-section">
                <h2>1. Общие положения</h2>
                <p>
                  Настоящая Политика конфиденциальности (далее "Политика") устанавливает порядок сбора, обработки, хранения и защиты персональных данных пользователей платформы <strong>Selloi</strong> (далее "Selloi", "Мы" или "Платформа") на веб-сайте <strong>https://selloi.uz</strong>.
                </p>
                <p>
                  Используя сервисы Selloi или авторизуясь на платформе, вы подтверждаете свое полное согласие с условиями настоящей Политики.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>2. Собираемая информация</h2>
                <p>Мы собираем исключительно те данные, которые необходимы для предоставления услуг:</p>
                <ul>
                  <li>
                    <strong>Данные аккаунта Google (OAuth 2.0):</strong> Идентификатор Google User ID, подтвержденный адрес электронной почты, имя и фото профиля (аватар).
                  </li>
                  <li>
                    <strong>Учетные данные:</strong> Имя пользователя, адрес электронной почты, криптографически захешированный пароль (bcrypt).
                  </li>
                  <li>
                    <strong>Данные магазина Telegram:</strong> Токен Telegram-бота, идентификаторы каналов и групп, каталог товаров (наименования, цены, описания).
                  </li>
                  <li>
                    <strong>Заказы покупателей:</strong> Данные заказов, поступивших через Telegram (телефон клиента, адрес доставки, состав заказа).
                  </li>
                  <li>
                    <strong>Технические логи:</strong> IP-адрес, тип браузера, характеристики устройства, время доступа и журналы безопасности.
                  </li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>3. Данные Google OAuth и их использование</h2>
                <p>
                  Selloi использует Google OAuth 2.0 исключительно для надежной аутентификации пользователя. Запрашиваются только минимально необходимые разрешения:
                </p>
                <table className="selloi-legal-table">
                  <thead>
                    <tr>
                      <th>Разрешение (Scope)</th>
                      <th>Тип данных</th>
                      <th>Цель использования</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><code>openid</code></td>
                      <td>Google ID</td>
                      <td>Надежная идентификация пользователя в системе.</td>
                    </tr>
                    <tr>
                      <td><code>email</code></td>
                      <td>Электронная почта</td>
                      <td>Вход в аккаунт, безопасность и сервисные уведомления.</td>
                    </tr>
                    <tr>
                      <td><code>profile</code></td>
                      <td>Имя и аватар</td>
                      <td>Отображение профиля пользователя в панели управления.</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Мы не запрашиваем и не имеем доступа к вашей почте (Gmail), файлам (Google Drive), контактам или другим конфиденциальным сервисам Google.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>4. Соблюдение Google API Services User Data Policy</h2>
                <p>
                  Selloi строго соблюдает правила Google в отношении данных пользователей:
                </p>
                <div className="selloi-compliance-quote">
                  "Selloi's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
                  <strong>Google API Services User Data Policy</strong>, including the <strong>Limited Use requirements</strong>."
                </div>
                <p>
                  Данные пользователей Google никогда не продаются третьим лицам, не используются для показа рекламы и не передаются для обучения публичных моделей искусственного интеллекта.
                </p>
              </section>

              <section className="selloi-legal-section">
                <h2>5. Неразглашение и защита данных</h2>
                <ul>
                  <li><strong>Без продажи:</strong> Мы никогда не продаем и не сдаем в аренду персональные данные рекламным брокерам.</li>
                  <li><strong>Ограничение для ИИ:</strong> Данные пользователей не используются для обучения публичных моделей искусственного интеллекта.</li>
                  <li><strong>Законные требования:</strong> Данные могут быть раскрыты исключительно по законному судебному требованию.</li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>6. Безопасность и хранение данных</h2>
                <ul>
                  <li>Шифрование всех соединений по протоколу <strong>256-bit SSL/TLS (HTTPS)</strong>.</li>
                  <li>Хеширование паролей с использованием <strong>bcrypt</strong>.</li>
                  <li>Защищенные сессии с атрибутами HttpOnly и Secure для файлов cookie.</li>
                  <li>Хранение баз данных в изолированной внутренней сети.</li>
                </ul>
              </section>

              <section className="selloi-legal-section">
                <h2>7. Права пользователя и полное удаление данных</h2>
                <p>Пользователь имеет право в любой момент запросить полное удаление аккаунта и всех персональных данных:</p>
                <div className="selloi-contact-box">
                  <div className="selloi-contact-item">
                    <Trash2 size={16} color="#FF4C63" />
                    <span>
                      <strong>Запрос на удаление данных:</strong> Направьте запрос на адрес{" "}
                      <a href="mailto:support@selloi.uz">support@selloi.uz</a> с темой "Delete Account Data". В течение 30 календарных дней аккаунт и все связанные с ним данные Google OAuth и Telegram будут безвозвратно удалены из всех активных баз данных и резервных копий.
                    </span>
                  </div>
                </div>
              </section>

              <section className="selloi-legal-section">
                <h2>8. Контактная информация</h2>
                <div className="selloi-contact-box">
                  <div className="selloi-contact-item">
                    <Mail size={16} color="#FF4C63" />
                    <span>
                      Служба поддержки и безопасности: <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                    </span>
                  </div>
                  <div className="selloi-contact-item">
                    <Mail size={16} color="#FF4C63" />
                    <span>
                      Администрация: <a href="mailto:admin@selloi.uz">admin@selloi.uz</a>
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
          </>
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
