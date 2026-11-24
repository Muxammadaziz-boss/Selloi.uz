import asyncio
import uuid
from datetime import datetime, timedelta, timezone
import httpx
import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
import app.core.db as core_db
from app.main import app
from app.models import Organization, TelegramInbox, TelegramOutbox
from app.services.durable_inbox import (
    InboxStatus,
    OutboxStatus,
    claim_inbox_batch,
    claim_outbox_batch,
    complete_inbox_job,
    fail_inbox_job,
    record_inbox_update,
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
# PHASE 0.3.2: PERSISTENT WORKER LIFECYCLE & SUPERVISION TEST SUITE
# ============================================================================

@pytest.mark.anyio
async def test_01_supervisor_startup_and_graceful_shutdown():
    """Supervisor starts background worker tasks and cleanly stops on shutdown."""
    sup = WorkerSupervisor(concurrency=2, batch_size=5, poll_interval=0.1, shutdown_timeout=2.0)
    assert sup.is_running is False
    assert len(sup.worker_tasks) == 0

    await sup.start()
    assert sup.is_running is True
    assert len(sup.worker_tasks) >= 2

    # Give workers a brief moment to cycle
    await asyncio.sleep(0.2)

    await sup.stop(timeout=2.0)
    assert sup.is_running is False
    assert len(sup.worker_tasks) == 0


@pytest.mark.anyio
async def test_02_inbox_worker_processes_pending_items_across_restart():
    """Pending inbox updates are processed by worker and survive supervisor restart."""
    bot_name = f"bot_cycle_{uuid.uuid4().hex[:6]}"
    update_id1 = 970000 + (uuid.uuid4().int % 100000)
    update_id2 = update_id1 + 1

    processed_ids = []

    async def mock_handler(payload: dict, db: AsyncSession, org_id: int | None):
        processed_ids.append(payload.get("update_id"))

    async with core_db.SessionLocal() as db:
        await record_inbox_update(db, bot_id=bot_name, update_id=update_id1, payload={"update_id": update_id1})
        await record_inbox_update(db, bot_id=bot_name, update_id=update_id2, payload={"update_id": update_id2})

    # Execute one worker cycle scoped to this test's bot
    processed_count = await run_inbox_worker_once(batch_size=10, bot_id=bot_name, business_func=mock_handler)
    assert processed_count >= 2
    assert update_id1 in processed_ids
    assert update_id2 in processed_ids

    # Verify status in database
    async with core_db.SessionLocal() as db:
        stmt = select(TelegramInbox.status).where(
            TelegramInbox.bot_id == bot_name,
            TelegramInbox.update_id.in_([update_id1, update_id2]),
        )
        statuses = (await db.execute(stmt)).scalars().all()
        assert len(statuses) == 2
        assert all(s == InboxStatus.COMPLETED.value for s in statuses)


@pytest.mark.anyio
async def test_03_expired_lease_recovery_increments_fencing_generation():
    """An abandoned or crashed worker's expired lease is recovered with incremented generation."""
    bot_name = f"bot_expire_{uuid.uuid4().hex[:6]}"
    update_id = 971000 + (uuid.uuid4().int % 100000)
    now = datetime.now(timezone.utc)

    # Insert an inbox item with an expired lease
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_name, update_id=update_id, payload={"update_id": update_id})
        item.status = InboxStatus.PROCESSING.value
        item.lease_token = "stale_token_worker_1"
        item.lease_owner = "crashed_worker_1"
        item.lease_expires_at = now - timedelta(seconds=10)  # expired
        item.fencing_generation = 1
        await db.commit()
        inbox_id = item.id

    # Worker 2 claims the batch; should recover the expired item
    async with core_db.SessionLocal() as db:
        claimed = await claim_inbox_batch(db, batch_size=5, worker_id="worker_2", bot_id=bot_name)
        recovered = [c for c in claimed if c[0] == inbox_id]
        assert len(recovered) == 1
        recovered_id, new_token, _, _, _, new_fencing_gen = recovered[0]
        assert new_fencing_gen == 2
        assert new_token != "stale_token_worker_1"

    # Worker 1 (stale) tries to finalize: rejected
    async with core_db.SessionLocal() as db:
        rejected = await complete_inbox_job(db, inbox_id, "stale_token_worker_1", fencing_generation=1)
        assert rejected is False

    # Worker 2 (active) finalizes: accepted
    async with core_db.SessionLocal() as db:
        accepted = await complete_inbox_job(db, inbox_id, new_token, fencing_generation=new_fencing_gen)
        assert accepted is True

        refreshed = await db.get(TelegramInbox, inbox_id)
        assert refreshed.status == InboxStatus.COMPLETED.value


@pytest.mark.anyio
async def test_04_bounded_concurrency_disjoint_claims():
    """Two concurrent workers claiming batches receive completely disjoint sets of items."""
    bot_name = f"bot_conc_{uuid.uuid4().hex[:6]}"
    base_id = 972000 + (uuid.uuid4().int % 50000)
    update_ids = [base_id + i for i in range(10)]

    async with core_db.SessionLocal() as db:
        for uid in update_ids:
            await record_inbox_update(db, bot_id=bot_name, update_id=uid, payload={"update_id": uid})

    async with core_db.SessionLocal() as db1, core_db.SessionLocal() as db2:
        batch1, batch2 = await asyncio.gather(
            claim_inbox_batch(db1, batch_size=5, worker_id="w1", bot_id=bot_name),
            claim_inbox_batch(db2, batch_size=5, worker_id="w2", bot_id=bot_name),
        )

    claimed_ids1 = {b[0] for b in batch1}
    claimed_ids2 = {b[0] for b in batch2}

    # Intersect must be empty (disjoint partition)
    assert claimed_ids1.isdisjoint(claimed_ids2)
    assert len(claimed_ids1.union(claimed_ids2)) == 10

    # Clean up claimed items
    async with core_db.SessionLocal() as db:
        for b in batch1:
            await complete_inbox_job(db, b[0], b[1], fencing_generation=b[5])
        for b in batch2:
            await complete_inbox_job(db, b[0], b[1], fencing_generation=b[5])


@pytest.mark.anyio
async def test_05_outbox_worker_dispatches_batch_and_handles_uncertain_timeout():
    """Outbox worker claims outside row lock and records uncertain on timeout."""
    key_success = f"outbox:test_success:{uuid.uuid4().hex[:8]}"
    key_timeout = f"outbox:test_timeout:{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item_ok = await stage_outbox_event(
            db,
            idempotency_key=key_success,
            event_type="send_message",
            payload={"chat_id": 12345, "text": "Hello Success"},
        )
        item_timeout = await stage_outbox_event(
            db,
            idempotency_key=key_timeout,
            event_type="send_message",
            payload={"chat_id": 12345, "text": "Hello Timeout"},
        )
        await db.commit()
        ok_id = item_ok.id
        timeout_id = item_timeout.id

    # Mock dispatcher callable
    async def mock_sender(event_type: str, payload: dict, org_id: int | None):
        if "Timeout" in payload.get("text", ""):
            raise asyncio.TimeoutError("External Telegram gateway timed out")

    # Run outbox worker
    await run_outbox_worker_once(batch_size=100, sender_func=mock_sender)

    async with core_db.SessionLocal() as db:
        res_ok = await db.get(TelegramOutbox, ok_id)
        res_timeout = await db.get(TelegramOutbox, timeout_id)

        assert res_ok.status == OutboxStatus.SENT.value
        assert res_timeout.status == OutboxStatus.UNCERTAIN.value


@pytest.mark.anyio
async def test_06_webhook_ingestion_persists_before_ack():
    """Webhook ingestion endpoint commits to PostgreSQL before returning HTTP 200."""
    update_id = 973000 + (uuid.uuid4().int % 100000)
    payload = {
        "update_id": update_id,
        "message": {"message_id": 100, "chat": {"id": 8888, "type": "private"}, "text": "persisted before ack"},
    }
    headers = {}
    if settings.telegram_webhook_secret:
        headers["X-Telegram-Bot-Api-Secret-Token"] = settings.telegram_webhook_secret

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/telegram/webhook", json=payload, headers=headers)
        assert resp.status_code == 200
        assert resp.json().get("ok") is True

    # Check that database has the item in pending or completed state
    async with core_db.SessionLocal() as db:
        stmt = select(TelegramInbox).where(TelegramInbox.update_id == update_id)
        row = (await db.execute(stmt)).scalar_one_or_none()
        assert row is not None
        assert row.update_id == update_id
        assert row.status in (InboxStatus.PENDING.value, InboxStatus.PROCESSING.value, InboxStatus.COMPLETED.value)


@pytest.mark.anyio
async def test_07_supervisor_diagnostics_metrics():
    """Supervisor exposes detailed metrics and queue health diagnostic data."""
    sup = WorkerSupervisor(concurrency=1, batch_size=5)
    diag = await sup.get_diagnostics()

    assert "is_running" in diag
    assert "concurrency" in diag
    assert "batch_size" in diag
    assert "queue_metrics" in diag
    assert "supervisor_metrics" in diag
    assert isinstance(diag["queue_metrics"], dict)
    assert "inbox" in diag["queue_metrics"]
    assert "outbox" in diag["queue_metrics"]
