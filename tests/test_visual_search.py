"""Tests for Visual Search: customer product image understanding and structured catalog matching."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import webhooks
from app.models import Base, BusinessConnection, Conversation, Message, Organization, Product
from app.services.knowledge import KnowledgeService


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_search_products_ranks_closest_matches_with_tenant_isolation(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "vis_prod.db")
    try:
        ks = KnowledgeService()
        async with SessionFactory() as db:
            org_a = Organization(name="Laptop A", slug="laptop-a")
            org_b = Organization(name="Laptop B", slug="laptop-b")
            db.add_all([org_a, org_b])
            await db.flush()

            db.add_all([
                Product(
                    organization_id=org_a.id,
                    code="L-1",
                    name="Asus TUF Gaming F15 Qora",
                    category="Gaming Laptops",
                    specs="RTX 4060 16GB RAM 15.6",
                    price="950$",
                    is_active=True,
                ),
                Product(
                    organization_id=org_a.id,
                    code="L-2",
                    name="Lenovo IdeaPad Oq",
                    category="Office",
                    specs="8GB RAM 256GB SSD",
                    price="450$",
                    is_active=True,
                ),
                Product(
                    organization_id=org_b.id,
                    code="L-99",
                    name="Asus TUF RTX 4060 Boshqa Do'kon",
                    category="Gaming",
                    specs="16GB RAM",
                    price="900$",
                    is_active=True,
                ),
            ])
            await db.commit()

            results = await ks.search_products(
                db,
                "Qora rangli o'yin noutbuki Asus TUF RTX",
                limit=3,
                organization_id=org_a.id,
            )
            assert len(results) == 1
            assert results[0].code == "L-1"
            assert all(r.organization_id == org_a.id for r in results)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_business_webhook_visual_search_photo_recommends_products(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "vis_wh.db")
    try:
        async with SessionFactory() as db:
            org = Organization(name="Sneaker Shop", slug="sneaker-shop")
            db.add(org)
            await db.flush()
            bc = BusinessConnection(
                id="bc-vis-1",
                organization_id=org.id,
                owner_user_id=888888,
                is_enabled=True,
                rights={"can_reply": True},
            )
            db.add(bc)
            db.add(
                Product(
                    organization_id=org.id,
                    code="SNK-01",
                    name="Nike Air Force 1 Oq",
                    category="Krossovka",
                    specs="Oq charm krossovka, 40-44 razmer",
                    price="420 000 so'm",
                    is_active=True,
                )
            )
            await db.commit()
            org_id = org.id

        class FakeTg:
            async def read_business_message(self, *args, **kwargs):
                return True

            async def send_chat_action(self, *args, **kwargs):
                return True

            async def download_file_bytes(self, file_id):
                assert file_id == "photo_large_id"
                return b"jpeg-image-bytes", "photos/shoe.jpg"

        captured_answer = []

        async def _fake_describe(image_bytes, mime_type="image/jpeg", *, organization_id=None, db=None):
            assert image_bytes == b"jpeg-image-bytes"
            assert organization_id == org_id
            return "Oq rangli Nike krossovka sport oyoq kiyim"

        async def _fake_search(db, query, limit=6, organization_id=None):
            return []

        async def _fake_answer(customer_text, context, history, organization_id=None, db=None, *, extra_products=None):
            captured_answer.append((customer_text, extra_products))
            return {
                "reply": "Rasmdagi oq Nike Air Force 1 krossovkamiz mavjud, narxi 420 000 so'm!",
                "handoff": False,
                "reason": None,
                "intent": "product_question",
                "order_created": False,
                "order_data": None,
                "attach_photo": False,
                "source_post_id": None,
            }

        monkeypatch.setattr(webhooks, "get_telegram_service", lambda _tok: FakeTg())
        monkeypatch.setattr(webhooks.knowledge, "describe_image", _fake_describe)
        monkeypatch.setattr(webhooks.knowledge, "search", _fake_search)
        monkeypatch.setattr(webhooks.sales_ai, "answer", _fake_answer)

        staged = []
        from app.services import durable_inbox
        async def _fake_stage(db, *, idempotency_key, event_type, payload, organization_id=None):
            staged.append((event_type, payload))
        monkeypatch.setattr(durable_inbox, "stage_outbox_event", _fake_stage)

        photo_msg = {
            "message_id": 601,
            "business_connection_id": "bc-vis-1",
            "chat": {"id": 777111, "type": "private"},
            "from": {"id": 777111, "first_name": "Madina", "username": "madina_v"},
            "photo": [
                {"file_id": "photo_small_id", "width": 90, "height": 90},
                {"file_id": "photo_large_id", "width": 1280, "height": 1280},
            ],
            "caption": "Mana shunaqasi bormi?",
        }

        async with SessionFactory() as db:
            await webhooks._handle_business_message(photo_msg, db=db)
            await db.commit()

            conv = (await db.execute(select(Conversation).where(Conversation.organization_id == org_id))).scalar_one()
            assert conv.status == "ai_active"
            saved_msg = (await db.execute(select(Message).where(Message.conversation_id == conv.id))).scalar_one()
            assert "Oq rangli Nike krossovka" in saved_msg.text
            assert "Mana shunaqasi bormi?" in saved_msg.text

        assert len(captured_answer) == 1
        assert captured_answer[0][1][0]["name"] == "Nike Air Force 1 Oq"
        assert any(evt == "send_business_text" and "420 000" in payload["text"] for evt, payload in staged)
    finally:
        await engine.dispose()
