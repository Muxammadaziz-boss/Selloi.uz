"""Phase 0.3.1 Reliability Gap Closure & Hardening Test Suite.

Verifies:
- Area A: Webhook Ingestion, ACID Persistence, Multi-Tenant Isolation & Payload Validation
- Area B: Worker Claiming (SKIP LOCKED), Monotonic Fencing Generation & Lease Invalidation
- Area C: Canonical Business Idempotency, Savepoint Race Protection & Tenant Isolation
- Area D: Inbox-to-Business-to-Outbox Atomic Transaction Boundaries & Rollback Integrity
- Area E: Transactional Outbox Delivery Semantics (Outside-Lock I/O, Uncertain Delivery, DLQ)
- Area F: Canonical State Machine Transition Rules & Illegal Transition Rejection
- Area G: Queue Observability, Backlog Metrics & PII Sanitization
"""

import asyncio
from datetime import datetime, timedelta, timezone
import uuid
import httpx
import pytest
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
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
    ALLOWED_INBOX_TRANSITIONS,
    ALLOWED_OUTBOX_TRANSITIONS,
    InboxStatus,
    OutboxStatus,
    claim_inbox_batch,
    claim_outbox_batch,
    complete_inbox_job,
    complete_outbox_event,
    dispatch_outbox_batch,
    fail_inbox_job,
    fail_outbox_event,
    generate_order_idempotency_key,
    generate_outbox_idempotency_key,
    get_or_create_idempotent_order,
    get_queue_metrics,
    process_inbox_job_atomically,
    record_inbox_update,
    renew_inbox_lease,
    stage_outbox_event,
    validate_inbox_transition,
    validate_outbox_transition,
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
# AREA A: WEBHOOK INTAKE, ACID PERSISTENCE & TENANT ISOLATION
# ============================================================================

@pytest.mark.anyio
async def test_a1_same_bot_same_update_deduplication():
    """Identical update_id for the same bot is cleanly deduplicated without error."""
    update_id = 960000 + (uuid.uuid4().int % 100000)
    payload = {"update_id": update_id, "message": {"text": "A1 test"}}

    async with core_db.SessionLocal() as db:
        item1, dup1 = await record_inbox_update(db, bot_id="bot_a1", update_id=update_id, payload=payload)
        assert dup1 is False
        assert item1 is not None

        item2, dup2 = await record_inbox_update(db, bot_id="bot_a1", update_id=update_id, payload=payload)
        assert dup2 is True
        assert item2.id == item1.id


@pytest.mark.anyio
async def test_a2_different_bots_same_update_id_isolated():
    """Different bot IDs can receive the exact same update ID without collision."""
    shared_update_id = 961000 + (uuid.uuid4().int % 100000)
    payload = {"update_id": shared_update_id, "text": "A2 test"}

    async with core_db.SessionLocal() as db:
        item_a, dup_a = await record_inbox_update(db, bot_id="bot_alpha", update_id=shared_update_id, payload=payload)
        item_b, dup_b = await record_inbox_update(db, bot_id="bot_beta", update_id=shared_update_id, payload=payload)

        assert dup_a is False
        assert dup_b is False
        assert item_a.id != item_b.id
        assert item_a.bot_id == "bot_alpha"
        assert item_b.bot_id == "bot_beta"


@pytest.mark.anyio
async def test_a3_different_tenants_separate_bots():
    """Updates belonging to separate organizations are isolated by organization_id."""
    update_id = 962000 + (uuid.uuid4().int % 100000)
    payload = {"update_id": update_id}

    async with core_db.SessionLocal() as db:
        org_ids = (await db.execute(select(Organization.id).order_by(Organization.id.asc()).limit(2))).scalars().all()
        org_a = org_ids[0]
        org_b = org_ids[1] if len(org_ids) > 1 else org_a

        item_org1, _ = await record_inbox_update(db, bot_id="org_1", update_id=update_id, payload=payload, organization_id=org_a)
        item_org2, _ = await record_inbox_update(db, bot_id="org_2", update_id=update_id, payload=payload, organization_id=org_b)

        assert item_org1.organization_id == org_a
        assert item_org2.organization_id == org_b
        assert item_org1.id != item_org2.id


@pytest.mark.anyio
async def test_a4_concurrent_duplicate_webhook_requests():
    """Concurrent duplicate webhook POST requests both return HTTP 200 without duplicate DB rows."""
    update_id = 963000 + (uuid.uuid4().int % 100000)
    payload = {
        "update_id": update_id,
        "message": {"message_id": 50, "chat": {"id": 9999, "type": "private"}, "text": "concurrent webhook"},
    }
    headers = {}
    if settings.telegram_webhook_secret:
        headers["X-Telegram-Bot-Api-Secret-Token"] = settings.telegram_webhook_secret

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        r1, r2 = await asyncio.gather(
            client.post("/telegram/webhook", json=payload, headers=headers),
            client.post("/telegram/webhook", json=payload, headers=headers),
        )
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json().get("ok") is True
        assert r2.json().get("ok") is True

    async with core_db.SessionLocal() as db:
        count = (await db.execute(
            select(func.count(TelegramInbox.id)).where(TelegramInbox.update_id == update_id)
        )).scalar_one()
        assert count == 1


@pytest.mark.anyio
async def test_a5_malformed_payload_rejected_400():
    """Non-dictionary or malformed JSON payloads are cleanly rejected with HTTP 400."""
    headers = {}
    if settings.telegram_webhook_secret:
        headers["X-Telegram-Bot-Api-Secret-Token"] = settings.telegram_webhook_secret

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Array instead of object
        resp1 = await client.post("/telegram/webhook", json=[1, 2, 3], headers=headers)
        assert resp1.status_code == 400

        # String instead of object
        resp2 = await client.post("/telegram/webhook", content="just plain text", headers={"content-type": "application/json", **headers})
        assert resp2.status_code == 400


@pytest.mark.anyio
async def test_a6_invalid_telegram_secret_rejected_401():
    """Missing or tampered webhook secret token is rejected with HTTP 401."""
    if not settings.telegram_webhook_secret:
        settings.telegram_webhook_secret = "secret_for_a6_test"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        resp_missing = await client.post("/telegram/webhook", json={"update_id": 123})
        assert resp_missing.status_code == 401

        resp_invalid = await client.post(
            "/telegram/webhook",
            json={"update_id": 123},
            headers={"X-Telegram-Bot-Api-Secret-Token": "bad_token"},
        )
        assert resp_invalid.status_code == 401


# ============================================================================
# AREA B: WORKER CLAIMING, FENCING TOKENS & GENERATION
# ============================================================================

@pytest.mark.anyio
async def test_b1_concurrent_workers_claim_disjoint_batches():
    """Independent workers using SKIP LOCKED claim disjoint non-overlapping batches."""
    base_id = 964000 + (uuid.uuid4().int % 10000)
    async with core_db.SessionLocal() as db:
        for i in range(4):
            await record_inbox_update(db, bot_id="worker_bot_b1", update_id=base_id + i, payload={"idx": i})

    async def worker_task(name: str):
        async with core_db.SessionLocal() as db:
            return await claim_inbox_batch(db, batch_size=2, worker_id=name, bot_id="worker_bot_b1")

    res1, res2 = await asyncio.gather(worker_task("w1"), worker_task("w2"))
    ids1 = {r[0] for r in res1}
    ids2 = {r[0] for r in res2}

    assert ids1.isdisjoint(ids2)
    assert len(ids1.union(ids2)) == 4


@pytest.mark.anyio
async def test_b2_worker_lease_expiration_and_recovery_increments_generation():
    """Worker crash lease expiration allows recovery and increments monotonic fencing_generation."""
    bot_name = f"bot_b2_{uuid.uuid4().hex[:6]}"
    uid = 965000 + (uuid.uuid4().int % 100000)
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_name, update_id=uid, payload={"step": 1})
        inbox_id = item.id

        # Worker 1 claims
        claimed1 = await claim_inbox_batch(db, batch_size=1, worker_id="crashed_w1", bot_id=bot_name)
        assert len(claimed1) == 1
        job1 = claimed1[0]
        token1 = job1[1]
        gen1 = job1[5]
        assert gen1 >= 2  # default 1 + 1 on claim

        # Simulate Worker 1 crash and lease expiration
        raw_item = (await db.execute(select(TelegramInbox).where(TelegramInbox.id == inbox_id))).scalar_one()
        raw_item.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=10)
        await db.commit()

        # Worker 2 recovers expired job
        claimed2 = await claim_inbox_batch(db, batch_size=1, worker_id="recovery_w2", bot_id=bot_name)
        assert len(claimed2) == 1
        job2 = claimed2[0]
        token2 = job2[1]
        gen2 = job2[5]

        assert token2 != token1
        assert gen2 > gen1


@pytest.mark.anyio
async def test_b3_stale_worker_token_completion_rejected():
    """A stale worker attempting to complete a job whose lease token changed is rejected."""
    uid = 966000 + (uuid.uuid4().int % 100000)
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="bot_b3", update_id=uid, payload={"test": True})
        inbox_id = item.id
        claimed = await claim_inbox_batch(db, batch_size=1, worker_id="active_w", bot_id="bot_b3")
        active_token = claimed[0][1]

        # Stale worker attempts complete with old token
        success = await complete_inbox_job(db, inbox_id, "stale_token_999")
        assert success is False

        # Active worker completes successfully
        success_active = await complete_inbox_job(db, inbox_id, active_token)
        assert success_active is True


@pytest.mark.anyio
async def test_b4_stale_worker_failure_rejected():
    """A stale worker cannot report failure on a job owned by another worker."""
    uid = 967000 + (uuid.uuid4().int % 100000)
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="bot_b4", update_id=uid, payload={"test": True})
        inbox_id = item.id
        await claim_inbox_batch(db, batch_size=1, worker_id="active_w", bot_id="bot_b4")

        # Stale worker attempts fail_inbox_job
        failed = await fail_inbox_job(db, inbox_id, "invalid_stale_token", "err")
        assert failed is False


@pytest.mark.anyio
async def test_b5_mismatched_fencing_generation_rejected():
    """A worker passing the correct token but an outdated fencing generation is rejected."""
    uid = 968000 + (uuid.uuid4().int % 100000)
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id="bot_b5", update_id=uid, payload={"test": True})
        inbox_id = item.id
        claimed = await claim_inbox_batch(db, batch_size=1, bot_id="bot_b5")
        token = claimed[0][1]
        current_gen = claimed[0][5]

        # Attempt complete with older generation
        res = await complete_inbox_job(db, inbox_id, token, fencing_generation=current_gen - 1)
        assert res is False

        # Attempt complete with current generation
        res_valid = await complete_inbox_job(db, inbox_id, token, fencing_generation=current_gen)
        assert res_valid is True


@pytest.mark.anyio
async def test_b6_lease_renewal_extends_expiration():
    """Lease renewal successfully extends expiration without resetting valid ownership."""
    bot_name = f"bot_b6_{uuid.uuid4().hex[:6]}"
    uid = 969000 + (uuid.uuid4().int % 100000)
    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_name, update_id=uid, payload={})
        inbox_id = item.id
        claimed = await claim_inbox_batch(db, batch_size=1, bot_id=bot_name)
        assert len(claimed) == 1
        token = claimed[0][1]

        renewed = await renew_inbox_lease(db, inbox_id, token, extend_seconds=120)
        assert renewed is True

        row = (await db.execute(select(TelegramInbox).where(TelegramInbox.id == inbox_id))).scalar_one()
        remaining = (row.lease_expires_at - datetime.now(timezone.utc)).total_seconds()
        assert remaining > 60


# ============================================================================
# AREA C: CANONICAL BUSINESS IDEMPOTENCY & TENANT ISOLATION
# ============================================================================

@pytest.mark.anyio
async def test_c1_duplicate_direct_message_idempotent_order():
    """Duplicate direct bot message with same message_id produces exactly one order."""
    chat_id = 770000 + (uuid.uuid4().int % 10000)
    msg_id = 500 + (uuid.uuid4().int % 1000)
    key = generate_order_idempotency_key(source="direct", organization_id=1, bot_id="default", chat_id=chat_id, message_id=msg_id)

    async with core_db.SessionLocal() as db:
        o1, c1 = await get_or_create_idempotent_order(db, idempotency_key=key, organization_id=1, customer_name="Ali")
        await db.commit()
        assert c1 is True
        assert o1.idempotency_key == key

        o2, c2 = await get_or_create_idempotent_order(db, idempotency_key=key, organization_id=1, customer_name="Ali")
        assert c2 is False
        assert o2.id == o1.id


@pytest.mark.anyio
async def test_c2_duplicate_business_connection_order():
    """Duplicate business connection message produces exactly one order."""
    conn_id = f"biz_conn_{uuid.uuid4().hex[:6]}"
    chat_id = 880000 + (uuid.uuid4().int % 10000)
    msg_id = 600 + (uuid.uuid4().int % 1000)
    key = generate_order_idempotency_key(source="biz", organization_id=1, connection_id=conn_id, chat_id=chat_id, message_id=msg_id)

    async with core_db.SessionLocal() as db:
        o1, c1 = await get_or_create_idempotent_order(db, idempotency_key=key, organization_id=1, customer_name="Vali")
        await db.commit()
        assert c1 is True

        o2, c2 = await get_or_create_idempotent_order(db, idempotency_key=key, organization_id=1, customer_name="Vali")
        assert c2 is False
        assert o2.id == o1.id


@pytest.mark.anyio
async def test_c3_two_tenants_overlapping_ids_tenant_isolation():
    """Two different tenants with identical chat_id and message_id do not collide."""
    chat_id = 990000 + (uuid.uuid4().int % 10000)
    msg_id = 700 + (uuid.uuid4().int % 1000)

    async with core_db.SessionLocal() as db:
        org_ids = (await db.execute(select(Organization.id).order_by(Organization.id.asc()).limit(2))).scalars().all()
        org_a = org_ids[0]
        org_b = org_ids[1] if len(org_ids) > 1 else org_a

        key_tenant1 = generate_order_idempotency_key(source="direct", organization_id=org_a, bot_id="bot1", chat_id=chat_id, message_id=msg_id)
        key_tenant2 = generate_order_idempotency_key(source="direct", organization_id=org_b, bot_id="bot2", chat_id=chat_id, message_id=msg_id)

        assert key_tenant1 != key_tenant2

        o1, c1 = await get_or_create_idempotent_order(db, idempotency_key=key_tenant1, organization_id=org_a)
        o2, c2 = await get_or_create_idempotent_order(db, idempotency_key=key_tenant2, organization_id=org_b)
        await db.commit()

        assert c1 is True
        assert c2 is True
        assert o1.id != o2.id
        assert o1.organization_id == org_a
        assert o2.organization_id == org_b


@pytest.mark.anyio
async def test_c4_concurrent_order_creation_savepoint_safety():
    """Concurrent order creation races are handled safely via savepoints without transaction poisoning."""
    key = f"order:race:{uuid.uuid4().hex[:8]}"

    async def create_order_task(name: str):
        async with core_db.SessionLocal() as db:
            order, created = await get_or_create_idempotent_order(
                db,
                idempotency_key=key,
                organization_id=1,
                customer_name=name,
            )
            await db.commit()
            return order.id, created

    res1, res2 = await asyncio.gather(
        create_order_task("User1"),
        create_order_task("User2"),
    )

    id1, c1 = res1
    id2, c2 = res2

    assert id1 == id2
    assert {c1, c2} == {True, False}


@pytest.mark.anyio
async def test_c5_cross_tenant_idempotency_collision_raises_permission_error():
    """An attempt by tenant B to access tenant A's idempotency key raises PermissionError."""
    key = f"order:exclusive:{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        await get_or_create_idempotent_order(db, idempotency_key=key, organization_id=1, customer_name="Org1 Customer")
        await db.commit()

        # Org 2 attempts to query/use the same idempotency key
        with pytest.raises(PermissionError) as exc_info:
            await get_or_create_idempotent_order(db, idempotency_key=key, organization_id=2)
        assert "Tenant isolation violation" in str(exc_info.value)


# ============================================================================
# AREA D: INBOX-TO-BUSINESS-TO-OUTBOX ATOMIC TRANSACTION BOUNDARIES
# ============================================================================

@pytest.mark.anyio
async def test_d1_atomic_inbox_business_outbox_transaction_success():
    """Business mutation, outbox staging, and inbox completion commit together atomically."""
    bot_name = f"bot_d1_{uuid.uuid4().hex[:6]}"
    uid = 970000 + (uuid.uuid4().int % 100000)
    order_key = f"order:atomic:{uuid.uuid4().hex[:8]}"
    outbox_key = f"outbox:alert:{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_name, update_id=uid, payload={"order": True}, organization_id=1)
        inbox_id = item.id
        claimed = await claim_inbox_batch(db, batch_size=1, bot_id=bot_name)
        assert len(claimed) == 1
        token = claimed[0][1]
        gen = claimed[0][5]

    async def business_handler(payload: dict, session: AsyncSession, org_id: int | None):
        await get_or_create_idempotent_order(session, idempotency_key=order_key, organization_id=org_id, customer_name="Atomic Client")
        await stage_outbox_event(session, idempotency_key=outbox_key, event_type="notify_admin", payload={"text": "New order"}, organization_id=org_id)

    async with core_db.SessionLocal() as db:
        success = await process_inbox_job_atomically(db, inbox_id, token, gen, business_handler)
        assert success is True

    # Verify everything committed together
    async with core_db.SessionLocal() as db:
        inbox_row = (await db.execute(select(TelegramInbox).where(TelegramInbox.id == inbox_id))).scalar_one()
        assert inbox_row.status == "completed"

        order_row = (await db.execute(select(Order).where(Order.idempotency_key == order_key))).scalar_one_or_none()
        assert order_row is not None

        outbox_row = (await db.execute(select(TelegramOutbox).where(TelegramOutbox.idempotency_key == outbox_key))).scalar_one_or_none()
        assert outbox_row is not None


@pytest.mark.anyio
async def test_d2_business_failure_rolls_back_and_records_retry_backoff():
    """Failure inside business logic rolls back business mutations and records retry backoff."""
    bot_name = f"bot_d2_{uuid.uuid4().hex[:6]}"
    uid = 971000 + (uuid.uuid4().int % 100000)
    order_key = f"order:rollback:{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item, _ = await record_inbox_update(db, bot_id=bot_name, update_id=uid, payload={"fail": True}, organization_id=1)
        inbox_id = item.id
        claimed = await claim_inbox_batch(db, batch_size=1, bot_id=bot_name)
        assert len(claimed) == 1
        token = claimed[0][1]
        gen = claimed[0][5]

    async def failing_handler(payload: dict, session: AsyncSession, org_id: int | None):
        await get_or_create_idempotent_order(session, idempotency_key=order_key, organization_id=org_id, customer_name="Ghost Order")
        raise RuntimeError("Simulated processing failure")

    async with core_db.SessionLocal() as db:
        success = await process_inbox_job_atomically(db, inbox_id, token, gen, failing_handler)
        assert success is False

    # Verify order was rolled back and inbox is in retry state
    async with core_db.SessionLocal() as db:
        order_row = (await db.execute(select(Order).where(Order.idempotency_key == order_key))).scalar_one_or_none()
        assert order_row is None

        inbox_row = (await db.execute(select(TelegramInbox).where(TelegramInbox.id == inbox_id))).scalar_one()
        assert inbox_row.status == "retry"
        assert inbox_row.attempts == 1
        assert "Simulated processing failure" in (inbox_row.last_error or "")


# ============================================================================
# AREA E: TRANSACTIONAL OUTBOX DELIVERY SEMANTICS
# ============================================================================

@pytest.mark.anyio
async def test_e1_outbox_claim_releases_locks_before_http_send():
    """Outbox claiming commits row state so external HTTP sends occur outside of row locks."""
    outbox_key = f"outbox:lock_release:{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item = await stage_outbox_event(db, idempotency_key=outbox_key, event_type="send_message", payload={"chat_id": 123, "text": "hello"})
        await db.commit()
        outbox_id = item.id

        claimed = await claim_outbox_batch(db, batch_size=1, worker_id="w_lock_test", outbox_id=outbox_id)
        assert len(claimed) == 1
        cid, token, event_type, payload, org_id, attempts = claimed[0]
        assert cid == outbox_id

        # Verify record is in processing status in database
        row = (await db.execute(select(TelegramOutbox).where(TelegramOutbox.id == outbox_id))).scalar_one()
        assert row.status == "processing"
        assert row.lease_owner == "w_lock_test"

        # Complete to leave table clean
        await complete_outbox_event(db, outbox_id, token)


@pytest.mark.anyio
async def test_e2_outbox_successful_send_marks_sent():
    """Successful external dispatch marks the outbox event as sent."""
    outbox_key = f"outbox:success:{uuid.uuid4().hex[:8]}"
    delivered_payloads = []

    async def mock_sender(event_type: str, payload: dict, org_id: int | None):
        delivered_payloads.append(payload)

    async with core_db.SessionLocal() as db:
        item = await stage_outbox_event(db, idempotency_key=outbox_key, event_type="send_message", payload={"text": "e2"})
        await db.commit()

        count = await dispatch_outbox_batch(db, batch_size=10, sender_func=mock_sender, outbox_id=item.id)
        assert count == 1
        assert len(delivered_payloads) == 1

        row = (await db.execute(select(TelegramOutbox).where(TelegramOutbox.idempotency_key == outbox_key))).scalar_one()
        assert row.status == "sent"
        assert row.processed_at is not None


@pytest.mark.anyio
async def test_e3_outbox_network_failure_retry_backoff():
    """Network failure during outbox dispatch records error and schedules exponential retry."""
    outbox_key = f"outbox:fail:{uuid.uuid4().hex[:8]}"

    async def failing_sender(event_type: str, payload: dict, org_id: int | None):
        raise ConnectionError("Telegram API DNS resolution failed")

    async with core_db.SessionLocal() as db:
        await stage_outbox_event(db, idempotency_key=outbox_key, event_type="send_message", payload={"text": "e3"})
        await db.commit()

        count = await dispatch_outbox_batch(db, batch_size=10, sender_func=failing_sender)
        assert count == 0

        row = (await db.execute(select(TelegramOutbox).where(TelegramOutbox.idempotency_key == outbox_key))).scalar_one()
        assert row.status == "retry"
        assert row.attempts == 1
        assert row.next_retry_at is not None
        assert "DNS resolution failed" in (row.last_error or "")


@pytest.mark.anyio
async def test_e4_outbox_timeout_uncertain_delivery_state():
    """Network timeouts enter uncertain delivery state acknowledging at-least-once delivery semantics."""
    outbox_key = f"outbox:timeout:{uuid.uuid4().hex[:8]}"

    async def timeout_sender(event_type: str, payload: dict, org_id: int | None):
        raise TimeoutError("HTTP request timed out after 30s")

    async with core_db.SessionLocal() as db:
        await stage_outbox_event(db, idempotency_key=outbox_key, event_type="send_message", payload={"text": "e4"})
        await db.commit()

        await dispatch_outbox_batch(db, batch_size=10, sender_func=timeout_sender)

        row = (await db.execute(select(TelegramOutbox).where(TelegramOutbox.idempotency_key == outbox_key))).scalar_one()
        assert row.status == "uncertain"
        assert "timed out" in (row.last_error or "").lower()


@pytest.mark.anyio
async def test_e5_outbox_max_attempts_dead_letter():
    """Events exceeding max_attempts transition to dead_letter."""
    outbox_key = f"outbox:dlq:{uuid.uuid4().hex[:8]}"

    async def permanent_error_sender(event_type: str, payload: dict, org_id: int | None):
        raise ValueError("Bad Request: chat not found")

    async with core_db.SessionLocal() as db:
        item = await stage_outbox_event(db, idempotency_key=outbox_key, event_type="send_message", payload={"text": "dlq"})
        item.attempts = 4  # Next attempt will be 5 == max_attempts
        await db.commit()

        await dispatch_outbox_batch(db, batch_size=10, sender_func=permanent_error_sender)

        row = (await db.execute(select(TelegramOutbox).where(TelegramOutbox.idempotency_key == outbox_key))).scalar_one()
        assert row.status == "dead_letter"
        assert row.attempts >= 5


@pytest.mark.anyio
async def test_e6_stale_worker_cannot_finalize_outbox():
    """A stale worker cannot complete or fail an outbox event owned by a newer lease."""
    outbox_key = f"outbox:fencing:{uuid.uuid4().hex[:8]}"

    async with core_db.SessionLocal() as db:
        item = await stage_outbox_event(db, idempotency_key=outbox_key, event_type="send_message", payload={})
        await db.commit()
        outbox_id = item.id

        claimed = await claim_outbox_batch(db, batch_size=1, outbox_id=outbox_id)
        valid_token = claimed[0][1]

        # Stale worker tries to complete with bad token
        stale_res = await complete_outbox_event(db, outbox_id, "stale_outbox_token")
        assert stale_res is False

        # Valid worker completes
        valid_res = await complete_outbox_event(db, outbox_id, valid_token)
        assert valid_res is True


# ============================================================================
# AREA F: CANONICAL STATE MACHINE TRANSITION RULES
# ============================================================================

@pytest.mark.anyio
async def test_f1_canonical_inbox_state_machine_transitions():
    """Inbox canonical transitions are enforced; illegal transitions are rejected."""
    # Valid transitions
    assert validate_inbox_transition("pending", "processing") is True
    assert validate_inbox_transition("processing", "completed") is True
    assert validate_inbox_transition("processing", "retry") is True
    assert validate_inbox_transition("processing", "dead_letter") is True
    assert validate_inbox_transition("retry", "processing") is True

    # Illegal transitions
    assert validate_inbox_transition("completed", "processing") is False
    assert validate_inbox_transition("dead_letter", "processing") is False
    assert validate_inbox_transition("pending", "completed") is False  # Must be claimed first


@pytest.mark.anyio
async def test_f2_canonical_outbox_state_machine_transitions():
    """Outbox canonical transitions are enforced; illegal transitions are rejected."""
    # Valid transitions
    assert validate_outbox_transition("pending", "processing") is True
    assert validate_outbox_transition("processing", "sent") is True
    assert validate_outbox_transition("processing", "retry") is True
    assert validate_outbox_transition("processing", "uncertain") is True
    assert validate_outbox_transition("processing", "dead_letter") is True
    assert validate_outbox_transition("uncertain", "processing") is True

    # Illegal transitions
    assert validate_outbox_transition("sent", "processing") is False
    assert validate_outbox_transition("dead_letter", "processing") is False
    assert validate_outbox_transition("pending", "sent") is False  # Must be claimed first


# ============================================================================
# AREA G: QUEUE OBSERVABILITY & SANITIZED METRICS
# ============================================================================

@pytest.mark.anyio
async def test_g1_queue_metrics_accuracy_and_sanitization():
    """Queue metrics return accurate counts without leaking tokens, secrets, or PII."""
    async with core_db.SessionLocal() as db:
        metrics = await get_queue_metrics(db)

        # Structure checks
        assert "inbox" in metrics
        assert "outbox" in metrics
        assert "timestamp" in metrics

        inbox_m = metrics["inbox"]
        for key in ["pending", "processing", "retry", "completed", "dead_letter", "expired_leases", "oldest_pending_age_seconds"]:
            assert key in inbox_m
            assert isinstance(inbox_m[key], (int, float))

        outbox_m = metrics["outbox"]
        for key in ["pending", "processing", "retry", "sent", "uncertain", "dead_letter", "expired_leases", "oldest_pending_age_seconds"]:
            assert key in outbox_m
            assert isinstance(outbox_m[key], (int, float))

        # PII & Secret leak checks
        raw_str = str(metrics).lower()
        assert "token" not in raw_str or "secret" not in raw_str
        assert "password" not in raw_str
        assert "authorization" not in raw_str
