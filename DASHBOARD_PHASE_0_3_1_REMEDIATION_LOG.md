# SELLOI.UZ - PHASE 0.3.1 REMEDIATION LOG & ROOT CAUSE ANALYSIS

**Loyiha:** Selloi.uz - AI Sales Control Center  
**Repository:** https://github.com/Muxammadaziz-boss/Telegram-Ai-seller.git  
**Audit bosqichi:** Phase 0.3.1  
**Maqsad:** Ishonchlilik, tarqatilgan tizimlar va tranzaksion yaxlitlik bo'yicha aniqlangan barcha kamchiliklarning sabablari, yechimlari va test dalillari  

---

## 1. TUZATISHLAR JURNALI (REMEDIATION REGISTER)

### REM-01: Inbox Worker Monotonic Fencing Generation
- **Muammo / Zaiflik:** Tarqatilgan tizimlarda worker jarayoni qisqa muddatga to'xtab qolganda (GC pause, network latency), uning lease muddati tugashi va boshqa worker xabarni olishi mumkin. Eski worker qayta uyg'onib, `complete_inbox_job` ni chaqirganda, faqat UUID tokeniga tayanilsa yoki tekshiruv sust bo'lsa, xabar noto'g'ri yakunlanib qoladi (split-brain).
- **Asosiy sabab (Root Cause):** `TelegramInbox` modelida va `durable_inbox.py` funksiyalarida monoton o'suvchi fencing hisoblagichi yo'q edi.
- **Tuzatish (Remediation):**
  - `TelegramInbox` modeliga `fencing_generation: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)` qo'shildi.
  - `claim_inbox_batch` va `renew_inbox_lease` funksiyalarida har safar lease berilganda `row.fencing_generation += 1` bajariladi.
  - `complete_inbox_job` va `fail_inbox_job` funksiyalariga `fencing_generation` parametri kiritildi va WHERE shartiga qo'shildi: `WHERE id = :id AND lease_token = :token AND fencing_generation = :gen`.
- **Ta'sirlangan fayllar:**
  - [app/models.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/models.py)
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
  - [alembic/versions/8c42b1a9f567_phase0_3_1_outbox_leases_and_inbox_fencing.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/alembic/versions/8c42b1a9f567_phase0_3_1_outbox_leases_and_inbox_fencing.py)
- **Test dalili:** `test_b2`, `test_b3`, `test_b5` (PASSED).

---

### REM-02: Kanonik Idempotentsiya Kaliti va Tenant Izolyatsiyasi
- **Muammo / Zaiflik:** Buyurtma idempotentsiya kaliti `order:direct:{chat_id}:{msg_id}` ko'rinishida generatsiya qilingan. Agar ikki xil mijoz ikki xil do'kon (tenant) botida tasodifan bir xil `chat_id` va `msg_id` ga ega bo'lsa, ikkinchi mijozning buyurtmasi birinchi mijozning buyurtmasi bilan to'qnashib, yaratilmay qolardi.
- **Asosiy sabab:** Kalit formatida `organization_id` va `bot_id` yo'q edi.
- **Tuzatish:**
  - `generate_order_idempotency_key` yordamchi funksiyasi yaratildi:
    `f"order:org_{organization_id}:bot_{bot_id}:{chat_id}:{message_id}"`.
  - Webhook va bot manager marshrutlari yangi kanonik generatordan foydalanishga o'tkazildi.
- **Ta'sirlangan fayllar:**
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
  - [app/api/webhooks.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/api/webhooks.py)
  - [app/services/bot_manager.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/bot_manager.py)
- **Test dalili:** `test_c1`, `test_c2`, `test_c3` (PASSED).

---

### REM-03: Idempotent Buyurtma Yaratishda Savepoint Xavfsizligi
- **Muammo / Zaiflik:** Parallel ravishda bir xil webhook bir necha marta kelganda, bir vaqtning o'zida ikkita jarayon `Order` jadvaliga yozishga urinadi. Birinchisi yozadi, ikkinchisi PostgreSQL `unique constraint` xatoligiga uchraydi. Agar ushbu xatolik sessiya darajasida yuz bersa, SQLAlchemy sessiyasi `PendingRollbackError` holatiga tushib qolardi.
- **Asosiy sabab:** Tranzaksiya ichida `begin_nested()` savepoint ishlatilmagan va ob'ekt savepointdan tashqarida `db.add()` qilingan.
- **Tuzatish:**
  - `get_or_create_idempotent_order` funksiyasida `async with db.begin_nested():` bloki joriy etildi.
  - Ob'ekt yaratish va `db.add()` savepoint ichida amalga oshirildi.
  - Agar `IntegrityError` yuz bersa, faqat ichki savepoint orqaga qaytariladi va asosiy sessiya sog'lom qolib, mavjud buyurtmani `SELECT` qilib oladi.
  - Agar mavjud buyurtma boshqa organizatsiyaga tegishli bo'lsa, `PermissionError` ko'tariladi.
- **Ta'sirlangan fayllar:**
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
- **Test dalili:** `test_c4`, `test_c5` (PASSED).

---

### REM-04: Atomik Inbox-to-Biznes-to-Outbox Tranzaksiyasi
- **Muammo / Zaiflik:** Webhook kelganda xabarni o'qish, buyurtma yaratish va javob yuborish alohida tranzaksiyalarda bo'lgan. Agar buyurtma yaratilib, inbox statusini yangilash paytida server o'chib qolsa, xabar qayta ishlanib, ikkinchi marta noto'g'ri operatsiyalar bajarilishi mumkin edi.
- **Asosiy sabab:** Biznes o'zgarishlari va inbox holati o'zgarishi bitta ACID tranzaksiyasiga birlashtirilmagan.
- **Tuzatish:**
  - `process_inbox_job_atomically` funksiyasi yaratildi.
  - Bu funksiya berilgan `business_handler` ni bajaradi, kerakli outbox xabarlarini navbatga qo'yadi va inbox holatini `completed` deb belgilab, bitta `db.commit()` bilan yakunlaydi.
  - Xatolik yuz berganda `db.rollback()` qilinadi va inbox xavfsiz tarzda `retry` ga o'tkaziladi.
- **Ta'sirlangan fayllar:**
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
- **Test dalili:** `test_d1`, `test_d2` (PASSED).

---

### REM-05: Outbox Lock-dan Tashqari Yetkazish (Outside-Lock Delivery)
- **Muammo / Zaiflik:** Oldingi Phase 0.3 da `dispatch_outbox_batch` funksiyasi tashqi Telegram API HTTP so'rovini yuborayotganda `SELECT ... FOR UPDATE` row lockini ushlab turgan. Telegram API sekin ishlaganda PostgreSQL tranzaksiyalari va connection pool to'lib, butun tizim qotib qolish xavfi mavjud edi.
- **Asosiy sabab:** HTTP I/O operatsiyasi ma'lumotlar bazasi tranzaksiyasi ichida bajarilgan.
- **Tuzatish:**
  - Ikki bosqichli ajratish amalga oshirildi:
    1. `claim_outbox_batch`: Qatorlarni `SKIP LOCKED` bilan oladi, holatni `processing` qiladi, lease token va vaqtini qo'yadi va **darhol commit qiladi** (DB locklari darhol bo'shatiladi).
    2. `dispatch_outbox_batch`: HTTP so'rovini DB locklarisiz yuboradi.
    3. Yakunda alohida qisqa tranzaksiya bilan `complete_outbox_event` yoki `fail_outbox_event` chaqiriladi.
- **Ta'sirlangan fayllar:**
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
- **Test dalili:** `test_e1`, `test_e2`, `test_e3` (PASSED).

---

### REM-06: Outbox Leaselarni Boshqarish va Uncertain Holati
- **Muammo / Zaiflik:** Outbox jadvalida lease maydonlari yo'q edi. Tarmoq timeout berganda xabar Telegramga yetib borgan yoki bormaganligi noaniq bo'lsa-da, u darhol `retry` qilinib, mijozga bir xil xabar 2 marta borishiga olib kelishi mumkin edi.
- **Asosiy sabab:** Outbox modeli sodda bo'lgan va tarmoq timeout holati oddiy xato bilan bir xil ko'rilgan.
- **Tuzatish:**
  - `TelegramOutbox` modeliga `lease_owner`, `lease_token`, `lease_expires_at` ustunlari va indeksi qo'shildi.
  - HTTP timeout yuz berganda xabar holati `retry` emas, maxsus `uncertain` deb belgilanadi. Bu xabarni avtomatik qayta jo'natishdan to'xtatadi va operator/reconciliation nazoratiga qoldiradi.
- **Ta'sirlangan fayllar:**
  - [app/models.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/models.py)
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
  - [alembic/versions/8c42b1a9f567_phase0_3_1_outbox_leases_and_inbox_fencing.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/alembic/versions/8c42b1a9f567_phase0_3_1_outbox_leases_and_inbox_fencing.py)
- **Test dalili:** `test_e4`, `test_e5`, `test_e6` (PASSED).

---

### REM-07: Kanonik Holatlar Mashinasi Validatsiyasi
- **Muammo / Zaiflik:** Holatlar oddiy satrlar sifatida o'zgartirilgan. Natijada xatolik bilan `completed` holatidagi xabarni yana `processing` ga o'tkazish xavfi mavjud edi.
- **Asosiy sabab:** Rasmiy Enum va ruxsat etilgan o'tishlar matritsasi yo'qligi.
- **Tuzatish:**
  - `InboxStatus` (`pending`, `processing`, `retry`, `completed`, `dead_letter`) va `OutboxStatus` (`pending`, `processing`, `retry`, `sent`, `dead_letter`, `uncertain`) Enumlar yaratildi.
  - `validate_inbox_transition` va `validate_outbox_transition` yordamida har bir o'tish tekshiriladi.
- **Ta'sirlangan fayllar:**
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
- **Test dalili:** `test_f1`, `test_f2` (PASSED).

---

### REM-08: Webhook Payload Format Validatsiyasi
- **Muammo / Zaiflik:** Webhook routeri kelgan JSON payloadni to'g'ridan-to'g'ri `payload.get("update_id")` deb o'qigan. Agar tajovuzkor JSON massiv `[1, 2, 3]` yoki raqam yuborsa, FastAPI `AttributeError: 'list' object has no attribute 'get'` bilan 500 Internal Server Error berardi.
- **Asosiy sabab:** Turi tekshirilmagan.
- **Tuzatish:**
  - `app/api/webhooks.py` da `if not isinstance(payload, dict): raise HTTPException(status_code=400, detail="Invalid payload: must be a JSON object")` tekshiruvi kiritildi.
- **Ta'sirlangan fayllar:**
  - [app/api/webhooks.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/api/webhooks.py)
- **Test dalili:** `test_a5` (PASSED).

---

### REM-09: Xavfsiz Navbat Metrikalari (Sanitized Observability)
- **Muammo / Zaiflik:** Monitoring vositalari navbatni tekshirganda mijozlarning shaxsiy ma'lumotlari (PII) yoki xabarlari loglarga tushib qolishi xavfi bor edi.
- **Asosiy sabab:** Metrikalar uchun maxsus agregat funksiya yo'qligi.
- **Tuzatish:**
  - `get_queue_metrics(db)` funksiyasi joriy etildi. Faqatgina holat bo'yicha sonlar (`COUNT`) va eng eski xabar vaqti (`MIN(created_at)`) olinadi. Hech qanday chat_id, matn yoki tokenlar olinmaydi.
- **Ta'sirlangan fayllar:**
  - [app/services/durable_inbox.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/services/durable_inbox.py)
- **Test dalili:** `test_g1` (PASSED).

---

### REM-10: Alembic Migratsiyasini Yangilash
- **Muammo / Zaiflik:** Yangi ustunlar va indekslar ishlab chiqish va production muhitida izchil bo'lishi kerak.
- **Tuzatish:**
  - `alembic/versions/8c42b1a9f567_phase0_3_1_outbox_leases_and_inbox_fencing.py` yaratildi.
  - `app/main.py` ishga tushish mexanizmiga xavfsiz `ADD COLUMN IF NOT EXISTS` va `CREATE INDEX IF NOT EXISTS` buyruqlari qo'shildi.
- **Ta'sirlangan fayllar:**
  - [alembic/versions/8c42b1a9f567_phase0_3_1_outbox_leases_and_inbox_fencing.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/alembic/versions/8c42b1a9f567_phase0_3_1_outbox_leases_and_inbox_fencing.py)
  - [app/main.py](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/app/main.py)
- **Test dalili:** `alembic upgrade head` muvaffaqiyatli bajarildi, barcha testlar yangi bazada o'tdi.
