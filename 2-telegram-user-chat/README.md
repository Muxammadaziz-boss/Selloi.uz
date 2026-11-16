# 2-Telegram User Chat Moduli (Conversational AI & Dialogue Engine)

Ushbu modul Telegram foydalanuvchisi va do'kon o'rtasidagi aqlli muloqotni boshqaruvchi asosiy AI miya hisoblanadi.

---

## 📁 Strukturasi

```
2-telegram-user-chat/
├── config.py                     # AI modellari, harorat, limitlar va eskalatsiya kalit so'zlari
├── prompts/
│   └── sales_prompt.py           # O'zbek tilidagi mukammal sotuvchi assistent tizim promptlari
├── services/
│   ├── ai_agent.py               # Google Gemini API integratsiyasi (fallback modellari bilan)
│   ├── conversation_manager.py   # Mijozlar bilan suhbat tarixi va sessiyalar boshqaruvi
│   ├── human_handover.py         # Operator chaqirish va inson nazoratiga o'tkazish
│   ├── knowledge_retriever.py    # RAG katalog qidiruvi (narx, qoldiq, xususiyatlar)
│   └── order_extractor.py        # Buyurtma ma'lumotlarini (telefon, manzil, soni) ajratib olish
└── test_chat.py                  # Terminal orqali AI bilan jonli suhbat qurish testeri
```

---

## 🌟 Asosiy Imkoniyatlari

1. **Aqlli O'zbek Tili Modeli:** Google Gemini 3.1 Flash Lite / Gemini 2.5 orqali o'zbek tilida tabiiy va sotuvga yo'naltirilgan muloqot.
2. **Haqiqiy RAG (Katalog qidiruvi):** To'qima (hallucination) narxlarning oldini oladi; faqat bazada bor tovarlarni aytadi.
3. **Inson Operatoriga Topshirish (Human Takeover):** Agar mijoz operator talab qilsa yoki shikoyat qilsa, suhbat avtomatik to'xtatilib, operatorga o'tkaziladi.
4. **Buyurtma Aniqlash:** Mijozning telefon raqami, yetkazib berish manzili va tovar sonini matndan avtomatik ajratib oladi.

---

## 🧪 Sinovdan O'tkazish (Terminalda)

```bash
python 2-telegram-user-chat/test_chat.py
```
