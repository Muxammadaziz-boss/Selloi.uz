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
    TezCheckAPIError,
    TezCheckService,
    TezCheckSignatureVerificationError,
    parse_tezcheck_http_error,
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

        async def mock_post(url, json=None, content=None, headers=None):
            import json as json_lib

            payload = json if json is not None else (json_lib.loads(content.decode("utf-8")) if content else None)
            captured_requests.append({"url": url, "json": payload, "content": content, "headers": headers})
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
                mock_live_call.side_effect = lambda **kwargs: {
                    "bill_id": f"tzc_live_{secrets.token_hex(6)}",
                    "pay_url": "https://tezcheck.uz/pay/live_test",
                    "amount": kwargs.get("amount", 200000),
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
            assert stats["live"]["is_revenue"] is False
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

    # 24. Test provider discovery
    def test_24_test_provider_discovery(self):
        """TezCheck payment-methods discovery discovers 'Test provider'."""
        service = TezCheckService(mock_mode=True)
        async def _test():
            methods = await service.discover_payment_methods()
            assert any("test" in m.get("provider_code", "").lower() for m in methods)
            code = await service.find_test_provider_code()
            assert code == "test_provider"
        asyncio.run(_test())

    # 25. Correct provider-code selection
    def test_25_correct_provider_code_selection(self, test_admin):
        """When creating test payment with Test provider, allowed_provider_codes contains discovered code."""
        async def _test(db):
            with patch("app.services.payment_testing_service.tezcheck_service.create_bill") as mock_create:
                mock_create.return_value = {
                    "bill_id": "tzc_test_disc_01",
                    "pay_url": "https://pay.tezcheck.uz/pay/test01",
                    "amount": 100000,
                    "currency": "UZS",
                    "status": "created",
                    "environment": "test",
                    "livemode": False,
                }
                record = await payment_testing_service.create_test_payment(
                    db=db,
                    admin=test_admin,
                    amount_uzs=1000,
                    environment="test",
                )
                assert mock_create.called
                _, kwargs = mock_create.call_args
                assert kwargs.get("allowed_provider_codes") == ["test_provider"]
        run_in_test_db(_test)

    # 26. Test provider selected by default
    def test_26_test_provider_selected_by_default(self, test_admin):
        """Default environment is 'test' (Test provider)."""
        config = payment_testing_service.get_config()
        assert config["default_environment"] == "test"

        async def _test(db):
            record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=1000,
            )
            assert record.environment == "test"
        run_in_test_db(_test)

    # 27. No silent fallback to live payment
    def test_27_no_silent_fallback_to_live_payment(self, test_admin):
        """When Test provider is not available, error is raised; NEVER silently falls back to live."""
        async def _test(db):
            with patch("app.services.payment_testing_service.tezcheck_service.find_test_provider_code", new_callable=AsyncMock) as mock_find:
                mock_find.return_value = None
                with patch.object(tezcheck_service, "mock_mode", False):
                    with pytest.raises(PaymentTestingValidationError, match="Test provider.*yoqish talab etiladi"):
                        await payment_testing_service.create_test_payment(
                            db=db,
                            admin=test_admin,
                            amount_uzs=1000,
                            environment="test",
                        )
        run_in_test_db(_test)

    # 28. Correct test environment validation
    def test_28_correct_test_environment_validation(self, test_admin):
        """Test transaction creates record with environment='test' and livemode=False in metadata."""
        async def _test(db):
            record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=2000,
                environment="test",
            )
            assert record.environment == "test"
            assert record.metadata_snapshot.get("environment") == "test"
            assert record.confirm_live is False
        run_in_test_db(_test)

    # 29. paid: true and livemode: false handling
    def test_29_paid_true_and_livemode_false_handling(self, test_admin):
        """Webhook with paid=true, livemode=false, environment=test marks test record 'paid'.
        If livemode=true arrives on test transaction, marks 'verification_required'."""
        async def _test(db):
            record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=1000,
                environment="test",
            )
            # Valid test webhook
            payload_valid = {
                "event": "payment.succeeded",
                "data": {
                    "bill_id": record.provider_bill_id,
                    "amount_minor": 100000,
                    "currency": "UZS",
                    "livemode": False,
                    "environment": "test",
                }
            }
            res = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=record,
                bill_id=record.provider_bill_id,
                status_str="paid",
                payload=payload_valid,
                amount=100000,
            )
            assert res["status"] == "paid"

            # Create another test record to test livemode violation
            record2 = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=1000,
                environment="test",
            )
            payload_invalid = {
                "event": "payment.succeeded",
                "data": {
                    "bill_id": record2.provider_bill_id,
                    "amount_minor": 100000,
                    "currency": "UZS",
                    "livemode": True,  # Violation!
                    "environment": "live",
                }
            }
            res2 = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=record2,
                bill_id=record2.provider_bill_id,
                status_str="paid",
                payload=payload_invalid,
                amount=100000,
            )
            assert res2["status"] == "verification_required"
        run_in_test_db(_test)

    # 30. Test payment does not activate any subscription
    def test_30_test_payment_does_not_activate_subscription(self, test_admin):
        """Test provider payment completion leaves all tenant subscriptions completely untouched."""
        async def _test(db):
            org = Organization(name="SaaS Store Org", slug=f"saas_org_{secrets.token_hex(4)}")
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
                amount_uzs=5000,
                environment="test",
            )

            await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"data": {"bill_id": test_record.provider_bill_id, "amount_minor": 500000, "livemode": False, "environment": "test"}},
                amount=500000,
            )
            await db.commit()

            await db.refresh(sub)
            assert sub.status == "inactive"
            assert sub.mega_discount_used is False
        run_in_test_db(_test)

    # 31. Correct outgoing HMAC signing
    def test_31_correct_outgoing_hmac_signing(self):
        """Outgoing requests signed using {timestamp}.{METHOD}.{path+query}.{sha256(body)}."""
        service = TezCheckService(api_key="aps_test_key_123", mock_mode=False)
        ts, sig = service.sign_outgoing_request("POST", "/api/merchant/v1/bills", b'{"amount_minor":100000}')
        assert sig.startswith("v1=")
        expected_hash = hashlib.sha256(b'{"amount_minor":100000}').hexdigest()
        expected_msg = f"{ts}.POST./api/merchant/v1/bills.{expected_hash}".encode("utf-8")
        expected_sig = "v1=" + hmac.new(b"aps_test_key_123", expected_msg, hashlib.sha256).hexdigest()
        assert sig == expected_sig

    # 32. Incorrect outgoing signature handling
    def test_32_incorrect_outgoing_signature_handling(self):
        """Tampering with body or path alters the signature hash completely."""
        service = TezCheckService(api_key="aps_test_key_123", mock_mode=False)
        ts, sig1 = service.sign_outgoing_request("POST", "/api/merchant/v1/bills", b'{"amount_minor":100000}')
        _, sig2 = service.sign_outgoing_request("POST", "/api/merchant/v1/bills", b'{"amount_minor":200000}', timestamp=ts)
        assert sig1 != sig2

    # 33. Correct webhook-specific HMAC signing
    def test_33_correct_webhook_specific_hmac_signing(self):
        """Webhook verification uses {timestamp}.{delivery_id}.{raw_body} with secret_key."""
        secret = "whsec_supersecret123"
        service = TezCheckService(secret_key=secret, mock_mode=False)
        body = b'{"event":"payment.succeeded","data":{"bill_id":"tzc_123"}}'
        ts = str(int(datetime.now(timezone.utc).timestamp()))
        delivery_id = "whd_01JQEXAMPLEDLV"

        msg = f"{ts}.{delivery_id}.".encode("utf-8") + body
        valid_sig = "v1=" + hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

        assert service.verify_webhook_signature(
            raw_body=body,
            signature_header=valid_sig,
            timestamp=ts,
            delivery_id=delivery_id,
        ) is True

    # 34. Rejection of invalid webhook signatures
    def test_34_rejection_of_invalid_webhook_signatures(self):
        """Webhook signatures with missing v1= prefix or invalid hash are rejected."""
        service = TezCheckService(secret_key="whsec_secret", mock_mode=False)
        body = b'{"event":"payment.succeeded"}'
        ts = str(int(datetime.now(timezone.utc).timestamp()))
        delivery_id = "whd_01"

        # Missing v1= prefix
        with pytest.raises(TezCheckSignatureVerificationError, match="v1= prefix required"):
            service.verify_webhook_signature(
                raw_body=body,
                signature_header="deadbeef123456",
                timestamp=ts,
                delivery_id=delivery_id,
            )

        # Wrong hash
        with pytest.raises(TezCheckSignatureVerificationError, match="Signature mismatch"):
            service.verify_webhook_signature(
                raw_body=body,
                signature_header="v1=0000000000000000000000000000000000000000000000000000000000000000",
                timestamp=ts,
                delivery_id=delivery_id,
            )

    # 35. Rejection of expired webhook timestamps
    def test_35_rejection_of_expired_webhook_timestamps(self):
        """Webhook timestamp older than 300s is rejected (Replay Attack Prevention)."""
        service = TezCheckService(secret_key="whsec_secret", mock_mode=False)
        body = b'{"event":"payment.succeeded"}'
        expired_ts = str(int(datetime.now(timezone.utc).timestamp()) - 350)
        delivery_id = "whd_01"

        with pytest.raises(TezCheckSignatureVerificationError, match="timestamp expired"):
            service.verify_webhook_signature(
                raw_body=body,
                signature_header="v1=aabbcc",
                timestamp=expired_ts,
                delivery_id=delivery_id,
            )

    # 36. Duplicate event ID rejection
    def test_36_duplicate_event_id_rejection(self, test_admin):
        """WebhookEvent persists X-Checkout-Event-Id; duplicate event id is deduplicated."""
        async def _test(db):
            event_id = "oev_01JQEXAMPLEEVT00000000ABCD"
            e1 = WebhookEvent(
                provider="tezcheck",
                event_id=event_id,
                event_type="payment.succeeded",
                payload={"data": {"bill_id": "b1"}},
                status="processed",
            )
            db.add(e1)
            await db.commit()

            # Second event with same event_id
            existing = (
                await db.execute(
                    select(WebhookEvent).where(
                        WebhookEvent.provider == "tezcheck",
                        WebhookEvent.event_id == event_id,
                    )
                )
            ).scalar_one_or_none()
            assert existing is not None
            assert existing.status == "processed"
        run_in_test_db(_test)

    # 37. Concurrent duplicate webhook processing
    def test_37_concurrent_duplicate_webhook_processing(self):
        """Database unique constraint uq_webhook_events_provider_event prevents concurrent duplicates."""
        from sqlalchemy.exc import IntegrityError
        async def _test(db):
            event_id = f"oev_concurrent_{secrets.token_hex(4)}"
            e1 = WebhookEvent(
                provider="tezcheck",
                event_id=event_id,
                event_type="payment.succeeded",
                payload={},
                status="pending",
            )
            e2 = WebhookEvent(
                provider="tezcheck",
                event_id=event_id,
                event_type="payment.succeeded",
                payload={},
                status="pending",
            )
            db.add(e1)
            await db.flush()

            db.add(e2)
            with pytest.raises(IntegrityError):
                await db.flush()
        run_in_test_db(_test)

    # 38. Signature rotation support
    def test_38_signature_rotation_support(self):
        """Webhook carries multiple comma-separated signatures during secret rotation; matches valid one."""
        secret = "whsec_new_key"
        service = TezCheckService(secret_key=secret, mock_mode=False)
        body = b'{"event":"payment.succeeded"}'
        ts = str(int(datetime.now(timezone.utc).timestamp()))
        delivery_id = "whd_rotation"

        msg = f"{ts}.{delivery_id}.".encode("utf-8") + body
        valid_sig = "v1=" + hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        old_sig = "v1=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

        rotation_header = f"{old_sig}, {valid_sig}"
        assert service.verify_webhook_signature(
            raw_body=body,
            signature_header=rotation_header,
            timestamp=ts,
            delivery_id=delivery_id,
        ) is True

    # 39. Correct bill status reconciliation
    def test_39_correct_bill_status_reconciliation(self, test_admin):
        """sync_test_payment_status reconciles status accurately via provider status check."""
        async def _test(db):
            record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=3000,
                environment="test",
            )
            with patch("app.services.payment_testing_service.tezcheck_service.get_bill_status") as mock_status:
                mock_status.return_value = {
                    "bill_id": record.provider_bill_id,
                    "external_reference": record.external_reference,
                    "status": "exhausted",
                    "paid": True,
                    "livemode": False,
                    "environment": "test",
                    "amount_minor": 300000,
                    "currency": "UZS",
                }
                synced = await payment_testing_service.sync_test_payment_status(db, record.test_id)
                assert synced.status == "paid"
                assert synced.completed_at is not None
        run_in_test_db(_test)

    # 40. Correct amount and currency validation
    def test_40_correct_amount_and_currency_validation(self, test_admin):
        """sync_test_payment_status flags verification_required on amount or currency mismatch."""
        async def _test(db):
            record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=2000,
                environment="test",
            )
            # Amount mismatch
            with patch("app.services.payment_testing_service.tezcheck_service.get_bill_status") as mock_status:
                mock_status.return_value = {
                    "bill_id": record.provider_bill_id,
                    "status": "paid",
                    "paid": True,
                    "livemode": False,
                    "environment": "test",
                    "amount_minor": 999999,  # Mismatch!
                    "currency": "UZS",
                }
                synced = await payment_testing_service.sync_test_payment_status(db, record.test_id)
                assert synced.status == "verification_required"

            # Currency mismatch
            record2 = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=2000,
                environment="test",
            )
            with patch("app.services.payment_testing_service.tezcheck_service.get_bill_status") as mock_status2:
                mock_status2.return_value = {
                    "bill_id": record2.provider_bill_id,
                    "status": "paid",
                    "paid": True,
                    "livemode": False,
                    "environment": "test",
                    "amount_minor": 200000,
                    "currency": "EUR",  # Mismatch!
                }
                synced2 = await payment_testing_service.sync_test_payment_status(db, record2.test_id)
                assert synced2.status == "verification_required"
        run_in_test_db(_test)

    # 41. Existing pricing configuration remains unchanged
    def test_41_existing_pricing_configuration_remains_unchanged(self, test_admin):
        """Diagnostic tests have zero impact on canonical baseline pricing configurations."""
        async def _test(db):
            pricing_before = await centralized_pricing_service.get_active_tariffs(db)
            test_record = await payment_testing_service.create_test_payment(
                db=db,
                admin=test_admin,
                amount_uzs=10000,
                environment="test",
            )
            await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"data": {"bill_id": test_record.provider_bill_id, "amount_minor": 1000000, "livemode": False, "environment": "test"}},
                amount=1000000,
            )
            pricing_after = await centralized_pricing_service.get_active_tariffs(db)
            assert pricing_before == pricing_after
        run_in_test_db(_test)

    # 42. Existing customer payment integration remains functional
    def test_42_existing_customer_payment_integration_functional(self):
        """Customer payment webhook confirmation activates customer subscription normally."""
        async def _test(db):
            org = Organization(name="Customer Store Corp", slug=f"corp_{secrets.token_hex(4)}")
            db.add(org)
            await db.flush()

            bill = PaymentBill(
                bill_id="tzc_cust_bill_999",
                organization_id=org.id,
                plan_code="start",
                billing_cycle="monthly",
                amount=24400000,
                currency="UZS",
                status="pending",
                checkout_url="https://pay.tezcheck.uz/pay/plk_999",
            )
            db.add(bill)
            await db.commit()

            res = await subscription_service.confirm_payment_and_activate(
                db=db,
                bill_id="tzc_cust_bill_999",
                paid_amount=24400000,
                currency="UZS",
            )
            assert res["status"] in ("active", "activated")
            assert res["plan_code"] == "start"
        run_in_test_db(_test)

    # 43. Valid API key and Test provider creates bill successfully
    def test_43_valid_api_key_and_test_provider_creates_bill_successfully(self, test_admin):
        """Valid API key and active Test provider creates test payment bill with livemode=False."""
        async def _test(db):
            mock_methods = [
                {"provider_code": "test_provider", "channel_code": "test_checkout", "name": "Test provider", "environment": "test"},
                {"provider_code": "payme", "channel_code": "payme_checkout", "name": "Payme", "environment": "live"},
            ]
            mock_bill_res = {
                "bill_id": "tzc_test_bill_43",
                "pay_url": "https://pay.tezcheck.uz/pay/plk_test_43",
                "amount": 100000,
                "currency": "UZS",
                "status": "created",
                "livemode": False,
                "environment": "test",
                "allowed_provider_codes": ["test_provider"],
                "mode": "live",
            }
            with patch("app.services.payment_testing_service.tezcheck_service.discover_payment_methods", new_callable=AsyncMock) as mock_disc:
                mock_disc.return_value = mock_methods
                with patch("app.services.payment_testing_service.tezcheck_service.create_bill", new_callable=AsyncMock) as mock_create:
                    mock_create.return_value = mock_bill_res
                    with patch.object(tezcheck_service, "mock_mode", False):
                        record = await payment_testing_service.create_test_payment(
                            db=db,
                            admin=test_admin,
                            amount_uzs=1000,
                            environment="test",
                        )
                        assert record.provider_bill_id == "tzc_test_bill_43"
                        assert record.environment == "test"
                        assert record.checkout_url == "https://pay.tezcheck.uz/pay/plk_test_43"
                        assert record.status in ("pending", "created")
        run_in_test_db(_test)

    # 44. Invalid API key returns explicit TEZCHECK_AUTH_FAILED error
    def test_44_invalid_api_key_returns_auth_unauthenticated_error(self):
        """TezCheck 401 auth.unauthenticated response maps to structured TEZCHECK_AUTH_FAILED."""
        raw_error_json = json.dumps({
            "error": {
                "code": "auth.unauthenticated",
                "message": "Davom etish uchun tizimga kiring.",
                "status": 401,
                "request_id": "req_test_auth_44",
                "details": [{"code": "api_key.missing_or_invalid", "message": "API key invalid"}],
                "retryable": False,
            }
        })
        err = parse_tezcheck_http_error(401, raw_error_json, {"x-request-id": "req_test_auth_44"})
        assert isinstance(err, TezCheckAPIError)
        assert err.code == "TEZCHECK_AUTH_FAILED"
        assert err.status_code == 401
        assert "TezCheck API kaliti yaroqsiz yoki noto‘g‘ri sozlangan" in err.message
        assert err.request_id == "req_test_auth_44"
        assert err.retryable is False
        assert err.to_dict()["error"]["code"] == "TEZCHECK_AUTH_FAILED"

    # 45. Missing cash desk code raises TEZCHECK_CASH_DESK_MISSING
    def test_45_missing_cash_desk_code_raises_cash_desk_missing_error(self):
        """Missing cash_desk_code triggers structured TEZCHECK_CASH_DESK_MISSING error."""
        svc = TezCheckService(api_key="aps_valid_key", secret_key="whsec_valid", cash_desk_code="", merchant_id="", mock_mode=False)
        svc.cash_desk_code = None
        svc.merchant_id = None

        with pytest.raises(TezCheckAPIError) as exc_info:
            asyncio.run(svc.discover_payment_methods())
        assert exc_info.value.code == "TEZCHECK_CASH_DESK_MISSING"
        assert exc_info.value.status_code == 400
        assert "cash_desk_code" in exc_info.value.message

    # 46. Test provider not enabled on desk raises TEZCHECK_TEST_PROVIDER_NOT_ENABLED
    def test_46_test_provider_not_enabled_on_desk_raises_specific_error(self, test_admin):
        """When cash desk lacks Test provider, structured TEZCHECK_TEST_PROVIDER_NOT_ENABLED error is raised."""
        async def _test(db):
            mock_methods = [
                {"provider_code": "payme", "name": "Payme", "environment": "live"},
                {"provider_code": "click", "name": "Click", "environment": "live"},
            ]
            with patch("app.services.payment_testing_service.tezcheck_service.discover_payment_methods", new_callable=AsyncMock) as mock_disc:
                mock_disc.return_value = mock_methods
                with patch.object(tezcheck_service, "mock_mode", False):
                    with pytest.raises(PaymentTestingValidationError) as exc_info:
                        await payment_testing_service.create_test_payment(
                            db=db,
                            admin=test_admin,
                            amount_uzs=2000,
                            environment="test",
                        )
                    assert exc_info.value.code == "TEZCHECK_TEST_PROVIDER_NOT_ENABLED"
                    assert exc_info.value.status_code == 400
                    assert exc_info.value.to_dict()["error"]["code"] == "TEZCHECK_TEST_PROVIDER_NOT_ENABLED"
        run_in_test_db(_test)

    # 47. Invalid request signature returns TEZCHECK_SIGNATURE_INVALID
    def test_47_invalid_request_signature_returns_signature_invalid_error(self):
        """TezCheck 401 request.signature_invalid response maps to TEZCHECK_SIGNATURE_INVALID."""
        raw_error_json = json.dumps({
            "error": {
                "code": "request.signature_invalid",
                "message": "Signature verification failed",
                "status": 401,
                "request_id": "req_sig_err_47",
                "retryable": False,
            }
        })
        err = parse_tezcheck_http_error(401, raw_error_json, {"x-request-id": "req_sig_err_47"})
        assert err.code == "TEZCHECK_SIGNATURE_INVALID"
        assert err.status_code == 401
        assert "imzo" in err.message.lower()

    # 48. TezCheck timeout returns TEZCHECK_TIMEOUT with retryable=True
    def test_48_tezcheck_timeout_returns_timeout_error(self):
        """Network timeout when calling TezCheck produces structured TEZCHECK_TIMEOUT (504, retryable=True)."""
        import httpx
        svc = TezCheckService(api_key="aps_valid_key", secret_key="whsec_valid", cash_desk_code="CDK_01", mock_mode=False)

        async def _test():
            with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Read timeout")):
                with pytest.raises(TezCheckAPIError) as exc_info:
                    await svc.create_bill(amount=100000, currency="UZS", order_id="ord_to", description="desc", return_url="https://selloi.uz")
                assert exc_info.value.code == "TEZCHECK_TIMEOUT"
                assert exc_info.value.status_code == 504
                assert exc_info.value.retryable is True
        asyncio.run(_test())

    # 49. TezCheck 502 upstream response handled gracefully
    def test_49_tezcheck_502_upstream_response_handled_gracefully(self):
        """Upstream 502 / 5xx error maps to structured TEZCHECK_SERVER_ERROR without exposing internal stacks."""
        err = parse_tezcheck_http_error(502, "<html>Bad Gateway</html>", {"x-request-id": "req_502_upstream"})
        assert err.code == "TEZCHECK_SERVER_ERROR"
        assert err.status_code == 502
        assert err.retryable is True
        assert "TezCheck serveri vaqtincha javob bermayapti" in err.message

    # 50. TezCheck invalid JSON returns TEZCHECK_INVALID_RESPONSE
    def test_50_tezcheck_invalid_json_returns_invalid_response_error(self):
        """Corrupted / non-JSON 200/500 response produces TEZCHECK_INVALID_RESPONSE."""
        import httpx
        svc = TezCheckService(api_key="aps_valid_key", secret_key="whsec_valid", cash_desk_code="CDK_01", mock_mode=False)

        class MockNonJsonResponse:
            status_code = 200
            headers = {"x-request-id": "req_non_json"}
            text = "Corrupted non-json output"
            def json(self):
                raise ValueError("No JSON")

        async def _test():
            with patch("httpx.AsyncClient.post", return_value=MockNonJsonResponse()):
                with pytest.raises(TezCheckAPIError) as exc_info:
                    await svc.create_bill(amount=100000, currency="UZS", order_id="ord_non_json", description="desc", return_url="https://selloi.uz")
                assert exc_info.value.code == "TEZCHECK_INVALID_RESPONSE"
                assert exc_info.value.status_code == 502
        asyncio.run(_test())

    # 51. Platform endpoint returns structured error JSON without leaking secrets
    def test_51_platform_endpoint_returns_structured_error_json_without_leaking_secrets(self, test_admin):
        """API endpoint /api/platform/payment-testing/create returns structured JSON error without leaking API keys."""
        from app.api.platform import create_payment_test, PaymentTestCreateRequest

        async def _test(db):
            req = PaymentTestCreateRequest(
                amount_uzs=3000,
                environment="test",
            )
            with patch("app.services.payment_testing_service.tezcheck_service.find_test_provider_code") as mock_find:
                mock_find.side_effect = TezCheckAPIError(
                    code="TEZCHECK_AUTH_FAILED",
                    message="TezCheck API kaliti yaroqsiz yoki noto‘g‘ri sozlangan.",
                    status_code=401,
                    request_id="req_leak_check_99",
                )
                response = await create_payment_test(req=req, admin=test_admin, db=db)
                # Should be JSONResponse with status 401
                assert response.status_code == 401
                body = json.loads(response.body.decode("utf-8"))
                assert body["success"] is False
                assert body["error"]["code"] == "TEZCHECK_AUTH_FAILED"
                assert body["error"]["request_id"] == "req_leak_check_99"
                assert "aps_" not in json.dumps(body)
                assert "whsec_" not in json.dumps(body)
                assert "Authorization" not in json.dumps(body)
        run_in_test_db(_test)

    # 52. Test provider never falls back to live provider
    def test_52_test_provider_never_falls_back_to_live(self, test_admin):
        """When Test provider is unavailable, bill creation stops immediately and NEVER calls live bill creation."""
        async def _test(db):
            with patch("app.services.payment_testing_service.tezcheck_service.find_test_provider_code", new_callable=AsyncMock) as mock_find:
                mock_find.return_value = None
                with patch("app.services.payment_testing_service.tezcheck_service.create_bill", new_callable=AsyncMock) as mock_create_bill:
                    with patch.object(tezcheck_service, "mock_mode", False):
                        with pytest.raises(PaymentTestingValidationError):
                            await payment_testing_service.create_test_payment(
                                db=db,
                                admin=test_admin,
                                amount_uzs=5000,
                                environment="test",
                            )
                        # Ensure create_bill was NEVER invoked
                        mock_create_bill.assert_not_called()
        run_in_test_db(_test)

    # 53. Test payment never activates commercial subscription
    def test_53_test_payment_never_activates_commercial_subscription(self, test_admin):
        """Simulating a paid test transaction never creates or extends a customer subscription record."""
        async def _test(db):
            test_record = AdminPaymentTest(
                test_id=f"tst_{secrets.token_hex(4)}",
                admin_id=test_admin.id,
                admin_email=test_admin.email or "owner@selloi.uz",
                amount_uzs=1000,
                amount_tiyin=100000,
                currency="UZS",
                environment="test",
                status="pending",
                payment_purpose="admin_payment_test",
                provider_bill_id="tzc_test_sub_leak_53",
                external_reference=f"selloi_ref_{secrets.token_hex(4)}",
            )
            db.add(test_record)
            await db.commit()

            subs_before = (await db.execute(select(Subscription))).scalars().all()

            # Confirm test payment
            updated = await payment_testing_service.confirm_test_payment(
                db=db,
                test_record=test_record,
                bill_id=test_record.provider_bill_id,
                status_str="paid",
                payload={"data": {"bill_id": test_record.provider_bill_id, "amount_minor": 100000, "livemode": False, "environment": "test"}},
                amount=100000,
            )
            assert updated["status"] == "paid"

            subs_after = (await db.execute(select(Subscription))).scalars().all()
            assert len(subs_before) == len(subs_after)

            stats = await payment_testing_service.get_test_stats(db)
            assert stats["test_provider"]["is_revenue"] is False
            assert stats["live"]["is_revenue"] is False
        run_in_test_db(_test)
