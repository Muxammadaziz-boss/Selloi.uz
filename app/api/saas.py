"""SaaS Public & Tenant Endpoints (Plans, Subscriptions, Usage, Billing, Organizations)."""

import asyncio
from datetime import datetime, timezone
import secrets
from typing import Any, Optional
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.core.security import encrypt_secret
from app.models import Admin, CustomerPricing, Organization, OrganizationMember, PaymentBill, Plan, Subscription, SubscriptionConsent, User, WebhookEvent
from app.services.billing_service import billing_service
from app.services.bot_manager import bot_manager
from app.services.entitlement_service import entitlement_service
from app.services.pricing_service import format_currency_amount, pricing_cache, pricing_service
from app.services.centralized_pricing_service import (
    centralized_pricing_service,
    PERIOD_MEGA_DISCOUNT_7D,
    PERIOD_MONTHLY,
    PERIOD_YEARLY,
    SUPPORTED_TARIFF_CODES,
    normalize_tariff_code
)
from app.services.subscription_service import (
    subscription_service,
    MEGA_DISCOUNT_RATES,
    MEGA_DISCOUNT_EXPIRED_NOTIFICATION,
    IneligibleForMegaDiscountError,
    SubscriptionError,
)
from app.services.tezcheck_service import tezcheck_service, TezCheckError, TezCheckSignatureVerificationError
from app.services.telegram import get_telegram_service
from app.services.saas_service import (
    cancel_organization_subscription,
    create_organization_with_trial,
    get_organization_details,
    get_organization_subscription,
    get_user_organizations,
    resume_organization_subscription,
    upgrade_organization_plan,
)
from app.services.usage_service import usage_service

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["saas"])


# --- Schemas ---

class UpgradeRequest(BaseModel):
    new_plan_code: str
    billing_cycle: str = "monthly"  # monthly or yearly
    return_url: str = "/settings/billing?status=upgrade_success"


class CreateOrgRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    slug: str | None = None
    category: str = "Retail"
    plan_code: str = "start"
    telegram_bot_token: str | None = None
    telegram_channel: str | None = None
    channel: str | None = None  # alias from onboarding payload
    telegram_api_id: int | None = None
    telegram_api_hash: str | None = None
    telegram_phone: str | None = None
    admin_chat_id: str | None = None
    api_id: int | None = None  # alias
    api_hash: str | None = None  # alias
    phone: str | None = None  # alias
    ai_language: str = "uz"
    ai_personality: str | None = None
    custom_system_prompt: str | None = None


class VerifyTokenRequest(BaseModel):
    token: str


class VerifyChannelRequest(BaseModel):
    channel: str


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    category: str | None = None
    ai_language: str | None = None
    ai_personality: str | None = None
    custom_system_prompt: str | None = None
    telegram_bot_token: str | None = None
    telegram_api_id: int | None = None
    telegram_api_hash: str | None = None
    telegram_phone: str | None = None
    admin_chat_id: str | None = None
    openai_api_key: str | None = None
    gemini_api_key: str | None = None


class CheckoutRequest(BaseModel):
    plan_code: str
    billing_cycle: str = "monthly"
    success_url: str = "/settings/billing?status=success"
    cancel_url: str = "/settings/billing?status=cancelled"


class MegaDiscountCheckoutRequest(BaseModel):
    plan_code: str
    return_url: str = "/settings/billing?status=promo_success"


class SubscriptionCheckoutRequest(BaseModel):
    plan_code: str
    billing_cycle: str = "monthly"  # monthly, yearly
    return_url: str = "/settings/billing?status=sub_success"


class SubscriptionConsentRequest(BaseModel):
    billing_cycle: str  # monthly, yearly
    agreed_amount: int
    accepted_terms_version: str = "v1.0"


# --- Tenant & Auth Resolvers ---

from app.api.admin import get_current_admin
from app.dependencies.auth import get_current_user, get_verified_user
from app.dependencies.tenant import get_admin_tenant_id
from app.services import admin_service


async def resolve_organization_id(
    x_organization_id: str | None = Header(default=None),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> int:
    """Resolve active tenant organization_id and strictly enforce verified membership."""
    return await get_admin_tenant_id(
        current_admin=admin,
        x_organization_id=x_organization_id,
        db=db,
    )


def require_saas_permission(perm: str):
    """Enforce granular RBAC permission for tenant organization actions."""
    async def dependency(
        admin: Admin = Depends(get_current_admin),
        org_id: int = Depends(resolve_organization_id),
    ) -> Admin:
        if not admin_service.has_permission(admin, perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sizda ushbu amal uchun ruxsat yo'q: {perm}",
            )
        return admin
    return dependency


# --- Endpoints ---

@router.get("/plans")
async def list_plans(
    currency: str = "UZS",
    billing_cycle: str = "monthly",
    response: Response = None,
    db: AsyncSession = Depends(get_db),
):
    """Authoritative public catalog of subscription plans denominated in UZS with caching."""
    clean_currency = currency.upper().strip()
    clean_cycle = billing_cycle.lower().strip()
    if clean_currency not in ("USD", "UZS"):
        clean_currency = "UZS"
    if clean_cycle not in ("monthly", "yearly"):
        clean_cycle = "monthly"

    cached = pricing_cache.get_public_plans(clean_currency, clean_cycle)
    if cached:
        if response:
            response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
            response.headers["X-Cache"] = "HIT"
        return cached

    active_tariffs = await centralized_pricing_service.get_active_tariffs(db)

    # Dynamic mega discount rates derived from database approved tariffs
    dynamic_mega_rates = {}
    plans_payload = []
    for t in active_tariffs:
        code = t["code"]
        promo_info = t["pricing"][PERIOD_MEGA_DISCOUNT_7D]
        monthly_info = t["pricing"][PERIOD_MONTHLY]
        yearly_info = t["pricing"][PERIOD_YEARLY]

        dynamic_mega_rates[code] = {
            "usd_equivalent": 1 if code == "start" else (2 if code == "pro" else 3),
            "amount_uzs": promo_info["amount_uzs"],
            "amount_tiyin": promo_info["amount_tiyin"],
            "duration_days": 7,
            "label": promo_info["label"]
        }

        plans_payload.append({
            "id": t["id"],
            "code": code,
            "name": t["name"],
            "description": t["description"],
            "display_order": t["display_order"],
            "price_version": t["price_version"],
            "price_promo_uzs": promo_info["amount_tiyin"],
            "price_monthly_uzs": monthly_info["amount_tiyin"],
            "price_yearly_uzs": yearly_info["amount_tiyin"],
            "price_promo_formatted": promo_info["formatted"],
            "price_monthly_formatted": monthly_info["formatted"],
            "price_yearly_formatted": yearly_info["formatted"],
            "price_monthly_uzs_formatted": monthly_info["formatted"],
            "price_yearly_uzs_formatted": yearly_info["formatted"],
            "currency": "UZS",
            "is_featured": t["is_featured"],
            "is_public": True,
            "pricing": t["pricing"],
            "features": t["features"],
            "limits": t["limits"],
        })

    payload = {
        "success": True,
        "currency": clean_currency,
        "billing_cycle": clean_cycle,
        "mega_discount_rates": dynamic_mega_rates,
        "supported_billing_cycles": ["monthly", "yearly"],
        "weekly_subscription_supported": False,
        "plans": plans_payload,
    }

    pricing_cache.set_public_plans(clean_currency, clean_cycle, payload, ttl_seconds=60)
    if response:
        response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
        response.headers["X-Cache"] = "MISS"

    return payload


@router.get("/pricing/checkout-quote")
async def get_checkout_quote(
    plan_code: str,
    billing_interval: str = "monthly",
    currency: str = "USD",
    org_id: int = Depends(resolve_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Server-authoritative customer checkout quote.

    Evaluates customer-specific discounts before global rates.
    Never accepts client-submitted prices and guarantees tenant isolation.
    """
    try:
        quote_result = await pricing_service.resolve_pricing(
            db=db,
            organization_id=org_id,
            plan_code=plan_code,
            billing_interval=billing_interval,
            currency=currency,
            require_public=True,
        )
        return quote_result.to_quote_dict()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/subscription")
async def get_subscription(
    org_id: int = Depends(resolve_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Active subscription, plan info, mega discount status, expiration for current tenant."""
    return await subscription_service.get_subscription_overview(db, org_id)


@router.post("/subscription/upgrade")
async def upgrade_plan(
    req: UpgradeRequest,
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Initiate tenant subscription plan upgrade by generating a verified TezCheck payment order.

    CRITICAL SECURITY ENFORCEMENT:
    Free/direct activation without verified payment proof is strictly forbidden.
    Subscription entitlement upgrades exclusively upon cryptographic webhook receipt.
    """
    try:
        user_id = admin.user_id if admin.user_id else 1
        checkout = await subscription_service.create_subscription_checkout(
            db=db,
            organization_id=org_id,
            user_id=user_id,
            plan_code=req.new_plan_code,
            billing_cycle=req.billing_cycle,
            return_url=getattr(req, "return_url", "/settings/billing?status=upgrade_success"),
        )
        return {
            "status": "payment_required",
            "message": "Tarifni yangilash uchun to'lov hisobi yaratildi. To'lov tasdiqlangach obuna faollashadi.",
            "checkout_url": checkout["checkout_url"],
            "bill_id": checkout["bill_id"],
            "order_id": checkout["order_id"],
            "plan_code": checkout["plan_code"],
            "billing_cycle": checkout["billing_cycle"],
            "amount_uzs": checkout["amount_uzs"],
            "amount_tiyin": checkout["amount_tiyin"],
        }
    except (SubscriptionError, TezCheckError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/subscription/cancel")
async def cancel_subscription(
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Cancel subscription at the end of current billing period."""
    try:
        updated = await cancel_organization_subscription(db, org_id)
        return {"status": "cancelled", "subscription": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/subscription/resume")
async def resume_subscription(
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Resume a cancelled subscription before period ends."""
    try:
        updated = await resume_organization_subscription(db, org_id)
        return {"status": "active", "subscription": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/usage")
async def get_usage(
    org_id: int = Depends(resolve_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Usage dashboard with visual progress percentages and warning states."""
    dash = await usage_service.get_usage_dashboard(db, org_id)
    return dash


@router.get("/entitlements")
async def get_entitlements(
    org_id: int = Depends(resolve_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List of all feature entitlements and limits for the current tenant."""
    data = await entitlement_service.get_all_entitlements(db, org_id)
    return data


@router.get("/entitlements/check/{feature_key}")
async def check_feature_entitlement(
    feature_key: str,
    org_id: int = Depends(resolve_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Check a single feature entitlement for the current tenant."""
    has_it = await entitlement_service.has_feature(db, org_id, feature_key)
    return {"feature": feature_key, "has_access": has_it, "organization_id": org_id}


@router.get("/organizations")
async def list_user_organizations(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all organizations accessible to the authenticated user."""
    user: User | None = getattr(admin, "_user", None)
    if user is None and admin and admin.telegram_user_id:
        u_res = await db.execute(select(User).where(User.telegram_user_id == admin.telegram_user_id))
        user = u_res.scalar_one_or_none()

    if user is not None:
        orgs = await get_user_organizations(db, user.id)
        if orgs:
            return {"organizations": orgs}

    if admin and admin.organization_id:
        org = await get_organization_details(db, admin.organization_id)
        return {"organizations": [org] if org else []}

    if getattr(admin, "_is_platform_owner", False) or getattr(admin, "_is_platform_admin", False):
        return {"organizations": []}

    raise HTTPException(status_code=403, detail="Siz hech qaysi tashkilotga a'zo emassiz")


@router.post("/organizations")
async def create_organization(
    req: CreateOrgRequest,
    user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Onboarding endpoint: create a new organization with 7-day free trial."""
    chosen_channel = (req.telegram_channel or req.channel or "").strip() or None
    chosen_api_id = req.telegram_api_id or req.api_id
    chosen_api_hash = (req.telegram_api_hash or req.api_hash or "").strip() or None
    chosen_phone = (req.telegram_phone or req.phone or "").strip() or None
    chosen_admin_chat_id = (req.admin_chat_id or "").strip() or None

    org = await create_organization_with_trial(
        db,
        user=user,
        name=req.name,
        slug=req.slug or "",
        category=req.category,
        plan_code=req.plan_code,
        trial_days=7,
        telegram_bot_token=req.telegram_bot_token,
        telegram_channel=chosen_channel,
        telegram_api_id=chosen_api_id,
        telegram_api_hash=chosen_api_hash,
        telegram_phone=chosen_phone,
        admin_chat_id=chosen_admin_chat_id,
        ai_language=req.ai_language,
        ai_personality=req.ai_personality,
        custom_system_prompt=req.custom_system_prompt,
    )
    # Ensure bot worker is actively polling or webhook registered for this new tenant
    asyncio.create_task(bot_manager.restart_org(org.id))

    return {
        "status": "created",
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "category": org.category,
            "trial_days": 7,
            "telegram_bot_token_set": bool(org.telegram_bot_token),
            "webhook_secret_set": bool(org.webhook_secret),
            "telegram_api_id": org.telegram_api_id,
            "telegram_api_hash_set": bool(org.telegram_api_hash),
            "telegram_phone": org.telegram_phone,
            "admin_chat_id": org.admin_chat_id,
        },
    }


@router.post("/organizations/verify-token")
async def verify_bot_token_endpoint(
    req: VerifyTokenRequest,
    user: User = Depends(get_verified_user),
):
    """Verify Telegram bot token via Telegram getMe API before saving."""
    token = req.token.strip()
    if not token or ":" not in token:
        raise HTTPException(status_code=400, detail="Noto'g'ri Telegram bot token formati")

    retries = 2
    last_exc: Optional[Exception] = None
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(f"https://api.telegram.org/bot{token}/getMe")
                data = resp.json()
                if not data.get("ok"):
                    desc = data.get("description", "Noto'g'ri bot token")
                    return {
                        "valid": False,
                        "error": f"Telegram xatosi: {desc}",
                    }
                bot_info = data.get("result", {})
                return {
                    "valid": True,
                    "bot_id": bot_info.get("id"),
                    "bot_name": bot_info.get("first_name"),
                    "bot_username": bot_info.get("username"),
                    "can_join_groups": bot_info.get("can_join_groups", False),
                    "can_read_all_group_messages": bot_info.get("can_read_all_group_messages", False),
                    "supports_inline_queries": bot_info.get("supports_inline_queries", False),
                }
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_exc = exc
            if attempt < retries - 1:
                await asyncio.sleep(1.0)
                continue
        except Exception as exc:
            last_exc = exc
            break

    if isinstance(last_exc, httpx.TimeoutException):
        err_msg = "Telegram serveridan javob kelmadi (Vaqt tugadi / Timeout). Iltimos, qayta urinib ko'ring."
    elif isinstance(last_exc, httpx.ConnectError):
        err_msg = "Telegram serveriga ulanishda tarmoq xatosi yuz berdi. Internet aloqasini tekshirib, qayta urinib ko'ring."
    else:
        detail = str(last_exc).strip() or (last_exc.__class__.__name__ if last_exc else "Noma'lum xatolik")
        err_msg = f"Telegram API bilan bog'lanib bo'lmadi ({detail})"

    return {"valid": False, "error": err_msg}


@router.post("/organizations/verify-channel")
async def verify_channel_public_endpoint(
    req: VerifyChannelRequest,
    user: User = Depends(get_verified_user),
):
    """Verify channel existence during onboarding using system bot token or public API."""
    raw = req.channel.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Kanal username kiritilmadi")

    clean = (
        raw.replace("https://t.me/", "")
        .replace("http://t.me/", "")
        .replace("t.me/", "")
        .replace("@", "")
        .strip("/")
    )
    if not clean:
        raise HTTPException(status_code=400, detail="Noto'g'ri kanal username formati")

    bot_token = settings.telegram_bot_token
    if not bot_token:
        return {
            "valid": True,
            "username": clean,
            "title": f"@{clean}",
            "subscribers_count": None,
            "type": "channel",
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
                            "error": f"@{clean} kanali topilmadi. Kanal ochiq (public) va username to'g'ri ekanligiga ishonch hosil qiling.",
                        }
                    return {"valid": False, "error": f"Telegram xatosi: {desc}"}

                result = chat_data.get("result", {})
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
                    "title": result.get("title") or f"@{clean}",
                    "username": clean,
                    "type": result.get("type", "channel"),
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


@router.post("/organizations/{org_id}/set-webhook")
async def set_org_webhook_endpoint(
    org_id: int,
    admin: Admin = Depends(require_saas_permission("can_manage_settings")),
    db: AsyncSession = Depends(get_db),
):
    """Register or refresh the Telegram webhook for the organization."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    await entitlement_service.require_custom_telegram_bot_access(
        db,
        org_id,
        is_platform_owner=bool(getattr(admin, "_is_platform_owner", False)),
    )
    if not org.decrypted_bot_token:
        raise HTTPException(status_code=400, detail="Tashkilotda bot token mavjud emas")
    if not org.webhook_secret:
        org.webhook_secret = secrets.token_urlsafe(32)
        await db.commit()

    if not settings.public_webhook_url:
        raise HTTPException(
            status_code=400,
            detail="Serverda PUBLIC_WEBHOOK_URL sozlanmagan. Iltimos, domen yoki ngrok havolasini kiriting."
        )

    webhook_url = f"{settings.public_webhook_url.rstrip('/')}/telegram/webhook/{org.slug}"
    tg_svc = get_telegram_service(org.decrypted_bot_token)
    try:
        res = await tg_svc.set_webhook(webhook_url, secret_token=org.webhook_secret)
        return {
            "status": "ok",
            "webhook_url": webhook_url,
            "secret_configured": bool(org.webhook_secret),
            "telegram_response": res,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Telegram webhook o'rnatishda xatolik: {exc}")


@router.get("/organizations/{org_id}/webhook-status")
async def get_org_webhook_status_endpoint(
    org_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Inspect current Telegram webhook status from Telegram API."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    if not org.decrypted_bot_token:
        return {"configured": False, "reason": "Bot token kiritilmagan"}

    tg_svc = get_telegram_service(org.decrypted_bot_token)
    try:
        info = await tg_svc.get_webhook_info()
        return {
            "configured": True,
            "has_webhook_secret": bool(org.webhook_secret),
            "webhook_info": info,
        }
    except Exception as exc:
        return {"configured": True, "error": str(exc)}


@router.get("/organizations/current")
async def get_current_organization(
    org_id: int = Depends(resolve_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Details and settings of currently active organization."""
    details = await get_organization_details(db, org_id)
    if not details:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")
    return details


@router.put("/organizations/current")
async def update_current_organization(
    req: UpdateOrgRequest,
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_settings")),
    db: AsyncSession = Depends(get_db),
):
    """Update settings of current organization."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    is_plat_owner = bool(getattr(admin, "_is_platform_owner", False))
    setting_bot_token = req.telegram_bot_token is not None and bool(req.telegram_bot_token.strip())
    if setting_bot_token:
        await entitlement_service.require_custom_telegram_bot_access(
            db, org_id, is_platform_owner=is_plat_owner
        )

    enabling_api_id = (
        req.telegram_api_id is not None
        and bool(req.telegram_api_id)
        and req.telegram_api_id != org.telegram_api_id
    )
    enabling_api_hash = req.telegram_api_hash is not None and bool(req.telegram_api_hash.strip())
    enabling_phone = (
        req.telegram_phone is not None
        and bool(req.telegram_phone.strip())
        and req.telegram_phone.strip() != (org.telegram_phone or "")
    )
    if enabling_api_id or enabling_api_hash or enabling_phone:
        await entitlement_service.require_telegram_user_chat_access(
            db, org_id, is_platform_owner=is_plat_owner
        )

    if req.name is not None:
        org.name = req.name.strip()
    if req.category is not None:
        org.category = req.category.strip()
    if req.ai_language is not None:
        org.ai_language = req.ai_language.strip()
    if req.ai_personality is not None:
        org.ai_personality = req.ai_personality.strip()
    if req.custom_system_prompt is not None:
        org.custom_system_prompt = req.custom_system_prompt.strip() or None
    if req.telegram_bot_token is not None:
        tok = req.telegram_bot_token.strip() or None
        org.telegram_bot_token = encrypt_secret(tok) if tok else None
        if tok and not org.webhook_secret:
            org.webhook_secret = secrets.token_urlsafe(32)
    if req.telegram_api_id is not None:
        org.telegram_api_id = req.telegram_api_id
    if req.telegram_api_hash is not None:
        h = req.telegram_api_hash.strip() or None
        org.telegram_api_hash = encrypt_secret(h) if h else None
    if req.telegram_phone is not None:
        org.telegram_phone = req.telegram_phone.strip() or None
    if req.admin_chat_id is not None:
        org.admin_chat_id = req.admin_chat_id.strip() or None
    if req.openai_api_key is not None:
        k = req.openai_api_key.strip() or None
        org.openai_api_key = encrypt_secret(k) if k else None
    if req.gemini_api_key is not None:
        k = req.gemini_api_key.strip() or None
        org.gemini_api_key = encrypt_secret(k) if k else None

    await db.commit()
    await db.refresh(org)
    asyncio.create_task(bot_manager.restart_org(org_id))
    return {"status": "updated", "organization": await get_organization_details(db, org_id)}


# --- Billing Endpoints ---

@router.post("/billing/checkout")
async def create_checkout(
    req: CheckoutRequest,
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Create a checkout session. Enforces official TezCheck UZS integration in production."""
    if getattr(settings, "is_production", False):
        user_id = admin.user_id if admin.user_id else 1
        return await subscription_service.create_subscription_checkout(
            db=db,
            organization_id=org_id,
            user_id=user_id,
            plan_code=req.plan_code,
            billing_cycle=req.billing_cycle,
            return_url=req.success_url,
        )

    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = sub_res.scalar_one_or_none()
    provider_name = sub.provider if sub else "mock"

    res = await billing_service.create_checkout_session(
        provider_name=provider_name,
        organization_id=org_id,
        plan_code=req.plan_code,
        billing_cycle=req.billing_cycle,
        success_url=req.success_url,
        cancel_url=req.cancel_url,
    )
    return res


@router.post("/billing/portal")
async def customer_portal(
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Redirect URL to Stripe Customer Portal or Mock Portal."""
    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = sub_res.scalar_one_or_none()
    provider_name = sub.provider if sub else "mock"
    customer_id = sub.provider_customer_id if sub else f"mock_cust_{org_id}"

    res = await billing_service.create_customer_portal_session(
        provider_name=provider_name,
        customer_id=customer_id or f"mock_cust_{org_id}",
        return_url="/settings/billing",
    )
    return res


@router.get("/billing/invoices")
async def list_invoices(
    org_id: int = Depends(resolve_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List bills and payment invoices for the tenant organization."""
    bills_res = await db.execute(
        select(PaymentBill)
        .where(PaymentBill.organization_id == org_id)
        .order_by(PaymentBill.created_at.desc())
    )
    bills = bills_res.scalars().all()
    if bills:
        invoices = [
            {
                "id": str(b.id),
                "bill_id": b.bill_id,
                "order_id": b.bill_id,
                "plan_code": b.plan_code,
                "billing_cycle": b.billing_cycle,
                "amount": b.amount,
                "amount_tiyin": b.amount,
                "amount_uzs": b.amount // 100,
                "currency": b.currency,
                "status": b.status,
                "paid_at": b.paid_at.isoformat() if b.paid_at else None,
                "created_at": b.created_at.isoformat(),
                "checkout_url": b.checkout_url,
                "provider": b.provider,
                "hosted_invoice_url": b.checkout_url,
            }
            for b in bills
        ]
        return {"invoices": invoices}

    if getattr(settings, "is_production", False):
        return {"invoices": []}

    sub_res = await db.execute(select(Subscription).where(Subscription.organization_id == org_id))
    sub = sub_res.scalar_one_or_none()
    provider_name = sub.provider if sub else "mock"
    customer_id = sub.provider_customer_id if sub else f"mock_cust_{org_id}"

    legacy_invoices = await billing_service.list_invoices(
        provider_name=provider_name,
        customer_id=customer_id or f"mock_cust_{org_id}",
    )
    return {"invoices": legacy_invoices}


@router.post("/billing/webhook")
async def billing_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Idempotent billing webhook endpoint."""
    body = await request.body()
    try:
        result = await billing_service.process_billing_webhook_idempotent(
            db=db,
            provider="stripe",
            payload_raw=body,
            signature_header=stripe_signature,
        )
        return result
    except Exception as e:
        logger.exception("Billing webhook xatolik: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


# --- Selloi Official Billing: TezCheck & Mega Discount Endpoints ---

@router.post("/billing/mega-discount/checkout")
async def create_mega_discount_checkout(
    req: MegaDiscountCheckoutRequest,
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Create a single-use TezCheck invoice for 7-day introductory mega discount."""
    try:
        user_id = admin.user_id if admin.user_id else 1
        return await subscription_service.create_mega_discount_checkout(
            db=db,
            organization_id=org_id,
            user_id=user_id,
            plan_code=req.plan_code,
            return_url=req.return_url,
        )
    except IneligibleForMegaDiscountError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except TezCheckError as e:
        logger.exception("TezCheck to'lov tizimida hisob yaratishda xatolik: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"To'lov tizimi (TezCheck) xatosi: {e}")
    except SubscriptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/billing/subscription/checkout")
async def create_subscription_checkout(
    req: SubscriptionCheckoutRequest,
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Create a single-use TezCheck invoice for monthly or yearly regular subscription."""
    try:
        user_id = admin.user_id if admin.user_id else 1
        return await subscription_service.create_subscription_checkout(
            db=db,
            organization_id=org_id,
            user_id=user_id,
            plan_code=req.plan_code,
            billing_cycle=req.billing_cycle,
            return_url=req.return_url,
        )
    except TezCheckError as e:
        logger.exception("TezCheck obuna to'lov hisobi yaratishda xatolik: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"To'lov tizimi (TezCheck) xatosi: {e}")
    except SubscriptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/billing/subscription/consent")
async def record_subscription_consent(
    req: SubscriptionConsentRequest,
    request: Request,
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Record explicit user consent for renewal frequency and terms before charge."""
    user_id = admin.user_id if admin.user_id else 1
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    consent = await subscription_service.record_explicit_renewal_consent(
        db=db,
        organization_id=org_id,
        user_id=user_id,
        billing_cycle=req.billing_cycle,
        agreed_amount=req.agreed_amount,
        accepted_terms_version=req.accepted_terms_version,
        ip_address=ip,
        user_agent=ua,
    )
    return {
        "status": "success",
        "consent_id": consent.id,
        "renewal_state": consent.renewal_state,
        "consent_timestamp": consent.consent_timestamp.isoformat(),
    }


@router.post("/billing/subscription/disable-renewal")
async def disable_renewal_endpoint(
    org_id: int = Depends(resolve_organization_id),
    admin: Admin = Depends(require_saas_permission("can_manage_billing")),
    db: AsyncSession = Depends(get_db),
):
    """Disable automatic renewal consent and flag cancellation at period end."""
    user_id = admin.user_id if admin.user_id else 1
    return await subscription_service.disable_automatic_renewal(
        db=db,
        organization_id=org_id,
        user_id=user_id,
    )


@router.post("/billing/tezcheck/webhook")
@router.post("/webhooks/tezcheck")
async def tezcheck_webhook(
    request: Request,
    x_tezcheck_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """TezCheck signed payment confirmation webhook endpoint with atomic idempotency."""
    body = await request.body()
    if not body or body.strip() == b"":
        return {"ok": True, "status": "ping_received"}

    sig = (
        request.headers.get("x-checkout-signature")
        or x_tezcheck_signature
        or request.headers.get("x-tezcheck-signature")
        or request.headers.get("x-signature")
        or request.headers.get("signature")
        or request.headers.get("x-webhook-signature")
    )
    ts = request.headers.get("x-checkout-timestamp") or request.headers.get("x-tezcheck-timestamp")
    delivery_id = request.headers.get("x-checkout-delivery") or request.headers.get("x-delivery-id")
    event_id_header = request.headers.get("x-checkout-event-id") or request.headers.get("x-event-id")

    import json
    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        return {"ok": True, "status": "ping_received"}

    if payload.get("event") in ("ping", "test", "verification") or payload.get("type") in ("ping", "test"):
        return {"ok": True, "status": "test_received"}

    # Strict signature verification for payment events
    if not sig and not tezcheck_service.mock_mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required signature header",
        )

    try:
        tezcheck_service.verify_webhook_signature(
            raw_body=body,
            signature_header=sig,
            timestamp=ts,
            delivery_id=delivery_id,
        )
    except TezCheckSignatureVerificationError as e:
        logger.warning("TezCheck webhook signature verification failed: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    # Official TezCheck payload embeds order details inside data block
    inner_data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    bill_id = (
        inner_data.get("bill_id")
        or inner_data.get("external_reference")
        or inner_data.get("id")
        or inner_data.get("payment_id")
        or payload.get("bill_id")
        or payload.get("id")
        or payload.get("order_id")
    )
    status_str = (
        inner_data.get("state")
        or payload.get("status")
        or payload.get("type")
        or ""
    ).lower()

    if status_str in ("succeeded", "payment.succeeded"):
        status_str = "paid"

    # amount_minor in tiyin or amount in UZS
    if "amount_minor" in inner_data:
        amount = int(inner_data["amount_minor"])
    elif "amount" in inner_data:
        amount = int(inner_data["amount"])
    else:
        amount = int(payload.get("amount", 0))

    currency = inner_data.get("currency") or payload.get("currency", "UZS")

    if not bill_id or status_str not in ("paid", "completed", "success"):
        return {"status": "ignored", "reason": f"Status '{status_str}' not actionable"}

    # Atomic deduplication via WebhookEvent
    # CRITICAL: Use X-Checkout-Event-Id (or payload body 'id') as primary deduplication key.
    # Do NOT use X-Checkout-Delivery as deduplication identifier (different semantics).
    unique_event_id = str(
        event_id_header
        or payload.get("id")
        or inner_data.get("id")
        or f"tezcheck_{bill_id}_{status_str}"
    )

    existing_event = (
        await db.execute(
            select(WebhookEvent).where(
                WebhookEvent.provider == "tezcheck",
                WebhookEvent.event_id == unique_event_id,
            )
        )
    ).scalar_one_or_none()

    if existing_event and existing_event.status in ("processed", "paid", "completed"):
        logger.info("TezCheck webhook event %s already processed (idempotent duplicate skipped)", unique_event_id)
        return {"ok": True, "status": "already_processed", "idempotent": True}

    if not existing_event:
        event_record = WebhookEvent(
            provider="tezcheck",
            event_id=unique_event_id,
            event_type=status_str,
            payload=payload,
            status="pending",
        )
        db.add(event_record)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            logger.info("Concurrent duplicate TezCheck event %s caught by unique constraint", unique_event_id)
            return {"ok": True, "status": "already_processed", "idempotent": True}
    else:
        event_record = existing_event

    # Check if this bill is an Admin Payment Testing Studio diagnostic transaction
    from app.models import AdminPaymentTest, StoreOrderPayment
    from app.services.payment_testing_service import payment_testing_service
    from app.services.store_payment_service import confirm_store_order_payment

    admin_test_stmt = select(AdminPaymentTest).where(
        or_(
            AdminPaymentTest.provider_bill_id == bill_id,
            AdminPaymentTest.external_reference == bill_id,
            AdminPaymentTest.test_id == bill_id,
        )
    )
    admin_test = (await db.execute(admin_test_stmt)).scalar_one_or_none()

    metadata_purpose = (
        (inner_data.get("metadata") or {}).get("payment_purpose")
        or (payload.get("metadata") or {}).get("payment_purpose")
        or inner_data.get("payment_purpose")
        or payload.get("payment_purpose")
    )

    if admin_test or metadata_purpose == "admin_payment_test":
        test_result = await payment_testing_service.confirm_test_payment(
            db=db,
            test_record=admin_test,
            bill_id=bill_id,
            status_str=status_str,
            payload=payload,
            amount=amount,
        )
        event_record.status = "processed"
        event_record.processed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": True, "type": "admin_payment_test", "result": test_result}

    store_payment = (
        await db.execute(
            select(StoreOrderPayment).where(
                or_(
                    StoreOrderPayment.bill_id == bill_id,
                    StoreOrderPayment.external_reference == bill_id,
                )
            )
        )
    ).scalar_one_or_none()

    if store_payment or metadata_purpose == "store_order_payment":
        if not store_payment:
            event_record.status = "failed"
            event_record.error_message = f"Store order payment topilmadi: {bill_id}"
            await db.commit()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyurtma to'lovi topilmadi")
        settled = await confirm_store_order_payment(db=db, payment_record=store_payment, notify_customer=True)
        event_record.status = "processed"
        event_record.processed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": True, "type": "store_order_payment", "result": settled}

    try:
        result = await subscription_service.confirm_payment_and_activate(
            db=db,
            bill_id=bill_id,
            paid_amount=amount,
            currency=currency,
        )
        event_record.status = "processed"
        event_record.processed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": True, "result": result}
    except SubscriptionError as e:
        logger.exception("Failed to confirm TezCheck bill %s: %s", bill_id, e)
        event_record.status = "failed"
        event_record.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/store-payments/tezcheck/webhook/{organization_id}")
async def store_tezcheck_webhook(
    organization_id: int,
    request: Request,
    x_tezcheck_signature: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Tenant-scoped TezCheck webhook handler verifying that store's merchant signature."""
    import json
    from app.models import StoreOrderPayment, StorePaymentConfig
    from app.services.store_payment_service import confirm_store_order_payment, get_store_tezcheck_client

    body = await request.body()
    if not body or body.strip() == b"":
        return {"ok": True, "status": "ping_received"}

    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        return {"ok": True, "status": "ping_received"}

    if payload.get("event") in ("ping", "test", "verification") or payload.get("type") in ("ping", "test"):
        return {"ok": True, "status": "test_received"}

    cfg = (
        await db.execute(
            select(StorePaymentConfig).where(StorePaymentConfig.organization_id == organization_id)
        )
    ).scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Do'kon to'lov sozlamasi topilmadi")

    client = get_store_tezcheck_client(cfg)
    sig = (
        request.headers.get("x-checkout-signature")
        or x_tezcheck_signature
        or request.headers.get("x-tezcheck-signature")
        or request.headers.get("x-signature")
        or request.headers.get("signature")
        or request.headers.get("x-webhook-signature")
    )
    ts = request.headers.get("x-checkout-timestamp") or request.headers.get("x-tezcheck-timestamp")
    delivery_id = request.headers.get("x-checkout-delivery") or request.headers.get("x-delivery-id")
    event_id_header = request.headers.get("x-checkout-event-id") or request.headers.get("x-event-id")

    if not sig and not client.mock_mode:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing required signature header")

    try:
        client.verify_webhook_signature(
            raw_body=body,
            signature_header=sig,
            timestamp=ts,
            delivery_id=delivery_id,
        )
    except TezCheckSignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature") from exc

    inner_data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    bill_id = (
        inner_data.get("bill_id")
        or inner_data.get("external_reference")
        or inner_data.get("id")
        or payload.get("bill_id")
        or payload.get("id")
        or payload.get("order_id")
    )
    status_str = (
        inner_data.get("state")
        or payload.get("status")
        or payload.get("type")
        or ""
    ).lower()
    if status_str in ("succeeded", "payment.succeeded"):
        status_str = "paid"

    if not bill_id or status_str not in ("paid", "completed", "success"):
        return {"status": "ignored", "reason": f"Status '{status_str}' not actionable"}

    provider_key = f"tezcheck_store_{organization_id}"
    unique_event_id = str(event_id_header or payload.get("id") or inner_data.get("id") or f"{provider_key}_{bill_id}_{status_str}")
    existing_event = (
        await db.execute(
            select(WebhookEvent).where(
                WebhookEvent.provider == provider_key,
                WebhookEvent.event_id == unique_event_id,
            )
        )
    ).scalar_one_or_none()
    if existing_event and existing_event.status == "processed":
        return {"ok": True, "status": "already_processed", "idempotent": True}

    if not existing_event:
        event_record = WebhookEvent(
            provider=provider_key,
            event_id=unique_event_id,
            event_type=status_str,
            payload=payload,
            status="pending",
        )
        db.add(event_record)
        await db.flush()
    else:
        event_record = existing_event

    from sqlalchemy import or_
    payment = (
        await db.execute(
            select(StoreOrderPayment).where(
                StoreOrderPayment.organization_id == organization_id,
                or_(
                    StoreOrderPayment.bill_id == str(bill_id),
                    StoreOrderPayment.external_reference == str(bill_id),
                ),
            )
        )
    ).scalar_one_or_none()
    if not payment:
        event_record.status = "failed"
        event_record.error_message = f"Buyurtma to'lovi topilmadi: {bill_id}"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyurtma to'lovi topilmadi")

    settled = await confirm_store_order_payment(db=db, payment_record=payment, notify_customer=True)
    event_record.status = "processed"
    event_record.processed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "type": "store_order_payment", "result": settled}


async def _parse_click_params(request: Request) -> dict[str, Any]:
    """Extract Click SHOP API parameters from form-urlencoded, query, or JSON body."""
    from urllib.parse import parse_qsl

    params: dict[str, Any] = dict(request.query_params)
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            body_json = await request.json()
            if isinstance(body_json, dict):
                params.update(body_json)
        except Exception:
            pass
    elif "application/x-www-form-urlencoded" in content_type or not content_type:
        try:
            raw_body = (await request.body()).decode("utf-8", errors="replace")
            for key, val in parse_qsl(raw_body, keep_blank_values=True):
                params[key] = val
        except Exception:
            pass
    else:
        try:
            form_data = await request.form()
            for key, val in form_data.items():
                params[key] = val
        except Exception:
            pass
    return params


@router.post("/store-payments/click/webhook/{organization_id}")
async def store_click_webhook(
    organization_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Unified Click Merchant Prepare/Complete webhook for per-store order payments."""
    from app.services.store_payment_service import handle_click_webhook

    params = await _parse_click_params(request)
    return await handle_click_webhook(db, organization_id=organization_id, params=params)


@router.post("/store-payments/click/prepare/{organization_id}")
async def store_click_prepare_webhook(
    organization_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Click Merchant Prepare endpoint (action=0) for per-store order payments."""
    from app.services.store_payment_service import handle_click_webhook

    params = await _parse_click_params(request)
    return await handle_click_webhook(db, organization_id=organization_id, params=params, expected_action=0)


@router.post("/store-payments/click/complete/{organization_id}")
async def store_click_complete_webhook(
    organization_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Click Merchant Complete endpoint (action=1) for per-store order payments."""
    from app.services.store_payment_service import handle_click_webhook

    params = await _parse_click_params(request)
    return await handle_click_webhook(db, organization_id=organization_id, params=params, expected_action=1)


@router.post("/store-payments/payme/webhook/{organization_id}")
async def store_payme_webhook(
    organization_id: int,
    request: Request,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Payme Merchant JSON-RPC 2.0 endpoint for per-store order payments."""
    from app.services.store_payment_service import handle_payme_jsonrpc

    try:
        payload = await request.json()
    except Exception:
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32700, "message": "Invalid JSON payload"},
        }
    if not isinstance(payload, dict):
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32600, "message": "Invalid Request"},
        }
    return await handle_payme_jsonrpc(
        db,
        organization_id=organization_id,
        authorization_header=authorization,
        payload=payload,
    )


