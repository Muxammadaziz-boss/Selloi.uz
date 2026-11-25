import asyncio
from datetime import datetime, timezone
import hmac
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.db import get_db
from app.core.permissions import ALL_PERMISSIONS, ROLE_DEFAULTS
from app.core.rate_limit import require_rate_limit
from app.dependencies.auth import decode_access_token, get_current_admin
from app.dependencies.tenant import get_admin_tenant_id
from app.models import (
    Admin,
    AuditLog,
    ChannelPost,
    ConnectedChannel,
    Conversation,
    Customer,
    Message,
    Order,
    Organization,
    OrganizationMember,
    Product,
    StoreFollowupConfig,
    StoreOrderPayment,
    StorePaymentConfig,
    FollowupLog,
    SystemSetting,
    User,
)
from app.schemas import (
    AdminCreate,
    AdminOut,
    AdminReply,
    AdminUpdatePermission,
    AdminUpdateRole,
    ChannelCreate,
    ChannelVerifyRequest,
    ChannelOut,
    ChannelSyncRequest,
    SettingUpdate,
    StatusUpdate,
)
from app.services import admin_service, settings_service
from app.services.realtime import format_sse, publish_event, realtime_hub
from app.services.telegram import TelegramAPIError, get_telegram_service, telegram

router = APIRouter(prefix="/admin", tags=["admin"])


def require_permission(perm: str):
    async def dependency(current_admin: Admin = Depends(get_current_admin)) -> Admin:
        if not admin_service.has_permission(current_admin, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sizda ushbu amal uchun ruxsat yo'q: {perm}",
            )
        return current_admin
    return dependency


async def require_admin(current_admin: Admin = Depends(get_current_admin)) -> Admin:
    return current_admin


@router.get("/me")
async def current_admin_info(
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
):
    return {
        "id": current_admin.id,
        "organization_id": org_id,
        "telegram_user_id": current_admin.telegram_user_id,
        "name": current_admin.name,
        "username": current_admin.username,
        "role": current_admin.role,
        "permissions": current_admin.permissions,
        "is_active": current_admin.is_active,
    }


@router.get("/overview")
async def overview(
    db: AsyncSession = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
):
    conversations = await db.scalar(
        select(func.count(Conversation.id)).where(Conversation.organization_id == org_id)
    ) or 0
    active = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.organization_id == org_id,
            Conversation.status == "ai_active",
        )
    ) or 0
    handoff = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.organization_id == org_id,
            Conversation.status == "human_takeover",
        )
    ) or 0
    posts = await db.scalar(
        select(func.count(ChannelPost.id)).where(ChannelPost.organization_id == org_id)
    ) or 0
    orders = await db.scalar(
        select(func.count(Order.id)).where(Order.organization_id == org_id)
    ) or 0
    return {
        "conversations": conversations,
        "ai_active": active,
        "human_takeover": handoff,
        "knowledge_posts": posts,
        "orders": orders,
        "organization_id": org_id,
    }


@router.get("/conversations", dependencies=[Depends(require_permission("can_view_conversations"))])
async def list_conversations(
    limit: int = 500,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    rows = (await db.execute(
        select(Conversation)
        .where(Conversation.organization_id == org_id)
        .order_by(Conversation.last_message_at.desc())
        .offset(offset)
        .limit(limit)
    )).scalars().all()

    chat_ids = list({row.chat_id for row in rows if row.chat_id is not None})
    note_map: dict[int, str] = {}
    if chat_ids:
        cust_rows = (await db.execute(
            select(Customer.telegram_user_id, Customer.notes)
            .where(
                Customer.organization_id == org_id,
                Customer.telegram_user_id.in_(chat_ids),
            )
        )).all()
        for tg_uid, note_val in cust_rows:
            if tg_uid is not None and note_val:
                note_map[int(tg_uid)] = note_val

    return [{
        "id": row.id,
        "customer_name": row.customer_name,
        "username": row.username,
        "chat_id": row.chat_id,
        "status": row.status,
        "handoff_reason": row.handoff_reason,
        "note": note_map.get(row.chat_id, ""),
        "business_connection_id": row.business_connection_id,
        "last_message_at": row.last_message_at.isoformat() if row.last_message_at else None,
        "organization_id": row.organization_id,
    } for row in rows]


class ConversationNoteUpdate(BaseModel):
    notes: str = ""


@router.put("/conversations/{conversation_id}/note", dependencies=[Depends(require_permission("can_view_conversations"))])
async def upsert_conversation_note(
    conversation_id: int,
    payload: ConversationNoteUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")

    cleaned_note = (payload.notes or "").strip()[:2000]
    cust = (await db.execute(
        select(Customer).where(
            Customer.organization_id == org_id,
            Customer.telegram_user_id == conv.chat_id,
        )
    )).scalar_one_or_none()

    if cust is None:
        cust = Customer(
            organization_id=org_id,
            telegram_user_id=conv.chat_id,
            name=conv.customer_name or "Mijoz",
            username=conv.username,
            notes=cleaned_note,
        )
        db.add(cust)
        await db.flush()
    else:
        cust.notes = cleaned_note

    db.add(
        AuditLog(
            organization_id=org_id,
            action="customer.note_updated",
            resource="conversation",
            resource_id=str(conv.id),
            metadata_json={"customer_name": conv.customer_name or "Mijoz"},
        )
    )
    await db.commit()
    return {"ok": True, "conversation_id": conv.id, "note": cust.notes}


@router.get("/conversations/{conversation_id}/messages", dependencies=[Depends(require_permission("can_view_conversations"))])
async def conversation_messages(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    conv = await db.get(Conversation, conversation_id)
    if conv is None or conv.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")

    rows = (await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(300)
    )).scalars().all()
    return [{"id": row.id, "direction": row.direction, "text": row.text, "created_at": row.created_at.isoformat()} for row in rows]


@router.get("/events", dependencies=[Depends(require_permission("can_view_conversations"))])
async def stream_admin_events(
    request: Request,
    org_id: int = Depends(get_admin_tenant_id),
):
    """Server-Sent Events stream scoped strictly to the authenticated tenant organization."""

    async def _event_stream():
        async with realtime_hub.subscribe(org_id) as queue:
            yield format_sse("connected", {"organization_id": org_id})
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield format_sse(
                        str(event.get("type") or "message"),
                        event,
                        event_id=str(event.get("id") or "") or None,
                    )
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/conversations/{conversation_id}/takeover", dependencies=[Depends(require_permission("can_takeover"))])
async def takeover(
    conversation_id: int,
    payload: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    row = await db.get(Conversation, conversation_id)
    if row is None or row.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")
    row.status = "human_takeover"
    row.handoff_reason = payload.reason or "Admin panel orqali operator qabul qildi"
    await db.commit()
    await publish_event(
        org_id,
        "conversation.updated",
        {
            "conversation_id": row.id,
            "status": row.status,
            "handoff_reason": row.handoff_reason,
            "customer_name": row.customer_name,
        },
    )
    return {"ok": True, "status": row.status}


@router.post("/conversations/{conversation_id}/resume", dependencies=[Depends(require_permission("can_resume_ai"))])
async def resume_ai(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    row = await db.get(Conversation, conversation_id)
    if row is None or row.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")
    row.status = "ai_active"
    row.handoff_reason = None
    await db.commit()
    await publish_event(
        org_id,
        "conversation.updated",
        {
            "conversation_id": row.id,
            "status": row.status,
            "handoff_reason": None,
            "customer_name": row.customer_name,
        },
    )
    return {"ok": True, "status": row.status}


@router.post("/conversations/{conversation_id}/reply", dependencies=[Depends(require_permission("can_reply_customers"))])
async def admin_reply(
    conversation_id: int,
    payload: AdminReply,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    row = await db.get(Conversation, conversation_id)
    if row is None or row.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Xabar matni bo'sh bo'lishi mumkin emas")

    org = await db.get(Organization, org_id) if org_id else None
    org_token = org.decrypted_bot_token if org else None
    try:
        tg_svc = get_telegram_service(org_token)
    except Exception:
        tg_svc = telegram
        if not tg_svc:
            raise HTTPException(status_code=400, detail="Telegram bot token sozlanmagan. Iltimos, tashkilot sozlamalarida bot tokenni kiriting.")

    try:
        sent = await tg_svc.send_business_text(row.business_connection_id, row.chat_id, payload.text)
    except TelegramAPIError as exc:
        err_msg = str(exc)
        if "BUSINESS_PEER_INVALID" in err_msg:
            detail = "Telegram xabari yuborilmadi: Ushbu mijoz bilan Telegram Business ulanishi faol emas (BUSINESS_PEER_INVALID). Mijoz biznes profilingizga yangitdan xabar yozishi lozim."
        elif "BUSINESS_PEER_USAGE_MISSING" in err_msg:
            detail = "Telegram xabari yuborilmadi: Ushbu chatda botning biznes ruxsati yetarli emas (BUSINESS_PEER_USAGE_MISSING)."
        elif "CHAT_NOT_FOUND" in err_msg:
            detail = "Telegram xabari yuborilmadi: Telegram chat topilmadi (CHAT_NOT_FOUND)."
        elif "MESSAGE_TOO_LONG" in err_msg:
            detail = "Telegram xabari yuborilmadi: Xabar matni ruxsat etilgan hajmdan oshib ketdi."
        else:
            detail = f"Telegram xabari yuborilmadi: {err_msg}"
        raise HTTPException(status_code=400, detail=detail)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Xabar yuborishda kutilmagan xatolik: {exc}")

    msg_id = int(sent.get("message_id", 0)) if isinstance(sent, dict) else 0
    msg_text = payload.text.strip()
    db.add(Message(
        organization_id=org_id,
        conversation_id=row.id,
        telegram_message_id=msg_id,
        direction="admin",
        text=msg_text,
    ))
    row.status = "human_takeover"
    row.last_message_at = datetime.now(timezone.utc)
    await db.commit()
    await publish_event(
        org_id,
        "message.created",
        {
            "conversation_id": row.id,
            "direction": "admin",
            "text": msg_text,
            "customer_name": row.customer_name,
            "status": row.status,
        },
    )
    return {"ok": True}


@router.api_route("/users/{user_id}/avatar", methods=["GET", "HEAD"])
async def get_user_avatar(
    user_id: int,
    current_admin: Admin = Depends(get_current_admin),
):
    try:
        tg_svc = telegram or get_telegram_service()
        photo_bytes = await tg_svc.get_user_profile_photo_bytes(user_id)
    except Exception:
        photo_bytes = None
    if not photo_bytes:
        raise HTTPException(status_code=404, detail="Profil rasmi topilmadi")
    return Response(
        content=photo_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/knowledge", dependencies=[Depends(require_permission("can_view_knowledge"))])
async def knowledge_posts(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    rows = (await db.execute(
        select(ChannelPost)
        .where(ChannelPost.organization_id == org_id)
        .order_by(ChannelPost.posted_at.desc().nullslast())
        .limit(100)
    )).scalars().all()
    return [{
        "id": row.id,
        "organization_id": row.organization_id,
        "channel_username": row.channel_username,
        "telegram_message_id": row.telegram_message_id,
        "text": row.text[:500],
        "image_description": row.image_description[:300],
        "source_url": row.source_url,
        "posted_at": row.posted_at.isoformat() if row.posted_at else None,
    } for row in rows]


@router.delete("/knowledge/{post_id}", dependencies=[Depends(require_permission("can_manage_knowledge"))])
async def delete_knowledge_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    row = await db.get(ChannelPost, post_id)
    if row is None or row.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Post topilmadi")
    await db.delete(row)
    await db.commit()
    return {"ok": True, "deleted_id": post_id}


@router.get("/channels", dependencies=[Depends(require_permission("can_view_knowledge"))])
async def get_channels(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    channels = await settings_service.list_channels(db, organization_id=org_id)
    return [{
        "id": ch.id,
        "organization_id": ch.organization_id,
        "channel_username": ch.channel_username,
        "title": ch.title or f"@{ch.channel_username}",
        "is_active": ch.is_active,
        "posts_count": ch.posts_count,
        "last_synced_at": ch.last_synced_at.isoformat() if ch.last_synced_at else None,
        "created_at": ch.created_at.isoformat() if ch.created_at else None,
    } for ch in channels]


@router.post("/channels", dependencies=[Depends(require_permission("can_manage_knowledge"))])
async def add_channel(
    payload: ChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
):
    try:
        from app.services.knowledge import knowledge
        ch = await settings_service.add_channel(
            db,
            raw_channel=payload.channel,
            title=payload.title,
            added_by=current_admin.telegram_user_id,
            organization_id=org_id,
        )
        await db.commit()
        await db.refresh(ch)
        ch_id = ch.id
        ch_username = ch.channel_username
        ch_title = ch.title
        ch_active = ch.is_active
        ch_posts = ch.posts_count
        ch_synced = ch.last_synced_at
        ch_created = ch.created_at

        imported = 0
        try:
            imported = await asyncio.wait_for(
                knowledge.sync_channel_posts(db, ch_username, organization_id=org_id),
                timeout=12.0,
            )
            await db.commit()
        except Exception:
            await db.rollback()

        return {
            "ok": True,
            "channel": {
                "id": ch_id,
                "organization_id": org_id,
                "channel_username": ch_username,
                "title": ch_title,
                "is_active": ch_active,
                "posts_count": imported or ch_posts,
                "last_synced_at": ch_synced.isoformat() if ch_synced else None,
                "created_at": ch_created.isoformat() if ch_created else None,
            },
            "imported_posts": imported,
        }
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/channels/verify", dependencies=[Depends(require_permission("can_view_knowledge"))])
async def verify_channel_endpoint(
    payload: ChannelVerifyRequest,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    """Verify Telegram channel existence, accessibility and subscriber count via getChat API."""
    raw = payload.channel.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Kanal username yoki havolasi kiritilmadi")

    clean = (
        raw.replace("https://t.me/", "")
        .replace("http://t.me/", "")
        .replace("t.me/", "")
        .replace("@", "")
        .strip("/")
    )
    if not clean:
        raise HTTPException(status_code=400, detail="Noto'g'ri kanal username formati")

    # Get bot token: first from current organization, fallback to system bot token
    org = await db.get(Organization, org_id)
    bot_token = org.decrypted_bot_token if org and org.decrypted_bot_token else settings.telegram_bot_token

    if not bot_token:
        return {
            "valid": True,
            "username": clean,
            "title": f"@{clean}",
            "subscribers_count": None,
            "type": "channel",
            "message": "Bot tokeni sozlanmagan, kanal nomi qabul qilindi",
        }

    retries = 2
    last_exc: Optional[Exception] = None
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for attempt in range(retries):
            try:
                chat_res = await client.get(f"https://api.telegram.org/bot{bot_token}/getChat?chat_id=@{clean}")
                chat_data = chat_res.json()
                if not chat_data.get("ok"):
                    desc = chat_data.get("description", "Kanal topilmadi")
                    if "chat not found" in desc.lower():
                        return {
                            "valid": False,
                            "error": f"@{clean} kanali topilmadi. Kanal username to'g'riligini va kanal ochiq (public) ekanligini tekshiring.",
                        }
                    return {"valid": False, "error": f"Telegram xatosi: {desc}"}

                result = chat_data.get("result", {})
                title = result.get("title") or f"@{clean}"
                chat_type = result.get("type", "channel")
                chat_id = result.get("id")

                subs_count = None
                try:
                    count_res = await client.get(f"https://api.telegram.org/bot{bot_token}/getChatMemberCount?chat_id=@{clean}")
                    count_data = count_res.json()
                    if count_data.get("ok"):
                        subs_count = count_data.get("result")
                except Exception:
                    pass

                return {
                    "valid": True,
                    "id": chat_id,
                    "title": title,
                    "username": clean,
                    "type": chat_type,
                    "subscribers_count": subs_count,
                    "description": result.get("description"),
                }
            except (httpx.TimeoutException, httpx.ConnectError) as exc:
                last_exc = exc
                if attempt < retries - 1:
                    await asyncio.sleep(1.0)
                    continue
            except Exception as exc:
                last_exc = exc
                break

    detail = str(last_exc).strip() or (last_exc.__class__.__name__ if last_exc else "Tarmoq xatosi")
    return {"valid": False, "error": f"Telegram bilan bog'lanib bo'lmadi ({detail})"}


@router.delete("/channels/{identifier}", dependencies=[Depends(require_permission("can_manage_knowledge"))])
async def delete_channel(
    identifier: str,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    removed = await settings_service.remove_channel(db, identifier, organization_id=org_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Kanal topilmadi")
    await db.commit()
    return {"ok": True, "identifier": identifier}


@router.post("/channels/sync", dependencies=[Depends(require_permission("can_manage_knowledge"))])
async def sync_channels(
    payload: ChannelSyncRequest | None = None,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.knowledge import knowledge
    if payload and payload.channel:
        clean = settings_service.clean_channel_username(payload.channel)
        cnt = await knowledge.sync_channel_posts(db, clean, organization_id=org_id)
        await db.commit()
        return {"ok": True, "synced": {clean: cnt}, "total_synced": cnt}
    results = await knowledge.sync_all_channels(db, organization_id=org_id)
    await db.commit()
    total = sum(results.values())
    return {"ok": True, "synced": results, "total_synced": total}


@router.post(
    "/knowledge/sync",
    dependencies=[
        Depends(require_permission("can_manage_knowledge")),
        Depends(require_rate_limit("admin_knowledge_sync", max_requests=20, window_seconds=60)),
    ],
)
async def sync_knowledge_posts(
    payload: ChannelSyncRequest | None = None,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.knowledge import knowledge
    if payload and payload.channel:
        clean = settings_service.clean_channel_username(payload.channel)
        count = await knowledge.sync_channel_posts(db, clean, organization_id=org_id)
        await db.commit()
        return {"ok": True, "channel": clean, "synced_posts": count, "channels": {clean: count}}

    results = await knowledge.sync_all_channels(db, organization_id=org_id)
    await db.commit()
    total = sum(results.values())
    channel_names = list(results.keys())
    primary = channel_names[0] if channel_names else ""
    return {"ok": True, "channel": primary, "synced_posts": total, "channels": results}


# ---------------------------------------------------------------------------
# Product Catalog Endpoints
# ---------------------------------------------------------------------------

class ProductCreate(BaseModel):
    id: str | None = None
    code: str | None = None
    name: str
    category: str = "Gaming"
    specs: str = ""
    price: str = "$0"
    stock: str = "In Stock"
    warranty: str = "2 oy kafolat"


class ProductUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    specs: str | None = None
    price: str | None = None
    stock: str | None = None
    warranty: str | None = None
    is_active: bool | None = None


DEFAULT_INITIAL_PRODUCTS = [
    {"code": "LAP-01", "name": "Asus TUF Gaming FX505GE", "category": "Gaming", "specs": "Core i7-8750H, 16GB RAM, 512GB SSD, GTX 1050Ti 4GB", "price": "$340", "stock": "In Stock", "warranty": "2 oy kafolat"},
    {"code": "LAP-02", "name": "Lenovo ThinkPad E14 Gen 2", "category": "Biznes", "specs": "Core i5-1135G7, 16GB RAM, 256GB NVMe, Iris Xe", "price": "$430", "stock": "In Stock", "warranty": "3 oy kafolat"},
    {"code": "LAP-03", "name": "Apple MacBook Air M1", "category": "Ultrabuk", "specs": "Apple M1 chip, 8GB RAM, 256GB SSD, Retina 13.3", "price": "$610", "stock": "In Stock", "warranty": "6 oy kafolat"},
    {"code": "LAP-04", "name": "HP Victus 15 (2023)", "category": "Gaming", "specs": "Ryzen 5 7535HS, 16GB DDR5, 512GB SSD, RTX 2050 4GB", "price": "$490", "stock": "Low Stock", "warranty": "3 oy kafolat"},
    {"code": "LAP-05", "name": "Dell Latitude 5420", "category": "Ofis", "specs": "Core i5-1145G7, 16GB RAM, 512GB SSD, FHD IPS", "price": "$320", "stock": "In Stock", "warranty": "2 oy kafolat"},
    {"code": "LAP-06", "name": "Acer Nitro 5 AN515", "category": "Gaming", "specs": "Core i5-11400H, 16GB RAM, 512GB SSD, RTX 3050 4GB", "price": "$530", "stock": "Pre-order", "warranty": "3 oy kafolat"},
]


@router.get("/products")
async def get_products(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    stmt = select(Product).where(Product.organization_id == org_id, Product.is_active.is_(True)).order_by(Product.id.asc())
    products = (await db.execute(stmt)).scalars().all()
    # For default demo tenant 1 only, seed initial catalog if completely empty
    if not products and org_id == 1:
        for item in DEFAULT_INITIAL_PRODUCTS:
            db.add(Product(
                organization_id=1,
                code=item["code"],
                name=item["name"],
                category=item["category"],
                specs=item["specs"],
                price=item["price"],
                stock=item["stock"],
                warranty=item["warranty"],
                is_active=True,
            ))
        await db.commit()
        products = (await db.execute(stmt)).scalars().all()

    return [{
        "id": p.code or f"PRD-{p.id:02d}",
        "db_id": p.id,
        "name": p.name,
        "category": p.category,
        "specs": p.specs,
        "price": p.price,
        "stock": p.stock,
        "warranty": p.warranty,
    } for p in products]


@router.post("/products")
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    code = payload.code or payload.id or f"PRD-{int(datetime.now().timestamp()) % 10000:04d}"
    product = Product(
        organization_id=org_id,
        code=code,
        name=payload.name,
        category=payload.category,
        specs=payload.specs,
        price=payload.price,
        stock=payload.stock,
        warranty=payload.warranty,
        is_active=True,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return {
        "id": product.code,
        "db_id": product.id,
        "name": product.name,
        "category": product.category,
        "specs": product.specs,
        "price": product.price,
        "stock": product.stock,
        "warranty": product.warranty,
    }


@router.put("/products/{code_or_id}")
async def update_product(
    code_or_id: str,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    is_num = code_or_id.isdigit()
    cond = (Product.code == code_or_id)
    if is_num:
        cond = cond | (Product.id == int(code_or_id))
    stmt = select(Product).where(Product.organization_id == org_id, cond)
    product = (await db.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    if payload.name is not None:
        product.name = payload.name
    if payload.category is not None:
        product.category = payload.category
    if payload.specs is not None:
        product.specs = payload.specs
    if payload.price is not None:
        product.price = payload.price
    if payload.stock is not None:
        product.stock = payload.stock
    if payload.warranty is not None:
        product.warranty = payload.warranty
    if payload.is_active is not None:
        product.is_active = payload.is_active

    await db.commit()
    await db.refresh(product)
    return {
        "id": product.code,
        "db_id": product.id,
        "name": product.name,
        "category": product.category,
        "specs": product.specs,
        "price": product.price,
        "stock": product.stock,
        "warranty": product.warranty,
        "is_active": product.is_active,
    }


@router.post("/products/extract-from-posts")
async def extract_products_from_posts_endpoint(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    """Automatically detect and extract products from channel posts."""
    from app.services.knowledge import knowledge
    extracted = await knowledge.extract_products_from_channel_posts(db, org_id)
    return {
        "ok": True,
        "extracted_count": len(extracted),
        "products": [{
            "id": p.code,
            "db_id": p.id,
            "name": p.name,
            "price": p.price,
            "category": p.category,
            "specs": p.specs,
            "warranty": p.warranty,
        } for p in extracted],
    }


@router.delete("/products/{code_or_id}")
async def delete_product(
    code_or_id: str,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    is_num = code_or_id.isdigit()
    cond = (Product.code == code_or_id)
    if is_num:
        cond = cond | (Product.id == int(code_or_id))
    stmt = select(Product).where(Product.organization_id == org_id, cond)
    product = (await db.execute(stmt)).scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    product.is_active = False
    await db.commit()
    return {"ok": True, "deleted": code_or_id}


# ---------------------------------------------------------------------------
# Order Management Endpoints
# ---------------------------------------------------------------------------

class OrderCreate(BaseModel):
    customer_name: str
    phone: str = ""
    product_summary: str = ""
    delivery_address: str = ""
    amount: str = "$0"
    status: str = "new"
    notes: str = ""


class OrderUpdate(BaseModel):
    customer_name: str | None = None
    phone: str | None = None
    product_summary: str | None = None
    delivery_address: str | None = None
    amount: str | None = None
    status: str | None = None
    notes: str | None = None


@router.get("/orders")
async def get_orders(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    stmt = select(Order).where(Order.organization_id == org_id).order_by(Order.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()

    latest_payments: dict[int, StoreOrderPayment] = {}
    if rows:
        order_ids = [r.id for r in rows]
        pay_rows = (
            await db.execute(
                select(StoreOrderPayment)
                .where(
                    StoreOrderPayment.organization_id == org_id,
                    StoreOrderPayment.order_id.in_(order_ids),
                )
                .order_by(StoreOrderPayment.created_at.desc())
            )
        ).scalars().all()
        for p in pay_rows:
            if p.order_id not in latest_payments:
                latest_payments[p.order_id] = p

    def _serialize_payment(p: StoreOrderPayment | None) -> dict | None:
        if not p:
            return None
        return {
            "bill_id": p.bill_id,
            "provider": p.provider,
            "amount_uzs": p.amount_uzs,
            "payment_url": p.payment_url,
            "status": p.status,
            "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        }

    return [{
        "id": f"ORD-{r.id}",
        "db_id": r.id,
        "conversation_id": r.conversation_id,
        "customer": r.customer_name,
        "phone": r.phone,
        "product": r.product_summary,
        "amount": r.amount,
        "status": r.status,
        "date": r.created_at.strftime("%d-%b, %H:%M") if r.created_at else "Yangi",
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "address": r.delivery_address,
        "notes": r.notes,
        "latest_payment": _serialize_payment(latest_payments.get(r.id)),
    } for r in rows]


@router.post("/orders")
async def create_order(
    payload: OrderCreate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    order = Order(
        organization_id=org_id,
        customer_name=payload.customer_name,
        phone=payload.phone,
        product_summary=payload.product_summary,
        delivery_address=payload.delivery_address,
        amount=payload.amount,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    await publish_event(
        org_id,
        "order.created",
        {
            "order_id": order.id,
            "customer_name": order.customer_name,
            "product_summary": order.product_summary,
            "amount": order.amount,
            "status": order.status,
        },
    )
    return {
        "ok": True,
        "order": {
            "id": f"ORD-{order.id}",
            "db_id": order.id,
            "customer": order.customer_name,
            "phone": order.phone,
            "product": order.product_summary,
            "amount": order.amount,
            "status": order.status,
            "date": order.created_at.strftime("%d-%b, %H:%M") if order.created_at else "Yangi",
        }
    }


@router.patch("/orders/{order_id}")
async def update_order(
    order_id: int,
    payload: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    order = await db.get(Order, order_id)
    if not order or order.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    if payload.customer_name is not None:
        order.customer_name = payload.customer_name
    if payload.phone is not None:
        order.phone = payload.phone
    if payload.product_summary is not None:
        order.product_summary = payload.product_summary
    if payload.delivery_address is not None:
        order.delivery_address = payload.delivery_address
    if payload.amount is not None:
        order.amount = payload.amount
    if payload.status is not None:
        order.status = payload.status
    if payload.notes is not None:
        order.notes = payload.notes
    await db.commit()
    await db.refresh(order)
    await publish_event(
        org_id,
        "order.updated",
        {
            "order_id": order.id,
            "customer_name": order.customer_name,
            "product_summary": order.product_summary,
            "amount": order.amount,
            "status": order.status,
        },
    )
    return {
        "ok": True,
        "order": {
            "id": f"ORD-{order.id}",
            "db_id": order.id,
            "customer": order.customer_name,
            "phone": order.phone,
            "product": order.product_summary,
            "amount": order.amount,
            "status": order.status,
            "date": order.created_at.strftime("%d-%b, %H:%M") if order.created_at else "Yangi",
        }
    }


@router.delete("/orders/{order_id}")
async def delete_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    order = await db.get(Order, order_id)
    if not order or order.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    await db.delete(order)
    await db.commit()
    return {"ok": True, "deleted_id": order_id}


# ---------------------------------------------------------------------------
# Customer Directory Endpoints
# ---------------------------------------------------------------------------

class CustomerCreate(BaseModel):
    name: str
    username: str | None = None
    phone: str | None = None
    telegram_user_id: int | None = None
    notes: str = ""


class CustomerUpdate(BaseModel):
    name: str | None = None
    username: str | None = None
    phone: str | None = None
    notes: str | None = None


@router.get("/customers")
async def get_customers(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    stmt = select(Customer).where(Customer.organization_id == org_id).order_by(Customer.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [{
        "id": c.id,
        "name": c.name,
        "username": c.username,
        "phone": c.phone,
        "telegram_user_id": c.telegram_user_id,
        "total_orders": c.total_orders,
        "total_spent": c.total_spent,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in rows]


@router.post("/customers")
async def create_customer(
    payload: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    cust = Customer(
        organization_id=org_id,
        name=payload.name,
        username=payload.username,
        phone=payload.phone,
        telegram_user_id=payload.telegram_user_id,
        notes=payload.notes,
    )
    db.add(cust)
    await db.commit()
    await db.refresh(cust)
    return {"ok": True, "customer": {"id": cust.id, "name": cust.name, "phone": cust.phone}}


@router.patch("/customers/{customer_id}")
async def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    cust = await db.get(Customer, customer_id)
    if not cust or cust.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi")
    if payload.name is not None:
        cust.name = payload.name
    if payload.username is not None:
        cust.username = payload.username
    if payload.phone is not None:
        cust.phone = payload.phone
    if payload.notes is not None:
        cust.notes = payload.notes
    await db.commit()
    await db.refresh(cust)
    return {"ok": True, "customer": {"id": cust.id, "name": cust.name, "phone": cust.phone, "notes": cust.notes}}


# ---------------------------------------------------------------------------
# Admin Management Endpoints
# ---------------------------------------------------------------------------

@router.get("/admins", dependencies=[Depends(require_permission("can_manage_admins"))])
async def get_admins(
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
):
    if getattr(current_admin, "_is_platform_owner", False):
        stmt = select(Admin).where((Admin.organization_id == org_id) | (Admin.organization_id.is_(None)))
    else:
        stmt = select(Admin).where(Admin.organization_id == org_id)
    admins = (await db.execute(stmt.order_by(Admin.created_at.asc()))).scalars().all()
    return [{
        "id": a.id,
        "organization_id": a.organization_id,
        "telegram_user_id": a.telegram_user_id,
        "name": a.name,
        "username": a.username,
        "role": a.role,
        "permissions": a.permissions,
        "is_active": a.is_active,
        "added_by": a.added_by,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in admins]


@router.post("/admins", dependencies=[Depends(require_permission("can_manage_admins"))])
async def create_admin(
    payload: AdminCreate,
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        new_admin = await admin_service.add_admin(
            db,
            telegram_user_id=payload.telegram_user_id,
            name=payload.name,
            username=payload.username,
            role=payload.role,
            added_by=current_admin.telegram_user_id,
        )
        new_admin.organization_id = org_id
        await db.commit()
        return {
            "ok": True,
            "admin": {
                "id": new_admin.id,
                "organization_id": new_admin.organization_id,
                "telegram_user_id": new_admin.telegram_user_id,
                "name": new_admin.name,
                "username": new_admin.username,
                "role": new_admin.role,
                "permissions": new_admin.permissions,
                "is_active": new_admin.is_active,
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/admins/{telegram_user_id}")
async def delete_admin(
    telegram_user_id: int,
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    if not (current_admin.role == "owner" or admin_service.has_permission(current_admin, "can_manage_admins")):
        raise HTTPException(status_code=403, detail="Admin o'chirish uchun ruxsat yo'q")

    target = await admin_service.get_admin_by_telegram_id(db, telegram_user_id)
    if target is None or (target.organization_id and target.organization_id != org_id and not getattr(current_admin, "_is_platform_owner", False)):
        raise HTTPException(status_code=404, detail="Admin topilmadi")

    try:
        removed = await admin_service.remove_admin(db, telegram_user_id)
        await db.commit()
        return {"ok": True, "message": f"{removed.name or removed.telegram_user_id} o'chirildi"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/admins/{telegram_user_id}/permissions")
async def update_admin_permission(
    telegram_user_id: int,
    payload: AdminUpdatePermission,
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    if not (current_admin.role == "owner" or admin_service.has_permission(current_admin, "can_manage_admins")):
        raise HTTPException(status_code=403, detail="Ruxsatlarni o'zgartirish huquqi yo'q")

    target = await admin_service.get_admin_by_telegram_id(db, telegram_user_id)
    if target is None or (target.organization_id and target.organization_id != org_id and not getattr(current_admin, "_is_platform_owner", False)):
        raise HTTPException(status_code=404, detail="Admin topilmadi")

    try:
        updated = await admin_service.update_permission(db, telegram_user_id, payload.permission, payload.value)
        await db.commit()
        return {"ok": True, "permissions": updated.permissions}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/admins/{telegram_user_id}/role")
async def update_admin_role(
    telegram_user_id: int,
    payload: AdminUpdateRole,
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    if not (current_admin.role == "owner" or getattr(current_admin, "_is_platform_owner", False)):
        raise HTTPException(status_code=403, detail="Faqat owner boshqa admin rolini o'zgartira oladi")

    target = await admin_service.get_admin_by_telegram_id(db, telegram_user_id)
    if target is None or (target.organization_id and target.organization_id != org_id and not getattr(current_admin, "_is_platform_owner", False)):
        raise HTTPException(status_code=404, detail="Admin topilmadi")

    try:
        updated = await admin_service.update_role(db, telegram_user_id, payload.role)
        await db.commit()
        return {"ok": True, "role": updated.role, "permissions": updated.permissions}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/logs")
async def list_tenant_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
):
    """Aggregate real chronological tenant activity from audit logs, AI/admin replies, orders, and channel syncs."""
    events: list[tuple[datetime, dict]] = []

    audit_rows = (await db.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )).scalars().all()
    for a in audit_rows:
        ts = a.created_at or datetime.now(timezone.utc)
        meta_txt = ""
        if isinstance(a.metadata_json, dict) and a.metadata_json:
            meta_txt = ", ".join(f"{k}: {v}" for k, v in list(a.metadata_json.items())[:3])
        events.append((ts, {
            "id": f"audit-{a.id}",
            "time": ts.isoformat(),
            "source": (a.resource or "System").capitalize(),
            "action": a.action,
            "details": meta_txt or (f"ID: {a.resource_id}" if a.resource_id else "-"),
            "status": "OK",
        }))

    msg_rows = (await db.execute(
        select(Message, Conversation.customer_name)
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Message.organization_id == org_id,
            Conversation.organization_id == org_id,
            Message.direction.in_(["assistant", "admin"]),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    )).all()
    for msg, cust_name in msg_rows:
        ts = msg.created_at or datetime.now(timezone.utc)
        is_ai = msg.direction == "assistant"
        snippet = (msg.text or "").strip().replace("\n", " ")[:90]
        events.append((ts, {
            "id": f"msg-{msg.id}",
            "time": ts.isoformat(),
            "source": "AI Engine" if is_ai else "Operator",
            "action": "Avtomatik mijozga javob" if is_ai else "Operator xabari",
            "details": f"{cust_name}: {snippet}" if cust_name else snippet,
            "status": "Yuborildi",
        }))

    order_rows = (await db.execute(
        select(Order)
        .where(Order.organization_id == org_id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )).scalars().all()
    for ord_row in order_rows:
        ts = ord_row.created_at or datetime.now(timezone.utc)
        events.append((ts, {
            "id": f"order-{ord_row.id}",
            "time": ts.isoformat(),
            "source": "Order",
            "action": f"Buyurtma ORD-{ord_row.id:04d}",
            "details": f"{ord_row.customer_name or 'Mijoz'} - {ord_row.product_summary or '-'} ({ord_row.amount})",
            "status": ord_row.status or "new",
        }))

    channel_rows = (await db.execute(
        select(ConnectedChannel)
        .where(
            ConnectedChannel.organization_id == org_id,
            ConnectedChannel.last_synced_at.isnot(None),
        )
        .order_by(ConnectedChannel.last_synced_at.desc())
        .limit(20)
    )).scalars().all()
    for ch in channel_rows:
        ts = ch.last_synced_at or datetime.now(timezone.utc)
        events.append((ts, {
            "id": f"sync-{ch.id}",
            "time": ts.isoformat(),
            "source": "Channel Sync",
            "action": f"@{ch.channel_username} sinxronlandi",
            "details": f"{ch.posts_count or 0} ta post bazaga yuklangan",
            "status": "Faol" if ch.is_active else "Nofaol",
        }))

    events.sort(key=lambda item: item[0], reverse=True)
    return {"logs": [item[1] for item in events[:limit]], "organization_id": org_id}


@router.get("/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
):
    channel = await settings_service.get_public_channel(db)
    channels = await settings_service.list_channels(db, organization_id=org_id)
    all_settings = await settings_service.list_settings(db, organization_id=org_id)
    return {
        "public_channel": channel,
        "connected_channels": [{
            "id": ch.id,
            "organization_id": ch.organization_id,
            "channel_username": ch.channel_username,
            "title": ch.title or f"@{ch.channel_username}",
            "is_active": ch.is_active,
            "posts_count": ch.posts_count,
            "last_synced_at": ch.last_synced_at.isoformat() if ch.last_synced_at else None,
            "created_at": ch.created_at.isoformat() if ch.created_at else None,
        } for ch in channels],
        "settings": all_settings,
        "organization_id": org_id,
    }


@router.patch("/settings/{key}")
async def update_setting(
    key: str,
    payload: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin),
    org_id: int = Depends(get_admin_tenant_id),
):
    if not (current_admin.role == "owner" or admin_service.has_permission(current_admin, "can_manage_settings")):
        raise HTTPException(status_code=403, detail="Sozlamalarni o'zgartirish huquqi yo'q")
    try:
        if key == "public_channel":
            cleaned = await settings_service.set_public_channel(db, payload.value)
            await db.commit()
            return {"ok": True, "key": key, "value": cleaned}
        setting = await settings_service.set_setting(
            db, key, payload.value, description=payload.description, organization_id=org_id
        )
        await db.commit()
        return {"ok": True, "key": setting.key, "value": setting.value}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class PlaygroundHistoryTurn(BaseModel):
    direction: str
    text: str


class AIPlaygroundRequest(BaseModel):
    message: str
    history: list[PlaygroundHistoryTurn] = []
    custom_system_prompt: str | None = None
    ai_temperature: float | None = None
    ai_model: str | None = None


@router.post(
    "/ai/playground",
    dependencies=[
        Depends(require_permission("can_view_knowledge")),
        Depends(require_rate_limit("admin_ai_playground", max_requests=25, window_seconds=60)),
    ],
)
async def run_ai_playground(
    payload: AIPlaygroundRequest,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    """Simulate an AI customer interaction strictly scoped to the tenant without mutating business data."""
    import time
    from app.services.ai import sales_ai
    from app.services.knowledge import knowledge

    cleaned_message = (payload.message or "").strip()
    if not cleaned_message:
        raise HTTPException(status_code=400, detail="Sinov xabari bo'sh bo'lishi mumkin emas")
    cleaned_message = cleaned_message[:1500]

    sanitized_history = [
        {
            "direction": "assistant" if turn.direction == "assistant" else "customer",
            "text": (turn.text or "").strip()[:800],
        }
        for turn in (payload.history or [])[-10:]
        if (turn.text or "").strip()
    ]

    t0 = time.perf_counter()
    if sales_ai.is_greeting(cleaned_message):
        evidence = []
    else:
        evidence = await knowledge.search(db, cleaned_message, limit=6, organization_id=org_id)

    decision = await sales_ai.answer(
        cleaned_message,
        evidence,
        sanitized_history,
        organization_id=org_id,
        db=db,
        custom_prompt_override=payload.custom_system_prompt,
        temperature_override=payload.ai_temperature,
        model_override=payload.ai_model,
        track_usage=False,
    )
    latency_ms = round((time.perf_counter() - t0) * 1000)

    return {
        "ok": True,
        "reply": decision.get("reply") or "",
        "intent": decision.get("intent") or "other",
        "handoff": bool(decision.get("handoff")),
        "reason": decision.get("reason"),
        "order_created": bool(decision.get("order_created")),
        "order_data": decision.get("order_data"),
        "attach_photo": bool(decision.get("attach_photo")),
        "source_post_id": decision.get("source_post_id"),
        "latency_ms": latency_ms,
        "evidence": [
            {
                "id": post.id,
                "telegram_message_id": post.telegram_message_id,
                "channel_username": post.channel_username,
                "snippet": (post.text or post.image_description or "").strip()[:180],
                "has_photo": bool(post.photo_file_id or post.image_path),
                "source_url": post.source_url,
            }
            for post in evidence
        ],
    }


# ---------------------------------------------------------------------------
# Store Customer Payment Gateway & In-Chat Order Payment Links
# ---------------------------------------------------------------------------

class StorePaymentConfigUpdate(BaseModel):
    provider: str = "tezcheck"
    is_enabled: bool = False
    tezcheck_api_key: str | None = None
    tezcheck_secret_key: str | None = None
    tezcheck_cash_desk_code: str | None = None
    click_service_id: str | None = None
    click_merchant_id: str | None = None
    payme_merchant_id: str | None = None
    card_number: str | None = None
    card_holder: str | None = None


class OrderPaymentSendRequest(BaseModel):
    amount_uzs: int
    conversation_id: int | None = None
    description: str | None = None
    send_to_telegram: bool = True


class ConversationPaymentSendRequest(BaseModel):
    amount_uzs: int
    product_summary: str = "Buyurtma to'lovi"
    order_id: int | None = None


@router.get("/payments/config", dependencies=[Depends(require_permission("can_view_orders"))])
async def get_store_payment_config(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.store_payment_service import get_or_create_store_payment_config, serialize_store_payment_config
    cfg = await get_or_create_store_payment_config(db, org_id)
    await db.commit()
    return serialize_store_payment_config(cfg, org_id)


@router.put("/payments/config", dependencies=[Depends(require_permission("can_manage_settings"))])
async def update_store_payment_config(
    payload: StorePaymentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.store_payment_service import serialize_store_payment_config, upsert_store_payment_config
    try:
        cfg = await upsert_store_payment_config(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    db.add(
        AuditLog(
            organization_id=org_id,
            action="store_payment.config_updated",
            resource="store_payment_config",
            resource_id=str(org_id),
            metadata_json={"provider": cfg.provider, "is_enabled": cfg.is_enabled},
        )
    )
    await db.commit()
    return {"ok": True, "config": serialize_store_payment_config(cfg, org_id)}


@router.post("/orders/{order_id}/send-payment", dependencies=[Depends(require_permission("can_manage_orders"))])
async def send_order_payment_link(
    order_id: int,
    payload: OrderPaymentSendRequest,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.store_payment_service import create_and_send_order_payment

    order = await db.get(Order, order_id)
    if not order or order.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    conv = None
    if payload.conversation_id:
        conv = await db.get(Conversation, payload.conversation_id)
        if not conv or conv.organization_id != org_id:
            raise HTTPException(status_code=404, detail="Suhbat topilmadi")

    try:
        return await create_and_send_order_payment(
            db,
            organization_id=org_id,
            order=order,
            amount_uzs=payload.amount_uzs,
            conversation=conv,
            description=payload.description,
            send_to_telegram=payload.send_to_telegram,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/conversations/{conversation_id}/send-payment", dependencies=[Depends(require_permission("can_reply_customers"))])
async def send_conversation_payment_link(
    conversation_id: int,
    payload: ConversationPaymentSendRequest,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.store_payment_service import create_and_send_order_payment, format_uzs

    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Suhbat topilmadi")

    order = None
    if payload.order_id:
        order = await db.get(Order, payload.order_id)
        if not order or order.organization_id != org_id:
            raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    if order is None:
        order = Order(
            organization_id=org_id,
            conversation_id=conv.id,
            customer_name=conv.customer_name or "Mijoz",
            phone="",
            product_summary=(payload.product_summary or "Buyurtma to'lovi").strip()[:255],
            amount=format_uzs(payload.amount_uzs),
            status="Confirmed",
            notes=f"Inbox chatidan to'lov so'rovi (@{conv.username or conv.chat_id})",
        )
        db.add(order)
        await db.flush()

    try:
        result = await create_and_send_order_payment(
            db,
            organization_id=org_id,
            order=order,
            amount_uzs=payload.amount_uzs,
            conversation=conv,
            description=payload.product_summary,
            send_to_telegram=True,
        )
        result["order_id"] = order.id
        return result
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/orders/{order_id}/mark-paid", dependencies=[Depends(require_permission("can_manage_orders"))])
async def mark_order_paid(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    import secrets
    from app.services.store_payment_service import confirm_store_order_payment, parse_amount_uzs

    order = await db.get(Order, order_id)
    if not order or order.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    payment = (
        await db.execute(
            select(StoreOrderPayment)
            .where(
                StoreOrderPayment.organization_id == org_id,
                StoreOrderPayment.order_id == order.id,
            )
            .order_by(StoreOrderPayment.created_at.desc())
        )
    ).scalars().first()

    if payment is None:
        ref = f"manual_{org_id}_{order.id}_{secrets.token_hex(4)}"
        payment = StoreOrderPayment(
            organization_id=org_id,
            order_id=order.id,
            conversation_id=order.conversation_id,
            provider="manual_card",
            bill_id=ref,
            external_reference=ref,
            amount_uzs=max(1000, parse_amount_uzs(order.amount)),
            status="pending",
            description=(order.product_summary or f"Buyurtma #{order.id}")[:250],
        )
        db.add(payment)
        await db.flush()

    return await confirm_store_order_payment(db, payment_record=payment, notify_customer=True)


@router.post("/orders/{order_id}/payment-check", dependencies=[Depends(require_permission("can_view_orders"))])
async def check_order_payment_status(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.store_payment_service import (
        confirm_store_order_payment,
        get_or_create_store_payment_config,
        get_store_tezcheck_client,
    )

    order = await db.get(Order, order_id)
    if not order or order.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    payment = (
        await db.execute(
            select(StoreOrderPayment)
            .where(
                StoreOrderPayment.organization_id == org_id,
                StoreOrderPayment.order_id == order.id,
            )
            .order_by(StoreOrderPayment.created_at.desc())
        )
    ).scalars().first()

    if not payment:
        return {"ok": True, "paid": (order.status or "").lower() == "paid", "status": order.status}

    if payment.status == "paid":
        return {"ok": True, "paid": True, "status": "paid"}

    if payment.provider == "tezcheck":
        cfg = await get_or_create_store_payment_config(db, org_id)
        if cfg.tezcheck_api_key and cfg.tezcheck_secret_key:
            try:
                status_res = await get_store_tezcheck_client(cfg).get_bill_status(payment.bill_id)
                if status_res.get("paid"):
                    settled = await confirm_store_order_payment(db, payment_record=payment, notify_customer=True)
                    return {"ok": True, "paid": True, "status": "paid", "settled": settled}
                return {"ok": True, "paid": False, "status": status_res.get("status", "pending")}
            except Exception as exc:
                raise HTTPException(status_code=400, detail=str(exc))

    return {"ok": True, "paid": False, "status": payment.status}


# ---------------------------------------------------------------------------
# Smart Follow-up Automation Settings, Dry-Run Preview & History
# ---------------------------------------------------------------------------

class FollowupConfigUpdate(BaseModel):
    is_enabled: bool | None = None
    delay_hours: int | None = None
    max_attempts: int | None = None
    business_hours_only: bool | None = None
    start_hour: int | None = None
    end_hour: int | None = None
    offer_discount_pct: int | None = None
    custom_template: str | None = None


@router.get("/followup/config", dependencies=[Depends(require_permission("can_view_conversations"))])
async def get_followup_config(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.followup_service import (
        find_followup_candidates,
        get_or_create_followup_config,
        serialize_followup_config,
    )

    cfg = await get_or_create_followup_config(db, org_id)
    candidates = await find_followup_candidates(db, organization_id=org_id, cfg=cfg, limit=20)
    history_rows = (
        await db.execute(
            select(FollowupLog, Conversation.customer_name)
            .join(Conversation, Conversation.id == FollowupLog.conversation_id)
            .where(FollowupLog.organization_id == org_id)
            .order_by(FollowupLog.sent_at.desc())
            .limit(20)
        )
    ).all()
    await db.commit()

    return {
        "config": serialize_followup_config(cfg),
        "eligible_count": len(candidates),
        "history": [
            {
                "id": log.id,
                "conversation_id": log.conversation_id,
                "customer_name": cust_name or "Mijoz",
                "attempt_number": log.attempt_number,
                "message_text": log.message_text,
                "status": log.status,
                "error_message": log.error_message,
                "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            }
            for log, cust_name in history_rows
        ],
    }


@router.put("/followup/config", dependencies=[Depends(require_permission("can_manage_settings"))])
async def update_followup_config(
    payload: FollowupConfigUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.followup_service import serialize_followup_config, upsert_followup_config

    try:
        cfg = await upsert_followup_config(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    db.add(
        AuditLog(
            organization_id=org_id,
            action="followup.config_updated",
            resource="store_followup_config",
            resource_id=str(org_id),
            metadata_json={"is_enabled": cfg.is_enabled, "delay_hours": cfg.delay_hours, "max_attempts": cfg.max_attempts},
        )
    )
    await db.commit()
    return {"ok": True, "config": serialize_followup_config(cfg)}


@router.post("/followup/preview", dependencies=[Depends(require_permission("can_manage_settings"))])
async def preview_followup_candidates(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.followup_service import run_org_followups

    return await run_org_followups(db, organization_id=org_id, dry_run=True, limit=15)


@router.post("/followup/run-now", dependencies=[Depends(require_permission("can_manage_settings"))])
async def run_followup_sweep_now(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.followup_service import run_org_followups

    return await run_org_followups(
        db,
        organization_id=org_id,
        dry_run=False,
        ignore_business_hours=True,
        limit=10,
    )


class StoreReportConfigUpdate(BaseModel):
    is_enabled: bool | None = None
    send_hour: int | None = None
    include_orders: bool | None = None
    include_customers: bool | None = None


class StoreReportSendRequest(BaseModel):
    dry_run: bool = False


@router.get("/reports/config", dependencies=[Depends(require_permission("can_view_orders"))])
async def get_store_report_config(
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.report_service import (
        build_store_daily_digest,
        get_or_create_report_config,
        serialize_report_config,
    )

    cfg = await get_or_create_report_config(db, org_id)
    digest = await build_store_daily_digest(
        db,
        org_id,
        include_orders=cfg.include_orders,
        include_customers=cfg.include_customers,
    )
    await db.commit()
    return {
        "config": serialize_report_config(cfg),
        "preview": digest,
    }


@router.put("/reports/config", dependencies=[Depends(require_permission("can_manage_settings"))])
async def update_store_report_config(
    payload: StoreReportConfigUpdate,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.report_service import serialize_report_config, upsert_report_config

    try:
        cfg = await upsert_report_config(db, org_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    db.add(
        AuditLog(
            organization_id=org_id,
            action="store_report.config_updated",
            resource="store_report_config",
            resource_id=str(org_id),
            metadata_json={"is_enabled": cfg.is_enabled, "send_hour": cfg.send_hour},
        )
    )
    await db.commit()
    return {"ok": True, "config": serialize_report_config(cfg)}


@router.post("/reports/send-now", dependencies=[Depends(require_permission("can_manage_settings"))])
async def send_store_report_now(
    payload: StoreReportSendRequest | None = None,
    dry_run: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.report_service import send_store_daily_digest

    effective_dry = dry_run or bool(payload.dry_run if payload else False)
    return await send_store_daily_digest(db, org_id, dry_run=effective_dry, force=not effective_dry)


@router.get("/export/{entity}", dependencies=[Depends(require_permission("can_view_orders"))])
async def export_store_csv(
    entity: str,
    db: AsyncSession = Depends(get_db),
    org_id: int = Depends(get_admin_tenant_id),
):
    from app.services.report_service import build_store_csv_export

    try:
        filename, csv_content = await build_store_csv_export(db, org_id, entity)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return Response(
        content=csv_content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
