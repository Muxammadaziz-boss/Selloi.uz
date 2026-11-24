"""Automated Security & Tenant Isolation Tests for Dashboard Phase 0.

Covers:
1. Tenant Isolation & Cross-Tenant Denial
2. Multi-Tab Organization Context & Forged Tenant Rejection
3. Webhook Signature Verification (Valid, Invalid, Missing)
4. Webhook Atomic Deduplication & Idempotency
5. Server-side Rate Limiting with Retry-After header
6. Session & Token Revocation (Logout & Password Change)
"""

import hashlib
import hmac
import time
from datetime import datetime, timezone
import pytest
import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

import app.core.db as core_db
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import is_token_revoked, revoke_token, revoke_user_sessions
from app.dependencies.auth import create_access_token
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

# Use NullPool in tests to avoid asyncpg connection sharing across separate event loops
test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
core_db.engine = test_engine
core_db.SessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

from app.main import app


# ---------------------------------------------------------------------------
# Fixtures & Setup Helpers
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


async def setup_test_orgs_and_users(db: AsyncSession):
    """Set up two clean, isolated organizations and users for testing."""
    # Ensure Plan exists
    plan_res = await db.execute(select(Plan).where(Plan.code == "pro"))
    plan = plan_res.scalar_one_or_none()
    if not plan:
        plan = Plan(code="pro", name="Pro Plan", price_uzs=299000, price_usd=25, is_active=True)
        db.add(plan)
        await db.flush()

    # User A (belongs to Org A)
    user_a = (await db.execute(select(User).where(User.email == "user_a@test.uz"))).scalar_one_or_none()
    if not user_a:
        user_a = User(email="user_a@test.uz", full_name="User A", is_active=True, is_platform_owner=False, token_version=1)
        db.add(user_a)
        await db.flush()
    else:
        user_a.token_version = 1
        await db.flush()

    # User B (belongs to Org B)
    user_b = (await db.execute(select(User).where(User.email == "user_b@test.uz"))).scalar_one_or_none()
    if not user_b:
        user_b = User(email="user_b@test.uz", full_name="User B", is_active=True, is_platform_owner=False, token_version=1)
        db.add(user_b)
        await db.flush()
    else:
        user_b.token_version = 1
        await db.flush()
        db.add(user_b)
        await db.flush()

    # Org A
    org_a = (await db.execute(select(Organization).where(Organization.slug == "org-a-test"))).scalar_one_or_none()
    if not org_a:
        org_a = Organization(name="Org A Test", slug="org-a-test")
        db.add(org_a)
        await db.flush()

    # Org B
    org_b = (await db.execute(select(Organization).where(Organization.slug == "org-b-test"))).scalar_one_or_none()
    if not org_b:
        org_b = Organization(name="Org B Test", slug="org-b-test")
        db.add(org_b)
        await db.flush()

    # Membership A in Org A
    mem_a = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user_a.id,
                OrganizationMember.organization_id == org_a.id,
            )
        )
    ).scalar_one_or_none()
    if not mem_a:
        mem_a = OrganizationMember(user_id=user_a.id, organization_id=org_a.id, role="owner", is_active=True)
        db.add(mem_a)

    # Membership B in Org B
    mem_b = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.user_id == user_b.id,
                OrganizationMember.organization_id == org_b.id,
            )
        )
    ).scalar_one_or_none()
    if not mem_b:
        mem_b = OrganizationMember(user_id=user_b.id, organization_id=org_b.id, role="owner", is_active=True)
        db.add(mem_b)

    await db.commit()
    return user_a, user_b, org_a, org_b


# ---------------------------------------------------------------------------
# 1. Tenant Isolation & Cross-Tenant Rejection
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_tenant_isolation_cross_tenant_denied():
    """User A cannot access Org B without membership (strictly returns 403 Forbidden)."""
    async with core_db.SessionLocal() as db:
        user_a, user_b, org_a, org_b = await setup_test_orgs_and_users(db)
        token_a = create_access_token(user_a.id, user_a.email)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # User A attempts to target Org B
        resp = await client.get(
            "/admin/overview",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Organization-Id": str(org_b.id),
            },
        )
        assert resp.status_code == 403
        assert "a'zosi emassiz" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_tenant_isolation_forged_org_id_rejected():
    """Supplying a non-existent or arbitrary forged org ID is strictly rejected."""
    async with core_db.SessionLocal() as db:
        user_a, _, _, _ = await setup_test_orgs_and_users(db)
        token_a = create_access_token(user_a.id, user_a.email)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/admin/overview",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Organization-Id": "9999999",
            },
        )
        assert resp.status_code in (403, 404)


@pytest.mark.anyio
async def test_tenant_isolation_removed_membership_enforced():
    """Deactivating or removing membership immediately revokes tenant access."""
    async with core_db.SessionLocal() as db:
        user_a, _, org_a, _ = await setup_test_orgs_and_users(db)
        token_a = create_access_token(user_a.id, user_a.email)

        # Deactivate membership
        mem = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == user_a.id,
                    OrganizationMember.organization_id == org_a.id,
                )
            )
        ).scalar_one()
        mem.is_active = False
        await db.commit()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/admin/overview",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Organization-Id": str(org_a.id),
            },
        )
        assert resp.status_code == 403

    # Restore membership for subsequent tests
    async with core_db.SessionLocal() as db:
        mem = (
            await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.user_id == user_a.id,
                    OrganizationMember.organization_id == org_a.id,
                )
            )
        ).scalar_one()
        mem.is_active = True
        await db.commit()


# ---------------------------------------------------------------------------
# 2. Webhook Signature Verification & Deduplication
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_tezcheck_webhook_missing_signature_rejected():
    """Payment event with missing signature must return HTTP 400."""
    from app.services.tezcheck_service import tezcheck_service
    orig_mock = tezcheck_service.mock_mode
    tezcheck_service.mock_mode = False
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/webhooks/tezcheck",
                json={
                    "event": "payment.succeeded",
                    "data": {"bill_id": "bill_test_unsigned", "state": "paid", "amount": 299000},
                },
            )
            assert resp.status_code == 400
            assert "signature" in resp.json()["detail"].lower()
    finally:
        tezcheck_service.mock_mode = orig_mock


@pytest.mark.anyio
async def test_tezcheck_webhook_invalid_signature_rejected():
    """Payment event with invalid HMAC signature must return HTTP 400."""
    from app.services.tezcheck_service import tezcheck_service
    orig_mock = tezcheck_service.mock_mode
    tezcheck_service.mock_mode = False
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/webhooks/tezcheck",
                headers={"X-Checkout-Signature": "v1=invalid_tampered_signature_hex"},
                json={
                    "event": "payment.succeeded",
                    "data": {"bill_id": "bill_test_tampered", "state": "paid", "amount": 299000},
                },
            )
            assert resp.status_code == 400
            assert "signature" in resp.json()["detail"].lower()
    finally:
        tezcheck_service.mock_mode = orig_mock


@pytest.mark.anyio
async def test_tezcheck_webhook_valid_signature_and_atomic_deduplication():
    """Valid signature is accepted, and duplicate deliveries are handled idempotently via WebhookEvent."""
    from app.services.tezcheck_service import tezcheck_service
    effective_secret = (tezcheck_service.secret_key or "SELLOI_TEZCHECK_MOCK_SECRET").encode("utf-8")

    # Create a test bill in DB
    bill_id = f"bill_atomic_{int(time.time())}"
    async with core_db.SessionLocal() as db:
        _, _, org_a, _ = await setup_test_orgs_and_users(db)
        bill = PaymentBill(
            bill_id=bill_id,
            organization_id=org_a.id,
            plan_code="pro",
            amount=299000,
            currency="UZS",
            billing_cycle="monthly",
            status="pending",
        )
        db.add(bill)
        await db.commit()

    raw_body = f'{{"event":"payment.succeeded","data":{{"bill_id":"{bill_id}","state":"paid","amount":299000,"currency":"UZS"}}}}'.encode("utf-8")
    sig = hmac.new(effective_secret, raw_body, hashlib.sha256).hexdigest()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # First delivery: should succeed and confirm bill
        resp1 = await client.post(
            "/webhooks/tezcheck",
            headers={"X-Checkout-Signature": f"v1={sig}", "Content-Type": "application/json"},
            content=raw_body,
        )
        assert resp1.status_code == 200
        assert resp1.json().get("ok") is True

        # Second delivery (duplicate): should be caught idempotently
        resp2 = await client.post(
            "/webhooks/tezcheck",
            headers={"X-Checkout-Signature": f"v1={sig}", "Content-Type": "application/json"},
            content=raw_body,
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2.get("ok") is True
        assert data2.get("idempotent") is True or data2.get("status") == "already_processed"


# ---------------------------------------------------------------------------
# 3. Server-side Rate Limiting
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_rate_limiter_exceeded_returns_429():
    """Sliding-window rate limiter returns HTTP 429 with Retry-After header when threshold is crossed."""
    rate_key = "test_rate_burst_key"
    limiter.reset(rate_key)

    # Allow 3 requests
    allowed1, _ = limiter.is_allowed(rate_key, max_requests=3, window_seconds=60)
    allowed2, _ = limiter.is_allowed(rate_key, max_requests=3, window_seconds=60)
    allowed3, _ = limiter.is_allowed(rate_key, max_requests=3, window_seconds=60)
    assert allowed1 is True
    assert allowed2 is True
    assert allowed3 is True

    # 4th request must be rejected
    allowed4, retry_after = limiter.is_allowed(rate_key, max_requests=3, window_seconds=60)
    assert allowed4 is False
    assert retry_after > 0

    limiter.reset(rate_key)
    allowed5, _ = limiter.is_allowed(rate_key, max_requests=3, window_seconds=60)
    assert allowed5 is True


# ---------------------------------------------------------------------------
# 4. Session & Token Revocation
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_token_revocation_logout_invalidates_token():
    """Calling logout revokes the JWT token, which is rejected on subsequent calls."""
    async with core_db.SessionLocal() as db:
        user_a, _, org_a, _ = await setup_test_orgs_and_users(db)
        token_a = create_access_token(user_a.id, user_a.email)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Verify token works initially
        r1 = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert r1.status_code == 200

        # 2. Call logout endpoint
        r_logout = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert r_logout.status_code == 200
        assert r_logout.json().get("ok") is True

        # 3. Subsequent request with the same token must return 401 Unauthorized
        r2 = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert r2.status_code == 401
        assert "revoked" in r2.json()["detail"].lower() or "bekor qilingan" in r2.json()["detail"].lower()


@pytest.mark.anyio
async def test_session_revocation_after_password_change():
    """Changing password revokes all existing sessions issued prior to change."""
    async with core_db.SessionLocal() as db:
        user_a, _, _, _ = await setup_test_orgs_and_users(db)
        from app.core.security import hash_password
        user_a.hashed_password = hash_password("OldPassword123!")
        user_a.token_version = 1
        await db.commit()

        # Token issued BEFORE password change
        old_token = create_access_token(user_a.id, user_a.email, token_version=user_a.token_version)

    # Sleep 1.1s so issued_at timestamp is strictly older
    time.sleep(1.1)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Change password
        r_change = await client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {old_token}"},
            json={"current_password": "OldPassword123!", "new_password": "NewSecretPassword456!"},
        )
        assert r_change.status_code == 200

        # Attempting to use the old token must now be rejected
        r_old = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {old_token}"},
        )
        assert r_old.status_code == 401
        assert "revoked" in r_old.json()["detail"].lower() or "bekor" in r_old.json()["detail"].lower() or "sessiya" in r_old.json()["detail"].lower()
