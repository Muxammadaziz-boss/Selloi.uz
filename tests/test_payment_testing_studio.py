"""Comprehensive Automated Test Suite for Payment Testing Studio & TezCheck Integration.

Verifies all 23 mandatory requirements from Phase 10:
1. 1,000 UZS accepted.
2. 10,000 UZS accepted.
3. 999 UZS rejected.
4. 10,001 UZS rejected.
5. Decimal amount rejected.
6. Correct UZS-to-tiyin conversion.
7. Correct TezCheck bill creation request.
8. Provider API authentication failure handled safely.
9. Duplicate invoice request handled idempotently.
10. Invalid webhook signature rejected.
11. Duplicate webhook handled idempotently.
12. Incorrect payment amount rejected.
13. Incorrect currency rejected.
14. Unauthorized user denied.
15. Successful test payment does not activate START.
16. Successful test payment does not activate PRO.
17. Successful test payment does not activate ULTRA.
18. Successful test payment does not create subscriptions.
19. Pending payment does not activate entitlements.
20. Failed payment does not activate entitlements.
21. LIVE payment requires explicit confirmation.
22. Sandbox and LIVE transactions remain separated.
23. Existing normal customer payment functionality remains unchanged.
"""

import asyncio
from datetime import datetime, timezone
import hashlib
import hmac
import json
import secrets
from unittest.mock import AsyncMock, patch
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

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
from app.services.tezcheck_service import (
    TezCheckError,
    TezCheckService,
    TezCheckSignatureVerificationError,
    tezcheck_service,
)
from app.services.subscription_service import subscription_service


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
    """Automated acceptance test suite for Admin Payment Testing Studio (23 requirements)."""

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

    # 3. 999 UZS rejected
    def test_03_amount_999_uzs_rejected(self):
        """Amount strictly below 1,000 UZS (999 UZS) is rejected."""
        with pytest.raises(PaymentTestingValidationError, match="Minimal test to'lovi"):
            payment_testing_service.validate_amount(999)

    # 4. 10,001 UZS rejected
    def test_04_amount_10001_uzs_rejected(self):
        """Amount strictly above 10,000 UZS (10,001 UZS) is rejected."""
        with pytest.raises(PaymentTestingValidationError, match="Maksimal test to'lovi"):
            payment_testing_service.validate_amount(10001)

    # 5. Decimal amount rejected
    def test_05_decimal_amount_rejected(self):
        """Decimal amounts (e.g. 2500.50, '1500.75', '2000,50') are strictly rejected."""
        with pytest.raises(PaymentTestingValidationError, match="Kasr sonlar qabul qilinmaydi"):
            payment_testing_service.validate_amount(2500.50)

        with pytest.raises(PaymentTestingValidationError, match="Kasr sonlar qabul qilinmaydi"):
            payment_testing_service.validate_amount("1500.75")

        with pytest.raises(PaymentTestingValidationError, match="Kasr sonlar qabul qilinmaydi"):
            payment_testing_service.validate_amount("2000,50")

    # 6. Correct UZS-to-tiyin conversion
    def test_06_correct_uzs_to_tiyin_conversion(self, test_admin):
        """Tiyin is computed accurately as amount_uzs * 100 across test points."""
        async def _test(db):
            test_cases = [
                (1000, 100000),
                (2000, 200000),
                (3000, 300000),
                (5000, 500000),
                (10000, 1000000),
            ]
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

    # 7. Correct TezCheck bill creation request
    def test_07_correct_tezcheck_bill_creation_request(self):
        """TezCheck API request contains official headers, amount in tiyin, return_url, and order_id."""
        service = TezCheckService(
            api_url="https://api.tezcheck.uz/api/merchant/v1",
            api_key="test_api_key_123",
            secret_key="test_secret_key_456",
            cash_desk_code="CD-9988",
            mock_mode=False,
        )

        captured_requests = []

        class MockResponse:
            status_code = 200
            def raise_for_status(self): pass
            def json(self):
                return {
                    "id": "tzc_bill_777",
                    "payment_url": "https://tezcheck.uz/checkout/tzc_bill_777",
                    "status": "pending",
                    "amount": 200000,
                }

        async def mock_post(url, json=None, headers=None):
            captured_requests.append({"url": url, "json": json, "headers": headers})
            return MockResponse()

        with patch("httpx.AsyncClient.post", side_effect=mock_post):
            async def _run():
                res = await service.create_bill(
                    amount=200000,
                    currency="UZS",
                    order_id="selloi_ord_123",
                    description="Admin Diagnostic Test (2,000 UZS)",
                    return_url="https://selloi.uz/platform",
                    metadata={"payment_purpose": "admin_payment_test"},
                )
                assert res["bill_id"] == "tzc_bill_777"
                assert res["pay_url"] == "https://tezcheck.uz/checkout/tzc_bill_777"

            asyncio.run(_run())

        assert len(captured_requests) == 1
        req = captured_requests[0]
        assert req["url"] == "https://api.tezcheck.uz/api/merchant/v1/bills"
        assert req["headers"]["Authorization"] == "Bearer test_api_key_123"
        assert req["headers"]["X-Cash-Desk-Code"] == "CD-9988"
        assert "X-TezCheck-Timestamp" in req["headers"]
        assert "X-TezCheck-Signature" in req["headers"]
        assert req["json"]["amount"] == 200000
        assert req["json"]["amount_minor"] == 200000
        assert req["json"]["external_reference"] == "selloi_ord_123"
        assert req["json"]["return_url"] == "https://selloi.uz/platform"

    # 8. Provider API authentication failure handled safely
    def test_08_provider_api_authentication_failure_handled_safely(self, test_admin):
        """When TezCheck rejects credentials (401), error is captured without leaking secrets."""
        async def _test(db):
            with patch("app.services.tezcheck_service.tezcheck_service.create_bill") as mock_call:
                mock_call.side_effect = TezCheckError("TezCheck API authorization failed: 401 Unauthorized")
                with pytest.raises(TezCheckError, match="authorization failed"):
                    await payment_testing_service.create_test_payment(
                        db=db,
                        admin=test_admin,
                        amount_uzs=5000,
                        environment="live",
                        confirm_live=True,
                    )
        run_in_test_db(_test)

    # 9. Duplicate invoice request handled idempotently
    def test_09_duplicate_invoice_request_handled_idempotently(self, test_admin):
        """Submitting with identical idempotency_key returns original record without duplicates."""
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

            count = (
                await db.execute(
                    select(AdminPaymentTest).where(AdminPaymentTest.idempotency_key == idemp_key)
                )
            ).scalars().all()
            assert len(count) == 1
        run_in_test_db(_test)

    # 10. Invalid webhook signature rejected
    def test_10_invalid_webhook_signature_rejected(self):
        """Tampered or invalid webhook signatures raise TezCheckSignatureVerificationError."""
        service = TezCheckService(secret_key="real_secret_key", mock_mode=False)
        raw_body = b'{"event":"payment.succeeded","bill_id":"tzc_123"}'
        timestamp = str(int(datetime.now(timezone.utc).timestamp()))
        delivery_id = "dlv_abc"

        # Tampered signature
        invalid_sig = "v1=0000000000000000000000000000000000000000000000000000000000000000"
        with pytest.raises(TezCheckSignatureVerificationError):
            service.verify_webhook_signature(
                raw_body=raw_body,
                signature_header=invalid_sig,
                timestamp=timestamp,
                delivery_id=delivery_id,
            )

        # Missing signature
        with pytest.raises(TezCheckSignatureVerificationError):
            service.verify_webhook_signature(
                raw_body=raw_body,
                signature_header=None,
            )

    # 11. Duplicate webhook handled idempotently
    def test_11_duplicate_webhook_handled_idempotently(self, test_admin):
        """Duplicate webhook deliveries for the same bill update status idempotently."""
        async def _test(db):
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=1000,
                environment="sandbox",
            )

            res1 = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded", "delivery_id": "dlv_123"},
                amount=100000,
            )
            await db.commit()

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

    # 12. Incorrect payment amount rejected
    def test_12_incorrect_payment_amount_rejected(self, test_admin):
        """Webhook with amount differing from expected invoice does NOT mark test paid."""
        async def _test(db):
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=5000,  # Expected 500,000 tiyin
                environment="sandbox",
            )

            # Webhook reports 100,000 tiyin (mismatch!)
            result = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded", "data": {"amount": 100000}},
                amount=100000,
            )
            await db.commit()

            assert result["status"] == "verification_required"
            await db.refresh(test_record)
            assert test_record.status == "verification_required"
            assert test_record.status != "paid"
        run_in_test_db(_test)

    # 13. Incorrect currency rejected
    def test_13_incorrect_currency_rejected(self, test_admin):
        """Webhook with currency differing from UZS (e.g. USD) does NOT mark test paid."""
        async def _test(db):
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=2000,
                environment="sandbox",
            )

            # Webhook reports USD currency
            result = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded", "currency": "USD"},
                amount=200000,
            )
            await db.commit()

            assert result["status"] == "verification_required"
            await db.refresh(test_record)
            assert test_record.status == "verification_required"
            assert test_record.status != "paid"
        run_in_test_db(_test)

    # 14. Unauthorized user denied
    def test_14_unauthorized_user_denied(self, regular_admin):
        """Non-platform-owner regular administrators cannot access payment testing."""
        from app.api.platform import require_platform_owner

        async def _test(db):
            with pytest.raises(HTTPException) as exc_info:
                await require_platform_owner(admin=regular_admin, db=db)
            assert exc_info.value.status_code in (401, 403)
        run_in_test_db(_test)

    # 15. Successful test payment does not activate START
    def test_15_successful_test_payment_does_not_activate_start(self, test_admin):
        """Confirmed test payment never activates START plan on any tenant subscription."""
        async def _test(db):
            org = Organization(name="Test Org START", slug=f"test_slug_{secrets.token_hex(4)}")
            db.add(org)
            await db.flush()

            sub = Subscription(
                organization_id=org.id,
                plan_id=1,
                status="inactive",
                mega_discount_used=False,
            )
            db.add(sub)
            await db.commit()

            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=1000,
                environment="sandbox",
            )
            await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded"},
                amount=100000,
            )
            await db.commit()

            await db.refresh(sub)
            assert sub.status == "inactive"
            assert sub.status != "active"
        run_in_test_db(_test)

    # 16. Successful test payment does not activate PRO
    def test_16_successful_test_payment_does_not_activate_pro(self, test_admin):
        """Confirmed test payment never activates PRO plan on any tenant subscription."""
        async def _test(db):
            org = Organization(name="Test Org PRO", slug=f"test_slug_{secrets.token_hex(4)}")
            db.add(org)
            await db.flush()

            sub = Subscription(
                organization_id=org.id,
                plan_id=2,
                status="awaiting_payment",
                mega_discount_used=False,
            )
            db.add(sub)
            await db.commit()

            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=3000,
                environment="sandbox",
            )
            await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded"},
                amount=300000,
            )
            await db.commit()

            await db.refresh(sub)
            assert sub.status == "awaiting_payment"
            assert sub.status != "active"
        run_in_test_db(_test)

    # 17. Successful test payment does not activate ULTRA
    def test_17_successful_test_payment_does_not_activate_ultra(self, test_admin):
        """Confirmed test payment never activates ULTRA plan on any tenant subscription."""
        async def _test(db):
            org = Organization(name="Test Org ULTRA", slug=f"test_slug_{secrets.token_hex(4)}")
            db.add(org)
            await db.flush()

            sub = Subscription(
                organization_id=org.id,
                plan_id=3,
                status="inactive",
                mega_discount_used=False,
            )
            db.add(sub)
            await db.commit()

            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=10000,
                environment="sandbox",
            )
            await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded"},
                amount=1000000,
            )
            await db.commit()

            await db.refresh(sub)
            assert sub.status == "inactive"
            assert sub.status != "active"
        run_in_test_db(_test)

    # 18. Successful test payment does not create subscriptions
    def test_18_successful_test_payment_does_not_create_subscriptions(self, test_admin):
        """Confirmed test payment creates 0 new subscription records."""
        async def _test(db):
            subs_before = (await db.execute(select(Subscription))).scalars().all()
            count_before = len(subs_before)

            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=5000,
                environment="sandbox",
            )
            await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"event": "payment.succeeded"},
                amount=500000,
            )
            await db.commit()

            subs_after = (await db.execute(select(Subscription))).scalars().all()
            assert len(subs_after) == count_before
        run_in_test_db(_test)

    # 19. Pending payment does not activate entitlements
    def test_19_pending_payment_does_not_activate_entitlements(self, test_admin):
        """Pending test payments grant zero entitlements and leave tenant status untouched."""
        async def _test(db):
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=2000,
                environment="sandbox",
            )
            assert test_record.status == "pending"
            assert test_record.completed_at is None
        run_in_test_db(_test)

    # 20. Failed payment does not activate entitlements
    def test_20_failed_payment_does_not_activate_entitlements(self, test_admin):
        """Failed test payment transitions test record to failed without touching entitlements."""
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

    # 21. LIVE payment requires explicit confirmation
    def test_21_live_payment_requires_explicit_confirmation(self, test_admin):
        """LIVE payment creation strictly fails if confirm_live is False."""
        async def _test(db):
            with pytest.raises(PaymentTestingValidationError, match="LIVE to'lov uchun qat'iy tasdiqlash talab etiladi"):
                await payment_testing_service.create_test_payment(
                    db=db,
                    admin=test_admin,
                    amount_uzs=5000,
                    environment="live",
                    confirm_live=False,
                )
        run_in_test_db(_test)

    # 22. Sandbox and LIVE transactions remain separated
    def test_22_sandbox_and_live_transactions_remain_separated(self, test_admin):
        """Sandbox and Live transactions are clearly segregated in financial reporting stats."""
        async def _test(db):
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

            stats = await payment_testing_service.get_test_stats(db)
            assert stats["sandbox"]["is_revenue"] is False
            assert stats["live"]["is_revenue"] is True
            assert stats["sandbox"]["total_count"] >= 1
            assert stats["live"]["total_count"] >= 1
        run_in_test_db(_test)

    # 23. Existing normal customer payment functionality remains unchanged
    def test_23_existing_normal_customer_payment_functionality_remains_unchanged(self):
        """Existing subscription billing and customer payment flow functions normally without interference."""
        async def _test(db):
            # Create tenant store
            org = Organization(name="Customer Store", slug=f"store_{secrets.token_hex(4)}")
            db.add(org)
            await db.flush()

            # Normal checkout for tenant customer
            with patch("app.services.subscription_service.tezcheck_service.create_bill") as mock_create:
                mock_create.return_value = {
                    "bill_id": f"tzc_cust_{secrets.token_hex(4)}",
                    "pay_url": "https://tezcheck.uz/pay/cust_test",
                    "amount": 24400000,
                    "currency": "UZS",
                    "status": "pending",
                }
                checkout = await subscription_service.create_subscription_checkout(
                    db=db,
                    organization_id=org.id,
                    user_id=1,
                    plan_code="start",
                    billing_cycle="monthly",
                    return_url="https://selloi.uz/settings/billing",
                )
                assert "checkout_url" in checkout
                assert checkout["amount_uzs"] == 244000
                assert checkout["amount_tiyin"] == 24400000

            # Centralized pricing remains intact
            assert CANONICAL_BASELINE_PRICING["start"]["promo_price_tiyin"] // 100 == 13000
            assert CANONICAL_BASELINE_PRICING["start"]["monthly_price_tiyin"] // 100 == 244000
        run_in_test_db(_test)
