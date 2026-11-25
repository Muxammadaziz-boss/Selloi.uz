import asyncio
from collections import OrderedDict
import hmac
import secrets
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.bot_commands import handle_callback_query, handle_private_command
from app.core.config import settings
from app.core.db import SessionLocal, get_db
from app.core.logging import get_logger
from app.models import BusinessConnection, ConnectedChannel, Conversation, Message, Order, Organization
from app.services import settings_service
from app.services.ai import sales_ai
from app.services.conversations import get_or_create_conversation, save_message
from app.services.knowledge import knowledge
from app.services.realtime import publish_event
from app.services.telegram import TelegramService, get_telegram_service, telegram

logger = get_logger(__name__)
router = APIRouter(tags=["telegram"])


def _date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


_PROCESSED_UPDATES: OrderedDict[int, float] = OrderedDict()
_PENDING_TOKENS: dict[int, tuple[float, str]] = {}
_MAX_PROCESSED_UPDATES = 10000
_UPDATE_LOCK = threading.Lock()

# Atomic Lua script for update finalization with ownership verification
TG_FINALIZE_LUA = """
local val = redis.call('GET', KEYS[1])
if not val then
    return 0
end
if val == ARGV[1] or val == "pending:" .. ARGV[1] then
    if ARGV[2] == "completed" then
        redis.call('SET', KEYS[1], "completed", "EX", tonumber(ARGV[3]))
        return 1
    else
        redis.call('DEL', KEYS[1])
        return 1
    end
else
    return 0
end
"""

# Atomic Lua script for lease renewal
TG_RENEW_LEASE_LUA = """
local val = redis.call('GET', KEYS[1])
if val == ARGV[1] or val == "pending:" .. ARGV[1] then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
    return 1
else
    return 0
end
"""


def reserve_update(update_id: int | None, lease_seconds: int = 60) -> tuple[bool, str | None]:
    """Atomically reserve update_id with an ownership token and bounded lease.

    Returns:
        (is_duplicate: bool, owner_token: str | None)
        - If is_duplicate is True, the update is already processed or actively being processed.
        - If is_duplicate is False, caller holds the lease identified by owner_token.
    """
    if update_id is None:
        return False, None

    owner_token = uuid.uuid4().hex
    key = f"tg_update:{update_id}"

    # 1. Check distributed Redis lock / status across all Uvicorn processes
    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            current = r.get(key)
            if current == "completed":
                return True, None
            if current and current.startswith("pending:"):
                # Active reservation held by another worker
                return True, None

            # Acquire atomic reservation with bounded lease (default 60s, NOT indefinite or 15m)
            # If worker crashes, lease expires in 60s allowing safe recovery without losing updates
            acquired = r.set(key, f"pending:{owner_token}", nx=True, ex=lease_seconds)
            if not acquired:
                return True, None
            return False, owner_token
    except Exception:
        pass

    # 2. Thread-safe in-memory fallback with ownership tracking
    with _UPDATE_LOCK:
        now = time.time()
        # Clean expired in-memory items based on their individual stored expiration
        expired_pending = [uid for uid, (exp, _) in _PENDING_TOKENS.items() if now >= exp]
        for uid in expired_pending:
            _PENDING_TOKENS.pop(uid, None)

        while _PROCESSED_UPDATES and now - next(iter(_PROCESSED_UPDATES.values())) > 900:
            _PROCESSED_UPDATES.popitem(last=False)

        if update_id in _PROCESSED_UPDATES:
            return True, None
        if update_id in _PENDING_TOKENS:
            return True, None

        _PENDING_TOKENS[update_id] = (now + lease_seconds, owner_token)
        return False, owner_token


def is_duplicate_update(update_id: int | None) -> bool:
    """Backward-compatible wrapper around reserve_update."""
    is_dup, _ = reserve_update(update_id)
    return is_dup


def finalize_update(
    update_id: int | None,
    owner_token: str | None = None,
    success: bool = True,
) -> bool:
    """Mark update as completed, or release lock on failure, strictly verifying ownership.

    Safety Rules:
    1. A worker must not release another worker's reservation.
    2. A worker must not finalize an update it does not own.
    3. Failed processing must remain retryable.
    """
    if update_id is None:
        return False

    key = f"tg_update:{update_id}"
    finalized = False

    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            if owner_token is not None:
                res = r.eval(
                    TG_FINALIZE_LUA,
                    1,
                    key,
                    owner_token,
                    "completed" if success else "release",
                    900,
                )
                finalized = bool(res == 1)
            else:
                if success:
                    r.set(key, "completed", ex=900)
                    finalized = True
                else:
                    val = r.get(key)
                    if val and not val.startswith("pending:"):
                        r.delete(key)
                        finalized = True
    except Exception:
        pass

    with _UPDATE_LOCK:
        now = time.time()
        pending_info = _PENDING_TOKENS.get(update_id)
        if pending_info is not None:
            _, existing_owner = pending_info
            if owner_token is None or existing_owner == owner_token:
                _PENDING_TOKENS.pop(update_id, None)
                if success:
                    _PROCESSED_UPDATES[update_id] = now
                    if len(_PROCESSED_UPDATES) > _MAX_PROCESSED_UPDATES:
                        _PROCESSED_UPDATES.popitem(last=False)
                finalized = True
        else:
            if success:
                _PROCESSED_UPDATES[update_id] = now
                finalized = True

    return finalized


def renew_update_lease(
    update_id: int | None,
    owner_token: str | None,
    extend_seconds: int = 60,
) -> bool:
    """Extend the reservation lease for long-running processing while ownership holds."""
    if update_id is None or not owner_token:
        return False

    key = f"tg_update:{update_id}"
    try:
        from app.core.rate_limit import limiter
        r = limiter._get_redis()
        if r is not None:
            res = r.eval(TG_RENEW_LEASE_LUA, 1, key, owner_token, extend_seconds)
            return bool(res == 1)
    except Exception:
        pass

    with _UPDATE_LOCK:
        if update_id in _PENDING_TOKENS:
            _, existing_owner = _PENDING_TOKENS[update_id]
            if existing_owner == owner_token:
                _PENDING_TOKENS[update_id] = (time.time() + extend_seconds, owner_token)
                return True
    return False


def _clean_channel_username(raw: str) -> str:
    raw = (raw or "").strip()
    for prefix in ("https://t.me/", "http://t.me/", "t.me/", "@"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
    return raw.strip("/").strip()


async def _store_channel_post(message: dict) -> None:
    chat = message.get("chat", {})
    username = (chat.get("username") or "").lstrip("@")
    if not username:
        return
    async with SessionLocal() as db:
        active_channels = await settings_service.get_active_channel_usernames(db)
        if not active_channels or username.lower() not in [c.lower() for c in active_channels]:
            return
        chan_row = (await db.execute(select(ConnectedChannel).where(ConnectedChannel.channel_username == username.lower()))).scalar_one_or_none()
        if not chan_row or not chan_row.organization_id:
            return
        org_id = chan_row.organization_id
        org = await db.get(Organization, org_id) if org_id else None
        org_token = org.decrypted_bot_token if org else None
        try:
            tg_svc = get_telegram_service(org_token)
        except Exception:
            tg_svc = telegram

        text = message.get("text") or message.get("caption") or ""
        photos = message.get("photo") or []
        file_id = photos[-1].get("file_id") if photos else None
        photo_bytes = None
        mime = "image/jpeg"
        if file_id and tg_svc:
            try:
                safe_name = "".join(c for c in username if c.isalnum() or c in "-_") or "channel"
                dest = Path(settings.storage_dir) / "incoming_tmp" / f"{safe_name}_{message.get('message_id')}.jpg"
                await tg_svc.download_photo(file_id, dest)
                photo_bytes = dest.read_bytes()
                dest.unlink(missing_ok=True)
            except Exception:
                logger.exception("Kanal post rasmini yuklab olishda xatolik: post=%s", message.get('message_id'))
                photo_bytes = None
        await knowledge.upsert_post(
            db,
            channel_username=username,
            telegram_message_id=int(message["message_id"]),
            text=text,
            posted_at=datetime.fromtimestamp(message["date"], timezone.utc) if message.get("date") else None,
            source_url=f"https://t.me/{username}/{message['message_id']}",
            photo_file_id=file_id,
            photo_bytes=photo_bytes,
            photo_mime_type=mime,
            organization_id=org_id,
        )
        await db.commit()


async def _typing_loop(chat_id: int, connection_id: str | None, stop_event: asyncio.Event, tg_svc: TelegramService | None = None) -> None:
    svc = tg_svc or telegram
    if not svc:
        return
    while not stop_event.is_set():
        try:
            await svc.send_chat_action(chat_id, "typing", business_connection_id=connection_id)
            await asyncio.wait_for(stop_event.wait(), timeout=4.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
        except Exception:
            break


async def _handle_business_message(message: dict, db: AsyncSession | None = None) -> None:
    from contextlib import nullcontext
    connection_id = message.get("business_connection_id")
    chat = message.get("chat", {})
    sender = message.get("from") or {}
    if not connection_id or chat.get("type") != "private":
        return

    chat_id_int = int(chat["id"])
    msg_id_int = int(message.get("message_id", 0))

    # Real human customer check
    if message.get("sender_business_bot") or sender.get("is_bot"):
        return

    session_ctx = nullcontext(db) if db is not None else SessionLocal()
    async with session_ctx as session:
        connection = await session.get(BusinessConnection, connection_id)
        if connection is None or not connection.is_enabled:
            return

        if not connection.organization_id:
            logger.warning("BusinessConnection without organization_id: id=%s", connection_id)
            return

        org_id = connection.organization_id
        org = await session.get(Organization, org_id) if org_id else None
        org_token = org.decrypted_bot_token if org else None
        try:
            tg_svc = get_telegram_service(org_token)
        except Exception:
            tg_svc = telegram

        # Immediately mark message as READ (turns single checkmark into double checkmark ✓✓)
        # and show typing indicator right away (ephemeral UI fire-and-forget effects)
        if msg_id_int and tg_svc:
            async def _safe_ephemeral(coro):
                try:
                    await coro
                except Exception:
                    pass
            asyncio.create_task(_safe_ephemeral(tg_svc.read_business_message(connection_id, chat_id_int, msg_id_int)))
            asyncio.create_task(_safe_ephemeral(tg_svc.send_chat_action(chat_id_int, "typing", business_connection_id=connection_id)))

        # A real account-owner reply means the human has taken over this chat.
        if sender.get("id") and connection.owner_user_id == int(sender["id"]):
            result = await session.execute(select(Conversation).where(
                Conversation.business_connection_id == connection_id,
                Conversation.chat_id == chat_id_int,
            ))
            conversation = result.scalar_one_or_none()
            if conversation:
                admin_msg_text = message.get("text") or message.get("caption") or "[Admin xabari]"
                conversation.status = "human_takeover"
                conversation.handoff_reason = "Admin Telegram chatida javob berdi"
                conversation.last_message_at = datetime.now(timezone.utc)
                await save_message(
                    session,
                    conversation_id=conversation.id,
                    telegram_message_id=msg_id_int,
                    direction="admin",
                    text=admin_msg_text,
                    organization_id=org_id,
                )
                if db is None:
                    await session.commit()
                else:
                    await session.flush()
                await publish_event(
                    org_id,
                    "message.created",
                    {
                        "conversation_id": conversation.id,
                        "direction": "admin",
                        "text": admin_msg_text,
                        "customer_name": conversation.customer_name,
                        "status": conversation.status,
                    },
                )
                await publish_event(
                    org_id,
                    "conversation.updated",
                    {
                        "conversation_id": conversation.id,
                        "status": conversation.status,
                        "handoff_reason": conversation.handoff_reason,
                        "customer_name": conversation.customer_name,
                    },
                )
            return

        first_name = sender.get("first_name", "")
        last_name = sender.get("last_name", "")
        customer_name = f"{first_name} {last_name}".strip() or "Mijoz"
        incoming_text = message.get("text") or message.get("caption") or ""

        from app.services.durable_inbox import (
            generate_order_idempotency_key,
            generate_outbox_idempotency_key,
            get_or_create_idempotent_order,
            stage_outbox_event,
        )

        if not (connection.rights or {}).get("can_reply", False):
            conversation = await get_or_create_conversation(
                session,
                business_connection_id=connection_id,
                chat_id=chat_id_int,
                customer_name=customer_name,
                username=sender.get("username"),
                organization_id=org_id,
            )
            await save_message(
                session,
                conversation_id=conversation.id,
                telegram_message_id=msg_id_int,
                direction="customer",
                text=incoming_text or "[Matn bo'lmagan xabar]",
                organization_id=org_id,
            )
            conversation.status = "human_takeover"
            conversation.handoff_reason = "Telegram Business ulanishida can_reply huquqi yo'q"

            outbox_key = generate_outbox_idempotency_key(
                event_type="notify_admin",
                organization_id=org_id,
                entity_id=f"can_reply_missing_{connection_id}_{chat_id_int}_{msg_id_int}",
            )
            await stage_outbox_event(
                session,
                idempotency_key=outbox_key,
                event_type="notify_admin",
                payload={"text": f"⚠️ Business botda can_reply huquqi yo'q\nMijoz: {customer_name}\nChat ID: {chat['id']}"},
                organization_id=org_id,
            )

            if db is None:
                await session.commit()
            else:
                await session.flush()
            await publish_event(
                org_id,
                "message.created",
                {
                    "conversation_id": conversation.id,
                    "direction": "customer",
                    "text": incoming_text or "[Matn bo'lmagan xabar]",
                    "customer_name": customer_name,
                    "status": conversation.status,
                },
            )
            await publish_event(
                org_id,
                "handoff.required",
                {
                    "conversation_id": conversation.id,
                    "customer_name": customer_name,
                    "reason": conversation.handoff_reason,
                },
            )
            return

        conversation = await get_or_create_conversation(
            session,
            business_connection_id=connection_id,
            chat_id=chat_id_int,
            customer_name=customer_name,
            username=sender.get("username"),
            organization_id=org_id,
        )
        incoming_saved = await save_message(
            session,
            conversation_id=conversation.id,
            telegram_message_id=msg_id_int,
            direction="customer",
            text=incoming_text or "[Matn bo'lmagan xabar]",
            organization_id=org_id,
        )
        conversation.last_message_at = datetime.now(timezone.utc)
        await session.flush()

        # Auto-reactivate AI unless explicitly taken over via web admin panel
        if conversation.status == "human_takeover":
            if conversation.handoff_reason == "Admin panel orqali operator qabul qildi" and not sales_ai.is_greeting(incoming_text):
                logger.info("Suhbat web admin panel orqali operator nazoratida: conversation_id=%s", conversation.id)
                if db is None:
                    await session.commit()
                else:
                    await session.flush()
                if incoming_saved is not None:
                    await publish_event(
                        org_id,
                        "message.created",
                        {
                            "conversation_id": conversation.id,
                            "direction": "customer",
                            "text": incoming_text or "[Matn bo'lmagan xabar]",
                            "customer_name": customer_name,
                            "status": conversation.status,
                        },
                    )
                return
            else:
                conversation.status = "ai_active"
                conversation.handoff_reason = None
                logger.info("AI qayta faollashtirildi: conversation_id=%s", conversation.id)

        if incoming_saved is None:
            # Telegram may retry a webhook. If this incoming message already has a reply,
            # do not send a duplicate. If it does not, continue so a transient failure can retry.
            existing_reply = await session.execute(select(Message.id).where(
                Message.conversation_id == conversation.id,
                Message.reply_to_telegram_message_id == msg_id_int,
            ).limit(1))
            if existing_reply.scalar_one_or_none() is not None:
                if db is None:
                    await session.commit()
                else:
                    await session.flush()
                return

        if not incoming_text.strip():
            conversation.status = "human_takeover"
            conversation.handoff_reason = "Mijoz matn bo'lmagan xabar yubordi; operator tekshirishi kerak"
            outbox_key = generate_outbox_idempotency_key(
                event_type="notify_admin",
                organization_id=org_id,
                entity_id=f"non_text_{connection_id}_{chat_id_int}_{msg_id_int}",
            )
            await stage_outbox_event(
                session,
                idempotency_key=outbox_key,
                event_type="notify_admin",
                payload={"text": f"🧑‍💼 Operator kerak\nMijoz: {customer_name}\nChat ID: {chat['id']}\nSabab: matn bo'lmagan xabar"},
                organization_id=org_id,
            )
            if db is None:
                await session.commit()
            else:
                await session.flush()
            await publish_event(
                org_id,
                "message.created",
                {
                    "conversation_id": conversation.id,
                    "direction": "customer",
                    "text": incoming_text or "[Matn bo'lmagan xabar]",
                    "customer_name": customer_name,
                    "status": conversation.status,
                },
            )
            await publish_event(
                org_id,
                "handoff.required",
                {
                    "conversation_id": conversation.id,
                    "customer_name": customer_name,
                    "reason": conversation.handoff_reason,
                },
            )
            return

        history_rows = (await session.execute(
            select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.desc()).limit(10)
        )).scalars().all()
        history = [{"direction": row.direction, "text": row.text} for row in reversed(history_rows)]

        stop_typing = asyncio.Event()
        typing_task = asyncio.create_task(_typing_loop(chat_id_int, connection_id, stop_typing, tg_svc=tg_svc))
        try:
            if sales_ai.is_greeting(incoming_text):
                evidence = []
                decision = await sales_ai.answer(incoming_text, evidence, history, organization_id=org_id, db=session)
            else:
                evidence = await knowledge.search(session, incoming_text, limit=6, organization_id=org_id)
                decision = await sales_ai.answer(incoming_text, evidence, history, organization_id=org_id, db=session)
        finally:
            stop_typing.set()
            typing_task.cancel()

        if decision["handoff"]:
            conversation.status = "human_takeover"
            conversation.handoff_reason = decision.get("reason") or "AI suhbatni operatorga topshirdi"
            handoff_reply = decision.get("reply") or "Savolingizni mutaxassisimizga yetkazdim. Tez orada javob beramiz."

            # 1. Stage durable customer handoff reply to transactional outbox
            handoff_outbox_key = generate_outbox_idempotency_key(
                event_type="send_business_text",
                organization_id=org_id,
                entity_id=f"handoff_reply_{connection_id}_{chat_id_int}_{msg_id_int}",
            )
            await stage_outbox_event(
                session,
                idempotency_key=handoff_outbox_key,
                event_type="send_business_text",
                payload={
                    "business_connection_id": connection_id,
                    "chat_id": chat_id_int,
                    "text": handoff_reply,
                    "conversation_id": conversation.id,
                    "reply_to_telegram_message_id": msg_id_int,
                },
                organization_id=org_id,
            )

            # 2. Stage durable operator notification to transactional outbox
            alert_text = (
                "🧑‍💼 *AI suhbatni operatorga topshirdi*\n"
                f"Mijoz: {customer_name}\n"
                f"Chat ID: `{chat['id']}`\n"
                f"Savol: {incoming_text[:600]}\n"
                f"Sabab: {conversation.handoff_reason}"
            )
            takeover_markup = {
                "inline_keyboard": [
                    [{"text": "💬 Suhbatni qabul qilish", "callback_data": f"admin:takeover:{conversation.id}"}]
                ]
            }
            alert_outbox_key = generate_outbox_idempotency_key(
                event_type="notify_organization_admins",
                organization_id=org_id,
                entity_id=f"handoff_alert_{conversation.id}_{msg_id_int}",
            )
            await stage_outbox_event(
                session,
                idempotency_key=alert_outbox_key,
                event_type="notify_organization_admins",
                payload={"text": alert_text, "reply_markup": takeover_markup},
                organization_id=org_id,
            )

            if db is None:
                await session.commit()
            else:
                await session.flush()
            await publish_event(
                org_id,
                "message.created",
                {
                    "conversation_id": conversation.id,
                    "direction": "customer",
                    "text": incoming_text or "[Matn bo'lmagan xabar]",
                    "customer_name": customer_name,
                    "status": conversation.status,
                },
            )
            await publish_event(
                org_id,
                "handoff.required",
                {
                    "conversation_id": conversation.id,
                    "customer_name": customer_name,
                    "reason": conversation.handoff_reason,
                },
            )
            return

        created_order_obj: Order | None = None
        # If AI successfully completed an order, save it and alert admin via transactional outbox
        if decision.get("order_created") and decision.get("order_data"):
            order_info = decision["order_data"]
            order_idempotency_key = generate_order_idempotency_key(
                source="biz",
                organization_id=org_id,
                connection_id=connection_id,
                chat_id=chat_id_int,
                message_id=msg_id_int,
            )
            new_order, created = await get_or_create_idempotent_order(
                session,
                idempotency_key=order_idempotency_key,
                organization_id=org_id,
                conversation_id=conversation.id,
                customer_name=order_info.get("customer_name") or customer_name,
                phone=order_info.get("phone") or "",
                product_summary=order_info.get("product_summary") or "",
                delivery_address=order_info.get("delivery_address") or "",
                status="new",
                notes=order_info.get("notes") or "",
            )
            if created:
                created_order_obj = new_order
                user_handle = f"@{conversation.username}" if conversation.username else f"ID: {chat.get('id')}"
                address_str = new_order.delivery_address or "Ko'rsatilmadi"
                order_notification = (
                    "🔥 *YANGI BUYURTMA QABUL QILINDI!*\n\n"
                    f"👤 *Mijoz:* {new_order.customer_name} ({user_handle})\n"
                    f"📞 *Telefon:* `{new_order.phone}`\n"
                    f"📍 *Manzil:* {address_str}\n"
                    f"📦 *Mahsulot:* {new_order.product_summary or 'Muloqotdan qarang'}\n"
                )
                if new_order.notes:
                    order_notification += f"💬 *Izoh:* {new_order.notes}\n"
                order_notification += (
                    f"💬 *Suhbat ID:* #{conversation.id}\n\n"
                    "⚡️ *Iltimos admin, mijoz bilan bog'laning!*"
                )
                outbox_key = generate_outbox_idempotency_key(
                    event_type="notify_organization_admins",
                    organization_id=org_id,
                    entity_id=new_order.id or order_idempotency_key,
                )
                await stage_outbox_event(
                    session,
                    idempotency_key=outbox_key,
                    event_type="notify_organization_admins",
                    payload={"text": order_notification},
                    organization_id=org_id,
                )

        # Stage durable customer reply (photo or text) into transactional outbox
        photo_staged = False
        if decision.get("attach_photo") and decision.get("source_post_id") is not None:
            selected_post = next((post for post in evidence if post.telegram_message_id == decision["source_post_id"]), None)
            if selected_post and (selected_post.photo_file_id or selected_post.image_path):
                photo_key = generate_outbox_idempotency_key(
                    event_type="send_business_photo",
                    organization_id=org_id,
                    entity_id=f"biz_photo_{connection_id}_{chat_id_int}_{msg_id_int}",
                )
                await stage_outbox_event(
                    session,
                    idempotency_key=photo_key,
                    event_type="send_business_photo",
                    payload={
                        "business_connection_id": connection_id,
                        "chat_id": chat_id_int,
                        "photo_file_id": selected_post.photo_file_id,
                        "photo_path": selected_post.image_path,
                        "caption": decision["reply"],
                        "conversation_id": conversation.id,
                        "reply_to_telegram_message_id": msg_id_int,
                    },
                    organization_id=org_id,
                )
                photo_staged = True

        if not photo_staged:
            reply_key = generate_outbox_idempotency_key(
                event_type="send_business_text",
                organization_id=org_id,
                entity_id=f"biz_text_{connection_id}_{chat_id_int}_{msg_id_int}",
            )
            await stage_outbox_event(
                session,
                idempotency_key=reply_key,
                event_type="send_business_text",
                payload={
                    "business_connection_id": connection_id,
                    "chat_id": chat_id_int,
                    "text": decision["reply"],
                    "conversation_id": conversation.id,
                    "reply_to_telegram_message_id": msg_id_int,
                },
                organization_id=org_id,
            )

        if db is None:
            await session.commit()
        else:
            await session.flush()

        if incoming_saved is not None:
            await publish_event(
                org_id,
                "message.created",
                {
                    "conversation_id": conversation.id,
                    "direction": "customer",
                    "text": incoming_text or "[Matn bo'lmagan xabar]",
                    "customer_name": customer_name,
                    "status": conversation.status,
                },
            )
        if created_order_obj is not None:
            await publish_event(
                org_id,
                "order.created",
                {
                    "order_id": created_order_obj.id,
                    "conversation_id": conversation.id,
                    "customer_name": created_order_obj.customer_name,
                    "product_summary": created_order_obj.product_summary,
                    "status": created_order_obj.status,
                },
            )


async def _handle_direct_bot_message(message: dict, db: AsyncSession, organization_id: int | None = None) -> None:
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    sender = message.get("from") or {}
    text = (message.get("text") or message.get("caption") or "").strip()
    if not chat_id or not text:
        return

    first_name = sender.get("first_name", "")
    last_name = sender.get("last_name", "")
    customer_name = f"{first_name} {last_name}".strip() or "Mijoz"

    chat_id_int = int(chat_id)
    tg_svc = telegram
    try:
        if not tg_svc:
            tg_svc = get_telegram_service()
    except Exception:
        tg_svc = None

    stop_typing = asyncio.Event()
    typing_task = asyncio.create_task(_typing_loop(chat_id_int, None, stop_typing, tg_svc=tg_svc))
    try:
        if sales_ai.is_greeting(text):
            evidence = []
            decision = await sales_ai.answer(text, evidence, [], organization_id=1, db=db)
        else:
            evidence = await knowledge.search(db, text, limit=6, organization_id=1)
            decision = await sales_ai.answer(text, evidence, [], organization_id=1, db=db)
    finally:
        stop_typing.set()
        typing_task.cancel()

    from app.services.durable_inbox import (
        generate_order_idempotency_key,
        generate_outbox_idempotency_key,
        get_or_create_idempotent_order,
        stage_outbox_event,
    )

    # Stage durable customer reply (photo or text) into transactional outbox
    photo_staged = False
    if decision.get("attach_photo") and decision.get("source_post_id") is not None:
        selected_post = next((post for post in evidence if post.telegram_message_id == decision["source_post_id"]), None)
        if selected_post and selected_post.photo_file_id:
            photo_key = generate_outbox_idempotency_key(
                event_type="send_photo",
                organization_id=organization_id,
                entity_id=f"direct_photo_{chat_id_int}_{message.get('message_id', 0)}",
            )
            await stage_outbox_event(
                db,
                idempotency_key=photo_key,
                event_type="send_photo",
                payload={
                    "chat_id": chat_id,
                    "photo": selected_post.photo_file_id,
                    "caption": decision["reply"][:1024],
                },
                organization_id=organization_id,
            )
            photo_staged = True

    if not photo_staged:
        msg_key = generate_outbox_idempotency_key(
            event_type="send_message",
            organization_id=organization_id,
            entity_id=f"direct_text_{chat_id_int}_{message.get('message_id', 0)}",
        )
        await stage_outbox_event(
            db,
            idempotency_key=msg_key,
            event_type="send_message",
            payload={
                "chat_id": chat_id,
                "text": decision["reply"],
            },
            organization_id=organization_id,
        )

    # If order was created in direct bot chat, notify admin via transactional outbox
    if decision.get("order_created") and decision.get("order_data"):
        order_info = decision["order_data"]
        direct_msg_id = message.get("message_id", 0)
        order_idempotency_key = generate_order_idempotency_key(
            source="direct",
            organization_id=organization_id,
            bot_id="direct",
            chat_id=chat_id,
            message_id=direct_msg_id,
        )
        new_order, created = await get_or_create_idempotent_order(
            db,
            idempotency_key=order_idempotency_key,
            organization_id=organization_id,
            customer_name=order_info.get("customer_name") or customer_name,
            phone=order_info.get("phone") or "",
            product_summary=order_info.get("product_summary") or "",
            delivery_address=order_info.get("delivery_address") or "",
            status="new",
            notes=f"Telegram bot chatidan (@{sender.get('username') or ''}, ID: {chat_id})",
        )
        if created:
            order_notification = (
                "🎉 YANGI BUYURTMA (Bot chatidan)!\n\n"
                f"👤 Mijoz: {new_order.customer_name}\n"
                f"📞 Telefon: {new_order.phone or 'Kiritilmadi'}\n"
                f"📍 Manzil: {new_order.delivery_address or 'Kiritilmadi'}\n"
                f"💻 Mahsulot: {new_order.product_summary or 'Aniqlashtirilmoqda'}\n"
                f"💬 Chat: @{sender.get('username') or ''} (ID: {chat_id})\n\n"
                "Iltimos, admin mijoz bilan bog'laning!"
            )
            outbox_key = generate_outbox_idempotency_key(
                event_type="notify_admin",
                organization_id=organization_id,
                entity_id=new_order.id or order_idempotency_key,
            )
            await stage_outbox_event(
                db,
                idempotency_key=outbox_key,
                event_type="notify_admin",
                payload={"text": order_notification},
                organization_id=organization_id,
            )
            await publish_event(
                organization_id,
                "order.created",
                {
                    "order_id": new_order.id,
                    "customer_name": new_order.customer_name,
                    "product_summary": new_order.product_summary,
                    "status": new_order.status,
                },
            )


@router.post("/telegram/webhook")
@router.post("/telegram/webhook/{org_slug}")
async def telegram_webhook(
    request: Request,
    org_slug: str | None = None,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    # 1. Resolve expected secret (organization-specific or global)
    expected = None
    if org_slug:
        async with SessionLocal() as db:
            org_row = (await db.execute(select(Organization).where(Organization.slug == org_slug))).scalar_one_or_none()
            if org_row and org_row.webhook_secret:
                expected = org_row.webhook_secret
    if not expected:
        expected = settings.telegram_webhook_secret

    # 2. Fail closed in production if secret is not configured
    if settings.is_production and not expected:
        logger.error("TELEGRAM_WEBHOOK_SECRET is not configured in production; failing closed")
        raise HTTPException(
            status_code=500,
            detail="Webhook configuration error in production",
        )

    # 3. Strict webhook secret token validation when secret is configured
    if expected:
        if not x_telegram_bot_api_secret_token:
            logger.warning("Telegram webhook request missing X-Telegram-Bot-Api-Secret-Token header")
            raise HTTPException(
                status_code=401,
                detail="Missing Telegram webhook secret token",
            )
        if not secrets.compare_digest(expected, x_telegram_bot_api_secret_token):
            logger.warning("Telegram webhook request provided invalid secret token")
            raise HTTPException(
                status_code=401,
                detail="Invalid Telegram webhook secret token",
            )

    try:
        update = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if not isinstance(update, dict):
        raise HTTPException(status_code=400, detail="Malformed payload: expected JSON object")

    update_id = update.get("update_id")
    if update_id is None or not isinstance(update_id, int):
        raise HTTPException(status_code=400, detail="Malformed payload: valid integer update_id required")

    # 1. Resolve organization tenancy
    org_id = None
    if org_slug:
        async with SessionLocal() as db:
            org_row = (await db.execute(select(Organization).where(Organization.slug == org_slug))).scalar_one_or_none()
            if org_row:
                org_id = org_row.id

    bot_id = f"org_{org_id}" if org_id else "default"

    # 2. Durable PostgreSQL inbox persistence BEFORE HTTP 200 acknowledgment
    # No in-memory/Redis reservation is allowed to gatekeeper or suppress retries before DB commit.
    inbox_item = None
    try:
        async with SessionLocal() as db:
            from app.services.durable_inbox import record_inbox_update
            inbox_item, db_is_duplicate = await record_inbox_update(
                db,
                bot_id=bot_id,
                update_id=int(update_id),
                payload=update,
                organization_id=org_id,
            )
            if db_is_duplicate:
                logger.info("Takroriy update_id chetlab o'tildi (db inbox): bot_id=%s update_id=%s", bot_id, update_id)
                return {"ok": True, "duplicate": True}
    except Exception as e:
        logger.error("Durable inbox commit failed: bot_id=%s update_id=%s error=%s", bot_id, update_id, e)
        raise HTTPException(
            status_code=503,
            detail="Durable webhook storage temporarily unavailable",
        )

    # 3. Asynchronous execution & acknowledgment
    # The update is now durably persisted in PostgreSQL.
    # If persistent background workers are disabled (e.g. lightweight single-process dev),
    # process the job asynchronously in background.
    try:
        if not settings.is_testing and not getattr(settings, "run_background_workers", False):
            if inbox_item:
                from app.services.durable_inbox import process_single_inbox_job
                asyncio.create_task(process_single_inbox_job(inbox_item.id))
            else:
                asyncio.create_task(execute_update_payload(update, organization_id=org_id))

        return {"ok": True}
    except Exception as e:
        logger.exception("Xatolik yuz berdi update_id=%s: %s", update_id, e)
        raise


async def execute_update_payload(
    update: dict,
    db: AsyncSession | None = None,
    organization_id: int | None = None,
) -> None:
    """Execute update business logic across channels, messages, commands, and callback queries."""
    from contextlib import nullcontext
    if update.get("business_connection"):
        data = update["business_connection"]
        conn_id = data.get("id")
        if conn_id:
            ctx = nullcontext(db) if db is not None else SessionLocal()
            async with ctx as session:
                row = await session.get(BusinessConnection, conn_id)
                if row is None:
                    row = BusinessConnection(id=conn_id)
                    session.add(row)
                if organization_id:
                    row.organization_id = organization_id
                row.owner_user_id = (data.get("user") or {}).get("id")
                row.is_enabled = bool(data.get("is_enabled", False))
                row.rights = data.get("rights") or {}
                if db is None:
                    await session.commit()
                else:
                    await session.flush()
    elif update.get("channel_post"):
        await _store_channel_post(update["channel_post"])
    elif update.get("edited_channel_post"):
        await _store_channel_post(update["edited_channel_post"])
    elif update.get("business_message"):
        await _handle_business_message(update["business_message"], db=db)
    elif update.get("edited_business_message"):
        # Edited customer messages are saved as context in a future iteration; do not auto-reply twice.
        pass
    elif update.get("message"):
        msg = update["message"]
        chat = msg.get("chat", {})
        if chat.get("type") == "private":
            await _process_private_message(msg, db=db, organization_id=organization_id)
    elif update.get("callback_query"):
        cb = update["callback_query"]
        ctx = nullcontext(db) if db is not None else SessionLocal()
        async with ctx as session:
            await handle_callback_query(cb, session)
            if db is None:
                await session.commit()
            else:
                await session.flush()


async def _process_private_message(
    msg: dict,
    db: AsyncSession | None = None,
    organization_id: int | None = None,
) -> None:
    try:
        from contextlib import nullcontext
        ctx = nullcontext(db) if db is not None else SessionLocal()
        async with ctx as session:
            handled = await handle_private_command(msg, session)
            if not handled:
                await _handle_direct_bot_message(msg, session, organization_id=organization_id)
                if db is None:
                    await session.commit()
    except Exception:
        logger.exception("Xususiy xabarni qayta ishlashda xatolik")


@router.post("/webhooks/tezcheck")
@router.post("/billing/tezcheck/webhook")
async def tezcheck_webhook_root_alias(
    request: Request,
    x_tezcheck_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """TezCheck webhook alias on root router."""
    from app.api.saas import tezcheck_webhook
    return await tezcheck_webhook(request, x_tezcheck_signature, db)

