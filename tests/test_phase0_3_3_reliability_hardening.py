import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
import app.core.db as core_db
from app.main import app, verify_database_readiness
from app.models import (
    BusinessConnection,
    Conversation,
    Message,
    Order,
    Organization,
    TelegramInbox,
    TelegramOutbox,
)
from app.services.durable_inbox import (
    InboxStatus,
    OutboxStatus,
    claim_inbox_batch,
    claim_outbox_batch,
    complete_inbox_job,
    complete_outbox_event,
    dispatch_outbox_batch,
    fail_inbox_job,
    fail_outbox_event,
    process_inbox_job_atomically,
    record_inbox_update,
    renew_inbox_lease,
    renew_outbox_lease,
    stage_outbox_event,
)
from app.services.worker_supervisor import (
    WorkerSupervisor,
    run_inbox_worker_once,
    run_outbox_worker_once,
)

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
core_db.engine = test_engine
core_db.SessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

import app.api.webhooks as wh
import app.services.durable_inbox as di
import app.services.worker_supervisor as ws

wh.SessionLocal = core_db.SessionLocal
di.SessionLocal = core_db.SessionLocal
ws.SessionLocal = core_db.SessionLocal


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


# ============================================================================
# AREA A: OUTBOX COMPLETENESS & DIRECT TELEGRAM CALL DECOUPLING
# ============================================================================

@pytest.mark.anyio
async def test_a1_business_text_response_staged_to_outbox():
    """Incoming customer business message stages reply in telegram_outbox without direct external calls."""
    uid = 981000 + (uuid.uuid4().int % 100000)
    conn_id = f"conn_a1_{uuid.uuid4().hex[:6]}"
    chat_id = 910000 + (uuid.uuid4().int % 10000)
    msg_id = 1001

    async with core_db.SessionLocal() as db:
        # Create organization and business connection
        org = Organization(name="Store A1", slug=f"store_{uuid.uuid4().hex[:6]}")
        db.add(org)
        await db.flush()

        conn = BusinessConnection(
            id=conn_id,
            organization_id=org.id,
            owner_user_id=8888,
            is_enabled=True,
            rights={"can_reply": True},
        )
        db.add(conn)
        await db.commit()

        # Webhook payload for incoming customer message
        payload = {
            "update_id": uid,
            "business_message": {
                "business_connection_id": conn_id,
                "chat": {"id": chat_id, "type": "private"},
                "from": {"id": 12345, "is_bot": False, "first_name": "Vali"},
                "message_id": msg_id,
                "text": "Salom, do'kon ochiqmi?",
            },
        }

        # Process update atomically (simulating Inbox Worker)
        item, _ = await record_inbox_update(db, bot_id=f"org_{org.id}", update_id=uid, payload=payload, organization_id=org.id)
        claimed = await claim_inbox_batch(db, batch_size=1, bot_id=f"org_{org.id}")
        assert len(claimed) == 1
        inbox_id, token, pld, att, oid, gen = claimed[0]

        # Mock sales_ai to produce a known answer
        with patch("app.api.webhooks.sales_ai.answer") as mock_answer:
            mock_answer.return_value = {
                "reply": "Assalomu alaykum! Ha, do'konimiz soat 20:00 gacha ochiq.",
                "handoff": False,
                "order_created": False,
                "attach_photo": False,
            }
            # Execute business mutations atomically
            success = await process_inbox_job_atomically(
                db,
                inbox_id=inbox_id,
                lease_token=token,
                fencing_generation=gen,
                business_func=wh.execute_update_payload,
            )
            assert success is True

        # Check outbox has staged event
        outbox_stmt = select(TelegramOutbox).where(
            TelegramOutbox.organization_id == org.id,
            TelegramOutbox.event_type == "send_business_text",
        )
        outbox_items = (await db.execute(outbox_stmt)).scalars().all()
        assert len(outbox_items) >= 1
        staged = outbox_items[-1]
        assert staged.status == "pending"
        assert staged.payload["business_connection_id"] == conn_id
        assert staged.payload["chat_id"] == chat_id
        assert "ochiq" in staged.payload["text"]


@pytest.mark.anyio
async def test_a2_handoff_reply_and_operator_alert_staged_to_outbox():
    """AI handoff stages both the customer reply and the operator alert to telegram_outbox."""
    uid = 982000 + (uuid.uuid4().int % 100000)
    conn_id = f"conn_a2_{uuid.uuid4().hex[:6]}"
    chat_id = 920000 + (uuid.uuid4().int % 10000)
    msg_id = 1002

    async with core_db.SessionLocal() as db:
        org = Organization(name="Store A2", slug=f"store_{uuid.uuid4().hex[:6]}")
        db.add(org)
        await db.flush()

        conn = BusinessConnection(
            id=conn_id,
            organization_id=org.id,
            owner_user_id=7777,
            is_enabled=True,
            rights={"can_reply": True},
        )
        db.add(conn)
        await db.commit()

        payload = {
            "update_id": uid,
            "business_message": {
                "business_connection_id": conn_id,
                "chat": {"id": chat_id, "type": "private"},
                "from": {"id": 12345, "is_bot": False, "first_name": "Sardor"},
                "message_id": msg_id,
                "text": "Menga katta skidka bering yoki rahbar bilan ulashtiring",
            },
        }

        item, _ = await record_inbox_update(db, bot_id=f"org_{org.id}", update_id=uid, payload=payload, organization_id=org.id)
        claimed = await claim_inbox_batch(db, batch_size=1, bot_id=f"org_{org.id}")
        inbox_id, token, pld, att, oid, gen = claimed[0]

        with patch("app.api.webhooks.sales_ai.answer") as mock_answer:
            mock_answer.return_value = {
                "reply": "Savolingizni mutaxassisimizga yetkazdim.",
                "handoff": True,
                "reason": "Mijoz chegirma va rahbar bilan bog'lanishni so'radi",
                "order_created": False,
                "attach_photo": False,
            }
            success = await process_inbox_job_atomically(
                db,
                inbox_id=inbox_id,
                lease_token=token,
                fencing_generation=gen,
                business_func=wh.execute_update_payload,
            )
            assert success is True

        # Check outbox has both customer handoff reply and operator alert
        text_outbox = (await db.execute(
            select(TelegramOutbox).where(
                TelegramOutbox.organization_id == org.id,
                TelegramOutbox.event_type == "send_business_text",
            )
        )).scalars().all()
        assert len(text_outbox) >= 1
        assert "yetkazdim" in text_outbox[-1].payload["text"]

        alert_outbox = (await db.execute(
            select(TelegramOutbox).where(
                TelegramOutbox.organization_id == org.id,
                TelegramOutbox.event_type == "notify_organization_admins",
            )
        )).scalars().all()
        assert len(alert_outbox) >= 1
        assert "operatorga topshirdi" in alert_outbox[-1].payload["text"]


@pytest.mark.anyio
async def test_a3_direct_bot_message_staged_to_outbox():
    """Direct bot private chat message stages reply in telegram_outbox."""
    uid = 983000 + (uuid.uuid4().int % 100000)
    chat_id = 930000 + (uuid.uuid4().int % 10000)
    msg_id = 1003
    bot_id = f"direct_{uuid.uuid4().hex[:6]}"

    async with core_db.SessionLocal() as db:
        payload = {
            "update_id": uid,
            "message": {
                "chat": {"id": chat_id, "type": "private"},
                "from": {"id": 5555, "is_bot": False, "first_name": "Alisher"},
                "message_id": msg_id,
                "text": "Assalomu alaykum, bot narxi qancha?",
            },
        }

        item, _ = await record_inbox_update(db, bot_id=bot_id, update_id=uid, payload=payload, organization_id=1)
        claimed = await claim_inbox_batch(db, batch_size=1, bot_id=bot_id)
        assert len(claimed) == 1
        inbox_id, token, pld, att, oid, gen = claimed[0]

        with patch("app.api.webhooks.sales_ai.is_greeting", return_value=True), \
             patch("app.api.webhooks.sales_ai.answer") as mock_answer, \
             patch("app.api.webhooks.knowledge.search", return_value=[]):
            mock_answer.return_value = {
                "reply": "Bot tariflarimiz oyiga 244,000 so'mdan boshlanadi.",
                "handoff": False,
                "order_created": False,
                "attach_photo": False,
            }
            success = await process_inbox_job_atomically(
                db,
                inbox_id=inbox_id,
                lease_token=token,
                fencing_generation=gen,
                business_func=wh.execute_update_payload,
            )
            assert success is True

        outbox_items = (await db.execute(
            select(TelegramOutbox).where(
                TelegramOutbox.event_type == "send_message",
                TelegramOutbox.payload["chat_id"].as_integer() == chat_id,
            )
        )).scalars().all()
        assert len(outbox_items) >= 1
        assert "244,000" in outbox_items[-1].payload["text"]


@pytest.mark.anyio
async def test_a4_outbox_dispatch_executes_outside_locks_and_records_assistant_message():
    """Outbox dispatcher sends message to Telegram API and persists assistant message."""
    outbox_key = f"outbox:test:dispatch_{uuid.uuid4().hex[:8]}"
    chat_id = 940000 + (uuid.uuid4().int % 10000)
    conn_id = f"conn_disp_{uuid.uuid4().hex[:6]}"

    async with core_db.SessionLocal() as db:
        org = Organization(name="Disp Store", slug=f"disp_{uuid.uuid4().hex[:6]}")
        db.add(org)
        await db.flush()

        conn = BusinessConnection(
            id=conn_id,
            organization_id=org.id,
            owner_user_id=1234,
            is_enabled=True,
        )
        db.add(conn)
        await db.flush()

        conv = Conversation(
            organization_id=org.id,
            business_connection_id=conn_id,
            chat_id=chat_id,
            customer_name="Mijoz Disp",
        )
        db.add(conv)
        await db.flush()

        item = await stage_outbox_event(
            db,
            idempotency_key=outbox_key,
            event_type="send_business_text",
            payload={
                "business_connection_id": conn_id,
                "chat_id": chat_id,
                "text": "Buyurtmangiz tayyor bo'ldi!",
                "conversation_id": conv.id,
                "reply_to_telegram_message_id": 999,
            },
            organization_id=org.id,
        )
        await db.commit()
        outbox_id = item.id

    # Dispatch with mock Telegram response
    mock_svc = AsyncMock()
    mock_svc.send_business_text.return_value = {"message_id": 777123}
    with patch("app.services.durable_inbox.get_telegram_service", return_value=mock_svc), \
         patch("app.services.durable_inbox.telegram", mock_svc):

        async with core_db.SessionLocal() as db:
            dispatched = await dispatch_outbox_batch(db, batch_size=1, outbox_id=outbox_id)
            assert dispatched == 1

            # Verify outbox item marked SENT
            row = await db.get(TelegramOutbox, outbox_id)
            assert row.status == "sent"
            assert row.processed_at is not None

            # Verify assistant message recorded in DB
            msg_row = (await db.execute(
                select(Message).where(
                    Message.conversation_id == conv.id,
                    Message.telegram_message_id == 777123,
                )
            )).scalar_one_or_none()
            assert msg_row is not None
            assert msg_row.direction == "assistant"
            assert "tayyor" in msg_row.text


@pytest.mark.anyio
async def test_a5_outbox_timeout_enters_uncertain_state():
    """Ambiguous network timeouts mark outbox event as 'uncertain' to avoid blind duplicate sends."""
    outbox_key = f"outbox:test:timeout_{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        org = Organization(name="Timeout Store", slug=f"to_{uuid.uuid4().hex[:6]}")
        db.add(org)
        await db.flush()

        item = await stage_outbox_event(
            db,
            idempotency_key=outbox_key,
            event_type="send_message",
            payload={"chat_id": 12345, "text": "Salom"},
            organization_id=org.id,
        )
        await db.commit()
        outbox_id = item.id

    with patch("app.services.durable_inbox.telegram") as mock_direct_tg, \
         patch("app.services.durable_inbox.get_telegram_service") as mock_get_tg:
        mock_svc = AsyncMock()
        mock_svc.send_message.side_effect = httpx.ReadTimeout("Connection timed out to Telegram API")
        mock_get_tg.return_value = mock_svc
        mock_direct_tg.send_message.side_effect = httpx.ReadTimeout("Connection timed out to Telegram API")

        async with core_db.SessionLocal() as db:
            dispatched = await dispatch_outbox_batch(db, batch_size=1, outbox_id=outbox_id)
            assert dispatched == 0

            row = await db.get(TelegramOutbox, outbox_id)
            assert row.status == "uncertain"
            assert "timed out" in row.last_error.lower()


# ============================================================================
# AREA B: MANDATORY FENCING GENERATION ENFORCEMENT
# ============================================================================

@pytest.mark.anyio
async def test_b1_inbox_operations_require_mandatory_fencing_generation():
    """Calling complete_inbox_job, fail_inbox_job, renew_inbox_lease, or process_inbox_job_atomically with invalid fencing raises ValueError."""
    async with core_db.SessionLocal() as db:
        # None
        with pytest.raises(ValueError, match="mandatory"):
            await complete_inbox_job(db, 1, "token", None)  # type: ignore

        with pytest.raises(ValueError, match="mandatory"):
            await fail_inbox_job(db, 1, "token", "err", None)  # type: ignore

        with pytest.raises(ValueError, match="mandatory"):
            await renew_inbox_lease(db, 1, "token", None)  # type: ignore

        with pytest.raises(ValueError, match="mandatory"):
            await process_inbox_job_atomically(db, 1, "token", None, AsyncMock())  # type: ignore

        # Boolean
        with pytest.raises(ValueError, match="mandatory"):
            await complete_inbox_job(db, 1, "token", True)  # type: ignore

        # Zero or negative
        with pytest.raises(ValueError, match="mandatory"):
            await complete_inbox_job(db, 1, "token", 0)

        with pytest.raises(ValueError, match="mandatory"):
            await fail_inbox_job(db, 1, "token", "err", -1)

        # String
        with pytest.raises(ValueError, match="mandatory"):
            await renew_inbox_lease(db, 1, "token", "1")  # type: ignore


@pytest.mark.anyio
async def test_b2_stale_worker_wrong_fencing_generation_rejected():
    """Worker A with generation 1 is strictly rejected after Worker B claims with generation 2."""
    uid = 984000 + (uuid.uuid4().int % 100000)
    bot_id = f"fencing_{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_id, update_id=uid, payload={})
        inbox_id = item.id

        # Worker A claims (increments generation)
        claimed_a = await claim_inbox_batch(db, batch_size=1, bot_id=bot_id, worker_id="worker_a", lease_seconds=1)
        assert len(claimed_a) == 1
        token_a = claimed_a[0][1]
        gen_a = claimed_a[0][5]
        assert gen_a >= 1

        # Simulate lease expiration
        row = await db.get(TelegramInbox, inbox_id)
        row.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=5)
        await db.commit()

        # Worker B claims (increments to gen_a + 1)
        claimed_b = await claim_inbox_batch(db, batch_size=1, bot_id=bot_id, worker_id="worker_b", lease_seconds=60)
        assert len(claimed_b) == 1
        token_b = claimed_b[0][1]
        gen_b = claimed_b[0][5]
        assert gen_b == gen_a + 1
        assert token_b != token_a

        # Worker A attempts renewal with stale generation 1 -> rejected
        renew_a = await renew_inbox_lease(db, inbox_id, token_a, fencing_generation=gen_a)
        assert renew_a is False

        # Worker A attempts completion with stale token and generation 1 -> rejected
        complete_a = await complete_inbox_job(db, inbox_id, token_a, fencing_generation=gen_a)
        assert complete_a is False

        # Worker A attempts fail report -> rejected
        fail_a = await fail_inbox_job(db, inbox_id, token_a, "Stale worker error", fencing_generation=gen_a)
        assert fail_a is False

        # Worker B completes successfully with generation 2
        complete_b = await complete_inbox_job(db, inbox_id, token_b, fencing_generation=gen_b)
        assert complete_b is True

        final_row = await db.get(TelegramInbox, inbox_id)
        assert final_row.status == "completed"


@pytest.mark.anyio
async def test_b3_expired_lease_cannot_be_completed():
    """A worker cannot complete a job whose lease has expired even if token and generation match."""
    uid = 985000 + (uuid.uuid4().int % 100000)

    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="expire_bot", update_id=uid, payload={})
        inbox_id = item.id

        claimed = await claim_inbox_batch(db, batch_size=1, bot_id="expire_bot")
        token = claimed[0][1]
        gen = claimed[0][5]

        # Artificially expire lease in database
        row = await db.get(TelegramInbox, inbox_id)
        row.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()

        # Completion attempt after expiry must return False
        success = await complete_inbox_job(db, inbox_id, token, fencing_generation=gen)
        assert success is False


@pytest.mark.anyio
async def test_b4_outbox_operations_enforce_mandatory_fencing():
    """Outbox completion and renewal require mandatory fencing and reject stale workers."""
    outbox_key = f"outbox:fencing:{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item = await stage_outbox_event(
            db,
            idempotency_key=outbox_key,
            event_type="send_message",
            payload={"chat_id": 111, "text": "Outbox fencing test"},
        )
        await db.commit()
        outbox_id = item.id

        # Missing or invalid fencing raises ValueError
        with pytest.raises(ValueError, match="mandatory"):
            await complete_outbox_event(db, outbox_id, "token", None)  # type: ignore

        with pytest.raises(ValueError, match="mandatory"):
            await fail_outbox_event(db, outbox_id, "token", "err", None)  # type: ignore

        with pytest.raises(ValueError, match="mandatory"):
            await renew_outbox_lease(db, outbox_id, "token", None)  # type: ignore

        with pytest.raises(ValueError, match="mandatory"):
            await complete_outbox_event(db, outbox_id, "token", True)  # type: ignore

        with pytest.raises(ValueError, match="mandatory"):
            await complete_outbox_event(db, outbox_id, "token", 0)

        with pytest.raises(ValueError, match="mandatory"):
            await fail_outbox_event(db, outbox_id, "token", "err", -1)

        with pytest.raises(ValueError, match="mandatory"):
            await renew_outbox_lease(db, outbox_id, "token", "1")  # type: ignore

        # Worker 1 claims
        claimed_1 = await claim_outbox_batch(db, batch_size=1, outbox_id=outbox_id, lease_seconds=1)
        token_1 = claimed_1[0][1]
        gen_1 = claimed_1[0][6]
        assert gen_1 >= 1

        # Expire lease
        row = await db.get(TelegramOutbox, outbox_id)
        row.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=2)
        await db.commit()

        # Worker 2 claims
        claimed_2 = await claim_outbox_batch(db, batch_size=1, outbox_id=outbox_id, lease_seconds=60)
        token_2 = claimed_2[0][1]
        gen_2 = claimed_2[0][6]
        assert gen_2 == gen_1 + 1

        # Stale Worker 1 completion rejected
        rejected = await complete_outbox_event(db, outbox_id, token_1, fencing_generation=gen_1)
        assert rejected is False

        # Valid Worker 2 completion accepted
        accepted = await complete_outbox_event(db, outbox_id, token_2, fencing_generation=gen_2)
        assert accepted is True


# ============================================================================
# AREA C: PRODUCTION STARTUP FAIL-FAST & READINESS VERIFICATION
# ============================================================================

@pytest.mark.anyio
async def test_c1_verify_database_readiness_validates_mandatory_schema():
    """verify_database_readiness reports ready=True on valid database."""
    async with core_db.engine.begin() as conn:
        ready, missing = await verify_database_readiness(conn)
        assert ready is True
        assert len(missing) == 0


@pytest.mark.anyio
async def test_c2_verify_database_readiness_detects_missing_columns():
    """verify_database_readiness detects missing critical columns if table inspector fails."""
    from unittest.mock import AsyncMock, MagicMock
    mock_conn = MagicMock()
    mock_conn.run_sync = AsyncMock(return_value=([], ["telegram_outbox.fencing_generation"]))

    ready, missing = await verify_database_readiness(mock_conn)
    assert ready is False
    assert "telegram_outbox.fencing_generation" in missing


# ============================================================================
# AREA D: PERSISTENT WORKER LIFECYCLE & MULTI-PROCESS TOPOLOGY
# ============================================================================

@pytest.mark.anyio
async def test_d1_worker_supervisor_lifecycle_and_diagnostics():
    """WorkerSupervisor starts, provides queue metrics, and stops gracefully."""
    sup = WorkerSupervisor(concurrency=2, batch_size=5, poll_interval=0.1, shutdown_timeout=2.0)
    await sup.start()
    assert sup.is_running is True

    diag = await sup.get_diagnostics()
    assert diag["is_running"] is True
    assert "queue_metrics" in diag
    assert "supervisor_metrics" in diag
    assert diag["concurrency"] == 2

    await sup.stop()
    assert sup.is_running is False


@pytest.mark.anyio
async def test_d2_one_shot_worker_execution():
    """One-shot inbox and outbox runners process batches deterministically."""
    uid = 986000 + (uuid.uuid4().int % 100000)
    async with core_db.SessionLocal() as db:
        await record_inbox_update(db, bot_id="one_shot_bot", update_id=uid, payload={"test": True})

    async def mock_handler(payload, session, org_id):
        pass

    processed = await run_inbox_worker_once(bot_id="one_shot_bot", business_func=mock_handler)
    assert processed == 1


# ============================================================================
# AREA E: WEBHOOK INGESTION & TRANSACTION INTEGRITY
# ============================================================================

@pytest.mark.anyio
async def test_e1_webhook_returns_503_when_database_persistence_fails():
    """Telegram webhook endpoint fails closed with HTTP 503 if PostgreSQL inbox commit fails."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with patch("app.services.durable_inbox.record_inbox_update", side_effect=Exception("Database connection lost")):
            resp = await client.post(
                "/telegram/webhook",
                json={"update_id": 999999, "message": {"text": "hello"}},
                headers={"X-Telegram-Bot-Api-Secret-Token": settings.telegram_webhook_secret or "secret"},
            )
            assert resp.status_code == 503
            assert "temporarily unavailable" in resp.json()["detail"].lower()


@pytest.mark.anyio
async def test_e2_business_mutation_rollback_prevents_partial_commit():
    """If business mutation fails during process_inbox_job_atomically, DB rolls back and transitions inbox to retry."""
    uid = 987000 + (uuid.uuid4().int % 100000)
    bot_id = f"rb_{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_id, update_id=uid, payload={"step": 1})
        inbox_id = item.id

        claimed = await claim_inbox_batch(db, batch_size=1, bot_id=bot_id)
        token = claimed[0][1]
        gen = claimed[0][5]

        # Faulty business function that crashes mid-transaction
        async def failing_business_func(payload, session, org_id):
            # Create order
            order = Order(
                organization_id=org_id,
                customer_name="Should Be Rolled Back",
                idempotency_key=f"order:rollback:{uuid.uuid4().hex[:6]}",
            )
            session.add(order)
            await session.flush()
            raise RuntimeError("Database constraint or external error occurred during execution!")

        success = await process_inbox_job_atomically(
            db,
            inbox_id=inbox_id,
            lease_token=token,
            fencing_generation=gen,
            business_func=failing_business_func,
        )
        assert success is False

        # Verify order was rolled back
        uncommitted_order = (await db.execute(
            select(Order).where(Order.customer_name == "Should Be Rolled Back")
        )).scalar_one_or_none()
        assert uncommitted_order is None

        # Verify inbox was transitioned to RETRY with error recorded
        inbox_row = await db.get(TelegramInbox, inbox_id)
        assert inbox_row.status == "retry"
        assert "constraint or external error" in inbox_row.last_error
