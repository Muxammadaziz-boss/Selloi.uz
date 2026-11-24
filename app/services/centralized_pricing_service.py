"""Centralized Authoritative Pricing Engine & UZS Tariff Management System.

Selloi.uz official commercial pricing engine for Uzbekistan:
- All domestic selling prices, contractual tariffs, and payment bills are denominated in UZS.
- Strict isolation from USD exchange rates (no automatic floating or pegging of domestic prices).
- Supports START, PRO, ULTRA tiers across MEGA_DISCOUNT_7D, MONTHLY, and YEARLY billing periods.
- Enforces price versioning, immutable audit trails, and frozen payment snapshots.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models import Plan, PlanPriceHistory, User
from app.services.pricing_service import format_currency_amount, pricing_cache

logger = get_logger(__name__)

# Supported Billing Periods
PERIOD_MEGA_DISCOUNT_7D = "MEGA_DISCOUNT_7D"
PERIOD_MONTHLY = "MONTHLY"
PERIOD_YEARLY = "YEARLY"

SUPPORTED_BILLING_PERIODS = [
    PERIOD_MEGA_DISCOUNT_7D,
    PERIOD_MONTHLY,
    PERIOD_YEARLY,
]

# Supported Canonical Tariffs
TARIFF_START = "start"
TARIFF_PRO = "pro"
TARIFF_ULTRA = "ultra"

SUPPORTED_TARIFF_CODES = [TARIFF_START, TARIFF_PRO, TARIFF_ULTRA]

# Initial Approved Baseline UZS Prices (in tiyin: 1 UZS = 100 tiyin)
CANONICAL_BASELINE_PRICING: Dict[str, Dict[str, Any]] = {
    TARIFF_START: {
        "name": "START",
        "description": "Kichik biznes va yakka tartibdagi tadbirkorlar uchun qulay boshlang'ich yechim.",
        "display_order": 1,
        "promo_price_tiyin": 1_300_000,      # 13,000 UZS ($1 equiv) / 7 days
        "monthly_price_tiyin": 24_400_000,   # 244,000 UZS / month
        "yearly_price_tiyin": 244_000_000,   # 2,440,000 UZS / year (~17% discount)
        "currency": "UZS",
        "is_featured": False,
        "features": {
            "telegram_bots": 1,
            "ai_sales_agent": "24/7 faol",
            "vision_recognition": "Cheklangan",
            "crm_integration": "Asosiy",
        },
        "limits": {
            "monthly_orders": 500,
            "ai_messages": 1000,
            "products": 100,
        }
    },
    TARIFF_PRO: {
        "name": "PRO",
        "description": "O'sayotgan do'konlar va savdo guruhlari uchun to'liq sun'iy intellekt va to'lov integratsiyasi.",
        "display_order": 2,
        "promo_price_tiyin": 2_600_000,      # 26,000 UZS ($2 equiv) / 7 days
        "monthly_price_tiyin": 49_900_000,   # 499,000 UZS / month
        "yearly_price_tiyin": 499_000_000,   # 4,990,000 UZS / year (~17% discount)
        "currency": "UZS",
        "is_featured": True,
        "features": {
            "telegram_bots": 3,
            "ai_sales_agent": "24/7 Premium",
            "vision_recognition": "To'liq AI Vision",
            "crm_integration": "Click & Payme avto-to'lov",
        },
        "limits": {
            "monthly_orders": 2500,
            "ai_messages": 5000,
            "products": 500,
        }
    },
    TARIFF_ULTRA: {
        "name": "ULTRA",
        "description": "Katta savdo tarmoqlari, korporativ jamoalar va alohida infratuzilma uchun.",
        "display_order": 3,
        "promo_price_tiyin": 3_900_000,      # 39,000 UZS ($3 equiv) / 7 days
        "monthly_price_tiyin": 99_900_000,   # 999,000 UZS / month
        "yearly_price_tiyin": 999_000_000,   # 9,990,000 UZS / year (~17% discount)
        "currency": "UZS",
        "is_featured": False,
        "features": {
            "telegram_bots": "Cheksiz",
            "ai_sales_agent": "Alohida Server & 24/7 VIP",
            "vision_recognition": "Cheksiz AI Vision",
            "crm_integration": "Maxsus API & Webhooks",
        },
        "limits": {
            "monthly_orders": 10000,
            "ai_messages": 25000,
            "products": 2000,
        }
    }
}


def normalize_tariff_code(code: str) -> str:
    """Normalize tariff code string and map legacy aliases to canonical codes."""
    clean = code.lower().strip()
    if clean in ("standard", "standart"):
        return TARIFF_PRO
    return clean


def normalize_billing_period(period: str) -> str:
    """Normalize billing period string to canonical enum value."""
    p = period.upper().strip()
    if p in ("MEGA_DISCOUNT", "MEGA_DISCOUNT_7D", "7D", "PROMO", "TRIAL"):
        return PERIOD_MEGA_DISCOUNT_7D
    if p in ("MONTHLY", "MONTH", "OYLIK"):
        return PERIOD_MONTHLY
    if p in ("YEARLY", "YEAR", "ANNUAL", "YILLIK"):
        return PERIOD_YEARLY
    raise ValueError(f"Noto'g'ri hisob-kitob davri: '{period}'. Ruxsat etilgan: MEGA_DISCOUNT_7D, MONTHLY, YEARLY.")


class CentralizedPricingService:
    """Authoritative Pricing Engine implementing admin management, auditing, and snapshots."""

    async def seed_or_verify_tariffs(self, db: AsyncSession) -> Dict[str, Plan]:
        """Verify current production configuration before applying. Do not overwrite newer approved prices."""
        plans_map: Dict[str, Plan] = {}

        for code, spec in CANONICAL_BASELINE_PRICING.items():
            res = await db.execute(select(Plan).where(Plan.code == code))
            plan = res.scalar_one_or_none()

            if not plan:
                plan = Plan(
                    code=code,
                    name=spec["name"],
                    description=spec["description"],
                    price_promo_uzs=spec["promo_price_tiyin"],
                    price_monthly_uzs=spec["monthly_price_tiyin"],
                    price_yearly_uzs=spec["yearly_price_tiyin"],
                    price_monthly=spec["monthly_price_tiyin"] // (100 * 12800),  # optional display reference
                    price_yearly=spec["yearly_price_tiyin"] // (100 * 12800),
                    price_version=1,
                    currency=spec["currency"],
                    features=spec["features"],
                    limits=spec["limits"],
                    is_active=True,
                    is_public=True,
                    is_featured=spec["is_featured"],
                    display_order=spec["display_order"],
                )
                db.add(plan)
                await db.flush()

                # Record baseline in price history
                history = PlanPriceHistory(
                    plan_id=plan.id,
                    plan_code=plan.code,
                    billing_period="ALL",
                    price_monthly_uzs=plan.price_monthly_uzs,
                    price_yearly_uzs=plan.price_yearly_uzs,
                    previous_price_uzs=0,
                    new_price_uzs=plan.price_monthly_uzs,
                    price_version=1,
                    currency="UZS",
                    change_reason="Initial baseline approved UZS pricing seed",
                    approval_status="approved",
                    effective_from=datetime.now(timezone.utc),
                )
                db.add(history)
                logger.info("Created baseline tariff: %s (v1)", plan.code)
            else:
                # Existing plan found: verify promo price & version are populated without overwriting newer prices
                dirty = False
                if getattr(plan, "price_promo_uzs", None) is None or plan.price_promo_uzs <= 0:
                    plan.price_promo_uzs = spec["promo_price_tiyin"]
                    dirty = True
                if getattr(plan, "price_version", None) is None or plan.price_version <= 0:
                    plan.price_version = 1
                    dirty = True
                # If price_monthly_uzs had small whole-soum typo, repair to full tiyin
                if plan.price_monthly_uzs > 0 and plan.price_monthly_uzs < 1_000_000:
                    plan.price_monthly_uzs = plan.price_monthly_uzs * 100
                    dirty = True
                if plan.price_yearly_uzs > 0 and plan.price_yearly_uzs < 10_000_000:
                    plan.price_yearly_uzs = plan.price_yearly_uzs * 100
                    dirty = True
                if dirty:
                    await db.flush()

            plans_map[code] = plan

        await db.commit()
        return plans_map

    async def get_active_tariffs(self, db: AsyncSession) -> List[Dict[str, Any]]:
        """Retrieve all active approved tariffs for Uzbekistan customers in pure UZS."""
        await self.seed_or_verify_tariffs(db)

        res = await db.execute(
            select(Plan)
            .where(Plan.is_active.is_(True), Plan.is_public.is_(True))
            .order_by(Plan.display_order.asc())
        )
        plans = res.scalars().all()

        output = []
        for p in plans:
            norm_code = normalize_tariff_code(p.code)
            if norm_code not in SUPPORTED_TARIFF_CODES:
                continue

            promo_tiyin = getattr(p, "price_promo_uzs", 0) or CANONICAL_BASELINE_PRICING.get(norm_code, {}).get("promo_price_tiyin", 1_300_000)
            monthly_tiyin = p.price_monthly_uzs or CANONICAL_BASELINE_PRICING.get(norm_code, {}).get("monthly_price_tiyin", 24_400_000)
            yearly_tiyin = p.price_yearly_uzs or CANONICAL_BASELINE_PRICING.get(norm_code, {}).get("yearly_price_tiyin", 244_000_000)

            promo_uzs = promo_tiyin // 100
            monthly_uzs = monthly_tiyin // 100
            yearly_uzs = yearly_tiyin // 100

            output.append({
                "id": p.id,
                "code": norm_code,
                "name": p.name,
                "description": p.description,
                "display_order": p.display_order,
                "is_featured": p.is_featured,
                "is_active": p.is_active,
                "price_version": getattr(p, "price_version", 1),
                "currency": "UZS",
                "pricing": {
                    PERIOD_MEGA_DISCOUNT_7D: {
                        "amount_uzs": promo_uzs,
                        "amount_tiyin": promo_tiyin,
                        "duration_days": 7,
                        "formatted": f"{promo_uzs:,}".replace(",", " ") + " so'm / 7 kun",
                        "label": f"{p.name} — {promo_uzs:,}".replace(",", " ") + " so'm / 7 kun"
                    },
                    PERIOD_MONTHLY: {
                        "amount_uzs": monthly_uzs,
                        "amount_tiyin": monthly_tiyin,
                        "formatted": f"{monthly_uzs:,}".replace(",", " ") + " so'm / oy",
                        "label": f"{p.name} — {monthly_uzs:,}".replace(",", " ") + " so'm / oy"
                    },
                    PERIOD_YEARLY: {
                        "amount_uzs": yearly_uzs,
                        "amount_tiyin": yearly_tiyin,
                        "formatted": f"{yearly_uzs:,}".replace(",", " ") + " so'm / yil",
                        "label": f"{p.name} — {yearly_uzs:,}".replace(",", " ") + " so'm / yil"
                    }
                },
                "features": p.features,
                "limits": p.limits,
            })

        return output

    async def get_tariff_price(
        self,
        db: AsyncSession,
        plan_code: str,
        billing_period: str
    ) -> Dict[str, Any]:
        """Resolve current authoritative UZS price snapshot for a specific tariff and period."""
        norm_code = normalize_tariff_code(plan_code)
        norm_period = normalize_billing_period(billing_period)

        res = await db.execute(select(Plan).where(Plan.code == norm_code))
        plan = res.scalar_one_or_none()

        if not plan:
            # Fallback to baseline definition if not in DB yet
            baseline = CANONICAL_BASELINE_PRICING.get(norm_code)
            if not baseline:
                raise ValueError(f"Tarif topilmadi: {plan_code}")
            await self.seed_or_verify_tariffs(db)
            res = await db.execute(select(Plan).where(Plan.code == norm_code))
            plan = res.scalar_one_or_none()

        if not plan:
            raise ValueError(f"Tarif topilmadi: {plan_code}")

        if not plan.is_active:
            raise ValueError(f"'{plan.name}' tarifi ayni vaqtda faol emas.")

        price_version = getattr(plan, "price_version", 1)

        if norm_period == PERIOD_MEGA_DISCOUNT_7D:
            amount_tiyin = getattr(plan, "price_promo_uzs", 0) or CANONICAL_BASELINE_PRICING[norm_code]["promo_price_tiyin"]
            duration_days = 7
        elif norm_period == PERIOD_MONTHLY:
            amount_tiyin = plan.price_monthly_uzs or CANONICAL_BASELINE_PRICING[norm_code]["monthly_price_tiyin"]
            duration_days = 30
        elif norm_period == PERIOD_YEARLY:
            amount_tiyin = plan.price_yearly_uzs or CANONICAL_BASELINE_PRICING[norm_code]["yearly_price_tiyin"]
            duration_days = 365
        else:
            raise ValueError(f"Noma'lum davr: {norm_period}")

        amount_uzs = amount_tiyin // 100

        return {
            "plan_id": plan.id,
            "plan_code": norm_code,
            "plan_name": plan.name,
            "billing_period": norm_period,
            "currency": "UZS",
            "price_version": price_version,
            "amount_uzs": amount_uzs,
            "price_uzs": amount_uzs,
            "amount_tiyin": amount_tiyin,
            "amount_minor": amount_tiyin,
            "duration_days": duration_days,
            "formatted": f"{amount_uzs:,}".replace(",", " ") + " so'm",
        }

    async def get_plan_by_code(self, db: AsyncSession, plan_code: str) -> Optional[Plan]:
        """Fetch Plan model by canonical code."""
        norm_code = normalize_tariff_code(plan_code)
        res = await db.execute(select(Plan).where(Plan.code == norm_code))
        return res.scalar_one_or_none()

    async def update_tariff_pricing(
        self,
        db: AsyncSession,
        plan_code: str,
        admin_id: Optional[int] = None,
        updates: Optional[Dict[str, Any]] = None,
        change_reason: str = "",
        effective_from: Optional[datetime] = None,
        approval_status: str = "approved",
        price_monthly_uzs: Optional[int] = None,
        price_yearly_uzs: Optional[int] = None,
        price_promo_uzs: Optional[int] = None,
        is_active: Optional[bool] = None,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Authorized administrator edits START, PRO, or ULTRA pricing with versioning and immutable audit log."""
        if updates is None:
            updates = {}
        if price_monthly_uzs is not None:
            updates["price_monthly_uzs"] = price_monthly_uzs
        if price_yearly_uzs is not None:
            updates["price_yearly_uzs"] = price_yearly_uzs
        if price_promo_uzs is not None:
            updates["price_promo_uzs"] = price_promo_uzs
        if is_active is not None:
            updates["is_active"] = is_active
        if name is not None:
            updates["name"] = name
        if description is not None:
            updates["description"] = description

        norm_code = normalize_tariff_code(plan_code)
        res = await db.execute(select(Plan).where(Plan.code == norm_code))
        plan = res.scalar_one_or_none()

        if not plan:
            raise ValueError(f"Tarif topilmadi: {plan_code}")

        now = datetime.now(timezone.utc)
        effective_time = effective_from if effective_from else now

        current_version = getattr(plan, "price_version", 1) or 1
        next_version = current_version + 1

        price_changes: List[Dict[str, Any]] = []

        # 1. Promotional price update
        if "price_promo_uzs" in updates and updates["price_promo_uzs"] is not None:
            new_val_uzs = int(updates["price_promo_uzs"])
            new_val_tiyin = new_val_uzs * 100
            old_val_tiyin = getattr(plan, "price_promo_uzs", 0) or 0
            if new_val_tiyin != old_val_tiyin:
                plan.price_promo_uzs = new_val_tiyin
                price_changes.append({
                    "billing_period": PERIOD_MEGA_DISCOUNT_7D,
                    "previous_price_uzs": old_val_tiyin // 100,
                    "new_price_uzs": new_val_uzs,
                })

        # 2. Monthly price update
        if "price_monthly_uzs" in updates and updates["price_monthly_uzs"] is not None:
            new_val_uzs = int(updates["price_monthly_uzs"])
            new_val_tiyin = new_val_uzs * 100
            old_val_tiyin = plan.price_monthly_uzs or 0
            if new_val_tiyin != old_val_tiyin:
                plan.price_monthly_uzs = new_val_tiyin
                price_changes.append({
                    "billing_period": PERIOD_MONTHLY,
                    "previous_price_uzs": old_val_tiyin // 100,
                    "new_price_uzs": new_val_uzs,
                })

        # 3. Yearly price update
        if "price_yearly_uzs" in updates and updates["price_yearly_uzs"] is not None:
            new_val_uzs = int(updates["price_yearly_uzs"])
            new_val_tiyin = new_val_uzs * 100
            old_val_tiyin = plan.price_yearly_uzs or 0
            if new_val_tiyin != old_val_tiyin:
                plan.price_yearly_uzs = new_val_tiyin
                price_changes.append({
                    "billing_period": PERIOD_YEARLY,
                    "previous_price_uzs": old_val_tiyin // 100,
                    "new_price_uzs": new_val_uzs,
                })

        # 4. Optional metadata / status updates
        if "name" in updates and updates["name"]:
            plan.name = updates["name"].strip()
        if "description" in updates and updates["description"] is not None:
            plan.description = updates["description"].strip()
        if "is_active" in updates and updates["is_active"] is not None:
            plan.is_active = bool(updates["is_active"])
        if "is_public" in updates and updates["is_public"] is not None:
            plan.is_public = bool(updates["is_public"])
        if "is_featured" in updates and updates["is_featured"] is not None:
            plan.is_featured = bool(updates["is_featured"])

        # If pricing was modified, bump version and record immutable history
        if price_changes:
            plan.price_version = next_version

            for chg in price_changes:
                audit_record = PlanPriceHistory(
                    plan_id=plan.id,
                    plan_code=norm_code,
                    billing_period=chg["billing_period"],
                    previous_price_uzs=chg["previous_price_uzs"],
                    new_price_uzs=chg["new_price_uzs"],
                    price_monthly_uzs=plan.price_monthly_uzs,
                    price_yearly_uzs=plan.price_yearly_uzs,
                    price_version=next_version,
                    currency="UZS",
                    change_reason=change_reason or "Administrator authorized pricing update",
                    approval_status=approval_status,
                    admin_id=admin_id,
                    created_by_id=admin_id,
                    effective_from=effective_time,
                )
                db.add(audit_record)

        await db.commit()
        await db.refresh(plan)

        pricing_cache.invalidate_public_plans()

        return {
            "success": True,
            "status": "updated",
            "plan_code": norm_code,
            "plan_name": plan.name,
            "price_version": plan.price_version,
            "is_active": plan.is_active,
            "changes_count": len(price_changes),
            "effective_from": effective_time.isoformat(),
            "approval_status": approval_status,
            "tariff": {
                "price_monthly_uzs": plan.price_monthly_uzs // 100,
                "price_monthly_tiyin": plan.price_monthly_uzs,
                "price_yearly_uzs": plan.price_yearly_uzs // 100,
                "price_yearly_tiyin": plan.price_yearly_uzs,
                "price_promo_uzs": plan.price_promo_uzs // 100,
                "price_promo_tiyin": plan.price_promo_uzs,
            },
            "current_prices": {
                "promo_7d_uzs": plan.price_promo_uzs // 100,
                "monthly_uzs": plan.price_monthly_uzs // 100,
                "yearly_uzs": plan.price_yearly_uzs // 100,
            }
        }

    async def preview_price_changes(
        self,
        db: AsyncSession,
        plan_code: str,
        proposed_updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Preview changes and price differentials before publishing to live customers."""
        norm_code = normalize_tariff_code(plan_code)
        res = await db.execute(select(Plan).where(Plan.code == norm_code))
        plan = res.scalar_one_or_none()

        if not plan:
            raise ValueError(f"Tarif topilmadi: {plan_code}")

        curr_promo = (getattr(plan, "price_promo_uzs", 0) or CANONICAL_BASELINE_PRICING[norm_code]["promo_price_tiyin"]) // 100
        curr_monthly = plan.price_monthly_uzs // 100
        curr_yearly = plan.price_yearly_uzs // 100

        new_promo = int(proposed_updates.get("price_promo_uzs", curr_promo))
        new_monthly = int(proposed_updates.get("price_monthly_uzs", curr_monthly))
        new_yearly = int(proposed_updates.get("price_yearly_uzs", curr_yearly))

        def calc_diff(old_val: int, new_val: int) -> Dict[str, Any]:
            diff = new_val - old_val
            pct = round((Decimal(diff) / Decimal(old_val) * 100), 2) if old_val > 0 else 0
            return {
                "current_uzs": old_val,
                "proposed_uzs": new_val,
                "diff_uzs": diff,
                "diff_percent": float(pct),
                "is_changed": diff != 0
            }

        return {
            "plan_code": norm_code,
            "plan_name": plan.name,
            "current_version": getattr(plan, "price_version", 1),
            "next_version": getattr(plan, "price_version", 1) + 1,
            "comparison": {
                PERIOD_MEGA_DISCOUNT_7D: calc_diff(curr_promo, new_promo),
                PERIOD_MONTHLY: calc_diff(curr_monthly, new_monthly),
                PERIOD_YEARLY: calc_diff(curr_yearly, new_yearly),
            }
        }

    async def get_price_history(
        self,
        db: AsyncSession,
        plan_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve chronological immutable audit records of all price adjustments."""
        query = select(PlanPriceHistory).order_by(desc(PlanPriceHistory.created_at))
        if plan_code:
            norm_code = normalize_tariff_code(plan_code)
            query = query.where(PlanPriceHistory.plan_code == norm_code)

        res = await db.execute(query)
        records = res.scalars().all()

        history_list = []
        for r in records:
            history_list.append({
                "id": r.id,
                "plan_id": r.plan_id,
                "plan_code": r.plan_code,
                "billing_period": r.billing_period,
                "previous_price_uzs": r.previous_price_uzs // 100 if r.previous_price_uzs else 0,
                "new_price_uzs": r.new_price_uzs // 100 if r.new_price_uzs else 0,
                "price_version": r.price_version,
                "currency": r.currency,
                "approval_status": r.approval_status,
                "change_reason": r.change_reason,
                "admin_id": r.admin_id,
                "effective_from": r.effective_from.isoformat() if r.effective_from else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        return history_list


centralized_pricing_service = CentralizedPricingService()
