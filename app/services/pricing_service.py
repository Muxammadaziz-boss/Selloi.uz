"""Centralized Hybrid Dynamic Pricing Service & Resolution Engine.

Server-authoritative financial calculation engine enforcing:
1. Strict resolution hierarchy: Active CustomerPricing offers take precedence over global catalog rates.
2. Anti-stacking: Exactly one pricing rule is applied per quote.
3. Zero floating-point arithmetic: Integer minor units (USD cents, UZS tiyin) with Decimal half-up rounding.
4. Server authority: Client-submitted prices or amounts are never trusted.
5. In-memory / Redis cache management with post-commit invalidation.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import json
from typing import Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.logging import get_logger
from app.models import CustomerPricing, Organization, Plan, PlanPriceHistory, Subscription

logger = get_logger(__name__)


def normalize_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is timezone-aware UTC datetime for safe comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class PricingCacheManager:
    """High-speed caching layer with TTL and post-commit invalidation."""

    def __init__(self):
        self._memory_cache: dict[str, tuple[float, Any]] = {}

    def get_public_plans(self, currency: str, billing_cycle: str) -> Optional[dict]:
        key = f"public_plans:{currency.upper()}:{billing_cycle.lower()}"
        cached = self._memory_cache.get(key)
        if not cached:
            return None
        expires_at, data = cached
        if datetime.now(timezone.utc).timestamp() > expires_at:
            self._memory_cache.pop(key, None)
            return None
        return data

    def set_public_plans(self, currency: str, billing_cycle: str, data: dict, ttl_seconds: int = 60) -> None:
        key = f"public_plans:{currency.upper()}:{billing_cycle.lower()}"
        expires_at = datetime.now(timezone.utc).timestamp() + ttl_seconds
        self._memory_cache[key] = (expires_at, data)

    def invalidate_public_plans(self) -> None:
        """Clear all cached public plan responses across currencies and cycles."""
        keys_to_remove = [k for k in self._memory_cache.keys() if k.startswith("public_plans:")]
        for k in keys_to_remove:
            self._memory_cache.pop(k, None)
        logger.info("Public pricing plan cache invalidated successfully.")


pricing_cache = PricingCacheManager()


def format_currency_amount(amount_minor: int, currency: str) -> str:
    """Format integer minor units into localized human-readable display string."""
    curr = currency.upper()
    if curr == "USD":
        # amount_minor is in cents
        dollars = amount_minor // 100
        cents = amount_minor % 100
        if cents == 0:
            return f"${dollars}"
        return f"${dollars}.{cents:02d}"
    elif curr == "UZS":
        # amount_minor is in tiyin (1 UZS = 100 tiyin)
        so_m = amount_minor // 100
        return f"{so_m:,}".replace(",", " ") + " so'm"
    return f"{amount_minor} {curr}"


class PricingResolutionResult:
    """Immutable result emitted by PricingResolutionEngine."""

    def __init__(
        self,
        plan_id: int,
        plan_code: str,
        plan_name: str,
        organization_id: int,
        organization_name: str,
        billing_interval: str,
        currency: str,
        catalog_base_price: int,
        discount_amount: int,
        effective_price: int,
        price_source: str,
        applied_offer_id: Optional[int],
        applied_offer_details: Optional[dict],
        will_change_on_renewal: bool,
        renewal_price: int,
        renewal_reason: str,
        as_of: datetime,
    ):
        self.plan_id = plan_id
        self.plan_code = plan_code
        self.plan_name = plan_name
        self.organization_id = organization_id
        self.organization_name = organization_name
        self.billing_interval = billing_interval
        self.currency = currency
        self.catalog_base_price = catalog_base_price
        self.discount_amount = discount_amount
        self.effective_price = effective_price
        self.price_source = price_source
        self.applied_offer_id = applied_offer_id
        self.applied_offer_details = applied_offer_details
        self.will_change_on_renewal = will_change_on_renewal
        self.renewal_price = renewal_price
        self.renewal_reason = renewal_reason
        self.as_of = as_of

    def to_quote_dict(self) -> dict:
        """Serialize for customer checkout quote API."""
        return {
            "customer_id": self.organization_id,
            "customer_name": self.organization_name,
            "plan": {
                "id": self.plan_id,
                "code": self.plan_code,
                "name": self.plan_name,
            },
            "billing_interval": self.billing_interval,
            "currency": self.currency,
            "quote": {
                "catalog_base_price_cents": self.catalog_base_price if self.currency == "USD" else None,
                "catalog_base_price_tiyin": self.catalog_base_price if self.currency == "UZS" else None,
                "catalog_base_price_formatted": format_currency_amount(self.catalog_base_price, self.currency),
                "discount_amount_cents": self.discount_amount if self.currency == "USD" else None,
                "discount_amount_tiyin": self.discount_amount if self.currency == "UZS" else None,
                "discount_amount_formatted": format_currency_amount(self.discount_amount, self.currency),
                "effective_price_cents": self.effective_price if self.currency == "USD" else None,
                "effective_price_tiyin": self.effective_price if self.currency == "UZS" else None,
                "effective_price_formatted": format_currency_amount(self.effective_price, self.currency),
                "discount_applied": (self.discount_amount > 0),
                "price_source": self.price_source,
                "discount_details": self.applied_offer_details,
                "renewal_policy": {
                    "will_change_on_renewal": self.will_change_on_renewal,
                    "upcoming_renewal_price": self.renewal_price,
                    "upcoming_renewal_price_formatted": format_currency_amount(self.renewal_price, self.currency),
                    "explanation": self.renewal_reason,
                },
                "quote_generated_at": self.as_of.isoformat(),
                "quote_expires_at": (self.as_of + timedelta(hours=24)).isoformat(),
            },
        }


class PricingResolutionEngine:
    """Backend-authoritative pricing resolution service."""

    @staticmethod
    async def resolve_pricing(
        db: AsyncSession,
        organization_id: int,
        plan_code: str,
        billing_interval: str,
        currency: str = "USD",
        as_of: Optional[datetime] = None,
        require_public: bool = True,
    ) -> PricingResolutionResult:
        """Resolve authoritative price for an organization.
        
        Evaluates active CustomerPricing first, then falls back to published global Plan.
        """
        now = as_of or datetime.now(timezone.utc)
        clean_interval = billing_interval.lower().strip()
        clean_currency = currency.upper().strip()
        clean_code = plan_code.lower().strip()

        if clean_interval not in ("monthly", "yearly"):
            raise ValueError(f"Invalid billing interval '{billing_interval}'. Must be 'monthly' or 'yearly'.")
        if clean_currency not in ("USD", "UZS"):
            raise ValueError(f"Invalid currency '{currency}'. Must be 'USD' or 'UZS'.")

        # 1. Verify organization exists and is active
        org = await db.get(Organization, organization_id)
        if not org or org.status != "active":
            raise ValueError(f"Organization ID {organization_id} is invalid or inactive.")

        # 2. Verify plan exists
        res = await db.execute(select(Plan).where(Plan.code == clean_code))
        plan = res.scalar_one_or_none()
        if not plan:
            raise ValueError(f"Plan with code '{plan_code}' not found.")
        if not plan.is_active:
            raise ValueError(f"Plan '{plan_code}' is currently deactivated.")

        # 3. Calculate catalog base price in integer minor units
        if clean_currency == "USD":
            catalog_base_price = (plan.price_yearly * 100) if clean_interval == "yearly" else (plan.price_monthly * 100)
        else:
            catalog_base_price = plan.price_yearly_uzs if clean_interval == "yearly" else plan.price_monthly_uzs

        # 4. Check for active, non-expired CustomerPricing offer
        stmt = (
            select(CustomerPricing)
            .where(
                CustomerPricing.customer_id == organization_id,
                CustomerPricing.plan_id == plan.id,
                CustomerPricing.billing_interval == clean_interval,
                CustomerPricing.currency == clean_currency,
                CustomerPricing.status == "active",
                CustomerPricing.starts_at <= now,
                CustomerPricing.expires_at >= now,
            )
            .order_by(CustomerPricing.created_at.desc())
            .limit(1)
        )
        offer_res = await db.execute(stmt)
        active_offer = offer_res.scalar_one_or_none()

        # If plan is not public, require that an active customer offer specifically targets it
        if require_public and not plan.is_public and not active_offer:
            raise ValueError(f"Plan '{plan_code}' is unlisted and requires an active customer offer.")

        if active_offer:
            # Step A: Apply individual customer pricing
            price_source = "customer_pricing_offer"
            applied_offer_id = active_offer.id

            if active_offer.discount_type == "percentage":
                base_dec = Decimal(catalog_base_price)
                pct_dec = Decimal(active_offer.discount_value)
                discount_dec = (base_dec * (pct_dec / Decimal(100))).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                discount_amount = int(discount_dec)
                effective_price = max(0, catalog_base_price - discount_amount)
            elif active_offer.discount_type == "fixed_amount":
                discount_amount = min(catalog_base_price, int(active_offer.discount_value))
                effective_price = max(0, catalog_base_price - discount_amount)
            elif active_offer.discount_type == "custom_price":
                effective_price = max(0, int(active_offer.discount_value))
                discount_amount = max(0, catalog_base_price - effective_price)
            else:
                raise ValueError(f"Unknown discount_type '{active_offer.discount_type}'.")

            # Check renewal transition (Platform Owner Decision 2: Option A)
            period_delta = timedelta(days=365) if clean_interval == "yearly" else timedelta(days=30)
            now_utc = normalize_datetime(now)
            offer_exp_utc = normalize_datetime(active_offer.expires_at)
            next_period_end = now_utc + period_delta
            if offer_exp_utc < next_period_end:
                will_change_on_renewal = True
                renewal_price = catalog_base_price
                renewal_reason = "Individual offer expires before next renewal cycle; subscription will revert to standard catalog rate."
            else:
                will_change_on_renewal = False
                renewal_price = effective_price
                renewal_reason = "Individual offer remains active through the next renewal cycle."

            applied_offer_details = {
                "offer_id": active_offer.id,
                "discount_type": active_offer.discount_type,
                "discount_value": active_offer.discount_value,
                "starts_at": active_offer.starts_at.isoformat(),
                "expires_at": active_offer.expires_at.isoformat(),
                "notes": active_offer.notes,
            }
        else:
            # Step B: Fallback to global catalog rate
            price_source = "global_catalog"
            applied_offer_id = None
            applied_offer_details = None
            discount_amount = 0
            effective_price = catalog_base_price
            will_change_on_renewal = False
            renewal_price = catalog_base_price
            renewal_reason = "Standard global catalog renewal."

        return PricingResolutionResult(
            plan_id=plan.id,
            plan_code=plan.code,
            plan_name=plan.name,
            organization_id=org.id,
            organization_name=org.name,
            billing_interval=clean_interval,
            currency=clean_currency,
            catalog_base_price=catalog_base_price,
            discount_amount=discount_amount,
            effective_price=effective_price,
            price_source=price_source,
            applied_offer_id=applied_offer_id,
            applied_offer_details=applied_offer_details,
            will_change_on_renewal=will_change_on_renewal,
            renewal_price=renewal_price,
            renewal_reason=renewal_reason,
            as_of=now,
        )

    @staticmethod
    async def simulate_resolution(
        db: AsyncSession,
        organization_id: int,
        plan_code: str,
        billing_interval: str,
        currency: str = "USD",
        as_of: Optional[datetime] = None,
    ) -> dict:
        """Dry-run pricing simulator providing full step-by-step calculation trace."""
        res = await PricingResolutionEngine.resolve_pricing(
            db=db,
            organization_id=organization_id,
            plan_code=plan_code,
            billing_interval=billing_interval,
            currency=currency,
            as_of=as_of,
            require_public=False,
        )

        trace = [
            f"1. Target Plan: {res.plan_name} ({res.plan_code}), Interval: {res.billing_interval}, Currency: {res.currency}",
            f"2. Catalog Base Price: {format_currency_amount(res.catalog_base_price, res.currency)} ({res.catalog_base_price} minor units)",
        ]

        if res.applied_offer_id:
            details = res.applied_offer_details
            trace.append(
                f"3. Active CustomerPricing #{res.applied_offer_id} matched: type={details['discount_type']}, value={details['discount_value']}"
            )
            trace.append(
                f"4. Computed Discount: -{format_currency_amount(res.discount_amount, res.currency)}"
            )
            trace.append(
                f"5. Final Effective Charge: {format_currency_amount(res.effective_price, res.currency)} ({res.effective_price} minor units)"
            )
        else:
            trace.append("3. No active individual customer offer found; global catalog rate applies.")
            trace.append(f"4. Final Effective Charge: {format_currency_amount(res.effective_price, res.currency)}")

        trace.append(f"6. Renewal Policy: will_change={res.will_change_on_renewal}, upcoming_price={format_currency_amount(res.renewal_price, res.currency)}")

        return {
            "organization_id": res.organization_id,
            "organization_name": res.organization_name,
            "plan_code": res.plan_code,
            "billing_interval": res.billing_interval,
            "currency": res.currency,
            "catalog_base_price": res.catalog_base_price,
            "discount_amount": res.discount_amount,
            "effective_price": res.effective_price,
            "effective_price_formatted": format_currency_amount(res.effective_price, res.currency),
            "price_source": res.price_source,
            "applied_offer_id": res.applied_offer_id,
            "will_change_on_renewal": res.will_change_on_renewal,
            "renewal_price": res.renewal_price,
            "calculation_trace": trace,
        }


pricing_service = PricingResolutionEngine()
