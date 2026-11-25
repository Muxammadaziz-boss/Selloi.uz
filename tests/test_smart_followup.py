"""Tests for Smart Follow-up engine, Business Hours enforcement, and anti-spam caps."""

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
from app.models import Admin, Base, BusinessConnection, Conversation, FollowupLog, Message, Order, Organization
from app.services.followup_service import is_within_business_hours, run_org_followups


async def _make_isolated_session_maker(db_file):
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file}")
    needed_tables = [t for t in Base.metadata.sorted_tables if t.name != "channel_posts"]
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=needed_tables))
    return engine, async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


def test_tashkent_business_hours_check():
    # 06:00 UTC == 11:00 Tashkent (inside 09..20)
    noon_tashkent = datetime(2026, 11, 25, 6, 0, tzinfo=timezone.utc)
    # 20:00 UTC == 01:00 Tashkent (outside 09..20)
    night_tashkent = datetime(2026, 11, 25, 20, 0, tzinfo=timezone.utc)

    assert is_within_business_hours(noon_tashkent, business_hours_only=True, start_hour=9, end_hour=20) is True
    assert is_within_business_hours(night_tashkent, business_hours_only=True, start_hour=9, end_hour=20) is False
    assert is_within_business_hours(night_tashkent, business_hours_only=False, start_hour=9, end_hour=20) is True


@pytest.mark.asyncio
async def test_smart_followup_rules_dry_run_and_antispam(tmp_path, monkeypatch):
    engine, SessionFactory = await _make_isolated_session_maker(tmp_path / "followup.db")
    try:
        now = datetime(2026, 11, 25, 8, 0, tzinfo=timezone.utc)  # 13:00 Tashkent (business hours)
        silent_ts = now - timedelta(hours=8)
        recent_ts = now - timedelta(hours=1)

        async with SessionFactory() as db:
            org = Organization(name="Followup Store", slug="followup-store")
            db.add(org)
            await db.flush()

            bc = BusinessConnection(
                id="bc-fu-1",
                organization_id=org.id,
                is_enabled=True,
                rights={"can_reply": True},
            )
            db.add(bc)
            await db.flush()

            # 1. Eligible silent lead
            conv_eligible = Conversation(
                organization_id=org.id,
                business_connection_id=bc.id,
                chat_id=1001,
                customer_name="Olim",
                status="ai_active",
                last_message_at=silent_ts,
            )
            # 2. Has active order -> MUST be skipped
            conv_ordered = Conversation(
                organization_id=org.id,
                business_connection_id=bc.id,
                chat_id=1002,
                customer_name="Bekzod",
                status="ai_active",
                last_message_at=silent_ts,
            )
            # 3. Human takeover -> MUST be skipped
            conv_takeover = Conversation(
                organization_id=org.id,
                business_connection_id=bc.id,
                chat_id=1003,
                customer_name="Malika",
                status="human_takeover",
                last_message_at=silent_ts,
            )
            # 4. Too recent (< 6h) -> MUST be skipped
            conv_recent = Conversation(
                organization_id=org.id,
                business_connection_id=bc.id,
                chat_id=1004,
                customer_name="Zarina",
                status="ai_active",
                last_message_at=recent_ts,
            )
            db.add_all([conv_eligible, conv_ordered, conv_takeover, conv_recent])
            await db.flush()

            db.add_all([
                Message(organization_id=org.id, conversation_id=conv_eligible.id, telegram_message_id=1, direction="customer", text="Asus TUF narxi qancha?", created_at=silent_ts),
                Message(organization_id=org.id, conversation_id=conv_ordered.id, telegram_message_id=2, direction="customer", text="Buyurtma berdim", created_at=silent_ts),
                Message(organization_id=org.id, conversation_id=conv_takeover.id, telegram_message_id=3, direction="customer", text="Operator kerak", created_at=silent_ts),
                Message(organization_id=org.id, conversation_id=conv_recent.id, telegram_message_id=4, direction="customer", text="Salom", created_at=recent_ts),
                Order(organization_id=org.id, conversation_id=conv_ordered.id, customer_name="Bekzod", product_summary="HP Victus", status="new"),
            ])
            await db.commit()
            org_id = org.id
            conv_eligible_id = conv_eligible.id

        sent_messages = []

        class FakeTg:
            async def send_business_text(self, bc_id, chat_id, text):
                sent_messages.append((bc_id, chat_id, text))
                return {"message_id": 700 + len(sent_messages)}

        from app.services import followup_service
        monkeypatch.setattr(followup_service, "_get_org_telegram", lambda _org: FakeTg())

        fake_admin = Admin(
            id=1,
            organization_id=org_id,
            telegram_user_id=777400,
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
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Configure follow-up (6h delay, max 1 attempt, 5% discount)
                put_resp = await client.put(
                    "/admin/followup/config",
                    json={
                        "is_enabled": True,
                        "delay_hours": 6,
                        "max_attempts": 1,
                        "business_hours_only": True,
                        "start_hour": 9,
                        "end_hour": 20,
                        "offer_discount_pct": 5,
                    },
                )
                assert put_resp.status_code == 200
                assert put_resp.json()["config"]["offer_discount_pct"] == 5

                # 2. Invalid delay rejected cleanly
                bad_resp = await client.put("/admin/followup/config", json={"delay_hours": 100})
                assert bad_resp.status_code == 400

            async with SessionFactory() as db:
                # 3. Outside business hours check returns skipped_reason
                night_res = await run_org_followups(
                    db,
                    organization_id=org_id,
                    dry_run=False,
                    now_utc=datetime(2026, 11, 25, 20, 0, tzinfo=timezone.utc),
                )
                assert night_res["sent_count"] == 0
                assert night_res["skipped_reason"] == "outside_business_hours"

                # 4. Dry run sees ONLY Olim (eligible), never Bekzod/Malika/Zarina
                dry = await run_org_followups(db, organization_id=org_id, dry_run=True, now_utc=now)
                assert dry["candidates_count"] == 1
                assert dry["items"][0]["conversation_id"] == conv_eligible_id
                assert "5%" in dry["items"][0]["suggested_message"]
                assert len(sent_messages) == 0

                # 5. Live run sends once
                live_1 = await run_org_followups(db, organization_id=org_id, dry_run=False, now_utc=now)
                assert live_1["sent_count"] == 1
                assert len(sent_messages) == 1
                assert sent_messages[0][1] == 1001

                # 6. Anti-spam check: 24h later Olim (1001) MUST NOT get a 2nd follow-up (max_attempts=1),
                # while Zarina (1004, previously 1h silent -> now 25h silent) becomes eligible once!
                live_2 = await run_org_followups(
                    db,
                    organization_id=org_id,
                    dry_run=False,
                    now_utc=now + timedelta(hours=24),
                )
                assert live_2["sent_count"] == 1
                chat_ids_sent = [m[1] for m in sent_messages]
                assert chat_ids_sent == [1001, 1004]
                assert chat_ids_sent.count(1001) == 1

                # 7. Third sweep sends 0 messages (all eligible leads capped at max_attempts=1)
                live_3 = await run_org_followups(
                    db,
                    organization_id=org_id,
                    dry_run=False,
                    now_utc=now + timedelta(hours=36),
                )
                assert live_3["sent_count"] == 0

                log_cnt = await db.scalar(select(func.count(FollowupLog.id)))
                assert log_cnt == 2
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(prev_overrides)
    finally:
        await engine.dispose()
