"""Per-store daily Telegram digest reports and UTF-8 BOM CSV export generators."""

import csv
import io
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import decrypt_secret
from app.models import (
    Admin,
    AuditLog,
    Conversation,
    Customer,
    Message,
    Order,
    Organization,
    OrganizationMember,
    Product,
    StoreOrderPayment,
    StoreReportConfig,
    User,
)
from app.services import telegram as telegram_module

logger = get_logger(__name__)
TASHKENT_TZ = timezone(timedelta(hours=5))


def serialize_report_config(cfg: StoreReportConfig) -> dict:
    return {
        "organization_id": cfg.organization_id,
        "is_enabled": bool(cfg.is_enabled),
        "send_hour": int(cfg.send_hour),
        "include_orders": bool(cfg.include_orders),
        "include_customers": bool(cfg.include_customers),
        "last_sent_date": cfg.last_sent_date,
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


async def get_or_create_report_config(db: AsyncSession, organization_id: int) -> StoreReportConfig:
    cfg = (
        await db.execute(
            select(StoreReportConfig).where(StoreReportConfig.organization_id == organization_id)
        )
    ).scalar_one_or_none()
    if cfg is None:
        cfg = StoreReportConfig(organization_id=organization_id)
        db.add(cfg)
        await db.flush()
    return cfg


async def upsert_report_config(db: AsyncSession, organization_id: int, payload: dict) -> StoreReportConfig:
    cfg = await get_or_create_report_config(db, organization_id)
    if "is_enabled" in payload and payload["is_enabled"] is not None:
        cfg.is_enabled = bool(payload["is_enabled"])
    if "send_hour" in payload and payload["send_hour"] is not None:
        hr = int(payload["send_hour"])
        if hr < 0 or hr > 23:
            raise ValueError("Yuborish soati 0 dan 23 gacha bo'lishi kerak")
        cfg.send_hour = hr
    if "include_orders" in payload and payload["include_orders"] is not None:
        cfg.include_orders = bool(payload["include_orders"])
    if "include_customers" in payload and payload["include_customers"] is not None:
        cfg.include_customers = bool(payload["include_customers"])
    cfg.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return cfg


async def build_store_daily_digest(
    db: AsyncSession,
    organization_id: int,
    *,
    include_orders: bool = True,
    include_customers: bool = True,
    now_utc: datetime | None = None,
) -> dict:
    """Compute today's Tashkent metrics and formatted Telegram report text for one store."""
    now = now_utc or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local_now = now.astimezone(TASHKENT_TZ)
    day_start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_start_utc = day_start_local.astimezone(timezone.utc)

    org = await db.get(Organization, organization_id)
    store_name = org.name if org else f"Do'kon #{organization_id}"

    new_convs_today = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.organization_id == organization_id,
            Conversation.created_at >= day_start_utc,
        )
    ) or 0
    total_convs = await db.scalar(
        select(func.count(Conversation.id)).where(Conversation.organization_id == organization_id)
    ) or 0
    ai_active_convs = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.organization_id == organization_id,
            Conversation.status == "ai_active",
        )
    ) or 0
    takeover_convs = await db.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.organization_id == organization_id,
            Conversation.status == "human_takeover",
        )
    ) or 0
    messages_today = await db.scalar(
        select(func.count(Message.id)).where(
            Message.organization_id == organization_id,
            Message.created_at >= day_start_utc,
        )
    ) or 0
    products_count = await db.scalar(
        select(func.count(Product.id)).where(
            Product.organization_id == organization_id,
            Product.is_active.is_(True),
        )
    ) or 0

    new_orders_today = await db.scalar(
        select(func.count(Order.id)).where(
            Order.organization_id == organization_id,
            Order.created_at >= day_start_utc,
        )
    ) or 0
    confirmed_orders_today = await db.scalar(
        select(func.count(Order.id)).where(
            Order.organization_id == organization_id,
            Order.created_at >= day_start_utc,
            Order.status.in_(["confirmed", "paid", "completed", "delivered"]),
        )
    ) or 0
    total_orders = await db.scalar(
        select(func.count(Order.id)).where(Order.organization_id == organization_id)
    ) or 0
    paid_uzs_today = await db.scalar(
        select(func.sum(StoreOrderPayment.amount_uzs)).where(
            StoreOrderPayment.organization_id == organization_id,
            StoreOrderPayment.status == "paid",
            StoreOrderPayment.paid_at >= day_start_utc,
        )
    ) or 0

    date_label = local_now.strftime("%d.%m.%Y")
    time_label = local_now.strftime("%H:%M")

    lines = [
        f"Kunlik Do'kon Hisoboti - {store_name}",
        f"Sana: {date_label} ({time_label}, Toshkent)",
        "",
    ]
    if include_customers:
        lines.extend([
            "Mijozlar va Suhbatlar:",
            f"- Bugungi yangi suhbatlar: {new_convs_today} ta (Jami: {total_convs} ta)",
            f"- Bugungi xabarlar: {messages_today} ta",
            f"- Holat: AI faol {ai_active_convs} ta | Operator {takeover_convs} ta",
            "",
        ])
    if include_orders:
        paid_formatted = f"{int(paid_uzs_today):,}".replace(",", " ")
        lines.extend([
            "Buyurtmalar va Savdo:",
            f"- Bugungi buyurtmalar: {new_orders_today} ta (Tasdiqlangan: {confirmed_orders_today} ta)",
            f"- Bugungi onlayn to'lovlar: {paid_formatted} so'm",
            f"- Jami buyurtmalar bazada: {total_orders} ta",
            "",
        ])
    lines.append(f"Faol mahsulotlar katalogi: {products_count} ta")

    return {
        "organization_id": organization_id,
        "store_name": store_name,
        "date": local_now.strftime("%Y-%m-%d"),
        "report_text": "\n".join(lines),
        "metrics": {
            "new_conversations_today": new_convs_today,
            "total_conversations": total_convs,
            "ai_active_conversations": ai_active_convs,
            "human_takeover_conversations": takeover_convs,
            "messages_today": messages_today,
            "new_orders_today": new_orders_today,
            "confirmed_orders_today": confirmed_orders_today,
            "total_orders": total_orders,
            "paid_uzs_today": int(paid_uzs_today),
            "products_count": products_count,
        },
    }


async def _collect_store_admin_telegram_ids(db: AsyncSession, organization_id: int) -> list[int]:
    ids: list[int] = []
    admin_rows = await db.execute(
        select(Admin.telegram_user_id).where(
            Admin.organization_id == organization_id,
            Admin.is_active.is_(True),
        )
    )
    for (tid,) in admin_rows.all():
        if tid and int(tid) not in ids:
            ids.append(int(tid))

    mem_rows = await db.execute(
        select(User.telegram_user_id)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.is_active.is_(True),
            User.is_active.is_(True),
            User.telegram_user_id.is_not(None),
        )
    )
    for (tid,) in mem_rows.all():
        if tid and int(tid) not in ids:
            ids.append(int(tid))
    return ids


async def send_store_daily_digest(
    db: AsyncSession,
    organization_id: int,
    *,
    dry_run: bool = False,
    force: bool = False,
    now_utc: datetime | None = None,
) -> dict:
    """Build and send daily digest for one store to its active Telegram admins/owners."""
    cfg = await get_or_create_report_config(db, organization_id)
    now = now_utc or datetime.now(timezone.utc)
    digest = await build_store_daily_digest(
        db,
        organization_id,
        include_orders=cfg.include_orders,
        include_customers=cfg.include_customers,
        now_utc=now,
    )
    recipients = await _collect_store_admin_telegram_ids(db, organization_id)

    if dry_run:
        return {
            **digest,
            "dry_run": True,
            "recipient_count": len(recipients),
            "sent_count": 0,
            "config": serialize_report_config(cfg),
        }

    org = await db.get(Organization, organization_id)
    tg_svc = None
    if org and org.telegram_bot_token:
        try:
            raw_token = decrypt_secret(org.telegram_bot_token)
            if raw_token:
                tg_svc = telegram_module.get_telegram_service(raw_token)
        except Exception:
            tg_svc = None
    if tg_svc is None:
        tg_svc = telegram_module.telegram

    sent_count = 0
    if tg_svc is not None:
        for chat_id in recipients:
            try:
                await tg_svc.send_message(chat_id, digest["report_text"])
                sent_count += 1
            except Exception as exc:
                logger.warning("Store daily digest failed org=%s chat=%s: %s", organization_id, chat_id, exc)

    if sent_count > 0 or force:
        cfg.last_sent_date = digest["date"]
        cfg.updated_at = datetime.now(timezone.utc)
        db.add(
            AuditLog(
                organization_id=organization_id,
                action="store_report.sent",
                resource="store_report",
                resource_id=str(organization_id),
                metadata_json={"date": digest["date"], "sent_count": sent_count, "recipients": len(recipients)},
            )
        )
        await db.commit()

    return {
        **digest,
        "dry_run": False,
        "recipient_count": len(recipients),
        "sent_count": sent_count,
        "config": serialize_report_config(cfg),
    }


async def run_all_enabled_store_reports(db: AsyncSession, *, now_utc: datetime | None = None) -> int:
    """Background sweep: send due daily Telegram reports for stores matching Tashkent send_hour."""
    now = now_utc or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local_now = now.astimezone(TASHKENT_TZ)
    today_str = local_now.strftime("%Y-%m-%d")

    cfgs = (
        await db.execute(select(StoreReportConfig).where(StoreReportConfig.is_enabled.is_(True)))
    ).scalars().all()

    total_sent = 0
    for cfg in cfgs:
        if cfg.last_sent_date == today_str:
            continue
        if local_now.hour < int(cfg.send_hour):
            continue
        try:
            res = await send_store_daily_digest(db, cfg.organization_id, dry_run=False, force=False, now_utc=now)
            total_sent += int(res.get("sent_count") or 0)
        except Exception as exc:
            logger.warning("Scheduled daily report failed org=%s: %s", cfg.organization_id, exc)
    return total_sent


async def build_store_csv_export(db: AsyncSession, organization_id: int, entity: str) -> tuple[str, str]:
    """Generate UTF-8 BOM CSV export string for orders, customers, or products of a tenant."""
    clean_entity = (entity or "").strip().lower()
    if clean_entity not in {"orders", "customers", "products"}:
        raise ValueError("Eksport turi 'orders', 'customers' yoki 'products' bo'lishi kerak")

    org = await db.get(Organization, organization_id)
    slug = org.slug if org else f"org-{organization_id}"
    date_tag = datetime.now(TASHKENT_TZ).strftime("%Y-%m-%d")

    buf = io.StringIO()
    writer = csv.writer(buf)

    if clean_entity == "orders":
        writer.writerow(["ID", "Mijoz", "Telefon", "Mahsulot", "Summa", "Holat", "Manzil", "Izoh", "Sana"])
        rows = (
            await db.execute(
                select(Order)
                .where(Order.organization_id == organization_id)
                .order_by(Order.created_at.desc())
            )
        ).scalars().all()
        for o in rows:
            writer.writerow([
                f"ORD-{1000 + o.id}",
                o.customer_name,
                o.phone,
                o.product_summary,
                o.amount,
                o.status,
                o.delivery_address,
                o.notes,
                o.created_at.isoformat() if o.created_at else "",
            ])
        return f"{slug}-buyurtmalar-{date_tag}.csv", "\ufeff" + buf.getvalue()

    if clean_entity == "customers":
        writer.writerow(["Suhbat ID", "Mijoz", "Username", "Chat ID", "Holat", "Qayta yo'naltirish sababi", "Oxirgi xabar"])
        convs = (
            await db.execute(
                select(Conversation)
                .where(Conversation.organization_id == organization_id)
                .order_by(Conversation.last_message_at.desc())
            )
        ).scalars().all()
        for c in convs:
            writer.writerow([
                c.id,
                c.customer_name,
                f"@{c.username}" if c.username else "",
                c.chat_id,
                c.status,
                c.handoff_reason or "",
                c.last_message_at.isoformat() if c.last_message_at else "",
            ])
        return f"{slug}-mijozlar-{date_tag}.csv", "\ufeff" + buf.getvalue()

    # products
    writer.writerow(["Kod", "Nomi", "Kategoriya", "Narx", "Zaxira", "Kafolat", "Xususiyatlar", "Faol"])
    prods = (
        await db.execute(
            select(Product)
            .where(Product.organization_id == organization_id, Product.is_active.is_(True))
            .order_by(Product.id.desc())
        )
    ).scalars().all()
    for p in prods:
        writer.writerow([
            p.code,
            p.name,
            p.category,
            p.price,
            p.stock,
            p.warranty,
            p.specs,
            "Ha" if p.is_active else "Yo'q",
        ])
    return f"{slug}-mahsulotlar-{date_tag}.csv", "\ufeff" + buf.getvalue()
