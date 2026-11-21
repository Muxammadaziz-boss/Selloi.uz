import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, Mail, Shield, CheckCircle2, Lock, Trash2, Globe } from "lucide-react";
import "./legal.css";

export const metadata: Metadata = {
  title: "Maxfiylik siyosati (Privacy Policy) | Selloi",
  description:
    "Selloi.uz platformasining shaxsiy ma'lumotlarni yig'ish, qayta ishlash va himoya qilish bo'yicha rasmiy maxfiylik siyosati. Google API Services User Data Policy talablariga to'liq muvofiq.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
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
            <Shield size={13} />
            <span>Rasmiy hujjat</span>
          </div>
          <h1 className="selloi-legal-title">Maxfiylik siyosati / Privacy Policy</h1>
          <p className="selloi-legal-subtitle">
            Selloi (selloi.uz) platformasida shaxsiy ma'lumotlarni yig'ish, saqlash, qayta ishlash va himoya qilish qoidalari.
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

        {/* Google API Compliance Card */}
        <div className="selloi-compliance-card">
          <div className="selloi-compliance-header">
            <div className="selloi-compliance-icon">
              <Shield size={20} />
            </div>
            <h3 className="selloi-compliance-title">Google API Services User Data Policy Muvofiqligi</h3>
          </div>
          <p className="selloi-compliance-text">
            Selloi platformasi Google OAuth 2.0 orqali olingan foydalanuvchi ma'lumotlariga nisbatan eng yuqori darajadagi xavfsizlik va cheklov qoidalariga qat'iy rioya qiladi:
          </p>
          <div className="selloi-compliance-quote">
            "Selloi's use and transfer to any other app of information received from Google APIs will adhere to the{" "}
            <strong>Google API Services User Data Policy</strong>, including the <strong>Limited Use requirements</strong>."
          </div>
          <p className="selloi-compliance-text" style={{ margin: 0 }}>
            Google foydalanuvchi ma'lumotlari (email, ism, profil rasmi) uchinchi shaxslarga sotilmaydi, reklama maqsadlarida foydalanilmaydi va umumiy sun'iy intellekt modellarini o'rgatish uchun ishlatilmaydi.
          </p>
        </div>

        {/* Main Document Content */}
        <article className="selloi-legal-card">
          {/* Section 1 */}
          <section className="selloi-legal-section">
            <h2>1. Umumiy qoidalar (General Provisions)</h2>
            <p>
              Ushbu Maxfiylik siyosati (keyingi o'rinlarda "Siyosat") <strong>Selloi</strong> (keyingi o'rinlarda "Selloi", "Biz" yoki "Platforma") veb-sayti (<strong>https://selloi.uz</strong>) va unga bog'liq barcha xizmatlardan foydalanish jarayonida foydalanuvchilarning shaxsiy ma'lumotlarini qanday to'plashimiz, ishlatishimiz va himoya qilishimizni belgilaydi.
            </p>
            <p>
              Selloi xizmatlaridan foydalanish yoki ro'yxatdan o'tish orqali siz ushbu Maxfiylik siyosati shartlariga to'liq rozilik bildirasiz.
            </p>
          </section>

          {/* Section 2 */}
          <section className="selloi-legal-section">
            <h2>2. Biz to'playdigan ma'lumotlar (Information We Collect)</h2>
            <p>Platformadan foydalanish jarayonida quyidagi toifadagi ma'lumotlar to'planishi mumkin:</p>
            <ul>
              <li>
                <strong>Google hisobi orqali kirilganda:</strong> Google identifikatori (User ID), to'liq ism (Full Name), elektron pochta manzili (Email) va profil fotosurati (Avatar URL).
              </li>
              <li>
                <strong>Ro'yxatdan o'tish ma'lumotlari:</strong> Foydalanuvchi nomi, elektron pochta manzili, xesh-shifrlangan parol.
              </li>
              <li>
                <strong>Telegram do'kon ma'lumotlari:</strong> Telegram Bot tokeni, kanal va guruh identifikatorlari, do'kon tovarlari nomlari, narxlari va tavsiflari.
              </li>
              <li>
                <strong>Mijozlar buyurtmalari:</strong> Xaridorlar tomonidan Telegram orqali yuborilgan buyurtma ma'lumotlari (telefon raqami, yetkazib berish manzili, tanlangan tovarlar).
              </li>
              <li>
                <strong>Texnik va tizim jurnallari:</strong> IP-manzil, brauzer turi, qurilma parametrlari, tizimga kirish vaqti va xavfsizlik jurnallari.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="selloi-legal-section">
            <h2>3. Google OAuth ma'lumotlari va ulardan foydalanish (Google User Data)</h2>
            <p>
              Selloi faqat hisobga xavfsiz kirishni ta'minlash uchun Google OAuth 2.0 autentifikatsiyasidan foydalanadi. Biz quyidagi ruxsatlar (scopes) doirasida ma'lumot olamiz:
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
                  <td>Hisobga kirish, xavfsizlik xabarlari va bildirishnomalar yuborish</td>
                </tr>
                <tr>
                  <td><code>profile</code></td>
                  <td>Ism va profil rasmi</td>
                  <td>Shaxsiy boshqaruv panelida foydalanuvchi profilini ko'rsatish</td>
                </tr>
              </tbody>
            </table>
            <p>
              Biz Google hisobingizdagi xatlar (Gmail), fayllar (Google Drive), kontaktlar yoki boshqa shaxsiy ma'lumotlaringizga mutlaqo murojaat qilmaymiz va ularni talab qilmaymiz.
            </p>
          </section>

          {/* Section 4 */}
          <section className="selloi-legal-section">
            <h2>4. Ma'lumotlardan foydalanish maqsadlari (How We Use Information)</h2>
            <p>To'plangan ma'lumotlar faqat quyidagi aniq maqsadlar uchun ishlatiladi:</p>
            <ul>
              <li>Platformada foydalanuvchi hisobini ochish va xavfsiz autentifikatsiya qilish;</li>
              <li>Telegram do'koningiz uchun sun'iy intellekt asosidagi sotuvchi yordamchisi xizmatini taqdim etish;</li>
              <li>Mijozlar bilan savdo muloqotlarini avtomatlashtirish va buyurtmalarni boshqarish panelida aks ettirish;</li>
              <li>Texnik nosozliklarni aniqlash, server xavfsizligini monitoring qilish va firibgarlikning oldini olish;</li>
              <li>Xizmat sifati, yangi funksiyalar va hisob-kitoblar bo'yicha muhim xabarlarni yetkazish.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="selloi-legal-section">
            <h2>5. Ma'lumotlarni uchinchi tomonlarga bermaslik (Data Sharing & Non-Disclosure)</h2>
            <p>
              Selloi foydalanuvchilarning shaxsiy ma'lumotlarini qat'iy himoya qiladi:
            </p>
            <ul>
              <li>
                <strong>Sotilmaydi va ijaraga berilmaydi:</strong> Biz hech qachon shaxsiy ma'lumotlarni, jumladan Google foydalanuvchi ma'lumotlarini marketing yoki reklama kompaniyalariga sotmaymiz va uzatmaymiz.
              </li>
              <li>
                <strong>AI model o'qitishda cheklov:</strong> Shaxsiy ma'lumotlaringiz ommaviy yoki umumiy sun'iy intellekt modellarini o'qitish uchun ishlatilmaydi.
              </li>
              <li>
                <strong>Qonuniy talablar:</strong> Ma'lumotlar faqat amaldagi qonunchilik talab qilgan hollarda vakolatli davlat organlariga taqdim etilishi mumkin.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="selloi-legal-section">
            <h2>6. Ma'lumotlar xavfsizligi va saqlanishi (Data Security & Retention)</h2>
            <p>
              Foydalanuvchi ma'lumotlari xavfsizligini ta'minlash uchun Selloi quyidagi texnologik choralarni ko'radi:
            </p>
            <ul>
              <li>Barcha veb-so'rovlar <strong>256-bitli SSL/TLS shifrlash</strong> protokoli (HTTPS) orqali amalga oshiriladi;</li>
              <li>Parollar ochiq holda saqlanmaydi, faqat zamonaviy kriptografik xeshlar (bcrypt) bilan himoyalanadi;</li>
              <li>Autentifikatsiya sessiyalari xavfsiz HttpOnly va Secure cookie fayllari orqali boshqariladi;</li>
              <li>Server ma'lumotlar bazasi tashqi tarmoqdan yopiq holda saqlanadi va unga faqat ruxsat berilgan ichki xizmatlar kira oladi.</li>
            </ul>
            <p>
              Ma'lumotlar foydalanuvchi akkaunti faol bo'lgan davrda yoki xizmatlarni taqdim etish uchun zarur bo'lgan muddat davomida saqlanadi.
            </p>
          </section>

          {/* Section 7 */}
          <section className="selloi-legal-section">
            <h2>7. Foydalanuvchi huquqlari va ma'lumotlarni o'chirish (Your Rights & Data Deletion)</h2>
            <p>Foydalanuvchi o'z ma'lumotlariga nisbatan quyidagi huquqlarga ega:</p>
            <ul>
              <li>O'z shaxsiy ma'lumotlaridan nusxa olish va ular bilan tanishish;</li>
              <li>Noto'g'ri yoki eskirgan ma'lumotlarni to'g'rilashni talab qilish;</li>
              <li>
                <strong>Ma'lumotlarni to'liq o'chirishni talab qilish (Right to be Forgotten):</strong> Istalgan vaqtda o'z hisobingizni va unga tegishli barcha ma'lumotlarni o'chirishni so'rashingiz mumkin.
              </li>
            </ul>
            <div className="selloi-contact-box">
              <div className="selloi-contact-item">
                <Trash2 size={16} color="#FF4C63" />
                <span>
                  <strong>Ma'lumotlarni o'chirish so'rovi:</strong> Ma'lumotlaringizni o'chirish uchun{" "}
                  <a href="mailto:support@selloi.uz">support@selloi.uz</a> manziliga xat yozing. So'rov 30 kun ichida to'liq ko'rib chiqiladi va barcha ma'lumotlar serverlardan o'chirib tashlanadi.
                </span>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section className="selloi-legal-section">
            <h2>8. Bog'lanish ma'lumotlari (Contact Information)</h2>
            <p>
              Ushbu Maxfiylik siyosati yoki shaxsiy ma'lumotlaringiz bo'yicha har qanday savol va takliflar bilan quyidagi rasmiy aloqa vositalari orqali murojaat qilishingiz mumkin:
            </p>
            <div className="selloi-contact-box">
              <div className="selloi-contact-item">
                <Mail size={16} color="#FF4C63" />
                <span>
                  Yordam va xavfsizlik xizmati:{" "}
                  <a href="mailto:support@selloi.uz">support@selloi.uz</a>
                </span>
              </div>
              <div className="selloi-contact-item">
                <Mail size={16} color="#FF4C63" />
                <span>
                  Ma'muriyat:{" "}
                  <a href="mailto:admin@selloi.uz">admin@selloi.uz</a>
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
