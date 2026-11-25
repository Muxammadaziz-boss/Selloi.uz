"""Tests for multi-tenant AI Playground simulation endpoint (POST /admin/ai/playground)."""

from types import SimpleNamespace
import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.permissions import ROLE_DEFAULTS
from app.dependencies.auth import get_current_admin
from app.dependencies.tenant import get_admin_tenant_id
from app.main import app
from app.models import Admin, Base, Conversation, Message, Order, Organization


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest.mark.asyncio
async def test_ai_playground_requires_auth():
    prev_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/admin/ai/playground", json={"message": "Salom"})
            assert resp.status_code == 401
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev_overrides)


@pytest.mark.asyncio
async def test_ai_playground_rejects_empty_and_runs_isolated_simulation(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "playground.db")
    try:
        async with SessionFactory() as db:
            org = Organization(name="Play Store", slug="play-store")
            db.add(org)
            await db.commit()
            await db.refresh(org)
            org_id = org.id

        fake_admin = Admin(
            id=1,
            organization_id=org_id,
            telegram_user_id=778801,
            name="Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )

        captured_calls = []

        async def _fake_search(db, query, limit=6, organization_id=None):
            captured_calls.append(("search", query, organization_id))
            return [
                SimpleNamespace(
                    id=55,
                    telegram_message_id=901,
                    channel_username="playstore_uz",
                    text="Asus TUF A15 — 850$, 16GB RAM, RTX 4060",
                    image_description="",
                    photo_file_id="photo-abc",
                    image_path=None,
                    source_url="https://t.me/playstore_uz/901",
                )
            ]

        async def _fake_answer(
            customer_text,
            context,
            history,
            organization_id=None,
            db=None,
            *,
            custom_prompt_override=None,
            temperature_override=None,
            model_override=None,
            track_usage=True,
        ):
            captured_calls.append(("answer", customer_text, organization_id, custom_prompt_override, temperature_override, model_override, track_usage))
            return {
                "reply": "Asus TUF A15 narxi 850$, RTX 4060 bilan mavjud!",
                "handoff": False,
                "reason": None,
                "intent": "order_completed",
                "order_created": True,
                "order_data": {
                    "customer_name": "Sardor",
                    "phone": "+998901112233",
                    "product_summary": "Asus TUF A15",
                },
                "attach_photo": True,
                "source_post_id": 901,
            }

        from app.services import ai as ai_module
        from app.services import knowledge as knowledge_module

        monkeypatch.setattr(knowledge_module.knowledge, "search", _fake_search)
        monkeypatch.setattr(ai_module.sales_ai, "answer", _fake_answer)

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        prev_overrides = dict(app.dependency_overrides)
        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: fake_admin
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_id
        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                empty_resp = await client.post("/admin/ai/playground", json={"message": "   "})
                assert empty_resp.status_code == 400

                ok_resp = await client.post(
                    "/admin/ai/playground",
                    json={
                        "message": "Asus TUF qancha?",
                        "history": [{"direction": "customer", "text": "Salom"}],
                        "custom_system_prompt": "Doim mijozga hurmat bilan javob ber",
                        "ai_temperature": 0.15,
                        "ai_model": "gemini-3.5-flash",
                    },
                )
                assert ok_resp.status_code == 200
                data = ok_resp.json()
                assert data["ok"] is True
                assert "850$" in data["reply"]
                assert data["intent"] == "order_completed"
                assert data["order_created"] is True
                assert data["attach_photo"] is True
                assert data["source_post_id"] == 901
                assert len(data["evidence"]) == 1
                assert data["evidence"][0]["channel_username"] == "playstore_uz"
                assert isinstance(data["latency_ms"], int)
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(prev_overrides)

        assert captured_calls[0] == ("search", "Asus TUF qancha?", org_id)
        assert captured_calls[1] == (
            "answer",
            "Asus TUF qancha?",
            org_id,
            "Doim mijozga hurmat bilan javob ber",
            0.15,
            "gemini-3.5-flash",
            False,
        )

        # Ensure simulation wrote zero real rows into business tables
        async with SessionFactory() as db:
            conv_count = await db.scalar(select(func.count(Conversation.id)))
            msg_count = await db.scalar(select(func.count(Message.id)))
            order_count = await db.scalar(select(func.count(Order.id)))
            assert conv_count == 0
            assert msg_count == 0
            assert order_count == 0
    finally:
        await engine.dispose()
