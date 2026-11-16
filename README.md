# AI Sales Assistant & E-Commerce Platform

Telegram orqali avtomatlashtirilgan AI savdo assistenti, public veb-do'kon (storefront) va do'kon boshqaruv paneli (SaaS Admin Dashboard).

---

## 🏛 Loyihaning 4 Ta Asosiy Moduli

Loyiha arxitekturasi qat'iy va mustaqil ravishda **4 ta asosiy qismga** ajratilgan:

```
├── 1-telegram-bot/          # 1-Telegram Bot Gateway & Buyruqlar
├── 2-telegram-user-chat/     # 2-Telegram User Chat & AI Dvigateli (Gemini RAG)
├── 3-sayt-publik/            # 3-Public Veb-Do'kon & Telegram WebApp
└── 4-admin-dashboard/        # 4-Sotuvchilar va Admin Boshqaruv Paneli
```

---

### 1️⃣ `1-telegram-bot` (Telegram Bot tomoni)
Telegram Bot API bilan to'g'ridan-to'g'ri ishlovchi aloqa shlyuzi.
- **Vazifasi:** Telegram serverlaridan keluvchi xabarlar, buyruqlar (`/start`, `/help`, `/operator`) va tugmalar hodisalarini qabul qilish.
- **Xususiyatlari:** Inline va Reply tugmalar, WebApp ochish havolasi, Webhook routeri va mustaqil Polling ishga tushirish imkoniyati.
- **Batafsil:** [1-telegram-bot/README.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/1-telegram-bot/README.md)

### 2️⃣ `2-telegram-user-chat` (Telegram User Chat tomoni)
Mijoz bilan aqlli savdo muloqotini olib boruvchi AI miya.
- **Vazifasi:** Foydalanuvchining har bir savolini tahlil qilish, do'kon tovarlari haqida aniq ma'lumot berish, buyurtmalarni shakllantirish va operatorga topshirish.
- **Xususiyatlari:** Google Gemini (3.1 Flash Lite / 2.5 Flash), RAG katalog qidiruvi (to'qima narxlarsiz), operatorga uzatish (human handover) va mijoz sessiyalarini boshqarish.
- **Batafsil:** [2-telegram-user-chat/README.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/2-telegram-user-chat/README.md)

### 3️⃣ `3-sayt-publik` (Sayt Publik tomoni - Onlayn Do'kon)
Tashqi xaridorlar uchun mustaqil onlayn veb-do'kon va Telegram WebApp.
- **Vazifasi:** Xaridorlarga tovarlarni vizual ko'rish, toifalar bo'yicha saralash, savatga yig'ish va buyurtma berish imkonini berish.
- **Xususiyatlari:** Zamonaviy qorong'i/yorug' mavzu, Telegram WebApp bilan to'liq integratsiya, savat (cart) boshqaruvi va kelajakdagi to'lov tizimlari (Payme, Click, Uzum).
- **Batafsil:** [3-sayt-publik/README.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/3-sayt-publik/README.md)

### 4️⃣ `4-admin-dashboard` (Sotuvchilar va Admin Dashboard tomoni)
Do'kon egalari va sotuvchi operatorlar uchun keng qamrovli boshqaruv tizimi.
- **Vazifasi:** Jonli suhbatlarni kuzatish va aralashish (takeover), tovarlar va buyurtmalarni boshqarish, AI sozlamalari, billing va rollar matritsasi.
- **Xususiyatlari:** Next.js 15, 3 ta mustaqil dizayn tizimi (Premium Linear, Apple iOS, Classic), 16 ta modulli bo'lim va to'liq ikki tillilik (UZ/EN).
- **Batafsil:** [4-admin-dashboard/README.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/4-admin-dashboard/README.md)

---

## ⚡ Tezkor Ishga Tushirish

### Backend & API Server:
```bash
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Admin Dashboard (Next.js 15):
```bash
npm --prefix web run dev
# yoki
npm --prefix 4-admin-dashboard run dev
```

### Public Storefront:
```bash
python -m http.server 5000 --directory 3-sayt-publik
```

### Telegram Bot:
```bash
python 1-telegram-bot/bot.py
```
