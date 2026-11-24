# SELLOI.UZ - DASHBOARD PHASE 0.3.3 TEST MATRIX

**Loyiha:** Selloi.uz - AI Savdo Boshqaruv Markazi  
**Bosqich:** Phase 0.3.3 - Reliability Hardening & Production Readiness  
**Test Suite Fayli:** `tests/test_phase0_3_3_reliability_hardening.py`  
**Testlar Soni:** 15 ta  
**Natija:** 15 PASSED / 0 FAILED (100% muvaffaqiyat)  
**Holat:** CODE-VERIFIED  

---

## 1. PHASE 0.3.3 ASOSIY SINOV MATRITSAZI

| Test ID | Test Nomi | Soha (Area) | Sinov Maqsadi va Scenariy | Kutilgan Natija | Haqiqiy Natija |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A1** | `test_a1_business_text_response_staged_to_outbox` | Area A: Outbox Completeness | Mijozdan Telegram Business Connection orqali kelgan savolga AI javobini tashqi API ga to'g'ridan-to'g'ri yubormasdan `telegram_outbox` ga `send_business_text` sifatida saqlash. | Outboxda `status='pending'`, chat_id va javob matni saqlangan qator yaratilishi. | **PASSED** |
| **A2** | `test_a2_handoff_reply_and_operator_alert_staged_to_outbox` | Area A: Outbox Completeness | Mijoz chegirma yoki operator talab qilganda (handoff=True), mijozga javob va operatorlar uchun ogohlantirishni bir vaqtda outboxga joylash. | Outboxda `send_business_text` va `notify_organization_admins` hodisalari atomik saqlanishi. | **PASSED** |
| **A3** | `test_a3_direct_bot_message_staged_to_outbox` | Area A: Outbox Completeness | Botning shaxsiy chatiga kelgan to'g'ridan-to'g'ri xabarga javobni outboxga `send_message` sifatida yozish. | `send_message` hodisasi outboxda yaratilishi va tashqi API blokirovkasiz ishlashi. | **PASSED** |
| **A4** | `test_a4_outbox_dispatch_executes_outside_locks_and_records_assistant_message` | Area A: Outbox Completeness | Outbox dispatcher xabarni Telegram API ga yuborgach, xabarni `sent` deb belgilash va `messages` jadvaliga `assistant` javobini tranzaksion yozish. | `TelegramOutbox.status == 'sent'` va `Message.direction == 'assistant'`. | **PASSED** |
| **A5** | `test_a5_outbox_timeout_enters_uncertain_state` | Area A: Outbox Completeness | Telegram API ga ulanishda `ReadTimeout` yuz berganda xabarni ko'r-ko'rona qayta yubormaslik uchun `uncertain` holatiga o'tkazish. | `TelegramOutbox.status == 'uncertain'` va xatolik matni saqlanishi. | **PASSED** |
| **B1** | `test_b1_inbox_operations_require_mandatory_fencing_generation` | Area B: Mandatory Fencing | `complete_inbox_job`, `fail_inbox_job`, `renew_inbox_lease` chaqirilganda `fencing_generation` berilmasa darhol `ValueError` qaytarish. | `ValueError("...mandatory...")` tashlanishi. | **PASSED** |
| **B2** | `test_b2_stale_worker_wrong_fencing_generation_rejected` | Area B: Mandatory Fencing | Worker A (gen 1) lizingi tugab, Worker B (gen 2) ishni olgach, Worker A ning kech qolgan so'rovlarini rad etish. | Worker A ning yangilash va tugatish so'rovlari `False` qaytaradi, Worker B muvaffaqiyatli tugatadi. | **PASSED** |
| **B3** | `test_b3_expired_lease_cannot_be_completed` | Area B: Mandatory Fencing | Lizing muddati tugagan vazifani token to'g'ri bo'lsa ham tugatishga yo'l qo'ymaslik. | `complete_inbox_job` `False` qaytaradi. | **PASSED** |
| **B4** | `test_b4_outbox_operations_enforce_mandatory_fencing` | Area B: Mandatory Fencing | Outbox bo'yicha majburiy fencing tekshiruvi va lizing muddati tugagan workerlarni rad etish. | Mismatched gen bilan outbox tugatish `False` qaytaradi, yangi worker `True` oladi. | **PASSED** |
| **C1** | `test_c1_verify_database_readiness_validates_mandatory_schema` | Area C: Startup Fail-Fast | To'liq va to'g'ri tuzilgan PostgreSQL bazasida `verify_database_readiness` `ready=True` qaytarishi. | `ready is True` va `missing == []`. | **PASSED** |
| **C2** | `test_c2_verify_database_readiness_detects_missing_columns` | Area C: Startup Fail-Fast | Baza jadvallarida muhim ustunlar (masalan `fencing_generation`) yetishmaganda aniqlash. | `ready is False` va yetishmayotgan ustunlar ro'yxati qaytishi. | **PASSED** |
| **D1** | `test_d1_worker_supervisor_lifecycle_and_diagnostics` | Area D: Worker Lifecycle | `WorkerSupervisor` mustaqil ishga tushishi, navbat diagnostika ko'rsatkichlarini taqdim etishi va toza to'xtashi. | `is_running == True`, navbat ko'rsatkichlari mavjud, graceful stop. | **PASSED** |
| **D2** | `test_d2_one_shot_worker_execution` | Area D: Worker Lifecycle | Inbox va Outbox bir martalik (one-shot) runnerlari deterministik ishlashi. | 1 ta element muvaffaqiyatli qayta ishlanishi. | **PASSED** |
| **E1** | `test_e1_webhook_returns_503_when_database_persistence_fails` | Area E: Ingestion Integrity | Webhook qabul qilishda PostgreSQL inbox yozish muvaffaqiyatsiz bo'lsa, Telegramga 200 emas, HTTP 503 qaytarish. | HTTP 503 `Service Unavailable` qaytishi va Telegram retry qilishi. | **PASSED** |
| **E2** | `test_e2_business_mutation_rollback_prevents_partial_commit` | Area E: Ingestion Integrity | Biznes mantiq xatoga uchraganda, tranzaksiya to'liq orqaga qaytarilishi (rollback) va qisman yozuvlar qolmasligi. | Yaratilgan buyurtma bazadan o'chirilishi, inbox `retry` ga o'tishi. | **PASSED** |

---

## 2. REGRESSIYA VA INTEGRATSIYA TEKSHIRUVI

| Sinov To'plami | Fayl | Sinovlar Soni | O'tgan | Xatolik | Holat |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 0.3.3 Test Suite** | `tests/test_phase0_3_3_reliability_hardening.py` | 15 | 15 | 0 | **100% PASSED** |
| **Moliyaviy Hisob-Kitoblar** | `scripts/financial_formula_trace.py` | 18 | 18 | 0 | **100% PASSED** |
| **Frontend TypeScript** | `npm run typecheck --prefix web` | Barcha fayllar | - | 0 | **0 ERRORS** |

---

**Fayl havolasi:** [DASHBOARD_PHASE_0_3_3_TEST_MATRIX.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/DASHBOARD_PHASE_0_3_3_TEST_MATRIX.md)
