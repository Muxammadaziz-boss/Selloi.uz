# SEO AUDIT REPORT — SELLOI.UZ
**Sana:** 23-Noyabr, 2026-yil  
**Loyiha:** Selloi.uz — Telegram uchun 24/7 AI sotuvchi  
**Rasmiy domen:** https://selloi.uz/  
**Auditor:** Senior Technical SEO & Search Console Specialist

---

## 1. IJROIY XULOSA (EXECUTIVE SUMMARY)

Selloi.uz veb-sayti va Next.js (v15.5.28) kodlar bazasi to'liq texnik SEO, indeksatsiya, brend kashf etilishi va qidiruv tizimlari (Google, Bing, Yandex) uchun audit qilindi. 

Sayt yuqori texnik poydevorga ega: Server-Side Rendering (SSR), toza DOM, bitta asosiy H1 tegi va Quicksand shrifti. Biroq, qidiruv tizimlarida rasmiy brend sifatida mustahkam o'rin egallashi va organik trafikni jalb qilishi uchun bir qator kritik nomuvofiqliklar va optimizatsiya nuqsonlari aniqlandi.

### Asosiy holat ko'rsatkichlari:
- **Texnik arxitektura:** Next.js 15 App Router (Static + SSR)
- **Indeksatsiya holati:** Ochiq, lekin meta-teglar va JSON-LD brend nomida farqlar mavjud
- **Asosiy qidiruv burchagi:** O'zbekiston bozorida "Telegram AI sotuvchi" va "Selloi.uz" brendi

---

## 2. AUDIT NATIJALARI (PUNKTMA-PUNKT)

### 2.1. HTML Metadata & Sarlavhalar (Page Titles & Meta Descriptions)
- **Aniqlangan holat:** 
  - `web/app/page.tsx` da sarlavha `Selloi: Telegram do'koningiz uchun Sun'iy Intellekt sotuvchisi` deb yozilgan.
  - Mandat bo'yicha belgilangan rasmiy sarlavha: `Selloi.uz — Telegram uchun 24/7 AI sotuvchi`.
  - Tavsif (meta description) mandatdagi matndan farq qiladi: `Mijozlaringiz bilan o'zbek tilida erkin muloqot qiladi...` o'rniga aniq `Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.` bo'lishi lozim.
- **Xulosa:** Kritik darajada yangilanishi kerak.

### 2.2. Kanonik URL manzillar (Canonical URLs)
- **Aniqlangan holat:** 
  - `web/app/layout.tsx` da `alternates: { canonical: "/" }` (nisbiy), `web/app/page.tsx` da `alternates: { canonical: "https://selloi.uz/" }`.
  - Har qanday noaniqlikni oldini olish uchun har bir ochiq sahifada qat'iy mutlaq (absolute) `https://selloi.uz/` kanonik manzili belgilanishi zarur.
- **Xulosa:** To'liq unifikatsiya talab qilinadi.

### 2.3. robots.txt tahlili
- **Aniqlangan holat:** 
  - `web/app/robots.ts` mavjud va `/sitemap.xml` ga havola berilgan.
  - Biroq, `/settings`, `/settings/`, `/login` kabi yo'nalishlar disallow qoidalarida to'liq emas. 
  - Foydalanuvchilarning shaxsiy panellari va autentifikatsiya sahifalari botlar tomonidan keraksiz crawl qilinmasligi uchun aniq ko'rsatilishi kerak.
- **Xulosa:** Qoidalar takomillashtirilishi kerak.

### 2.4. XML Sitemap (sitemap.xml)
- **Aniqlangan holat:** 
  - `web/app/sitemap.ts` orqali `/`, `/privacy`, `/terms` ro'yxatga olingan.
  - Soxta yoki login talab qiladigan sahifalar kiritilmagan (ijobiy).
  - Mutlaq manzillar to'g'ri berilgan.

### 2.5. Strukturaviy ma'lumotlar (Structured Data / Schema.org JSON-LD)
- **Aniqlangan holat:**
  - `web/app/layout.tsx` da `Organization`, `WebSite`, `SoftwareApplication` bloklari mavjud.
  - Nom atributi `"Selloi"` shaklida, brendning to'liq nomi esa `"Selloi.uz"` bo'lishi kerak.
  - Tavsif va kontakt nuqtalari rasmiy mandat talablariga moslanishi kerak. Soxta sharhlar, reitinglar yoki uydirma statistika mavjud emas (yaxshi).

### 2.6. Open Graph & Twitter / Social Card Metadata
- **Aniqlangan holat:**
  - Open Graph va Twitter sarlavhalari asosiy mandat sarlavhasiga moslashtirilishi lozim.
  - Rasm nisbati (1200x630) `/og-image.png` uchun sozlangan.
  - `siteName` maydoni bir xil `"Selloi.uz"` ga keltirilishi kerak.

### 2.7. Favicon va Ikonkalar (Favicon Ecosystem)
- **Aniqlangan holat:**
  - `favicon.ico`, `logo.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` mavjud.
  - Biroq, standart Google Search va brauzerlar uchun 32x32 PNG favikoni hamda `favicon.svg` to'g'ridan-to'g'ri `public/` ildizida aniq bog'lanishi lozim.

### 2.8. Heading Ierarxiyasi & Semantik HTML
- **Aniqlangan holat:**
  - Asosiy sahifada yagona H1 tegi mavjud: `<h1 className="selloi-hero-title">`.
  - H2 teglar bo'lim sarlavhalari uchun, H3 teglar kartalar va qadamlar uchun ishlatilgan.
  - Barcha rasmlarda `alt` teglari mavjud, lekin ularni SEO maqsadlariga yanada mos (deskriptiv) qilish mumkin.

### 2.9. Xalqaro SEO (International SEO & hreflang)
- **Aniqlangan holat:**
  - `layout.tsx` da `<html lang="uz">` belgilangan.
  - Bosh sahifa uz tilida yuklanadi, mijoz tomonida esa rus va ingliz tillariga o'tish imkoniyati bor.
  - Qidiruv tizimlari uchun asosiy kanonik til `uz` va `x-default: https://selloi.uz/` qilib belgilanadi.

### 2.10. Maxfiylik va Xavfsizlik (SEO Security)
- **Aniqlangan holat:**
  - `/dashboard`, `/platform`, `/settings`, `/t/[tenantSlug]` kabi shaxsiy sahifalar sessiya tekshiruvi bilan himoyalangan va kirishsiz kirilganda `/login` ga yo'naltiriladi.
  - Ushbu sahifalarga robotlar tasodifan kirib qolmasligi uchun server tomonida `noindex, nofollow` direktivalari qat'iy berilishi kerak.

---

## 3. AUDITNING ASOSIY KAMCHILIKLARI VA TUZATISH REJASI

| № | Soha | Aniqlangan kamchilik | Tuzatish amali |
|---|---|---|---|
| 1 | **Title & Description** | Sarlavha va tavsif mandatdan farq qiladi | Mandatdagi aniq matn o'rnatiladi |
| 2 | **Brand unifikatsiyasi** | "Selloi" vs "Selloi.uz" aralashuvi | Barcha metadata va JSON-LD da `Selloi.uz` |
| 3 | **Robots.txt** | `/settings` va `/login` to'liq cheklanmagan | Disallow qoidalari mukammallashtiriladi |
| 4 | **JSON-LD Schema** | Schema Organization va Software nomlari | `Selloi.uz` va verified ma'lumotlar |
| 5 | **Private Route Noindex** | Ichki sahifalarda noindex meta yetishmasligi | Server-darajasida noindex kafolatlanadi |
| 6 | **Favicon 32x32** | 32x32 PNG favicon havolasi | To'liq favicon ekotizimi ulanadi |

Ushbu audit xulosasidan so'ng darhol tuzatishlar bosqichi boshlanadi.
