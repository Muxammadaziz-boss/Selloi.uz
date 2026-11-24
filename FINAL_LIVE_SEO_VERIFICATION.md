# SELLOI.UZ — YAKUNIY JONLI SEO VERIFIKATSIYA HISOBOTI (FINAL LIVE SEO VERIFICATION REPORT)

**Sana va vaqt**: 23-Noyabr, 2026-yil, 17:52 (Toshkent vaqti)  
**Tekshirilgan jonli manzil**: [https://selloi.uz/](https://selloi.uz/)  
**Server IP**: `129.146.163.171` (Cloudflare orqali proksilangan)  
**Holat**: Jonli ishlab chiqarish (production) serverida barcha tekshiruvlar to'liq va muvaffaqiyatli yakunlandi.

---

## 1. 10 TA TALAB BO'YICHA AMALGA OSHIRILGAN ISHLAR VA NATIJALAR

### 1. Ishlab Chiqarishdagi (Deployed) Robots.txt dan `Host` Direktivasi Olib Tashlandi
- **Muammo**: `https://selloi.uz/robots.txt` da eskirgan va Google qidiruv tizimi tomonidan qo'llab-quvvatlanmaydigan `Host: https://selloi.uz` direktivasi mavjud edi.
- **Bajarildi**: VPS serveridagi (`/home/ubuntu/projects/Telegram_Ai_Seller/web/app/robots.ts`) kodi yangilandi, Docker konteyneri qayta qurildi (`docker compose build web && docker compose up -d web`).
- **Natija**: `Host:` direktivasi jonli `https://selloi.uz/robots.txt` dan butunlay olib tashlandi.

### 2. Haqiqiy Ishlab Chiqarish (Production) Javoblari Tasdiqlandi
- Sinovlar faqat `localhost` da emas, balki bevosita tashqi internet orqali `https://selloi.uz/` manziliga real HTTP so'rovlar yuborish orqali amalga oshirildi va to'liq tasdiqlandi.

### 3 va 4. `/sitemap.xml` dagi Ikki Skript Elementi Manbasi Aniqlandi
- **Tekshiruv maqsadi**: Brauzerda sitemap ochilganda ko'ringan 2 ta `<script>` elementi serverdan kelayaptimi yoki brauzer kengaytmasi (extension) tomonidan kiritilayaptimi?
- **O'tkazilgan tekshiruv**:
  `https://selloi.uz/sitemap.xml` ga to'g'ridan-to'g'ri raw HTTP GET so'rovi yuborildi va baytma-bayt tahlil qilindi.
- **Qat'iy xulosa**:
  - **Serverdan kelayotgan javobda SKRIPT UMUMAN YO'Q (`Contains <script>?: false`)**.
  - Server qaytarayotgan kontent-turi: `Content-Type: application/xml`.
  - Hajmi: 554 bayt toza XML.
  - **Manba**: Foydalanuvchi brauzerida ko'ringan ikki skript elementi **foydalanuvchining o'z brauzeridagi kengaytmalar (browser extensions)** yoki DevTools tomonidan mijoz (client) tomonida kiritilgan (inject qilingan).
  - Server hech qanday skript bermaydi. Shuning uchun Google Search Console sitemap'ni qabul qilib, `"Status: Success"` va `"Discovered URLs: 3"` deb ko'rsatmoqda.

### 5 va 6. XML Sitemap Faqat To'g'ri Elementlarni O'z Ichiga Oladi
- Sitemap faqatgina 3 ta haqiqiy va qonuniy ommaviy sahifani o'z ichiga oladi:
  1. `https://selloi.uz/` (Priority: 1.0, Changefreq: weekly)
  2. `https://selloi.uz/privacy` (Priority: 0.8, Changefreq: monthly)
  3. `https://selloi.uz/terms` (Priority: 0.8, Changefreq: monthly)

### 7. Shaxsiy Marshrutlar Xavfsizligi va Autentifikatsiyasi Saqlandi
- `/dashboard`, `/platform`, `/settings` va `/t/[tenantSlug]` marshrutlari to'liq server-side HMAC sessiya tokeni (`verifySession`) bilan himoyalangan.
- Sessiyasiz kirishga uringan har qanday tashrif buyuruvchi yoki bot darhol `HTTP 307 Temporary Redirect` orqali `/login` sahifasiga yo'naltiriladi.

### 8. `/login` Marshruti Qidiruv Botlari Uchun Ochiq (Noindex O'qiladi)
- `robots.txt` dan `/login` chiqarilganligi sababli, Googlebot `/login` ga kela oladi va HTML boshidagi `<meta name="robots" content="noindex, follow">` tegini o'qiydi. Natijada login sahifasi qidiruv indeksidan toza chiqarib tashlanadi.

### 9. Kanonik URL va Sitemap Muvofiqligi
- Bosh sahifa kanonik havolasi: `https://selloi.uz` (slash bilan yakunlangan `https://selloi.uz/` ga to'liq mos keladi).
- Sitemap'dagi barcha havolalar mutlaq (absolute) `https://selloi.uz` domeni bilan yozilgan.

### 10. Figma Dizayni va Mavjud Funksionallik Saqlab Qolindi
- Saytning Figma dizayni, shisha (glass) effektlari, matnlari, tugmalari va backend integratsiyalari o'zgarishsiz saqlandi.

---

## 2. JONLI ISHLAB CHIQARISHNING RAW HTTP DALILLARI (EVIDENCE)

Quyida `https://selloi.uz` ga yuborilgan so'rovlarning serverdan qaytgan haqiqiy javoblari keltirilgan:

### A. GET `https://selloi.uz/robots.txt`
```http
HTTP/2 200 OK
content-type: text/plain
cache-control: public, max-age=0, must-revalidate
server: cloudflare

User-Agent: *
Allow: /
Disallow: /api/

Sitemap: https://selloi.uz/sitemap.xml
```
*(Tasdiq: `Host:` direktivasi yo'q, `/login` bloklanmagan, faqat `/api/` yopiq).*

---

### B. GET `https://selloi.uz/sitemap.xml`
```http
HTTP/2 200 OK
content-type: application/xml
cache-control: public, max-age=0, must-revalidate
server: cloudflare

<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://selloi.uz/</loc>
<lastmod>2026-11-21T15:00:00.000Z</lastmod>
<changefreq>weekly</changefreq>
<priority>1</priority>
</url>
<url>
<loc>https://selloi.uz/privacy</loc>
<lastmod>2026-11-21T15:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.8</priority>
</url>
<url>
<loc>https://selloi.uz/terms</loc>
<lastmod>2026-11-21T15:00:00.000Z</lastmod>
<changefreq>monthly</changefreq>
<priority>0.8</priority>
</url>
</urlset>
```
*(Tasdiq: Hajmi 554 bayt. `<script>` umuman mavjud emas).*

---

### C. GET `https://selloi.uz/` (Bosh sahifa Schema.org va Metadata)
```http
HTTP/2 200 OK
content-type: text/html; charset=utf-8

<title>Selloi.uz — Telegram uchun 24/7 AI sotuvchi</title>
<meta name="description" content="Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.">
<link rel="canonical" href="https://selloi.uz">
```
**Schema.org SoftwareApplication Takliflari (Offers):**
```json
[
  {
    "@type": "Offer",
    "name": "START Plan (7 kunlik sinov)",
    "price": "13000",
    "priceCurrency": "UZS",
    "description": "START: 7 kunlik sinov davri uchun 13 000 UZS ($1 ekvivalenti). Sinovdan so'ng oylik (244 000 UZS) va yillik obuna.",
    "availability": "https://schema.org/InStock",
    "url": "https://selloi.uz/#tariflar"
  },
  {
    "@type": "Offer",
    "name": "PRO Plan (7 kunlik sinov)",
    "price": "26000",
    "priceCurrency": "UZS",
    "description": "PRO: 7 kunlik sinov davri uchun 26 000 UZS ($2 ekvivalenti). AI Vision va to'liq avtomatlashtirish. Sinovdan so'ng oylik (499 000 UZS) va yillik obuna.",
    "availability": "https://schema.org/InStock",
    "url": "https://selloi.uz/#tariflar"
  },
  {
    "@type": "Offer",
    "name": "ULTRA Plan (7 kunlik sinov)",
    "price": "39000",
    "priceCurrency": "UZS",
    "description": "ULTRA: 7 kunlik sinov davri uchun 39 000 UZS ($3 ekvivalenti). Korporativ jamoalar va alohida infratuzilma uchun. Sinovdan so'ng oylik (999 000 UZS) va yillik obuna.",
    "availability": "https://schema.org/InStock",
    "url": "https://selloi.uz/#tariflar"
  }
]
```
*(Tasdiq: TezCheck to'lov tizimiga muvofiq barcha narxlar UZS da ko'rsatilgan, bepul sinov da'volari yo'q).*

### F. SoftwareApplication Rich-Result Cheklovlari Hujjati
- Google Search Central qoidalariga binoan, `SoftwareApplication` uchun qidiruv natijalarida yulduzchali reytinglar va boyitilgan sharh kartochkalari (rich snippets) chiqishi uchun `aggregateRating` yoki `review` xususiyatlari talab etiladi.
- Selloi.uz soxta reytinglar yoki sun'iy sharhlarni qat'iyan kiritmaydi.
- **Cheklov**: Sun'iy reytinglar kiritilmaganligi sababli, Selloi.uz hozircha sharhli rich snippet'larga ega bo'lmaydi. Bu qidiruv tizimi siyosatiga to'liq halol yondashuvdir; haqiqiy foydalanuvchilar sharhlari shakllangach, organik ravishda kiritiladi.

---

### D. GET `https://selloi.uz/login`
```http
HTTP/2 200 OK
<meta name="robots" content="noindex, follow">
```
*(Tasdiq: Crawlable, noindex mavjud).*

---

### E. GET `https://selloi.uz/dashboard`
```http
HTTP/2 307 Temporary Redirect
location: /login?redirect=/dashboard
```
*(Tasdiq: Server-side sessiya nazorati to'liq faol).*

---

## 3. GOOGLE SEARCH CONSOLE VA RASMIY INDEKSATSIYA TALABLARI

> [!IMPORTANT]
> **Haqiqiy holatni baholash va Google rasmiy talablari**:
> Google Search Console'da sitemap muvaffaqiyatli topshirilgani (`Status: Success`) va 3 ta URL kashf qilingani (`Discovered URLs: 3`) tasdiqlandi.
> 
> **Biroq, sitemap maqomi "Success" bo'lishi sayt to'liq indekslandi degani emas!**
> - **Sitemap topshirilishi** — bu Googlebot'ga sayt sahifalari xaritasini yetkazishdir.
> - **Indekslanish muddati**: Hech qachon 24–72 soat ichida kafolatlangan indekslanish va'da qilinmaydi. Google'ning rasmiy yo'riqnomasiga (Google Search Central) ko'ra: sahifalarni kashf qilish (crawling) va qidiruv indeksiga kiritish (indexing) **bir necha kundan bir necha haftagacha** vaqt olishi mumkin, hamda Google hech qachon har bir URL 100% indekslanishini kafolatlamaydi.
> - URL Inspection oynasida `https://selloi.uz/` tekshirilganda **"URL is on Google"** yashil belgisi paydo bo'lgandagina va `site:selloi.uz` orqali qidiruv natijalarida ko'ringandagina indekslanish rasman tasdiqlangan hisoblanadi.

---

## 4. SEMANTIK BAZA TERMINOLOGIYASI VA YAKUNIY XULOSA

Kalit so'zlar bazasi (`seo/keyword-research.csv`) bo'yicha qat'iy tekshirilgan terminologiya:
- **189 measured keyword queries**: Google Keyword Planner (UZ) va Yandex Wordstat (UZ) da oylik qidiruv ko'rsatkichlari aniqlangan rasmiy so'rovlar.
- **996 estimated keyword phrases**: Mintaqaviy elektron tijorat modeli bo'yicha baholangan uzoq dumli (long-tail) iboralar.
- **1,185 total unique keyword phrases**: Loyiha uchun tuzilgan noyob kalit iboralarning umumiy soni.

Hozirgi vaqtda texnik kod bazasi, server javoblari, robots.txt, sitemap va metadata bo'yicha **hech qanday xatolik yoki to'siq mavjud emas**. Sayt qidiruv botlari tashrifi uchun 100% texnik shay holatga keltirildi.
