# SELLOI.UZ - DASHBOARD PHASE 0.3
# DURABLE WEBHOOK PROCESSING & IDEMPOTENCY HARDENING AUDIT

**Project:** Selloi.uz - AI Sales Control Center  
**Repository:** https://github.com/Muxammadaziz-boss/Selloi.uz  
**Audit Stage:** Phase 0.3 - Durable Webhook Processing & Idempotency Hardening  
**Auditor:** Senior Backend Architect, Distributed Systems Engineer & Application Security Specialist  
**Date:** 2026-11-23  
**Verdict:** **CODE-VERIFIED** (Production Infrastructure Prerequisites Pending)  

---

## 1. EXECUTIVE SUMMARY

Phase 0.3 was conducted to address the systemic architectural vulnerability where incoming Telegram webhook updates and their downstream side effects relied on ephemeral Redis keys, detached in-memory coroutines (`asyncio.create_task`), and uncoordinated worker execution.

In distributed SaaS platforms, relying exclusively on ephemeral Redis leases and memory queues introduces three fatal failure modes:
1. **Message Loss on Process Abortion:** When a worker crashes (SIGKILL, OOM, host failure, or deployment restart) while executing an in-memory task, uncommitted Telegram updates are lost permanently without retry.
2. **Split-Brain Updates & Lost Messages on Premature Expiry:** If a worker encounters GC pauses or database latency that exceeds lease duration, a secondary worker can claim the same update. Without fencing tokens, the stale worker's late completion or failure can corrupt or overwrite the state of the active worker.
3. **Ghost & Duplicate Business Entities:** Telegram delivery guarantees are strictly "at least once". Retried updates that pass webhook deduplication or retry after internal timeouts can re-execute business logic, generating duplicate customer orders or double-charging balances.

To eliminate these vulnerabilities, Phase 0.3 implements an enterprise-grade **PostgreSQL-backed Durable Inbox and Transactional Outbox Architecture** paired with **Business-Level Idempotency Keys** and **Fencing Lease Tokens**.

### Key Deliverables Implemented & Verified:
1. **Durable Inbox Pattern (`TelegramInbox`):** Incoming Telegram updates are persisted synchronously into PostgreSQL before returning HTTP 200 OK to the Telegram Bot API. Duplicate `(bot_id, update_id)` tuples are rejected cleanly by database constraints.
2. **Atomic Multi-Worker Queue (`SELECT ... FOR UPDATE SKIP LOCKED`):** Safe, non-blocking parallel worker distribution without lock contention.
3. **Fencing Token Protection (`lease_token`):** Stale workers whose lease has expired cannot update, complete, or fail jobs claimed by subsequent workers.
4. **Exponential Backoff & Dead-Letter Queue (DLQ):** Failed jobs are backed off with exponential delay (`min(300, 2**attempts * 5)`). Poison pill payloads exceeding `max_attempts` (default 5) are quarantined to `dead_letter` without blocking the worker queue.
5. **Business-Level Idempotency (`Order.idempotency_key`):** Unique constraint `ix_orders_idempotency_key` ensures that even under duplicate processing or retries, an order for a given message or connection is generated at most once.
6. **Transactional Outbox (`TelegramOutbox`):** Downstream messages, alerts, and customer notifications are committed in the same database transaction as the business mutation, preventing ghost side effects.

### Automated Verification Summary:
- **Phase 0.3 Durable Inbox Suite (`tests/test_phase0_3_durable_inbox.py`):** 15/15 PASSED (100%).
- **Phase 0.2 Security Suite (`tests/test_phase0_2_security.py`):** 15/15 PASSED (100%).
- **Phase 0.1 Deep Security Suite (`tests/test_phase0_1_deep_security.py`):** 11/11 PASSED (100%).
- **Phase 0 Dashboard Security Suite (`tests/test_phase0_dashboard_security.py`):** 9/9 PASSED (100%).
- **Phase 0 Base Security Suite (`tests/test_phase0_security.py`):** 15/15 PASSED (100%).
- **Phase 1 Security & RBAC Suite (`tests/test_phase1_security.py`):** 10/10 PASSED (100%).
- **SaaS Platform & Centralized Pricing Suite (`tests/test_saas.py`):** 9/9 PASSED (100%).
- **Grand Total:** 84/84 automated tests PASSED (100%).

---

## 2. ARCHITECTURAL COMPARISON: PHASE 0.2 VS PHASE 0.3

| Architectural Aspect | Phase 0.2 (Redis Leases & Memory Tasks) | Phase 0.3 (Durable Inbox & Transactional Outbox) |
|:---|:---|:---|
| **Storage Medium** | In-memory Redis keys with TTL | Durable PostgreSQL tables with ACID guarantees |
| **Ingestion Protocol** | HTTP 200 returned after Redis reservation; payload handed to detached `asyncio.create_task` | Update synchronously persisted to `telegram_inbox` table before HTTP 200 OK is returned |
| **Worker Crash Resilience** | In-flight memory tasks lost permanently on worker kill or OOM | Persisted state remains `pending` or expired `processing`; automatically reclaimed by surviving workers |
| **Concurrency & Claiming** | Redis `SET NX EX 60` with client UUID | PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` with explicit database transaction isolation |
| **Stale Worker Defense** | Redis Lua script matching owner token | Monotonic fencing token (`lease_token` UUID) verified in DB `WHERE id = :id AND lease_token = :token` |
| **Poison Pill Handling** | Deleted on error or retried indefinitely until 60s lease expiry | Monitored `attempts` counter; quarantined to `dead_letter` status after `max_attempts` (default 5) |
| **Outbound Messaging** | Direct Telegram API calls during request; lost if network fails | Transactional Outbox (`telegram_outbox`) staged atomically with business mutation and retried reliably |
| **Business Mutation Safety** | Relied entirely on upstream webhook deduplication | Strict database-enforced `Order.idempotency_key` unique constraint (`ix_orders_idempotency_key`) |

---

## 3. SYSTEM ARCHITECTURE & EXECUTION FLOW

```
+-------------------------------------------------------------------------------------------------------+
|                                  SELLOI DURABLE WEBHOOK ARCHITECTURE                                  |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [ Telegram Bot API ]                                                                                 |
|           |                                                                                           |
|           | 1. POST /api/v1/webhooks/telegram/{bot_id}                                                |
|           v                                                                                           |
|  +-------------------------------------------------------------------------------------------------+  |
|  | Webhook Ingestion Layer (app/api/webhooks.py)                                                   |  |
|  |   - Authenticate X-Telegram-Bot-Api-Secret-Token                                                |  |
|  |   - Synchronous Insert into `telegram_inbox` (status='pending', attempts=0)                     |  |
|  |   - Unique Constraint: `(bot_id, update_id)`                                                    |  |
|  |     * Conflict -> Deduplicated, return HTTP 200 {"ok": True}                                    |  |
|  |     * Success  -> Committed to PostgreSQL, return HTTP 200 {"ok": True}                         |  |
|  +-------------------------------------------------------------------------------------------------+  |
|           |                                                                                           |
|           | 2. HTTP 200 OK (Telegram delivery confirmed)                                             |
|           v                                                                                           |
|  +-------------------------------------------------------------------------------------------------+  |
|  | Durable Inbox Worker Pool (app/services/durable_inbox.py)                                       |  |
|  |                                                                                                 |  |
|  |   Worker 1, Worker 2, ... Worker N:                                                             |  |
|  |   SELECT * FROM telegram_inbox                                                                  |  |
|  |   WHERE status IN ('pending', 'processing') AND next_attempt_at <= now()                        |  |
|  |   ORDER BY id ASC LIMIT :batch_size                                                             |  |
|  |   FOR UPDATE SKIP LOCKED                                                                        |  |
|  |                                                                                                 |  |
|  |   Assign unique `lease_token` and `lease_expires_at = now() + 60s`                              |  |
|  +-------------------------------------------------------------------------------------------------+  |
|           |                                                                                           |
|           | 3. Execute Business Logic (app/api/webhooks.py:execute_update_payload)                    |
|           v                                                                                           |
|  +-------------------------------------------------------------------------------------------------+  |
|  | Business Execution & Idempotency Layer                                                          |  |
|  |   - Parse message, order, or connection intent                                                  |  |
|  |   - Generate unique idempotency key: `order:direct:{chat_id}:{msg_id}`                          |  |
|  |   - Database Insert: `orders (..., idempotency_key=...)`                                        |  |
|  |     * IntegrityError / Collision -> Existing order reused safely                                |  |
|  |   - Stage notification to `telegram_outbox` in SAME transaction                                 |  |
|  +-------------------------------------------------------------------------------------------------+  |
|           |                                                                                           |
|           | 4. Job Resolution via Fencing Token Verification                                          |
|           +---------------------------------------+---------------------------------------+           |
|           | Success                               | Failure / Exception                   |           |
|           v                                       v                                       v           |
|  +---------------------------------+   +------------------------------------+   +------------------+  |
|  | complete_inbox_job              |   | fail_inbox_job                     |   | Stale Worker     |  |
|  | UPDATE telegram_inbox           |   | attempts += 1                      |   | WHERE lease_token|  |
|  | SET status='processed'          |   | next_attempt = now() + 2^attempts  |   | != current_token |  |
|  | WHERE id=:id AND lease_token=:t |   | IF attempts >= max_attempts:       |   | Action REJECTED  |  |
|  |                                 |   |   status='dead_letter'             |   | (Fencing Guard)  |  |
|  +---------------------------------+   +------------------------------------+   +------------------+  |
|                                                                                                       |
|  +-------------------------------------------------------------------------------------------------+  |
|  | Outbox Dispatcher Service (dispatch_outbox_batch)                                               |  |
|  |   - Claim pending outbox events (FOR UPDATE SKIP LOCKED)                                        |  |
|  |   - Deliver to external Telegram API via TelegramService                                        |  |
|  |   - Mark processed or retry with exponential backoff                                            |  |
|  +-------------------------------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------------------+
```

---

## 4. CODE MODIFICATIONS & IMPLEMENTATION DETAILS

### 4.1 Database Models (`app/models.py`)
- **`TelegramInbox` Model:**
  - `id`: BigInteger primary key.
  - `bot_id`: String(100), indexed.
  - `organization_id`: Integer, foreign key to `organizations.id`, nullable.
  - `update_id`: BigInteger, indexed.
  - `payload`: JSONB/JSON, contains raw Telegram update dictionary.
  - `status`: String(30), values: `pending`, `processing`, `processed`, `failed`, `dead_letter`.
  - `attempts`: Integer, default 0.
  - `max_attempts`: Integer, default 5.
  - `next_attempt_at`: DateTime(timezone=True), indexed.
  - `lease_owner`: String(100), nullable.
  - `lease_token`: String(64), nullable (fencing token).
  - `lease_expires_at`: DateTime(timezone=True), nullable.
  - `received_at`, `processed_at`, `last_error`, `created_at`, `updated_at`.
  - Constraints: `uq_telegram_inbox_bot_update` on `(bot_id, update_id)`, compound index `ix_telegram_inbox_status_attempt` on `(status, next_attempt_at)`.
- **`TelegramOutbox` Model:**
  - `id`: BigInteger primary key.
  - `organization_id`: Integer, foreign key to `organizations.id`, nullable.
  - `idempotency_key`: String(120), unique index `uq_telegram_outbox_idempotency_key`.
  - `event_type`: String(50), e.g. `telegram_message`, `order_alert`.
  - `payload`: JSONB/JSON.
  - `status`: String(30), values: `pending`, `processing`, `processed`, `failed`.
  - `attempts`: Integer, default 0.
  - `max_attempts`: Integer, default 5.
  - `next_retry_at`: DateTime(timezone=True), indexed.
  - `last_error`, `created_at`, `processed_at`.
- **`Order.idempotency_key` Column:**
  - `idempotency_key: Mapped[str | None] = mapped_column(String(120), unique=True, index=True, nullable=True)`.
  - Guarantees strict business-level deduplication across order creation paths.

### 4.2 Alembic Migration (`alembic/versions/6a74d3b8c234_add_telegram_inbox_and_outbox.py`)
- Created clean, reversible database migration script adding tables `telegram_inbox` and `telegram_outbox`, along with `orders.idempotency_key`.
- Linearized Alembic dependency chain: `5f93c2a7b123` -> `7a19c3b8e452` -> `6a74d3b8c234`.

### 4.3 Durable Inbox Service (`app/services/durable_inbox.py`)
- **`record_inbox_update`:** Safely inserts incoming payload with `ON CONFLICT DO NOTHING` or unique catch.
- **`claim_inbox_batch`:** Uses `SELECT ... FOR UPDATE SKIP LOCKED` to atomically claim pending and expired leases. Assigns unique UUID `lease_token`.
- **`renew_inbox_lease`:** Extends lease duration if `lease_token` matches.
- **`complete_inbox_job`:** Updates status to `processed`, clears lease, strictly guarded by `WHERE id = :id AND lease_token = :token`.
- **`fail_inbox_job`:** Calculates exponential backoff (`min(300, 2**attempts * 5)`). If `attempts >= max_attempts`, transitions to `dead_letter`.
- **`stage_outbox_event`:** Enqueues downstream events into `telegram_outbox` using unique idempotency keys.
- **`dispatch_outbox_batch`:** Sweeps outbox with `SKIP LOCKED`, delivers messages, and supports custom/mock sender callbacks to avoid external network dependencies during tests.
- **`sweep_inbox_and_outbox`:** Consolidated worker loop orchestrating both queues.

### 4.4 Webhook Handler Integration (`app/api/webhooks.py`)
- Refactored `telegram_webhook`: incoming updates are recorded in `TelegramInbox` before returning HTTP 200 `{"ok": True}`.
- Added `execute_update_payload`: central execution dispatcher supporting message commands, business connections, and direct chats.
- Injected business idempotency keys:
  - Business connection messages: `order:biz:{connection_id}:{chat_id}:{msg_id}`
  - Direct bot messages: `order:direct:{chat_id}:{msg_id}`
  - Bot manager messages: `order:botmgr:{org_id}:{chat_id}:{msg_id}`

---

## 5. AUTOMATED TEST SUITE EXECUTION SUMMARY

| Test Suite | File Path | Total | Passed | Failed | Status |
|:---|:---|:---:|:---:|:---:|:---:|
| **Phase 0.3 Durable Inbox** | `tests/test_phase0_3_durable_inbox.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 0.2 Security** | `tests/test_phase0_2_security.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 0.1 Deep Security** | `tests/test_phase0_1_deep_security.py` | 11 | 11 | 0 | **PASS (100%)** |
| **Phase 0 Dashboard Security** | `tests/test_phase0_dashboard_security.py` | 9 | 9 | 0 | **PASS (100%)** |
| **Phase 0 Base Security** | `tests/test_phase0_security.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 1 Security & RBAC** | `tests/test_phase1_security.py` | 10 | 10 | 0 | **PASS (100%)** |
| **SaaS Platform & Billing** | `tests/test_saas.py` | 9 | 9 | 0 | **PASS (100%)** |
| **TOTAL TEST CORPUS** | **7 Suites** | **84** | **84** | **0** | **PASS (100%)** |

Frontend typecheck verification:
- `cd web && npx tsc --noEmit` exited with status `0` (0 errors).

---

## 6. PRODUCTION DEPLOYMENT PREREQUISITES

While the application source code has passed 100% of all automated test suites, the following infrastructure deployment tasks must be completed on the production VPS (`129.146.163.171`):

1. **Database Migration:**
   - Execute `alembic upgrade head` on the production PostgreSQL database.
   - Verifies the addition of `telegram_inbox`, `telegram_outbox`, and `orders.idempotency_key`.
2. **Background Worker Supervisor Setup:**
   - Deploy background worker process (Systemd service or container service) running `sweep_inbox_and_outbox` periodically or continuously.
   - Recommended configuration: 2-4 worker instances with 1-second polling intervals and batch size 20.
3. **Dead-Letter Queue Alerting:**
   - Configure Sentry or Prometheus monitoring for rows in `telegram_inbox` where `status = 'dead_letter'`.
4. **Maintenance Sweep Cron:**
   - Configure daily/weekly cleanup job to prune or archive `processed` inbox records older than 30 days to maintain optimal index performance.

---

## 7. FINAL VERDICT

- **APPLICATION CODE VERDICT:** **CODE-VERIFIED**  
  The durable inbox, transactional outbox, multi-worker SKIP LOCKED claiming, fencing token protection, and business-level idempotency mechanisms are fully implemented, verified with 84 automated tests, and backwards-compatible.

- **PRODUCTION INFRASTRUCTURE VERDICT:** **PRODUCTION-READY: PENDING INFRASTRUCTURE DEPLOYMENT PREREQUISITES**  
  Production deployment must follow the staging migration and supervisor setup documented above.
