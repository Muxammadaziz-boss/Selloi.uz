# SELLOI.UZ - DASHBOARD PHASE 0.2
# FINAL SECURITY CORRECTIONS & PRODUCTION READINESS AUDIT

**Project:** Selloi.uz  
**Repository:** https://github.com/Muxammadaziz-boss/Selloi.uz  
**Audit Stage:** Phase 0.2 - Final Security Corrections & Production Readiness Verification  
**Auditor:** Principal SaaS Security Engineer & Distributed Systems Architect  
**Date:** 2026-11-23  
**Verdict:** **CODE-VERIFIED** (Production Infrastructure Prerequisites Pending)  

---

## 1. EXECUTIVE SUMMARY

Following the delivery of Phase 0.1, Phase 0.2 was conducted as an adversarial, root-cause verification pass across authentication, distributed webhook processing, reverse proxy header evaluation, Redis failure behaviors, and payment provider protocols.

Through direct source code inspection and test reproductions:
1. **Critical architectural flaws in Phase 0.1 controls were identified and resolved:**
   - **JWT Revocation Precision & False Invalidation:** Phase 0.1 relied on `user.updated_at > iat + 1`. This created a 1-second race window and caused ordinary profile updates (`full_name` changes) to unintentionally invalidate every active session for that user. This was remediated by implementing a dedicated monotonic `token_version` integer in PostgreSQL, eliminating all microsecond/second precision issues.
   - **Telegram Webhook Crash Loss:** Phase 0.1 held `pending` locks for 900 seconds without ownership tokens. A crashed worker left updates locked for 15 minutes, causing Telegram retries to be discarded as duplicates and permanently losing customer messages. Furthermore, unowned releases could wipe out another worker's active reservation. This was remediated with unique UUID ownership tokens, a bounded 60-second lease with automatic recovery, and atomic Lua script ownership verification.
   - **Overly Broad Reverse Proxy Trust:** Phase 0.1 trusted all RFC1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) by default. In shared cloud VPCs or container networks, arbitrary internal peers could forge `X-Forwarded-For`. This was remediated by restricting default trust strictly to loopback (`127.0.0.1`, `::1`), introducing explicit `TRUSTED_PROXIES` configuration, and parsing `X-Forwarded-For` from right to left to isolate the genuine client boundary.
   - **Payment Protocol Audit:** TezCheck HMAC-SHA256 signature verification, tier amount validation, and idempotency were verified. Click integration was determined to be unprovisioned in the codebase (no credentials, no endpoint) and was formally documented as BLOCKED rather than falsely claimed.

2. **Automated Verification:**
   - **Phase 0.2 Security Test Suite (`tests/test_phase0_2_security.py`):** 15/15 PASSED.
   - **Phase 0.1 Deep Security Suite (`tests/test_phase0_1_deep_security.py`):** 11/11 PASSED.
   - **Phase 0 Dashboard Security Suite (`tests/test_phase0_dashboard_security.py`):** 9/9 PASSED.
   - **Phase 0 Base Security Suite (`tests/test_phase0_security.py`):** 15/15 PASSED.
   - **Phase 1 Security Suite (`tests/test_phase1_security.py`):** 10/10 PASSED.
   - **SaaS Platform & Billing Suite (`tests/test_saas.py`):** 9/9 PASSED.
   - **Grand Total:** 69/69 automated tests PASSED (100%).
   - **Frontend Typecheck (`web/`):** 0 errors (`npx tsc --noEmit` exited with code 0).

---

## 2. PHASE 0.1 CLAIMS INDEPENDENTLY CHECKED & REPRODUCED

### Finding 0.2-A: Fragile Timestamp-Based Session Invalidation (Area A)
- **Claimed in 0.1:** Sessions are immediately and durably invalidated by comparing `user.updated_at` against JWT `iat`.
- **Reality Discovered:**
  1. `user.updated_at` has microsecond precision, while JWT `iat` has integer second precision. Adding `+ 1` second allowed a token minted in the same second to remain valid for up to 1000ms after a password change.
  2. Because `User.updated_at` has `onupdate=utcnow` in SQLAlchemy, **any unrelated profile edit** (such as changing full name, phone number, or telegram ID) automatically bumped `updated_at`, causing active user sessions to be unexpectedly destroyed with HTTP 401 Unauthorized.
- **Root Cause:** Overloading entity lifecycle timestamps for cryptographic session versioning.
- **Resolution:** Added `token_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)` to `User` and `Admin`. Embedded `"tv": token_version` in JWT claims. Incrementing `token_version` on logout or password change immediately invalidates all previous tokens across all Uvicorn workers and restarts, while profile updates do not touch `token_version`.

### Finding 0.2-B: Telegram Webhook Update Loss on Worker Crash (Area B)
- **Claimed in 0.1:** Atomic reservation prevents duplicate processing and allows retries on exception.
- **Reality Discovered:**
  1. `is_duplicate_update` used `SET tg_update:{id} pending NX EX 900`. If a worker crashed mid-processing (e.g. OOM, SIGKILL, server restart), the key remained `pending` for 15 minutes. When Telegram retried sending the update, `is_duplicate_update` saw the key and returned `{"ok": True, "duplicate": True}`. The customer message was permanently lost.
  2. `finalize_update(..., success=False)` called `redis.delete(key)` unconditionally without verifying ownership. If a worker took longer than expected and a second worker picked up the update, the first worker's failure could delete the second worker's active reservation.
- **Root Cause:** Missing worker ownership tokens and excessively long lease times without atomic ownership verification.
- **Resolution:**
  1. Implemented unique `owner_token = uuid.uuid4().hex` stored as `pending:{owner_token}` with a bounded 60-second lease (not 900s).
  2. Implemented atomic Lua script `TG_FINALIZE_LUA`: only the worker holding `owner_token` can mark the update as `completed` or release it.
  3. Added `renew_update_lease` for long-running operations.
  4. In the event of a worker crash, the lease automatically expires in 60 seconds, allowing Telegram retries to be safely processed without update loss.

### Finding 0.2-C: Lateral IP Spoofing via RFC1918 Trust (Area C)
- **Claimed in 0.1:** IP rate-limit spoofing defense via proxy peer verification.
- **Reality Discovered:**
  `app/core/rate_limit.py` hardcoded trust for `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. Private addresses are not automatically trusted proxies; in shared cloud subnets or microservices networks, any internal peer could inject `X-Forwarded-For: 1.2.3.4` and evade rate limits. Furthermore, extracting the leftmost IP allowed attackers to prepend fake IPs when passing through a single proxy.
- **Root Cause:** Overly permissive CIDR whitelist and naive leftmost header parsing.
- **Resolution:**
  1. Restricted default trust strictly to loopback (`127.0.0.1`, `::1`). Added `settings.trusted_proxies` configurable via `TRUSTED_PROXIES`.
  2. Implemented strict Right-to-Left reverse proxy traversal: the rightmost untrusted IP in the `X-Forwarded-For` chain is selected as the authentic client IP.
  3. Strict validation against malformed or non-IP strings.

### Finding 0.2-D: Unverified Redis Eviction Behavior (Area D)
- **Claimed in 0.1:** Rate limiting and session blacklists operate reliably across Redis.
- **Reality Discovered:**
  Under high memory pressure, Redis configured with `allkeys-lru` can evict session or rate limit keys before their TTL. In addition, when Redis was completely offline, brute-force sensitive operations fell back to in-memory mode without a configurable fail-closed defense.
- **Resolution:**
  1. Relocated authoritative session revocation entirely into PostgreSQL (`users.token_version`), ensuring that Redis memory evictions or total outages cannot bypass session revocation.
  2. Added `fail_closed=True` support to `limiter.is_allowed`: when Redis is disconnected, sensitive endpoints reject attempts rather than failing open.

### Finding 0.2-E: Payment Provider Protocol Discrepancies (Area E)
- **Claimed in 0.1:** TezCheck and Click payment webhooks are securely verified.
- **Reality Discovered:**
  1. TezCheck is implemented and tested with HMAC-SHA256 signature verification and amount validation.
  2. Click integration is NOT implemented in the repository (no Click merchant credentials in `config.py`, no Click callback router). Claiming protocol compliance for Click was an error.
- **Resolution:**
  1. Formally audited TezCheck: confirmed HMAC-SHA256 signature calculation, `amount` and `currency` equality checking against `PaymentBill`, and atomic idempotency via `WebhookEvent`.
  2. Formally marked Click as **BLOCKED / NOT CONFIGURED** pending merchant contract, service ID, secret key, and endpoint provisioning.

---

## 3. ARCHITECTURE DECISIONS & REMEDIATIONS APPLIED

```
+-----------------------------------------------------------------------------------+
|                              SELLOI SECURITY ARCHITECTURE                         |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ Inbound Request ]                                                              |
|          |                                                                        |
|          v                                                                        |
|  [ Reverse Proxy Boundary (Area C) ]                                              |
|    - Direct peer in settings.trusted_proxies?                                     |
|      * NO  -> Client IP = Direct Socket Peer (XFF completely ignored)             |
|      * YES -> Traverse XFF right-to-left: first non-trusted hop = Real Client IP  |
|          |                                                                        |
|          v                                                                        |
|  [ Distributed Rate Limiter (Area B/D) ]                                          |
|    - Atomic Redis Lua script (Sliding Window ZSET)                                |
|    - Redis Down & fail_closed=True -> Reject HTTP 429                             |
|    - Redis Down & fail_closed=False -> Safe in-memory sliding window fallback     |
|          |                                                                        |
|          v                                                                        |
|  [ Authentication & Token Lifecycle (Area A/D) ]                                  |
|    - Algorithm pinned to HS256                                                    |
|    - Authoritative Check: token.tv >= user.token_version (PostgreSQL ACID)        |
|    - Profile edits do NOT bump token_version                                      |
|    - Logout / Password change increments user.token_version                       |
|    - 100% resilient to Redis outages and multi-worker restarts                    |
|          |                                                                        |
|          v                                                                        |
|  [ Telegram Webhook Ingestion (Area B) ]                                          |
|    - reserve_update: SET tg_update:{id} pending:{owner_token} NX EX 60            |
|    - If worker crashes: 60s lease expires, allowing automatic safe retry          |
|    - finalize_update: Atomic Lua script checks owner_token before DEL/SET         |
|    - Worker cannot release or overwrite another worker's reservation              |
|          |                                                                        |
|          v                                                                        |
|  [ Payment Provider Handling (Area E) ]                                           |
|    - TezCheck: HMAC-SHA256 signature verified with constant-time comparison      |
|    - Price & Currency match verified against PaymentBill before entitlement       |
|    - Idempotency via WebhookEvent unique constraint                               |
|    - Click: Documented as BLOCKED pending merchant provisioning                   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 4. AUTOMATED TEST SUITE EXECUTION SUMMARY

| Test Suite | File Path | Total | Passed | Failed | Status |
|:---|:---|:---:|:---:|:---:|:---:|
| **Phase 0.2 Security** | `tests/test_phase0_2_security.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 0.1 Deep Security** | `tests/test_phase0_1_deep_security.py` | 11 | 11 | 0 | **PASS (100%)** |
| **Phase 0 Dashboard Security**| `tests/test_phase0_dashboard_security.py` | 9 | 9 | 0 | **PASS (100%)** |
| **Phase 0 Base Security** | `tests/test_phase0_security.py` | 15 | 15 | 0 | **PASS (100%)** |
| **Phase 1 Security & RBAC** | `tests/test_phase1_security.py` | 10 | 10 | 0 | **PASS (100%)** |
| **SaaS Platform & Billing** | `tests/test_saas.py` | 9 | 9 | 0 | **PASS (100%)** |
| **TOTAL TEST CORPUS** | **6 Suites** | **69** | **69** | **0** | **PASS (100%)** |

Frontend verification:
- `cd web && npx tsc --noEmit` exited with status `0` (0 errors).

---

## 5. FILES CHANGED & CREATED

1. `app/models.py`: Added `token_version` column to `User` and `Admin` models.
2. `alembic/versions/5f93c2a7b123_add_token_version_for_session_revocation.py`: Alembic database migration.
3. `app/dependencies/auth.py`: Token creation and verification upgraded to use `token_version`. Removed fragile microsecond timestamp checks.
4. `app/api/onboarding.py`: Updated `login`, `register`, `oauth`, and `refresh` to pass user token version. Added `PATCH /auth/profile`. Incremented `token_version` on logout and password change.
5. `app/api/webhooks.py`: Implemented `reserve_update` with UUID ownership tokens, 60s lease, atomic `TG_FINALIZE_LUA`, and `renew_update_lease`.
6. `app/core/config.py`: Added `trusted_proxies` setting (default `127.0.0.1,::1`).
7. `app/core/rate_limit.py`: Implemented right-to-left reverse proxy IP resolution, dynamic trusted proxy network parsing, and `fail_closed` policy support.
8. `tests/test_phase0_2_security.py`: New comprehensive Phase 0.2 security test suite (15 tests).
9. `tests/test_phase0_1_deep_security.py`: Updated fixture to maintain compatibility with token versioning.
10. `tests/test_phase0_dashboard_security.py`: Updated setup fixture to isolate token versions across test runs.

---

## 6. RESIDUAL RISKS & PRODUCTION DEPLOYMENT PREREQUISITES

While local application code is fully verified, production deployment requires the following infrastructure actions:
1. **Database Schema Upgrade:** Apply migration `alembic upgrade head` on the production PostgreSQL cluster to create `users.token_version` and `admins.token_version`.
2. **Reverse Proxy Configuration (Nginx / Cloudflare):**
   - Ensure Nginx strips any incoming `X-Forwarded-For` from external clients before setting `$remote_addr`.
   - Set environment variable `TRUSTED_PROXIES` in production to match Nginx internal IP (e.g. `127.0.0.1` or docker bridge subnet).
3. **Redis Cluster Configuration:** Ensure production Redis uses `maxmemory-policy: volatile-lru` and has persistence enabled (RDB/AOF).
4. **Click Payment Gateway:** Before enabling Click payments in production, obtain official merchant credentials (merchant_id, service_id, secret_key), implement the Click Prepare/Complete protocol, and run sandbox certification tests.

---

## 7. FINAL SECURITY VERDICT

- **APPLICATION CODE VERDICT:** **CODE-VERIFIED**  
  All code-level security controls, session revocation mechanisms, crash recovery protocols, and rate-limiting routines are fully implemented, verified with automated tests, and backwards-compatible.

- **PRODUCTION INFRASTRUCTURE VERDICT:** **PRODUCTION-READY: PENDING INFRASTRUCTURE DEPLOYMENT PREREQUISITES**  
  Production deployment must follow the checklist documented in `DASHBOARD_PHASE_0_2_PRODUCTION_READINESS_CHECKLIST.md`.
