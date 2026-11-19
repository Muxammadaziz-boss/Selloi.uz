# 1-Telegram Bot Moduli (Telegram Gateway & Protocols)

Ushbu modul Telegram Bot API bilan ishlash, kiruvchi buyruqlarni qabul qilish, tugmalar (inline/reply) va WebApp menyularini boshqarish uchun javobgar mustaqil tizim hisoblanadi.

---

## 📁 Strukturasi

```
1-telegram-bot/
├── config.py                 # Bot sozlamalari va muhit o'zgaruvchilari
├── bot.py                    # Standalone polling orqali ishga tushirish skripti
├── handlers/
│   ├── commands.py           # /start, /help, /operator kabi buyruqlar
│   ├── callbacks.py          # Inline tugmalar bosilganda qayta ishlash
│   ├── keyboards.py          # Reply va Inline tugmalar menyusi
│   └── webhooks.py           # Telegram webhook routeri
├── services/
│   └── telegram_client.py    # Telegram Bot API asinxron HTTP klienti
└── scripts/
    ├── set_webhook.py        # Webhook o'rnatish
    └── test_bot.py           # Bot tokenini tekshirish (getMe)
```

---

## 🚀 Ishga Tushirish

### 1. Bot ulanishini tekshirish:
```bash
python 1-telegram-bot/scripts/test_bot.py
```

### 2. Standalone Polling rejimida yurgizish:
```bash
python 1-telegram-bot/bot.py
```

### 3. Webhook o'rnatish:
```bash
python 1-telegram-bot/scripts/set_webhook.py
```

---

## 🔗 Aloqador Modullar:
- **`2-telegram-user-chat`**: Foydalanuvchi matnli savol berganda, ushbu modulga uzatiladi (Gemini AI va RAG orqali javob olish).
- **`4-admin-dashboard`**: Admin paneldagi sozlamalar bot holatini va javob berish parametrlarini belgilaydi.
