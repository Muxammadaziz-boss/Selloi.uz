"""Tests for Section 1 tenant logs aggregation and server-persisted customer notes."""

from datetime import datetime, timedelta, timezone
import httpx
import pytest
from sqlalchemy import func, select
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
    ConnectedChannel,
    Conversation,
    Customer,
    Message,
    Order,
    Organization,
)


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [
        t for t in Base.metadata.sorted_tables if t.name != "channel_posts"
    ]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_customer_note_persistence_and_tenant_isolation(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "notes.db")
    try:
        async with SessionFactory() as db:
            org_a = Organization(name="Note Shop A", slug="note-shop-a")
            org_b = Organization(name="Note Shop B", slug="note-shop-b")
            db.add_all([org_a, org_b])
            await db.flush()

            bc_a = BusinessConnection(id="bc-note-a", organization_id=org_a.id)
            bc_b = BusinessConnection(id="bc-note-b", organization_id=org_b.id)
            db.add_all([bc_a, bc_b])
            await db.flush()

            conv_a = Conversation(
                organization_id=org_a.id,
                business_connection_id=bc_a.id,
                chat_id=910001,
                customer_name="Ali",
                username="ali_uz",
                status="ai_active",
            )
            conv_b = Conversation(
                organization_id=org_b.id,
                business_connection_id=bc_b.id,
                chat_id=910002,
                customer_name="Vali",
                username="vali_uz",
                status="ai_active",
            )
            db.add_all([conv_a, conv_b])
            await db.commit()
            await db.refresh(conv_a)
            await db.refresh(conv_b)
            org_a_id = org_a.id
            conv_a_id = conv_a.id
            conv_b_id = conv_b.id

        fake_admin = Admin(
            id=1,
            organization_id=org_a_id,
            telegram_user_id=777001,
            name="Owner A",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: fake_admin
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_a_id
        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                r1 = await client.put(
                    f"/admin/conversations/{conv_a_id}/note",
                    json={"notes": "Katta buyurtmachi, chegirma kutyapti"},
                )
                assert r1.status_code == 200
                assert r1.json()["note"] == "Katta buyurtmachi, chegirma kutyapti"

                r2 = await client.put(
                    f"/admin/conversations/{conv_a_id}/note",
                    json={"notes": "2 oy kafolat va yetkazib berish kerak"},
                )
                assert r2.status_code == 200
                assert r2.json()["note"] == "2 oy kafolat va yetkazib berish kerak"

                convs_resp = await client.get("/admin/conversations")
                assert convs_resp.status_code == 200
                matched = [c for c in convs_resp.json() if c["id"] == conv_a_id]
                assert len(matched) == 1
                assert matched[0]["note"] == "2 oy kafolat va yetkazib berish kerak"

                r_cross = await client.put(
                    f"/admin/conversations/{conv_b_id}/note",
                    json={"notes": "Unauthorized note"},
                )
                assert r_cross.status_code == 404
        finally:
            app.dependency_overrides.clear()

        async with SessionFactory() as db:
            cust_count = await db.scalar(
                select(func.count(Customer.id)).where(
                    Customer.organization_id == org_a_id,
                    Customer.telegram_user_id == 910001,
                )
            )
            assert cust_count == 1
            audit_count = await db.scalar(
                select(func.count(AuditLog.id)).where(
                    AuditLog.organization_id == org_a_id,
                    AuditLog.action == "customer.note_updated",
                )
            )
            assert audit_count == 2
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_tenant_logs_aggregates_real_events_without_leakage(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "logs.db")
    try:
        now = datetime.now(timezone.utc)
        async with SessionFactory() as db:
            org_a = Organization(name="Log Shop A", slug="log-shop-a")
            org_b = Organization(name="Log Shop B", slug="log-shop-b")
            db.add_all([org_a, org_b])
            await db.flush()

            bc_a = BusinessConnection(id="bc-log-a", organization_id=org_a.id)
            bc_b = BusinessConnection(id="bc-log-b", organization_id=org_b.id)
            db.add_all([bc_a, bc_b])
            await db.flush()

            conv_a = Conversation(
                organization_id=org_a.id,
                business_connection_id=bc_a.id,
                chat_id=920001,
                customer_name="Sarvar",
                status="ai_active",
            )
            conv_b = Conversation(
                organization_id=org_b.id,
                business_connection_id=bc_b.id,
                chat_id=920002,
                customer_name="SecretCustomer",
                status="ai_active",
            )
            db.add_all([conv_a, conv_b])
            await db.flush()

            db.add_all([
                Message(
                    organization_id=org_a.id,
                    conversation_id=conv_a.id,
                    telegram_message_id=101,
                    direction="assistant",
                    text="Salom Sarvar, narxlarimiz 200 mingdan",
                    created_at=now - timedelta(minutes=2),
                ),
                Message(
                    organization_id=org_a.id,
                    conversation_id=conv_a.id,
                    telegram_message_id=102,
                    direction="admin",
                    text="Ertaga yetkazib beramiz",
                    created_at=now - timedelta(minutes=1),
                ),
                Message(
                    organization_id=org_b.id,
                    conversation_id=conv_b.id,
                    telegram_message_id=201,
                    direction="assistant",
                    text="SecretOrgB message should never appear",
                    created_at=now,
                ),
                Order(
                    organization_id=org_a.id,
                    conversation_id=conv_a.id,
                    customer_name="Sarvar",
                    product_summary="Krossovka Nike 42",
                    amount="350,000 so'm",
                    status="Confirmed",
                    created_at=now - timedelta(minutes=3),
                ),
                ConnectedChannel(
                    organization_id=org_a.id,
                    channel_username="sarvar_shop_uz",
                    posts_count=14,
                    is_active=True,
                    last_synced_at=now - timedelta(minutes=4),
                ),
            ])
            await db.commit()
            org_a_id = org_a.id

        fake_admin = Admin(
            id=2,
            organization_id=org_a_id,
            telegram_user_id=777002,
            name="Owner Logs A",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: fake_admin
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_a_id
        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.get("/admin/logs?limit=20")
                assert resp.status_code == 200
                data = resp.json()
                assert data["organization_id"] == org_a_id
                logs = data["logs"]
                sources = {item["source"] for item in logs}
                assert {"AI Engine", "Operator", "Order", "Channel Sync"}.issubset(sources)
                serialized = str(logs)
                assert "SecretCustomer" not in serialized
                assert "SecretOrgB" not in serialized
        finally:
            app.dependency_overrides.clear()
    finally:
        await engine.dispose()
