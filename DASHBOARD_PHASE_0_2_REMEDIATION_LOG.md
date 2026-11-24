# SELLOI.UZ - DASHBOARD PHASE 0.2
# SECURITY REMEDIATION LOG & VULNERABILITY MITIGATION RECORD

**Project:** Selloi.uz  
**Audit Stage:** Phase 0.2 - Final Security Corrections & Production Readiness Verification  
**Date:** 2026-11-23  
**Status:** **ALL REMEDIATIONS APPLIED & VERIFIED**  

---

## FINDING 0.2-1: Fragile Timestamp-Based Session Revocation & Accidental Invalidation

- **Finding ID:** `SEC-02-001`
- **Severity:** High
- **Area:** Authentication & Token Lifecycle (Area A)
- **Reproduction Steps:**
  1. Authenticate user and issue JWT.
  2. Send a `PATCH` request to update profile (e.g. `user.full_name = "New Name"`).
  3. SQLAlchemy automatically bumps `user.updated_at` due to `onupdate=utcnow`.
  4. Subsequent authenticated requests to `/api/v1/auth/me` with the active token compare `user.updated_at.timestamp() > (token_iat + 1)`.
  5. The active token is unexpectedly revoked and rejected with HTTP 401 Unauthorized, logging out legitimate users.
- **Root Cause:** Overloading database entity updated timestamps for cryptographic session versioning, compounded by microsecond vs integer second timestamp discrepancies.
- **Correction:**
  - Added monotonic `token_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)` to `User` and `Admin` in `app/models.py`.
  - Created Alembic migration `5f93c2a7b123_add_token_version_for_session_revocation.py`.
  - Embedded `"tv": int(token_version)` in JWT payload claims in `create_access_token`.
  - Replaced the timestamp comparison in `get_current_user` and `get_current_admin` with strict integer version check: `if token_tv < user.token_version: raise HTTPException(401)`.
  - Updated `logout` and `change_password` to increment `current_user.token_version += 1`.
  - Profile updates modify `full_name` without incrementing `token_version`.
- **Files Changed:**
  - `app/models.py`
  - `alembic/versions/5f93c2a7b123_add_token_version_for_session_revocation.py`
  - `app/dependencies/auth.py`
  - `app/api/onboarding.py`
- **Regression Tests:** `test_a1_immediate_logout_token_rejection`, `test_a2_password_change_invalidates_all_tokens`, `test_a3_profile_update_does_not_accidentally_revoke_sessions`.
- **Result:** PASSED. Sessions are immediately revoked on logout/password change across all workers; profile updates do not cause session disruption.
- **Remaining Risk:** None on application code level. Production DB must run `alembic upgrade head`.

---

## FINDING 0.2-2: Telegram Webhook Update Loss on Worker Crash & Unowned Lock Deletion

- **Finding ID:** `SEC-02-002`
- **Severity:** High
- **Area:** Distributed Webhook Processing & Concurrency (Area B)
- **Reproduction Steps:**
  1. Worker 1 receives update and calls `reserve_update(update_id)` (sets Redis key with 900s TTL).
  2. Worker 1 crashes (SIGKILL or unhandled process abort) before completing execution.
  3. Telegram retries delivery 60 seconds later.
  4. `reserve_update` finds existing `pending` key and returns `{"duplicate": True}`. Telegram permanently ceases retries.
  5. Customer message is permanently lost.
  6. In addition, an unowned `finalize_update(..., success=False)` called `redis.delete(key)`, which could delete another worker's active reservation if a lease expired.
- **Root Cause:** Static 15-minute lease time without worker ownership tokens and lack of atomic ownership verification on release.
- **Correction:**
  - Upgraded `reserve_update(update_id, lease_seconds=60)`: generates unique `owner_token = uuid.uuid4().hex` and stores `pending:{owner_token}` with bounded 60-second lease.
  - Implemented atomic Lua script `TG_FINALIZE_LUA`: checks `redis.get(key) == owner_token` before marking `completed` or deleting. An unowned worker cannot release or overwrite another worker's reservation.
  - Added `renew_update_lease` for long-running message handling.
  - If a worker crashes, the lease automatically expires in 60 seconds, allowing Telegram delivery retries to be safely acquired and processed.
- **Files Changed:**
  - `app/api/webhooks.py`
- **Regression Tests:** `test_b1_worker_crash_pending_lease_expiration_recovery`, `test_b2_worker_reservation_ownership_isolation`, `test_b3_duplicate_telegram_delivery_executes_once`.
- **Result:** PASSED. Lease expiration enables recovery; unowned releases are blocked; duplicate actions are prevented.
- **Remaining Risk:** None.

---

## FINDING 0.2-3: Lateral Client IP Spoofing via RFC1918 Trust & Leftmost XFF Parsing

- **Finding ID:** `SEC-02-003`
- **Severity:** Medium
- **Area:** Trusted Reverse Proxy Configuration (Area C)
- **Reproduction Steps:**
  1. Client connects from private network IP (e.g. `10.0.0.5` or `172.16.0.2` in a shared cloud VPC).
  2. Client injects `X-Forwarded-For: 1.1.1.1, 2.2.2.2`.
  3. `is_trusted_proxy_peer` returned True for all RFC1918 subnets, trusting the header.
  4. Leftmost parsing selected `1.1.1.1`, allowing arbitrary IP rate-limit evasion.
- **Root Cause:** Trusting entire RFC1918 private ranges by default and parsing client-controlled leftmost hops in `X-Forwarded-For`.
- **Correction:**
  - Restricted default trusted proxies strictly to loopback: `127.0.0.1, ::1`.
  - Added `trusted_proxies` setting in `app/core/config.py` (overridable via `TRUSTED_PROXIES` environment variable).
  - Implemented Right-to-Left reverse proxy traversal in `get_trustworthy_client_ip`: starts at the most recent proxy boundary and selects the first non-trusted IP encountered from the right.
  - Discards malformed or injection strings; validates IPv4 and IPv6 syntax.
- **Files Changed:**
  - `app/core/config.py`
  - `app/core/rate_limit.py`
- **Regression Tests:** `test_c1_untrusted_direct_peer_forged_xff_ignored`, `test_c2_trusted_proxy_right_to_left_xff_resolution`, `test_c3_proxy_ipv6_and_malformed_headers`.
- **Result:** PASSED. Untrusted clients cannot spoof headers; reverse proxy chains correctly isolate authentic client IPs.
- **Remaining Risk:** Production reverse proxy must set `TRUSTED_PROXIES` to the exact internal IP of Nginx.

---

## FINDING 0.2-4: Fail-Open Sensitive Rate Limiting during Redis Outage

- **Finding ID:** `SEC-02-004`
- **Severity:** Medium
- **Area:** Redis Failure Policy (Area D)
- **Reproduction Steps:**
  1. Simulate Redis connection timeout or service shutdown.
  2. Rapid brute-force attempts made against login or password endpoints.
  3. Rate limiter fell back to in-memory mode without enforcing a fail-closed policy when Redis was down.
- **Root Cause:** `fail_closed` check was only evaluated inside the exception handler when client was not None, not when `client is None` at startup or after persistent disconnection.
- **Correction:**
  - Updated `limiter.is_allowed`: added explicit `elif fail_closed:` branch when `client is None`.
  - Sensitive brute-force endpoints reject requests with HTTP 429 when Redis is offline.
- **Files Changed:**
  - `app/core/rate_limit.py`
- **Regression Tests:** `test_d1_redis_outage_db_token_revocation_enforced`, `test_d3_sensitive_rate_limiter_fail_closed_policy`.
- **Result:** PASSED. Fail-closed policy triggers accurately on Redis outage.
- **Remaining Risk:** Redis cluster high availability (Sentinel or replication) must be configured in production.

---

## FINDING 0.2-5: Unverified Provider Claims & Click Protocol Absence

- **Finding ID:** `SEC-02-005`
- **Severity:** Low / Informational
- **Area:** Payment Provider Protocol Verification (Area E)
- **Reproduction Steps:**
  1. Inspect codebase for Click payment gateway endpoints or signature implementations.
  2. Find only enum docstring mentions in `billing_service.py` and `models.py`.
  3. No Click API client, no Click merchant secrets, and no Click callback handler exist in the repository.
- **Root Cause:** Conflating aspirational product support with verified implementation.
- **Correction:**
  - Formally audited TezCheck: verified HMAC-SHA256 signature verification, `amount` and `currency` equality checks against `PaymentBill`, and atomic idempotency via `WebhookEvent`.
  - Formally documented Click as **BLOCKED / NOT CONFIGURED** pending merchant onboarding, API keys, and endpoint implementation.
- **Files Changed:**
  - Documentation and test suite verification (`test_e4_click_provider_audit_blocked_status`).
- **Regression Tests:** `test_e1_tezcheck_invalid_signature_rejected`, `test_e2_tezcheck_tampered_amount_or_currency_rejected`, `test_e3_tezcheck_duplicate_callback_idempotent`, `test_e4_click_provider_audit_blocked_status`.
- **Result:** PASSED. TezCheck verified; Click clearly audited as blocked.
- **Remaining Risk:** Click integration must be developed when credentials and provider contracts are signed.
