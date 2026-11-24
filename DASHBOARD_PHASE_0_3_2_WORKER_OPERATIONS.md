# SELLOI.UZ - DASHBOARD PHASE 0.3.2
# PERSISTENT WORKER FOYDALANISH VA OPERATSIYALAR QO'LLANMASI (OPERATIONS MANUAL)

**Loyiha:** Selloi.uz - AI Sales Control Center  
**Xizmat:** Worker Supervisor, Durable Inbox & Transactional Outbox  
**Muhit:** Linux / Docker / Uvicorn / PostgreSQL 16 (pgvector)  
**Sana:** 2026-11-24  

---

## 1. WORKER SUPERVISOR ME'MORIY TUZILISHI

Selloi.uz platformasida fon vazifalarini bajarish request-scoped `asyncio.create_task` modelidan persistent `WorkerSupervisor` modeliga o'tkazildi:

```
[ Telegram Webhook ] 
         │
         ▼
[ PostgreSQL: telegram_inbox ] (ACID Persist BEFORE HTTP 200)
         │
         ├─────────────────────────────────────────────┐
         ▼                                             ▼
[ InboxWorker-0 (SKIP LOCKED) ]             [ InboxWorker-1 (SKIP LOCKED) ]
         │                                             │
         ▼                                             ▼
[ Atomic Transaction: Business Logic + Transactional Outbox Staging ]
                                 │
                                 ▼
                   [ PostgreSQL: telegram_outbox ]
                                 │
                                 ▼
                  [ OutboxWorker (Outside Lock) ]
                                 │
                                 ▼
                     [ Telegram Bot API HTTP ]
```

---

## 2. KONFIGURATSIYA VA ENV SOZLAMALARI

| O'zgaruvchi | Standart Qiymat | Tavsif |
| :--- | :--- | :--- |
| `RUN_BACKGROUND_WORKERS` | `false` | Asosiy Uvicorn jarayonida fon workerlarini yoqish. Test va migratsiyalarda `false`, production ishchi podlarida `true` bo'ladi. |
| `WORKER_CONCURRENCY` | `2` | Bir vaqtda ishlovchi Inbox workerlar soni (parallel so'rovlar). |
| `WORKER_BATCH_SIZE` | `10` | Bitta `claim` tranzaksiyasida olinadigan vazifalar maksimal soni. |
| `WORKER_POLL_INTERVAL_SECONDS` | `1.0` | Navbat bo'sh bo'lganda kutish vaqti (soniya). |

---

## 3. QATOR QULFI (ROW LOCK) VA FENCING GENERATION QOIDALARI

1. **`SELECT ... FOR UPDATE SKIP LOCKED`:**
   - Bir nechta Uvicorn yoki alohida konteyner workerlari navbatdagi vazifalarni qabul qilganda, qulflangan qatorlar boshqa workerlar tomonidan e'tiborsiz qoldiriladi (`SKIP LOCKED`).
   - Bu to'liq to'qnashuvsiz (zero lock contention) va taqsimlangan parallelizmni kafolatlaydi.

2. **Monoton Fencing Generation:**
   - Har bir yangi `claim` jarayonida `fencing_generation = (fencing_generation or 0) + 1` qilinadi.
   - Agar birinchi worker vaqtincha muzlab qolsa (masalan, tarmoq pauzasi) va uning ijarasi (`lease_expires_at`) tugab, vazifani ikkinchi worker olsa:
     - Ikkinchi worker `fencing_generation` ni oshiradi.
     - Birinchi worker uyg'onib, natijani yozmoqchi bo'lganida uning `fencing_generation` i eskirgani sababli so'rov qat'iyan rad etiladi.

---

## 4. XAVFSIZ TO'XTATISH (GRACEFUL SHUTDOWN) PROTOKOLI

- Serverga `SIGTERM` yoki `SIGINT` signali kelganda, FastAPI `lifespan` bloki `worker_supervisor.stop(timeout=10.0)` ni chaqiradi.
- `stop_event.set()` orqali yangi partiyalarni qabul qilish darhol to'xtatiladi.
- Ayni vaqtda bajarilayotgan (`active_inbox_jobs`, `active_outbox_jobs`) vazifalar xavfsiz yakunlanishi uchun 10 soniyagacha kutish kafolatlanadi.
- Agar muddat o'tib ketsa, qolgan vazifalar bekor qilinadi (`cancel`), ammo ma'lumotlar bazasida ularning ijarasi 60 soniyadan so'ng avtomatik tugaydi va server qayta yoqilganda boshqa worker tomonidan davom ettiriladi (hech qanday xabar yo'qolmaydi).

---

## 5. MONITORING VA DIAGNOSTIKA METRIKALARI

`worker_supervisor.get_diagnostics()` orqali olinadigan parametrlar:

```json
{
  "is_running": true,
  "concurrency": 2,
  "batch_size": 10,
  "poll_interval": 1.0,
  "active_inbox_jobs": [],
  "active_outbox_jobs": [],
  "supervisor_metrics": {
    "inbox_claimed": 1420,
    "inbox_processed": 1418,
    "inbox_failed": 2,
    "outbox_dispatched": 890,
    "outbox_failed": 0
  },
  "queue_metrics": {
    "inbox": {
      "pending": 0,
      "processing": 0,
      "retry": 1,
      "completed": 1418,
      "dead_letter": 1,
      "expired_leases": 0,
      "oldest_pending_age_seconds": 0.0
    },
    "outbox": {
      "pending": 0,
      "processing": 0,
      "retry": 0,
      "sent": 890,
      "uncertain": 0,
      "dead_letter": 0,
      "expired_leases": 0,
      "oldest_pending_age_seconds": 0.0
    }
  }
}
```

---

## 6. DEAD-LETTER QUEUE (DLQ) VA NOSOZ ISHLARNI TIKLASH

- Agar biror yangilanish 5 marta (`max_attempts=5`) muvaffaqiyatsiz bo'lsa, u `dead_letter` holatiga o'tkaziladi.
- Operatorlar `SELECT * FROM telegram_inbox WHERE status = 'dead_letter'` orqali xato sababini (`last_error`) tahlil qiladilar.
- Xatolik bartaraf etilgach, `UPDATE telegram_inbox SET status = 'pending', attempts = 0 WHERE id = :id` orqali vazifani qayta faollashtirish mumkin.
