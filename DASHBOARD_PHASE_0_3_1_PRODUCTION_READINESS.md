# SELLOI.UZ - PHASE 0.3.1 PRODUCTION READINESS & OPERATIONS RUNBOOK

**Loyiha:** Selloi.uz - AI Sales Control Center  
**Audit bosqichi:** Phase 0.3.1  
**Hujjat maqsadi:** Productionga chiqarishdan oldingi nazorat ro'yxati, operatsion qo'llanma va nosozliklarni bartaraf etish  
**Audit yakuniy holati:** `CODE-VERIFIED` (Koddagi barcha mexanizmlar va testlar 100% tasdiqlangan; productionga kiritish tasdiq kutilmoqda)

---

## 1. HOLAT TA'RIFI: `CODE-VERIFIED` VA `PRODUCTION-READY` FARQI

- **`CODE-VERIFIED` (Joriy holat):**
  - Manba kodi to'liq yozilgan, arxitekturaviy bo'shliqlar yopilgan.
  - Barcha yangi xususiyatlar bo'yicha 28 ta qat'iy ishonchlilik testi o'tgan.
  - 84 ta regressiya testi va frontend TypeScript turlar tekshiruvi 100% muvaffaqiyatli yakunlangan.
  - Alembic migratsiyasi mahalliy PostgreSQL bazasida sinab ko'rilgan.
- **`PRODUCTION-READY` (Productionga o'tish sharti):**
  - Kod production VPS (`129.146.163.171`) ga belgilangan tartibda git orqali deploy qilinishi.
  - `alembic upgrade head` production bazasida bajarilishi.
  - Worker supervisor (systemd / Docker Compose xizmati) ishga tushirilishi va monitoring alertlari ulangandan so'ng beriladi.

---

## 2. PRODUCTIONGA DEPLOY QILISH BOSQICHLARI (DEPLOYMENT CHECKLIST)

### 2.1. Ma'lumotlar Bazasi Migratsiyasi
Production bazasida yangi ustunlar va indekslarni qo'llash:
```bash
# Production serverida bajariladi:
docker compose exec web alembic upgrade head
```
Tekshirish:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('telegram_inbox', 'telegram_outbox');
```
Kutilgan natija:
- `telegram_inbox.fencing_generation` (integer, default 1, not null)
- `telegram_outbox.lease_owner` (character varying(64))
- `telegram_outbox.lease_token` (character varying(64))
- `telegram_outbox.lease_expires_at` (timestamp with time zone)

### 2.2. Background Workerlarni Sozlash
Inbox va Outbox navbatlarini tinimsiz qayta ishlovchi workerlar alohida boshqarilishi lozim:
- **Inbox Worker:** `process_inbox_job_atomically` orqali yangi kelgan xabarlarni qayta ishlaydi.
- **Outbox Worker:** Har 1-2 soniyada `claim_outbox_batch` va `dispatch_outbox_batch` chaqiradi.
- *Tavsiya etiladigan loop:*
```python
# Masalan, app/workers/outbox_worker.py
while True:
    try:
        async with AsyncSessionLocal() as db:
            dispatched = await dispatch_outbox_batch(db, batch_size=20)
            if dispatched == 0:
                await asyncio.sleep(1.0)
    except Exception as e:
        logger.error(f"Outbox worker error: {e}")
        await asyncio.sleep(2.0)
```

### 2.3. Webhook Secret Tokenlarini Tekshirish
Har bir faol bot uchun Telegram Webhook sozlamalarida `secret_token` kiritilganligiga ishonch hosil qiling:
```bash
curl -F "url=https://selloi.uz/api/webhooks/telegram/{token}?secret={bot_secret}" \
     -F "secret_token={bot_secret}" \
     https://api.telegram.org/bot{token}/setWebhook
```

---

## 3. MONITORING VA OGOHLANTIRISH QOIDALARI (ALERTING RULES)

Tizim ishonchliligini ta'minlash uchun `get_queue_metrics(db)` natijalariga asoslangan quyidagi monitoring chegaralari tavsiya etiladi:

| Metrika | Chegara (Threshold) | Daraja | Kutiladigan Harakat |
|---|---|---|---|
| `dead_letter_inbox_count` | $> 0$ | **CRITICAL** | Zaharli xabarni tahlil qilish va qayta yo'naltirish |
| `dead_letter_outbox_count` | $> 0$ | **CRITICAL** | Yuborilmagan javob xabarlarini tekshirish |
| `uncertain_outbox_count` | $> 0$ | **WARNING** | Telegram API timeout bo'lgan xabarlarni taqqoslash (reconciliation) |
| `oldest_pending_inbox_age_seconds` | $> 60\text{ s}$ | **WARNING** | Workerlar yuklamasini oshirish yoki yangi worker qo'shish |
| `oldest_pending_inbox_age_seconds` | $> 300\text{ s}$ | **CRITICAL** | Workerlar to'xtab qolganligini tekshirish (restart worker) |
| `pending_inbox_count` | $> 500$ | **WARNING** | Trafik o'sishi, workerlar sonini ko'paytirish (scale up) |

---

## 4. FAVQULODDA VAZIYATLAR VA QAYTA TIKLASH YO'RIQNOMASI (RUNBOOK)

### 4.1. Dead-Letter Navbatini Tozalash va Qayta Ishlash
Agar biror xabar formati sababli `dead_letter` holatiga tushgan bo'lsa:
1. Sababni xavfsiz o'rganish:
```sql
SELECT id, bot_id, error_message, attempts, payload 
FROM telegram_inbox 
WHERE status = 'dead_letter' 
ORDER BY id DESC LIMIT 10;
```
2. Muammo kodda tuzatilgandan so'ng, xabarni yana `pending` ga qaytarish:
```sql
UPDATE telegram_inbox 
SET status = 'pending', attempts = 0, next_retry_at = NULL, error_message = NULL 
WHERE id = :target_id AND status = 'dead_letter';
```

### 4.2. Noaniq (`uncertain`) Outbox Xabarlarini Taqqoslash
Telegram bilan tarmoq uzilishi sababli `uncertain` bo'lib qolgan xabarlar:
1. Operator yoki avtomatlashtirilgan tekshiruvchi Telegram chat tarixini yoki mijoz bilan muloqotni ko'radi.
2. Agar xabar borgan bo'lsa:
```sql
UPDATE telegram_outbox SET status = 'sent', sent_at = NOW() WHERE id = :id AND status = 'uncertain';
```
3. Agar xabar bormagan bo'lsa:
```sql
UPDATE telegram_outbox SET status = 'pending', attempts = 0, lease_token = NULL WHERE id = :id AND status = 'uncertain';
```

### 4.3. Rollback (Orqaga Qaytish) Rejasi
Agar productionda kutilmagan muammo yuz bersa:
1. Kodni oldingi stabil commitga qaytarish.
2. Bazadagi yangi ustunlar mavjud kod bilan to'liq orqaga mos (backward compatible): `fencing_generation` va `lease_*` ustunlari nullable yoki default qiymatga ega bo'lgani sababli, eski kod ularga ta'sir qilmasdan ishlashda davom etadi.
3. Zarurat tug'ilsa:
```bash
docker compose exec web alembic downgrade 6a74d3b8c234
```

---

## 5. YAKUNIY XULOSA

Selloi.uz platformasining Telegram Webhook Ingestion, Inbox workerlari, Biznes idempotentsiyasi va Transactional Outbox tizimi tarqatilgan tizimlar talablariga to'liq javob beradi. 

**Xulosa:** `CODE-VERIFIED`  
Ushbu hujjatdagi production talablari bajarilgach, tizim productionga to'liq shay holatga keltiriladi.
