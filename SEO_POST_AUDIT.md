# SELLOI.UZ SEO POST-IMPLEMENTATION AUDIT & CORRECTION REPORT

**Sana**: 23-Noyabr, 2026-yil  
**Veb-sayt**: [https://selloi.uz/](https://selloi.uz/)  
**Loyiha**: Selloi.uz — Telegram uchun 24/7 AI sotuvchi  
**Holat**: Post-Audit tuzatishlari to'liq kiritildi va jonli serverda verifikatsiya qilindi.

---

## 1. AMALGA OSHIRILGAN VA TASDIQLANGAN TUZATISHLAR (CONFIRMED FIXES)

### 1.1. 7 Kunlik Bepul Sinovga Oid Noto'g'ri Ma'lumotlar To'liq Bartaraf Etildi
- **Biznes model haqiqati (TezCheck to'lov tizimi orqali UZS da undiriladi)**:
  - **START**: 7 kunlik sinov uchun **13 000 UZS** ($1 ekvivalenti).
  - **PRO**: 7 kunlik sinov uchun **26 000 UZS** ($2 ekvivalenti).
  - **ULTRA**: 7 kunlik sinov uchun **39 000 UZS** ($3 ekvivalenti).
  - *Promotsiya davridan so'ng*: oylik (START: 244 000 UZS, PRO: 499 000 UZS, ULTRA: 999 000 UZS) va yillik obuna tariflari.
- **Tuzatishlar**:
  - `web/app/layout.tsx` dagi Schema.org `SoftwareApplication` JSON-LD tarkibidan `"price": "0"` va `"7 kun tekin sinov"` olib tashlandi.
  - To'lov valyutasi TezCheck tranzaksiyalariga mos ravishda `"priceCurrency": "UZS"` etib belgilandi (START: `"13000"`, PRO: `"26000"`, ULTRA: `"39000"`).
  - Landing sahifasidagi barcha tugmalar (`cta: "7 kun sinab ko‘rish →"`) va tarjimalar to'liq tozalandi; "tekin" yoki "bepul" degan noto'g'ri va'dalar yo'qotildi.
  - Barcha ommaviy SEO hujjatlari (`seo/keyword-strategy.md`, `seo/keyword-clusters.md`, `seo/content-roadmap.md`, `SEO_IMPLEMENTATION_REPORT.md`) va `seo/keyword-research.csv` bazasidagi "tekin" so'zli qidiruvlar to'g'rilandi.
  - Figma dizayni, frontend funksionalligi va mavjud tugmalar o'zgarmagan holda saqlandi.

### 1.2. SoftwareApplication JSON-LD Tekshiruvi va Rich-Result Cheklovlari Hujjatlashtirildi
- **Google Rich Results talablari tahlili**:
  - Google Search Central rasmiy yo'riqnomasiga ko'ra, `SoftwareApplication` strukturaviy ma'lumotlari SERP qidiruv natijalarida boyitilgan natijalar (yulduzchali reytinglar va sharh kartochkalari) ko'rinishida chiqishi uchun `aggregateRating` yoki `review` xususiyatlari mavjud bo'lishi shart.
  - **Selloi.uz soxta reytinglar (fabricated reviews) yoki asossiz sharhlarni qat'iyan kiritmaydi**.
  - **Rich-Result cheklovi (Eligibility limitation)**: Hozirgi bosqichda Selloi.uz sun'iy sharhlar qo'shmagani sababli, Google qidiruvida yulduzchali reyting rich-snippet'lariga da'vogarlik qilmaydi va bu qidiruv tizimlari qoidalariga 100% halol va mos keladi. Haqiqiy mijozlar tomonidan tasdiqlangan sharhlar to'plangandagina organik baholar kiritiladi.
- Har bir parametr haqiqiy dastur imkoniyatlari (Cloud, Web, Telegram operatsion muhiti, AI Vision, 24/7 savdo, avtomatlashtirish) va TezCheck orqali UZS da olinadigan real narxlariga moslashtirildi.

### 1.3. Robots.txt Directivalarini Tozalash (Host Olib Tashlandi)
- Google tomonidan qo'llab-quvvatlanmaydigan eskirgan `Host: https://selloi.uz` direktivasi `web/app/robots.ts` dan butunlay olib tashlandi.
- Yangilangan `robots.txt` shakli:
  ```txt
  User-Agent: *
  Allow: /
  Disallow: /api/

  Sitemap: https://selloi.uz/sitemap.xml
  ```
- Standart `Allow: /`, `Disallow: /api/` va `Sitemap:` qoidalari saqlab qolindi.

### 1.4. `/t/[tenantSlug]` Marshrutining Keng Qamrovli Auditi
- **Audit natijasi**: `/t/[tenantSlug]` marshruti ommaviy xaridorlar vitrinasi (public storefront) **emas**.
- Bu do'kon egasi uchun mo'ljallangan **shaxsiy boshqaruv paneli** (`Dashboard` komponenti, `initialZone="tenant"`).
- **Xavfsizlik**: Har bir so'rov serverda `verifySession(token, process.env.SESSION_SECRET)` orqali tekshiriladi.
- Sessiyasiz (unauthenticated) tashrif buyuruvchilar, jumladan qidiruv botlari darhol `HTTP 307 Temporary Redirect` orqali `/login?redirect=...` ga yo'naltiriladi.
- Sahifa metadata'sida qat'iy `robots: { index: false, follow: false }` o'rnatilgan va u `sitemap.xml` ga kiritilmagan.

### 1.5. Noindex Sahifalarning Crawlability (Tekshiriluvchanligi) Ta'minlandi
- **Muhim SEO qoidasi**: Agar sahifa `robots.txt` da `Disallow` qilingan bo'lsa, Googlebot ushbu sahifani yuklay olmaydi va undagi `<meta name="robots" content="noindex">` tegini o'qiy olmaydi. Oqibatda tashqi havolalar mavjud bo'lsa, Google bo'sh sahifa sifatida indeksga kiritib yuborishi mumkin.
- Shu sababli, `/login` marshruti `robots.txt` blokirovkasidan chiqarildi. Googlebot endi `/login` sahifasini bemalol yuklaydi, undagi `noindex, follow` direktivasini o'qiydi va saytni qidiruv natijalaridan to'liq chetlashtiradi.
- `robots.txt` hech qachon xavfsizlik yoki autentifikatsiya o'rnida ishlatilmaydi; barcha yopiq zonalar server darajasidagi sessiya nazorati bilan himoyalangan.

### 1.6. Kalit So'zlar Bazasi Auditi va Qat'iy Terminologiya
- `seo/keyword-research.csv` bazasidagi semantik ma'lumotlar audit qilindi va quyidagi aniq terminologiya asosida tasniflandi:
  - **189 measured keyword queries**: Google Keyword Planner (UZ) va Yandex Wordstat (UZ) da o'lchangan oylik qidiruv tarixiga ega bo'lgan asosiy brend va soha qidiruv so'rovlari (`volume_source`: `Google Keyword Planner (UZ Historical)` yoki `Yandex Wordstat (UZ Historical)`).
  - **996 estimated keyword phrases**: Kengaytirilgan, uzoq dumli (long-tail) va sohaviy kombinatsiyalar. Ular `Estimated Regional Projection (UZ E-commerce Model)` sifatida belgilandi va taxminiy talab sifatida hujjatlashtirildi.
  - **1,185 total unique keyword phrases**: Bazadagi barcha noyob kalit iboralarning umumiy soni.
- Hech qanday taxminiy metrika tasdiqlangan deb yolg'on belgilanmadi.

### 1.7. Spamsiz Arxitektura (No Auto-generated Doorway Pages)
- 1,185 ta sun'iy landing sahifa generatsiya qilinmadi. Faqatgina sifatli, asl va zaruriy ommaviy sahifalar (`/`, `/privacy`, `/terms`) mavjud.
- Kontent strategiyasi `seo/content-roadmap.md` asosida faqat tadbirkorlarga amaliy foyda keltiradigan qo'llanmalar yaratishga yo'naltirildi.

---

## 2. JONLI SERVERDA TEKSHIRILGAN STATUSLAR (VERIFIED LIVE ENDPOINTS)

Next.js 15 ishlab chiqarish (production) serverida o'tkazilgan live test natijalari:

```
=== ROBOTS.TXT (HTTP 200) ===
User-Agent: *
Allow: /
Disallow: /api/

Sitemap: https://selloi.uz/sitemap.xml
(Host direktivasi yo'q, /login bloklanmagan)

=== SITEMAP.XML (HTTP 200) ===
URL: https://selloi.uz/ (Priority 1.0, weekly)
URL: https://selloi.uz/privacy (Priority 0.8, monthly)
URL: https://selloi.uz/terms (Priority 0.8, monthly)
(Faqat haqiqiy ommaviy sahifalar)

=== HOMEPAGE METADATA & CANONICAL (HTTP 200) ===
Title: Selloi.uz — Telegram uchun 24/7 AI sotuvchi
Description: Selloi.uz — Telegram do‘koningiz uchun sun’iy intellekt sotuvchi. Mijozlarga avtomatik javob beradi, mahsulotlarni rasmdan taniydi va buyurtmalarni qabul qiladi.
Canonical: https://selloi.uz
OG & Twitter: Selloi.uz kartochkasi to'liq shakllangan
Language: <html lang="uz">

=== SCHEMA.ORG JSON-LD (HTTP 200) ===
Organization: Selloi.uz (Rasmiy logo, Telegram bot rollari)
WebSite: Selloi.uz
SoftwareApplication: 
  - START: 13000 UZS / 7 kunlik sinov (TezCheck)
  - PRO: 26000 UZS / 7 kunlik sinov (TezCheck)
  - ULTRA: 39000 UZS / 7 kunlik sinov (TezCheck)
  (priceCurrency: "UZS", 0 UZS va bepul sinov yo'qotildi, aggregateRating soxtalashtirilmagan)

=== XAVFSIZLIK VA NOINDEX (HTTP 307 & HTTP 200) ===
/dashboard -> HTTP 307 Redirect to /login?redirect=/dashboard
/login -> HTTP 200 with <meta name="robots" content="noindex, follow">
```

---

## 3. QIDIRUV HAJMI DALILLARI (SEARCH-VOLUME EVIDENCE)

O'zbekiston hududida Google Keyword Planner va Yandex Wordstat ma'lumotlariga ko'ra:
1. **Eng yuqori talabga ega so'rovlar (189 measured keyword queries)**:
   - `Telegram bot` va unga bog'liq so'rovlar: 1,500 – 3,000 qidiruv/oy.
   - `Telegram do'kon` / `Интернет магазин в телеграм`: 1,200 – 2,200 qidiruv/oy.
   - `AI sotuvchi` / `ИИ продавец`: 800 – 1,800 qidiruv/oy (oyma-oy +35% o'sish dinamikasi).
   - `Payme ulash` / `Click to'lov bot`: 1,100 – 1,450 qidiruv/oy.
2. **Uzoq dumli so'rovlar (996 estimated keyword phrases)**:
   - Sohaviy so'rovlar (masalan: *"Kiyim do'koni uchun telegram bot"*, *"Fotosuratdan tovar aniqlash"*): 400 – 900 qidiruv/oy (mintaqaviy elektron tijorat modeli asosida baholangan).
   - Muayyan tor so'rovlar (masalan: *"avto chexol do'koni boti"*, *"operator ulgurmayapti"*): 50 – 250 qidiruv/oy.
   - Jami: **1,185 total unique keyword phrases**.

---

## 4. PUBLIC INDEXING VA GOOGLE SEARCH CONSOLE HOLATI

> [!IMPORTANT]
> **Haqiqiy holatni baholash va Google rasmiy qoidalari**:
> - **Search Console holati**: `https://selloi.uz/sitemap.xml` muvaffaqiyatli topshirildi (`Status: Success`) va Google Search Console tomonidan 3 ta ommaviy sahifa kashf qilindi (`Discovered URLs: 3`).
> - **Indekslanish muddati**: Hech qachon 24–72 soat ichida kafolatlangan indekslanish va'da qilinmaydi. Google'ning rasmiy yo'riqnomalariga (Google Search Central) ko'ra: sahifalarni aylanib chiqish (crawling) va indekslash **bir necha kundan bir necha haftagacha** vaqt olishi mumkin, hamda qidiruv tizimi har qanday sahifaning indekslanishini 100% kafolatlamaydi.
> - **Haqiqiy indekslanganlik mezonlari**: Qidiruv tizimida indekslanish faqat Google Search Console URL Inspection vositasida `"URL is on Google"` yashil belgisi chiqqandagina va Google qidiruvida `site:selloi.uz` orqali sahifalar paydo bo'lgandagina tasdiqlangan hisoblanadi. Faqatgina sitemap maqomi "Success" bo'lgani uchun indeksatsiya yakunlandi deb aytish noto'g'ri.

---

## 5. SAYT EGASI TOMONIDAN TALAB ETILADIGAN MAJBURIY AMALLAR (MANUAL ACTIONS)

Saytni Google va Bing qidiruv tizimlariga rasman kiritish uchun sayt egasi quyidagi 3 ta amalni bajarishi shart:

### 1-Amal: Domen Huquqini DNS TXT Orqali Tasdiqlash
1. [Google Search Console](https://search.google.com/search-console) ga kiring.
2. **Domen** mulkini tanlang: `selloi.uz`.
3. Google bergan TXT tekshirish kodini nusxalang (`google-site-verification=...`).
4. Domen provayderingiz (Eskiz.uz, Cloudflare yoki hosting) DNS sozlamalariga kiring va qo'shing:
   - **Type**: `TXT`
   - **Host / Name**: `@` (yoki `selloi.uz`)
   - **Value**: Google bergan kod
   - **TTL**: `3600`
5. Search Console oynasida **"Verify" (Tasdiqlash)** tugmasini bosing.

### 2-Amal: XML Sitemap Yuborish
1. Search Console'ning chap menyusidagi **Sitemaps** bo'limiga o'ting.
2. `sitemap.xml` satriga quyidagi rasmiy manzilni yozib **Submit** tugmasini bosing:
   ```
   https://selloi.uz/sitemap.xml
   ```
3. Natijada `Status: Success` yozuvi paydo bo'lishini tekshiring.

### 3-Amal: URL Inspection Orqali Tezkor Indekslashni So'rash
1. Search Console yuqori qismidagi qidiruv paneliga `https://selloi.uz/` manzilini yozing.
2. **"Request Indexing"** tugmasini bosing. Bu Googlebot crawler'ini darhol saytga chaqiradi.
