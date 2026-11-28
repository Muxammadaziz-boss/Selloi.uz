"""Tests for Step 4: multi-worker distributed locks, cross-worker wizard state,
and backend plan-tier gating for custom bots (PRO+) and User Chat MTProto (ULTRA).
"""

from pathlib import Path
from unittest.mock import AsyncMock, patch
import uuid
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.core.db as core_db
from app.core.config import settings
from app.core.security import hash_password
from app.dependencies.auth import create_access_token
from app.models import Organization, OrganizationMember, Plan, Subscription, User
from app.services import distributed_lock
from app.services.bot_manager import TenantBotManager
from app.api import bot_commands
from app.main import _run_locked_periodic_job, app

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
core_db.engine = test_engine
core_db.SessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


class _FakeLockRedis:
    """Minimal synchronous Redis KV fake supporting get/set(nx, ex)/delete."""

    def __init__(self):
        self.kv: dict[str, str] = {}

    def get(self, key: str):
        return self.kv.get(key)

    def set(self, key: str, value: str, ex: int | None = None, nx: bool = False):
        if nx and key in self.kv:
            return False
        self.kv[key] = value
        return True

    def delete(self, key: str):
        self.kv.pop(key, None)
        return 1


async def _create_org_with_plan(
    *,
    plan_code: str,
    is_platform_owner: bool = False,
) -> tuple[Organization, User, dict[str, str]]:
    """Create an isolated tenant organization with an active subscription and JWT headers."""
    suffix = uuid.uuid4().hex[:8]
    async with core_db.SessionLocal() as session:
        plan = (await session.execute(select(Plan).where(Plan.code == plan_code))).scalar_one_or_none()
        if plan is None:
            plan = Plan(
                code=plan_code,
                name=plan_code.upper(),
                description=f"{plan_code.upper()} test plan",
                price_monthly=19 if plan_code == "start" else 59,
                price_yearly=190 if plan_code == "start" else 590,
                currency="USD",
                features={},
                limits={},
                is_active=True,
            )
            session.add(plan)
            await session.flush()

        org = Organization(name=f"Store {plan_code} {suffix}", slug=f"store-{plan_code}-{suffix}")
        session.add(org)

        user = User(
            email=f"owner_{plan_code}_{suffix}@ai-sales.uz",
            full_name=f"Owner {plan_code}",
            hashed_password=hash_password("Pass123!"),
            email_verified=True,
            telegram_user_id=800000000 + (int(suffix, 16) % 90000000),
            is_platform_owner=is_platform_owner,
        )
        session.add(user)
        await session.flush()

        session.add(
            OrganizationMember(
                organization_id=org.id,
                user_id=user.id,
                role="owner",
                permissions={"can_manage_settings": True, "can_manage_billing": True},
                is_active=True,
            )
        )
        session.add(
            Subscription(
                organization_id=org.id,
                plan_id=plan.id,
                status="subscription_active",
                billing_cycle="monthly",
                provider="mock",
            )
        )
        await session.commit()
        await session.refresh(org)
        await session.refresh(user)

    token = create_access_token(user.id, user.email)
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Organization-Id": str(org.id),
    }
    return org, user, headers


# ===========================================================================
# 1. Multi-Worker Distributed Locks, Bot Manager & Cross-Worker Wizard State
# ===========================================================================


def test_distributed_lock_mutual_exclusion_renewal_and_owner_release():
    fake_redis = _FakeLockRedis()

    ok_a, tok_a = distributed_lock.try_acquire_lock(
        "loop:test_job", ttl_seconds=60, owner_id="worker-1", renew=True, redis_client=fake_redis
    )
    ok_b, tok_b = distributed_lock.try_acquire_lock(
        "loop:test_job", ttl_seconds=60, owner_id="worker-2", renew=True, redis_client=fake_redis
    )
    assert ok_a is True
    assert tok_a == "worker-1"
    assert ok_b is False
    assert tok_b == "worker-2"

    # Existing owner can renew lease; another worker cannot release it
    ok_renew, _ = distributed_lock.try_acquire_lock(
        "loop:test_job", ttl_seconds=120, owner_id="worker-1", renew=True, redis_client=fake_redis
    )
    assert ok_renew is True
    assert distributed_lock.release_lock("loop:test_job", owner_id="worker-2", redis_client=fake_redis) is False
    assert distributed_lock.release_lock("loop:test_job", owner_id="worker-1", redis_client=fake_redis) is True

    # Now worker-2 can acquire cleanly
    ok_b2, _ = distributed_lock.try_acquire_lock(
        "loop:test_job", ttl_seconds=60, owner_id="worker-2", renew=False, redis_client=fake_redis
    )
    assert ok_b2 is True


def test_distributed_lock_in_memory_fallback_when_redis_unavailable(monkeypatch):
    monkeypatch.setattr(distributed_lock, "_resolve_redis", lambda _client=None: None)
    distributed_lock._MEM_LEASES.clear()

    ok1, _ = distributed_lock.try_acquire_lock("mem_test_lock", ttl_seconds=60, owner_id="proc-1")
    ok2, _ = distributed_lock.try_acquire_lock("mem_test_lock", ttl_seconds=60, owner_id="proc-2")
    assert ok1 is True
    assert ok2 is False
    assert distributed_lock.release_lock("mem_test_lock", owner_id="proc-2") is False
    assert distributed_lock.release_lock("mem_test_lock", owner_id="proc-1") is True


@pytest.mark.anyio
async def test_periodic_job_runs_strictly_once_across_workers():
    fake_redis = _FakeLockRedis()
    calls = 0

    async def _sample_job():
        nonlocal calls
        calls += 1

    ran_w1 = await _run_locked_periodic_job(
        "loop:smart_followup", 840, _sample_job, owner_id="uvicorn-w1", redis_client=fake_redis
    )
    ran_w2 = await _run_locked_periodic_job(
        "loop:smart_followup", 840, _sample_job, owner_id="uvicorn-w2", redis_client=fake_redis
    )
    assert ran_w1 is True
    assert ran_w2 is False
    assert calls == 1


@pytest.mark.anyio
async def test_bot_manager_leader_election_prevents_dual_polling(monkeypatch):
    fake_redis = _FakeLockRedis()
    mgr1 = TenantBotManager()
    mgr2 = TenantBotManager()

    # Simulate two separate workers trying to run supervision
    with patch("app.services.bot_manager.try_acquire_lock") as mock_acq, \
         patch.object(mgr1, "_refresh_workers", new_callable=AsyncMock) as r1, \
         patch.object(mgr2, "_refresh_workers", new_callable=AsyncMock) as r2:

        # Worker 1 acquires leader, runs refresh
        mgr1._running = True
        mgr2._running = False
        mock_acq.side_effect = lambda name, ttl_seconds=150, renew=False: distributed_lock.try_acquire_lock(
            name, ttl_seconds=ttl_seconds, owner_id="worker-1", renew=renew, redis_client=fake_redis
        )
        # Perform single supervision check
        acquired1, _ = mock_acq("bot_manager_leader", renew=True)
        if acquired1:
            mgr1._is_leader = True
            await mgr1._refresh_workers()

        # Worker 2 must NOT acquire leader while Worker 1 holds it
        mock_acq.side_effect = lambda name, ttl_seconds=150, renew=False: distributed_lock.try_acquire_lock(
            name, ttl_seconds=ttl_seconds, owner_id="worker-2", renew=renew, redis_client=fake_redis
        )
        acquired2, _ = mock_acq("bot_manager_leader", renew=True)
        if acquired2:
            mgr2._is_leader = True
            await mgr2._refresh_workers()

        assert mgr1._is_leader is True
        assert mgr2._is_leader is False
        r1.assert_awaited_once()
        r2.assert_not_awaited()


def test_bot_commands_wizard_state_persists_in_redis_across_workers(monkeypatch):
    fake_redis = _FakeLockRedis()
    monkeypatch.setattr(bot_commands, "_wizard_redis_client", lambda: fake_redis)
    bot_commands._wizard_state.clear()

    bot_commands._set_wizard_state(4242, {"step": "awaiting_id", "chat_id": 9001})
    # Wipe worker-local RAM to simulate next Telegram webhook hitting a different Uvicorn worker
    bot_commands._wizard_state.clear()

    loaded = bot_commands._get_wizard_state(4242)
    assert loaded == {"step": "awaiting_id", "chat_id": 9001}

    bot_commands._pop_wizard_state(4242)
    assert bot_commands._get_wizard_state(4242) is None


def test_dockerfile_configures_multi_worker_uvicorn():
    dockerfile_text = Path("Dockerfile").read_text(encoding="utf-8")
    assert '"--workers", "2"' in dockerfile_text


# ===========================================================================
# 2. Backend Plan-Tier Gating for Custom Bot (PRO+) and User Chat (ULTRA)
# ===========================================================================


@pytest.mark.anyio
async def test_start_plan_blocks_custom_bot_and_user_chat_but_allows_prompt():
    org, _user, headers = await _create_org_with_plan(plan_code="start")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Allowed on START: AI system prompt + admin chat notification ID + shared bot link
        ok_resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={"custom_system_prompt": "Yordamchi sotuvchi", "admin_chat_id": "6990611858"},
        )
        assert ok_resp.status_code == 200, ok_resp.text

        # Blocked on START: dedicated Telegram BotFather token -> 402 PRO required
        bot_resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={"telegram_bot_token": "123456:START_BLOCKED_TOKEN"},
        )
        assert bot_resp.status_code == 402
        assert bot_resp.json()["detail"]["required_plan"] == "PRO"

        # Blocked on START: MTProto User Chat -> 402 ULTRA required
        uc_resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={"telegram_api_id": 20400123, "telegram_api_hash": "0123456789abcdef"},
        )
        assert uc_resp.status_code == 402
        assert uc_resp.json()["detail"]["required_plan"] == "ULTRA"

        # Blocked on START: webhook setup -> 402 PRO required
        wh_resp = await client.post(
            f"/api/organizations/{org.id}/set-webhook",
            headers=headers,
        )
        assert wh_resp.status_code == 402
        assert wh_resp.json()["detail"]["required_plan"] == "PRO"


@pytest.mark.anyio
async def test_pro_plan_allows_custom_bot_and_webhook_but_blocks_user_chat(monkeypatch):
    monkeypatch.setattr(settings, "public_webhook_url", "https://api.aisales.uz")
    org, _user, headers = await _create_org_with_plan(plan_code="pro")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Allowed on PRO: dedicated BotFather token
        bot_resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={"telegram_bot_token": "123456:PRO_ALLOWED_TOKEN"},
        )
        assert bot_resp.status_code == 200, bot_resp.text
        assert bot_resp.json()["organization"]["telegram_bot_token_set"] is True

        # Allowed on PRO: webhook setup
        with patch("app.services.telegram.TelegramService.set_webhook", new_callable=AsyncMock) as mock_wh:
            mock_wh.return_value = {"ok": True}
            wh_resp = await client.post(
                f"/api/organizations/{org.id}/set-webhook",
                headers=headers,
            )
            assert wh_resp.status_code == 200, wh_resp.text
            mock_wh.assert_awaited_once()

        # Blocked on PRO: MTProto User Chat -> 402 ULTRA required
        uc_resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={"telegram_phone": "+998901234567"},
        )
        assert uc_resp.status_code == 402
        assert uc_resp.json()["detail"]["required_plan"] == "ULTRA"


@pytest.mark.anyio
async def test_ultra_plan_allows_user_chat_and_downgraded_org_can_still_save_prompt():
    org, _user, headers = await _create_org_with_plan(plan_code="ultra")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        uc_resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={
                "telegram_bot_token": "654321:ULTRA_BOT",
                "telegram_api_id": 20400999,
                "telegram_api_hash": "fedcba9876543210",
                "telegram_phone": "+998909998877",
            },
        )
        assert uc_resp.status_code == 200, uc_resp.text
        org_data = uc_resp.json()["organization"]
        assert org_data["telegram_bot_token_set"] is True
        assert org_data["telegram_api_hash_set"] is True

        # Simulate plan downgrade to START and verify unchanged echoed MTProto fields do not block prompt update
        async with core_db.SessionLocal() as session:
            start_plan = (await session.execute(select(Plan).where(Plan.code == "start"))).scalar_one()
            sub = (await session.execute(select(Subscription).where(Subscription.organization_id == org.id))).scalar_one()
            sub.plan_id = start_plan.id
            await session.commit()

        prompt_resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={
                "custom_system_prompt": "Yangilangan matn",
                "telegram_api_id": 20400999,
                "telegram_phone": "+998909998877",
            },
        )
        assert prompt_resp.status_code == 200, prompt_resp.text

        # Changing MTProto phone after downgrade is rejected
        change_phone = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={"telegram_phone": "+998901112233"},
        )
        assert change_phone.status_code == 402


@pytest.mark.anyio
async def test_platform_owner_can_configure_bot_and_user_chat_regardless_of_plan():
    org, _user, headers = await _create_org_with_plan(plan_code="start", is_platform_owner=True)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put(
            f"/api/organizations/current?organization_id={org.id}",
            headers=headers,
            json={
                "telegram_bot_token": "111222:PLATFORM_OWNER_BOT",
                "telegram_api_id": 1234567,
                "telegram_api_hash": "owner_hash_123",
            },
        )
        assert resp.status_code == 200, resp.text
