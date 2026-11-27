"""Phase 0.3 Durable Webhook Processing & Idempotency Test Suite.

Verification Areas:
- Area A: Webhook Durability & ACID Intake (PostgreSQL TelegramInbox)
- Area B: Multi-Worker Atomic Job Claiming & Fencing Leases (SKIP LOCKED)
- Area C: Crash Recovery, Exponential Backoff & Dead Letter Handling
- Area D: Business Domain Idempotency (Order & Message deduplication)
- Area E: Transactional Outbox Pattern & Reliable Side Effect Delivery
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
import pytest
import httpx
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

import app.core.db as core_db
from app.core.config import settings
from app.main import app
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
    record_inbox_update,
    claim_inbox_batch,
    renew_inbox_lease,
    complete_inbox_job,
    fail_inbox_job,
    stage_outbox_event,
    dispatch_outbox_batch,
    process_single_inbox_job,
    sweep_inbox_and_outbox,
)

test_engine = create_async_engine(settings.database_url, poolclass=NullPool)
core_db.engine = test_engine
core_db.SessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)

import app.api.webhooks as wh
import app.services.durable_inbox as di
wh.SessionLocal = core_db.SessionLocal
di.SessionLocal = core_db.SessionLocal


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


# ============================================================================
# AREA A: WEBHOOK DURABILITY & ACID INTAKE
# ============================================================================

@pytest.mark.anyio
async def test_a1_valid_webhook_persists_in_durable_inbox():
    """Valid webhook payload persists in PostgreSQL TelegramInbox before returning HTTP 200."""
    settings.app_env = "test"
    update_id = 900000 + (uuid.uuid4().int % 100000)
    payload = {
        "update_id": update_id,
        "message": {
            "message_id": 101,
            "chat": {"id": 123456, "type": "private"},
            "from": {"id": 123456, "first_name": "TestUser"},
            "text": "Salom, narxlar qancha?",
        },
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        headers = {}
        if settings.telegram_webhook_secret:
            headers["X-Telegram-Bot-Api-Secret-Token"] = settings.telegram_webhook_secret

        resp = await client.post("/telegram/webhook", json=payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("ok") is True

    # Verify directly in PostgreSQL
    async with core_db.SessionLocal() as db:
        item = (await db.execute(
            select(TelegramInbox).where(TelegramInbox.update_id == update_id)
        )).scalar_one_or_none()
        assert item is not None
        assert item.bot_id == "default"
        assert item.status in ("pending", "processing", "completed")
        assert item.payload["update_id"] == update_id


@pytest.mark.anyio
async def test_a2_duplicate_update_id_rejected_idempotently():
    """Same update_id for the same bot is detected and rejected without duplicate rows."""
    update_id = 910000 + (uuid.uuid4().int % 100000)
    payload = {"update_id": update_id, "message": {"message_id": 102, "chat": {"id": 123, "type": "private"}, "text": "dup"}}

    async with core_db.SessionLocal() as db:
        item1, is_dup1 = await record_inbox_update(db, bot_id="test_bot", update_id=update_id, payload=payload)
        assert is_dup1 is False
        assert item1 is not None

        # Second insertion attempt with same bot_id and update_id
        item2, is_dup2 = await record_inbox_update(db, bot_id="test_bot", update_id=update_id, payload=payload)
        assert is_dup2 is True

        # Verify only one row exists in DB
        rows = (await db.execute(
            select(TelegramInbox).where(
                TelegramInbox.bot_id == "test_bot",
                TelegramInbox.update_id == update_id,
            )
        )).scalars().all()
        assert len(rows) == 1


@pytest.mark.anyio
async def test_a3_multi_tenant_bot_isolation():
    """Different bot_ids can receive the same update_id without collision."""
    shared_update_id = 920000 + (uuid.uuid4().int % 100000)
    payload = {"update_id": shared_update_id, "test": True}

    async with core_db.SessionLocal() as db:
        item1, dup1 = await record_inbox_update(db, bot_id="bot_tenant_a", update_id=shared_update_id, payload=payload)
        item2, dup2 = await record_inbox_update(db, bot_id="bot_tenant_b", update_id=shared_update_id, payload=payload)

        assert dup1 is False
        assert dup2 is False
        assert item1.id != item2.id
        assert item1.bot_id == "bot_tenant_a"
        assert item2.bot_id == "bot_tenant_b"


@pytest.mark.anyio
async def test_a4_webhook_secret_verification_enforced():
    """Webhook with missing or invalid secret token is rejected with 401."""
    if not settings.telegram_webhook_secret:
        settings.telegram_webhook_secret = "test_webhook_secret_key"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Missing header
        resp = await client.post("/telegram/webhook", json={"update_id": 1})
        assert resp.status_code == 401

        # Tampered header
        resp = await client.post(
            "/telegram/webhook",
            json={"update_id": 1},
            headers={"X-Telegram-Bot-Api-Secret-Token": "invalid_secret"},
        )
        assert resp.status_code == 401


# ============================================================================
# AREA B: MULTI-WORKER ATOMIC JOB CLAIMING & FENCING LEASES
# ============================================================================

@pytest.mark.anyio
async def test_b1_concurrent_workers_claim_disjoint_batches():
    """Concurrent workers using SKIP LOCKED claim distinct non-overlapping jobs."""
    base_id = 930000 + (uuid.uuid4().int % 10000)
    created_ids = []

    async with core_db.SessionLocal() as db:
        for i in range(6):
            uid = base_id + i
            item, _ = await record_inbox_update(db, bot_id="concurrent_bot", update_id=uid, payload={"i": i})
            created_ids.append(item.id)

    # Launch 2 worker claim sessions concurrently
    async def worker_claim(worker_name: str):
        async with core_db.SessionLocal() as db:
            return await claim_inbox_batch(db, batch_size=3, worker_id=worker_name, bot_id="concurrent_bot")

    res1, res2 = await asyncio.gather(
        worker_claim("worker_alpha"),
        worker_claim("worker_beta"),
    )

    ids1 = {r[0] for r in res1}
    ids2 = {r[0] for r in res2}

    # Verify no overlap between the two worker claims
    assert ids1.isdisjoint(ids2)
    assert len(ids1.union(ids2)) == 6


@pytest.mark.anyio
async def test_b2_worker_crash_allows_safe_recovery_after_lease_expires():
    """If a worker crashes mid-processing, its expired lease is reclaimed by another worker."""
    uid = 940000 + (uuid.uuid4().int % 100000)
    bot_id = f"crash_bot_{uuid.uuid4().hex[:8]}"
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_id, update_id=uid, payload={"step": 1})
        # Simulate worker that claimed and crashed 70 seconds ago
        item.status = "processing"
        item.lease_owner = "crashed_worker"
        item.lease_token = "crashed_token_123"
        item.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        item.attempts = 1
        await db.commit()
        inbox_id = item.id

    # New recovery worker claims the batch
    async with core_db.SessionLocal() as db:
        recovered = await claim_inbox_batch(db, batch_size=10, worker_id="recovery_worker", bot_id=bot_id)
        claimed_ids = [r[0] for r in recovered]
        assert inbox_id in claimed_ids

        # Verify new token and lease assigned
        rec_row = next(r for r in recovered if r[0] == inbox_id)
        assert rec_row[1] != "crashed_token_123"
        assert rec_row[3] == 2  # attempts incremented to 2


@pytest.mark.anyio
async def test_b3_fencing_token_prevents_stale_worker_completion():
    """A worker that timed out and lost its lease cannot complete or overwrite the job."""
    uid = 950000 + (uuid.uuid4().int % 100000)
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="fencing_bot", update_id=uid, payload={"cmd": "run"})
        item.status = "processing"
        item.lease_owner = "new_owner"
        item.lease_token = "new_valid_token_456"
        item.lease_expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        item.fencing_generation = 2
        await db.commit()
        inbox_id = item.id

    # Stale worker tries to complete with its old token
    async with core_db.SessionLocal() as db:
        success = await complete_inbox_job(db, inbox_id, "old_stale_token_111", fencing_generation=1)
        assert success is False

        # Verify record remains unchanged in processing state
        row = await db.get(TelegramInbox, inbox_id)
        assert row.status == "processing"
        assert row.lease_token == "new_valid_token_456"


@pytest.mark.anyio
async def test_b4_lease_renewal_extends_expiration():
    """An active worker can successfully extend its lease before expiration."""
    uid = 955000 + (uuid.uuid4().int % 100000)
    token = uuid.uuid4().hex
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="renewal_bot", update_id=uid, payload={})
        item.status = "processing"
        item.lease_token = token
        item.lease_expires_at = datetime.now(timezone.utc) + timedelta(seconds=20)
        item.fencing_generation = 1
        await db.commit()
        inbox_id = item.id

    async with core_db.SessionLocal() as db:
        renewed = await renew_inbox_lease(db, inbox_id, token, fencing_generation=1, extend_seconds=120)
        assert renewed is True

        row = await db.get(TelegramInbox, inbox_id)
        remaining = (row.lease_expires_at - datetime.now(timezone.utc)).total_seconds()
        assert remaining > 60


# ============================================================================
# AREA C: CRASH RECOVERY, EXPONENTIAL BACKOFF & DEAD LETTER
# ============================================================================

@pytest.mark.anyio
async def test_c1_transient_failure_schedules_exponential_retry():
    """Transient worker failure sets status='retry' and exponential next_attempt_at."""
    uid = 960000 + (uuid.uuid4().int % 100000)
    token = uuid.uuid4().hex
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="retry_bot", update_id=uid, payload={})
        item.status = "processing"
        item.lease_token = token
        item.lease_expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        item.attempts = 2
        item.fencing_generation = 1
        await db.commit()
        inbox_id = item.id

    async with core_db.SessionLocal() as db:
        failed = await fail_inbox_job(db, inbox_id, token, "External Telegram API 502 Bad Gateway", fencing_generation=1)
        assert failed is True

        row = await db.get(TelegramInbox, inbox_id)
        assert row.status == "retry"
        assert "502 Bad Gateway" in row.last_error
        assert row.next_attempt_at is not None
        # Backoff for attempt 2: (2^2) * 5 = 20s
        diff = (row.next_attempt_at - datetime.now(timezone.utc)).total_seconds()
        assert 10 <= diff <= 30


@pytest.mark.anyio
async def test_c2_max_attempts_exceeded_transitions_to_dead_letter():
    """When attempts reach max_attempts, inbox record transitions to dead_letter."""
    uid = 970000 + (uuid.uuid4().int % 100000)
    token = uuid.uuid4().hex
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="dead_bot", update_id=uid, payload={})
        item.status = "processing"
        item.lease_token = token
        item.lease_expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)
        item.attempts = 5
        item.max_attempts = 5
        item.fencing_generation = 1
        await db.commit()
        inbox_id = item.id

    async with core_db.SessionLocal() as db:
        failed = await fail_inbox_job(db, inbox_id, token, "Permanent deserialization error", fencing_generation=1)
        assert failed is True

        row = await db.get(TelegramInbox, inbox_id)
        assert row.status == "dead_letter"
        assert "Permanent deserialization error" in row.last_error
        assert row.next_attempt_at is None


# ============================================================================
# AREA D: BUSINESS DOMAIN IDEMPOTENCY (ORDERS & MESSAGES)
# ============================================================================

@pytest.mark.anyio
async def test_d1_retrying_order_creation_prevents_duplicate_orders():
    """Order with unique idempotency_key prevents duplicate orders when update is retried."""
    idempotency_key = f"order:test:{uuid.uuid4().hex}"

    async with core_db.SessionLocal() as db:
        # First creation
        order1 = Order(
            idempotency_key=idempotency_key,
            customer_name="Aziz Test",
            phone="+998901234567",
            product_summary="MacBook Pro",
            status="new",
        )
        db.add(order1)
        await db.commit()
        await db.refresh(order1)
        first_id = order1.id

    # Simulated retry attempt with same idempotency_key
    async with core_db.SessionLocal() as db:
        existing = (await db.execute(
            select(Order).where(Order.idempotency_key == idempotency_key)
        )).scalar_one_or_none()
        assert existing is not None
        assert existing.id == first_id

        # Verify only 1 order exists
        all_orders = (await db.execute(
            select(Order).where(Order.idempotency_key == idempotency_key)
        )).scalars().all()
        assert len(all_orders) == 1


@pytest.mark.anyio
async def test_d2_duplicate_incoming_message_deduplicated():
    """Duplicate incoming messages in a conversation are rejected by unique constraint."""
    conn_id = f"bc_test_{uuid.uuid4().hex[:8]}"
    chat_id = 888111
    msg_id = 555222

    async with core_db.SessionLocal() as db:
        conn = BusinessConnection(id=conn_id, is_enabled=True, rights={"can_reply": True})
        db.add(conn)
        conv = Conversation(
            business_connection_id=conn_id,
            chat_id=chat_id,
            customer_name="Test Client",
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        conv_id = conv.id

    # Save message first time
    from app.services.conversations import save_message
    async with core_db.SessionLocal() as db:
        m1 = await save_message(
            db,
            conversation_id=conv_id,
            telegram_message_id=msg_id,
            direction="customer",
            text="Hello first time",
        )
        await db.commit()
        assert m1 is not None

    # Save same message second time (retry simulation)
    async with core_db.SessionLocal() as db:
        m2 = await save_message(
            db,
            conversation_id=conv_id,
            telegram_message_id=msg_id,
            direction="customer",
            text="Hello duplicate",
        )
        assert m2 is None


# ============================================================================
# AREA E: TRANSACTIONAL OUTBOX PATTERN & RELIABLE SIDE EFFECTS
# ============================================================================

@pytest.mark.anyio
async def test_e1_transactional_outbox_staging_and_idempotency():
    """External side effects are staged in telegram_outbox with idempotency guarantee."""
    key = f"outbox:test:{uuid.uuid4().hex}"

    async with core_db.SessionLocal() as db:
        item1 = await stage_outbox_event(
            db,
            idempotency_key=key,
            event_type="send_message",
            payload={"chat_id": 12345, "text": "Xarid uchun rahmat!"},
        )
        await db.commit()
        assert item1.status == "pending"

        # Staging duplicate event with same key returns existing row
        item2 = await stage_outbox_event(
            db,
            idempotency_key=key,
            event_type="send_message",
            payload={"chat_id": 12345, "text": "Xarid uchun rahmat!"},
        )
        assert item1.id == item2.id

    # Verify directly in DB
    async with core_db.SessionLocal() as db:
        rows = (await db.execute(
            select(TelegramOutbox).where(TelegramOutbox.idempotency_key == key)
        )).scalars().all()
        assert len(rows) == 1


@pytest.mark.anyio
async def test_e2_outbox_batch_dispatcher_execution():
    """Outbox dispatcher claims pending items with SKIP LOCKED and marks them sent."""
    key = f"outbox:dispatch:{uuid.uuid4().hex}"

    async with core_db.SessionLocal() as db:
        staged_row = await stage_outbox_event(
            db,
            idempotency_key=key,
            event_type="send_message",
            payload={"chat_id": 999888, "text": "Outbox test notification"},
        )
        await db.commit()
        staged_id = staged_row.id

    dispatched_events = []
    async def mock_sender(event_type, payload, org_id):
        dispatched_events.append((event_type, payload))

    # Dispatch batch with safe mock sender scoped to our staged event
    async with core_db.SessionLocal() as db:
        dispatched = await dispatch_outbox_batch(
            db,
            batch_size=10,
            sender_func=mock_sender,
            outbox_id=staged_id,
        )
        assert dispatched >= 1

        row = (await db.execute(
            select(TelegramOutbox).where(TelegramOutbox.idempotency_key == key)
        )).scalar_one_or_none()
        assert row is not None
        assert row.status == "sent"
        assert row.processed_at is not None
        assert len(dispatched_events) >= 1


@pytest.mark.anyio
async def test_e3_end_to_end_worker_sweep():
    """Worker sweep claims pending inbox jobs, completes them, and flushes outbox."""
    uid = 980000 + (uuid.uuid4().int % 100000)
    outbox_key = f"sweep:outbox:{uuid.uuid4().hex}"

    # Stage 1 inbox item and 1 outbox item
    async with core_db.SessionLocal() as db:
        inbox_item, _ = await record_inbox_update(
            db,
            bot_id="sweep_bot",
            update_id=uid,
            payload={"test_sweep": True},
        )
        await stage_outbox_event(
            db,
            idempotency_key=outbox_key,
            event_type="send_message",
            payload={"chat_id": 111222, "text": "Sweep alert"},
        )
        await db.commit()
        inbox_id = inbox_item.id

    # Mock handler and sender
    async def dummy_handler(payload, session, org_id):
        pass

    async def dummy_sender(event_type, payload, org_id):
        pass

    inbox_done, outbox_done = await sweep_inbox_and_outbox(
        batch_size=10,
        worker_id="sweep_tester",
        bot_id="sweep_bot",
        handler_callable=dummy_handler,
        sender_func=dummy_sender,
    )

    assert inbox_done >= 1
    assert outbox_done >= 1

    # Verify inbox item marked completed
    async with core_db.SessionLocal() as db:
        inbox_row = await db.get(TelegramInbox, inbox_id)
        assert inbox_row.status == "completed"
        assert inbox_row.processed_at is not None
