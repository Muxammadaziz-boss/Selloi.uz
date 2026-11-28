"""Smart Follow-up automation engine with Business Hours and strict anti-spam caps."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models import (
    AuditLog,
    BusinessConnection,
    Conversation,
    FollowupLog,
    Message,
    Order,
    Organization,
    StoreFollowupConfig,
)
from app.services.realtime import publish_event
from app.services.telegram import get_telegram_service, telegram

logger = get_logger(__name__)

TASHKENT_TZ = timezone(timedelta(hours=5))


def _ensure_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def is_within_business_hours(
    now_utc: datetime,
    *,
    business_hours_only: bool,
    start_hour: int,
    end_hour: int,
) -> bool:
    """Return True if current Asia/Tashkent hour is inside configured follow-up window."""
    if not business_hours_only:
        return True
    local_hour = now_utc.astimezone(TASHKENT_TZ).hour
    if start_hour == end_hour:
        return True
    if start_hour < end_hour:
        return start_hour <= local_hour < end_hour
    return local_hour >= start_hour or local_hour < end_hour


async def get_or_create_followup_config(
    db: AsyncSession,
    organization_id: int,
) -> StoreFollowupConfig:
    cfg = (
        await db.execute(
            select(StoreFollowupConfig).where(StoreFollowupConfig.organization_id == organization_id)
        )
    ).scalar_one_or_none()
    if cfg is None:
        cfg = StoreFollowupConfig(organization_id=organization_id)
        db.add(cfg)
        await db.flush()
    return cfg


def serialize_followup_config(cfg: StoreFollowupConfig) -> dict[str, Any]:
    return {
        "organization_id": cfg.organization_id,
        "is_enabled": bool(cfg.is_enabled),
        "delay_hours": int(cfg.delay_hours),
        "max_attempts": int(cfg.max_attempts),
        "business_hours_only": bool(cfg.business_hours_only),
        "start_hour": int(cfg.start_hour),
        "end_hour": int(cfg.end_hour),
        "offer_discount_pct": int(cfg.offer_discount_pct),
        "custom_template": cfg.custom_template or "",
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


async def upsert_followup_config(
    db: AsyncSession,
    organization_id: int,
    payload: dict[str, Any],
) -> StoreFollowupConfig:
    cfg = await get_or_create_followup_config(db, organization_id)
    if "is_enabled" in payload and payload["is_enabled"] is not None:
        cfg.is_enabled = bool(payload["is_enabled"])
    if "delay_hours" in payload and payload["delay_hours"] is not None:
        dh = int(payload["delay_hours"])
        if dh < 1 or dh > 72:
            raise ValueError("Kechikish vaqti 1 dan 72 soatgacha bo'lishi kerak")
        cfg.delay_hours = dh
    if "max_attempts" in payload and payload["max_attempts"] is not None:
        ma = int(payload["max_attempts"])
        if ma < 1 or ma > 3:
            raise ValueError("Maksimal urinishlar soni 1 dan 3 tagacha bo'lishi kerak")
        cfg.max_attempts = ma
    if "business_hours_only" in payload and payload["business_hours_only"] is not None:
        cfg.business_hours_only = bool(payload["business_hours_only"])
    if "start_hour" in payload and payload["start_hour"] is not None:
        sh = int(payload["start_hour"])
        if sh < 0 or sh > 23:
            raise ValueError("Boshlanish soati 0..23 oralig'ida bo'lishi kerak")
        cfg.start_hour = sh
    if "end_hour" in payload and payload["end_hour"] is not None:
        eh = int(payload["end_hour"])
        if eh < 0 or eh > 23:
            raise ValueError("Tugash soati 0..23 oralig'ida bo'lishi kerak")
        cfg.end_hour = eh
    if "offer_discount_pct" in payload and payload["offer_discount_pct"] is not None:
        pct = int(payload["offer_discount_pct"])
        if pct < 0 or pct > 30:
            raise ValueError("Chegirma foizi 0% dan 30% gacha bo'lishi kerak")
        cfg.offer_discount_pct = pct
    if "custom_template" in payload and payload["custom_template"] is not None:
        cfg.custom_template = str(payload["custom_template"]).strip()[:1000] or None
    await db.flush()
    return cfg


def build_followup_message(
    *,
    customer_name: str,
    last_customer_question: str,
    cfg: StoreFollowupConfig,
) -> str:
    """Build a polite, personalized follow-up message with optional discount highlight."""
    clean_name = (customer_name or "Mijoz").strip() or "Mijoz"
    topic = (last_customer_question or "mahsulotlarimiz").strip().replace("\n", " ")[:80]

    if cfg.custom_template and cfg.custom_template.strip():
        msg = cfg.custom_template.strip()
        msg = msg.replace("{customer_name}", clean_name).replace("{product}", topic)
        if cfg.offer_discount_pct > 0 and "{discount}" in msg:
            msg = msg.replace("{discount}", f"{cfg.offer_discount_pct}%")
        elif cfg.offer_discount_pct > 0 and str(cfg.offer_discount_pct) not in msg:
            msg += f"\n🎁 Bugungi buyurtma uchun maxsus {cfg.offer_discount_pct}% chegirma taqdim eta olamiz!"
        return msg[:1500]

    discount_line = (
        f"\n🎁 Siz uchun bugungi xaridga maxsus {cfg.offer_discount_pct}% chegirma ham ajrata olamiz!"
        if cfg.offer_discount_pct > 0
        else ""
    )
    return (
        f"Assalomu alaykum, {clean_name}! 😊\n"
        f"Avvalroq \"{topic}\" bo'yicha qiziqqan edingiz. "
        f"Agar qo'shimcha savollaringiz bo'lsa yoki buyurtmani rasmiylashtirmoqchi bo'lsangiz, "
        f"mamnuniyat bilan yordam beramiz.{discount_line}"
    )


async def find_followup_candidates(
    db: AsyncSession,
    *,
    organization_id: int,
    cfg: StoreFollowupConfig,
    now_utc: datetime | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Find silent ai_active conversations eligible for Smart Follow-up without sending."""
    now = now_utc or datetime.now(timezone.utc)
    cutoff_latest = now - timedelta(hours=max(1, int(cfg.delay_hours)))
    cutoff_oldest = now - timedelta(days=7)

    conv_rows = (
        await db.execute(
            select(Conversation)
            .where(
                Conversation.organization_id == organization_id,
                Conversation.status == "ai_active",
                Conversation.last_message_at <= cutoff_latest,
                Conversation.last_message_at >= cutoff_oldest,
            )
            .order_by(Conversation.last_message_at.desc())
            .limit(max(limit * 3, 30))
        )
    ).scalars().all()

    if not conv_rows:
        return []

    candidates: list[dict[str, Any]] = []
    for conv in conv_rows:
        if len(candidates) >= limit:
            break

        bc = await db.get(BusinessConnection, conv.business_connection_id)
        if not bc or not bc.is_enabled or not (bc.rights or {}).get("can_reply", False):
            continue

        # Skip conversations that already have an order
        has_order = (
            await db.execute(
                select(Order.id)
                .where(
                    Order.organization_id == organization_id,
                    Order.conversation_id == conv.id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if has_order is not None:
            continue

        last_cust_msg = (
            await db.execute(
                select(Message)
                .where(
                    Message.conversation_id == conv.id,
                    Message.direction == "customer",
                )
                .order_by(Message.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if not last_cust_msg:
            continue

        last_cust_at = _ensure_aware(last_cust_msg.created_at) or now
        logs_since_customer_stmt = select(FollowupLog).where(
            FollowupLog.organization_id == organization_id,
            FollowupLog.conversation_id == conv.id,
            FollowupLog.status == "sent",
            FollowupLog.sent_at >= last_cust_at,
        ).order_by(FollowupLog.sent_at.desc())
        logs_since = list((await db.execute(logs_since_customer_stmt)).scalars().all())
        if len(logs_since) >= int(cfg.max_attempts):
            continue

        if logs_since:
            last_sent_at = _ensure_aware(logs_since[0].sent_at) or now
            if last_sent_at > now - timedelta(hours=max(1, int(cfg.delay_hours))):
                continue

        last_msg_ts = _ensure_aware(conv.last_message_at) or now
        hours_silent = round((now - last_msg_ts).total_seconds() / 3600.0, 1)
        suggested_msg = build_followup_message(
            customer_name=conv.customer_name,
            last_customer_question=last_cust_msg.text,
            cfg=cfg,
        )

        candidates.append({
            "conversation": conv,
            "conversation_id": conv.id,
            "customer_name": conv.customer_name,
            "username": conv.username,
            "chat_id": conv.chat_id,
            "hours_silent": hours_silent,
            "attempt_number": len(logs_since) + 1,
            "suggested_message": suggested_msg,
        })

    return candidates


def _get_org_telegram(org: Organization | None):
    bot_token = org.decrypted_bot_token if org else None
    if bot_token:
        try:
            return get_telegram_service(bot_token)
        except Exception:
            pass
    return telegram


async def run_org_followups(
    db: AsyncSession,
    *,
    organization_id: int,
    dry_run: bool = False,
    ignore_business_hours: bool = False,
    now_utc: datetime | None = None,
    limit: int = 10,
) -> dict[str, Any]:
    """Evaluate and optionally dispatch Smart Follow-up messages for a single organization."""
    now = now_utc or datetime.now(timezone.utc)
    cfg = await get_or_create_followup_config(db, organization_id)

    if not dry_run and not ignore_business_hours and not is_within_business_hours(
        now,
        business_hours_only=cfg.business_hours_only,
        start_hour=cfg.start_hour,
        end_hour=cfg.end_hour,
    ):
        return {
            "ok": True,
            "dry_run": False,
            "skipped_reason": "outside_business_hours",
            "candidates_count": 0,
            "sent_count": 0,
            "items": [],
        }

    candidates = await find_followup_candidates(
        db,
        organization_id=organization_id,
        cfg=cfg,
        now_utc=now,
        limit=limit,
    )

    if dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "within_business_hours": is_within_business_hours(
                now,
                business_hours_only=cfg.business_hours_only,
                start_hour=cfg.start_hour,
                end_hour=cfg.end_hour,
            ),
            "candidates_count": len(candidates),
            "sent_count": 0,
            "items": [
                {
                    "conversation_id": c["conversation_id"],
                    "customer_name": c["customer_name"],
                    "username": c["username"],
                    "hours_silent": c["hours_silent"],
                    "attempt_number": c["attempt_number"],
                    "suggested_message": c["suggested_message"],
                }
                for c in candidates
            ],
        }

    org = await db.get(Organization, organization_id)
    tg_svc = _get_org_telegram(org)
    sent_items: list[dict[str, Any]] = []
    sent_count = 0

    for cand in candidates:
        conv: Conversation = cand["conversation"]
        conv_id = conv.id
        conv_customer_name = conv.customer_name
        text = cand["suggested_message"]
        attempt_num = cand["attempt_number"]
        try:
            if not tg_svc:
                raise RuntimeError("Telegram service sozlanmagan")
            sent = await tg_svc.send_business_text(conv.business_connection_id, conv.chat_id, text)
            msg_id = int(sent.get("message_id", 0)) if isinstance(sent, dict) else 0
            db.add(
                Message(
                    organization_id=organization_id,
                    conversation_id=conv_id,
                    telegram_message_id=msg_id,
                    direction="assistant",
                    text=text,
                )
            )
            conv.last_message_at = now
            db.add(
                FollowupLog(
                    organization_id=organization_id,
                    conversation_id=conv_id,
                    attempt_number=attempt_num,
                    message_text=text,
                    status="sent",
                    sent_at=now,
                )
            )
            db.add(
                AuditLog(
                    organization_id=organization_id,
                    action="followup.sent",
                    resource="conversation",
                    resource_id=str(conv_id),
                    metadata_json={"customer_name": conv_customer_name, "attempt": attempt_num},
                )
            )
            await db.commit()
            sent_count += 1
            sent_items.append({
                "conversation_id": conv_id,
                "customer_name": conv_customer_name,
                "attempt_number": attempt_num,
                "status": "sent",
            })
            await publish_event(
                organization_id,
                "message.created",
                {
                    "conversation_id": conv_id,
                    "direction": "assistant",
                    "text": text,
                    "customer_name": conv_customer_name,
                },
            )
        except Exception as exc:
            await db.rollback()
            logger.warning("Smart follow-up failed for org=%s conv=%s: %s", organization_id, conv_id, exc)
            db.add(
                FollowupLog(
                    organization_id=organization_id,
                    conversation_id=conv_id,
                    attempt_number=attempt_num,
                    message_text=text,
                    status="failed",
                    error_message=str(exc)[:400],
                    sent_at=now,
                )
            )
            await db.commit()
            sent_items.append({
                "conversation_id": conv_id,
                "customer_name": conv_customer_name,
                "attempt_number": attempt_num,
                "status": "failed",
                "error": str(exc)[:180],
            })

    return {
        "ok": True,
        "dry_run": False,
        "candidates_count": len(candidates),
        "sent_count": sent_count,
        "items": sent_items,
    }


async def run_all_enabled_followups(db: AsyncSession) -> int:
    """Scheduled sweep iterating every active organization with Smart Follow-up enabled."""
    rows = (
        await db.execute(
            select(StoreFollowupConfig.organization_id)
            .join(Organization, Organization.id == StoreFollowupConfig.organization_id)
            .where(
                StoreFollowupConfig.is_enabled == True,  # noqa: E712
                Organization.status == "active",
            )
        )
    ).scalars().all()

    total_sent = 0
    for org_id in rows:
        res = await run_org_followups(db, organization_id=int(org_id), dry_run=False, limit=10)
        total_sent += int(res.get("sent_count", 0))
    return total_sent
