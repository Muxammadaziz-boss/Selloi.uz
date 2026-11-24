# SELLOI.UZ - DASHBOARD PHASE 0.3.3 WORKER OPERATIONS MANUAL

**Loyiha:** Selloi.uz - AI Savdo Boshqaruv Markazi  
**Hujjat:** Worker Jarayonlarini Boshqarish va Ishga Tushirish Yo'riqnomasi (Operations Runbook)  
**Bosqich:** Phase 0.3.3 - Reliability Hardening & Production Readiness  

---

## 1. JARAYONLAR TOPOLOGIYASI (PROCESS TOPOLOGY)

Ishlab chiqarish (Production) muhitida tizim ikkita mustaqil jarayon turiga ajratiladi:

```
                       +---------------------------------------+
                       |           Internet (Telegram)         |
                       +-------------------+-------------------+
                                           |
                                           v
                       +---------------------------------------+
                       |           Nginx / Ingress             |
                       +-------------------+-------------------+
                                           |
                                           v
+----------------------------------------------------------------------------------+
| WEB API PROCESS (Uvicorn)                                                        |
| Command: uvicorn app.main:app --host 0.0.0.0 --port 8000                         |
|                                                                                  |
| Vazifasi:                                                                        |
|  1. Telegram Webhook yangilanishlarini qabul qilish.                              |
|  2. Token va imzoni tekshirish (fail-fast).                                      |
|  3. Yangilanishni darhol PostgreSQL `telegram_inbox` ga yozish (HTTP 200).       |
|  * Hech qanday og'ir biznes mantiq yoki AI chaqiruvlarini bajarmaydi.            |
+------------------------------------------+---------------------------------------+
                                           |
                                           v
+----------------------------------------------------------------------------------+
| POSTGRESQL DURABLE STORAGE                                                       |
| Jadvallar:                                                                       |
|  - `telegram_inbox`  (Received updates, status: pending/processing/completed)    |
|  - `telegram_outbox` (Staged outbound messages, status: pending/sent/uncertain)  |
|  - `orders`, `conversations`, `messages`                                         |
+------------------------------------------+---------------------------------------+
                                           ^
                                           |
+----------------------------------------------------------------------------------+
| DEDICATED WORKER PROCESS                                                         |
| Command: python -m app.services.worker_supervisor                                |
|                                                                                  |
| Vazifasi:                                                                        |
|  1. Inbox Worker: `SELECT ... FOR UPDATE SKIP LOCKED` orqali yangi               |
|     xabarlarni oladi, Gemini AI savdo mantiqini yurgizadi, buyurtma yaratadi     |
|     va javob xabarini `telegram_outbox` ga saqlaydi.                             |
|  2. Outbox Worker: `telegram_outbox` dagi xabarlarni oladi, Telegram API ga      |
|     yuboradi, yuborilgach `assistant` xabari sifatida qayd etadi.                |
|  3. Heartbeat & Fencing: Har bir partiyada `fencing_generation` ni yangilaydi.   |
|  4. Graceful Drain: SIGTERM/SIGINT olinganda faol vazifalarni xavfsiz yakunlaydi.|
+----------------------------------------------------------------------------------+
```

---

## 2. ISHGA TUSHIRISH VA SOZLASh BUYRUQLARI

### 2.1. Standalone Worker Jarayonini Ishga Tushirish
Dedicated Worker jarayonini alohida konteynerda yoki systemd orqali ishga tushirish:

```bash
# To'g'ridan-to'g'ri Python moduli orqali
python -m app.services.worker_supervisor
```

### 2.2. Muhit O'zgaruvchilari (Environment Variables)
Worker jarayoni quyidagi asosiy sozlamalardan foydalanadi:

| O'zgaruvchi | Standart Qiymat | Tavsif |
| :--- | :--- | :--- |
| `DATABASE_URL` | - | PostgreSQL ulanish manzili (`postgresql+asyncpg://...`) |
| `WORKER_CONCURRENCY` | `4` | Bir vaqtning o'zida ishlovchi parallel inbox workerlar soni |
| `WORKER_BATCH_SIZE` | `10` | Bitta partiyada olinadigan xabarlar soni |
| `WORKER_POLL_INTERVAL` | `1.0` | Navbat bo'sh bo'lganda kutish vaqti (soniya) |
| `WORKER_SHUTDOWN_TIMEOUT` | `10.0` | Xavfsiz to'xtash uchun beriladigan maksimal vaqt (soniya) |
| `APP_ENV` | `production` | Ish muhiti (`production`, `development`) |

### 2.3. Systemd Service Namunasi (`/etc/systemd/system/selloi-worker.service`)
```ini
[Unit]
Description=Selloi.uz Dedicated Background Worker
After=network.target postgresql.service

[Service]
Type=simple
User=selloi
WorkingDirectory=/opt/selloi/backend
ExecStart=/opt/selloi/backend/.venv/bin/python -m app.services.worker_supervisor
Restart=always
RestartSec=5
TimeoutStopSec=15
KillSignal=SIGTERM
EnvironmentFile=/opt/selloi/backend/.env

[Install]
WantedBy=multi-user.target
```

---

## 3. MONITORING VA METRIKALAR

### 3.1. Navbat Holatini Tekshirish (SQL Queries)

```sql
-- 1. Inbox navbati chuqurligi (Lag)
SELECT status, count(*) AS count
FROM telegram_inbox
GROUP BY status;

-- 2. Outbox navbati va yuborilmay qolgan noaniq xabarlar
SELECT status, count(*) AS count
FROM telegram_outbox
GROUP BY status;

-- 3. Qotib qolgan (stale lease) vazifalarni aniqlash
SELECT id, bot_id, status, lease_owner, lease_expires_at, fencing_generation
FROM telegram_inbox
WHERE status = 'processing' AND lease_expires_at < NOW();

-- 4. Noaniq (uncertain) tarmoq xatolarini tekshirish
SELECT id, event_type, status, last_error, attempts, created_at
FROM telegram_outbox
WHERE status = 'uncertain'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 4. XAVFSIZ TO'XTATISH VA DRAIN PROCEDURASI

Worker konteynerini yoki servisini yangilashda:
1. Servisga `SIGTERM` yuboriladi:
   `systemctl stop selloi-worker`
2. `WorkerSupervisor` yangi vazifalarni qabul qilishni to'xtatadi (`is_running = False`).
3. Ayni paytda bajarilayotgan inbox va outbox tranzaksiyalari (maksimal 10 soniya ichida) to'liq yakunlanadi.
4. Lizinglar toza holatda qoldirilib, jarayon 0 kodi bilan chiqadi.
5. Yangi versiya ishga tushganda navbatdagi qolgan vazifalar davom ettiriladi.

---

**Fayl havolasi:** [DASHBOARD_PHASE_0_3_3_WORKER_OPERATIONS.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/DASHBOARD_PHASE_0_3_3_WORKER_OPERATIONS.md)
