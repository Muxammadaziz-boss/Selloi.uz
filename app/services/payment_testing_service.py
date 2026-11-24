"""Admin Payment Testing Studio Service.

Allows platform owners to test and diagnose the TezCheck payment integration
with small UZS amounts (1,000 to 10,000 UZS) across SANDBOX and LIVE environments.

CRITICAL ARCHITECTURAL SAFETY GUARANTEE:
Transactions in this module have payment_purpose='admin_payment_test'.
They are completely isolated from subscriptions and NEVER:
- Activate START, PRO, or ULTRA plans.
- Start or extend the 7-day Mega Discount.
- Create monthly or yearly subscriptions.
- Unlock tenant features or change entitlements.
- Modify platform pricing configurations.
"""

from datetime import datetime, timezone
import secrets
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import BigInteger, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import get_logger
from app.models import Admin, AdminPaymentTest, AuditLog
from app.services.tezcheck_service import TezCheckError, TezCheckService, tezcheck_service

logger = get_logger(__name__)

# Permitted limits in integer UZS
MIN_TEST_AMOUNT_UZS = 1_000
MAX_TEST_AMOUNT_UZS = 10_000
PRESET_AMOUNTS_UZS = [1_000, 2_000, 3_000, 5_000, 10_000]
LIVE_WARNING_TEXT = (
    "DIQQAT: Bu haqiqiy to‘lov. Tanlangan summa kartangizdan yoki to‘lov "
    "vositangizdan real ravishda undiriladi."
)


class PaymentTestingValidationError(ValueError):
    """Raised when payment testing input validation fails."""
    pass


class PaymentTestingService:
    """Service layer for Admin Payment Testing Studio."""

    def validate_amount(self, amount_uzs: Any) -> int:
        """Validate that amount is a strictly valid integer between 1,000 and 10,000 UZS.

        Rejects:
        - None, non-numbers, booleans
        - Floating-point / decimal numbers
        - Zero and negative numbers
        - Amounts strictly less than 1,000 UZS
        - Amounts strictly greater than 10,000 UZS
        """
        if amount_uzs is None:
            raise PaymentTestingValidationError("To'lov summasi kiritilishi shart.")

        # Reject booleans (in Python, isinstance(True, int) is True!)
        if isinstance(amount_uzs, bool):
            raise PaymentTestingValidationError("Noto'g'ri summa formati.")

        # Reject floating-point decimals
        if isinstance(amount_uzs, float):
            raise PaymentTestingValidationError(
                "Kasr sonlar qabul qilinmaydi. To'lov summasi faqat butun so'mda bo'lishi shart."
            )

        if not isinstance(amount_uzs, int):
            # If passed as string, check if it contains decimal dot or comma
            s = str(amount_uzs).strip()
            if "." in s or "," in s:
                raise PaymentTestingValidationError(
                    "Kasr sonlar qabul qilinmaydi. To'lov summasi faqat butun so'mda bo'lishi shart."
                )
            try:
                amount_int = int(s)
            except (ValueError, TypeError):
                raise PaymentTestingValidationError("Noto'g'ri summa formati.")
        else:
            amount_int = amount_uzs

        if amount_int < MIN_TEST_AMOUNT_UZS:
            raise PaymentTestingValidationError(
                f"Minimal test to'lovi {MIN_TEST_AMOUNT_UZS:,} UZS bo'lishi kerak."
            )

        if amount_int > MAX_TEST_AMOUNT_UZS:
            raise PaymentTestingValidationError(
                f"Maksimal test to'lovi {MAX_TEST_AMOUNT_UZS:,} UZS dan oshmasligi kerak."
            )

        return amount_int

    def get_config(self) -> Dict[str, Any]:
        """Return diagnostic studio configuration and capability flags."""
        has_live_keys = bool(
            getattr(settings, "tezcheck_api_key", None)
            and getattr(settings, "tezcheck_secret_key", None)
        )
        return {
            "provider": "tezcheck",
            "currency": "UZS",
            "min_amount_uzs": MIN_TEST_AMOUNT_UZS,
            "max_amount_uzs": MAX_TEST_AMOUNT_UZS,
            "preset_amounts_uzs": PRESET_AMOUNTS_UZS,
            "default_environment": "sandbox",
            "supported_environments": ["sandbox", "live"],
            "is_live_configured": has_live_keys,
            "merchant_id": getattr(settings, "tezcheck_merchant_id", "") or "",
            "cash_desk_code": getattr(settings, "tezcheck_cash_desk_code", "") or "",
            "live_warning_text": LIVE_WARNING_TEXT,
        }

    async def create_test_payment(
        self,
        db: AsyncSession,
        admin: Admin,
        amount_uzs: Any,
        environment: str = "sandbox",
        confirm_live: bool = False,
        description: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        return_url: Optional[str] = None,
    ) -> AdminPaymentTest:
        """Create a single-use payment diagnostic test bill for platform owner.

        Ensures:
        - Rigorous integer amount validation (1,000 - 10,000 UZS).
        - Explicit confirmation check for LIVE transactions.
        - Exact tiyin conversion (amount_tiyin = amount_uzs * 100).
        - Idempotency deduplication.
        - Zero subscription or plan entitlement modification.
        """
        valid_amount = self.validate_amount(amount_uzs)
        clean_env = (environment or "sandbox").strip().lower()

        if clean_env not in ("sandbox", "live"):
            raise PaymentTestingValidationError(
                "Noto'g'ri muhit tanlandi. Faqat 'sandbox' yoki 'live' ruxsat etiladi."
            )

        if clean_env == "live" and not confirm_live:
            raise PaymentTestingValidationError(
                "LIVE to'lov uchun qat'iy tasdiqlash talab etiladi: " + LIVE_WARNING_TEXT
            )

        # 1. Idempotency Check
        if idempotency_key:
            existing_stmt = select(AdminPaymentTest).where(
                AdminPaymentTest.idempotency_key == idempotency_key
            )
            existing = (await db.execute(existing_stmt)).scalar_one_or_none()
            if existing:
                logger.info(
                    "Admin payment test request with idempotency key %s already exists (%s)",
                    idempotency_key,
                    existing.test_id,
                )
                return existing

        # 2. Minor units precision (1 UZS = 100 tiyin)
        amount_tiyin = valid_amount * 100
        test_id = f"tst_{secrets.token_hex(6)}"
        order_id = f"selloi_test_{int(datetime.now(timezone.utc).timestamp())}_{secrets.token_hex(4)}"
        desc_text = description or f"Selloi Admin Diagnostic Payment ({valid_amount:,} UZS) - {clean_env.upper()}"
        base_endpoint = getattr(settings, "public_webhook_url", None) or "https://selloi.uz"
        ret_url = return_url or f"{base_endpoint.rstrip('/')}/platform?tab=platform&subtab=payment-testing&test_id={test_id}"

        admin_email_str = (
            getattr(admin, "email", None)
            or getattr(admin, "username", None)
            or f"admin_{admin.id}@selloi.uz"
        )
        admin_user_id = admin.id if getattr(admin, "__tablename__", "") == "users" else None

        # 3. Create invoice with provider
        # In SANDBOX mode, simulate or call sandbox endpoint
        # In LIVE mode, call production TezCheck API
        metadata = {
            "payment_purpose": "admin_payment_test",
            "test_id": test_id,
            "admin_email": admin_email_str,
            "admin_id": admin.id,
            "environment": clean_env,
        }

        if clean_env == "sandbox":
            # Resilient sandbox execution
            sandbox_service = TezCheckService(mock_mode=True)
            bill_result = await sandbox_service.create_bill(
                amount=amount_tiyin,
                currency="UZS",
                order_id=order_id,
                description=desc_text,
                return_url=ret_url,
                metadata=metadata,
            )
        else:
            # LIVE execution using authoritative merchant configuration
            bill_result = await tezcheck_service.create_bill(
                amount=amount_tiyin,
                currency="UZS",
                order_id=order_id,
                description=desc_text,
                return_url=ret_url,
                metadata=metadata,
            )

        provider_bill_id = bill_result.get("bill_id")
        checkout_url = bill_result.get("pay_url") or bill_result.get("checkout_url")

        # 4. Persist immutable diagnostic record
        test_record = AdminPaymentTest(
            test_id=test_id,
            admin_id=admin_user_id,
            admin_email=admin_email_str,
            amount_uzs=valid_amount,
            amount_tiyin=amount_tiyin,
            currency="UZS",
            environment=clean_env,
            payment_purpose="admin_payment_test",
            provider="tezcheck",
            provider_bill_id=provider_bill_id,
            external_reference=order_id,
            status="pending",
            checkout_url=checkout_url,
            idempotency_key=idempotency_key,
            confirm_live=confirm_live if clean_env == "live" else False,
            metadata_snapshot=metadata,
            provider_response=bill_result,
        )
        db.add(test_record)

        # 5. Audit Logging
        audit = AuditLog(
            user_id=admin_user_id,
            organization_id=None,
            action="admin_payment_test_created",
            resource="admin_payment_test",
            resource_id=test_id,
            metadata_json={
                "amount_uzs": valid_amount,
                "amount_tiyin": amount_tiyin,
                "environment": clean_env,
                "order_id": order_id,
                "provider_bill_id": provider_bill_id,
                "admin_email": admin_email_str,
            },
        )
        db.add(audit)

        await db.commit()
        await db.refresh(test_record)

        logger.info(
            "Created admin payment test %s (%s UZS / %s) for admin %s",
            test_id,
            valid_amount,
            clean_env,
            admin.email,
        )
        return test_record

    async def get_test_by_id(
        self, db: AsyncSession, test_id: str
    ) -> Optional[AdminPaymentTest]:
        """Fetch test payment by its test_id."""
        stmt = select(AdminPaymentTest).where(AdminPaymentTest.test_id == test_id)
        return (await db.execute(stmt)).scalar_one_or_none()

    async def sync_test_payment_status(
        self, db: AsyncSession, test_id: str, admin: Admin
    ) -> AdminPaymentTest:
        """Query real-time payment status from TezCheck provider via GET /bills/{bill_id}.

        Only verified provider responses can transition a test to paid/failed/cancelled/expired.
        NEVER activates subscriptions or plans.
        """
        test_record = await self.get_test_by_id(db, test_id)
        if not test_record:
            raise PaymentTestingValidationError(f"Test yozuvi topilmadi: {test_id}")

        if not test_record.provider_bill_id:
            return test_record

        # Check with provider
        if test_record.environment == "sandbox":
            # Sandbox simulated status
            provider_status = {
                "bill_id": test_record.provider_bill_id,
                "status": test_record.status,
                "mode": "sandbox",
            }
        else:
            try:
                provider_status = await tezcheck_service.get_bill_status(
                    test_record.provider_bill_id
                )
            except TezCheckError as exc:
                logger.warning(
                    "Failed to fetch live provider status for %s: %s", test_id, exc
                )
                return test_record

        raw_status = (provider_status.get("status") or "").lower()
        old_status = test_record.status

        # Map provider status
        new_status = old_status
        if raw_status in ("paid", "completed", "succeeded", "success", "payment.succeeded"):
            new_status = "paid"
        elif raw_status in ("failed", "rejected", "error"):
            new_status = "failed"
        elif raw_status in ("cancelled", "canceled"):
            new_status = "cancelled"
        elif raw_status in ("expired", "timeout"):
            new_status = "expired"

        if new_status != old_status:
            test_record.status = new_status
            if new_status in ("paid", "failed", "cancelled", "expired") and not test_record.completed_at:
                test_record.completed_at = datetime.now(timezone.utc)
            test_record.provider_response = provider_status

            audit = AuditLog(
                user_id=admin_user_id,
                action="admin_payment_test_status_synced",
                resource="admin_payment_test",
                resource_id=test_id,
                metadata_json={
                    "old_status": old_status,
                    "new_status": new_status,
                    "provider_bill_id": test_record.provider_bill_id,
                },
            )
            db.add(audit)
            await db.commit()
            await db.refresh(test_record)

        return test_record

    async def confirm_test_payment(
        self,
        db: AsyncSession,
        test_record: Optional[AdminPaymentTest],
        bill_id: str,
        status_str: str,
        payload: Dict[str, Any],
        amount: int,
    ) -> Dict[str, Any]:
        """Webhook-driven payment status confirmation exclusively for AdminPaymentTest.

        CRITICAL: Never activates plans, subscriptions, or tenant entitlements.
        """
        if not test_record:
            stmt = select(AdminPaymentTest).where(
                or_(
                    AdminPaymentTest.provider_bill_id == bill_id,
                    AdminPaymentTest.external_reference == bill_id,
                    AdminPaymentTest.test_id == bill_id,
                )
            )
            test_record = (await db.execute(stmt)).scalar_one_or_none()

        if not test_record:
            logger.warning(
                "AdminPaymentTest for bill_id %s not found during webhook processing",
                bill_id,
            )
            return {"status": "unmatched_test_bill", "bill_id": bill_id}

        old_status = test_record.status
        normalized_status = status_str.lower()

        if normalized_status in ("paid", "completed", "success", "succeeded", "payment.succeeded"):
            test_record.status = "paid"
            test_record.completed_at = datetime.now(timezone.utc)
        elif normalized_status in ("failed", "rejected", "error"):
            test_record.status = "failed"
            test_record.completed_at = datetime.now(timezone.utc)
        elif normalized_status in ("cancelled", "canceled"):
            test_record.status = "cancelled"
            test_record.completed_at = datetime.now(timezone.utc)
        elif normalized_status in ("expired", "timeout"):
            test_record.status = "expired"
            test_record.completed_at = datetime.now(timezone.utc)

        test_record.provider_response = payload

        audit = AuditLog(
            user_id=test_record.admin_id,
            action="admin_payment_test_webhook_processed",
            resource="admin_payment_test",
            resource_id=test_record.test_id,
            metadata_json={
                "old_status": old_status,
                "new_status": test_record.status,
                "amount": amount,
                "bill_id": bill_id,
                "environment": test_record.environment,
            },
        )
        db.add(audit)
        await db.flush()

        logger.info(
            "Processed webhook for AdminPaymentTest %s: %s -> %s (NO subscription touched)",
            test_record.test_id,
            old_status,
            test_record.status,
        )

        return {
            "test_id": test_record.test_id,
            "status": test_record.status,
            "environment": test_record.environment,
            "amount_uzs": test_record.amount_uzs,
        }

    async def list_test_history(
        self,
        db: AsyncSession,
        status_filter: Optional[str] = None,
        environment_filter: Optional[str] = None,
        min_amount: Optional[int] = None,
        max_amount: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[AdminPaymentTest], int]:
        """Fetch filterable paginated test history."""
        query = select(AdminPaymentTest)

        if status_filter:
            query = query.where(AdminPaymentTest.status == status_filter.strip().lower())
        if environment_filter:
            query = query.where(AdminPaymentTest.environment == environment_filter.strip().lower())
        if min_amount is not None:
            query = query.where(AdminPaymentTest.amount_uzs >= min_amount)
        if max_amount is not None:
            query = query.where(AdminPaymentTest.amount_uzs <= max_amount)
        if date_from:
            query = query.where(AdminPaymentTest.created_at >= date_from)
        if date_to:
            query = query.where(AdminPaymentTest.created_at <= date_to)

        # Count total
        count_stmt = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_stmt)).scalar() or 0

        # Execute paginated
        query = query.order_by(desc(AdminPaymentTest.created_at)).limit(limit).offset(offset)
        items = (await db.execute(query)).scalars().all()

        return list(items), total

    async def get_test_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Separate sandbox transactions from live financial settlements."""
        all_tests = (await db.execute(select(AdminPaymentTest))).scalars().all()

        total_count = len(all_tests)
        sandbox_count = 0
        sandbox_paid_uzs = 0
        live_count = 0
        live_paid_uzs = 0
        pending_count = 0

        for t in all_tests:
            if t.status == "pending":
                pending_count += 1

            if t.environment == "sandbox":
                sandbox_count += 1
                if t.status == "paid":
                    sandbox_paid_uzs += t.amount_uzs
            else:
                live_count += 1
                if t.status == "paid":
                    live_paid_uzs += t.amount_uzs

        return {
            "total_tests": total_count,
            "pending_tests": pending_count,
            "sandbox": {
                "total_count": sandbox_count,
                "simulated_paid_uzs": sandbox_paid_uzs,
                "simulated_paid_tiyin": sandbox_paid_uzs * 100,
                "is_revenue": False,
            },
            "live": {
                "total_count": live_count,
                "collected_paid_uzs": live_paid_uzs,
                "collected_paid_tiyin": live_paid_uzs * 100,
                "is_revenue": True,
                "settlement_note": "Administrative diagnostics settlement — must be reconciled in merchant reports",
            },
        }


payment_testing_service = PaymentTestingService()
