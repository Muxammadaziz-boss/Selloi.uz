"""Platform Owner Endpoints (Financial Metrics, Tenant Portfolio, Profitability, Cost Control)."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import re
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
import httpx
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.admin import get_current_admin
from app.core.config import settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.core.security import encrypt_secret, hash_password
from app.models import (
    Admin,
    AuditLog,
    Conversation,
    CustomerPricing,
    Message,
    Order,
    Organization,
    OrganizationMember,
    Plan,
    PlanPriceHistory,
    Product,
    Subscription,
    SystemSetting,
    User,
)
from app.services.cost_service import cost_service
from app.services.pricing_service import format_currency_amount, pricing_cache, pricing_service
from app.services.centralized_pricing_service import (
    centralized_pricing_service,
    PERIOD_MEGA_DISCOUNT_7D,
    PERIOD_MONTHLY,
    PERIOD_YEARLY,
    normalize_tariff_code,
)
from app.services.cbu_currency_service import cbu_currency_service

logger = get_logger(__name__)

router = APIRouter(prefix="/api/platform", tags=["platform"])


async def _resolve_request_user(admin: Admin, db: AsyncSession) -> User | None:
    user = getattr(admin, "_user", None)
    if user is not None:
        return user
    user = await db.get(User, admin.id)
    if user is not None:
        return user
    if admin.telegram_user_id:
        u_res = await db.execute(select(User).where(User.telegram_user_id == admin.telegram_user_id))
        return u_res.scalar_one_or_none()
    return None


async def require_platform_owner(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """Ensure user is Platform Owner or an Owner-appointed Site Admin.

    Rejects regular store/tenant owners whose role is merely 'owner' inside their own shop.
    """
    if getattr(admin, "_is_platform_owner", False) or getattr(admin, "_is_platform_admin", False):
        return admin

    if settings.admin_telegram_id and admin.telegram_user_id == settings.admin_telegram_id:
        return admin

    user = await _resolve_request_user(admin, db)
    if user and (user.is_platform_owner or getattr(user, "is_platform_admin", False)):
        return admin

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Faqat Platforma egasi (Owner) yoki tayinlangan Sayt Admini kirishi mumkin",
    )


async def require_strict_owner(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """Ensure caller is strictly the Platform Owner (not an appointed Site Admin)."""
    if getattr(admin, "_is_platform_owner", False):
        return admin

    if settings.admin_telegram_id and admin.telegram_user_id == settings.admin_telegram_id:
        return admin

    user = await _resolve_request_user(admin, db)
    if user and user.is_platform_owner:
        return admin

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bu amalni faqat Sayt egasi (Platform Owner) bajarishi mumkin",
    )


class PlanCreateRequest(BaseModel):
    code: str
    name: str
    description: str = ""
    price_monthly: int = 19
    price_yearly: int = 190
    price_monthly_uzs: int = 24500000
    price_yearly_uzs: int = 245000000
    currency: str = "USD"
    features: dict = {}
    limits: dict = {}
    is_public: bool = True
    display_order: int = 1
    is_featured: bool = False


class PlanUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    price_monthly: int | None = None
    monthly_price_usd: int | None = None  # Frontend alias
    price_yearly: int | None = None
    yearly_price_usd: int | None = None  # Frontend alias
    price_monthly_uzs: int | None = None
    price_yearly_uzs: int | None = None
    price_promo_uzs: int | None = None
    effective_from: datetime | None = None
    approval_status: str | None = "approved"
    features: dict | None = None
    limits: dict | None = None
    is_featured: bool | None = None
    is_public: bool | None = None
    is_active: bool | None = None
    display_order: int | None = None
    change_reason: str | None = None


class PricingPreviewRequest(BaseModel):
    plan_code: str
    price_promo_uzs: int | None = None
    price_monthly_uzs: int | None = None
    price_yearly_uzs: int | None = None


class PricingScheduleRequest(BaseModel):
    plan_code: str
    billing_period: str  # MEGA_DISCOUNT_7D, MONTHLY, YEARLY
    new_price_uzs: int
    effective_from: datetime | None = None
    effective_at: datetime | None = None
    change_reason: str | None = None


class PlanStatusUpdateRequest(BaseModel):
    is_public: bool | None = None
    is_active: bool | None = None
    change_reason: str | None = None


class CustomerPricingCreateRequest(BaseModel):
    plan_code: str
    billing_interval: str = "monthly"
    currency: str = "USD"
    discount_type: str  # percentage, fixed_amount, custom_price
    discount_value: int  # minor units or whole percent
    starts_at: datetime
    expires_at: datetime
    notes: str | None = None
    supersede_existing: bool = False


class CustomerPricingUpdateRequest(BaseModel):
    status: str | None = None  # active, expired, revoked, superseded
    expires_at: datetime | None = None
    notes: str | None = None
    revocation_reason: str | None = None


class PricingSimulationRequest(BaseModel):
    customer_id: int
    plan_code: str
    billing_interval: str = "monthly"
    currency: str = "USD"
    as_of: datetime | None = None


class OrganizationCreateRequest(BaseModel):
    name: str
    slug: str
    category: str | None = "Retail"
    currency: str | None = "UZS"
    plan_code: str | None = "start"
    owner_email: str
    owner_password: str | None = None
    telegram_bot_token: str | None = None
    system_prompt: str | None = None


class OrganizationStatusUpdateRequest(BaseModel):
    status: str  # active, suspended, archived


@router.get("/metrics")
async def get_financial_metrics(
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform-level financial metrics: MRR, ARR, ARPU, AI API costs, and gross margin %."""
    metrics = await cost_service.get_platform_financial_metrics(db)
    return metrics


@router.get("/organizations")
async def get_organizations_profitability(
    limit: int = 100,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Detailed tenant portfolio list with plan status, AI messages, AI cost, and profit margin."""
    orgs = await cost_service.get_organization_profitability_list(db, limit=limit)
    return {"organizations": orgs}


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
async def create_organization_as_owner(
    req: OrganizationCreateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform owner onboards a new merchant store / tenant with its bot and initial settings."""
    clean_name = req.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Do'kon nomi kiritilishi shart")

    clean_slug = re.sub(r"[^a-z0-9_-]", "", req.slug.strip().lower().replace(" ", "-"))
    if not clean_slug or len(clean_slug) < 2:
        raise HTTPException(status_code=400, detail="Do'kon qisqa nomi (slug) kamida 2 ta harf yoki raqamdan iborat bo'lishi kerak")

    # Check slug uniqueness
    res = await db.execute(select(Organization).where(Organization.slug == clean_slug))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"'{clean_slug}' nomli do'kon allaqachon mavjud. Boshqa slug tanlang.")

    # Validate & encrypt Telegram Bot Token if provided
    encrypted_token = None
    bot_username = None
    clean_token = req.telegram_bot_token.strip() if req.telegram_bot_token else None
    if clean_token:
        if ":" not in clean_token:
            raise HTTPException(status_code=400, detail="Telegram bot token noto'g'ri formatda (masalan: 123456789:ABCdef...)")

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                tg_res = await client.get(f"https://api.telegram.org/bot{clean_token}/getMe")
                if tg_res.status_code == 200:
                    tg_data = tg_res.json()
                    if tg_data.get("ok"):
                        bot_username = tg_data["result"].get("username")
        except Exception as e:
            logger.warning("Telegram bot verification warning: %s", e)

        encrypted_token = encrypt_secret(clean_token)

    webhook_sec = secrets.token_hex(24)

    # 1. Create Organization
    org = Organization(
        name=clean_name,
        slug=clean_slug,
        category=req.category or "Retail",
        status="active",
        telegram_bot_token=encrypted_token,
        webhook_secret=webhook_sec,
        ai_language="uz",
        ai_personality="Professional & Courteous",
        custom_system_prompt=req.system_prompt or "Siz do'konning rasmiy AI sotuvchi assistentisiz. Mijozlarga xushmuomala javob bering.",
    )
    db.add(org)
    await db.flush()

    # 2. Create or find store owner User
    clean_email = req.owner_email.strip().lower()
    user_res = await db.execute(select(User).where(User.email == clean_email))
    owner_user = user_res.scalar_one_or_none()
    plain_password = req.owner_password or secrets.token_urlsafe(10)

    if not owner_user:
        owner_user = User(
            email=clean_email,
            full_name=f"{clean_name} Egasi",
            hashed_password=hash_password(plain_password),
            is_platform_owner=False,
            is_active=True,
        )
        db.add(owner_user)
        await db.flush()

    # 3. Add Organization Member
    mem = OrganizationMember(
        organization_id=org.id,
        user_id=owner_user.id,
        role="owner",
        is_active=True,
    )
    db.add(mem)

    # 4. Attach Plan & Subscription
    target_plan_code = (req.plan_code or "start").lower()
    plan_res = await db.execute(select(Plan).where(Plan.code == target_plan_code))
    plan = plan_res.scalar_one_or_none()
    if not plan:
        p_res = await db.execute(select(Plan).where(Plan.code == "start"))
        plan = p_res.scalar_one_or_none()

    sub = Subscription(
        organization_id=org.id,
        plan_id=plan.id if plan else 1,
        status="active",
        billing_cycle="monthly",
        current_period_start=datetime.now(timezone.utc),
        current_period_end=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(sub)

    # 5. Currency setting
    currency_val = (req.currency or "UZS").upper()
    db.add(SystemSetting(
        key=f"store_currency_{org.id}",
        organization_id=org.id,
        value=currency_val,
        description="Do'kon asosiy hisob-kitob valyutasi",
    ))

    # 6. Audit Log
    real_user_id = getattr(admin, "_user", None).id if getattr(admin, "_user", None) else admin.id
    audit = AuditLog(
        organization_id=org.id,
        user_id=real_user_id,
        action="create_organization",
        resource="organization",
        resource_id=str(org.id),
        metadata_json={
            "created_by": admin.name,
            "store_name": clean_name,
            "store_slug": clean_slug,
            "owner_email": clean_email,
            "plan": target_plan_code,
            "bot_username": bot_username,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(org)

    # 7. Configure Telegram webhook if token and base URL are present
    webhook_url = f"{settings.public_webhook_url.rstrip('/')}/api/webhooks/telegram/{org.slug}" if settings.public_webhook_url else None
    if clean_token and webhook_url:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                await client.post(
                    f"https://api.telegram.org/bot{clean_token}/setWebhook",
                    json={"url": webhook_url, "secret_token": webhook_sec},
                )
        except Exception as e:
            logger.warning("setWebhook warning for org %s: %s", org.slug, e)

    return {
        "status": "created",
        "message": f"'{clean_name}' do'koni muvaffaqiyatli ochildi!",
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "category": org.category,
            "status": org.status,
            "bot_username": bot_username,
            "owner_email": clean_email,
            "temporary_password": plain_password if not req.owner_password else None,
            "plan": target_plan_code.upper(),
            "currency": currency_val,
        },
    }


@router.patch("/organizations/{org_id}/status")
async def update_organization_status(
    org_id: int,
    req: OrganizationStatusUpdateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Suspend, activate, or archive an organization."""
    if req.status not in ["active", "suspended", "archived"]:
        raise HTTPException(status_code=400, detail="Status 'active', 'suspended' yoki 'archived' bo'lishi kerak")

    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")

    old_status = org.status
    org.status = req.status

    audit = AuditLog(
        organization_id=org.id,
        action="update_organization_status",
        resource="organization",
        resource_id=str(org.id),
        metadata_json={
            "admin_name": admin.name,
            "old_status": old_status,
            "new_status": req.status,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(org)

    return {
        "status": "updated",
        "organization_id": org.id,
        "new_status": org.status,
        "message": f"Do'kon holati '{req.status}' ga o'zgartirildi",
    }


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: int,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform Owner permanently deletes a tenant organization and its cascaded data."""
    if org_id == 1:
        raise HTTPException(status_code=400, detail="Birlamchi (asosiy) do'konni o'chirish mumkin emas")

    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")

    org_name = org.name
    audit = AuditLog(
        organization_id=None,
        action="delete_organization",
        resource="organization",
        resource_id=str(org.id),
        metadata_json={
            "admin_name": admin.name,
            "deleted_org_name": org_name,
            "deleted_org_slug": org.slug,
        },
    )
    db.add(audit)
    await db.delete(org)
    await db.commit()

    return {
        "status": "deleted",
        "organization_id": org_id,
        "message": f"'{org_name}' do'koni va uning barcha ma'lumotlari o'chirildi",
    }


@router.get("/plans")
async def list_platform_plans(
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """List all global plans including unpublished, archived, and draft tiers."""
    from sqlalchemy import func
    res = await db.execute(select(Plan).order_by(Plan.display_order.asc(), Plan.price_monthly.asc()))
    plans = res.scalars().all()

    plan_list = []
    for p in plans:
        sub_count = await db.scalar(
            select(func.count(Subscription.id)).where(Subscription.plan_id == p.id, Subscription.status == "active")
        ) or 0
        offer_count = await db.scalar(
            select(func.count(CustomerPricing.id)).where(CustomerPricing.plan_id == p.id, CustomerPricing.status == "active")
        ) or 0
        promo_uzs = getattr(p, "price_promo_uzs", 0) or 0
        plan_list.append({
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "description": p.description,
            "price_monthly": p.price_monthly,
            "price_yearly": p.price_yearly,
            "price_monthly_uzs": p.price_monthly_uzs,
            "price_yearly_uzs": p.price_yearly_uzs,
            "price_promo_uzs": promo_uzs,
            "price_version": getattr(p, "price_version", 1) or 1,
            "price_monthly_formatted": format_currency_amount(p.price_monthly * 100, "USD"),
            "price_yearly_formatted": format_currency_amount(p.price_yearly * 100, "USD"),
            "price_monthly_uzs_formatted": format_currency_amount(p.price_monthly_uzs, "UZS"),
            "price_yearly_uzs_formatted": format_currency_amount(p.price_yearly_uzs, "UZS"),
            "price_promo_uzs_formatted": format_currency_amount(promo_uzs, "UZS"),
            "currency": p.currency,
            "is_active": p.is_active,
            "is_public": p.is_public,
            "is_featured": p.is_featured,
            "display_order": p.display_order,
            "features": p.features,
            "limits": p.limits,
            "active_subscribers": sub_count,
            "active_offers": offer_count,
            "active_offers_count": offer_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })

    return {"success": True, "total": len(plan_list), "plans": plan_list}


@router.post("/plans")
async def create_platform_plan(
    req: PlanCreateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform owner can create a new global plan tier."""
    clean_code = req.code.lower().strip()
    existing = await db.scalar(select(Plan).where(Plan.code == clean_code))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plan with code '{clean_code}' already exists.",
        )

    plan = Plan(
        code=clean_code,
        name=req.name.strip(),
        description=req.description,
        price_monthly=req.price_monthly,
        price_yearly=req.price_yearly,
        price_monthly_uzs=req.price_monthly_uzs,
        price_yearly_uzs=req.price_yearly_uzs,
        currency=req.currency.upper(),
        features=req.features,
        limits=req.limits,
        is_public=req.is_public,
        is_active=True,
        is_featured=req.is_featured,
        display_order=req.display_order,
    )
    db.add(plan)
    await db.flush()

    audit = AuditLog(
        organization_id=None,
        user_id=None,
        action="create_plan",
        resource="plan",
        resource_id=plan.code,
        metadata_json={
            "admin_name": admin.name,
            "plan_code": plan.code,
            "price_monthly": plan.price_monthly,
            "price_yearly": plan.price_yearly,
            "price_monthly_uzs": plan.price_monthly_uzs,
            "price_yearly_uzs": plan.price_yearly_uzs,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(plan)

    # Invalidate public plans cache after successful commit
    pricing_cache.invalidate_public_plans()

    return {
        "success": True,
        "message": f"Plan '{plan.code}' muvaffaqiyatli yaratildi.",
        "plan_id": plan.id,
        "code": plan.code,
    }


@router.put("/plans/{plan_code}")
async def update_plan_configuration(
    plan_code: str,
    req: PlanUpdateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform owner can configure plan pricing and limits dynamically."""
    res = await db.execute(select(Plan).where(Plan.code == plan_code.lower()))
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Bunday tarif rejasi topilmadi")

    # Resolve price fields from either canonical or frontend alias
    monthly_price = req.price_monthly if req.price_monthly is not None else req.monthly_price_usd
    yearly_price = req.price_yearly if req.price_yearly is not None else req.yearly_price_usd

    price_changed = False
    old_monthly = plan.price_monthly
    old_yearly = plan.price_yearly
    old_monthly_uzs = plan.price_monthly_uzs
    old_yearly_uzs = plan.price_yearly_uzs

    if monthly_price is not None and monthly_price != plan.price_monthly:
        plan.price_monthly = monthly_price
        price_changed = True
    if yearly_price is not None and yearly_price != plan.price_yearly:
        plan.price_yearly = yearly_price
        price_changed = True
    if req.price_monthly_uzs is not None and req.price_monthly_uzs != plan.price_monthly_uzs:
        plan.price_monthly_uzs = req.price_monthly_uzs
        price_changed = True
    if req.price_yearly_uzs is not None and req.price_yearly_uzs != plan.price_yearly_uzs:
        plan.price_yearly_uzs = req.price_yearly_uzs
        price_changed = True
    if req.price_promo_uzs is not None and req.price_promo_uzs != getattr(plan, "price_promo_uzs", None):
        plan.price_promo_uzs = req.price_promo_uzs
        price_changed = True

    if req.name is not None:
        plan.name = req.name.strip()
    if req.description is not None:
        plan.description = req.description.strip()
    if req.features is not None:
        plan.features = {**plan.features, **req.features}
    if req.limits is not None:
        plan.limits = {**plan.limits, **req.limits}
    if req.is_featured is not None:
        plan.is_featured = req.is_featured
    if req.is_public is not None:
        plan.is_public = req.is_public
    if req.display_order is not None:
        plan.display_order = req.display_order

    # Record historical snapshot if price changed
    if price_changed:
        plan.price_version = (getattr(plan, "price_version", 1) or 1) + 1
        history = PlanPriceHistory(
            plan_id=plan.id,
            plan_code=plan.code,
            price_monthly=plan.price_monthly * 100,
            price_yearly=plan.price_yearly * 100,
            price_monthly_uzs=plan.price_monthly_uzs,
            price_yearly_uzs=plan.price_yearly_uzs,
            previous_price_uzs=old_monthly_uzs,
            new_price_uzs=plan.price_monthly_uzs,
            price_version=plan.price_version,
            admin_id=getattr(admin, "id", None),
            approval_status=req.approval_status or "approved",
            currency=getattr(plan, "currency", "UZS") or "UZS",
            change_reason=req.change_reason or "Platform Owner price update",
            created_by_id=getattr(admin, "id", None),
            effective_from=req.effective_from or datetime.now(timezone.utc),
        )
        db.add(history)

    # Log audit entry
    audit = AuditLog(
        organization_id=None,
        action="update_plan",
        resource="plan",
        resource_id=plan.code,
        metadata_json={
            "admin_name": admin.name,
            "updated_fields": req.model_dump(exclude_unset=True),
            "price_changed": price_changed,
            "old_prices": {
                "price_monthly": old_monthly,
                "price_yearly": old_yearly,
                "price_monthly_uzs": old_monthly_uzs,
                "price_yearly_uzs": old_yearly_uzs,
            },
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(plan)

    # Invalidate public plans cache after successful commit
    pricing_cache.invalidate_public_plans()

    return {
        "status": "updated",
        "price_history_recorded": price_changed,
        "plan": {
            "code": plan.code,
            "name": plan.name,
            "price_monthly": plan.price_monthly,
            "price_yearly": plan.price_yearly,
            "price_monthly_uzs": plan.price_monthly_uzs,
            "price_yearly_uzs": plan.price_yearly_uzs,
            "is_public": plan.is_public,
            "display_order": plan.display_order,
            "is_featured": plan.is_featured,
            "features": plan.features,
            "limits": plan.limits,
        },
    }


@router.patch("/plans/{plan_code}/status")
async def update_plan_status(
    plan_code: str,
    req: PlanStatusUpdateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform owner can toggle plan visibility and operational status."""
    res = await db.execute(select(Plan).where(Plan.code == plan_code.lower()))
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Bunday tarif rejasi topilmadi")

    if req.is_public is not None:
        plan.is_public = req.is_public
    if req.is_active is not None:
        plan.is_active = req.is_active

    audit = AuditLog(
        organization_id=None,
        action="update_plan_status",
        resource="plan",
        resource_id=plan.code,
        metadata_json={
            "admin_name": admin.name,
            "is_public": plan.is_public,
            "is_active": plan.is_active,
            "reason": req.change_reason or "",
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(plan)

    pricing_cache.invalidate_public_plans()

    return {
        "success": True,
        "code": plan.code,
        "is_public": plan.is_public,
        "is_active": plan.is_active,
    }


# ============================================================================
# CUSTOMER-SPECIFIC PRICING MANAGEMENT (PLATFORM OWNER)
# ============================================================================

@router.get("/customers/{customer_id}/pricing")
async def list_customer_pricing(
    customer_id: int,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """List all individual customer pricing agreements for a tenant organization."""
    org = await db.get(Organization, customer_id)
    if not org:
        raise HTTPException(status_code=404, detail="Mijoz tashkiloti topilmadi")

    res = await db.execute(
        select(CustomerPricing)
        .options(selectinload(CustomerPricing.plan))
        .where(CustomerPricing.customer_id == customer_id)
        .order_by(CustomerPricing.created_at.desc())
    )
    records = res.scalars().all()

    serialized = [
        {
            "id": r.id,
            "customer_id": r.customer_id,
            "plan_id": r.plan_id,
            "plan_code": r.plan.code if r.plan else None,
            "plan_name": r.plan.name if r.plan else (r.plan.code.upper() if r.plan else ""),
            "billing_interval": r.billing_interval,
            "currency": r.currency,
            "discount_type": r.discount_type,
            "discount_value": r.discount_value,
            "discount_formatted": (
                f"{r.discount_value}%"
                if r.discount_type == "percentage"
                else format_currency_amount(r.discount_value, r.currency)
            ),
            "starts_at": r.starts_at.isoformat() if r.starts_at else None,
            "expires_at": r.expires_at.isoformat() if r.expires_at else None,
            "status": r.status,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in records
    ]

    return {
        "success": True,
        "customer_id": org.id,
        "customer_name": org.name,
        "offers": serialized,
        "pricing_records": serialized,
    }


@router.post("/customers/{customer_id}/pricing")
async def create_customer_pricing(
    customer_id: int,
    req: CustomerPricingCreateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Assign individual customer pricing with anti-stacking protection."""
    org = await db.get(Organization, customer_id)
    if not org:
        raise HTTPException(status_code=404, detail="Mijoz tashkiloti topilmadi")

    clean_code = req.plan_code.lower().strip()
    plan = await db.scalar(select(Plan).where(Plan.code == clean_code))
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{req.plan_code}' topilmadi")

    clean_interval = req.billing_interval.lower().strip()
    if clean_interval not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="billing_interval must be 'monthly' or 'yearly'")

    clean_currency = req.currency.upper().strip()
    if clean_currency not in ("USD", "UZS"):
        raise HTTPException(status_code=400, detail="currency must be 'USD' or 'UZS'")

    if req.discount_type not in ("percentage", "fixed_amount", "custom_price"):
        raise HTTPException(status_code=400, detail="Invalid discount_type")

    if req.discount_type == "percentage" and not (1 <= req.discount_value <= 100):
        raise HTTPException(status_code=400, detail="Percentage discount must be between 1 and 100")
    if req.discount_type in ("fixed_amount", "custom_price") and req.discount_value <= 0:
        raise HTTPException(status_code=400, detail="Discount value must be greater than zero")

    if req.expires_at <= req.starts_at:
        raise HTTPException(status_code=400, detail="expires_at must be later than starts_at")

    # Anti-Stacking validation
    existing_active = await db.scalar(
        select(CustomerPricing).where(
            CustomerPricing.customer_id == customer_id,
            CustomerPricing.plan_id == plan.id,
            CustomerPricing.billing_interval == clean_interval,
            CustomerPricing.status == "active",
        )
    )

    if existing_active:
        if req.supersede_existing:
            existing_active.status = "superseded"
            existing_active.notes = (existing_active.notes or "") + f" [Superseded by offer on {datetime.now(timezone.utc).isoformat()}]"
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ushbu mijoz uchun '{clean_code}' tarifi bo'yicha faol individual narx allaqachon mavjud. O'rniga yangisini kiritish uchun 'supersede_existing: true' parametrini uzating.",
            )

    real_user = await _resolve_request_user(admin, db)
    creator_user_id = real_user.id if real_user else admin.id

    new_offer = CustomerPricing(
        customer_id=customer_id,
        plan_id=plan.id,
        billing_interval=clean_interval,
        currency=clean_currency,
        discount_type=req.discount_type,
        discount_value=req.discount_value,
        starts_at=req.starts_at,
        expires_at=req.expires_at,
        status="active",
        created_by_id=creator_user_id,
        notes=req.notes,
    )
    db.add(new_offer)
    await db.flush()

    audit = AuditLog(
        organization_id=customer_id,
        action="create_customer_pricing",
        resource="customer_pricing",
        resource_id=str(new_offer.id),
        metadata_json={
            "admin_name": admin.name,
            "plan_code": clean_code,
            "billing_interval": clean_interval,
            "discount_type": req.discount_type,
            "discount_value": req.discount_value,
            "superseded_offer_id": existing_active.id if existing_active else None,
        },
    )
    db.add(audit)
    await db.commit()
    await db.refresh(new_offer)

    return {
        "success": True,
        "message": "Individual mijoz narxi muvaffaqiyatli saqlandi.",
        "pricing_id": new_offer.id,
        "customer_id": customer_id,
        "plan_code": clean_code,
        "billing_interval": clean_interval,
        "status": new_offer.status,
    }


@router.delete("/customers/{customer_id}/pricing/{pricing_id}")
async def revoke_customer_pricing(
    customer_id: int,
    pricing_id: int,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an active customer pricing offer immediately."""
    offer = await db.get(CustomerPricing, pricing_id)
    if not offer or offer.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Individual narx taklifi topilmadi")

    offer.status = "revoked"
    offer.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        organization_id=customer_id,
        action="revoke_customer_pricing",
        resource="customer_pricing",
        resource_id=str(offer.id),
        metadata_json={
            "admin_name": admin.name,
            "offer_id": offer.id,
            "plan_id": offer.plan_id,
        },
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "message": "Individual narx taklifi bekor qilindi. Keyingi hisob-kitoblar global tarif bo'yicha amalga oshiriladi.",
        "pricing_id": offer.id,
        "status": offer.status,
    }


@router.patch("/customers/{customer_id}/pricing/{pricing_id}")
async def update_customer_pricing(
    customer_id: int,
    pricing_id: int,
    req: CustomerPricingUpdateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Update customer pricing status, expiry date, or administrative notes."""
    offer = await db.get(CustomerPricing, pricing_id)
    if not offer or offer.customer_id != customer_id:
        raise HTTPException(status_code=404, detail="Individual narx taklifi topilmadi")

    if req.status:
        if req.status not in ("active", "expired", "revoked", "superseded"):
            raise HTTPException(status_code=400, detail="Invalid status value")
        offer.status = req.status
    if req.expires_at:
        offer.expires_at = req.expires_at
    if req.notes:
        offer.notes = req.notes
    if req.revocation_reason:
        offer.notes = (offer.notes or "") + f" [Revocation reason: {req.revocation_reason}]"

    offer.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        organization_id=customer_id,
        action="update_customer_pricing",
        resource="customer_pricing",
        resource_id=str(offer.id),
        metadata_json={
            "admin_name": admin.name,
            "updated_fields": req.model_dump(exclude_unset=True),
        },
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "pricing_id": offer.id,
        "status": offer.status,
        "expires_at": offer.expires_at.isoformat() if offer.expires_at else None,
    }


# ============================================================================
# SIMULATION & AUDIT LOGS (PLATFORM OWNER)
# ============================================================================

@router.post("/pricing/preview-resolution")
async def preview_pricing_resolution(
    req: PricingSimulationRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Dry-run pricing simulator returning complete calculation trace."""
    try:
        sim = await pricing_service.simulate_resolution(
            db=db,
            organization_id=req.customer_id,
            plan_code=req.plan_code,
            billing_interval=req.billing_interval,
            currency=req.currency,
            as_of=req.as_of,
        )
        return {"success": True, "simulation": sim}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pricing/preview")
async def preview_tariff_price_changes(
    req: PricingPreviewRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Preview tariff price changes with diffs and percentage comparisons."""
    try:
        proposed_updates = {}
        if req.price_promo_uzs is not None:
            proposed_updates["price_promo_uzs"] = req.price_promo_uzs
        if req.price_monthly_uzs is not None:
            proposed_updates["price_monthly_uzs"] = req.price_monthly_uzs
        if req.price_yearly_uzs is not None:
            proposed_updates["price_yearly_uzs"] = req.price_yearly_uzs

        preview = await centralized_pricing_service.preview_price_changes(
            db=db,
            plan_code=req.plan_code,
            proposed_updates=proposed_updates,
        )
        return {"success": True, "preview": preview}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pricing/schedule")
async def schedule_tariff_price_change(
    req: PricingScheduleRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Schedule a future price change for a tariff with an immutable audit record."""
    try:
        kwargs = {
            "db": db,
            "plan_code": req.plan_code,
            "admin_id": getattr(admin, "id", None),
            "change_reason": req.change_reason or "Scheduled future price change",
            "effective_from": req.effective_from or req.effective_at or datetime.now(timezone.utc),
            "approval_status": "scheduled",
        }
        period = req.billing_period.upper()
        if period in ("MEGA_DISCOUNT_7D", "PROMO", "TRIAL"):
            kwargs["price_promo_uzs"] = req.new_price_uzs
        elif period in ("MONTHLY", "MONTH"):
            kwargs["price_monthly_uzs"] = req.new_price_uzs
        elif period in ("YEARLY", "ANNUAL"):
            kwargs["price_yearly_uzs"] = req.new_price_uzs
        else:
            raise HTTPException(status_code=400, detail=f"Noma'lum to'lov davri: {req.billing_period}")

        result = await centralized_pricing_service.update_tariff_pricing(**kwargs)
        return {"success": True, "scheduled_change": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pricing/cbu-reference")
async def get_cbu_currency_reference(
    admin: Admin = Depends(require_platform_owner),
):
    """Fetch official Central Bank of Uzbekistan (CBU) USD currency reference rate.
    STRICT NOTICE: Internal analytics, budgeting & financial reporting only.
    Never used to automatically peg customer-facing domestic UZS pricing.
    """
    try:
        data = await cbu_currency_service.get_usd_reference_rate()
        return {"success": True, "cbu_reference": data}
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "fallback": {
                "currency": "USD",
                "rate": 12000.0,
                "is_stale": True,
                "note": "CBU API vaqtincha javob bermadi",
            },
        }


@router.get("/pricing/history")
async def get_pricing_history(
    plan_code: str | None = None,
    limit: int = 50,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve historical global plan price changes with immutable audit trail."""
    entries = await centralized_pricing_service.get_price_history(db=db, plan_code=plan_code, limit=limit)
    return {"success": True, "history": entries}


@router.get("/pricing/audit-logs")
async def get_pricing_audit_logs(
    limit: int = 50,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve audit logs filtered specifically for pricing changes and offers."""
    res = await db.execute(
        select(AuditLog)
        .where(AuditLog.resource.in_(["plan", "customer_pricing"]))
        .order_by(AuditLog.created_at.desc())
        .limit(min(limit, 100))
    )
    logs = res.scalars().all()

    return {
        "success": True,
        "audit_logs": [
            {
                "id": log.id,
                "action": log.action,
                "resource": log.resource,
                "resource_id": log.resource_id,
                "organization_id": log.organization_id,
                "metadata": log.metadata_json,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }


@router.get("/audit-logs")
async def get_audit_logs(
    limit: int = 50,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide audit log for compliance and security tracking."""
    res = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(min(limit, 100))
    )
    logs = res.scalars().all()
    return {
        "logs": [
            {
                "id": log.id,
                "organization_id": log.organization_id,
                "action": log.action,
                "resource": log.resource,
                "resource_id": log.resource_id,
                "metadata": log.metadata_json,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    }


@router.post("/organizations/{org_slug}/impersonate")
async def impersonate_organization(
    org_slug: str,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Platform Owner enters a specific tenant store (audit logged)."""
    res = await db.execute(select(Organization).where(Organization.slug == org_slug.lower()))
    org = res.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")

    # Log audit entry
    real_user_id = getattr(admin, "_user", None).id if getattr(admin, "_user", None) else admin.id
    audit = AuditLog(
        organization_id=org.id,
        user_id=real_user_id,
        action="platform_owner_enter_store",
        resource="organization",
        resource_id=str(org.id),
        metadata_json={
            "impersonated_by_user_id": real_user_id,
            "admin_name": admin.name,
            "store_name": org.name,
            "store_slug": org.slug,
        },
    )
    db.add(audit)
    await db.commit()

    return {
        "status": "ok",
        "message": f"{org.name} do'koniga Platform Owner ko'rinishida muvaffaqiyatli kirildi",
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "category": org.category,
            "status": org.status,
            "ai_language": org.ai_language,
            "ai_personality": org.ai_personality,
        },
    }


@router.get("/users")
async def get_all_users(
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """List all registered users across the platform with their linked store badges."""
    res = await db.execute(select(User).order_by(User.created_at.desc()))
    users = res.scalars().all()

    mem_res = await db.execute(
        select(OrganizationMember.user_id, Organization.name)
        .join(Organization, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.is_active.is_(True))
    )
    user_orgs: dict[int, list[str]] = {}
    for uid, org_name in mem_res.all():
        if uid is not None and org_name:
            user_orgs.setdefault(uid, []).append(org_name)

    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "telegram_user_id": u.telegram_user_id,
                "is_platform_owner": u.is_platform_owner,
                "is_platform_admin": bool(getattr(u, "is_platform_admin", False)),
                "is_active": u.is_active,
                "organizations_count": len(user_orgs.get(u.id, [])),
                "organization_names": user_orgs.get(u.id, []),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


class SiteAdminAppointRequest(BaseModel):
    email: str
    full_name: str = ""


class SiteAdminToggleRequest(BaseModel):
    is_platform_admin: bool


class UserStatusToggleRequest(BaseModel):
    is_active: bool


@router.post("/site-admins")
async def appoint_site_admin_by_email(
    payload: SiteAdminAppointRequest,
    owner: Admin = Depends(require_strict_owner),
    db: AsyncSession = Depends(get_db),
):
    """Owner-only: Appoint an existing or new email as an authorized Sayt Admini."""
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Noto'g'ri email manzil")
    res = await db.execute(select(User).where(User.email == clean_email))
    target = res.scalar_one_or_none()
    if target is None:
        target = User(
            email=clean_email,
            full_name=payload.full_name.strip() or clean_email.split("@")[0],
            hashed_password="",
            is_platform_owner=False,
            is_platform_admin=True,
            is_active=True,
        )
        db.add(target)
        await db.flush()
    else:
        if target.is_platform_owner:
            raise HTTPException(status_code=400, detail="Bu foydalanuvchi allaqachon Sayt egasi (Owner)")
        target.is_platform_admin = True
        target.is_active = True
        if payload.full_name.strip() and not target.full_name:
            target.full_name = payload.full_name.strip()
        target.token_version = (getattr(target, "token_version", 1) or 1) + 1

    db.add(
        AuditLog(
            organization_id=None,
            user_id=getattr(getattr(owner, "_user", None), "id", None),
            action="APPOINT_SITE_ADMIN",
            resource="user",
            resource_id=str(target.id),
            metadata_json={"email": target.email},
        )
    )
    await db.commit()
    await db.refresh(target)
    return {
        "ok": True,
        "user": {
            "id": target.id,
            "email": target.email,
            "full_name": target.full_name,
            "telegram_user_id": target.telegram_user_id,
            "is_platform_owner": target.is_platform_owner,
            "is_platform_admin": target.is_platform_admin,
            "is_active": target.is_active,
            "created_at": target.created_at.isoformat() if target.created_at else None,
        },
    }


@router.patch("/users/{user_id}/platform-admin")
async def toggle_site_admin_access(
    user_id: int,
    payload: SiteAdminToggleRequest,
    owner: Admin = Depends(require_strict_owner),
    db: AsyncSession = Depends(get_db),
):
    """Owner-only: Grant or revoke Sayt Admini access for a registered user."""
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    if target.is_platform_owner:
        raise HTTPException(status_code=400, detail="Platforma egasining rolini o'zgartirib bo'lmaydi")

    target.is_platform_admin = bool(payload.is_platform_admin)
    target.token_version = (getattr(target, "token_version", 1) or 1) + 1
    db.add(
        AuditLog(
            organization_id=None,
            user_id=getattr(getattr(owner, "_user", None), "id", None),
            action="APPOINT_SITE_ADMIN" if target.is_platform_admin else "REVOKE_SITE_ADMIN",
            resource="user",
            resource_id=str(target.id),
            metadata_json={"email": target.email, "is_platform_admin": target.is_platform_admin},
        )
    )
    await db.commit()
    await db.refresh(target)
    return {
        "ok": True,
        "user": {
            "id": target.id,
            "email": target.email,
            "full_name": target.full_name,
            "telegram_user_id": target.telegram_user_id,
            "is_platform_owner": target.is_platform_owner,
            "is_platform_admin": target.is_platform_admin,
            "is_active": target.is_active,
            "created_at": target.created_at.isoformat() if target.created_at else None,
        },
    }


@router.patch("/users/{user_id}/status")
async def toggle_user_active_status(
    user_id: int,
    payload: UserStatusToggleRequest,
    owner: Admin = Depends(require_strict_owner),
    db: AsyncSession = Depends(get_db),
):
    """Owner-only: Activate or suspend a platform user account."""
    target = await db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    if target.is_platform_owner:
        raise HTTPException(status_code=400, detail="Sayt egasini bloklash mumkin emas")

    target.is_active = bool(payload.is_active)
    target.token_version = (getattr(target, "token_version", 1) or 1) + 1
    db.add(
        AuditLog(
            organization_id=None,
            user_id=getattr(getattr(owner, "_user", None), "id", None),
            action="ACTIVATE_USER" if target.is_active else "SUSPEND_USER",
            resource="user",
            resource_id=str(target.id),
            metadata_json={"email": target.email, "is_active": target.is_active},
        )
    )
    await db.commit()
    await db.refresh(target)
    return {
        "ok": True,
        "user": {
            "id": target.id,
            "email": target.email,
            "full_name": target.full_name,
            "telegram_user_id": target.telegram_user_id,
            "is_platform_owner": target.is_platform_owner,
            "is_platform_admin": bool(getattr(target, "is_platform_admin", False)),
            "is_active": target.is_active,
            "created_at": target.created_at.isoformat() if target.created_at else None,
        },
    }


@router.get("/system-health")
async def get_system_health(
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Check system health, database, Redis, storage, AI providers, and bot setup."""
    from sqlalchemy import text
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {e}"

    redis_status = "unconfigured"
    if settings.redis_url:
        try:
            import asyncio as _asyncio
            from urllib.parse import urlparse as _urlparse
            parsed = _urlparse(settings.redis_url)
            r_host = parsed.hostname or "localhost"
            r_port = parsed.port or 6379
            reader, writer = await _asyncio.wait_for(_asyncio.open_connection(r_host, r_port), timeout=1.0)
            try:
                writer.write(b"*1\r\n$4\r\nPING\r\n")
                await writer.drain()
                line = await _asyncio.wait_for(reader.readline(), timeout=1.0)
                redis_status = "healthy" if b"PONG" in line else "unhealthy"
            finally:
                writer.close()
                try:
                    await writer.wait_closed()
                except Exception:
                    pass
        except Exception as e:
            redis_status = f"unavailable: {type(e).__name__}"

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "database": db_status,
        "redis": redis_status,
        "app_env": settings.app_env,
        "version": "0.1.0",
        "gemini_configured": bool(settings.gemini_api_key),
        "openai_configured": bool(settings.openai_api_key),
        "telegram_configured": bool(settings.telegram_bot_token),
        "tezcheck_configured": bool(settings.tezcheck_api_key and settings.tezcheck_merchant_id),
    }


class OrgSubscriptionAdminUpdateRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=32)
    status: str = Field(default="active", max_length=32)
    billing_cycle: str = Field(default="monthly", max_length=16)
    extend_days: int = Field(default=0, ge=0, le=365)


class PlatformBroadcastRequest(BaseModel):
    audience: str = Field(default="store_owners", max_length=32)  # store_owners, site_admins, all_linked
    message: str = Field(min_length=5, max_length=3500)
    dry_run: bool = False


@router.get("/organizations/{org_id}/details")
async def get_organization_details_for_admin(
    org_id: int,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Inspect complete operational snapshot, subscription, stats, and members of a tenant store."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")

    sub_res = await db.execute(
        select(Subscription, Plan)
        .outerjoin(Plan, Subscription.plan_id == Plan.id)
        .where(Subscription.organization_id == org.id)
        .order_by(Subscription.id.desc())
        .limit(1)
    )
    sub_pair = sub_res.first()
    sub_obj, plan_obj = sub_pair if sub_pair else (None, None)

    conv_count = await db.scalar(
        select(func.count(Conversation.id)).where(Conversation.organization_id == org.id)
    ) or 0
    msg_count = await db.scalar(
        select(func.count(Message.id)).where(Message.organization_id == org.id)
    ) or 0
    orders_count = await db.scalar(
        select(func.count(Order.id)).where(Order.organization_id == org.id)
    ) or 0
    confirmed_orders_count = await db.scalar(
        select(func.count(Order.id)).where(
            Order.organization_id == org.id,
            Order.status.in_(["confirmed", "paid", "completed", "delivered"]),
        )
    ) or 0
    products_count = await db.scalar(
        select(func.count(Product.id)).where(Product.organization_id == org.id, Product.is_active.is_(True))
    ) or 0

    mem_res = await db.execute(
        select(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .where(OrganizationMember.organization_id == org.id)
        .order_by(OrganizationMember.id.asc())
    )
    members = [
        {
            "user_id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": m.role,
            "telegram_user_id": u.telegram_user_id,
            "is_active": m.is_active and u.is_active,
        }
        for m, u in mem_res.all()
    ]

    return {
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "category": org.category,
            "status": org.status or "active",
            "ai_language": org.ai_language,
            "ai_personality": org.ai_personality,
            "bot_configured": bool(org.telegram_bot_token),
            "openai_configured": bool(org.openai_api_key),
            "gemini_configured": bool(org.gemini_api_key),
            "created_at": org.created_at.isoformat() if org.created_at else None,
        },
        "subscription": {
            "plan_code": plan_obj.code.upper() if plan_obj else "NONE",
            "plan_name": plan_obj.name if plan_obj else "Biriktirilmagan",
            "status": sub_obj.status if sub_obj else "inactive",
            "billing_cycle": sub_obj.billing_cycle if sub_obj else "monthly",
            "current_period_start": (
                sub_obj.current_period_start.isoformat()
                if sub_obj and sub_obj.current_period_start
                else None
            ),
            "current_period_end": (
                sub_obj.current_period_end.isoformat()
                if sub_obj and sub_obj.current_period_end
                else None
            ),
        },
        "stats": {
            "conversations_count": conv_count,
            "messages_count": msg_count,
            "orders_count": orders_count,
            "confirmed_orders_count": confirmed_orders_count,
            "products_count": products_count,
        },
        "members": members,
    }


@router.patch("/organizations/{org_id}/subscription")
async def update_organization_subscription_as_admin(
    org_id: int,
    req: OrgSubscriptionAdminUpdateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Allow Platform Owner / Site Admin to change store plan, status, or extend billing period."""
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")

    allowed_statuses = {"active", "trialing", "subscription_active", "mega_discount_active", "cancelled", "subscription_expired"}
    clean_status = req.status.strip().lower()
    if clean_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Noto'g'ri obuna holati")

    clean_cycle = req.billing_cycle.strip().lower()
    if clean_cycle not in {"monthly", "yearly"}:
        raise HTTPException(status_code=400, detail="To'lov davri 'monthly' yoki 'yearly' bo'lishi kerak")

    clean_plan_code = req.plan_code.strip().lower()
    plan = (await db.execute(select(Plan).where(Plan.code == clean_plan_code))).scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"'{clean_plan_code}' nomli tarif topilmadi")

    now = datetime.now(timezone.utc)
    sub = (
        await db.execute(
            select(Subscription)
            .where(Subscription.organization_id == org.id)
            .order_by(Subscription.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if sub is None:
        base_end = now + timedelta(days=30 if req.extend_days == 0 else req.extend_days)
        sub = Subscription(
            organization_id=org.id,
            plan_id=plan.id,
            status=clean_status,
            billing_cycle=clean_cycle,
            current_period_start=now,
            current_period_end=base_end,
        )
        db.add(sub)
    else:
        sub.plan_id = plan.id
        sub.status = clean_status
        sub.billing_cycle = clean_cycle
        if not sub.current_period_start:
            sub.current_period_start = now
        if req.extend_days > 0:
            existing_end = sub.current_period_end
            if existing_end is not None and existing_end.tzinfo is None:
                existing_end = existing_end.replace(tzinfo=timezone.utc)
            anchor = existing_end if (existing_end and existing_end > now) else now
            sub.current_period_end = anchor + timedelta(days=req.extend_days)
        elif not sub.current_period_end:
            sub.current_period_end = now + timedelta(days=30)

    real_user_id = getattr(getattr(admin, "_user", None), "id", None)
    db.add(
        AuditLog(
            organization_id=org.id,
            user_id=real_user_id,
            action="update_organization_subscription",
            resource="subscription",
            resource_id=str(org.id),
            metadata_json={
                "admin_name": admin.name,
                "plan_code": plan.code,
                "status": sub.status,
                "billing_cycle": sub.billing_cycle,
                "extend_days": req.extend_days,
            },
        )
    )
    await db.commit()
    await db.refresh(sub)

    return {
        "ok": True,
        "message": f"{org.name} obunasi {plan.code.upper()} ({sub.status}) ga yangilandi",
        "subscription": {
            "organization_id": org.id,
            "plan_code": plan.code.upper(),
            "status": sub.status,
            "billing_cycle": sub.billing_cycle,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        },
    }


@router.post("/daily-report")
async def send_platform_daily_report(
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Compile real-time platform KPI summary and push it via Telegram to owners/site admins."""
    from app.services.telegram import telegram as default_telegram

    metrics = await cost_service.get_platform_financial_metrics(db)
    cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    new_orgs_24h = await db.scalar(
        select(func.count(Organization.id)).where(Organization.created_at >= cutoff_24h)
    ) or 0
    new_orders_24h = await db.scalar(
        select(func.count(Order.id)).where(Order.created_at >= cutoff_24h)
    ) or 0
    new_convs_24h = await db.scalar(
        select(func.count(Conversation.id)).where(Conversation.created_at >= cutoff_24h)
    ) or 0

    tashkent_tz = timezone(timedelta(hours=5))
    ts_str = datetime.now(tashkent_tz).strftime("%d.%m.%Y %H:%M")

    report_text = (
        f"Selloi Platforma Hisoboti ({ts_str}, Toshkent)\n\n"
        f"Do'konlar: {metrics['total_organizations']} ta (Faol obuna: {metrics['active_subscriptions']}, Sinov: {metrics['trial_organizations']})\n"
        f"Oylik daromad (MRR): ${metrics['mrr_usd']:.2f} (ARR: ${metrics['arr_usd']:.2f})\n"
        f"AI xarajati (shu oy): ${metrics['total_ai_cost_usd']:.4f} ({metrics['total_ai_messages_this_month']} xabar)\n"
        f"Yalpi marja: {metrics['gross_margin_percent']:.1f}%\n\n"
        f"Oxirgi 24 soat:\n"
        f"- Yangi do'konlar: {new_orgs_24h} ta\n"
        f"- Yangi suhbatlar: {new_convs_24h} ta\n"
        f"- Yangi buyurtmalar: {new_orders_24h} ta"
    )

    # Collect distinct Telegram recipients (platform owners, site admins, configured admin chat)
    admin_rows = await db.execute(
        select(User.telegram_user_id).where(
            User.is_active.is_(True),
            User.telegram_user_id.is_not(None),
            (User.is_platform_owner.is_(True)) | (User.is_platform_admin.is_(True)),
        )
    )
    recipients: list[int | str] = []
    for (tg_id,) in admin_rows.all():
        if tg_id and tg_id not in recipients:
            recipients.append(tg_id)
    if settings.admin_telegram_id and settings.admin_telegram_id not in recipients:
        recipients.append(settings.admin_telegram_id)
    if settings.telegram_admin_chat_id and settings.telegram_admin_chat_id not in recipients:
        recipients.append(settings.telegram_admin_chat_id)

    sent_count = 0
    if default_telegram is not None:
        for chat_target in recipients:
            try:
                await default_telegram.send_message(chat_target, report_text)
                sent_count += 1
            except Exception as exc:
                logger.warning("Daily platform report send failed target=%s: %s", chat_target, exc)

    real_user_id = getattr(getattr(admin, "_user", None), "id", None)
    db.add(
        AuditLog(
            organization_id=None,
            user_id=real_user_id,
            action="platform_daily_report",
            resource="platform",
            resource_id="summary",
            metadata_json={"sent_count": sent_count, "recipients": len(recipients)},
        )
    )
    await db.commit()

    return {
        "ok": True,
        "sent_count": sent_count,
        "recipient_count": len(recipients),
        "telegram_configured": bool(default_telegram is not None),
        "report_text": report_text,
        "metrics_24h": {
            "new_organizations": new_orgs_24h,
            "new_conversations": new_convs_24h,
            "new_orders": new_orders_24h,
        },
    }


@router.post("/broadcast")
async def broadcast_telegram_announcement(
    req: PlatformBroadcastRequest,
    owner: Admin = Depends(require_strict_owner),
    db: AsyncSession = Depends(get_db),
):
    """Owner-only: Send a platform announcement via Telegram DM to linked store owners or admins."""
    from app.services.telegram import telegram as default_telegram

    clean_audience = req.audience.strip().lower()
    if clean_audience not in {"store_owners", "site_admins", "all_linked"}:
        raise HTTPException(status_code=400, detail="Auditoriya 'store_owners', 'site_admins' yoki 'all_linked' bo'lishi kerak")

    if clean_audience == "site_admins":
        stmt = select(User.telegram_user_id).where(
            User.is_active.is_(True),
            User.telegram_user_id.is_not(None),
            (User.is_platform_owner.is_(True)) | (User.is_platform_admin.is_(True)),
        )
    elif clean_audience == "store_owners":
        stmt = (
            select(User.telegram_user_id)
            .join(OrganizationMember, OrganizationMember.user_id == User.id)
            .where(
                User.is_active.is_(True),
                OrganizationMember.is_active.is_(True),
                User.telegram_user_id.is_not(None),
            )
        )
    else:
        stmt = select(User.telegram_user_id).where(
            User.is_active.is_(True),
            User.telegram_user_id.is_not(None),
        )

    rows = await db.execute(stmt)
    targets = list({int(row[0]) for row in rows.all() if row[0]})

    if req.dry_run:
        return {
            "ok": True,
            "dry_run": True,
            "audience": clean_audience,
            "recipient_count": len(targets),
            "sent_count": 0,
            "failed_count": 0,
        }

    sent_count = 0
    failed_count = 0
    clean_msg = f"Selloi Platforma Xabarnomasi\n\n{req.message.strip()}"
    if default_telegram is not None:
        for tg_id in targets:
            try:
                await default_telegram.send_message(tg_id, clean_msg)
                sent_count += 1
            except Exception as exc:
                failed_count += 1
                logger.warning("Broadcast send failed tg_id=%s: %s", tg_id, exc)
    else:
        failed_count = len(targets)

    real_user_id = getattr(getattr(owner, "_user", None), "id", None)
    db.add(
        AuditLog(
            organization_id=None,
            user_id=real_user_id,
            action="platform_broadcast",
            resource="platform",
            resource_id=clean_audience,
            metadata_json={
                "audience": clean_audience,
                "recipient_count": len(targets),
                "sent_count": sent_count,
                "failed_count": failed_count,
                "preview": req.message.strip()[:120],
            },
        )
    )
    await db.commit()

    return {
        "ok": True,
        "dry_run": False,
        "audience": clean_audience,
        "recipient_count": len(targets),
        "sent_count": sent_count,
        "failed_count": failed_count,
    }


# ============================================================================
# PAYMENT TESTING STUDIO (OWNER ADMIN DIAGNOSTIC MODULE)
# ============================================================================

class PaymentTestCreateRequest(BaseModel):
    amount_uzs: Any
    environment: str = "test"
    confirm_live: bool = False
    description: str | None = None
    idempotency_key: str | None = None
    return_url: str | None = None


@router.get("/payment-testing/config")
async def get_payment_testing_config(
    admin: Admin = Depends(require_platform_owner),
):
    """Retrieve diagnostic configuration, limits, and supported environments for TezCheck testing."""
    from app.services.payment_testing_service import payment_testing_service
    return payment_testing_service.get_config()


@router.post("/payment-testing/create", status_code=status.HTTP_201_CREATED)
async def create_payment_test(
    req: PaymentTestCreateRequest,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Create a single-use payment diagnostic invoice for platform owner testing.

    Strictly validates amounts (1,000 - 10,000 UZS) and requires explicit confirmation for LIVE transactions.
    CRITICAL: Never activates subscriptions or modifies plan prices.
    """
    from app.services.payment_testing_service import payment_testing_service, PaymentTestingValidationError
    from app.services.tezcheck_service import TezCheckError, TezCheckAPIError

    try:
        test_record = await payment_testing_service.create_test_payment(
            db=db,
            admin=admin,
            amount_uzs=req.amount_uzs,
            environment=req.environment,
            confirm_live=req.confirm_live,
            description=req.description,
            idempotency_key=req.idempotency_key,
            return_url=req.return_url,
        )
        return {
            "test_id": test_record.test_id,
            "provider_bill_id": test_record.provider_bill_id,
            "external_reference": test_record.external_reference,
            "amount_uzs": test_record.amount_uzs,
            "amount_tiyin": test_record.amount_tiyin,
            "currency": test_record.currency,
            "environment": test_record.environment,
            "status": test_record.status,
            "checkout_url": test_record.checkout_url,
            "created_at": test_record.created_at.isoformat() if test_record.created_at else None,
            "payment_purpose": test_record.payment_purpose,
        }
    except TezCheckAPIError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )
    except PaymentTestingValidationError as exc:
        return JSONResponse(
            status_code=getattr(exc, "status_code", status.HTTP_400_BAD_REQUEST),
            content=exc.to_dict() if hasattr(exc, "to_dict") else {
                "success": False,
                "error": {
                    "code": getattr(exc, "code", "VALIDATION_FAILED"),
                    "message": str(exc),
                    "request_id": getattr(exc, "request_id", f"selloi_req_{secrets.token_hex(6)}"),
                    "retryable": False,
                }
            },
        )
    except TezCheckError as exc:
        return JSONResponse(
            status_code=getattr(exc, "status_code", status.HTTP_502_BAD_GATEWAY),
            content=exc.to_dict() if hasattr(exc, "to_dict") else {
                "success": False,
                "error": {
                    "code": getattr(exc, "code", "TEZCHECK_GATEWAY_ERROR"),
                    "message": str(exc),
                    "request_id": f"selloi_req_{secrets.token_hex(6)}",
                    "retryable": False,
                }
            },
        )


@router.get("/payment-testing/history")
async def list_payment_test_history(
    status: str | None = None,
    environment: str | None = None,
    min_amount: int | None = None,
    max_amount: int | None = None,
    limit: int = 50,
    offset: int = 0,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Paginated, filterable payment testing history."""
    from app.services.payment_testing_service import payment_testing_service

    records, total = await payment_testing_service.list_test_history(
        db=db,
        status_filter=status,
        environment_filter=environment,
        min_amount=min_amount,
        max_amount=max_amount,
        limit=limit,
        offset=offset,
    )
    return {
        "total": total,
        "items": [
            {
                "test_id": r.test_id,
                "admin_email": r.admin_email,
                "amount_uzs": r.amount_uzs,
                "amount_tiyin": r.amount_tiyin,
                "currency": r.currency,
                "environment": r.environment,
                "provider": r.provider,
                "provider_bill_id": r.provider_bill_id,
                "external_reference": r.external_reference,
                "status": r.status,
                "checkout_url": r.checkout_url,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                "payment_purpose": r.payment_purpose,
            }
            for r in records
        ],
    }


@router.get("/payment-testing/stats")
async def get_payment_testing_stats(
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Financial reporting stats separating simulated sandbox volume from live test collections."""
    from app.services.payment_testing_service import payment_testing_service
    return await payment_testing_service.get_test_stats(db)


@router.get("/payment-testing/{test_id}")
async def get_payment_test_details(
    test_id: str,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Fetch complete immutable diagnostic details for an admin payment test."""
    from app.services.payment_testing_service import payment_testing_service

    record = await payment_testing_service.get_test_by_id(db, test_id)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test to'lov yozuvi topilmadi")

    return {
        "test_id": record.test_id,
        "admin_id": record.admin_id,
        "admin_email": record.admin_email,
        "amount_uzs": record.amount_uzs,
        "amount_tiyin": record.amount_tiyin,
        "currency": record.currency,
        "environment": record.environment,
        "provider": record.provider,
        "provider_bill_id": record.provider_bill_id,
        "external_reference": record.external_reference,
        "status": record.status,
        "checkout_url": record.checkout_url,
        "confirm_live": record.confirm_live,
        "idempotency_key": record.idempotency_key,
        "payment_purpose": record.payment_purpose,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "completed_at": record.completed_at.isoformat() if record.completed_at else None,
        "metadata_snapshot": record.metadata_snapshot,
        "provider_response": record.provider_response,
    }


@router.post("/payment-testing/{test_id}/sync")
async def sync_payment_test_status(
    test_id: str,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Query live provider payment status and synchronize record."""
    from app.services.payment_testing_service import payment_testing_service, PaymentTestingValidationError
    from app.services.tezcheck_service import TezCheckError, TezCheckAPIError

    try:
        updated = await payment_testing_service.sync_test_payment_status(db, test_id, admin)
        return {
            "test_id": updated.test_id,
            "status": updated.status,
            "environment": updated.environment,
            "provider_bill_id": updated.provider_bill_id,
            "completed_at": updated.completed_at.isoformat() if updated.completed_at else None,
        }
    except PaymentTestingValidationError as exc:
        return JSONResponse(
            status_code=getattr(exc, "status_code", status.HTTP_404_NOT_FOUND),
            content=exc.to_dict() if hasattr(exc, "to_dict") else {
                "success": False,
                "error": {
                    "code": getattr(exc, "code", "NOT_FOUND"),
                    "message": str(exc),
                    "request_id": f"selloi_req_{secrets.token_hex(6)}",
                    "retryable": False,
                }
            },
        )
    except TezCheckAPIError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(),
        )
    except TezCheckError as exc:
        return JSONResponse(
            status_code=getattr(exc, "status_code", status.HTTP_502_BAD_GATEWAY),
            content=exc.to_dict() if hasattr(exc, "to_dict") else {
                "success": False,
                "error": {
                    "code": getattr(exc, "code", "TEZCHECK_GATEWAY_ERROR"),
                    "message": str(exc),
                    "request_id": f"selloi_req_{secrets.token_hex(6)}",
                    "retryable": False,
                }
            },
        )


