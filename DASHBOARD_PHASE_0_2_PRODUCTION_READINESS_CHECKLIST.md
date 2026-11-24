# SELLOI.UZ - DASHBOARD PHASE 0.2
# PRODUCTION READINESS CHECKLIST & DEPLOYMENT GATEWAY

**Project:** Selloi.uz  
**Audit Stage:** Phase 0.2 - Final Security Corrections & Production Readiness Verification  
**Date:** 2026-11-23  
**Status Key:**
- `VERIFIED`: Tested and confirmed with reproducible automated evidence in local test environment.
- `REQUIRED`: Prerequisite that MUST be executed or verified on production infrastructure before release.
- `BLOCKED`: Item cannot proceed until external dependencies, merchant credentials, or contracts are provisioned.
- `NOT APPLICABLE`: Does not apply to the current architecture.

---

## 1. APPLICATION CODE (CODE-VERIFIED)

| Item | Requirement Description | Verification Evidence | Status |
|:---|:---|:---|:---:|
| APP-01 | Monotonic JWT `token_version` session revocation | `tests/test_phase0_2_security.py::test_a1`, `test_a2` passing | **VERIFIED** |
| APP-02 | Profile update isolation (no accidental session revocation) | `tests/test_phase0_2_security.py::test_a3` passing | **VERIFIED** |
| APP-03 | Telegram webhook 60s lease with recovery on worker crash | `tests/test_phase0_2_security.py::test_b1` passing | **VERIFIED** |
| APP-04 | Telegram webhook ownership isolation (atomic Lua finalize) | `tests/test_phase0_2_security.py::test_b2` passing | **VERIFIED** |
| APP-05 | Webhook duplicate business action prevention | `tests/test_phase0_2_security.py::test_b3` passing | **VERIFIED** |
| APP-06 | Strict Right-to-Left reverse proxy XFF resolution | `tests/test_phase0_2_security.py::test_c1`, `test_c2`, `test_c3` passing | **VERIFIED** |
| APP-07 | Redis outage DB token revocation fallback | `tests/test_phase0_2_security.py::test_d1` passing | **VERIFIED** |
| APP-08 | Sensitive rate limiting `fail_closed` policy during outage | `tests/test_phase0_2_security.py::test_d3` passing | **VERIFIED** |
| APP-09 | TezCheck HMAC-SHA256 signature verification | `tests/test_phase0_2_security.py::test_e1` passing | **VERIFIED** |
| APP-10 | TezCheck amount and currency tampering rejection | `tests/test_phase0_2_security.py::test_e2` passing | **VERIFIED** |
| APP-11 | TezCheck duplicate callback idempotency | `tests/test_phase0_2_security.py::test_e3` passing | **VERIFIED** |
| APP-12 | Next.js API Proxy 10MB payload limit & CSRF validation | `web/app/api/proxy/route.ts` validated | **VERIFIED** |
| APP-13 | Frontend TypeScript compilation (0 type errors) | `npx tsc --noEmit` exited with code 0 | **VERIFIED** |

---

## 2. POSTGRESQL SCHEMA & MIGRATIONS

| Item | Requirement Description | Action Needed on Production VPS | Status |
|:---|:---|:---|:---:|
| DB-01 | Apply Alembic migration `5f93c2a7b123` (`token_version`) | Run `alembic upgrade head` on production PostgreSQL container | **REQUIRED** |
| DB-02 | Index `users.token_version` and `users.id` for fast query | Check index coverage on `users` table in production DB | **REQUIRED** |
| DB-03 | `webhook_events.event_id` unique constraint active | Confirm unique index `ix_webhook_events_event_id` in production | **REQUIRED** |
| DB-04 | Production connection pooling limits | Set `pool_size=20, max_overflow=10, pool_pre_ping=True` | **REQUIRED** |

---

## 3. REDIS CONFIGURATION

| Item | Requirement Description | Action Needed on Production VPS | Status |
|:---|:---|:---|:---:|
| REDIS-01 | Memory eviction policy: `volatile-lru` or `volatile-ttl` | Confirm `maxmemory-policy volatile-lru` in `redis.conf` | **REQUIRED** |
| REDIS-02 | Redis persistence (AOF or RDB snapshotting) | Enable `appendonly yes` in production `redis.conf` | **REQUIRED** |
| REDIS-03 | Network authentication & TLS | Ensure `requirepass` is set and matches `REDIS_URL` in `.env` | **REQUIRED** |
| REDIS-04 | Redis Sentinel or HA cluster | Evaluate if SLA requires multi-node Redis replication | **REQUIRED** |

---

## 4. REVERSE PROXY (NGINX & CLOUDFLARE)

| Item | Requirement Description | Action Needed on Production VPS | Status |
|:---|:---|:---|:---:|
| PROXY-01 | Strip client-supplied `X-Forwarded-For` from outer boundary | Nginx must set `proxy_set_header X-Forwarded-For $remote_addr;` | **REQUIRED** |
| PROXY-02 | Configure `TRUSTED_PROXIES` environment variable | Set `TRUSTED_PROXIES="127.0.0.1,::1,172.20.0.0/16"` in production `.env` | **REQUIRED** |
| PROXY-03 | Strip internal administrative headers | Nginx must strip `X-Admin-Telegram-Id` and `X-User-Role` | **REQUIRED** |
| PROXY-04 | SSL/TLS modern ciphers (TLS 1.3, HSTS) | Verify Let's Encrypt / Cloudflare Full (Strict) SSL | **REQUIRED** |

---

## 5. SECRETS & ENVIRONMENT

| Item | Requirement Description | Action Needed on Production VPS | Status |
|:---|:---|:---|:---:|
| SEC-01 | High-entropy `JWT_SECRET` (>= 32 bytes) | Verify production `.env` contains cryptographic secret | **REQUIRED** |
| SEC-02 | `TELEGRAM_WEBHOOK_SECRET` configured | Set in bot webhook and matching `.env` on production | **REQUIRED** |
| SEC-03 | Production flag `APP_ENV=production` | Ensure debug routes and auto-reload are disabled | **REQUIRED** |
| SEC-04 | Database credentials non-default | Verify production DB does not use default credentials | **REQUIRED** |

---

## 6. PAYMENT PROVIDER CONFIGURATION

| Item | Requirement Description | Provider Readiness Status | Status |
|:---|:---|:---|:---:|
| PAY-01 | TezCheck live merchant API key & secret key | Provisioned via TezCheck merchant portal | **REQUIRED** |
| PAY-02 | TezCheck webhook URL registered with SSL | `https://selloi.uz/webhooks/tezcheck` configured in portal | **REQUIRED** |
| PAY-03 | TezCheck live test transaction verification | Execute single 1,000 UZS live test bill and verify activation | **REQUIRED** |
| PAY-04 | Click merchant onboarding & protocol implementation | Merchant contract, secret keys, and endpoint are unprovisioned | **BLOCKED** |

---

## 7. MONITORING, LOGGING & INCIDENT RESPONSE

| Item | Requirement Description | Action Needed on Production VPS | Status |
|:---|:---|:---|:---:|
| MON-01 | Centralized application log aggregation (Grafana/Loki/Sentry) | Configure log shipping for Uvicorn and Next.js containers | **REQUIRED** |
| MON-02 | Rate-limit 429 spike alerting | Alert when 429 responses exceed 100/min from a single IP/subnet | **REQUIRED** |
| MON-03 | Webhook failure rate alerting | Alert when `finalize_update(success=False)` exceeds 1% of updates | **REQUIRED** |

---

## 8. BACKUP, RECOVERY & DEPLOYMENT ROLLBACK

| Item | Requirement Description | Action Needed on Production VPS | Status |
|:---|:---|:---|:---:|
| OPS-01 | Automated daily PostgreSQL backups (pg_dump) | Verify cron backup to offsite storage exists | **REQUIRED** |
| OPS-02 | Runbook for emergency rollback | Follow `PHASE_2_12_EMERGENCY_ROLLBACK_RUNBOOK.md` | **REQUIRED** |
| OPS-03 | Verified previous container image backup | Baseline image `sha256:2adb1cd8f...` retained on host | **REQUIRED** |

---

## 9. FINAL GATEWAY SUMMARY

```text
================================================================================
APPLICATION SOURCE CODE STATUS:     CODE-VERIFIED (All local security controls pass)
PRODUCTION VPS DEPLOYMENT GATE:     HELD PENDING PRODUCTION PREREQUISITES
BLOCKING PAYMENT PROVIDERS:         CLICK (Blocked pending merchant onboarding)
ACTIVE PAYMENT PROVIDERS:           TEZCHECK (Code verified, requires live secret)
================================================================================
```
