"""Platform Owner Endpoints (Financial Metrics, Tenant Portfolio, Profitability, Cost Control)."""

from datetime import datetime, timedelta, timezone
import re
import secrets
from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import get_current_admin
from app.core.config import settings
from app.core.db import get_db
from app.core.logging import get_logger
from app.core.security import encrypt_secret, hash_password
from app.models import (
    Admin,
    AuditLog,
    CustomerPricing,
    Organization,
    OrganizationMember,
    Plan,
    PlanPriceHistory,
    Subscription,
    SystemSetting,
    User,
)
from app.services.cost_service import cost_service
from app.services.pricing_service import format_currency_amount, pricing_cache, pricing_service

logger = get_logger(__name__)

router = APIRouter(prefix="/api/platform", tags=["platform"])


async def require_platform_owner(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> Admin:
    """Ensure user is true platform owner or master admin.

    Checks:
    1. Runtime _is_platform_owner flag attached by auth dependency.
    2. Admin telegram user ID matching settings.admin_telegram_id.
    3. User.is_platform_owner == True in database.
    Rejects tenant owners whose role is merely 'owner' in their local organization.
    """
    if getattr(admin, "_is_platform_owner", False):
        return admin

    if settings.admin_telegram_id and admin.telegram_user_id == settings.admin_telegram_id:
        return admin

    user = await db.get(User, admin.id)
    if user and user.is_platform_owner:
        return admin

    if admin.telegram_user_id:
        u_res = await db.execute(select(User).where(User.telegram_user_id == admin.telegram_user_id))
        u = u_res.scalar_one_or_none()
        if u and u.is_platform_owner:
            return admin

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Faqat Platforma egasi (Platform Owner) kirishi mumkin",
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
    features: dict | None = None
    limits: dict | None = None
    is_featured: bool | None = None
    is_public: bool | None = None
    display_order: int | None = None
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
        plan_list.append({
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "description": p.description,
            "price_monthly": p.price_monthly,
            "price_yearly": p.price_yearly,
            "price_monthly_uzs": p.price_monthly_uzs,
            "price_yearly_uzs": p.price_yearly_uzs,
            "price_monthly_formatted": format_currency_amount(p.price_monthly * 100, "USD"),
            "price_yearly_formatted": format_currency_amount(p.price_yearly * 100, "USD"),
            "price_monthly_uzs_formatted": format_currency_amount(p.price_monthly_uzs, "UZS"),
            "price_yearly_uzs_formatted": format_currency_amount(p.price_yearly_uzs, "UZS"),
            "currency": p.currency,
            "is_active": p.is_active,
            "is_public": p.is_public,
            "is_featured": p.is_featured,
            "display_order": p.display_order,
            "features": p.features,
            "limits": p.limits,
            "active_subscribers": sub_count,
            "active_offers": offer_count,
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
        history = PlanPriceHistory(
            plan_id=plan.id,
            price_monthly=plan.price_monthly * 100,
            price_yearly=plan.price_yearly * 100,
            price_monthly_uzs=plan.price_monthly_uzs,
            price_yearly_uzs=plan.price_yearly_uzs,
            currency=plan.currency,
            change_reason=req.change_reason or "Platform Owner price update",
            created_by_id=None,
            effective_from=datetime.now(timezone.utc),
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
        .where(CustomerPricing.customer_id == customer_id)
        .order_by(CustomerPricing.created_at.desc())
    )
    records = res.scalars().all()

    return {
        "success": True,
        "customer_id": org.id,
        "customer_name": org.name,
        "pricing_records": [
            {
                "id": r.id,
                "customer_id": r.customer_id,
                "plan_id": r.plan_id,
                "plan_code": r.plan.code if r.plan else None,
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
        ],
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
        created_by_id=admin.id,
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


@router.get("/pricing/history")
async def get_pricing_history(
    plan_code: str | None = None,
    limit: int = 50,
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve historical global plan price changes."""
    query = select(PlanPriceHistory).order_by(PlanPriceHistory.effective_from.desc()).limit(min(limit, 100))
    if plan_code:
        plan = await db.scalar(select(Plan).where(Plan.code == plan_code.lower()))
        if plan:
            query = query.where(PlanPriceHistory.plan_id == plan.id)

    res = await db.execute(query)
    entries = res.scalars().all()

    return {
        "success": True,
        "history": [
            {
                "id": e.id,
                "plan_id": e.plan_id,
                "plan_code": e.plan.code if e.plan else None,
                "price_monthly_cents": e.price_monthly,
                "price_yearly_cents": e.price_yearly,
                "price_monthly_uzs": e.price_monthly_uzs,
                "price_yearly_uzs": e.price_yearly_uzs,
                "currency": e.currency,
                "change_reason": e.change_reason,
                "effective_from": e.effective_from.isoformat() if e.effective_from else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
    }


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
    """List all registered users across the platform."""
    res = await db.execute(select(User).order_by(User.created_at.desc()))
    users = res.scalars().all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "telegram_user_id": u.telegram_user_id,
                "is_platform_owner": u.is_platform_owner,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.get("/system-health")
async def get_system_health(
    admin: Admin = Depends(require_platform_owner),
    db: AsyncSession = Depends(get_db),
):
    """Check system health, database, storage, and bot setup."""
    from sqlalchemy import text
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {e}"

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "database": db_status,
        "app_env": settings.app_env,
        "version": "0.1.0",
        "gemini_configured": bool(settings.gemini_api_key),
        "openai_configured": bool(settings.openai_api_key),
        "telegram_configured": bool(settings.telegram_bot_token),
    }

