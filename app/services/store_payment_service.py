"""Per-store customer order payment generation, Telegram delivery, and webhook settlement."""

from __future__ import annotations

import base64
from datetime import datetime, timezone
import hashlib
import hmac
import re
import secrets
import time
from typing import Any
from urllib.parse import urlencode

from sqlalchemy import or_, select
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
        "click_secret_key_set": bool(cfg.click_secret_key),
        "payme_merchant_id": cfg.payme_merchant_id or "",
        "payme_secret_key_set": bool(cfg.payme_secret_key),
        "card_number": card,
        "card_holder": cfg.card_holder or "",
        "webhook_url": f"https://selloi.uz/api/store-payments/tezcheck/webhook/{organization_id}",
        "click_prepare_url": f"https://selloi.uz/api/store-payments/click/prepare/{organization_id}",
        "click_complete_url": f"https://selloi.uz/api/store-payments/click/complete/{organization_id}",
        "payme_webhook_url": f"https://selloi.uz/api/store-payments/payme/webhook/{organization_id}",
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
    if payload.get("click_secret_key"):
        cfg.click_secret_key = encrypt_secret(str(payload["click_secret_key"]).strip())
    if "payme_merchant_id" in payload and payload["payme_merchant_id"] is not None:
        cfg.payme_merchant_id = str(payload["payme_merchant_id"]).strip() or None
    if payload.get("payme_secret_key"):
        cfg.payme_secret_key = encrypt_secret(str(payload["payme_secret_key"]).strip())
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


async def _find_store_payment_by_ref(
    db: AsyncSession,
    organization_id: int,
    ref: str,
) -> StoreOrderPayment | None:
    clean_ref = str(ref or "").strip()
    if not clean_ref:
        return None
    return (
        await db.execute(
            select(StoreOrderPayment).where(
                StoreOrderPayment.organization_id == organization_id,
                or_(
                    StoreOrderPayment.external_reference == clean_ref,
                    StoreOrderPayment.bill_id == clean_ref,
                ),
            )
        )
    ).scalar_one_or_none()


async def _find_store_payment_by_tx_id(
    db: AsyncSession,
    organization_id: int,
    provider: str,
    tx_id: str,
) -> StoreOrderPayment | None:
    clean_tx = str(tx_id or "").strip()
    if not clean_tx:
        return None
    return (
        await db.execute(
            select(StoreOrderPayment).where(
                StoreOrderPayment.organization_id == organization_id,
                StoreOrderPayment.provider == provider,
                StoreOrderPayment.provider_transaction_id == clean_tx,
            )
        )
    ).scalar_one_or_none()


def _safe_int(val: Any, default: int | None = None) -> int | None:
    if val is None or val == "":
        return default
    try:
        return int(val)
    except (TypeError, ValueError):
        return default


def _click_expected_signature(
    *,
    click_trans_id: str,
    service_id: str,
    secret_key: str,
    merchant_trans_id: str,
    merchant_prepare_id: str,
    amount_raw: str,
    action_raw: str,
    sign_time: str,
) -> str:
    """Compute MD5 signature per official Click Merchant SHOP API spec."""
    if str(action_raw) == "1":
        raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{merchant_prepare_id}{amount_raw}{action_raw}{sign_time}"
    else:
        raw = f"{click_trans_id}{service_id}{secret_key}{merchant_trans_id}{amount_raw}{action_raw}{sign_time}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest().lower()


def _click_error(click_trans_id: str, merchant_trans_id: str, code: int, note: str) -> dict[str, Any]:
    return {
        "click_trans_id": click_trans_id,
        "merchant_trans_id": merchant_trans_id,
        "error": code,
        "error_note": note,
    }


async def handle_click_webhook(
    db: AsyncSession,
    *,
    organization_id: int,
    params: dict[str, Any],
    expected_action: int | None = None,
) -> dict[str, Any]:
    """Verify Click SHOP API Prepare/Complete signature and settle store order payments."""
    click_trans_id = str(params.get("click_trans_id") or "")
    service_id = str(params.get("service_id") or "")
    click_paydoc_id = str(params.get("click_paydoc_id") or "")
    merchant_trans_id = str(params.get("merchant_trans_id") or "")
    merchant_prepare_id = str(params.get("merchant_prepare_id") or "")
    amount_raw = str(params.get("amount") or "")
    action_raw = str(params.get("action") if params.get("action") is not None else "")
    error_val = _safe_int(params.get("error"), 0)
    sign_time = str(params.get("sign_time") or "")
    sign_string = str(params.get("sign_string") or "").strip().lower()

    action = _safe_int(action_raw)
    if action not in (0, 1) or (expected_action is not None and action != expected_action):
        return _click_error(click_trans_id, merchant_trans_id, -3, "Action not found")

    cfg = await get_or_create_store_payment_config(db, organization_id)
    secret_key = (cfg.decrypted_click_secret_key or "").strip()
    if not secret_key:
        return _click_error(click_trans_id, merchant_trans_id, -1, "SIGN CHECK FAILED!")
    if cfg.click_service_id and service_id and str(cfg.click_service_id).strip() != service_id.strip():
        return _click_error(click_trans_id, merchant_trans_id, -1, "SIGN CHECK FAILED!")

    expected_sig = _click_expected_signature(
        click_trans_id=click_trans_id,
        service_id=service_id,
        secret_key=secret_key,
        merchant_trans_id=merchant_trans_id,
        merchant_prepare_id=merchant_prepare_id,
        amount_raw=amount_raw,
        action_raw=str(action),
        sign_time=sign_time,
    )
    if not sign_string or not hmac.compare_digest(expected_sig, sign_string):
        return _click_error(click_trans_id, merchant_trans_id, -1, "SIGN CHECK FAILED!")

    payment = await _find_store_payment_by_ref(db, organization_id, merchant_trans_id)
    if payment is None:
        return _click_error(click_trans_id, merchant_trans_id, -5, "Order does not exist")

    try:
        paid_uzs = int(round(float(amount_raw)))
    except (TypeError, ValueError):
        return _click_error(click_trans_id, merchant_trans_id, -2, "Incorrect parameter amount")

    if paid_uzs != int(payment.amount_uzs):
        return _click_error(click_trans_id, merchant_trans_id, -2, "Incorrect parameter amount")

    if payment.status == "cancelled":
        return _click_error(click_trans_id, merchant_trans_id, -9, "Transaction cancelled")

    if action == 0:
        if payment.status == "paid":
            return _click_error(click_trans_id, merchant_trans_id, -4, "Already paid")
        payment.provider = "click"
        payment.provider_transaction_id = click_trans_id or payment.provider_transaction_id
        meta = dict(payment.payment_meta or {})
        meta["click"] = {
            "click_trans_id": click_trans_id,
            "click_paydoc_id": click_paydoc_id,
            "sign_time": sign_time,
            "prepared_at": datetime.now(timezone.utc).isoformat(),
        }
        payment.payment_meta = meta
        await db.commit()
        return {
            "click_trans_id": click_trans_id,
            "merchant_trans_id": merchant_trans_id,
            "merchant_prepare_id": payment.id,
            "error": 0,
            "error_note": "Success",
        }

    # action == 1 (Complete)
    if merchant_prepare_id and str(payment.id) != str(merchant_prepare_id).strip():
        return _click_error(click_trans_id, merchant_trans_id, -6, "Transaction does not exist")

    if error_val is not None and error_val < 0:
        payment.status = "cancelled"
        meta = dict(payment.payment_meta or {})
        meta["click"] = {**(meta.get("click") or {}), "cancelled_error": error_val}
        payment.payment_meta = meta
        await db.commit()
        return _click_error(click_trans_id, merchant_trans_id, -9, "Transaction cancelled")

    if payment.status == "paid":
        return _click_error(click_trans_id, merchant_trans_id, -4, "Already paid")

    payment.provider = "click"
    payment.provider_transaction_id = click_trans_id or payment.provider_transaction_id
    meta = dict(payment.payment_meta or {})
    meta["click"] = {
        **(meta.get("click") or {}),
        "click_trans_id": click_trans_id,
        "click_paydoc_id": click_paydoc_id,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    payment.payment_meta = meta
    await confirm_store_order_payment(db, payment_record=payment, notify_customer=True)
    return {
        "click_trans_id": click_trans_id,
        "merchant_trans_id": merchant_trans_id,
        "merchant_confirm_id": payment.id,
        "error": 0,
        "error_note": "Success",
    }


def _payme_error(rpc_id: Any, code: int, message: str, data: str | None = None) -> dict[str, Any]:
    err: dict[str, Any] = {
        "code": code,
        "message": {"uz": message, "ru": message, "en": message},
    }
    if data:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": rpc_id, "error": err}


def _payme_ok(rpc_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rpc_id, "result": result}


def _verify_payme_basic_auth(auth_header: str | None, expected_secret: str | None) -> bool:
    if not auth_header or not expected_secret:
        return False
    parts = auth_header.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "basic":
        return False
    try:
        decoded = base64.b64decode(parts[1].strip()).decode("utf-8")
    except Exception:
        return False
    if ":" not in decoded:
        return False
    username, password = decoded.split(":", 1)
    return username == "Paycom" and hmac.compare_digest(password, expected_secret)


def _extract_payme_order_ref(params: dict[str, Any]) -> str:
    account = params.get("account")
    if not isinstance(account, dict):
        return ""
    for key in ("order_id", "order", "reference", "bill_id"):
        val = account.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


async def handle_payme_jsonrpc(
    db: AsyncSession,
    *,
    organization_id: int,
    authorization_header: str | None,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Handle Payme Merchant API JSON-RPC 2.0 protocol for store order payments."""
    rpc_id = payload.get("id")
    method = str(payload.get("method") or "").strip()
    params = payload.get("params") or {}
    if not isinstance(params, dict):
        return _payme_error(rpc_id, -32602, "Invalid params")

    cfg = await get_or_create_store_payment_config(db, organization_id)
    if not _verify_payme_basic_auth(authorization_header, cfg.decrypted_payme_secret_key):
        return _payme_error(rpc_id, -32504, "Insufficient privilege to perform this method")

    now_ms = int(time.time() * 1000)

    if method == "CheckPerformTransaction":
        order_ref = _extract_payme_order_ref(params)
        payment = await _find_store_payment_by_ref(db, organization_id, order_ref)
        if payment is None:
            return _payme_error(rpc_id, -31050, "Buyurtma topilmadi", data="order_id")
        if payment.status == "paid":
            return _payme_error(rpc_id, -31051, "Buyurtma allaqachon to'langan", data="order_id")
        if payment.status == "cancelled":
            return _payme_error(rpc_id, -31008, "Tranzaksiya bekor qilingan")
        req_amount = _safe_int(params.get("amount"), -1)
        if req_amount != int(payment.amount_uzs) * 100:
            return _payme_error(rpc_id, -31001, "To'lov summasi mos kelmadi", data="amount")
        return _payme_ok(rpc_id, {"allow": True})

    if method == "CreateTransaction":
        tx_id = str(params.get("id") or "").strip()
        order_ref = _extract_payme_order_ref(params)
        if not tx_id or not order_ref:
            return _payme_error(rpc_id, -31050, "Buyurtma yoki tranzaksiya ID ko'rsatilmagan")

        payment = await _find_store_payment_by_ref(db, organization_id, order_ref)
        if payment is None:
            return _payme_error(rpc_id, -31050, "Buyurtma topilmadi", data="order_id")

        req_amount = _safe_int(params.get("amount"), -1)
        if req_amount != int(payment.amount_uzs) * 100:
            return _payme_error(rpc_id, -31001, "To'lov summasi mos kelmadi", data="amount")

        payme_meta = dict((payment.payment_meta or {}).get("payme") or {})
        existing_tx = payment.provider_transaction_id
        if existing_tx == tx_id and payme_meta.get("state") == 1:
            return _payme_ok(
                rpc_id,
                {
                    "create_time": int(payme_meta.get("create_time") or now_ms),
                    "transaction": str(payment.id),
                    "state": 1,
                },
            )
        if payment.status == "paid" or (existing_tx and existing_tx != tx_id and payme_meta.get("state") == 1):
            return _payme_error(rpc_id, -31008, "Tranzaksiya holati bu amalni bajara olmaydi")

        create_time = _safe_int(params.get("time"), now_ms) or now_ms
        payment.provider = "payme"
        payment.provider_transaction_id = tx_id
        meta = dict(payment.payment_meta or {})
        meta["payme"] = {
            "id": tx_id,
            "create_time": create_time,
            "perform_time": 0,
            "cancel_time": 0,
            "transaction": str(payment.id),
            "state": 1,
            "reason": None,
        }
        payment.payment_meta = meta
        await db.commit()
        return _payme_ok(
            rpc_id,
            {
                "create_time": create_time,
                "transaction": str(payment.id),
                "state": 1,
            },
        )

    if method == "PerformTransaction":
        tx_id = str(params.get("id") or "").strip()
        payment = await _find_store_payment_by_tx_id(db, organization_id, "payme", tx_id)
        if payment is None:
            return _payme_error(rpc_id, -31003, "Tranzaksiya topilmadi")
        meta = dict(payment.payment_meta or {})
        payme_meta = dict(meta.get("payme") or {})
        state = payme_meta.get("state")
        if state == 2 or payment.status == "paid":
            return _payme_ok(
                rpc_id,
                {
                    "transaction": str(payment.id),
                    "perform_time": int(payme_meta.get("perform_time") or now_ms),
                    "state": 2,
                },
            )
        if state != 1 or payment.status == "cancelled":
            return _payme_error(rpc_id, -31008, "Tranzaksiya holati yakunlashga mos emas")

        perform_time = now_ms
        payme_meta.update({"state": 2, "perform_time": perform_time})
        meta["payme"] = payme_meta
        payment.payment_meta = meta
        await confirm_store_order_payment(db, payment_record=payment, notify_customer=True)
        return _payme_ok(
            rpc_id,
            {
                "transaction": str(payment.id),
                "perform_time": perform_time,
                "state": 2,
            },
        )

    if method == "CancelTransaction":
        tx_id = str(params.get("id") or "").strip()
        reason = _safe_int(params.get("reason"), 1)
        payment = await _find_store_payment_by_tx_id(db, organization_id, "payme", tx_id)
        if payment is None:
            return _payme_error(rpc_id, -31003, "Tranzaksiya topilmadi")
        meta = dict(payment.payment_meta or {})
        payme_meta = dict(meta.get("payme") or {})
        current_state = payme_meta.get("state")
        if current_state in (-1, -2):
            return _payme_ok(
                rpc_id,
                {
                    "transaction": str(payment.id),
                    "cancel_time": int(payme_meta.get("cancel_time") or now_ms),
                    "state": current_state,
                },
            )
        cancel_state = -2 if (current_state == 2 or payment.status == "paid") else -1
        cancel_time = now_ms
        payme_meta.update({"state": cancel_state, "cancel_time": cancel_time, "reason": reason})
        meta["payme"] = payme_meta
        payment.payment_meta = meta
        payment.status = "cancelled"
        order = await db.get(Order, payment.order_id)
        if order and order.organization_id == organization_id and (order.status or "").lower() != "completed":
            order.status = "Cancelled"
        await db.commit()
        return _payme_ok(
            rpc_id,
            {
                "transaction": str(payment.id),
                "cancel_time": cancel_time,
                "state": cancel_state,
            },
        )

    if method == "CheckTransaction":
        tx_id = str(params.get("id") or "").strip()
        payment = await _find_store_payment_by_tx_id(db, organization_id, "payme", tx_id)
        if payment is None:
            return _payme_error(rpc_id, -31003, "Tranzaksiya topilmadi")
        payme_meta = dict((payment.payment_meta or {}).get("payme") or {})
        return _payme_ok(
            rpc_id,
            {
                "create_time": int(payme_meta.get("create_time") or 0),
                "perform_time": int(payme_meta.get("perform_time") or 0),
                "cancel_time": int(payme_meta.get("cancel_time") or 0),
                "transaction": str(payment.id),
                "state": int(payme_meta.get("state") or 1),
                "reason": payme_meta.get("reason"),
            },
        )

    if method == "GetStatement":
        from_ms = _safe_int(params.get("from"), 0) or 0
        to_ms = _safe_int(params.get("to"), now_ms) or now_ms
        rows = (
            await db.execute(
                select(StoreOrderPayment).where(
                    StoreOrderPayment.organization_id == organization_id,
                    StoreOrderPayment.provider == "payme",
                    StoreOrderPayment.provider_transaction_id.isnot(None),
                )
            )
        ).scalars().all()
        txs = []
        for p in rows:
            pm = (p.payment_meta or {}).get("payme") or {}
            ctime = int(pm.get("create_time") or 0)
            if from_ms <= ctime <= to_ms:
                txs.append(
                    {
                        "id": p.provider_transaction_id,
                        "time": ctime,
                        "amount": int(p.amount_uzs) * 100,
                        "account": {"order_id": p.external_reference},
                        "create_time": ctime,
                        "perform_time": int(pm.get("perform_time") or 0),
                        "cancel_time": int(pm.get("cancel_time") or 0),
                        "transaction": str(p.id),
                        "state": int(pm.get("state") or 1),
                        "reason": pm.get("reason"),
                    }
                )
        return _payme_ok(rpc_id, {"transactions": txs})

    return _payme_error(rpc_id, -32601, f"Method not found: {method}")
