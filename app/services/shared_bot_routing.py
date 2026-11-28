"""Multi-tenant customer routing for the official shared @Selloi_ai_bot (?start=shop_<slug>)."""

from datetime import datetime, timezone
import threading

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import BoundedTTLCache
from app.core.logging import get_logger
from app.models import BusinessConnection, Conversation, Organization

logger = get_logger(__name__)

_SHARED_SHOP_TTL_SECONDS = 86400 * 30
_SHARED_SHOP_MEM: BoundedTTLCache[int, int] = BoundedTTLCache(maxsize=5000, ttl_seconds=_SHARED_SHOP_TTL_SECONDS)
_SHARED_SHOP_LOCK = threading.Lock()


def _get_redis_safe():
    try:
        from app.core.rate_limit import limiter
        return limiter._get_redis()
    except Exception:
        return None


def set_shared_bot_shop(chat_id: int, organization_id: int) -> None:
    """Bind a Telegram private chat_id to a tenant store ID across workers and memory."""
    cid = int(chat_id)
    oid = int(organization_id)
    with _SHARED_SHOP_LOCK:
        _SHARED_SHOP_MEM[cid] = oid

    r = _get_redis_safe()
    if r is not None:
        try:
            r.setex(f"shared_bot_shop:{cid}", _SHARED_SHOP_TTL_SECONDS, str(oid))
        except Exception:
            pass


def get_cached_shared_bot_shop(chat_id: int) -> int | None:
    """Return cached tenant organization ID for a private chat_id, if bound."""
    cid = int(chat_id)
    r = _get_redis_safe()
    if r is not None:
        try:
            raw = r.get(f"shared_bot_shop:{cid}")
            if raw is not None:
                val = int(raw.decode() if isinstance(raw, bytes) else str(raw))
                with _SHARED_SHOP_LOCK:
                    _SHARED_SHOP_MEM[cid] = val
                return val
        except Exception:
            pass

    with _SHARED_SHOP_LOCK:
        return _SHARED_SHOP_MEM.get(cid)


async def bind_customer_to_shop(
    db: AsyncSession,
    *,
    chat_id: int,
    shop_key: str,
    customer_name: str,
    username: str | None = None,
) -> Organization | None:
    """Resolve an active Organization from shop_<slug|id> and persist chat routing."""
    clean_key = (shop_key or "").strip().lower()
    if not clean_key:
        return None

    res = await db.execute(
        select(Organization).where(Organization.slug == clean_key, Organization.status == "active")
    )
    org = res.scalar_one_or_none()
    if org is None and clean_key.isdigit():
        res_id = await db.execute(
            select(Organization).where(Organization.id == int(clean_key), Organization.status == "active")
        )
        org = res_id.scalar_one_or_none()
    if org is None:
        return None

    conn_id = f"shared_shop_{org.id}"
    conn = await db.get(BusinessConnection, conn_id)
    if conn is None:
        conn = BusinessConnection(id=conn_id, organization_id=org.id, is_enabled=True, rights={"shared_bot": True})
        db.add(conn)
        await db.flush()

    conv_res = await db.execute(
        select(Conversation).where(
            Conversation.business_connection_id == conn_id,
            Conversation.chat_id == int(chat_id),
        )
    )
    conv = conv_res.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if conv is None:
        conv = Conversation(
            organization_id=org.id,
            business_connection_id=conn_id,
            chat_id=int(chat_id),
            customer_name=customer_name or "Mijoz",
            username=username,
            status="ai_active",
            last_message_at=now,
        )
        db.add(conv)
    else:
        conv.organization_id = org.id
        if customer_name:
            conv.customer_name = customer_name
        if username:
            conv.username = username
        conv.last_message_at = now

    await db.commit()
    set_shared_bot_shop(chat_id, org.id)
    return org


async def resolve_customer_shared_bot_org_id(db: AsyncSession, chat_id: int) -> int | None:
    """Resolve the active tenant organization for a shared-bot private chat_id."""
    cached = get_cached_shared_bot_shop(chat_id)
    if cached is not None:
        org = await db.get(Organization, cached)
        if org is not None and org.status == "active":
            return cached

    res = await db.execute(
        select(Conversation.organization_id)
        .join(Organization, Organization.id == Conversation.organization_id)
        .where(
            Conversation.chat_id == int(chat_id),
            Conversation.business_connection_id.like("shared_shop_%"),
            Conversation.organization_id.is_not(None),
            Organization.status == "active",
        )
        .order_by(Conversation.last_message_at.desc())
        .limit(1)
    )
    org_id = res.scalar_one_or_none()
    if org_id is not None:
        set_shared_bot_shop(chat_id, int(org_id))
        return int(org_id)
    return None
