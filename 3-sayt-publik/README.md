# 3-Sayt Publik Moduli (Public Storefront & Telegram WebApp)

Ushbu modul tashqi xaridorlar va mijozlar uchun mo'ljallangan mustaqil, zamonaviy onlayn e-tijorat do'koni veb-saytidir. U brauzerda alohida ishlay oladi hamda Telegram ichida WebApp (Mini App) sifatida ochiladi.

---

## 📁 Strukturasi

```
3-sayt-publik/
├── index.html              # Asosiy e-tijorat sahifasi (Hero, qidiruv, toifalar, saralangan tovarlar)
├── catalog.html            # To'liq mahsulotlar katalogi (filtrlash, narx saralash)
├── cart.html               # Savatcha va buyurtmani rasmiylashtirish (Checkout, to'lov usullari)
├── css/
│   └── storefront.css      # Zamonaviy qorong'i/yorug' mavzuli, Telegram WebApp moslashuvchan dizayni
├── js/
│   ├── api.js              # Backend REST API bilan aloqa (/api/v1/products, /api/v1/orders)
│   └── storefront.js       # Savatcha holati (localStorage), Telegram WebApp SDK integratsiyasi
├── sync_storefront.py      # Mahsulotlarni bazadan JSON formatida sinxronlash skripti
└── README.md
```

---

## 🌟 Imkoniyatlari

1. **Telegram WebApp Native Moslashuv:**
   - `Telegram.WebApp.ready()` va `expand()` orqali Telegram ichida to'liq ekranli ilova kabi ochiladi.
   - Telegram mavzusining ranglari (`--tg-theme-bg-color`) bilan avtomatik uyg'unlashadi.
   - Telegram pastki asosiy tugmasi (`MainButton`) orqali bir teginishda savatga o'tish.
2. **Tezkor Qidiruv va Toifalar:**
   - Smartfonlar, Noutbuklar, O'yin pristavkalari, Aksessuarlar bo'yicha oniy filtrlash.
3. **Savatcha va Buyurtma (Checkout):**
   - Mahsulot sonini oshirish/kamaytirish.
   - Yetkazib berish manzili va telefon raqami shakli.
4. **Kelajakdagi To'lov Tizimlari Integratsiyasi:**
   - 💵 Naqd / Mahsulotni qabul qilganda to'lash
   - 🔵 Click Evolution API
   - 🟢 Payme Merchant API
   - 🟣 Uzum Nasiya / Bo'lib to'lash

---

## 🚀 Ishga Tushirish

Oddiy statik veb-server sifatida yoki Nginx orqali ochish mumkin:
```bash
# Python orqali lokal test qilish:
python -m http.server 5000 --directory 3-sayt-publik
```
Brauzerda: `http://localhost:5000`
Telegram Botda: `@your_bot` menyusida WebApp URL sifatida ko'rsatiladi.
