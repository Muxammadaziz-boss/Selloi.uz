# SELLOI.UZ - DASHBOARD PHASE 0.3.2
# TO'LIQ TEST MATRITSASI VA ISHONCHLILIK NATIJALARI

**Loyiha:** Selloi.uz - AI Sales Control Center  
**Sana:** 2026-11-24  
**Audit bosqichi:** Phase 0.3.2  
**Test Suite:** Pytest 9.2.0, Python 3.11.9, TypeScript 5.8  

---

## 1. TESTLARNING YAKUNIY STATISTIKASI

| Test To'plami | Fayl | Testlar Soni | O'tgan | Xato | Holati |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Worker Hayot Sikli & Nazorati** | `tests/test_phase0_3_2_worker_lifecycle.py` | 7 | 7 | 0 | PASSED |
| **Durable Inbox & Outbox Ishonchliligi** | `tests/test_phase0_3_1_reliability.py` | 28 | 28 | 0 | PASSED |
| **Markazlashgan Narxlar Tizimi** | `tests/test_centralized_pricing_engine.py` | 12 | 12 | 0 | PASSED |
| **Obuna & Billing Hayot Sikli** | `tests/test_subscription_billing_lifecycle.py` | 42 | 42 | 0 | PASSED |
| **Media Zaxira Xavfsizligi (Symlinks)** | `tests/test_backup_phase2a.py` | 19 | 18 | 0 (1 skip) | PASSED |
| **To'lov Xavfsizligi (TezCheck/HMAC)** | `tests/test_payment_security_remediation.py` | 14 | 14 | 0 | PASSED |
| **Onboarding & Autentifikatsiya** | `tests/test_onboarding.py` | 2 | 2 | 0 | PASSED |
| **Tashkilot & Webhook Sozlamalari** | `tests/test_phase3_onboarding.py` | 6 | 6 | 0 | PASSED |
| **Moliyaviy Formula & Token Narxlari** | `scripts/financial_formula_trace.py` | 18 | 18 | 0 | PASSED |
| **Frontend TypeScript Turlari** | `web/` (npm run typecheck) | 1 | 1 | 0 | PASSED |

---

## 2. PHASE 0.3.2 WORKER LIFECYCLE TEST MATRITSASI

| ID | Test Nomi | Tavsif | Natija |
| :--- | :--- | :--- | :--- |
| **W1** | `test_01_supervisor_startup_and_graceful_shutdown` | WorkerSupervisor fon vazifalarini ishga tushiradi va shutdown signali bilan xavfsiz to'xtatadi. | PASSED |
| **W2** | `test_02_inbox_worker_processes_pending_items_across_restart` | `pending` holatidagi yangilanishlar worker tomonidan qabul qilinadi va qayta yuklashdan keyin ham saqlanib qayta ishlanadi. | PASSED |
| **W3** | `test_03_expired_lease_recovery_increments_fencing_generation` | Worker buzilib to'xtaganda muddati o'tgan ijara boshqa worker tomonidan tiklanadi va `fencing_generation` ortadi. | PASSED |
| **W4** | `test_04_bounded_concurrency_disjoint_claims` | Ikki parallel worker partiyalarni qabul qilganda bir-birini takrorlamaydigan to'plamlarni oladi (`SKIP LOCKED`). | PASSED |
| **W5** | `test_05_outbox_worker_dispatches_batch_and_handles_uncertain_timeout` | Outbox worker blokirovkasiz jo'natadi va tashqi server timeout berganda xavfsiz `uncertain` holatini qayd etadi. | PASSED |
| **W6** | `test_06_webhook_ingestion_persists_before_ack` | Webhook HTTP 200 javobini qaytarishdan oldin yangilanish PostgreSQL ga yozilganini kafolatlaydi. | PASSED |
| **W7** | `test_07_supervisor_diagnostics_metrics` | WorkerSupervisor navbat chuqurligi va ishlov statistikalarini real vaqtda to'liq taqdim etadi. | PASSED |

---

## 3. AREA A-G AUDIT 0.3.1 REGRESSIYA NATIJALARI

- **Area A (Webhook intake & ACID persistence):** 6/6 PASSED (`test_a1` - `test_a6`)
- **Area B (Worker leases & monotonic fencing):** 6/6 PASSED (`test_b1` - `test_b6`)
- **Area C (Idempotency & tenant isolation):** 5/5 PASSED (`test_c1` - `test_c5`)
- **Area D (Atomic transaction boundaries):** 2/2 PASSED (`test_d1`, `test_d2`)
- **Area E (Transactional outbox & uncertain timeouts):** 6/6 PASSED (`test_e1` - `test_e6`)
- **Area F (Canonical state machines):** 2/2 PASSED (`test_f1`, `test_f2`)
- **Area G (Queue observability & metrics):** 1/1 PASSED (`test_g1`)

---

## 4. MOLIYAVIY HISOB-KITOB VA STATIK TUR KAFOLATI

1. **`scripts/financial_formula_trace.py` (18/18 PASSED):**
   - Gemini modellarining kirish va chiqish token narxlari to'liq mos keladi.
   - Mikro-USD butun sonli hisob-kitoblari (sub-cent calls) 1-sentlik sun'iy to'siqsiz ishlaydi.
   - Jonli baza ko'rsatkichlari (MRR: $416.0, ARR: $4992.0, ARPU: $104.0, Gross Margin: 100.0%) to'liq tekshirildi.

2. **Frontend Typecheck (`npm run typecheck --prefix web`):**
   - Next.js / TypeScript loyihasida xatoliklar soni: 0.
