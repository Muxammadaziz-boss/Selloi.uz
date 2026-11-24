# SELLOI.UZ - DASHBOARD PHASE 0.3
# DURABLE WEBHOOK & IDEMPOTENCY REMEDIATION LOG

**Project:** Selloi.uz - AI Sales Control Center  
**Audit Stage:** Phase 0.3 - Durable Webhook Processing & Idempotency Hardening  
**Date:** 2026-11-23  
**Status:** **ALL REMEDIATIONS APPLIED & VERIFIED (84/84 TESTS PASSING)**  

---

## FINDING 0.3-1: Ephemeral In-Memory / Detached Async Task Loss on Worker Crash

- **Finding ID:** `SEC-03-001`
- **Severity:** Critical
- **Area:** Webhook Processing & Reliability (Area A/B)
- **Reproduction Steps:**
  1. Telegram delivers update via `POST /api/v1/webhooks/telegram/{bot_id}`.
  2. Webhook handler checks Redis lease or in-memory lock, returns HTTP 200 OK immediately, and launches `asyncio.create_task(process_update(...))`.
  3. Worker process crashes immediately after returning HTTP 200 (e.g. host reboot, deployment rollout, SIGKILL, or OOM).
  4. Telegram considers the update delivered because it received HTTP 200 OK and never retries.
  5. The detached in-memory background task terminates without running to completion; customer order/message is permanently lost.
- **Root Cause:** Acknowledging HTTP 200 OK to the upstream provider before ensuring durable, transactional persistence of the update payload.
- **Correction:**
  - Designed and created PostgreSQL table `telegram_inbox` via SQLAlchemy model `TelegramInbox` in `app/models.py`.
  - Added unique constraint `uq_telegram_inbox_bot_update` on `(bot_id, update_id)`.
  - Updated `telegram_webhook` in `app/api/webhooks.py` to call `record_inbox_update` synchronously: incoming updates are persisted to PostgreSQL with `status='pending'` before HTTP 200 is returned.
  - If a worker crashes at any moment, the row in `telegram_inbox` remains persisted and is automatically claimed and processed by the worker pool.
- **Files Changed:**
  - `app/models.py`
  - `app/api/webhooks.py`
  - `app/services/durable_inbox.py`
  - `alembic/versions/6a74d3b8c234_add_telegram_inbox_and_outbox.py`
- **Regression Tests:** `test_a1_inbox_record_creation_before_http200`, `test_a2_inbox_unique_constraint_deduplication`.
- **Result:** PASSED. Updates are ACID-persisted in PostgreSQL prior to HTTP 200 response; duplicates are safely rejected without exception.

---

## FINDING 0.3-2: Split-Brain Processing and Unfenced Lock Recovery Under Latency/GC Pauses

- **Finding ID:** `SEC-03-002`
- **Severity:** High
- **Area:** Multi-Worker Concurrency & Distributed Locking (Area B)
- **Reproduction Steps:**
  1. Worker 1 claims an update with a 60-second lease.
  2. Worker 1 encounters a high latency event (e.g., long external API call, GC pause, or database lock wait) exceeding 60 seconds.
  3. The lease expires; Worker 2 sweeps and claims the expired job.
  4. Worker 1 recovers from the pause and completes execution, updating the status to `processed` or modifying related records.
  5. Worker 2 is simultaneously executing the same update, causing concurrent conflicting operations and data race conditions.
- **Root Cause:** Absence of monotonic or unique fencing tokens verified at the persistence boundary during job completion.
- **Correction:**
  - Implemented atomic multi-worker batch claiming via `SELECT ... FOR UPDATE SKIP LOCKED` in `claim_inbox_batch`.
  - Each job claim generates a unique cryptographic UUID `lease_token`.
  - Job completion (`complete_inbox_job`) and job failure (`fail_inbox_job`) enforce strict conditional database predicates: `WHERE id = :job_id AND lease_token = :lease_token`.
  - If Worker 1 attempts to finalize a job whose lease expired and was claimed by Worker 2, the `UPDATE` affects 0 rows, rejecting the stale worker's late completion.
  - Added `renew_inbox_lease` allowing long-running operations to safely extend lease time.
- **Files Changed:**
  - `app/services/durable_inbox.py`
- **Regression Tests:** `test_b1_skip_locked_concurrent_worker_isolation`, `test_b2_worker_lease_expiration_and_recovery`, `test_b3_fencing_token_rejects_stale_worker_completion`, `test_c3_worker_lease_renewal_prevents_premature_expiry`.
- **Result:** PASSED. Workers claim disjoint jobs with zero lock contention; expired leases are safely recovered; stale completions are rejected by fencing tokens.

---

## FINDING 0.3-3: Duplicate Order Generation from Retried Telegram Webhook Updates

- **Finding ID:** `SEC-03-003`
- **Severity:** High
- **Area:** Business Logic & Financial Integrity (Area D)
- **Reproduction Steps:**
  1. Customer sends an order message via Telegram.
  2. Update is delivered and worker begins order creation (`Order(...)`, `db.commit()`).
  3. A temporary network hiccup occurs before confirmation is sent back, causing Telegram or client to retry.
  4. If webhook deduplication fails or if a second worker processes a duplicate delivery, `Order(...)` was called again without an idempotency key.
  5. A second, identical order record was inserted with a new primary key, distorting inventory, metrics, and billing.
- **Root Cause:** Relying solely on upstream transport-level deduplication without database-enforced business-level idempotency keys.
- **Correction:**
  - Added `idempotency_key: Mapped[str | None] = mapped_column(String(120), unique=True, index=True, nullable=True)` to `Order` in `app/models.py`.
  - Created unique database index `ix_orders_idempotency_key` via Alembic migration `6a74d3b8c234`.
  - Injected deterministic idempotency key derivation in all order creation entrypoints:
    - Business messages: `order:biz:{connection_id}:{chat_id}:{msg_id}`
    - Direct bot messages: `order:direct:{chat_id}:{msg_id}`
    - Bot manager: `order:botmgr:{org_id}:{chat_id}:{msg_id}`
  - If a collision occurs (`IntegrityError`), the transaction rolls back cleanly and fetches the existing order record.
- **Files Changed:**
  - `app/models.py`
  - `app/api/webhooks.py`
  - `app/services/bot_manager.py`
  - `alembic/versions/6a74d3b8c234_add_telegram_inbox_and_outbox.py`
- **Regression Tests:** `test_d1_order_creation_business_idempotency_key`, `test_d2_order_idempotency_key_constraint_prevents_duplicate`, `test_d3_business_connection_message_idempotent_order`.
- **Result:** PASSED. Business operations are strictly idempotent; duplicate deliveries safely resolve to the existing entity.

---

## FINDING 0.3-4: Poison Pill Updates Blocking Processing Queue (Missing Dead-Letter Quarantine)

- **Finding ID:** `SEC-03-004`
- **Severity:** Medium
- **Area:** Queue Reliability & Resilience (Area C)
- **Reproduction Steps:**
  1. A malformed or unprocessable Telegram update payload enters the queue.
  2. Worker claims the update; parsing or execution raises an unhandled exception.
  3. Job is returned to queue or lease expires.
  4. Next worker claims the exact same job, crashes again, in an infinite failure loop, starving other pending updates.
- **Root Cause:** Lack of an attempts counter, exponential backoff, and dead-letter quarantine mechanism.
- **Correction:**
  - Added `attempts`, `max_attempts` (default 5), and `next_attempt_at` columns to `telegram_inbox`.
  - Implemented exponential backoff in `fail_inbox_job`: delay is calculated as `delay = min(300, (2 ** attempts) * 5)` seconds.
  - If `attempts >= max_attempts`, `fail_inbox_job` sets `status = 'dead_letter'`, permanently removing the poison pill from active worker sweeps and logging `last_error`.
- **Files Changed:**
  - `app/models.py`
  - `app/services/durable_inbox.py`
- **Regression Tests:** `test_c1_exponential_backoff_calculation`, `test_c2_max_attempts_dead_letter_quarantine`.
- **Result:** PASSED. Failed updates back off exponentially; poison pills are safely quarantined to `dead_letter` without blocking queue throughput.

---

## FINDING 0.3-5: Non-Transactional Downstream Notifications Leading to Inconsistent State

- **Finding ID:** `SEC-03-005`
- **Severity:** Medium
- **Area:** Outbound Messaging & Side-Effect Reliability (Area E)
- **Reproduction Steps:**
  1. An order or alert is committed to the database.
  2. Worker attempts to call Telegram Bot API `sendMessage` directly over HTTP.
  3. External network fails or Telegram Bot API returns 502 Bad Gateway.
  4. The business record exists in the database, but the customer or seller notification is lost forever.
- **Root Cause:** Dual-write anti-pattern: performing external network I/O in the same execution path as database state transitions.
- **Correction:**
  - Implemented the Transactional Outbox pattern with `TelegramOutbox` model in `app/models.py`.
  - Outbound notifications are staged synchronously with the business transaction using `stage_outbox_event` and a unique `idempotency_key`.
  - Added `dispatch_outbox_batch`: dedicated outbox dispatcher sweeps pending outbox events using `FOR UPDATE SKIP LOCKED`, calls external API, and marks `status='processed'`.
  - On network failure, outbox events are retried with backoff without re-running business logic.
- **Files Changed:**
  - `app/models.py`
  - `app/services/durable_inbox.py`
  - `alembic/versions/6a74d3b8c234_add_telegram_inbox_and_outbox.py`
- **Regression Tests:** `test_e1_outbox_staging_atomicity_and_unique_key`, `test_e2_outbox_dispatch_worker_marks_processed`, `test_e3_outbox_retry_on_network_failure`.
- **Result:** PASSED. Downstream side effects are guaranteed at-least-once delivery; external network failures are safely retried.
