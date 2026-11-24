# SELLOI.UZ - DASHBOARD PHASE 0.3
# DURABLE WEBHOOK & IDEMPOTENCY TEST MATRIX

**Project:** Selloi.uz - AI Sales Control Center  
**Audit Stage:** Phase 0.3 - Durable Webhook Processing & Idempotency Hardening  
**Date:** 2026-11-23  
**Status:** **ALL AUTOMATED TESTS PASSING (84/84)**  

---

## 1. PHASE 0.3 CORE TEST MATRIX (`tests/test_phase0_3_durable_inbox.py`)

| ID | Area | Test Function | Scenario Tested | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---|:---|:---:|
| **A1** | Durable Inbox | `test_a1_inbox_record_creation_before_http200` | Inbound Telegram update received via HTTP webhook | Update synchronously persisted into `telegram_inbox` with status `pending` before HTTP 200 is returned | Row committed to `telegram_inbox`; HTTP 200 `{"ok": True}` returned; payload matches | **PASS** |
| **A2** | Durable Inbox | `test_a2_inbox_unique_constraint_deduplication` | Duplicate delivery of identical `(bot_id, update_id)` | Second delivery deduplicated cleanly without error or duplicate database rows | First call returns HTTP 200; duplicate returns HTTP 200; DB holds exactly 1 row | **PASS** |
| **A3** | Durable Inbox | `test_a3_inbox_malformed_payload_safety` | Ingestion of empty or malformed JSON payloads | Safely rejected or recorded without database crash | Non-dict or empty payloads rejected with HTTP 400 Bad Request; database integrity preserved | **PASS** |
| **B1** | Multi-Worker Queue | `test_b1_skip_locked_concurrent_worker_isolation` | Concurrent workers claiming batch with `SKIP LOCKED` | Workers receive non-overlapping disjoint sets of inbox records without locking contention | Worker 1 and Worker 2 claim disjoint job IDs; 0 overlap detected | **PASS** |
| **B2** | Multi-Worker Queue | `test_b2_worker_lease_expiration_and_recovery` | Worker crashes while holding active lease | Expired lease automatically reclaimed by subsequent worker after lease expiry | Expired `processing` row successfully claimed by Worker 2 with new lease token | **PASS** |
| **B3** | Multi-Worker Queue | `test_b3_fencing_token_rejects_stale_worker_completion` | Stale worker whose lease expired attempts completion | Completion rejected; active worker's lease token is not overwritten | Completion returns `False`; record remains locked by active worker with current fencing token | **PASS** |
| **C1** | Error & Backoff | `test_c1_exponential_backoff_calculation` | Temporary execution failure triggering backoff | `attempts` incremented, `next_attempt_at` calculated via exponential backoff | `attempts=1`, `next_attempt_at` advanced by ~10s (`min(300, 2**attempts * 5)`); status `pending` | **PASS** |
| **C2** | Error & Backoff | `test_c2_max_attempts_dead_letter_quarantine` | Repeated failures exceeding `max_attempts` threshold | Record quarantined to `dead_letter` status; removed from active worker sweeps | Status transitioned to `dead_letter`; excluded from subsequent worker claims | **PASS** |
| **C3** | Error & Backoff | `test_c3_worker_lease_renewal_prevents_premature_expiry` | Long-running task periodically calling lease renewal | Lease expiration timestamp extended without changing fencing token | `lease_expires_at` extended by 60s; job remains exclusively owned | **PASS** |
| **D1** | Idempotency | `test_d1_order_creation_business_idempotency_key` | Order created from webhook direct chat message | Order saved with deterministic `idempotency_key` | Order saved with `idempotency_key = "order:direct:{chat_id}:{msg_id}"` | **PASS** |
| **D2** | Idempotency | `test_d2_order_idempotency_key_constraint_prevents_duplicate` | Repeated order creation with identical `idempotency_key` | Database constraint blocks duplicate order; reuses existing record | Unique constraint `ix_orders_idempotency_key` prevents second insert; returns existing order | **PASS** |
| **D3** | Idempotency | `test_d3_business_connection_message_idempotent_order` | Business connection message processing | Order saved with business-scoped `idempotency_key` | Order created with `idempotency_key = "order:biz:{conn_id}:{chat_id}:{msg_id}"` | **PASS** |
| **E1** | Transactional Outbox | `test_e1_outbox_staging_atomicity_and_unique_key` | Outbound event staged with idempotency key | Event staged with status `pending`; duplicate key rejected | Row created in `telegram_outbox`; duplicate `idempotency_key` raises unique collision | **PASS** |
| **E2** | Transactional Outbox | `test_e2_outbox_dispatch_worker_marks_processed` | Outbox dispatcher sweeping pending outbound messages | Messages delivered via sender callback; marked `processed` | Sender callback executed with payload; status transitioned to `processed` | **PASS** |
| **E3** | Transactional Outbox | `test_e3_outbox_retry_on_network_failure` | External Telegram API network failure during dispatch | Event retried with backoff; not marked processed | `attempts` incremented; `next_retry_at` delayed; status preserved as `pending` | **PASS** |

---

## 2. FULL REGRESSION SUITE EXECUTION RESULTS

| Test Suite | File Path | Total Tests | Passed | Failed | Status |
|:---|:---|:---:|:---:|:---:|:---:|
| **Phase 0.3 Durable Inbox Suite** | `tests/test_phase0_3_durable_inbox.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 0.2 Security Suite** | `tests/test_phase0_2_security.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 0.1 Deep Security Suite** | `tests/test_phase0_1_deep_security.py` | 11 | 11 | 0 | **PASS (100%)** |
| **Phase 0 Dashboard Security Suite** | `tests/test_phase0_dashboard_security.py` | 9 | 9 | 0 | **PASS (100%)** |
| **Phase 0 Base Security Suite** | `tests/test_phase0_security.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 1 Security Suite** | `tests/test_phase1_security.py` | 10 | 10 | 0 | **PASS (100%)** |
| **SaaS Platform & Billing Suite** | `tests/test_saas.py` | 9 | 9 | 0 | **PASS (100%)** |
| **TOTAL TEST CORPUS** | **7 Comprehensive Suites** | **84** | **84** | **0** | **PASS (100%)** |

---

## 3. SUMMARY OF TEST TOTALS

```text
================================================================================
TOTAL TESTS RUN:            84
TOTAL TESTS PASSED:         84 (100.0%)
TOTAL TESTS FAILED:          0 (0.0%)
TOTAL TESTS BLOCKED:         0 (0.0%)
TOTAL TESTS NOT TESTED:      0 (0.0%)
================================================================================
FRONTEND TYPECHECK:         0 ERRORS (npx tsc --noEmit: EXIT 0)
================================================================================
FINAL VERDICT:              CODE-VERIFIED (ALL APPLICATION CHECKS PASSING)
================================================================================
```
