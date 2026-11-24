# SELLOI.UZ - DASHBOARD PHASE 0.3.3 REMEDIATION LOG

**Loyiha:** Selloi.uz - AI Savdo Boshqaruv Markazi  
**Bosqich:** Phase 0.3.3 - Critical Reliability Remediation  
**Sana:** 2026-11-24  
**Holat:** COMPLETED & VERIFIED  

---

## 1. ANIQLANGAN MUAMMOLAR VA ILDIZ SABABLARI (ROOT CAUSES)

### Muammo 1: Telegram API chaqiruvlarining tranzaksiya ichida to'g'ridan-to'g'ri bajarilishi
- **Ildiz sababi:** `app/api/webhooks.py` da `_handle_business_message` va `_handle_direct_bot_message` funksiyalari ichida mijozga javob berish va adminlarga xabar yuborishda `telegram.send_business_text` va `telegram.send_message` bevosita chaqirilayotgan edi.
- **Xavf:** Tashqi Telegram API sekinlashsa yoki vaqtincha ishlamay qolsa, PostgreSQL qator blokirovkasi (`FOR UPDATE`) ushlab qolinadi, baza puli tugaydi va xabarlar yo'qolishi mumkin.
- **Tuzatish:** Barcha xabarlar tranzaksion tarzda `stage_outbox_event` orqali `telegram_outbox` jadvaliga joylanadigan qilindi. Xabarlarni yuborish faqat `dispatch_outbox_batch` orqali qator blokirovkasiz amalga oshiriladi.

### Muammo 2: Fencing Generation ixtiyoriy (optional) bo'lganligi
- **Ildiz sababi:** `complete_inbox_job` va `renew_inbox_lease` funksiyalarida `fencing_generation: int | None = None` qilib qo'yilgan edi. Agar worker avlod raqamini yubormasa, faqat `lease_token` bilan yangilashga ruxsat berilar edi.
- **Xavf:** Lizing muddati tugab, boshqa worker vazifani qayta olganida (lease renewal yoki recovery), eski worker kechikib kelib ishni yakunlab qo'yishi va taqsimlangan poyga holati (split-brain) yuzaga kelishi mumkin edi.
- **Tuzatish:** `fencing_generation: int` majburiy qilindi. Agar u uzatilmasa yoki butun son bo'lmasa, `ValueError` tashlanadi. SQL `WHERE` shartiga `fencing_generation == fencing_generation` va `lease_expires_at > now` majburiy kiritildi.

### Muammo 3: Ishga tushishda nosoz bazani aniqlamaslik (Startup Fail-Closed)
- **Ildiz sababi:** `app/main.py` ishga tushganda jadvallar va ularning ustunlari to'liqligi tekshirilmasdan workerlar boshlanib ketar edi.
- **Xavf:** Agar migratsiya (masalan, `telegram_outbox.fencing_generation`) qo'llanmagan bo'lsa, workerlar ish vaqtida `ProgrammingError` bilan yiqilar edi.
- **Tuzatish:** `verify_database_readiness` yordamida 9 ta majburiy jadval va muhim ustunlar tekshiriladigan qilindi. Production rejimida tayyor bo'lmagan baza darhol serverni to'xtatadi.

### Muammo 4: Web va Worker jarayonlarining bir-biriga bog'liqligi
- **Ildiz sababi:** Workerlar faqat FastAPI ilovasi bilan bitta jarayonda `WorkerSupervisor` orqali orqa fonda ishlar edi.
- **Xavf:** Web-server qayta yuklanganda (masalan, Uvicorn reload) yoki bir nechta Web-workerlar ko'paytirilganda, orqa fondagi workerlar duplicate yoki nazoratsiz bo'lib qolishi mumkin edi.
- **Tuzatish:** `app/services/worker_supervisor.py` fayliga alohida mustaqil jarayon sifatida ishga tushish imkoniyati (`run_standalone_worker()`) qo'shildi.

---

## 2. O'ZGARTIRILGAN FAYLLAR VA MODULLAR

1. `app/models.py`:
   - `TelegramOutbox` modeliga `fencing_generation: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)` ustuni qo'shildi.
2. `app/services/durable_inbox.py`:
   - `claim_outbox_batch` har bir partiyada `fencing_generation` ni oshiradi va 7-talik kortej qaytaradi.
   - `complete_outbox_event`, `fail_outbox_event`, `renew_outbox_lease` funksiyalarida `fencing_generation` majburiy qilindi.
   - `complete_inbox_job`, `fail_inbox_job`, `renew_inbox_lease`, `process_inbox_job_atomically` funksiyalarida `fencing_generation` majburiy qilindi.
   - `dispatch_outbox_batch` barcha Telegram xabar turlarini to'liq qo'llab-quvvatlaydi va yuborilgach `assistant` javobini bazada saqlaydi.
   - `fail_outbox_event` tarmoq timeout holatlarida statusni `uncertain` ga o'tkazadi.
3. `app/api/webhooks.py`:
   - Barcha to'g'ridan-to'g'ri Telegram chaqiruvlari `stage_outbox_event` ga almashtirildi.
   - Chala `commit` lar o'rniga tashqi tranzaksiya boshqaruvi bilan mos `flush` qo'llandi.
4. `app/main.py`:
   - `verify_database_readiness` qo'shildi.
   - Production rejimida sxema va kengaytmalar tekshiruvi fail-closed qilindi.
   - `ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS fencing_generation INTEGER DEFAULT 1` migratsiyasi kiritildi.
5. `app/services/worker_supervisor.py`:
   - Standalone CLI entrypoint (`run_standalone_worker`) qo'shildi.
   - SIGINT/SIGTERM signallari va graceful drain ulandi.
6. `app/services/telegram.py`:
   - `import asyncio` kiritildi.
   - `_get_client()` da event loop almashinuvini xavfsiz aniqlash qo'shildi.
7. `tests/conftest.py`:
   - Test muhitida `telegram_outbox.fencing_generation` migratsiyasi kafolatlandi.
8. `tests/test_phase0_3_3_reliability_hardening.py`:
   - 15 ta ishonchlilik va nosozlikka chidamlilik testlari yaratildi.

---

**Fayl havolasi:** [DASHBOARD_PHASE_0_3_3_REMEDIATION_LOG.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/DASHBOARD_PHASE_0_3_3_REMEDIATION_LOG.md)
