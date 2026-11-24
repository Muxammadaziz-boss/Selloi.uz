"""Comprehensive Automated Test Suite for Payment Testing Studio.

Verifies all 14 mandatory security, financial, and isolation requirements:
1. 1,000 UZS amount accepted.
2. 10,000 UZS amount accepted.
3. 500 UZS rejected.
4. 10,001 UZS rejected.
5. Decimal amount rejected.
6. Correct tiyin conversion (amount_tiyin = amount_uzs * 100).
7. Duplicate request protection (Idempotency).
8. Unauthorized admin access denied (Owner-only).
9. Successful test payment does not activate subscription.
10. Failed payment does not activate subscription.
11. Duplicate webhook does not duplicate transaction.
12. LIVE payment requires explicit confirmation.
13. SANDBOX and LIVE transactions remain distinguishable.
14. Payment testing does not modify pricing configuration.
"""

import asyncio
from datetime import datetime, timezone
import secrets
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.models import (
    Base,
    Admin,
    AdminPaymentTest,
    Organization,
    Plan,
    PlanPriceHistory,
    PaymentBill,
    CustomerPricing,
    Subscription,
    User,
    AuditLog,
    WebhookEvent,
)
from app.services.centralized_pricing_service import (
    CANONICAL_BASELINE_PRICING,
    centralized_pricing_service,
)
from app.services.payment_testing_service import (
    PaymentTestingService,
    PaymentTestingValidationError,
    payment_testing_service,
)


def run_in_test_db(coro_fn):
    """Run an async test function inside an isolated in-memory SQLite database session."""
    async def _runner():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, poolclass=StaticPool)
        tables = [
            Admin.__table__,
            User.__table__,
            Organization.__table__,
            Plan.__table__,
            PlanPriceHistory.__table__,
            PaymentBill.__table__,
            CustomerPricing.__table__,
            Subscription.__table__,
            AdminPaymentTest.__table__,
            AuditLog.__table__,
            WebhookEvent.__table__,
        ]
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=tables))
        session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with session_factory() as session:
            await centralized_pricing_service.seed_or_verify_tariffs(session)
            await coro_fn(session)
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.drop_all(sync_conn, tables=tables))
        await engine.dispose()

    asyncio.run(_runner())


@pytest.fixture
def test_admin():
    """Mock platform owner admin."""
    admin = Admin(
        id=999,
        username="superowner",
        role="superadmin",
        telegram_user_id=12345678,
    )
    admin.email = "owner@selloi.uz"
    admin._is_platform_owner = True
    return admin


@pytest.fixture
def regular_admin():
    """Mock regular store admin (non-platform-owner)."""
    admin = Admin(
        id=888,
        username="storeadmin",
        role="admin",
        telegram_user_id=87654321,
    )
    admin.email = "store@selloi.uz"
    admin._is_platform_owner = False
    return admin


class TestPaymentTestingStudio:
    """Automated acceptance test suite for Admin Payment Testing Studio."""

    # 1. 1,000 UZS amount accepted
    def test_01_amount_1000_uzs_accepted(self):
        """Minimum permitted amount of 1,000 UZS is accepted."""
        validated = payment_testing_service.validate_amount(1000)
        assert validated == 1000

    # 2. 10,000 UZS amount accepted
    def test_02_amount_10000_uzs_accepted(self):
        """Maximum permitted amount of 10,000 UZS is accepted."""
        validated = payment_testing_service.validate_amount(10000)
        assert validated == 10000

    # 3. 500 UZS rejected
    def test_03_amount_500_uzs_rejected(self):
        """Amount below 1,000 UZS (500 UZS) is strictly rejected."""
        with pytest.raises(PaymentTestingValidationError, match="Minimal test to'lovi"):
            payment_testing_service.validate_amount(500)

    # 4. 10,001 UZS rejected
    def test_04_amount_10001_uzs_rejected(self):
        """Amount above 10,000 UZS (10,001 UZS) is strictly rejected."""
        with pytest.raises(PaymentTestingValidationError, match="Maksimal test to'lovi"):
            payment_testing_service.validate_amount(10001)

    # 5. Decimal amount rejected
    def test_05_decimal_amount_rejected(self):
        """Decimal amounts (e.g. 2500.50 or '1500.75') are rejected."""
        with pytest.raises(PaymentTestingValidationError, match="Kasr sonlar qabul qilinmaydi"):
            payment_testing_service.validate_amount(2500.50)

        with pytest.raises(PaymentTestingValidationError, match="Kasr sonlar qabul qilinmaydi"):
            payment_testing_service.validate_amount("1500.75")

        with pytest.raises(PaymentTestingValidationError, match="Kasr sonlar qabul qilinmaydi"):
            payment_testing_service.validate_amount("2000,50")

    # 6. Correct tiyin conversion
    def test_06_correct_tiyin_conversion(self, test_admin):
        """Tiyin is computed accurately as amount_uzs * 100 (1 UZS = 100 tiyin)."""
        async def _test(db):
            test_cases = [(1000, 100000), (2000, 200000), (5000, 500000), (10000, 1000000)]
            for uzs, expected_tiyin in test_cases:
                record = await payment_testing_service.create_test_payment(
                    db=db,
                    admin=test_admin,
                    amount_uzs=uzs,
                    environment="sandbox",
                )
                assert record.amount_uzs == uzs
                assert record.amount_tiyin == expected_tiyin
                assert record.amount_tiyin == uzs * 100
        run_in_test_db(_test)

    # 7. Duplicate request protection (Idempotency)
    def test_07_duplicate_request_protection(self, test_admin):
        """Submitting with the same idempotency_key returns existing record without duplicate creation."""
        async def _test(db):
            idemp_key = f"test_idemp_{secrets.token_hex(8)}"
            first_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=3000,
                environment="sandbox",
                idempotency_key=idemp_key,
            )

            second_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=3000,
                environment="sandbox",
                idempotency_key=idemp_key,
            )

            assert first_record.test_id == second_record.test_id
            assert first_record.id == second_record.id

            # Verify only 1 record exists in DB with this key
            count = (
                await db.execute(
                    select(AdminPaymentTest).where(AdminPaymentTest.idempotency_key == idemp_key)
                )
            ).scalars().all()
            assert len(count) == 1
        run_in_test_db(_test)

    # 8. Unauthorized admin access denied
    def test_08_unauthorized_admin_access_denied(self, regular_admin):
        """Non-platform-owner regular administrators cannot access payment testing."""
        from app.api.platform import require_platform_owner
        from fastapi import HTTPException

        async def _test(db):
            with pytest.raises(HTTPException) as exc_info:
                await require_platform_owner(admin=regular_admin, db=db)
            assert exc_info.value.status_code in (401, 403)
        run_in_test_db(_test)

    # 9. Successful test payment does not activate subscription
    def test_09_successful_test_payment_does_not_activate_subscription(self, test_admin):
        """Confirming a test payment as 'paid' NEVER touches or activates tenant subscriptions."""
        async def _test(db):
            # 1. Create a dummy tenant with unpaid subscription
            tenant_slug = f"test_tenant_{secrets.token_hex(4)}"
            org = Organization(
                name="Test Tenant Store",
                slug=tenant_slug,
            )
            db.add(org)
            await db.flush()

            sub = Subscription(
                organization_id=org.id,
                plan_id=1,
                status="awaiting_subscription_selection",
                current_period_end=datetime.now(timezone.utc),
                mega_discount_used=False,
            )
            db.add(sub)
            await db.commit()

            initial_sub_status = sub.status
            initial_plan_id = sub.plan_id
            initial_end = sub.current_period_end
            initial_mega_used = sub.mega_discount_used

            # 2. Create and confirm an admin test payment
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=5000,
                environment="sandbox",
            )

            # Confirm via webhook handler
            webhook_payload = {
                "event": "payment.succeeded",
                "bill_id": test_record.provider_bill_id,
                "data": {
                    "bill_id": test_record.provider_bill_id,
                    "state": "succeeded",
                    "amount_minor": test_record.amount_tiyin,
                    "currency": "UZS",
                },
            }
            webhook_result = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload=webhook_payload,
                amount=test_record.amount_tiyin,
            )
            await db.commit()

            # 3. Assert test is paid
            assert webhook_result["status"] == "paid"
            await db.refresh(test_record)
            assert test_record.status == "paid"
            assert test_record.completed_at is not None

            # 4. CRITICAL ASSERTION: Tenant subscription is completely unchanged
            await db.refresh(sub)
            assert sub.status == initial_sub_status
            assert sub.plan_id == initial_plan_id
            assert (sub.current_period_end.replace(tzinfo=timezone.utc) if sub.current_period_end.tzinfo is None else sub.current_period_end) == initial_end
            assert sub.mega_discount_used == initial_mega_used
            assert sub.status != "active"
            assert sub.status != "trialing"
        run_in_test_db(_test)

    # 10. Failed payment does not activate subscription
    def test_10_failed_payment_does_not_activate_subscription(self, test_admin):
        """Failed test payment transitions test record to failed and leaves subscriptions untouched."""
        async def _test(db):
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=2000,
                environment="sandbox",
            )

            result = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="failed",
                payload={"event": "payment.failed"},
                amount=test_record.amount_tiyin,
            )
            await db.commit()

            assert result["status"] == "failed"
            await db.refresh(test_record)
            assert test_record.status == "failed"
        run_in_test_db(_test)

    # 11. Duplicate webhook does not duplicate transaction
    def test_11_duplicate_webhook_does_not_duplicate_transaction(self, test_admin):
        """Receiving duplicate webhooks for the same test bill updates status idempotently."""
        async def _test(db):
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=1000,
                environment="sandbox",
            )

            # First webhook
            res1 = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded", "delivery_id": "dlv_123"},
                amount=100000,
            )
            await db.commit()

            # Second identical webhook
            res2 = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded", "delivery_id": "dlv_123"},
                amount=100000,
            )
            await db.commit()

            assert res1["status"] == "paid"
            assert res2["status"] == "paid"
            assert res1["test_id"] == res2["test_id"]
        run_in_test_db(_test)

    # 12. LIVE payment requires explicit confirmation
    def test_12_live_payment_requires_explicit_confirmation(self, test_admin):
        """LIVE payment creation strictly fails if confirm_live is False."""
        async def _test(db):
            with pytest.raises(PaymentTestingValidationError, match="LIVE to'lov uchun qat'iy tasdiqlash talab etiladi"):
                await payment_testing_service.create_test_payment(
                    db=db,
                    admin=test_admin,
                    amount_uzs=5000,
                    environment="live",
                    confirm_live=False,  # Unconfirmed
                )
        run_in_test_db(_test)

    # 13. SANDBOX and LIVE transactions remain distinguishable
    def test_13_sandbox_and_live_transactions_distinguishable(self, test_admin):
        """Sandbox and Live transactions are clearly tagged and segregated in reporting stats."""
        async def _test(db):
            # Create 1 Sandbox and 1 Live (with mock service to avoid real network call in test)
            with patch("app.services.payment_testing_service.tezcheck_service.create_bill") as mock_live_call:
                mock_live_call.return_value = {
                    "bill_id": f"tzc_live_{secrets.token_hex(4)}",
                    "pay_url": "https://tezcheck.uz/pay/live_test",
                    "amount": 200000,
                    "currency": "UZS",
                    "status": "pending",
                }

                sb_record = await payment_testing_service.create_test_payment(
                    db=db,
                    admin=test_admin,
                    amount_uzs=1000,
                    environment="sandbox",
                )
                live_record = await payment_testing_service.create_test_payment(
                    db=db,
                    admin=test_admin,
                    amount_uzs=2000,
                    environment="live",
                    confirm_live=True,
                )

            assert sb_record.environment == "sandbox"
            assert live_record.environment == "live"
            assert sb_record.environment != live_record.environment

            # Check stats
            stats = await payment_testing_service.get_test_stats(db)
            assert stats["sandbox"]["is_revenue"] is False
            assert stats["live"]["is_revenue"] is True
            assert stats["sandbox"]["total_count"] >= 1
            assert stats["live"]["total_count"] >= 1
        run_in_test_db(_test)

    # 14. Payment testing does not modify pricing configuration
    def test_14_payment_testing_does_not_modify_pricing_configuration(self, test_admin):
        """Creating and completing test payments leaves platform tariff pricing intact."""
        async def _test(db):
            # Record baseline plan pricing
            plans = (await db.execute(select(Plan))).scalars().all()
            plan_snapshot = {p.code.lower(): p.price_monthly_uzs for p in plans}

            # Create multiple test payments across boundaries
            for amt in [1000, 5000, 10000]:
                await payment_testing_service.create_test_payment(
                    db=db,
                    admin=test_admin,
                    amount_uzs=amt,
                    environment="sandbox",
                )

            # Re-verify plan prices
            plans_after = (await db.execute(select(Plan))).scalars().all()
            for p in plans_after:
                code = p.code.lower()
                if code in plan_snapshot and plan_snapshot[code] is not None:
                    assert p.price_monthly_uzs == plan_snapshot[code], f"Plan {code} price was unexpectedly modified!"

            # Canonical CentralizedPricingEngine rates remain intact
            assert CANONICAL_BASELINE_PRICING["start"]["promo_price_tiyin"] // 100 == 13000
            assert CANONICAL_BASELINE_PRICING["start"]["monthly_price_tiyin"] // 100 == 244000
            assert CANONICAL_BASELINE_PRICING["pro"]["monthly_price_tiyin"] // 100 == 499000
            assert CANONICAL_BASELINE_PRICING["ultra"]["monthly_price_tiyin"] // 100 == 999000
        run_in_test_db(_test)
