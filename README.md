# Selloi.uz : AI-Powered Sales Automation Platform

Telegram orqali avtomatlashtirilgan aqlli savdo assistenti, ko'p ijarachili (multi-tenant) SaaS boshqaruv paneli va korxona darajasidagi integratsiyalashgan platforma.

---

## Arxitektura va Tizim Komponentlari

Platforma arxitekturasi qat'iy va mustaqil modullarga ajratilgan:

```
├── 1-telegram-bot/          # Telegram Bot Gateway va buyruqlar qayta ishlovchisi
├── 2-telegram-user-chat/     # Telegram foydalanuvchi suhbatlari va AI dvigateli (Gemini RAG)
├── 4-admin-dashboard/        # Do'kon egalari va adminlar boshqaruv paneli (web/)
├── app/                     # FastAPI backend, ma'lumotlar bazasi va biznes mantig'i
└── web/                     # Next.js 15 App Router boshqaruv tizimi
```

---

## Asosiy Modullar

### 1. Telegram Bot Shlyuzi (`1-telegram-bot`)
Telegram Bot API bilan to'g'ridan-to'g'ri aloqa o'rnatuvchi xavfsiz shlyuz.
* **Vazifasi:** Telegram serverlaridan keluvchi xabarlar, buyruqlar (`/start`, `/help`, `/operator`) va tugmalar hodisalarini qabul qilish.
* **Xususiyatlari:** Inline va Reply tugmalar, xavfsiz Webhook routeri va mustaqil xizmat sifatida ishlash imkoniyati.

### 2. Aqlli Suhbat va AI Savdo Dvigateli (`2-telegram-user-chat`)
Mijoz bilan aqlli savdo muloqotini olib boruvchi sun'iy intellekt tizimi.
* **Vazifasi:** Foydalanuvchining har bir savolini tahlil qilish, do'kon tovarlari bo'yicha aniq ma'lumot berish va buyurtmalarni shakllantirish.
* **Xususiyatlari:** Google Gemini (3.1 Flash Lite va 2.5 Flash), RAG katalog qidiruvi (to'qima narxlarsiz), operatorga uzatish (human handover) va sessiyalarni boshqarish.

### 3. Boshqaruv Paneli va SaaS Tizimi (`web/` va `4-admin-dashboard`)
Do'kon egalari, tizim menejerlari va sotuvchi operatorlar uchun executive boshqaruv tizimi.
* **Dizayn yo'nalishi:** Selloi Executive Master Design (Obsidian `#090909`, Carbon `#111111`, Selloi Bronze Gold `#E6A15A`, Geist va Geist Mono tipografiyasi).
* **Ko'p tillilik:** 3 ta to'liq til qo'llab-quvvatlanadi: O'zbekcha (`uz`), Русский (`ru`), English (`en`).
* **16 ta modulli bo'lim:**
  * Boshqaruv paneli (Overview), Jonli suhbatlar (Inbox), Bilimlar bazasi (Knowledge).
  * Mahsulotlar (Products), Buyurtmalar (Orders), Mijozlar (Customers).
  * Suhbatlar tahlili (Analytics), AI assistent sozlamalari (Settings).
  * Limitlar va hisoblagichlar (Usage), Obuna va to'lovlar (Billing), Tarif rejalari (Pricing).
  * Jamoa va ruxsatlar matritsasi (Team), Administratorlar (Admins), Tizim jurnali (Logs), Profil va ko'rinish (Profile).
  * Platforma nazorati: Super-admin do'konlar portfeli (Platform).

---

## Ishlab Chiqish va Ishga Tushirish

### Backend va API Server:
```bash
# Virtual muhitni faollashtirish va ishga tushirish:
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Boshqaruv Paneli (Next.js 15):
```bash
cd web
npm install
npm run dev
```

### Ishlab Chiqarish (Production) Yig'ish:
```bash
cd web
npm run build
npm run start
```

---

## Testlash va Sifat Nazorati (CI/CD)

Platforma GitHub Actions orqali qat'iy tekshiruv eshiklaridan o'tadi:
* **Backend Pytest:** 70 ta avtomatlashtirilgan xavfsizlik va mantiq testlari.
* **Moliyaviy hisob-kitob auditi:** Micro-USD va token hisoblash aniqligi testi (`scripts/financial_formula_trace.py`).
* **Frontend TypeScript va Next.js Build:** Qat'iy `tsc --noEmit` va ishlab chiqarish yig'ilishi.
* **Dizayn huquqlari testi:** 3 ta tarif x 3 ta dizayn tizimi matritsasi (`tests/design_entitlement_suite.mjs`).
* **Playwright E2E:** 16 ta tab, autentifikatsiya, pushState/popState va modallar.
* **Axe-Core WCAG 2.1 AA:** Dark va Light rejimlarda to'liq qulaylik auditi (0 ta xatolik).
* **Responsive Suite:** 5 ta asosiy qurilma o'lchamida gorizontal scrollning yo'qligi.
