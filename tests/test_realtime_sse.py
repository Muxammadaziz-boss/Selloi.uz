"""Tests for multi-tenant real-time SSE hub and GET /admin/events stream."""

import asyncio
import json
import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import get_db
from app.core.permissions import ROLE_DEFAULTS
from app.dependencies.auth import get_current_admin
from app.dependencies.tenant import get_admin_tenant_id
from app.main import app
from app.models import Admin, Base, BusinessConnection, Conversation, Organization
from app.services.realtime import format_sse, publish_event, realtime_hub


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def test_format_sse_frame():
    frame = format_sse("message.created", {"conversation_id": 12, "text": "Salom"}, event_id="ev-1")
    assert frame.startswith("id: ev-1\nevent: message.created\ndata: ")
    assert frame.endswith("\n\n")
    data_line = frame.splitlines()[2].removeprefix("data: ")
    assert json.loads(data_line) == {"conversation_id": 12, "text": "Salom"}


@pytest.mark.asyncio
async def test_realtime_hub_strict_tenant_isolation():
    async with realtime_hub.subscribe(101) as q_org_a:
        async with realtime_hub.subscribe(202) as q_org_b:
            await publish_event(None, "message.created", {"text": "ignored"})
            await publish_event(0, "message.created", {"text": "ignored"})
            await publish_event(101, "message.created", {"conversation_id": 7, "text": "Assalomu alaykum"})

            ev = await asyncio.wait_for(q_org_a.get(), timeout=1.0)
            assert ev["organization_id"] == 101
            assert ev["type"] == "message.created"
            assert ev["conversation_id"] == 7
            assert ev["text"] == "Assalomu alaykum"
            assert q_org_b.empty()


@pytest.mark.asyncio
async def test_admin_events_requires_auth():
    prev_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/admin/events")
            assert resp.status_code == 401
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(prev_overrides)


@pytest.mark.asyncio
async def test_admin_events_sse_stream_delivers_scoped_events():
    from app.api.admin import stream_admin_events

    checks = 0

    class FakeRequest:
        async def is_disconnected(self) -> bool:
            nonlocal checks
            checks += 1
            return checks > 1

    response = await stream_admin_events(request=FakeRequest(), org_id=501)
    assert response.status_code == 200
    assert response.media_type == "text/event-stream"
    assert response.headers["x-accel-buffering"] == "no"
    assert "no-cache" in response.headers["cache-control"]

    iterator = response.body_iterator
    first_chunk = await asyncio.wait_for(anext(iterator), timeout=1.0)
    assert "event: connected" in first_chunk
    assert '"organization_id": 501' in first_chunk

    # Publish cross-tenant event first (must be ignored), then matching org event
    await publish_event(502, "message.created", {"conversation_id": 999, "text": "Boshqa dokon"})
    await publish_event(501, "handoff.required", {"conversation_id": 42, "customer_name": "Dilshod"})

    second_chunk = await asyncio.wait_for(anext(iterator), timeout=1.0)
    assert "Boshqa dokon" not in second_chunk
    assert "event: handoff.required" in second_chunk
    assert '"conversation_id": 42' in second_chunk
    assert "Dilshod" in second_chunk

    # Clean exit when client disconnects (checks > 2)
    with pytest.raises(StopAsyncIteration):
        await asyncio.wait_for(anext(iterator), timeout=1.0)


@pytest.mark.asyncio
async def test_takeover_and_resume_emit_realtime_events(tmp_path):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "sse_actions.db")
    try:
        async with SessionFactory() as db:
            org = Organization(name="SSE Store", slug="sse-store")
            db.add(org)
            await db.flush()
            bc = BusinessConnection(id="bc-sse-1", organization_id=org.id)
            db.add(bc)
            await db.flush()
            conv = Conversation(
                organization_id=org.id,
                business_connection_id=bc.id,
                chat_id=88001,
                customer_name="Kamol",
                username="kamol_uz",
                status="ai_active",
            )
            db.add(conv)
            await db.commit()
            await db.refresh(conv)
            org_id = org.id
            conv_id = conv.id

        fake_admin = Admin(
            id=1,
            organization_id=org_id,
            telegram_user_id=777999,
            name="Owner",
            role="owner",
            permissions=ROLE_DEFAULTS["owner"],
            is_active=True,
        )

        async def _override_db():
            async with SessionFactory() as s:
                yield s

        prev_overrides = dict(app.dependency_overrides)
        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[get_current_admin] = lambda: fake_admin
        app.dependency_overrides[get_admin_tenant_id] = lambda: org_id

        try:
            async with realtime_hub.subscribe(org_id) as queue:
                transport = httpx.ASGITransport(app=app)
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                    r1 = await client.post(
                        f"/admin/conversations/{conv_id}/takeover",
                        json={"reason": "Operator ulanmoqda"},
                    )
                    assert r1.status_code == 200
                    ev1 = await asyncio.wait_for(queue.get(), timeout=1.0)
                    assert ev1["type"] == "conversation.updated"
                    assert ev1["conversation_id"] == conv_id
                    assert ev1["status"] == "human_takeover"

                    r2 = await client.post(f"/admin/conversations/{conv_id}/resume")
                    assert r2.status_code == 200
                    ev2 = await asyncio.wait_for(queue.get(), timeout=1.0)
                    assert ev2["type"] == "conversation.updated"
                    assert ev2["conversation_id"] == conv_id
                    assert ev2["status"] == "ai_active"
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(prev_overrides)
    finally:
        await engine.dispose()
