"""Tests for enhanced Admin Panel endpoints (store inspector, subscription override, daily report, broadcast, enriched users)."""

from datetime import datetime, timedelta, timezone
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.admin import get_current_admin
from app.core.db import get_db
from app.core.permissions import ROLE_DEFAULTS
from app.core.security import hash_password
from app.main import app
from app.models import (
    Admin,
    AuditLog,
    Base,
    BusinessConnection,
    Conversation,
    Message,
    Order,
    Organization,
    OrganizationMember,
    Plan,
    Product,
    Subscription,
    User,
)
from app.services import telegram as telegram_module


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


class _DummyTelegram:
    def __init__(self):
        self.sent: list[tuple[int | str, str]] = []

    async def send_message(self, chat_id, text, **kwargs):
        self.sent.append((chat_id, text))
        return {"message_id": len(self.sent)}


@pytest.mark.asyncio
async def test_store_details_subscription_update_and_enriched_users(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "platform_admin.db")

    async def _override_get_db():
        async with SessionFactory() as session:
            yield session

    try:
        async with SessionFactory() as db:
            owner_user = User(
                email="owner@selloi.uz",
                hashed_password=hash_password("OwnerPass123"),
                full_name="Platform Owner",
                telegram_user_id=900001,
                is_platform_owner=True,
                is_active=True,
            )
            merchant_user = User(
                email="merchant@shop.uz",
                hashed_password=hash_password("MerchantPass123"),
                full_name="Ali Savdogar",
                telegram_user_id=900002,
                is_platform_owner=False,
                is_active=True,
            )
            db.add_all([owner_user, merchant_user])
            await db.flush()

            org = Organization(name="Baraka Tech", slug="baraka-tech", category="Elektronika", status="active")
            db.add(org)
            await db.flush()

            db.add(OrganizationMember(organization_id=org.id, user_id=merchant_user.id, role="owner", is_active=True))

            plan_start = Plan(code="start", name="Start", price_monthly=19, price_yearly=190, price_monthly_uzs=24000000, price_yearly_uzs=240000000)
            plan_ultra = Plan(code="ultra", name="Ultra", price_monthly=99, price_yearly=990, price_monthly_uzs=125000000, price_yearly_uzs=1250000000)
            db.add_all([plan_start, plan_ultra])
            await db.flush()

            db.add(
                Subscription(
                    organization_id=org.id,
                    plan_id=plan_start.id,
                    status="trialing",
                    billing_cycle="monthly",
                    current_period_start=datetime.now(timezone.utc),
                    current_period_end=datetime.now(timezone.utc) + timedelta(days=7),
                )
            )
            bc = BusinessConnection(id="bc-baraka", organization_id=org.id, is_enabled=True, rights={"can_reply": True})
            db.add(bc)
            await db.flush()

            conv = Conversation(organization_id=org.id, business_connection_id=bc.id, chat_id=5501, customer_name="Xaridor")
            db.add(conv)
            await db.flush()

            db.add(Message(organization_id=org.id, conversation_id=conv.id, telegram_message_id=101, direction="customer", text="Salom"))
            db.add(Order(organization_id=org.id, conversation_id=conv.id, customer_name="Xaridor", amount="250000 so'm", status="confirmed"))
            db.add(Product(organization_id=org.id, code="P-1", name="Noutbuk", price="500$", is_active=True))
            await db.commit()
            org_id = org.id

        admin_stub = Admin(
            id=owner_user.id,
            telegram_user_id=owner_user.telegram_user_id,
            name="Platform Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )
        admin_stub._is_platform_owner = True
        admin_stub._is_platform_admin = False
        admin_stub._user = owner_user

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_admin] = lambda: admin_stub

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            details_res = await client.get(f"/api/platform/organizations/{org_id}/details")
            assert details_res.status_code == 200
            details = details_res.json()
            assert details["organization"]["slug"] == "baraka-tech"
            assert details["subscription"]["plan_code"] == "START"
            assert details["stats"]["conversations_count"] == 1
            assert details["stats"]["messages_count"] == 1
            assert details["stats"]["orders_count"] == 1
            assert details["stats"]["confirmed_orders_count"] == 1
            assert details["stats"]["products_count"] == 1
            assert len(details["members"]) == 1
            assert details["members"][0]["email"] == "merchant@shop.uz"

            sub_res = await client.patch(
                f"/api/platform/organizations/{org_id}/subscription",
                json={"plan_code": "ultra", "status": "subscription_active", "billing_cycle": "yearly", "extend_days": 30},
            )
            assert sub_res.status_code == 200
            assert sub_res.json()["subscription"]["plan_code"] == "ULTRA"
            assert sub_res.json()["subscription"]["status"] == "subscription_active"

            users_res = await client.get("/api/platform/users")
            assert users_res.status_code == 200
            users_map = {u["email"]: u for u in users_res.json()["users"]}
            assert users_map["merchant@shop.uz"]["organization_names"] == ["Baraka Tech"]
            assert users_map["merchant@shop.uz"]["organizations_count"] == 1
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_platform_daily_report_and_broadcast(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "platform_comm.db")
    dummy_tg = _DummyTelegram()
    monkeypatch.setattr(telegram_module, "telegram", dummy_tg)

    async def _override_get_db():
        async with SessionFactory() as session:
            yield session

    try:
        async with SessionFactory() as db:
            owner_user = User(
                email="boss@selloi.uz",
                hashed_password=hash_password("BossPass123"),
                full_name="Sayt Egasi",
                telegram_user_id=880001,
                is_platform_owner=True,
                is_active=True,
            )
            merchant_user = User(
                email="seller@selloi.uz",
                hashed_password=hash_password("SellerPass123"),
                full_name="Do'kon Egasi",
                telegram_user_id=880002,
                is_platform_owner=False,
                is_active=True,
            )
            db.add_all([owner_user, merchant_user])
            await db.flush()

            org = Organization(name="Ziyo Market", slug="ziyo-market", status="active")
            db.add(org)
            await db.flush()
            db.add(OrganizationMember(organization_id=org.id, user_id=merchant_user.id, role="owner", is_active=True))
            await db.commit()

        admin_stub = Admin(
            id=owner_user.id,
            telegram_user_id=owner_user.telegram_user_id,
            name="Sayt Egasi",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )
        admin_stub._is_platform_owner = True
        admin_stub._is_platform_admin = False
        admin_stub._user = owner_user

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_admin] = lambda: admin_stub

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            rep_res = await client.post("/api/platform/daily-report")
            assert rep_res.status_code == 200
            rep_data = rep_res.json()
            assert rep_data["ok"] is True
            assert rep_data["sent_count"] >= 1
            assert "Selloi Platforma Hisoboti" in rep_data["report_text"]

            dry_res = await client.post(
                "/api/platform/broadcast",
                json={"audience": "store_owners", "message": "Yangi funksiya ishga tushdi!", "dry_run": True},
            )
            assert dry_res.status_code == 200
            assert dry_res.json()["dry_run"] is True
            assert dry_res.json()["recipient_count"] == 1
            assert dry_res.json()["sent_count"] == 0

            send_res = await client.post(
                "/api/platform/broadcast",
                json={"audience": "store_owners", "message": "Yangi funksiya ishga tushdi!", "dry_run": False},
            )
            assert send_res.status_code == 200
            assert send_res.json()["sent_count"] == 1
            assert any(chat_id == 880002 and "Yangi funksiya ishga tushdi!" in txt for chat_id, txt in dummy_tg.sent)

        async with SessionFactory() as db:
            logs = (await db.execute(select(AuditLog))).scalars().all()
            actions = {l.action for l in logs}
            assert {"platform_daily_report", "platform_broadcast"}.issubset(actions)
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
