# 4-Admin Dashboard Moduli (Sotuvchilar va Admin Boshqaruv Paneli)

Ushbu modul do'kon egalari (owner), tizim menejerlari (admin) va sotuvchi operatorlar (moderator) uchun to'liq mustaqil, zamonaviy SaaS boshqaruv paneli hisoblanadi.

---

## 📁 Strukturasi

```
4-admin-dashboard/
├── app/
│   ├── Dashboard.tsx               # Bosh boshqaruv konteyneri va holatlar boshqaruvi
│   ├── layout.tsx                  # Next.js 15 App Router ildiz maketi
│   ├── globals.css                 # Asosiy dizayn o'zgaruvchilari va uslublar
│   ├── components/
│   │   ├── layout/                 # Topbar, Sidebar, PageHeader, CommandPalette, AppShell
│   │   ├── tabs/                   # 16 ta mustaqil modulli bo'limlar (Overview, Inbox, Team...)
│   │   ├── ui/                     # Qayta ishlatiluvchi UI komponentlar (Button, Card, Badge...)
│   │   └── saas/                   # BillingTab, PlatformOwnerTab, UsageTab, Onboarding...
│   ├── design-systems/             # 3 ta mustaqil dizayn tizimi (Premium Linear, iOS, Classic)
│   └── lib/i18n/                   # To'liq ko'p tillilik (UZ/EN) dvigateli va tarjimalar
├── public/                         # Logotiplar, shriftlar va statik resurslar
├── tests/                          # Playwright E2E, WCAG 2.1 AA a11y va moslashuvchanlik testlari
├── package.json                    # Bog'liqliklar va skriptlar
├── tsconfig.json                   # TypeScript qat'iy sozlamalari
└── README.md
```

---

## 🌟 Asosiy Imkoniyatlar va Bo'limlar

1. **Uch Mustaqil Dizayn Tizimi:**
   - **Premium Linear:** Zamonaviy qorong'i Linear uslubi, Olline va Pogonia shriftlari.
   - **Apple iOS Glassmorphism:** Nozik yarim shaffof shisha effekti, silliq burchaklar va fon xiralashuvi.
   - **Classic Enterprise:** Klassik yengil SaaS paneli.
2. **16 Ta Modulli Bo'lim:**
   - *Ish maydoni:* Boshqaruv paneli (Overview), Jonli suhbatlar (Inbox), Bilimlar bazasi (Knowledge).
   - *Savdo:* Mahsulotlar (Products), Buyurtmalar (Orders), Mijozlar (Customers).
   - *Intellekt:* Suhbatlar tahlili (Analytics), AI assistent sozlamalari (Settings).
   - *Tarif & SaaS:* Limitlar va tokenlar (Usage), Obuna va to'lovlar (Billing), Tarif rejalari (Pricing).
   - *Tizim va Xavfsizlik:* Jamoa va ruxsatlar matritsasi (Team), Administratorlar (Admins), Tizim jurnali (Logs), Profil va dizayn (Profile).
   - *Platforma Nazorati:* Barcha do'konlarni boshqaruvchi super-admin zonasi.
3. **To'liq Ikki Tillilik (i18n):**
   - O'zbek tili (Lotin) va Xalqaro Ingliz tili (English).
   - Topbarda va Profil bo'limida bir marta bosish orqali barcha sarlavhalar, bildirishnomalar va jadvallar tilini oniy o'zgartirish.

---

## 🚀 Ishga Tushirish

```bash
# Rivojlanish (Development) rejimi:
npm --prefix 4-admin-dashboard run dev

# Ishlab chiqarish (Production) qurish:
npm --prefix 4-admin-dashboard run build
npm --prefix 4-admin-dashboard run start
```
Brauzerda: `http://localhost:3000`
