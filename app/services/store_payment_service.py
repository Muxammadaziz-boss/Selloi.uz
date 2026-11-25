"""Per-store customer order payment generation, Telegram delivery, and webhook settlement."""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import re
import secrets
from typing import Any
from urllib.parse import urlencode

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import encrypt_secret
from app.models import (
    AuditLog,
    Conversation,
    Message,
    Order,
    Organization,
    StoreOrderPayment,
    StorePaymentConfig,
)
from app.services.realtime import publish_event
from app.services.telegram import TelegramAPIError, get_telegram_service, telegram
from app.services.tezcheck_service import TezCheckError, TezCheckService

logger = get_logger(__name__)

VALID_STORE_PAYMENT_PROVIDERS = ("tezcheck", "click", "payme", "manual_card")


def parse_amount_uzs(raw_amount: str | int | float | None) -> int:
    """Parse UZS integer amount from a freeform order price string (returns 0 if USD/unparseable)."""
    if raw_amount is None:
        return 0
    if isinstance(raw_amount, (int, float)):
        return max(0, int(raw_amount))
    text = str(raw_amount).strip()
    if not text or "$" in text or "usd" in text.lower():
        return 0
    digits = re.sub(r"[^\d]", "", text)
    if not digits:
        return 0
    try:
        return max(0, int(digits))
    except ValueError:
        return 0


def format_uzs(amount_uzs: int) -> str:
    return f"{amount_uzs:,}".replace(",", " ") + " so'm"


def build_click_checkout_url(
    *,
    service_id: str,
    merchant_id: str,
    amount_uzs: int,
    transaction_param: str,
    return_url: str = "https://selloi.uz",
) -> str:
    query = urlencode(
        {
            "service_id": service_id.strip(),
            "merchant_id": merchant_id.strip(),
            "amount": str(int(amount_uzs)),
            "transaction_param": transaction_param,
            "return_url": return_url,
        }
    )
    return f"https://my.click.uz/services/pay?{query}"


def build_payme_checkout_url(
    *,
    merchant_id: str,
    amount_uzs: int,
    order_ref: str,
) -> str:
    params = f"m={merchant_id.strip()};ac.order_id={order_ref};a={int(amount_uzs) * 100}"
    token = base64.b64encode(params.encode("utf-8")).decode("ascii")
    return f"https://checkout.paycom.uz/{token}"


def get_store_tezcheck_client(config: StorePaymentConfig) -> TezCheckService:
    """Instantiate a tenant-scoped TezCheckService using that store's decrypted credentials."""
    api_key = config.decrypted_tezcheck_api_key
    secret_key = config.decrypted_tezcheck_secret_key
    cash_desk_code = (config.tezcheck_cash_desk_code or "").strip() or None
    return TezCheckService(
        api_key=api_key,
        secret_key=secret_key,
        cash_desk_code=cash_desk_code,
    )


async def get_or_create_store_payment_config(
    db: AsyncSession,
    organization_id: int,
) -> StorePaymentConfig:
    stmt = select(StorePaymentConfig).where(StorePaymentConfig.organization_id == organization_id)
    cfg = (await db.execute(stmt)).scalar_one_or_none()
    if cfg is None:
        cfg = StorePaymentConfig(organization_id=organization_id, provider="tezcheck", is_enabled=False)
        db.add(cfg)
        await db.flush()
    return cfg


def serialize_store_payment_config(cfg: StorePaymentConfig, organization_id: int) -> dict[str, Any]:
    """Serialize config with masked credentials (never exposes plaintext API keys/secrets)."""
    card = (cfg.card_number or "").strip()
    return {
        "organization_id": organization_id,
        "provider": cfg.provider,
        "is_enabled": bool(cfg.is_enabled),
        "tezcheck_cash_desk_code": cfg.tezcheck_cash_desk_code or "",
        "tezcheck_api_key_set": bool(cfg.tezcheck_api_key),
        "tezcheck_secret_key_set": bool(cfg.tezcheck_secret_key),
        "click_service_id": cfg.click_service_id or "",
        "click_merchant_id": cfg.click_merchant_id or "",
        "payme_merchant_id": cfg.payme_merchant_id or "",
        "card_number": card,
        "card_holder": cfg.card_holder or "",
        "webhook_url": f"https://selloi.uz/api/store-payments/tezcheck/webhook/{organization_id}",
        "updated_at": cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


async def upsert_store_payment_config(
    db: AsyncSession,
    organization_id: int,
    payload: dict[str, Any],
) -> StorePaymentConfig:
    cfg = await get_or_create_store_payment_config(db, organization_id)
    provider = str(payload.get("provider") or cfg.provider or "tezcheck").strip().lower()
    if provider not in VALID_STORE_PAYMENT_PROVIDERS:
        raise ValueError(f"Noto'g'ri to'lov provayderi: {provider}")
    cfg.provider = provider
    if "is_enabled" in payload and payload["is_enabled"] is not None:
        cfg.is_enabled = bool(payload["is_enabled"])
    if "tezcheck_cash_desk_code" in payload and payload["tezcheck_cash_desk_code"] is not None:
        cfg.tezcheck_cash_desk_code = str(payload["tezcheck_cash_desk_code"]).strip() or None
    if payload.get("tezcheck_api_key"):
        cfg.tezcheck_api_key = encrypt_secret(str(payload["tezcheck_api_key"]).strip())
    if payload.get("tezcheck_secret_key"):
        cfg.tezcheck_secret_key = encrypt_secret(str(payload["tezcheck_secret_key"]).strip())
    if "click_service_id" in payload and payload["click_service_id"] is not None:
        cfg.click_service_id = str(payload["click_service_id"]).strip() or None
    if "click_merchant_id" in payload and payload["click_merchant_id"] is not None:
        cfg.click_merchant_id = str(payload["click_merchant_id"]).strip() or None
    if "payme_merchant_id" in payload and payload["payme_merchant_id"] is not None:
        cfg.payme_merchant_id = str(payload["payme_merchant_id"]).strip() or None
    if "card_number" in payload and payload["card_number"] is not None:
        cfg.card_number = str(payload["card_number"]).strip() or None
    if "card_holder" in payload and payload["card_holder"] is not None:
        cfg.card_holder = str(payload["card_holder"]).strip() or None

    await db.flush()
    return cfg


def _get_org_telegram_service(org: Organization | None):
    bot_token = org.decrypted_bot_token if org else None
    if bot_token:
        try:
            return get_telegram_service(bot_token)
        except Exception:
            pass
    return telegram


async def create_and_send_order_payment(
    db: AsyncSession,
    *,
    organization_id: int,
    order: Order,
    amount_uzs: int,
    conversation: Conversation | None = None,
    description: str | None = None,
    send_to_telegram: bool = True,
) -> dict[str, Any]:
    """Generate a store-level customer payment link/instruction and optionally send it in Telegram."""
    if amount_uzs < 1000:
        raise ValueError("To'lov summasi kamida 1 000 so'm bo'lishi kerak")

    cfg = await get_or_create_store_payment_config(db, organization_id)
    if not cfg.is_enabled:
        raise ValueError("Do'kon uchun mijozlardan to'lov qabul qilish sozlamalarda yoqilmagan.")

    org = await db.get(Organization, organization_id)
    external_ref = f"ord_{organization_id}_{order.id}_{secrets.token_hex(4)}"
    desc_text = (description or order.product_summary or f"Buyurtma #{order.id}").strip()[:250]

    provider = cfg.provider
    payment_url: str | None = None
    bill_id = external_ref

    if provider == "tezcheck":
        if not cfg.tezcheck_cash_desk_code or not cfg.tezcheck_api_key or not cfg.tezcheck_secret_key:
            raise ValueError("TezCheck kassa kodi, API kalit va maxfiy kalit to'liq kiritilmagan.")
        client = get_store_tezcheck_client(cfg)
        try:
            bill_res = await client.create_bill(
                amount=int(amount_uzs) * 100,
                currency="UZS",
                order_id=external_ref,
                description=f"{org.name if org else 'Selloi'}: {desc_text}",
                return_url=f"https://selloi.uz/?payment=success&ref={external_ref}",
                callback_url=f"https://selloi.uz/api/store-payments/tezcheck/webhook/{organization_id}",
                metadata={
                    "payment_purpose": "store_order_payment",
                    "organization_id": organization_id,
                    "order_id": order.id,
                },
            )
            bill_id = str(bill_res.get("bill_id") or external_ref)
            payment_url = bill_res.get("pay_url")
        except TezCheckError as exc:
            raise ValueError(exc.message) from exc
    elif provider == "click":
        if not cfg.click_service_id or not cfg.click_merchant_id:
            raise ValueError("Click uchun Service ID va Merchant ID kiritilmagan.")
        payment_url = build_click_checkout_url(
            service_id=cfg.click_service_id,
            merchant_id=cfg.click_merchant_id,
            amount_uzs=amount_uzs,
            transaction_param=external_ref,
        )
    elif provider == "payme":
        if not cfg.payme_merchant_id:
            raise ValueError("Payme uchun Merchant ID (Kassa ID) kiritilmagan.")
        payment_url = build_payme_checkout_url(
            merchant_id=cfg.payme_merchant_id,
            amount_uzs=amount_uzs,
            order_ref=external_ref,
        )
    elif provider == "manual_card":
        if not cfg.card_number:
            raise ValueError("Karta orqali to'lov uchun karta raqami kiritilmagan.")
        payment_url = None
    else:
        raise ValueError(f"Qo'llab-quvvatlanmaydigan provayder: {provider}")

    payment = StoreOrderPayment(
        organization_id=organization_id,
        order_id=order.id,
        conversation_id=conversation.id if conversation else order.conversation_id,
        provider=provider,
        bill_id=bill_id,
        external_reference=external_ref,
        amount_uzs=amount_uzs,
        payment_url=payment_url,
        status="pending",
        description=desc_text,
    )
    db.add(payment)

    # Link conversation to order if needed and store formatted UZS amount if unset
    if conversation and not order.conversation_id:
        order.conversation_id = conversation.id
    if not order.amount or order.amount in ("$0", "0"):
        order.amount = format_uzs(amount_uzs)
    if (order.status or "").lower() == "new":
        order.status = "Confirmed"

    await db.flush()

    telegram_sent = False
    telegram_error: str | None = None
    target_conv = conversation
    if target_conv is None and order.conversation_id:
        target_conv = await db.get(Conversation, order.conversation_id)

    if send_to_telegram and target_conv and target_conv.organization_id == organization_id:
        amount_label = format_uzs(amount_uzs)
        if payment_url:
            provider_title = {"tezcheck": "TezCheck (Uzcard/Humo/Click/Payme)", "click": "Click", "payme": "Payme"}.get(provider, provider)
            msg_text = (
                f"💳 Buyurtma #ORD-{order.id} uchun to'lov hisobi tayyor!\n\n"
                f"📦 Mahsulot: {desc_text}\n"
                f"💰 Summa: {amount_label}\n"
                f"🏦 Usul: {provider_title}\n\n"
                f"Quyidagi tugma orqali xavfsiz to'lovni amalga oshirishingiz mumkin 👇\n"
                f"{payment_url}"
            )
            markup = {
                "inline_keyboard": [
                    [{"text": f"💳 To'lash — {amount_label}", "url": payment_url}]
                ]
            }
        else:
            holder_line = f"\n👤 Karta egasi: {cfg.card_holder}" if cfg.card_holder else ""
            msg_text = (
                f"💳 Buyurtma #ORD-{order.id} uchun karta rekviziti:\n\n"
                f"📦 Mahsulot: {desc_text}\n"
                f"💰 To'lov summasi: {amount_label}\n"
                f"💳 Karta raqami: {cfg.card_number}{holder_line}\n\n"
                "To'lovni amalga oshirgach, chek rasmini shu chatga yuboring 🙏"
            )
            markup = None

        tg_svc = _get_org_telegram_service(org)
        if tg_svc and target_conv.business_connection_id:
            try:
                sent = await tg_svc.send_business_text(
                    target_conv.business_connection_id,
                    target_conv.chat_id,
                    msg_text,
                    reply_markup=markup,
                )
                msg_id = int(sent.get("message_id", 0)) if isinstance(sent, dict) else 0
                db.add(
                    Message(
                        organization_id=organization_id,
                        conversation_id=target_conv.id,
                        telegram_message_id=msg_id,
                        direction="admin",
                        text=msg_text,
                    )
                )
                target_conv.last_message_at = datetime.now(timezone.utc)
                telegram_sent = True
            except (TelegramAPIError, Exception) as exc:
                telegram_error = str(exc)
                logger.warning("Could not send Telegram payment button for order %s: %s", order.id, exc)

    db.add(
        AuditLog(
            organization_id=organization_id,
            action="store_order.payment_link_created",
            resource="order",
            resource_id=str(order.id),
            metadata_json={"provider": provider, "amount_uzs": amount_uzs, "bill_id": bill_id, "telegram_sent": telegram_sent},
        )
    )
    await db.commit()
    await db.refresh(payment)

    if telegram_sent and target_conv:
        await publish_event(
            organization_id,
            "message.created",
            {
                "conversation_id": target_conv.id,
                "direction": "admin",
                "text": f"To'lov havolasi yuborildi ({format_uzs(amount_uzs)})",
                "customer_name": target_conv.customer_name,
            },
        )

    return {
        "ok": True,
        "payment": {
            "id": payment.id,
            "bill_id": payment.bill_id,
            "external_reference": payment.external_reference,
            "provider": payment.provider,
            "amount_uzs": payment.amount_uzs,
            "payment_url": payment.payment_url,
            "status": payment.status,
        },
        "order_status": order.status,
        "telegram_sent": telegram_sent,
        "telegram_error": telegram_error,
    }


async def confirm_store_order_payment(
    db: AsyncSession,
    *,
    payment_record: StoreOrderPayment,
    notify_customer: bool = True,
) -> dict[str, Any]:
    """Settle a StoreOrderPayment idempotently, mark Order Paid, notify customer and emit SSE."""
    if payment_record.status == "paid":
        return {"ok": True, "already_paid": True, "order_id": payment_record.order_id}

    now = datetime.now(timezone.utc)
    payment_record.status = "paid"
    payment_record.paid_at = now

    order = await db.get(Order, payment_record.order_id)
    if order:
        order.status = "Paid"

    db.add(
        AuditLog(
            organization_id=payment_record.organization_id,
            action="store_order.paid",
            resource="order",
            resource_id=str(payment_record.order_id),
            metadata_json={"bill_id": payment_record.bill_id, "amount_uzs": payment_record.amount_uzs, "provider": payment_record.provider},
        )
    )
    await db.flush()

    if notify_customer and payment_record.conversation_id:
        conv = await db.get(Conversation, payment_record.conversation_id)
        org = await db.get(Organization, payment_record.organization_id)
        tg_svc = _get_org_telegram_service(org)
        if conv and tg_svc and conv.business_connection_id:
            confirm_text = (
                f"✅ To'lov qabul qilindi! ({format_uzs(payment_record.amount_uzs)})\n"
                f"Buyurtma #ORD-{payment_record.order_id} muvaffaqiyatli tasdiqlandi. Rahmat! 😊"
            )
            try:
                sent = await tg_svc.send_business_text(conv.business_connection_id, conv.chat_id, confirm_text)
                msg_id = int(sent.get("message_id", 0)) if isinstance(sent, dict) else 0
                db.add(
                    Message(
                        organization_id=payment_record.organization_id,
                        conversation_id=conv.id,
                        telegram_message_id=msg_id,
                        direction="admin",
                        text=confirm_text,
                    )
                )
                conv.last_message_at = now
            except Exception as exc:
                logger.warning("Customer payment confirmation send failed for order %s: %s", payment_record.order_id, exc)

    await db.commit()

    await publish_event(
        payment_record.organization_id,
        "order.created",
        {
            "order_id": payment_record.order_id,
            "customer_name": order.customer_name if order else "Mijoz",
            "product_summary": f"To'landi ({format_uzs(payment_record.amount_uzs)})",
            "status": "Paid",
        },
    )
    return {
        "ok": True,
        "already_paid": False,
        "order_id": payment_record.order_id,
        "bill_id": payment_record.bill_id,
        "status": "paid",
    }
