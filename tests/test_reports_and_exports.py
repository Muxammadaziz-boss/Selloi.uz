"""Tests for per-store UTF-8 CSV exports and daily scheduled Telegram digest reports."""

from datetime import datetime, timedelta, timezone
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.permissions import ROLE_DEFAULTS
from app.dependencies.auth import get_current_admin
from app.dependencies.tenant import get_admin_tenant_id
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
    Product,
    StoreReportConfig,
)
from app.services import telegram as telegram_module
from app.services.report_service import run_all_enabled_store_reports


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
async def test_store_csv_exports_are_utf8_bom_and_tenant_scoped(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "store_csv.db")

    async def _override_get_db():
        async with SessionFactory() as session:
            yield session

    try:
        async with SessionFactory() as db:
            org1 = Organization(name="Alpha Store", slug="alpha-store")
            org2 = Organization(name="Beta Store", slug="beta-store")
            db.add_all([org1, org2])
            await db.flush()

            bc1 = BusinessConnection(id="bc-a", organization_id=org1.id, is_enabled=True, rights={"can_reply": True})
            bc2 = BusinessConnection(id="bc-b", organization_id=org2.id, is_enabled=True, rights={"can_reply": True})
            db.add_all([bc1, bc2])
            await db.flush()

            conv1 = Conversation(organization_id=org1.id, business_connection_id=bc1.id, chat_id=101, customer_name="Kamoliddin")
            conv2 = Conversation(organization_id=org2.id, business_connection_id=bc2.id, chat_id=202, customer_name="Boshqa Mijoz")
            db.add_all([conv1, conv2])
            await db.flush()

            db.add_all([
                Order(organization_id=org1.id, conversation_id=conv1.id, customer_name="Kamoliddin", product_summary="Quloqchin", amount="180000 so'm", status="confirmed"),
                Order(organization_id=org2.id, conversation_id=conv2.id, customer_name="Boshqa Mijoz", product_summary="Maxfiy Tovar", amount="999$", status="new"),
                Product(organization_id=org1.id, code="AUD-1", name="Quloqchin Pro", category="Audio", price="180000 so'm"),
                Product(organization_id=org2.id, code="SEC-1", name="Maxfiy Mahsulot", category="Other", price="100$"),
            ])
            await db.commit()
            org1_id = org1.id

        admin_stub = Admin(
            id=1,
            telegram_user_id=99100,
            name="Alpha Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )
        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_admin] = lambda: admin_stub
        app.dependency_overrides[get_admin_tenant_id] = lambda: org1_id

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            r_orders = await client.get("/admin/export/orders")
            assert r_orders.status_code == 200
            assert r_orders.content.startswith(b"\xef\xbb\xbf")
            orders_text = r_orders.content.decode("utf-8-sig")
            assert "Kamoliddin" in orders_text
            assert "Boshqa Mijoz" not in orders_text

            r_custs = await client.get("/admin/export/customers")
            assert r_custs.status_code == 200
            custs_text = r_custs.content.decode("utf-8-sig")
            assert "Kamoliddin" in custs_text
            assert "Boshqa Mijoz" not in custs_text

            r_prods = await client.get("/admin/export/products")
            assert r_prods.status_code == 200
            prods_text = r_prods.content.decode("utf-8-sig")
            assert "Quloqchin Pro" in prods_text
            assert "Maxfiy Mahsulot" not in prods_text

            r_bad = await client.get("/admin/export/unknown")
            assert r_bad.status_code == 400
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()


@pytest.mark.asyncio
async def test_store_daily_report_config_scheduler_and_dedup(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "store_report.db")
    dummy_tg = _DummyTelegram()
    monkeypatch.setattr(telegram_module, "telegram", dummy_tg)

    async def _override_get_db():
        async with SessionFactory() as session:
            yield session

    try:
        async with SessionFactory() as db:
            org = Organization(name="Nur Electronics", slug="nur-electronics")
            db.add(org)
            await db.flush()

            admin_row = Admin(
                organization_id=org.id,
                telegram_user_id=665544,
                name="Nur Admin",
                role="owner",
                permissions=ROLE_DEFAULTS["owner"],
                is_active=True,
            )
            bc = BusinessConnection(id="bc-nur", organization_id=org.id, is_enabled=True, rights={"can_reply": True})
            db.add_all([admin_row, bc])
            await db.flush()

            conv = Conversation(organization_id=org.id, business_connection_id=bc.id, chat_id=3001, customer_name="Diyor")
            db.add(conv)
            await db.flush()
            db.add(Message(organization_id=org.id, conversation_id=conv.id, telegram_message_id=1, direction="customer", text="Salom"))
            db.add(Order(organization_id=org.id, conversation_id=conv.id, customer_name="Diyor", product_summary="TV", amount="400$", status="confirmed"))
            await db.commit()
            org_id = org.id

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_current_admin] = lambda: admin_row
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_id

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            cfg_get = await client.get("/admin/reports/config")
            assert cfg_get.status_code == 200
            assert "Nur Electronics" in cfg_get.json()["preview"]["report_text"]

            cfg_put = await client.put(
                "/admin/reports/config",
                json={"is_enabled": True, "send_hour": 21, "include_orders": True, "include_customers": True},
            )
            assert cfg_put.status_code == 200
            assert cfg_put.json()["config"]["is_enabled"] is True
            assert cfg_put.json()["config"]["send_hour"] == 21

            dry_res = await client.post("/admin/reports/send-now", json={"dry_run": True})
            assert dry_res.status_code == 200
            assert dry_res.json()["dry_run"] is True
            assert dry_res.json()["recipient_count"] == 1
            assert len(dummy_tg.sent) == 0

        # Scheduled sweep before 21:00 Tashkent (15:00 UTC == 20:00 Tashkent) -> 0 sent
        async with SessionFactory() as db:
            before_hour = datetime(2026, 11, 26, 15, 0, tzinfo=timezone.utc)
            assert await run_all_enabled_store_reports(db, now_utc=before_hour) == 0

            # At 21:30 Tashkent (16:30 UTC == 21:30 Tashkent) -> sends once!
            after_hour = datetime(2026, 11, 26, 16, 30, tzinfo=timezone.utc)
            assert await run_all_enabled_store_reports(db, now_utc=after_hour) == 1
            # Same day second sweep -> deduped via last_sent_date -> 0 sent
            assert await run_all_enabled_store_reports(db, now_utc=after_hour) == 0

            cfg_row = (await db.execute(select(StoreReportConfig).where(StoreReportConfig.organization_id == org_id))).scalar_one()
            assert cfg_row.last_sent_date == "2026-11-26"
            audit = (await db.execute(select(AuditLog).where(AuditLog.action == "store_report.sent"))).scalar_one_or_none()
            assert audit is not None
    finally:
        app.dependency_overrides.clear()
        await engine.dispose()
