"""Regression tests verifying all critical & high defects caught during deep audit."""

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from unittest.mock import AsyncMock, patch
import uuid

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.core.db as core_db
from app.core.config import settings
from app.core.permissions import ROLE_DEFAULTS
from app.core.security import hash_password
from app.dependencies.auth import create_access_token
from app.models import (
    Admin,
    AuditLog,
    BusinessConnection,
    Conversation,
    Organization,
    OrganizationInvite,
    OrganizationMember,
    Plan,
    PlanPriceHistory,
    Subscription,
    User,
)
from app.services.centralized_pricing_service import CentralizedPricingService
from app.services.saas_service import seed_plans_and_defaults
from app.services.tezcheck_service import TezCheckService
from app.services.usage_service import usage_service
from app.main import app

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
core_db.engine = test_engine
core_db.SessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def _seed_user_org_pair(role_a: str = "owner", role_b: str = "viewer"):
    suffix = uuid.uuid4().hex[:8]
    async with core_db.SessionLocal() as session:
        plan = (await session.execute(select(Plan).where(Plan.code == "pro"))).scalar_one_or_none()
        if plan is None:
            plan = Plan(
                code="pro",
                name="PRO",
                price_monthly=59,
                price_yearly=590,
                price_monthly_uzs=49_900_000,
                price_yearly_uzs=499_000_000,
                currency="UZS",
                features={"data_export": True},
                limits={"ai_messages": 7500, "products": 1000},
                is_active=True,
            )
            session.add(plan)
            await session.flush()

        org_a = Organization(name=f"Org A {suffix}", slug=f"org-a-{suffix}")
        org_b = Organization(name=f"Org B {suffix}", slug=f"org-b-{suffix}")
        session.add_all([org_a, org_b])

        user = User(
            email=f"multi_{suffix}@selloi.uz",
            full_name="Multi Tenant User",
            hashed_password=hash_password("Pass123!"),
            email_verified=True,
            telegram_user_id=910000000 + (int(suffix, 16) % 80000000),
            is_platform_owner=False,
        )
        session.add(user)
        await session.flush()

        session.add_all([
            OrganizationMember(
                organization_id=org_a.id,
                user_id=user.id,
                role=role_a,
                permissions=dict(ROLE_DEFAULTS[role_a]),
                is_active=True,
            ),
            OrganizationMember(
                organization_id=org_b.id,
                user_id=user.id,
                role=role_b,
                permissions=dict(ROLE_DEFAULTS[role_b]),
                is_active=True,
            ),
            Subscription(
                organization_id=org_a.id,
                plan_id=plan.id,
                status="subscription_active",
                billing_cycle="monthly",
                provider="tezcheck",
            ),
            Subscription(
                organization_id=org_b.id,
                plan_id=plan.id,
                status="subscription_active",
                billing_cycle="monthly",
                provider="tezcheck",
            ),
            BusinessConnection(
                id=f"bc_b_{suffix}",
                organization_id=org_b.id,
                is_enabled=True,
                rights={"can_reply": True},
            ),
        ])
        await session.flush()
        conv_b = Conversation(
            organization_id=org_b.id,
            business_connection_id=f"bc_b_{suffix}",
            chat_id=777001,
            customer_name="Cust B",
            status="ai_active",
        )
        session.add(conv_b)
        await session.commit()
        await session.refresh(org_a)
        await session.refresh(org_b)
        await session.refresh(user)
        await session.refresh(conv_b)

    token = create_access_token(user.id, user.email)
    return user, org_a, org_b, conv_b, token


@pytest.mark.anyio
async def test_resolve_organization_id_works_without_header_and_upgrade_plan_no_attr_error():
    _user, org_a, _org_b, _conv_b, token = await _seed_user_org_pair()
    headers = {"Authorization": f"Bearer {token}"}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Must resolve primary org without X-Organization-Id (previously hit Query(None) 400 sentinel!)
        ent_res = await client.get("/api/entitlements", headers=headers)
        assert ent_res.status_code == 200, ent_res.text
        assert ent_res.json()["organization_id"] == org_a.id

        # /api/subscription/upgrade previously crashed with AttributeError: Admin.user_id
        up_res = await client.post(
            "/api/subscription/upgrade",
            headers=headers,
            json={"new_plan_code": "ultra", "billing_cycle": "monthly"},
        )
        assert up_res.status_code == 200, up_res.text
        assert up_res.json()["status"] == "payment_required"


@pytest.mark.anyio
async def test_multi_org_rbac_synced_per_target_org_and_webhook_path_idor_blocked():
    _user, org_a, org_b, conv_b, token = await _seed_user_org_pair(role_a="owner", role_b="viewer")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # User is OWNER of Org A, VIEWER of Org B -> cannot takeover conversation in Org B
        takeover_b = await client.post(
            f"/admin/conversations/{conv_b.id}/takeover",
            headers={"Authorization": f"Bearer {token}", "X-Organization-Id": str(org_b.id)},
        )
        assert takeover_b.status_code == 403

        # User cannot mutate products in Org B as viewer
        prod_b = await client.post(
            "/admin/products",
            headers={"Authorization": f"Bearer {token}", "X-Organization-Id": str(org_b.id)},
            json={"name": "Blocked Item", "price": "100 000 so'm"},
        )
        assert prod_b.status_code == 403

        # User targeting Org A context CANNOT call set-webhook / webhook-status for Org B path param
        wh_set_b = await client.post(
            f"/api/organizations/{org_b.id}/set-webhook",
            headers={"Authorization": f"Bearer {token}", "X-Organization-Id": str(org_a.id)},
        )
        assert wh_set_b.status_code == 403

        wh_status_b = await client.get(
            f"/api/organizations/{org_b.id}/webhook-status",
            headers={"Authorization": f"Bearer {token}", "X-Organization-Id": str(org_a.id)},
        )
        assert wh_status_b.status_code == 403


@pytest.mark.anyio
async def test_accept_invite_blocks_passwordless_takeover_of_existing_user():
    suffix = uuid.uuid4().hex[:8]
    raw_token = f"inv_{secrets.token_urlsafe(12)}"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    async with core_db.SessionLocal() as session:
        org = Organization(name=f"Inv Org {suffix}", slug=f"inv-org-{suffix}")
        victim = User(
            email=f"victim_{suffix}@selloi.uz",
            full_name="Victim",
            hashed_password=hash_password("RealSecret123"),
            email_verified=True,
            is_active=True,
        )
        session.add_all([org, victim])
        await session.flush()
        session.add(
            OrganizationInvite(
                organization_id=org.id,
                email=victim.email,
                role="operator",
                permissions=dict(ROLE_DEFAULTS["operator"]),
                token_hash=token_hash,
                status="pending",
                expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            )
        )
        await session.commit()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Empty / missing password must be rejected for existing user
        res_empty = await client.post(
            "/api/v1/auth/accept-invite",
            json={"token": raw_token, "password": ""},
        )
        assert res_empty.status_code == 401

        res_null = await client.post(
            "/api/v1/auth/accept-invite",
            json={"token": raw_token},
        )
        assert res_null.status_code == 401

        # Valid password works
        res_ok = await client.post(
            "/api/v1/auth/accept-invite",
            json={"token": raw_token, "password": "RealSecret123"},
        )
        assert res_ok.status_code == 200
        assert res_ok.json()["access_token"]


@pytest.mark.anyio
async def test_usage_service_increment_usage_accepts_period_and_counts_accurately():
    _user, org_a, _org_b, _conv_b, _token = await _seed_user_org_pair()
    async with core_db.SessionLocal() as session:
        rec = await usage_service.increment_usage(session, org_a.id, "ai_messages", 4, "2026-11")
        await session.commit()
        assert rec.used >= 4
        assert rec.period == "2026-11"


@pytest.mark.anyio
async def test_tezcheck_create_bill_signs_exact_transmitted_bytes():
    svc = TezCheckService(
        api_url="https://api.tezcheck.uz/api/merchant/v1",
        api_key="aps_test_key",
        secret_key="whsec_test_secret",
        cash_desk_code="CDK_TEST",
        mock_mode=False,
    )
    captured: dict = {}

    class _FakeResp:
        status_code = 200
        headers = {}
        text = '{"data":{"bill":{"id":"tz_1","payment_url":"https://pay.test/1"}}}'

        def json(self):
            return {"data": {"bill": {"id": "tz_1", "payment_url": "https://pay.test/1"}}}

    async def _fake_post(url, content=None, headers=None, **kwargs):
        captured["content"] = content
        captured["headers"] = headers or {}
        return _FakeResp()

    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=_fake_post)):
        res = await svc.create_bill(
            amount=2600000,
            currency="UZS",
            order_id="ord_exact_bytes",
            description="Test exact wire bytes",
            return_url="https://selloi.uz/return",
        )

    assert res["bill_id"] == "tz_1"
    raw_bytes = captured["content"]
    assert isinstance(raw_bytes, bytes)
    ts = captured["headers"]["X-TezCheck-Timestamp"]
    sig = captured["headers"]["X-TezCheck-Signature"]
    body_hash = hashlib.sha256(raw_bytes).hexdigest()
    expected_msg = f"{ts}.POST./api/merchant/v1/bills.{body_hash}".encode("utf-8")
    expected_sig = "v1=" + hmac.new(b"aps_test_key", expected_msg, hashlib.sha256).hexdigest()
    assert sig == expected_sig


@pytest.mark.anyio
async def test_scheduled_price_change_deferred_and_seed_preserves_custom_and_repairs_ultra():
    cps = CentralizedPricingService()
    async with core_db.SessionLocal() as session:
        await cps.seed_or_verify_tariffs(session)
        pro_before = await cps.get_plan_by_code(session, "pro")
        orig_monthly = pro_before.price_monthly_uzs

        future_at = datetime.now(timezone.utc) + timedelta(days=7)
        await cps.update_tariff_pricing(
            db=session,
            plan_code="pro",
            price_monthly_uzs=910_000,
            approval_status="scheduled",
            effective_from=future_at,
            change_reason="Scheduled promo test",
        )

        pro_after = await cps.get_plan_by_code(session, "pro")
        assert pro_after.price_monthly_uzs == orig_monthly

        # Verify custom UZS price survives seed_plans_and_defaults and ultra whole-soum auto-repairs
        pro_after.price_monthly_uzs = 88_800_000
        ultra = await cps.get_plan_by_code(session, "ultra")
        ultra.price_monthly_uzs = 1_914_650  # Simulate legacy whole-UZS seed bug
        await session.commit()

        await seed_plans_and_defaults(session)
        pro_reloaded = await cps.get_plan_by_code(session, "pro")
        assert pro_reloaded.price_monthly_uzs == 88_800_000

        await cps.seed_or_verify_tariffs(session)
        ultra_reloaded = await cps.get_plan_by_code(session, "ultra")
        assert ultra_reloaded.price_monthly_uzs == 191_465_000

        # Restore canonical pro price cleanly
        pro_reloaded.price_monthly_uzs = orig_monthly
        await session.commit()


@pytest.mark.anyio
async def test_admin_takeover_empty_body_logs_settings_isolation_and_webhook_non_dict():
    user, org_a, org_b, _conv_b, token = await _seed_user_org_pair(role_a="owner", role_b="owner")
    suffix = uuid.uuid4().hex[:6]
    async with core_db.SessionLocal() as session:
        bc_a = BusinessConnection(
            id=f"bc_a_{suffix}",
            organization_id=org_a.id,
            is_enabled=True,
            rights={"can_reply": True},
        )
        session.add(bc_a)
        await session.flush()
        conv_a = Conversation(
            organization_id=org_a.id,
            business_connection_id=f"bc_a_{suffix}",
            chat_id=888001,
            customer_name="Cust A",
            status="ai_active",
        )
        global_admin = Admin(
            organization_id=None,
            telegram_user_id=920000000 + (int(suffix, 16) % 70000000),
            name="Global Admin",
            role="admin",
            permissions=dict(ROLE_DEFAULTS["admin"]),
            is_active=True,
        )
        session.add_all([conv_a, global_admin])
        await session.commit()
        await session.refresh(conv_a)
        await session.refresh(global_admin)

    transport = httpx.ASGITransport(app=app)
    headers_a = {"Authorization": f"Bearer {token}", "X-Organization-Id": str(org_a.id)}
    headers_b = {"Authorization": f"Bearer {token}", "X-Organization-Id": str(org_b.id)}

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Empty-body POST takeover (frontend pattern) must return 200, not 422
        r_tk = await client.post(f"/admin/conversations/{conv_a.id}/takeover", headers=headers_a)
        assert r_tk.status_code == 200, r_tk.text

        # 2. Tenant logs sort works cleanly
        r_logs = await client.get("/admin/logs", headers=headers_a)
        assert r_logs.status_code == 200

        # 3. Tenant owner CANNOT delete global Admin (organization_id=None)
        r_del_global = await client.delete(f"/admin/admins/{global_admin.telegram_user_id}", headers=headers_a)
        assert r_del_global.status_code == 404

        # 4. Non-dict JSON webhook payload does not crash with AttributeError
        r_wh = await client.post("/api/webhooks/tezcheck", json=["not-an-object"])
        assert r_wh.status_code == 200
        assert r_wh.json()["status"] == "ignored_non_object"

        # 5. public_channel updated in Org A does not leak to Org B when Org B has none
        r_set_a = await client.patch(
            "/admin/settings/public_channel",
            headers=headers_a,
            json={"value": f"@shop_a_{suffix}"},
        )
        assert r_set_a.status_code == 200
        r_get_b = await client.get("/admin/settings", headers=headers_b)
        assert r_get_b.status_code == 200
        assert r_get_b.json()["public_channel"] != f"shop_a_{suffix}"
