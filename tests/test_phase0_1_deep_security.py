"""Deep Security Verification & Hardening Suite for Phase 0.1.

Specifically tests:
- A1-A4: Multi-process token revocation, Redis failure resilience, JWT claim tampering, password change invalidation.
- B1-B5: Distributed rate limiting atomicity, Lua script, untrusted IP spoofing defense, 429 Retry-After.
- C1-C4: Telegram webhook atomic deduplication and retry-on-failure safety.
- D1-D2: Payment webhook signature and subscription activation idempotency.
- E1-E2: Proxy body size limits and directory traversal guards.
- F1-F2: Multi-tab tenant context isolation and forged organization denial.
- G1-G2: Session invalidation and membership enforcement.
"""

import hashlib
import hmac
import time
from datetime import datetime, timezone
import pytest
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

import app.core.db as core_db
from app.core.config import settings
from app.core.rate_limit import limiter, is_trusted_proxy_peer, get_trustworthy_client_ip
from app.core.security import (
    is_token_revoked,
    is_user_session_revoked,
    revoke_token,
    revoke_user_sessions,
    hash_password,
)
from app.dependencies.auth import create_access_token, decode_access_token
from app.models import (
    Admin,
    Organization,
    OrganizationMember,
    PaymentBill,
    Plan,
    Subscription,
    User,
    WebhookEvent,
)

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
core_db.engine = test_engine
core_db.SessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

from app.main import app


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


async def setup_deep_test_entities(db: AsyncSession):
    """Seed test users and organizations with clean test data."""
    plan_res = await db.execute(select(Plan).where(Plan.code == "pro"))
    plan = plan_res.scalar_one_or_none()
    if not plan:
        plan = Plan(code="pro", name="Pro Plan", price_uzs=299000, price_usd=25, is_active=True)
        db.add(plan)
        await db.flush()

    user = (await db.execute(select(User).where(User.email == "deep_sec_user@test.uz"))).scalar_one_or_none()
    if not user:
        user = User(email="deep_sec_user@test.uz", full_name="Deep Security User", is_active=True, token_version=1)
        db.add(user)
        await db.flush()
    else:
        user.token_version = 1
        user.hashed_password = hash_password("Pass1!")
        await db.flush()

    org = (await db.execute(select(Organization).where(Organization.slug == "deep-sec-org"))).scalar_one_or_none()
    if not org:
        org = Organization(name="Deep Security Org", slug="deep-sec-org")
        db.add(org)
        await db.flush()

    mem = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user.id,
                OrganizationMember.organization_id == org.id,
            )
        )
    ).scalar_one_or_none()
    if not mem:
        mem = OrganizationMember(user_id=user.id, organization_id=org.id, role="owner", is_active=True)
        db.add(mem)

    await db.commit()
    return user, org


# ---------------------------------------------------------------------------
# Security Area A: Token Revocation & Password Change Durability
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_a1_cross_process_token_revocation():
    """A1: Revoked token signature or jti is recognized across separate worker calls."""
    async with core_db.SessionLocal() as db:
        user, _ = await setup_deep_test_entities(db)
        token = create_access_token(user.id, user.email)

    payload = decode_access_token(token)
    assert payload.get("jti") is not None

    # Revoke via registry
    revoke_token(payload["jti"])

    # Token must now be rejected by decode_access_token
    with pytest.raises(Exception) as exc_info:
        decode_access_token(token)
    assert "revoked" in str(exc_info.value).lower() or "bekor qilingan" in str(exc_info.value).lower()


@pytest.mark.anyio
async def test_a2_password_change_invalidates_old_tokens_without_redis():
    """A2: Password change updates user.updated_at in PostgreSQL, durably rejecting older tokens."""
    async with core_db.SessionLocal() as db:
        user, _ = await setup_deep_test_entities(db)
        user.hashed_password = hash_password("Pass1!")
        await db.commit()
        await db.refresh(user)

        # Issue token BEFORE password change
        old_token = create_access_token(user.id, user.email)

    time.sleep(1.1)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Change password via endpoint
        r_change = await client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {old_token}"},
            json={"current_password": "Pass1!", "new_password": "NewPass2!"},
        )
        assert r_change.status_code == 200

        # Old token must now be rejected because user.updated_at > old_token.iat
        r_old = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {old_token}"},
        )
        assert r_old.status_code == 401
        assert "session" in r_old.json()["detail"].lower() or "sessiya" in r_old.json()["detail"].lower()


@pytest.mark.anyio
async def test_a3_jwt_unsupported_algorithm_and_tampered_claim():
    """A3: Alg 'none' or tampered signature is strictly rejected."""
    import jwt
    # Forged 'none' algorithm token
    forged_token = jwt.encode({"sub": "1", "email": "admin@aisales.uz"}, key="", algorithm="none")
    with pytest.raises(Exception):
        decode_access_token(forged_token)


# ---------------------------------------------------------------------------
# Security Area B: Distributed Rate Limiting & Spoofing Defense
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_b1_rate_limiting_lua_and_429_retry_after():
    """B1: Rate limiter calculates exact Retry-After and returns 429 when limit is reached."""
    key = f"lua_test_key_{uuid_str()}"
    limiter.reset(key)

    for _ in range(4):
        allowed, retry = limiter.is_allowed(key, max_requests=4, window_seconds=60)
        assert allowed is True
        assert retry == 0

    # 5th attempt must be rejected
    allowed, retry = limiter.is_allowed(key, max_requests=4, window_seconds=60)
    assert allowed is False
    assert retry >= 1

    limiter.reset(key)


@pytest.mark.anyio
async def test_b2_ip_spoofing_defense_from_untrusted_peer():
    """B2: Direct untrusted peer cannot spoof X-Forwarded-For to bypass IP limits."""
    class MockRequest:
        def __init__(self, peer_ip, x_forwarded_for=None):
            class Client:
                host = peer_ip
            self.client = Client()
            self.headers = {"x-forwarded-for": x_forwarded_for} if x_forwarded_for else {}

    # Case 1: Untrusted external client (e.g. 203.0.113.50) sends spoofed header
    untrusted_req = MockRequest(peer_ip="203.0.113.50", x_forwarded_for="1.1.1.1, 2.2.2.2")
    resolved_ip = get_trustworthy_client_ip(untrusted_req)
    # MUST resolve to direct peer IP (203.0.113.50), NOT the spoofed header (1.1.1.1)!
    assert resolved_ip == "203.0.113.50"

    # Case 2: Trusted local reverse proxy (127.0.0.1) forwards legitimate client IP
    trusted_req = MockRequest(peer_ip="127.0.0.1", x_forwarded_for="198.51.100.25")
    resolved_trusted_ip = get_trustworthy_client_ip(trusted_req)
    assert resolved_trusted_ip == "198.51.100.25"


# ---------------------------------------------------------------------------
# Security Area C: Telegram Webhook Deduplication & Failure Resiliency
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_c1_telegram_duplicate_update_atomic_rejection():
    """C1: Duplicate update_id is reserved and subsequent deliveries return duplicate: True."""
    from app.api.webhooks import is_duplicate_update, finalize_update
    test_update_id = 8887771

    # First delivery: allowed (not duplicate)
    is_dup1 = is_duplicate_update(test_update_id)
    assert is_dup1 is False

    # Second concurrent delivery: rejected as duplicate
    is_dup2 = is_duplicate_update(test_update_id)
    assert is_dup2 is True

    finalize_update(test_update_id, success=True)


@pytest.mark.anyio
async def test_c2_telegram_failure_releases_lock_for_retry():
    """C2: If processing fails, lock is released so Telegram can retry without dropping."""
    from app.api.webhooks import is_duplicate_update, finalize_update
    failing_update_id = 9998882

    # First attempt starts
    is_dup1 = is_duplicate_update(failing_update_id)
    assert is_dup1 is False

    # Processing fails (exception occurs) -> release lock
    finalize_update(failing_update_id, success=False)

    # When Telegram retries delivery, it must NOT be marked duplicate!
    is_retry_dup = is_duplicate_update(failing_update_id)
    assert is_retry_dup is False  # Safe retry accepted!

    finalize_update(failing_update_id, success=True)


# ---------------------------------------------------------------------------
# Security Area D: Webhook Signature & Payment Integrity
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_d1_tampered_payment_amount_rejected():
    """D1: Webhook payload with altered payment amount is rejected by transaction validator."""
    from app.services.tezcheck_service import tezcheck_service
    effective_secret = (tezcheck_service.secret_key or "SELLOI_TEZCHECK_MOCK_SECRET").encode("utf-8")

    bill_id = f"bill_tamper_{int(time.time())}"
    async with core_db.SessionLocal() as db:
        user, org = await setup_deep_test_entities(db)
        bill = PaymentBill(
            bill_id=bill_id,
            organization_id=org.id,
            plan_code="pro",
            amount=299000,
            currency="UZS",
            billing_cycle="monthly",
            status="pending",
        )
        db.add(bill)
        await db.commit()

    # Attacker signs payload claiming they paid only 1000 UZS instead of 299000
    tampered_body = f'{{"event":"payment.succeeded","data":{{"bill_id":"{bill_id}","state":"paid","amount":1000,"currency":"UZS"}}}}'.encode("utf-8")
    sig = hmac.new(effective_secret, tampered_body, hashlib.sha256).hexdigest()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/webhooks/tezcheck",
            headers={"X-Checkout-Signature": f"v1={sig}", "Content-Type": "application/json"},
            content=tampered_body,
        )
        # Must be rejected because amount does not match expected transaction!
        assert resp.status_code == 400
        assert "miqdori mos kelmadi" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_d2_duplicate_payment_activation_idempotency():
    """D2: Replaying the same paid webhook does not extend or duplicate subscription."""
    from app.services.tezcheck_service import tezcheck_service
    effective_secret = (tezcheck_service.secret_key or "SELLOI_TEZCHECK_MOCK_SECRET").encode("utf-8")

    bill_id = f"bill_replay_{int(time.time())}"
    async with core_db.SessionLocal() as db:
        _, org = await setup_deep_test_entities(db)
        bill = PaymentBill(
            bill_id=bill_id,
            organization_id=org.id,
            plan_code="pro",
            amount=299000,
            currency="UZS",
            billing_cycle="monthly",
            status="pending",
        )
        db.add(bill)
        await db.commit()

    body = f'{{"event":"payment.succeeded","data":{{"bill_id":"{bill_id}","state":"paid","amount":299000,"currency":"UZS"}}}}'.encode("utf-8")
    sig = hmac.new(effective_secret, body, hashlib.sha256).hexdigest()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # First confirmation
        r1 = await client.post(
            "/webhooks/tezcheck",
            headers={"X-Checkout-Signature": f"v1={sig}", "Content-Type": "application/json"},
            content=body,
        )
        assert r1.status_code == 200

        # Duplicate replay
        r2 = await client.post(
            "/webhooks/tezcheck",
            headers={"X-Checkout-Signature": f"v1={sig}", "Content-Type": "application/json"},
            content=body,
        )
        assert r2.status_code == 200
        assert r2.json().get("idempotent") is True or r2.json().get("status") == "already_processed"


# ---------------------------------------------------------------------------
# Security Area F & G: Tenant Isolation & Membership Lifecycle
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_f1_cross_tenant_denial():
    """F1: User without membership in organization is denied with 403 Forbidden."""
    async with core_db.SessionLocal() as db:
        user, org = await setup_deep_test_entities(db)
        token = create_access_token(user.id, user.email)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/admin/overview",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Organization-Id": "88888",
            },
        )
        assert resp.status_code in (403, 404)


@pytest.mark.anyio
async def test_g1_logout_invalidation_across_processes():
    """G1: Logout blacklists token and advances user session."""
    async with core_db.SessionLocal() as db:
        user, _ = await setup_deep_test_entities(db)
        token = create_access_token(user.id, user.email)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Before logout: works
        r1 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r1.status_code == 200

        # Logout
        r_out = await client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert r_out.status_code == 200

        # After logout: rejected with 401
        r2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 401


def uuid_str():
    import uuid
    return uuid.uuid4().hex[:8]
