"""Tests for multi-tenant @Selloi_ai_bot ?start=shop_<slug> routing."""

from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import bot_commands, webhooks
from app.models import Base, Conversation, Organization, TelegramOutbox
from app.services import shared_bot_routing


@pytest.mark.asyncio
async def test_shared_bot_shop_deeplink_binds_and_routes_isolated_store(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'shared_shop.db'}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sc: Base.metadata.create_all(sc, tables=needed_tables))
    SessionFactory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    shared_bot_routing._SHARED_SHOP_MEM.clear()
    sent_calls: list[tuple[str, dict]] = []

    class _FakeTelegram:
        async def call(self, method: str, payload: dict):
            sent_calls.append((method, payload))
            return {"ok": True}

    try:
        async with SessionFactory() as db:
            org1 = Organization(name="Default Central", slug="default-central", status="active")
            org_b = Organization(name="TechHub Tashkent", slug="techhub-uz", status="active")
            org_paused = Organization(name="Paused Store", slug="paused-uz", status="suspended")
            db.add_all([org1, org_b, org_paused])
            await db.commit()
            org_b_id = org_b.id

        with (
            patch.object(shared_bot_routing, "_get_redis_safe", return_value=None),
            patch.object(bot_commands, "telegram", _FakeTelegram()),
            patch.object(webhooks, "telegram", _FakeTelegram()),
        ):
            async with SessionFactory() as db:
                # 1. Paused store is rejected cleanly
                handled_paused = await bot_commands.handle_private_command(
                    {
                        "chat": {"id": 888555},
                        "from": {"id": 888555, "first_name": "Ali"},
                        "text": "/start shop_paused-uz",
                    },
                    db,
                )
                assert handled_paused is True
                assert "topilmadi" in sent_calls[-1][1]["text"]

                # 2. Active START/PRO store deep link binds chat_id to TechHub Tashkent
                handled_ok = await bot_commands.handle_private_command(
                    {
                        "chat": {"id": 888555},
                        "from": {"id": 888555, "first_name": "Ali", "username": "ali_uz"},
                        "text": "/start shop_techhub-uz",
                    },
                    db,
                )
                assert handled_ok is True
                assert "TechHub Tashkent" in sent_calls[-1][1]["text"]

                # 3. Direct message in global @Selloi_ai_bot resolves org_b_id and marks use_shared_bot=True
                with (
                    patch.object(webhooks.sales_ai, "answer", AsyncMock(return_value={
                        "reply": "Salom! TechHub do'konida iPhone mavjud.",
                        "handoff": False,
                        "order_created": False,
                    })),
                    patch.object(webhooks.knowledge, "search", AsyncMock(return_value=[])),
                    patch.object(webhooks.knowledge, "search_products", AsyncMock(return_value=[])),
                ):
                    await webhooks._handle_direct_bot_message(
                        {
                            "message_id": 77,
                            "chat": {"id": 888555, "type": "private"},
                            "from": {"id": 888555, "first_name": "Ali", "username": "ali_uz"},
                            "text": "Salom",
                        },
                        db,
                        organization_id=None,
                    )
                    await db.commit()

                # Clear memory cache to verify DB Conversation fallback also restores TechHub org_id
                shared_bot_routing._SHARED_SHOP_MEM.clear()
                restored_org = await shared_bot_routing.resolve_customer_shared_bot_org_id(db, 888555)
                assert restored_org == org_b_id

                outbox_rows = (await db.execute(select(TelegramOutbox))).scalars().all()
                assert len(outbox_rows) == 1
                assert outbox_rows[0].organization_id == org_b_id
                assert outbox_rows[0].payload.get("use_shared_bot") is True
    finally:
        shared_bot_routing._SHARED_SHOP_MEM.clear()
        await engine.dispose()
