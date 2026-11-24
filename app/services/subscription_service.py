"""Subscription & Mega Discount Billing Engine for Selloi.uz.

Implements the official Selloi subscription model:
1. First-Time Mega Discount:
   - START: $1 equivalent (13,000 UZS) for 7 days
   - PRO: $2 equivalent (26,000 UZS) for 7 days
   - ULTRA: $3 equivalent (39,000 UZS) for 7 days
   - One-time introductory offer per eligible tenant
   - Expiration: exactly paid_at + 7 days
2. Regular Monthly and Yearly Subscriptions:
   - Monthly: 30-day cycle at regular plan price
   - Yearly: 365-day cycle at regular annual plan price
   - No weekly subscriptions; no automatic free trials
3. Ten-State Subscription Lifecycle State Machine:
   - mega_discount_active
   - mega_discount_expired
   - awaiting_subscription_selection
   - awaiting_monthly_payment
   - awaiting_yearly_payment
   - subscription_active
   - renewal_due
   - renewal_pending
   - subscription_expired
   - cancelled
4. Explicit Renewal Consent & TezCheck Single-Use Bill Workflow.
5. Non-Destructive Feature Suspension upon Expiration.
"""

import calendar
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models import (
    AuditLog,
    Organization,
    Plan,
    Subscription,
    SubscriptionConsent,
    PaymentBill,
    User,
    WebhookEvent
)
from app.services.tezcheck_service import tezcheck_service, TezCheckError
from app.services.centralized_pricing_service import (
    centralized_pricing_service,
    PERIOD_MEGA_DISCOUNT_7D,
    PERIOD_MONTHLY,
    PERIOD_YEARLY,
    normalize_tariff_code
)

logger = get_logger(__name__)

# Expiration Notification String and Details
MEGA_DISCOUNT_EXPIRED_TITLE = "MEGA CHEGIRMA MUDDATI YAKUNLANDI"
MEGA_DISCOUNT_EXPIRED_NOTIFICATION = (
    "Sizning Mega Chegirma muddatingiz yakunlandi. "
    "Selloi xizmatidan foydalanishni davom ettirish uchun oylik yoki yillik obunani tanlang."
)
MEGA_DISCOUNT_EXPIRED_CTA = "Obunani tanlash"


def add_calendar_months(dt: datetime, months: int) -> datetime:
    """Add exact calendar months, correctly handling month-end overflow and leap years.

    Examples:
    - January 15 + 1 month -> February 15
    - January 31 + 1 month in non-leap year (2025) -> February 28
    - January 31 + 1 month in leap year (2024) -> February 29
    - March 31 + 1 month -> April 30
    """
    new_year = dt.year + (dt.month + months - 1) // 12
    new_month = (dt.month + months - 1) % 12 + 1
    max_days = calendar.monthrange(new_year, new_month)[1]
    new_day = min(dt.day, max_days)
    return dt.replace(year=new_year, month=new_month, day=new_day)


def add_calendar_years(dt: datetime, years: int) -> datetime:
    """Add exact calendar years, handling leap year overflow (e.g. Feb 29 to Feb 28)."""
    new_year = dt.year + years
    max_days = calendar.monthrange(new_year, dt.month)[1]
    new_day = min(dt.day, max_days)
    return dt.replace(year=new_year, day=new_day)

# Standard Promotional Pricing Mapping (in UZS tiyin, 1 UZS = 100 tiyin)
MEGA_DISCOUNT_RATES = {
    "start": {
        "usd_equivalent": 1,
        "amount_uzs": 13000,
        "amount_tiyin": 1300000,
        "duration_days": 7,
        "label": "START - 7 kunlik Mega Chegirma ($1)"
    },
    "standard": {
        "usd_equivalent": 1.5,
        "amount_uzs": 20000,
        "amount_tiyin": 2000000,
        "duration_days": 7,
        "label": "STANDART - 7 kunlik Mega Chegirma ($1.5)"
    },
    "standart": {
        "usd_equivalent": 1.5,
        "amount_uzs": 20000,
        "amount_tiyin": 2000000,
        "duration_days": 7,
        "label": "STANDART - 7 kunlik Mega Chegirma ($1.5)"
    },
    "pro": {
        "usd_equivalent": 2,
        "amount_uzs": 26000,
        "amount_tiyin": 2600000,
        "duration_days": 7,
        "label": "PRO - 7 kunlik Mega Chegirma ($2)"
    },
    "ultra": {
        "usd_equivalent": 3,
        "amount_uzs": 39000,
        "amount_tiyin": 3900000,
        "duration_days": 7,
        "label": "ULTRA - 7 kunlik Mega Chegirma ($3)"
    }
}

VALID_SUBSCRIPTION_STATES = {
    "mega_discount_active",
    "mega_discount_expired",
    "awaiting_subscription_selection",
    "awaiting_monthly_payment",
    "awaiting_yearly_payment",
    "subscription_active",
    "renewal_due",
    "renewal_pending",
    "subscription_expired",
    "cancelled"
}


class SubscriptionError(Exception):
    """Base exception for subscription domain errors."""
    pass


class IneligibleForMegaDiscountError(SubscriptionError):
    """Raised when an organization attempts to purchase a second mega discount."""
    pass


class InvalidSubscriptionStateTransitionError(SubscriptionError):
    """Raised when an unauthorized state transition is attempted."""
    pass


class SubscriptionService:
    """Manages Selloi subscription lifecycle, mega discounts, and renewals."""

    @staticmethod
    def calculate_mega_discount_expiration(paid_at: datetime) -> datetime:
        """Calculate promotional expiration date: exactly paid_at + 7 days."""
        return paid_at + timedelta(days=7)

    @staticmethod
    def calculate_regular_period_end(paid_at: datetime, billing_cycle: str) -> datetime:
        """Calculate regular period end: one calendar month for monthly, twelve calendar months for yearly."""
        cycle = billing_cycle.lower().strip()
        if cycle == "yearly":
            return add_calendar_years(paid_at, 1)
        if cycle == "monthly":
            return add_calendar_months(paid_at, 1)
        raise SubscriptionError(f"Noto'g'ri obuna davri: '{billing_cycle}'. Faqat 'monthly' yoki 'yearly' qabul qilinadi. Haftalik obuna mavjud emas.")

    async def get_or_create_subscription(
        self,
        db: AsyncSession,
        organization_id: int
    ) -> Subscription:
        """Retrieve existing subscription or initialize initial state."""
        res = await db.execute(
            select(Subscription).where(Subscription.organization_id == organization_id)
        )
        sub = res.scalar_one_or_none()
        if sub:
            return sub

        # Fetch START plan as default plan
        plan_res = await db.execute(select(Plan).where(Plan.code == "start"))
        start_plan = plan_res.scalar_one_or_none()
        if not start_plan:
            # Fallback creation if not seeded
            start_plan = Plan(
                code="start",
                name="START",
                price_monthly=19,
                price_yearly=190,
                price_monthly_uzs=24500000,
                price_yearly_uzs=245000000,
                currency="USD"
            )
            db.add(start_plan)
            await db.flush()

        now = datetime.now(timezone.utc)
        sub = Subscription(
            organization_id=organization_id,
            plan_id=start_plan.id,
            status="awaiting_subscription_selection",
            billing_cycle="monthly",
            provider="tezcheck",
            started_at=now,
            current_period_start=now,
            current_period_end=now,
            mega_discount_used=False
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        return sub

    async def check_mega_discount_eligibility(
        self,
        db: AsyncSession,
        organization_id: int
    ) -> Tuple[bool, str]:
        """Check if organization is eligible for the first-time 7-day mega discount."""
        sub = await self.get_or_create_subscription(db, organization_id)
        if sub.mega_discount_used:
            return False, "Siz avval Mega Chegirma xizmatidan foydalangansiz."

        # Check if any paid mega discount invoice exists
        paid_promo_bill = await db.execute(
            select(PaymentBill).where(
                PaymentBill.organization_id == organization_id,
                PaymentBill.billing_cycle == "mega_discount",
                PaymentBill.status == "paid"
            )
        )
        if paid_promo_bill.scalar_one_or_none():
            return False, "Mega Chegirma allaqachon to'langan va faollashtirilgan."

        return True, "Mega Chegirma taklifi mavjud."

    async def create_mega_discount_checkout(
        self,
        db: AsyncSession,
        organization_id: int,
        user_id: int,
        plan_code: str,
        return_url: str
    ) -> Dict[str, Any]:
        """Generate a single-use TezCheck payment bill for 7-day introductory mega discount with immutable price snapshot."""
        plan_code_lower = normalize_tariff_code(plan_code)

        is_eligible, reason = await self.check_mega_discount_eligibility(db, organization_id)
        if not is_eligible:
            raise IneligibleForMegaDiscountError(reason)

        # Resolve authoritative approved promotional UZS price from Centralized Pricing Engine
        tariff_info = await centralized_pricing_service.get_tariff_price(
            db=db,
            plan_code=plan_code_lower,
            billing_period=PERIOD_MEGA_DISCOUNT_7D
        )
        amount_tiyin = tariff_info["amount_tiyin"]
        amount_uzs = tariff_info["amount_uzs"]
        price_version = tariff_info["price_version"]
        plan_id = tariff_info["plan_id"]

        order_id = f"selloi_promo_{organization_id}_{plan_code_lower}_{int(datetime.now(timezone.utc).timestamp())}"
        description = f"Selloi.uz - {tariff_info['plan_name']} Mega Chegirma (7 kunlik sinov)"

        # 1. Create bill in TezCheck with integer tiyin (amount_uzs * 100)
        tezcheck_res = await tezcheck_service.create_bill(
            amount=amount_tiyin,
            currency="UZS",
            order_id=order_id,
            description=description,
            return_url=return_url,
            metadata={
                "organization_id": organization_id,
                "user_id": user_id,
                "plan_code": plan_code_lower,
                "billing_cycle": "mega_discount",
                "price_version": price_version,
            }
        )

        bill_id = tezcheck_res["bill_id"]
        checkout_url = tezcheck_res["pay_url"]

        # 2. Record PaymentBill with frozen immutable price snapshot
        now = datetime.now(timezone.utc)
        bill = PaymentBill(
            bill_id=bill_id,
            order_id=order_id,
            organization_id=organization_id,
            user_id=user_id,
            plan_id=plan_id,
            plan_code=plan_code_lower,
            billing_cycle="mega_discount",
            billing_period=PERIOD_MEGA_DISCOUNT_7D,
            amount=amount_tiyin,
            amount_minor=amount_tiyin,
            price_uzs=amount_uzs,
            price_version=price_version,
            discount_amount_uzs=0,
            final_amount_uzs=amount_uzs,
            currency="UZS",
            status="pending",
            checkout_url=checkout_url,
            environment="mock" if tezcheck_service.mock_mode else "production",
            provider="tezcheck",
            provider_response=tezcheck_res,
            created_at=now,
            expires_at=now + timedelta(hours=24)
        )
        db.add(bill)

        # 3. Transition subscription state to awaiting payment
        sub = await self.get_or_create_subscription(db, organization_id)
        sub.status = "awaiting_subscription_selection"
        await db.commit()

        return {
            "bill_id": bill_id,
            "order_id": order_id,
            "plan_code": plan_code_lower,
            "billing_cycle": "mega_discount",
            "price_version": price_version,
            "amount_uzs": amount_uzs,
            "amount_tiyin": amount_tiyin,
            "duration_days": 7,
            "checkout_url": checkout_url
        }

    async def create_subscription_checkout(
        self,
        db: AsyncSession,
        organization_id: int,
        user_id: int,
        plan_code: str,
        billing_cycle: str,
        return_url: str
    ) -> Dict[str, Any]:
        """Generate a single-use TezCheck invoice for regular monthly or yearly subscription with immutable price snapshot."""
        plan_code_lower = normalize_tariff_code(plan_code)
        cycle_lower = billing_cycle.lower().strip()

        if cycle_lower not in ("monthly", "yearly"):
            raise SubscriptionError("Faqat 'monthly' yoki 'yearly' obuna davri mavjud. Haftalik obuna mavjud emas.")

        # Resolve authoritative approved UZS price from Centralized Pricing Engine
        period_enum = PERIOD_YEARLY if cycle_lower == "yearly" else PERIOD_MONTHLY
        tariff_info = await centralized_pricing_service.get_tariff_price(
            db=db,
            plan_code=plan_code_lower,
            billing_period=period_enum
        )

        amount_tiyin = tariff_info["amount_tiyin"]
        amount_uzs = tariff_info["amount_uzs"]
        price_version = tariff_info["price_version"]
        plan_id = tariff_info["plan_id"]
        cycle_label = "1 yillik" if cycle_lower == "yearly" else "1 oylik"

        order_id = f"selloi_sub_{organization_id}_{plan_code_lower}_{cycle_lower}_{int(datetime.now(timezone.utc).timestamp())}"
        description = f"Selloi.uz - {tariff_info['plan_name']} {cycle_label} obunasi"

        # 1. Create bill in TezCheck with integer tiyin (amount_uzs * 100)
        tezcheck_res = await tezcheck_service.create_bill(
            amount=amount_tiyin,
            currency="UZS",
            order_id=order_id,
            description=description,
            return_url=return_url,
            metadata={
                "organization_id": organization_id,
                "user_id": user_id,
                "plan_code": plan_code_lower,
                "billing_cycle": cycle_lower,
                "price_version": price_version,
            }
        )

        bill_id = tezcheck_res["bill_id"]
        checkout_url = tezcheck_res["pay_url"]

        # 2. Record PaymentBill with frozen immutable price snapshot
        now = datetime.now(timezone.utc)
        bill = PaymentBill(
            bill_id=bill_id,
            order_id=order_id,
            organization_id=organization_id,
            user_id=user_id,
            plan_id=plan_id,
            plan_code=plan_code_lower,
            billing_cycle=cycle_lower,
            billing_period=period_enum,
            amount=amount_tiyin,
            amount_minor=amount_tiyin,
            price_uzs=amount_uzs,
            price_version=price_version,
            discount_amount_uzs=0,
            final_amount_uzs=amount_uzs,
            currency="UZS",
            status="pending",
            checkout_url=checkout_url,
            environment="mock" if tezcheck_service.mock_mode else "production",
            provider="tezcheck",
            provider_response=tezcheck_res,
            created_at=now,
            expires_at=now + timedelta(hours=48)
        )
        db.add(bill)

        sub = await self.get_or_create_subscription(db, organization_id)
        if cycle_lower == "yearly":
            sub.status = "awaiting_yearly_payment"
        else:
            sub.status = "awaiting_monthly_payment"

        await db.commit()

        return {
            "bill_id": bill_id,
            "order_id": order_id,
            "plan_code": plan_code_lower,
            "billing_cycle": cycle_lower,
            "price_version": price_version,
            "amount_uzs": amount_uzs,
            "amount_tiyin": amount_tiyin,
            "checkout_url": checkout_url
        }

    async def confirm_payment_and_activate(
        self,
        db: AsyncSession,
        bill_id: str,
        paid_amount: int,
        currency: str = "UZS",
        verified_paid_at: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Confirm bill payment from TezCheck webhook and activate subscription entitlement."""
        stmt = select(PaymentBill).where(PaymentBill.bill_id == bill_id)
        try:
            stmt = stmt.with_for_update()
        except Exception:
            pass
        res = await db.execute(stmt)
        bill = res.scalar_one_or_none()
        if not bill:
            raise SubscriptionError(f"Hisob-faktura topilmadi: {bill_id}")

        if bill.status == "paid":
            logger.info("Bill %s already confirmed (idempotent skipped)", bill_id)
            return {"status": "already_paid", "bill_id": bill_id}

        # Check amount and currency
        if paid_amount != bill.amount:
            raise SubscriptionError(
                f"To'lov miqdori mos kelmadi: kutilgan {bill.amount}, olingan {paid_amount}"
            )
        if currency.upper() != bill.currency.upper():
            raise SubscriptionError(
                f"To'lov valyutasi mos kelmadi: kutilgan {bill.currency}, olingan {currency}"
            )

        paid_at = verified_paid_at or datetime.now(timezone.utc)
        bill.status = "paid"
        bill.paid_at = paid_at

        sub = await self.get_or_create_subscription(db, bill.organization_id)
        plan_res = await db.execute(select(Plan).where(Plan.code == bill.plan_code))
        target_plan = plan_res.scalar_one_or_none()
        if not target_plan:
            raise SubscriptionError(f"Tarif topilmadi: {bill.plan_code}")

        sub.plan_id = target_plan.id
        sub.provider = "tezcheck"

        if bill.billing_cycle == "mega_discount":
            # 7-day introductory mega discount activation
            expiration_at = self.calculate_mega_discount_expiration(paid_at)
            sub.status = "mega_discount_active"
            sub.billing_cycle = "mega_discount"
            sub.current_period_start = paid_at
            sub.current_period_end = expiration_at
            sub.mega_discount_used = True
            sub.mega_discount_plan_code = bill.plan_code
            sub.mega_discount_paid_at = paid_at
            sub.mega_discount_expires_at = expiration_at
            sub.mega_discount_order_id = bill.bill_id
            action_name = "mega_discount_activated"
        else:
            # Regular monthly or yearly subscription activation
            period_end = self.calculate_regular_period_end(paid_at, bill.billing_cycle)
            sub.status = "subscription_active"
            sub.billing_cycle = bill.billing_cycle
            sub.current_period_start = paid_at
            sub.current_period_end = period_end
            sub.cancel_at_period_end = False
            action_name = "subscription_activated"

        # Record immutable audit log
        audit = AuditLog(
            organization_id=bill.organization_id,
            user_id=bill.user_id,
            action=action_name,
            resource="subscription",
            resource_id=str(sub.id),
            metadata_json={
                "bill_id": bill_id,
                "order_id": getattr(bill, "order_id", bill_id),
                "plan_code": bill.plan_code,
                "billing_cycle": bill.billing_cycle,
                "paid_amount": paid_amount,
                "price_version": getattr(bill, "price_version", 1),
                "currency": currency,
                "current_period_end": sub.current_period_end.isoformat()
            }
        )
        db.add(audit)
        await db.commit()
        await db.refresh(sub)

        return {
            "status": "activated",
            "subscription_id": sub.id,
            "subscription_status": sub.status,
            "plan_code": bill.plan_code,
            "current_period_end": sub.current_period_end.isoformat()
        }

    async def verify_and_sync_payment_from_provider(
        self,
        db: AsyncSession,
        bill_id: str
    ) -> Dict[str, Any]:
        """Direct server-to-server verification with TezCheck GET /bills/{bill_id}."""
        res = await db.execute(select(PaymentBill).where(PaymentBill.bill_id == bill_id))
        bill = res.scalar_one_or_none()
        if not bill:
            raise SubscriptionError(f"Hisob-faktura topilmadi: {bill_id}")

        if bill.status == "paid":
            return {"status": "already_paid", "bill_id": bill_id}

        provider_data = await tezcheck_service.get_bill_status(bill_id)
        provider_status = str(provider_data.get("status", "")).lower()

        if provider_status in ("paid", "succeeded", "completed"):
            paid_amount = int(provider_data.get("amount_minor") or bill.amount)
            return await self.confirm_payment_and_activate(
                db=db,
                bill_id=bill_id,
                paid_amount=paid_amount,
                currency=provider_data.get("currency", bill.currency)
            )

        return {
            "status": bill.status,
            "provider_status": provider_status,
            "bill_id": bill_id
        }

    async def evaluate_and_sync_subscription_state(
        self,
        db: AsyncSession,
        organization_id: int,
        current_time: Optional[datetime] = None
    ) -> Subscription:
        """Evaluate server-authoritative state transitions based on verified timestamps."""
        sub = await self.get_or_create_subscription(db, organization_id)
        now = current_time or datetime.now(timezone.utc)

        # 1. Mega discount expiration check
        if sub.status == "mega_discount_active" and sub.current_period_end:
            period_end = sub.current_period_end
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
            if now >= period_end:
                sub.status = "mega_discount_expired"
                logger.info("Organization %s mega discount has expired", organization_id)
                await db.commit()
                await db.refresh(sub)
                return sub

        # 2. Regular active subscription expiration check
        if sub.status == "subscription_active" and sub.current_period_end:
            period_end = sub.current_period_end
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
            if now >= period_end:
                sub.status = "renewal_due"
                logger.info("Organization %s subscription renewal is due", organization_id)
                await db.commit()
                await db.refresh(sub)
                return sub

        # 3. Renewal grace period expiration (e.g. 3 days after due)
        if sub.status in ("renewal_due", "renewal_pending") and sub.current_period_end:
            period_end = sub.current_period_end
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
            grace_period_end = period_end + timedelta(days=3)
            if now >= grace_period_end:
                sub.status = "subscription_expired"
                logger.info("Organization %s subscription expired after grace period", organization_id)
                await db.commit()
                await db.refresh(sub)
                return sub

        # 4. Cancelled subscription reaching end of period
        if sub.status == "cancelled" and sub.current_period_end:
            period_end = sub.current_period_end
            if period_end.tzinfo is None:
                period_end = period_end.replace(tzinfo=timezone.utc)
            if now >= period_end:
                sub.status = "subscription_expired"
                await db.commit()
                await db.refresh(sub)
                return sub

        return sub

    async def record_explicit_renewal_consent(
        self,
        db: AsyncSession,
        organization_id: int,
        user_id: int,
        billing_cycle: str,
        agreed_amount: int,
        accepted_terms_version: str = "v1.0",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> SubscriptionConsent:
        """Record explicit, non-prechecked user consent for scheduled renewal billing terms."""
        sub = await self.get_or_create_subscription(db, organization_id)

        consent = SubscriptionConsent(
            user_id=user_id,
            organization_id=organization_id,
            subscription_id=sub.id,
            consent_timestamp=datetime.now(timezone.utc),
            accepted_terms_version=accepted_terms_version,
            selected_billing_cycle=billing_cycle,
            agreed_amount=agreed_amount,
            agreed_currency="UZS",
            renewal_state="consent_given",
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(consent)

        audit = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action="renewal_consent_granted",
            resource="subscription_consent",
            resource_id=str(sub.id),
            metadata_json={
                "billing_cycle": billing_cycle,
                "agreed_amount": agreed_amount,
                "accepted_terms_version": accepted_terms_version
            }
        )
        db.add(audit)
        await db.commit()
        await db.refresh(consent)
        return consent

    async def disable_automatic_renewal(
        self,
        db: AsyncSession,
        organization_id: int,
        user_id: int
    ) -> Dict[str, Any]:
        """Disable renewal consent and mark subscription cancel_at_period_end."""
        sub = await self.get_or_create_subscription(db, organization_id)
        sub.cancel_at_period_end = True

        consent_res = await db.execute(
            select(SubscriptionConsent)
            .where(SubscriptionConsent.organization_id == organization_id)
            .order_by(SubscriptionConsent.id.desc())
        )
        latest_consent = consent_res.scalars().first()
        if latest_consent:
            latest_consent.renewal_state = "cancelled"

        audit = AuditLog(
            organization_id=organization_id,
            user_id=user_id,
            action="renewal_consent_cancelled",
            resource="subscription_consent",
            resource_id=str(sub.id),
            metadata_json={"renewal_state": "cancelled"}
        )
        db.add(audit)
        await db.commit()
        await db.refresh(sub)
        return {
            "status": "disabled",
            "subscription_id": sub.id,
            "cancel_at_period_end": True,
            "current_period_end": sub.current_period_end.isoformat()
        }

    async def is_commercial_access_active(
        self,
        db: AsyncSession,
        organization_id: int,
        current_time: Optional[datetime] = None
    ) -> bool:
        """Determine if organization currently has active access to protected commercial features."""
        sub = await self.evaluate_and_sync_subscription_state(db, organization_id, current_time=current_time)
        return sub.status in ("mega_discount_active", "subscription_active")

    async def get_subscription_overview(
        self,
        db: AsyncSession,
        organization_id: int
    ) -> Dict[str, Any]:
        """Return unified subscription overview with active state, expiration, and alerts."""
        sub = await self.evaluate_and_sync_subscription_state(db, organization_id)
        plan_res = await db.execute(select(Plan).where(Plan.id == sub.plan_id))
        plan = plan_res.scalar_one_or_none()
        plan_code = plan.code if plan else "start"
        plan_name = plan.name if plan else "START"

        now = datetime.now(timezone.utc)
        end_time = sub.current_period_end or now
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        days_remaining = max(0, (end_time - now).days)
        seconds_remaining = max(0, int((end_time - now).total_seconds()))

        is_commercial_active = sub.status in ("mega_discount_active", "subscription_active")

        # Check latest consent
        consent_res = await db.execute(
            select(SubscriptionConsent)
            .where(SubscriptionConsent.organization_id == organization_id)
            .order_by(SubscriptionConsent.id.desc())
        )
        latest_consent = consent_res.scalars().first()
        renewal_state = latest_consent.renewal_state if latest_consent else "unconsented"
        renewal_consented = (renewal_state == "consent_given") and (not sub.cancel_at_period_end)

        # Expiration notification & structured details
        notification = None
        notification_details = None
        if sub.status == "mega_discount_expired":
            notification = MEGA_DISCOUNT_EXPIRED_NOTIFICATION
            notification_details = {
                "title": MEGA_DISCOUNT_EXPIRED_TITLE,
                "description": MEGA_DISCOUNT_EXPIRED_NOTIFICATION,
                "cta": MEGA_DISCOUNT_EXPIRED_CTA,
            }
        elif sub.status == "subscription_expired":
            notification = "Sizning obuna muddatingiz yakunlandi. Xizmatlardan to'liq foydalanish uchun obunani yangilang."
            notification_details = {
                "title": "OBUNA MUDDATI YAKUNLANDI",
                "description": "Sizning obuna muddatingiz yakunlandi. Xizmatlardan to'liq foydalanish uchun obunani yangilang.",
                "cta": "Obunani yangilash",
            }
        elif sub.status in ("renewal_due", "renewal_pending"):
            notification = "Sizning obuna muddatingiz tugash arafasida. Xizmat to'xtab qolmasligi uchun hisobni to'lang."
            notification_details = {
                "title": "OBUNANI YANGILASH VAQTI KELDI",
                "description": "Sizning obuna muddatingiz tugash arafasida. Xizmat to'xtab qolmasligi uchun hisobni to'lang.",
                "cta": "Hisobni to'lash",
            }

        is_eligible_promo, _ = await self.check_mega_discount_eligibility(db, organization_id)

        start_iso = sub.current_period_start.isoformat() if sub.current_period_start else now.isoformat()
        end_iso = sub.current_period_end.isoformat() if sub.current_period_end else now.isoformat()

        return {
            "organization_id": organization_id,
            "subscription_id": sub.id,
            "status": sub.status,
            "plan_code": plan_code,
            "plan_name": plan_name,
            "billing_cycle": sub.billing_cycle,
            "current_period_start": start_iso,
            "current_period_end": end_iso,
            "days_remaining": days_remaining,
            "seconds_remaining": seconds_remaining,
            "is_commercial_access_active": is_commercial_active,
            "mega_discount_used": sub.mega_discount_used,
            "mega_discount_eligible": is_eligible_promo,
            "notification": notification,
            "notification_details": notification_details,
            "renewal_state": renewal_state,
            "renewal_consented": renewal_consented,
            "recurring_auto_charge_supported": False,
            "cancel_at_period_end": sub.cancel_at_period_end,
            "plan_prices": {
                "monthly_uzs": plan.price_monthly_uzs if plan else 24500000,
                "yearly_uzs": plan.price_yearly_uzs if plan else 245000000,
                "monthly_usd": plan.price_monthly if plan else 19,
                "yearly_usd": plan.price_yearly if plan else 190
            }
        }


subscription_service = SubscriptionService()
