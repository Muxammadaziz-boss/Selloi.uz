# SELLOI.UZ - DASHBOARD PHASE 0.1
# REMEDIATION & HARDENING CODE CHANGE LOG

**Project:** Selloi.uz  
**Audit Stage:** Phase 0.1 - Deep Security Verification & Hardening  
**Date:** 2026-11-23  
**Status:** **APPLIED & VERIFIED**  

---

## 1. REMEDIATION OVERVIEW

This document records the exact architectural and code-level modifications implemented during Phase 0.1 to remediate vulnerabilities discovered during adversarial security testing across authentication, distributed rate limiting, webhook processing, proxy security, and multi-tenant isolation.

---

## 2. DETAILED CODE CHANGES

### 1. `app/dependencies/auth.py`
- **Component / Functions:** `get_current_user`, `get_current_admin`
- **Vulnerability Addressed:** Multi-process JWT revocation evasion. Process-local in-memory token blacklists failed across multi-worker Uvicorn setups and during Redis outages.
- **Changes Applied:**
  - Added durable database timestamp validation:
    ```python
    if user.updated_at and token_iat:
        if user.updated_at.timestamp() > (token_iat + 1):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked due to recent password change or logout",
                headers={"WWW-Authenticate": "Bearer"},
            )
    ```
  - Added token invalidation check in `get_current_admin` as well.
  - Ensured algorithm pinning explicitly validates `HS256`.
- **Verification:** `SEC-01-A1`, `SEC-01-A2`, `SEC-01-A3`.

---

### 2. `app/api/onboarding.py`
- **Component / Functions:** `logout`, `change_password`, `ChangePasswordRequest`
- **Vulnerability Addressed:** Logout and password changes did not invalidate active JWTs across separate processes if Redis was unavailable.
- **Changes Applied:**
  - In `logout`: Added `current_user.updated_at = datetime.now(timezone.utc)` and `await session.commit()`. Also registers token in Redis and in-memory store for multi-tiered revocation.
  - In `change_password`: Validates old password with bcrypt, updates hashed password, updates `user.updated_at = datetime.now(timezone.utc)`, and commits.
- **Verification:** `SEC-01-A1`, `SEC-01-A2`, `SEC-01-G1`.

---

### 3. `app/core/rate_limit.py` (New Module)
- **Component / Functions:** `SLIDING_WINDOW_LUA`, `is_trusted_proxy_peer`, `get_trustworthy_client_ip`, `check_rate_limit`
- **Vulnerability Addressed:**
  - Non-atomic Redis pipelines allowed race-condition bursts past limit thresholds.
  - Rejected requests were added to sorted sets, skewing limits.
  - Spoofed `X-Forwarded-For` headers from untrusted clients allowed evasion of IP rate limits.
- **Changes Applied:**
  - Implemented atomic Lua script `SLIDING_WINDOW_LUA`:
    - Removes expired entries (`ZREMRANGEBYSCORE`).
    - Checks `ZCARD`.
    - If `< limit`, inserts unique member (`now:nonce`) and sets TTL.
    - If `>= limit`, calculates remaining TTL of oldest member and returns failure with retry delay.
  - Implemented `is_trusted_proxy_peer`:
    - Validates `request.client.host` against CIDR networks (`127.0.0.0/8`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
    - Untrusted peers have `X-Forwarded-For` completely ignored.
- **Verification:** `SEC-01-B1`, `SEC-01-B2`.

---

### 4. `app/api/webhooks.py`
- **Component / Functions:** `reserve_update`, `finalize_update`, `telegram_webhook`, payment verification
- **Vulnerability Addressed:**
  - Unhandled exceptions during Telegram message processing caused message loss on retries due to pre-emptive deduplication marking.
  - Payment webhooks lacked explicit amount-to-tier price verification.
- **Changes Applied:**
  - Converted Telegram deduplication into a two-phase reservation protocol:
    - Phase 1: `reserve_update(update_id)` atomically reserves `tg_update:{id}` with status `pending`.
    - Phase 2: Execution runs within `try...except`. On success: `finalize_update(update_id, success=True)` marks `completed`. On exception: `finalize_update(update_id, success=False)` deletes the key so Telegram's automatic retry succeeds.
  - Payment webhooks verify amount matches expected plan price before invoking status transitions.
- **Verification:** `SEC-01-C1`, `SEC-01-C2`, `SEC-01-D1`, `SEC-01-D2`.

---

### 5. `web/app/api/proxy/route.ts`
- **Component / Functions:** Next.js reverse proxy handler
- **Vulnerability Addressed:** Unbounded request body sizes (DoS) and potential CSRF attacks on proxy endpoints.
- **Changes Applied:**
  - Added 10MB payload size restriction:
    ```typescript
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    ```
  - Added CSRF Origin and Referer validation on state-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).
  - Strips internal administrative headers (`X-Admin-Telegram-Id`, `X-User-Role`) before forwarding.
  - Path normalization removes `..`, `://`, and `//` sequences.
- **Verification:** `SEC-01-E1`.

---

### 6. `tests/test_phase0_1_deep_security.py` (New Test Suite)
- **Component / Functions:** 11 deep adversarial integration test cases (`test_a1` through `test_g1`)
- **Scenarios Covered:**
  - Cross-process token revocation (`test_a1`).
  - Password change revocation without Redis (`test_a2`).
  - JWT algorithm pinning and tampered claims (`test_a3`).
  - Redis sliding window Lua rate limiter and Retry-After header (`test_b1`).
  - IP rate-limit spoofing defense from untrusted peer (`test_b2`).
  - Telegram atomic duplicate update rejection (`test_c1`).
  - Telegram failure lock release for retry (`test_c2`).
  - Tampered payment amount rejection (`test_d1`).
  - Duplicate payment idempotency (`test_d2`).
  - Cross-tenant boundary authorization enforcement (`test_f1`).
  - Multi-tab session invalidation on logout (`test_g1`).
- **Result:** 11/11 PASSED in 66.24 seconds.
