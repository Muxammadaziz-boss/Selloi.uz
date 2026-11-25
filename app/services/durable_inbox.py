import asyncio
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable, Coroutine
import uuid
from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal
from app.core.logging import get_logger
from app.models import (
    BusinessConnection,
    Order,
    Organization,
    TelegramInbox,
    TelegramOutbox,
)
from app.services.telegram import get_telegram_service, telegram

logger = get_logger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================================
# CANONICAL STATE MACHINES (AUDIT E)
# ============================================================================

class InboxStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    RETRY = "retry"
    COMPLETED = "completed"
    DEAD_LETTER = "dead_letter"


class OutboxStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    RETRY = "retry"
    SENT = "sent"
    DEAD_LETTER = "dead_letter"
    UNCERTAIN = "uncertain"


ALLOWED_INBOX_TRANSITIONS: dict[str, set[str]] = {
    InboxStatus.PENDING.value: {InboxStatus.PROCESSING.value},
    InboxStatus.PROCESSING.value: {
        InboxStatus.COMPLETED.value,
        InboxStatus.RETRY.value,
        InboxStatus.DEAD_LETTER.value,
        InboxStatus.PROCESSING.value,  # allowed for lease renewal
    },
    InboxStatus.RETRY.value: {InboxStatus.PROCESSING.value},
    InboxStatus.COMPLETED.value: set(),
    InboxStatus.DEAD_LETTER.value: set(),
}

ALLOWED_OUTBOX_TRANSITIONS: dict[str, set[str]] = {
    OutboxStatus.PENDING.value: {OutboxStatus.PROCESSING.value},
    OutboxStatus.PROCESSING.value: {
        OutboxStatus.SENT.value,
        OutboxStatus.RETRY.value,
        OutboxStatus.UNCERTAIN.value,
        OutboxStatus.DEAD_LETTER.value,
        OutboxStatus.PROCESSING.value,  # allowed for lease renewal
    },
    OutboxStatus.RETRY.value: {OutboxStatus.PROCESSING.value},
    OutboxStatus.UNCERTAIN.value: {
        OutboxStatus.PROCESSING.value,
        OutboxStatus.SENT.value,
        OutboxStatus.DEAD_LETTER.value,
    },
    OutboxStatus.SENT.value: set(),
    OutboxStatus.DEAD_LETTER.value: set(),
}


def validate_inbox_transition(current: str, target: str) -> bool:
    """Validate whether an inbox state transition is permitted by the canonical state machine."""
    allowed = ALLOWED_INBOX_TRANSITIONS.get(current, set())
    return target in allowed


def validate_outbox_transition(current: str, target: str) -> bool:
    """Validate whether an outbox state transition is permitted by the canonical state machine."""
    allowed = ALLOWED_OUTBOX_TRANSITIONS.get(current, set())
    return target in allowed


# ============================================================================
# CANONICAL IDEMPOTENCY KEY GENERATORS (AUDIT B)
# ============================================================================

def generate_order_idempotency_key(
    *,
    source: str,  # "biz", "direct", "botmgr"
    organization_id: int | None,
    bot_id: str | None = None,
    connection_id: str | None = None,
    chat_id: int | str,
    message_id: int | str,
) -> str:
    """Generate a canonical, deterministic, tenant-isolated idempotency key for orders.

    Guarantees:
    - Organization identity is always embedded, preventing cross-tenant collisions.
    - Specific bot_id or business_connection_id is scoped to prevent cross-bot collisions.
    - Deterministic across retries.
    """
    clean_org = str(organization_id) if organization_id is not None else "global"
    clean_chat = str(chat_id)
    clean_msg = str(message_id)

    if source == "biz":
        conn = str(connection_id) if connection_id else "direct"
        return f"order:biz:{clean_org}:{conn}:{clean_chat}:{clean_msg}"
    elif source == "direct":
        bot = str(bot_id) if bot_id else "default"
        return f"order:direct:{clean_org}:{bot}:{clean_chat}:{clean_msg}"
    elif source == "botmgr":
        bot = str(bot_id) if bot_id else "manager"
        return f"order:botmgr:{clean_org}:{bot}:{clean_chat}:{clean_msg}"
    else:
        return f"order:{source}:{clean_org}:{clean_chat}:{clean_msg}"


def generate_outbox_idempotency_key(
    *,
    event_type: str,
    organization_id: int | None,
    entity_id: int | str,
    action: str | None = None,
) -> str:
    """Generate a canonical, deterministic idempotency key for outbound notifications."""
    clean_org = str(organization_id) if organization_id is not None else "global"
    act_suffix = f":{action}" if action else ""
    return f"outbox:{event_type}:{clean_org}:{entity_id}{act_suffix}"


# ============================================================================
# BUSINESS IDEMPOTENCY & SAVEPOINT HANDLING (AUDIT B / C)
# ============================================================================

async def get_or_create_idempotent_order(
    db: AsyncSession,
    *,
    idempotency_key: str,
    organization_id: int | None,
    conversation_id: int | None = None,
    customer_name: str = "",
    phone: str = "",
    product_summary: str = "",
    delivery_address: str = "",
    amount: str = "$0",
    status: str = "new",
    notes: str = "",
) -> tuple[Order, bool]:
    """Retrieve an existing order by idempotency key or create a new one atomically.

    Guarantees:
    - Tenant isolation: raises PermissionError if an existing key belongs to another tenant.
    - Concurrent insert safety: uses db.begin_nested() savepoint to isolate IntegrityError.
    Returns:
        (order, created: bool)
    """
    # 1. Fast check for existing order
    stmt = select(Order).where(Order.idempotency_key == idempotency_key)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        if organization_id and existing.organization_id and existing.organization_id != organization_id:
            raise PermissionError(
                f"Tenant isolation violation: idempotency key '{idempotency_key}' "
                f"belongs to org {existing.organization_id}, requested by {organization_id}"
            )
        return existing, False

    # 2. Attempt insert inside a PostgreSQL SAVEPOINT
    try:
        async with db.begin_nested():
            new_order = Order(
                organization_id=organization_id,
                conversation_id=conversation_id,
                idempotency_key=idempotency_key,
                customer_name=customer_name,
                phone=phone,
                product_summary=product_summary,
                delivery_address=delivery_address,
                amount=amount,
                status=status,
                notes=notes,
            )
            db.add(new_order)
            await db.flush()
        return new_order, True
    except IntegrityError:
        # Concurrent race: another worker committed the same idempotency key
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            if organization_id and existing.organization_id and existing.organization_id != organization_id:
                raise PermissionError(
                    f"Tenant isolation violation: idempotency key '{idempotency_key}' "
                    f"belongs to org {existing.organization_id}, requested by {organization_id}"
                )
            return existing, False
        raise


# ============================================================================
# DURABLE INBOX SERVICE (AUDIT A / C)
# ============================================================================

async def record_inbox_update(
    db: AsyncSession,
    *,
    bot_id: str,
    update_id: int,
    payload: dict,
    organization_id: int | None = None,
) -> tuple[TelegramInbox | None, bool]:
    """Persist an incoming Telegram update into the durable PostgreSQL inbox.

    Guarantees ACID durability before HTTP 200 acknowledgment.
    Returns:
        (inbox_item, is_duplicate)
    """
    inbox_item = TelegramInbox(
        bot_id=bot_id,
        organization_id=organization_id,
        update_id=update_id,
        payload=payload,
        status=InboxStatus.PENDING.value,
        attempts=0,
        max_attempts=5,
        fencing_generation=1,
        received_at=_now(),
    )
    db.add(inbox_item)
    try:
        await db.commit()
        await db.refresh(inbox_item)
        return inbox_item, False
    except IntegrityError:
        await db.rollback()
        # Fetch existing row
        existing = (await db.execute(
            select(TelegramInbox).where(
                TelegramInbox.bot_id == bot_id,
                TelegramInbox.update_id == update_id,
            )
        )).scalar_one_or_none()
        return existing, True


async def claim_inbox_batch(
    db: AsyncSession,
    *,
    batch_size: int = 10,
    lease_seconds: int = 60,
    worker_id: str | None = None,
    bot_id: str | None = None,
) -> list[tuple[int, str, dict, int, int | None, int]]:
    """Atomically claim a batch of inbox updates using SELECT ... FOR UPDATE SKIP LOCKED.

    Claims:
    1. Pending jobs whose lease has never been acquired or has expired.
    2. Retry jobs whose next_attempt_at is in the past and lease is expired.
    3. Processing jobs whose lease has expired (crashed worker recovery).

    Enforces monotonic fencing_generation increment on every claim.
    Returns:
        List of tuples: (inbox_id, lease_token, payload, attempts, organization_id, fencing_generation)
    """
    now = _now()
    worker_name = worker_id or f"worker_{uuid.uuid4().hex[:8]}"

    conditions = [
        or_(
            and_(
                TelegramInbox.status == InboxStatus.PENDING.value,
                or_(
                    TelegramInbox.lease_expires_at.is_(None),
                    TelegramInbox.lease_expires_at <= now,
                ),
            ),
            and_(
                TelegramInbox.status == InboxStatus.RETRY.value,
                TelegramInbox.next_attempt_at <= now,
                or_(
                    TelegramInbox.lease_expires_at.is_(None),
                    TelegramInbox.lease_expires_at <= now,
                ),
            ),
            and_(
                TelegramInbox.status == InboxStatus.PROCESSING.value,
                TelegramInbox.lease_expires_at.is_not(None),
                TelegramInbox.lease_expires_at <= now,
            ),
        )
    ]
    if bot_id:
        conditions.append(TelegramInbox.bot_id == bot_id)

    stmt = (
        select(TelegramInbox)
        .where(and_(*conditions))
        .order_by(TelegramInbox.id.asc())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )

    claimed_rows = (await db.execute(stmt)).scalars().all()
    results = []

    for row in claimed_rows:
        lease_token = uuid.uuid4().hex
        row.lease_owner = worker_name
        row.lease_token = lease_token
        row.lease_expires_at = now + timedelta(seconds=lease_seconds)
        row.status = InboxStatus.PROCESSING.value
        row.attempts += 1
        row.fencing_generation = (row.fencing_generation or 0) + 1
        results.append((row.id, lease_token, row.payload, row.attempts, row.organization_id, row.fencing_generation))

    if results:
        await db.commit()

    return results


async def renew_inbox_lease(
    db: AsyncSession,
    inbox_id: int,
    lease_token: str,
    fencing_generation: int,
    extend_seconds: int = 60,
) -> bool:
    """Extend the processing lease token while verifying fencing token, generation, and active lease."""
    if (
        fencing_generation is None
        or isinstance(fencing_generation, bool)
        or not isinstance(fencing_generation, int)
        or fencing_generation <= 0
    ):
        raise ValueError(f"fencing_generation is mandatory and must be a positive integer, got {fencing_generation!r}")

    now = _now()
    conditions = [
        TelegramInbox.id == inbox_id,
        TelegramInbox.lease_token == lease_token,
        TelegramInbox.fencing_generation == fencing_generation,
        TelegramInbox.status == InboxStatus.PROCESSING.value,
        TelegramInbox.lease_expires_at > now,
    ]

    stmt = select(TelegramInbox).where(and_(*conditions)).with_for_update()
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        logger.warning(
            "Fencing conflict or expired lease: cannot renew inbox %s with token %s (gen=%s)",
            inbox_id, lease_token, fencing_generation,
        )
        return False

    item.lease_expires_at = now + timedelta(seconds=extend_seconds)
    await db.commit()
    return True


async def complete_inbox_job(
    db: AsyncSession,
    inbox_id: int,
    lease_token: str,
    fencing_generation: int,
) -> bool:
    """Mark claimed inbox record as completed, strictly verifying fencing lease token, generation, and active lease."""
    if (
        fencing_generation is None
        or isinstance(fencing_generation, bool)
        or not isinstance(fencing_generation, int)
        or fencing_generation <= 0
    ):
        raise ValueError(f"fencing_generation is mandatory and must be a positive integer, got {fencing_generation!r}")

    now = _now()
    conditions = [
        TelegramInbox.id == inbox_id,
        TelegramInbox.lease_token == lease_token,
        TelegramInbox.fencing_generation == fencing_generation,
        TelegramInbox.status == InboxStatus.PROCESSING.value,
        TelegramInbox.lease_expires_at > now,
    ]

    stmt = select(TelegramInbox).where(and_(*conditions)).with_for_update()
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        logger.warning(
            "Fencing conflict or expired lease: cannot complete inbox %s with token %s (gen=%s)",
            inbox_id, lease_token, fencing_generation,
        )
        return False

    item.status = InboxStatus.COMPLETED.value
    item.processed_at = now
    item.lease_token = None
    item.lease_owner = None
    item.lease_expires_at = None
    item.last_error = None
    await db.commit()
    return True


async def fail_inbox_job(
    db: AsyncSession,
    inbox_id: int,
    lease_token: str,
    error_message: str,
    fencing_generation: int,
) -> bool:
    """Record failure with exponential retry backoff, strictly verifying fencing token, generation, and active lease."""
    if (
        fencing_generation is None
        or isinstance(fencing_generation, bool)
        or not isinstance(fencing_generation, int)
        or fencing_generation <= 0
    ):
        raise ValueError(f"fencing_generation is mandatory and must be a positive integer, got {fencing_generation!r}")

    now = _now()
    conditions = [
        TelegramInbox.id == inbox_id,
        TelegramInbox.lease_token == lease_token,
        TelegramInbox.fencing_generation == fencing_generation,
        TelegramInbox.status == InboxStatus.PROCESSING.value,
        TelegramInbox.lease_expires_at > now,
    ]

    stmt = select(TelegramInbox).where(and_(*conditions)).with_for_update()
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        logger.warning(
            "Fencing conflict or expired lease: cannot fail inbox %s with token %s (gen=%s)",
            inbox_id, lease_token, fencing_generation,
        )
        return False

    item.last_error = error_message[:2000]
    if item.attempts >= item.max_attempts:
        item.status = InboxStatus.DEAD_LETTER.value
        item.next_attempt_at = None
        logger.error(
            "Inbox update %s reached max attempts (%s); moved to dead_letter. Error: %s",
            inbox_id,
            item.max_attempts,
            error_message,
        )
    else:
        item.status = InboxStatus.RETRY.value
        backoff_sec = min(300, (2 ** item.attempts) * 5)
        item.next_attempt_at = now + timedelta(seconds=backoff_sec)
        logger.warning(
            "Inbox update %s failed (attempt %s/%s). Retrying in %ss. Error: %s",
            inbox_id,
            item.attempts,
            item.max_attempts,
            backoff_sec,
            error_message,
        )

    item.lease_token = None
    item.lease_owner = None
    item.lease_expires_at = None
    await db.commit()
    return True


async def process_inbox_job_atomically(
    db: AsyncSession,
    inbox_id: int,
    lease_token: str,
    fencing_generation: int,
    business_func: Callable[[dict, AsyncSession, int | None], Coroutine[Any, Any, Any]],
) -> bool:
    """Execute business mutations and complete inbox job within the SAME atomic database transaction.

    Guarantees:
    - Atomicity: business mutations, staged outbox events, and inbox status='completed' commit together.
    - Fencing: verifies lease token and generation before committing.
    - Rollback safety: if business_func or outbox staging fails, business state is cleanly rolled back
      and the failure is recorded with backoff in a fresh transaction.
    """
    if (
        fencing_generation is None
        or isinstance(fencing_generation, bool)
        or not isinstance(fencing_generation, int)
        or fencing_generation <= 0
    ):
        raise ValueError(f"fencing_generation is mandatory and must be a positive integer, got {fencing_generation!r}")

    now = _now()
    conditions = [
        TelegramInbox.id == inbox_id,
        TelegramInbox.lease_token == lease_token,
        TelegramInbox.fencing_generation == fencing_generation,
        TelegramInbox.status == InboxStatus.PROCESSING.value,
        TelegramInbox.lease_expires_at > now,
    ]

    stmt = select(TelegramInbox).where(and_(*conditions)).with_for_update()
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        logger.warning(
            "Fencing violation or expired lease for inbox %s (token=%s, gen=%s)",
            inbox_id, lease_token, fencing_generation,
        )
        return False

    payload = item.payload
    org_id = item.organization_id

    try:
        # Execute business mutations and outbox staging within this SAME transaction
        await business_func(payload, db, org_id)

        # Verify lease did not expire during execution
        if item.lease_expires_at and item.lease_expires_at <= _now():
            raise RuntimeError(f"Lease expired during atomic processing for inbox {inbox_id}")

        # Mark inbox completed within this SAME transaction
        item.status = InboxStatus.COMPLETED.value
        item.processed_at = now
        item.lease_token = None
        item.lease_owner = None
        item.lease_expires_at = None
        item.last_error = None

        await db.commit()
        return True
    except Exception as exc:
        logger.exception("Atomic execution failed for inbox job %s; rolling back: %s", inbox_id, exc)
        await db.rollback()
        # In a fresh transaction, record failure with backoff
        await fail_inbox_job(db, inbox_id, lease_token, str(exc), fencing_generation=fencing_generation)
        return False


async def process_single_inbox_job(
    inbox_id: int,
    handler_callable: Callable[[dict, AsyncSession, int | None], Coroutine[Any, Any, None]] | None = None,
) -> bool:
    """Claim and process a single inbox item immediately with full fencing and safety."""
    async with SessionLocal() as db:
        now = _now()
        stmt = (
            select(TelegramInbox)
            .where(
                TelegramInbox.id == inbox_id,
                or_(
                    TelegramInbox.status == InboxStatus.PENDING.value,
                    and_(
                        TelegramInbox.status == InboxStatus.RETRY.value,
                        TelegramInbox.next_attempt_at <= now,
                    ),
                    and_(
                        TelegramInbox.status == InboxStatus.PROCESSING.value,
                        TelegramInbox.lease_expires_at.is_not(None),
                        TelegramInbox.lease_expires_at <= now,
                    ),
                ),
            )
            .with_for_update(skip_locked=True)
        )
        item = (await db.execute(stmt)).scalar_one_or_none()
        if not item:
            return False

        lease_token = uuid.uuid4().hex
        item.lease_token = lease_token
        item.lease_owner = f"worker_{uuid.uuid4().hex[:8]}"
        item.lease_expires_at = now + timedelta(seconds=60)
        item.status = InboxStatus.PROCESSING.value
        item.attempts += 1
        item.fencing_generation = (item.fencing_generation or 0) + 1
        fencing_gen = item.fencing_generation
        await db.commit()

    if handler_callable is None:
        from app.api.webhooks import execute_update_payload
        handler_callable = execute_update_payload

    async with SessionLocal() as db:
        success = await process_inbox_job_atomically(
            db,
            inbox_id=inbox_id,
            lease_token=lease_token,
            fencing_generation=fencing_gen,
            business_func=handler_callable,
        )

    if success and not getattr(settings, "run_background_workers", False):
        # In non-worker mode (single process / test / dev), dispatch staged outbox batch immediately
        async with SessionLocal() as db:
            await dispatch_outbox_batch(db, batch_size=10)

    return success


# ============================================================================
# TRANSACTIONAL OUTBOX SERVICE (AUDIT D)
# ============================================================================

async def stage_outbox_event(
    db: AsyncSession,
    *,
    idempotency_key: str,
    event_type: str,
    payload: dict,
    organization_id: int | None = None,
) -> TelegramOutbox:
    """Stage an external side effect (Telegram API call) within the same DB transaction."""
    existing = (await db.execute(
        select(TelegramOutbox).where(TelegramOutbox.idempotency_key == idempotency_key)
    )).scalar_one_or_none()
    if existing:
        return existing

    outbox_item = TelegramOutbox(
        organization_id=organization_id,
        idempotency_key=idempotency_key,
        event_type=event_type,
        payload=payload,
        status=OutboxStatus.PENDING.value,
        attempts=0,
        max_attempts=5,
        created_at=_now(),
    )
    db.add(outbox_item)
    try:
        async with db.begin_nested():
            await db.flush()
    except IntegrityError:
        existing = (await db.execute(
            select(TelegramOutbox).where(TelegramOutbox.idempotency_key == idempotency_key)
        )).scalar_one_or_none()
        return existing  # type: ignore[return-value]
    return outbox_item


async def claim_outbox_batch(
    db: AsyncSession,
    batch_size: int = 10,
    lease_seconds: int = 60,
    worker_id: str | None = None,
    outbox_id: int | None = None,
) -> list[tuple[int, str, str, dict, int | None, int, int]]:
    """Atomically claim pending and recoverable outbox events using SKIP LOCKED.

    Commits immediately after claiming to release row locks before external HTTP calls are made.
    Returns:
        List of (outbox_id, lease_token, event_type, payload, organization_id, attempts, fencing_generation)
    """
    now = _now()
    worker_name = worker_id or f"outbox_worker_{uuid.uuid4().hex[:8]}"

    conditions = [
        or_(
            and_(
                TelegramOutbox.status == OutboxStatus.PENDING.value,
                or_(
                    TelegramOutbox.lease_expires_at.is_(None),
                    TelegramOutbox.lease_expires_at <= now,
                ),
            ),
            and_(
                TelegramOutbox.status == OutboxStatus.RETRY.value,
                TelegramOutbox.next_retry_at <= now,
                or_(
                    TelegramOutbox.lease_expires_at.is_(None),
                    TelegramOutbox.lease_expires_at <= now,
                ),
            ),
            and_(
                TelegramOutbox.status == OutboxStatus.PROCESSING.value,
                TelegramOutbox.lease_expires_at.is_not(None),
                TelegramOutbox.lease_expires_at <= now,
            ),
        )
    ]
    if outbox_id is not None:
        conditions.append(TelegramOutbox.id == outbox_id)

    stmt = (
        select(TelegramOutbox)
        .where(and_(*conditions))
        .order_by(TelegramOutbox.id.asc())
        .limit(batch_size)
        .with_for_update(skip_locked=True)
    )

    items = (await db.execute(stmt)).scalars().all()
    results = []

    for item in items:
        lease_token = uuid.uuid4().hex
        item.status = OutboxStatus.PROCESSING.value
        item.lease_owner = worker_name
        item.lease_token = lease_token
        item.lease_expires_at = now + timedelta(seconds=lease_seconds)
        item.attempts += 1
        item.fencing_generation = (item.fencing_generation or 0) + 1
        results.append((item.id, lease_token, item.event_type, item.payload or {}, item.organization_id, item.attempts, item.fencing_generation))

    if results:
        await db.commit()

    return results


async def renew_outbox_lease(
    db: AsyncSession,
    outbox_id: int,
    lease_token: str,
    fencing_generation: int,
    extend_seconds: int = 60,
) -> bool:
    """Extend outbox lease verifying token, fencing generation, and active lease."""
    if (
        fencing_generation is None
        or isinstance(fencing_generation, bool)
        or not isinstance(fencing_generation, int)
        or fencing_generation <= 0
    ):
        raise ValueError(f"fencing_generation is mandatory and must be a positive integer, got {fencing_generation!r}")

    now = _now()
    conditions = [
        TelegramOutbox.id == outbox_id,
        TelegramOutbox.lease_token == lease_token,
        TelegramOutbox.fencing_generation == fencing_generation,
        TelegramOutbox.status == OutboxStatus.PROCESSING.value,
        TelegramOutbox.lease_expires_at > now,
    ]
    stmt = select(TelegramOutbox).where(and_(*conditions)).with_for_update()
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        logger.warning(
            "Fencing conflict or expired lease: cannot renew outbox %s with token %s (gen=%s)",
            outbox_id, lease_token, fencing_generation,
        )
        return False

    item.lease_expires_at = now + timedelta(seconds=extend_seconds)
    await db.commit()
    return True


async def complete_outbox_event(
    db: AsyncSession,
    outbox_id: int,
    lease_token: str,
    fencing_generation: int,
) -> bool:
    """Mark claimed outbox record as sent, strictly verifying token, generation, and active lease."""
    if (
        fencing_generation is None
        or isinstance(fencing_generation, bool)
        or not isinstance(fencing_generation, int)
        or fencing_generation <= 0
    ):
        raise ValueError(f"fencing_generation is mandatory and must be a positive integer, got {fencing_generation!r}")

    now = _now()
    stmt = (
        select(TelegramOutbox)
        .where(
            TelegramOutbox.id == outbox_id,
            TelegramOutbox.lease_token == lease_token,
            TelegramOutbox.fencing_generation == fencing_generation,
            TelegramOutbox.status == OutboxStatus.PROCESSING.value,
            TelegramOutbox.lease_expires_at > now,
        )
        .with_for_update()
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        logger.warning(
            "Fencing conflict or expired lease: cannot complete outbox %s with token %s (gen=%s)",
            outbox_id, lease_token, fencing_generation,
        )
        return False

    item.status = OutboxStatus.SENT.value
    item.processed_at = now
    item.lease_token = None
    item.lease_owner = None
    item.lease_expires_at = None
    item.last_error = None
    await db.commit()
    return True


async def fail_outbox_event(
    db: AsyncSession,
    outbox_id: int,
    lease_token: str,
    error_message: str,
    fencing_generation: int,
    is_uncertain: bool = False,
) -> bool:
    """Record outbox delivery failure with exponential backoff, dead-letter, or uncertain state, verifying fencing."""
    if (
        fencing_generation is None
        or isinstance(fencing_generation, bool)
        or not isinstance(fencing_generation, int)
        or fencing_generation <= 0
    ):
        raise ValueError(f"fencing_generation is mandatory and must be a positive integer, got {fencing_generation!r}")

    now = _now()
    stmt = (
        select(TelegramOutbox)
        .where(
            TelegramOutbox.id == outbox_id,
            TelegramOutbox.lease_token == lease_token,
            TelegramOutbox.fencing_generation == fencing_generation,
            TelegramOutbox.status == OutboxStatus.PROCESSING.value,
            TelegramOutbox.lease_expires_at > now,
        )
        .with_for_update()
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        logger.warning(
            "Fencing conflict or expired lease: cannot fail outbox %s with token %s (gen=%s)",
            outbox_id, lease_token, fencing_generation,
        )
        return False

    item.last_error = error_message[:2000]
    if is_uncertain:
        item.status = OutboxStatus.UNCERTAIN.value
        logger.warning(
            "Outbox event %s entered uncertain delivery state (potential duplicate on retry): %s",
            outbox_id, error_message,
        )
    elif item.attempts >= item.max_attempts:
        item.status = OutboxStatus.DEAD_LETTER.value
        logger.error(
            "Outbox event %s reached max attempts (%s); moved to dead_letter: %s",
            outbox_id, item.max_attempts, error_message,
        )
    else:
        item.status = OutboxStatus.RETRY.value
        backoff_sec = min(300, (2 ** item.attempts) * 5)
        item.next_retry_at = now + timedelta(seconds=backoff_sec)
        logger.warning(
            "Outbox event %s failed (attempt %s/%s). Retrying in %ss. Error: %s",
            outbox_id, item.attempts, item.max_attempts, backoff_sec, error_message,
        )

    item.lease_token = None
    item.lease_owner = None
    item.lease_expires_at = None
    await db.commit()
    return True


async def _record_outbox_assistant_message(
    db: AsyncSession,
    conversation_id: int,
    telegram_message_id: int,
    text: str,
    reply_to_telegram_message_id: int | None = None,
    organization_id: int | None = None,
) -> None:
    """Record outgoing assistant message in messages table upon successful Telegram dispatch."""
    from app.services.conversations import save_message
    from app.services.realtime import publish_event
    try:
        saved = await save_message(
            db,
            conversation_id=conversation_id,
            telegram_message_id=telegram_message_id,
            direction="assistant",
            text=text,
            reply_to_telegram_message_id=reply_to_telegram_message_id,
            organization_id=organization_id,
        )
        await db.commit()
        if saved is not None:
            await publish_event(
                organization_id or saved.organization_id,
                "message.created",
                {
                    "conversation_id": conversation_id,
                    "direction": "assistant",
                    "text": text,
                },
            )
    except Exception as exc:
        logger.warning(
            "Could not record assistant message for conversation %s (msg_id=%s): %s",
            conversation_id, telegram_message_id, exc,
        )


async def dispatch_outbox_batch(
    db: AsyncSession,
    batch_size: int = 10,
    sender_func: Callable[[str, dict, int | None], Coroutine[Any, Any, None]] | None = None,
    worker_id: str | None = None,
    outbox_id: int | None = None,
) -> int:
    """Dispatch staged outbox events to Telegram API outside of database row locks."""
    claimed_events = await claim_outbox_batch(db, batch_size=batch_size, worker_id=worker_id, outbox_id=outbox_id)
    if not claimed_events:
        return 0

    dispatched_count = 0

    for item_id, lease_token, event_type, payload, org_id, attempts, fencing_gen in claimed_events:
        # Determine telegram service instance
        org = await db.get(Organization, org_id) if org_id else None
        bot_token = org.decrypted_bot_token if org else None
        try:
            tg_svc = get_telegram_service(bot_token) if bot_token else telegram
        except Exception:
            tg_svc = telegram

        try:
            if sender_func is not None:
                await sender_func(event_type, payload, org_id)
            elif not tg_svc:
                raise RuntimeError("Telegram service is not configured")
            elif event_type == "send_message":
                await tg_svc.send_message(payload["chat_id"], payload["text"])
            elif event_type == "send_photo":
                await tg_svc.call("sendPhoto", {
                    "chat_id": payload["chat_id"],
                    "photo": payload["photo"],
                    "caption": payload.get("caption", "")[:1024],
                })
            elif event_type == "send_business_text":
                sent = await tg_svc.send_business_text(
                    payload["business_connection_id"],
                    payload["chat_id"],
                    payload["text"],
                )
                if payload.get("conversation_id") and sent and isinstance(sent, dict) and sent.get("message_id"):
                    await _record_outbox_assistant_message(
                        db,
                        conversation_id=payload["conversation_id"],
                        telegram_message_id=int(sent["message_id"]),
                        text=payload["text"],
                        reply_to_telegram_message_id=payload.get("reply_to_telegram_message_id"),
                        organization_id=org_id,
                    )
            elif event_type == "send_business_photo":
                sent = await tg_svc.send_business_photo(
                    payload["business_connection_id"],
                    payload["chat_id"],
                    photo_file_id=payload.get("photo_file_id"),
                    photo_path=payload.get("photo_path"),
                    caption=payload.get("caption") or "",
                )
                if payload.get("conversation_id") and sent and isinstance(sent, dict) and sent.get("message_id"):
                    await _record_outbox_assistant_message(
                        db,
                        conversation_id=payload["conversation_id"],
                        telegram_message_id=int(sent["message_id"]),
                        text=payload.get("caption") or "",
                        reply_to_telegram_message_id=payload.get("reply_to_telegram_message_id"),
                        organization_id=org_id,
                    )
            elif event_type == "send_chat_action":
                await tg_svc.send_chat_action(
                    payload["chat_id"],
                    payload.get("action", "typing"),
                    business_connection_id=payload.get("business_connection_id"),
                )
            elif event_type == "read_business_message":
                await tg_svc.read_business_message(
                    payload["business_connection_id"],
                    payload["chat_id"],
                    payload["message_id"],
                )
            elif event_type == "notify_admin":
                await tg_svc.notify_admin(payload["text"])
            elif event_type == "notify_organization_admins":
                if hasattr(tg_svc, "notify_organization_admins"):
                    await tg_svc.notify_organization_admins(
                        db,
                        org_id or 1,
                        payload["text"],
                        reply_markup=payload.get("reply_markup"),
                    )
                else:
                    await tg_svc.notify_admin(payload["text"])
            else:
                logger.warning("Unknown outbox event type: %s", event_type)

            # Success: complete event guarded by lease token and fencing generation
            await complete_outbox_event(db, item_id, lease_token, fencing_generation=fencing_gen)
            dispatched_count += 1
        except Exception as exc:
            err_str = str(exc).lower()
            is_timeout = "timeout" in err_str or "timed out" in err_str or "connection reset" in err_str or "clientconnectorerror" in err_str
            logger.exception("Error dispatching outbox event %s: %s", item_id, exc)
            await fail_outbox_event(db, item_id, lease_token, str(exc), fencing_generation=fencing_gen, is_uncertain=is_timeout)

    return dispatched_count


async def sweep_inbox_and_outbox(
    batch_size: int = 10,
    worker_id: str | None = None,
    bot_id: str | None = None,
    handler_callable: Callable[[dict, AsyncSession, int | None], Coroutine[Any, Any, None]] | None = None,
    sender_func: Callable[[str, dict, int | None], Coroutine[Any, Any, None]] | None = None,
) -> tuple[int, int]:
    """Background worker sweep loop: claims inbox jobs, processes them atomically, dispatches outbox."""
    if handler_callable is None:
        from app.api.webhooks import execute_update_payload
        handler_callable = execute_update_payload

    inbox_processed = 0
    async with SessionLocal() as db:
        claimed = await claim_inbox_batch(db, batch_size=batch_size, worker_id=worker_id, bot_id=bot_id)

    for item_tuple in claimed:
        # Tuple format: (id, lease_token, payload, attempts, org_id, fencing_gen)
        item_id = item_tuple[0]
        lease_token = item_tuple[1]
        fencing_gen = int(item_tuple[5])

        async with SessionLocal() as db:
            success = await process_inbox_job_atomically(
                db,
                inbox_id=item_id,
                lease_token=lease_token,
                fencing_generation=fencing_gen,
                business_func=handler_callable,
            )
            if success:
                inbox_processed += 1

    outbox_dispatched = 0
    async with SessionLocal() as db:
        outbox_dispatched = await dispatch_outbox_batch(
            db, batch_size=batch_size, sender_func=sender_func, worker_id=worker_id,
        )

    return inbox_processed, outbox_dispatched


# ============================================================================
# OBSERVABILITY & OPERATIONAL METRICS (AUDIT H)
# ============================================================================

async def get_queue_metrics(db: AsyncSession) -> dict[str, Any]:
    """Retrieve operational health metrics for durable inbox and outbox queues.

    Safely sanitizes output: exposes NO customer PII, bot tokens, or credentials.
    """
    now = _now()

    # 1. Inbox metrics
    inbox_counts = (await db.execute(
        select(TelegramInbox.status, func.count(TelegramInbox.id)).group_by(TelegramInbox.status)
    )).all()
    inbox_status_map = {row[0]: row[1] for row in inbox_counts}

    oldest_pending_res = (await db.execute(
        select(func.min(TelegramInbox.received_at)).where(TelegramInbox.status == InboxStatus.PENDING.value)
    )).scalar_one_or_none()
    oldest_pending_age = (now - oldest_pending_res).total_seconds() if oldest_pending_res else 0.0

    expired_inbox_leases = (await db.execute(
        select(func.count(TelegramInbox.id)).where(
            TelegramInbox.status == InboxStatus.PROCESSING.value,
            TelegramInbox.lease_expires_at <= now,
        )
    )).scalar_one() or 0

    # 2. Outbox metrics
    outbox_counts = (await db.execute(
        select(TelegramOutbox.status, func.count(TelegramOutbox.id)).group_by(TelegramOutbox.status)
    )).all()
    outbox_status_map = {row[0]: row[1] for row in outbox_counts}

    oldest_outbox_res = (await db.execute(
        select(func.min(TelegramOutbox.created_at)).where(TelegramOutbox.status == OutboxStatus.PENDING.value)
    )).scalar_one_or_none()
    oldest_outbox_age = (now - oldest_outbox_res).total_seconds() if oldest_outbox_res else 0.0

    expired_outbox_leases = (await db.execute(
        select(func.count(TelegramOutbox.id)).where(
            TelegramOutbox.status == OutboxStatus.PROCESSING.value,
            TelegramOutbox.lease_expires_at <= now,
        )
    )).scalar_one() or 0

    return {
        "timestamp": now.isoformat(),
        "inbox": {
            "pending": inbox_status_map.get(InboxStatus.PENDING.value, 0),
            "processing": inbox_status_map.get(InboxStatus.PROCESSING.value, 0),
            "retry": inbox_status_map.get(InboxStatus.RETRY.value, 0),
            "completed": inbox_status_map.get(InboxStatus.COMPLETED.value, 0),
            "dead_letter": inbox_status_map.get(InboxStatus.DEAD_LETTER.value, 0),
            "expired_leases": expired_inbox_leases,
            "oldest_pending_age_seconds": round(oldest_pending_age, 2),
        },
        "outbox": {
            "pending": outbox_status_map.get(OutboxStatus.PENDING.value, 0),
            "processing": outbox_status_map.get(OutboxStatus.PROCESSING.value, 0),
            "retry": outbox_status_map.get(OutboxStatus.RETRY.value, 0),
            "sent": outbox_status_map.get(OutboxStatus.SENT.value, 0),
            "uncertain": outbox_status_map.get(OutboxStatus.UNCERTAIN.value, 0),
            "dead_letter": outbox_status_map.get(OutboxStatus.DEAD_LETTER.value, 0),
            "expired_leases": expired_outbox_leases,
            "oldest_pending_age_seconds": round(oldest_outbox_age, 2),
        },
    }
