# SELLOI.UZ - DASHBOARD PHASE 0.3.2
# TUZATISHLAR VA ME'MORIY YECHIMLAR JURNALI (REMEDIATION LOG)

**Loyiha:** Selloi.uz - AI Sales Control Center  
**Ishchi tarmoq:** `frontend/linear-redesign`  
**Sana:** 2026-11-24  
**Audit bosqichi:** Phase 0.3.2  

---

## 1. AMALGA OSHIRILGAN TUZATISHLAR RO'YXATI

### 1.1. CI Bog'liqliklari va `aiosqlite`
- **Fayllar:** `requirements-dev.txt`, `.github/workflows/ci.yml`
- **Sabab:** `tests/test_centralized_pricing_engine.py` xotiraviy SQLite asinxron drayveri (`aiosqlite`) talab qilar edi. CI da ushbu drayver o'rnatilmagan edi.
- **Yechim:** `requirements-dev.txt` ga `aiosqlite>=0.20.0` va `pytest-asyncio>=0.23.0` qo'shildi. `.github/workflows/ci.yml` da `requirements-dev.txt` o'rnatilishi va aniq drayverlar kiritildi.

### 1.2. Deterministic Database Fixture va Ketma-ketliklar Sinxronizatsiyasi
- **Fayl:** `tests/conftest.py`
- **Sabab:**
  1. Test bazasi initsializatsiyasida xatolar yutib yuborilardi.
  2. Baza jadvallariga kiritilgan birlamchi seed yozuvlaridan keyin PostgreSQL ketma-ketliklari (`sequences`) yangilanmagani sababli keyingi testlarda `UniqueViolationError` vujudga kelardi.
  3. Sessiya boshida `engine.dispose()` chaqirilishi keyingi asinxron testlarda `Event loop is closed` xatosini keltirib chiqarardi.
- **Yechim:** Determinant sxema tekshiruvi, standart ma'lumotlar seed qilinishi (`saas_service.seed_plans_and_defaults`, `admin_service.ensure_owner`, `centralized_pricing_service.seed_or_verify_tariffs`), barcha jadvallar bo'yicha ketma-ketliklarni `pg_get_serial_sequence` orqali to'g'rilash va `finally: await engine.dispose()` yordamida toza yopilish joriy etildi. Xato bo'lsa `pytest.exit(..., returncode=1)` bilan zudlik bilan to'xtatiladi.

### 1.3. Media Backup Symlink Traversal Himoyasi
- **Fayl:** `selloi_backup/media_backup.py`
- **Sabab:** `package_media_directory` funksiyasi `SymlinkSecurityError` ni ushlab, uni umumiy `MediaBackupError` ichiga qayta o'rab yuborardi.
- **Yechim:** `SymlinkSecurityError` to'g'ridan-to'g'ri qayta chaqirildi (`raise`). `tests/test_backup_phase2a.py` to'liq muvaffaqiyatli o'tdi.

### 1.4. Xotiraviy SQLite Sxema To'qnashuvini Bartaraf Etish
- **Fayl:** `tests/test_centralized_pricing_engine.py`
- **Sabab:** `Base.metadata.create_all` PostgreSQL/pgvector ga xos jadvallarni SQLite da yaratishga urinib xatolik berardi.
- **Yechim:** SQLite xotirasida faqat narxlar uchun kerakli jadvallar (`Admin`, `User`, `Plan`, `PlanPriceHistory`, `PaymentBill`, `CustomerPricing`) va `StaticPool` bilan izolyatsiya qilindi. Barcha 12 test 100% o'tdi.

### 1.5. Tarif Rejalari Faolligi (`is_active=True`)
- **Fayl:** `tests/test_subscription_billing_lifecycle.py`
- **Sabab:** Unit testlarda mock `Plan` obyektlari `is_active=True` siz e'lon qilingani uchun tekshiruvda rad etilardi.
- **Yechim:** `Plan` mocklariga `is_active=True` parametri berildi.

### 1.6. Webhook Ingestion va Anti-Data-Loss Arxitekturasi
- **Fayl:** `app/api/webhooks.py`
- **Sabab:** Webhook qabulida PostgreSQL ga yozishdan oldin Redis/xotirada fast-path qulf olinishi sababli, agar baza commit bermasa, keyingi retrylar xato tarzda "duplicate" deb o'tkazib yuborilardi.
- **Yechim:**
  1. Fast-path in-memory rezervatsiyasi olib tashlandi.
  2. Barcha yangilanishlar `record_inbox_update` orqali PostgreSQL `telegram_inbox` jadvaliga `UNIQUE(bot_id, update_id)` bilan ACID saqlangandan so'nggina HTTP 200 beriladi.
  3. Baza nosoz bo'lsa, HTTP 503 qaytariladi.
  4. Maxfiy token tekshiruvi `secrets.compare_digest` orqali mustahkamlandi.

### 1.7. Yangi WorkerSupervisor va Boshqaruv
- **Fayllar:** `app/services/worker_supervisor.py`, `app/main.py`, `app/core/config.py`
- **Yechim:**
  1. `WorkerSupervisor` klassi yaratildi: inbox va outbox uchun alohida `SELECT ... FOR UPDATE SKIP LOCKED` orqali parallel workerlar loopi.
  2. Graceful shutdown: `SIGINT`/`SIGTERM` yoki `stop()` da in-flight vazifalar tugatilib, yangilari olinmaydi.
  3. Konfiguratsiya: `run_background_workers: bool = False` (test va migratsiyalarda o'chirilgan, productionda yoqiladi).
  4. Real-time diagnostika: `get_diagnostics()`.

### 1.8. Worker Hayot Sikli Test To'plami
- **Fayl:** `tests/test_phase0_3_2_worker_lifecycle.py`
- **Yechim:** Worker start/stop, restartdan keyin pending vazifalarni bajarish, crashed worker ijara tiklanishi (`fencing_generation`), parallel ajratilgan qabul qilish (`disjoint claims`), outbox timeout uncertain holati va webhook persist-before-ack ssenariylari 7 ta avtomatlashtirilgan test bilan to'liq qoplandi.
