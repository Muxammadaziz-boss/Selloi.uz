# SELLOI.UZ - DASHBOARD PHASE 0.1
# SECURITY TEST MATRIX & VERIFICATION RECORD

**Project:** Selloi.uz  
**Audit Stage:** Phase 0.1 - Deep Security Verification & Hardening  
**Date:** 2026-11-23  
**Status:** **ALL TESTS PASSING (54/54)**  

---

## 1. DEEP SECURITY TEST MATRIX (PHASE 0.1)

| Test ID | Area | Scenario / Vulnerability Tested | Pre-condition & Setup | Execution Command | Expected Result | Actual Result | Status | Defense Mechanism Verified |
|:---|:---|:---|:---|:---|:---|:---|:---:|:---|
| `SEC-01-A1` | Area A | Cross-process token revocation after logout | User logs in on Worker A; gets JWT. Logout called on Worker A. Token used on Worker B without shared memory. | `pytest tests/test_phase0_1_deep_security.py -k test_a1` | HTTP 401 Unauthorized; token rejected across processes. | HTTP 401 Unauthorized | **PASS** | DB-backed `user.updated_at` check vs JWT `iat`. |
| `SEC-01-A2` | Area A | Session revocation after password change during Redis outage | User changes password. Redis is unavailable/unreachable. Old token used on API. | `pytest tests/test_phase0_1_deep_security.py -k test_a2` | HTTP 401 Unauthorized; old token invalidated without Redis. | HTTP 401 Unauthorized | **PASS** | In-database `updated_at` timestamp comparison in `get_current_user`. |
| `SEC-01-A3` | Area A | Rejection of JWT `none` algorithm & tampered claims | Malicious JWT crafted with `alg: "none"` or modified `sub` payload. | `pytest tests/test_phase0_1_deep_security.py -k test_a3` | HTTP 401 Unauthorized; signature validation fails. | HTTP 401 Unauthorized | **PASS** | Strict algorithm pinning to `HS256` in `decode_access_token`. |
| `SEC-01-B1` | Area B | Redis Lua sliding window rate limit & 429 Retry-After | Client executes burst of 6 rapid requests against 5 req/min endpoint. | `pytest tests/test_phase0_1_deep_security.py -k test_b1` | 6th request rejected with HTTP 429 and valid `Retry-After` header. | HTTP 429 with integer `Retry-After: > 0` | **PASS** | Atomic `SLIDING_WINDOW_LUA` script executing in single Redis step. |
| `SEC-01-B2` | Area B | IP rate-limit spoofing defense from untrusted peer | External untrusted peer sends rotating `X-Forwarded-For` headers to evade limits. | `pytest tests/test_phase0_1_deep_security.py -k test_b2` | Rate limiter ignores spoofed header and tracks direct peer IP; returns HTTP 429 on exhaustion. | HTTP 429 returned regardless of forged header | **PASS** | `is_trusted_proxy_peer` CIDR validation (`127.0.0.0/8`, `10.0.0.0/8`, etc.). |
| `SEC-01-C1` | Area C | Atomic Telegram webhook deduplication under concurrency | Two concurrent POST requests deliver the exact same Telegram `update_id`. | `pytest tests/test_phase0_1_deep_security.py -k test_c1` | First request acquires lock and processes; second is immediately skipped/deduplicated. | One processed, one duplicate skipped | **PASS** | Atomic `SET key pending NX EX 900` reservation. |
| `SEC-01-C2` | Area C | Webhook error releases lock for delivery retry | Webhook handler crashes or raises exception during execution. | `pytest tests/test_phase0_1_deep_security.py -k test_c2` | Deduplication lock is cleared on failure; Telegram retry is accepted. | Lock key deleted; second delivery processed | **PASS** | Two-phase `finalize_update(update_id, success=False)` error handling. |
| `SEC-01-D1` | Area D | Payment webhook amount tampering rejection | Malicious webhook delivers valid structure but altered subscription amount. | `pytest tests/test_phase0_1_deep_security.py -k test_d1` | Webhook rejects processing; no subscription plan change. | HTTP 400 Bad Request; plan unchanged | **PASS** | Expected tier price verification before status mutation. |
| `SEC-01-D2` | Area D | Duplicate payment webhook idempotency | Webhook provider sends duplicate delivery of already confirmed transaction. | `pytest tests/test_phase0_1_deep_security.py -k test_d2` | Server returns idempotent success without duplicate crediting. | HTTP 200 idempotent acknowledgment | **PASS** | Transaction status locking & idempotency tracking. |
| `SEC-01-F1` | Area F | Cross-tenant authorization boundary enforcement | User of Organization A attempts to access conversation or resource of Organization B. | `pytest tests/test_phase0_1_deep_security.py -k test_f1` | HTTP 403 Forbidden or 404 Not Found; zero data leak. | HTTP 403 / 404; no data leaked | **PASS** | `get_current_tenant_membership` DB membership query & scoping. |
| `SEC-01-G1` | Area G | Multi-tab session invalidation on logout | User has two open browser tabs. Tab 1 logs out. Tab 2 issues authenticated request. | `pytest tests/test_phase0_1_deep_security.py -k test_g1` | Tab 2 request rejected with HTTP 401 Unauthorized. | HTTP 401 Unauthorized | **PASS** | Global DB-backed token invalidation and cookie clearance. |

---

## 2. REGRESSION TEST MATRIX

| Suite File | Test Count | Scenarios Tested | Status |
|:---|:---:|:---|:---:|
| `tests/test_phase0_dashboard_security.py` | 9 | Cross-tenant isolation, forged org ID, removed membership enforcement, TezCheck signature validation, atomic deduplication, rate limiting 429, logout token revocation, password change session revocation | **ALL 9 PASSED** |
| `tests/test_phase0_security.py` | 15 | Telegram webhook secret validation, admin auth without credentials, rejected X-Admin-Telegram-Id impersonation, cross-tenant conversation / message isolation, arbitrary organization switching prevention, production secret requirements, identity binding contract | **ALL 15 PASSED** |
| `tests/test_phase1_security.py` | 10 | Bcrypt password hashing, legacy sha256 backward compatibility, Fernet encryption and masking, encrypted organization secrets, platform owner vs tenant owner authorization, SaaS billing permission checks, rate limiting tracker | **ALL 10 PASSED** |
| `tests/test_saas.py` | 9 | Default plans specification, feature definitions coverage, feature not available exception, usage limit thresholds, token cost estimation, MRR / margin calculations, tenant isolation models, RBAC roles & permissions | **ALL 9 PASSED** |

---

## 3. SUMMARY OF TEST TOTALS

```text
================================================================================
TOTAL TESTS RUN:            54
TOTAL TESTS PASSED:         54 (100.0%)
TOTAL TESTS FAILED:          0 (0.0%)
TOTAL TESTS BLOCKED:         0 (0.0%)
TOTAL TESTS NOT TESTED:      0 (0.0%)
================================================================================
FINAL VERDICT:              ALL CRITERIA VERIFIED & PASSING
================================================================================
```
