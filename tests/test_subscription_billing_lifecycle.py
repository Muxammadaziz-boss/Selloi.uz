"""Comprehensive Automated Test Suite for Selloi Subscription & Mega Discount Billing Lifecycle.

Validates the full specification:
1. First-time mega discount promotional pricing ($1 START, $2 PRO, $3 ULTRA) for 7 days.
2. Eligibility enforcement and duplicate purchase prevention.
3. Strict rejection of weekly subscriptions and absence of automatic free trials.
4. Regular monthly (one calendar month) and yearly (twelve calendar months) subscription cycles.
5. Full 10-state subscription lifecycle state machine.
6. Non-destructive feature suspension on expiration with exact notification message.
7. Preservation of tenant/user data while commercial features are suspended.
8. Explicit, non-prechecked user renewal consent recording and disclosures.
9. TezCheck single-use bill creation, cryptographic HMAC-SHA256 webhook verification, and idempotency.
10. Immutable audit logging for billing activations and consent records.
11. Complete Phase 10 verification suite (TEST 01 through TEST 12).
"""

import hmac
import hashlib
import json
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException

from app.models import (
    Admin,
    Organization,
    OrganizationMember,
    Plan,
    Subscription,
    SubscriptionConsent,
    PaymentBill,
    AuditLog,
    User,
)
from app.services.subscription_service import (
    subscription_service,
    SubscriptionService,
    MEGA_DISCOUNT_RATES,
    MEGA_DISCOUNT_EXPIRED_NOTIFICATION,
    MEGA_DISCOUNT_EXPIRED_TITLE,
    MEGA_DISCOUNT_EXPIRED_CTA,
    VALID_SUBSCRIPTION_STATES,
    IneligibleForMegaDiscountError,
    SubscriptionError,
    add_calendar_months,
    add_calendar_years,
)
from app.services.tezcheck_service import (
    tezcheck_service,
    TezCheckService,
    TezCheckSignatureVerificationError,
)
from app.services.entitlement_service import (
    has_feature,
    require_feature,
    FeatureNotAvailableException,
)
from app.dependencies.tenant import get_admin_tenant_id


# ============================================================================
# 1. MEGA DISCOUNT PROMOTIONAL RATES & DURATION SPECIFICATION
# ============================================================================

class TestMegaDiscountPromotionalPricing:
    """Verify introductory promotional pricing, USD equivalent, and 7-day duration."""

    def test_mega_discount_rate_mapping(self):
        """Verify START ($1), STANDART ($1.5), PRO ($2), and ULTRA ($3) rates in UZS and tiyin."""
        assert "start" in MEGA_DISCOUNT_RATES
        assert "standard" in MEGA_DISCOUNT_RATES
        assert "pro" in MEGA_DISCOUNT_RATES
        assert "ultra" in MEGA_DISCOUNT_RATES

        # START plan: $1 equivalent -> 13,000 UZS (1,300,000 tiyin) for 7 days
        start = MEGA_DISCOUNT_RATES["start"]
        assert start["usd_equivalent"] == 1
        assert start["amount_uzs"] == 13000
        assert start["amount_tiyin"] == 1300000
        assert start["duration_days"] == 7

        # STANDART plan: $1.5 equivalent -> 20,000 UZS (2,000,000 tiyin) for 7 days
        standard = MEGA_DISCOUNT_RATES["standard"]
        assert standard["usd_equivalent"] == 1.5
        assert standard["amount_uzs"] == 20000
        assert standard["amount_tiyin"] == 2000000
        assert standard["duration_days"] == 7

        # PRO plan: $2 equivalent -> 26,000 UZS (2,600,000 tiyin) for 7 days
        pro = MEGA_DISCOUNT_RATES["pro"]
        assert pro["usd_equivalent"] == 2
        assert pro["amount_uzs"] == 26000
        assert pro["amount_tiyin"] == 2600000
        assert pro["duration_days"] == 7

        # ULTRA plan: $3 equivalent -> 39,000 UZS (3,900,000 tiyin) for 7 days
        ultra = MEGA_DISCOUNT_RATES["ultra"]
        assert ultra["usd_equivalent"] == 3
        assert ultra["amount_uzs"] == 39000
        assert ultra["amount_tiyin"] == 3900000
        assert ultra["duration_days"] == 7

    def test_expiration_timestamp_calculation(self):
        """Verify expiration is calculated strictly as paid_at + exactly 7 days."""
        base_paid_at = datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc)
        expected_expiration = datetime(2026, 11, 27, 12, 0, 0, tzinfo=timezone.utc)

        computed = SubscriptionService.calculate_mega_discount_expiration(base_paid_at)
        assert computed == expected_expiration
        assert (computed - base_paid_at).total_seconds() == 7 * 86400


# ============================================================================
# 2. ELIGIBILITY ENFORCEMENT & DUPLICATE PREVENTION
# ============================================================================

class TestMegaDiscountEligibility:
    """Verify first-time eligibility rules and strict blocking of repeat promotional purchases."""

    @pytest.mark.anyio
    async def test_new_organization_is_eligible(self):
        """Fresh organization with mega_discount_used=False is eligible."""
        sub = Subscription(
            id=1,
            organization_id=101,
            plan_id=1,
            status="awaiting_subscription_selection",
            mega_discount_used=False
        )
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sub

        # No paid bills exist
        bill_result = MagicMock()
        bill_result.scalar_one_or_none.return_value = None

        mock_db.execute.side_effect = [mock_result, bill_result]

        eligible, reason = await subscription_service.check_mega_discount_eligibility(mock_db, 101)
        assert eligible is True
        assert "mavjud" in reason.lower()

    @pytest.mark.anyio
    async def test_ineligible_when_flag_already_used(self):
        """Organization with mega_discount_used=True is rejected."""
        sub = Subscription(
            id=2,
            organization_id=102,
            plan_id=1,
            status="mega_discount_expired",
            mega_discount_used=True
        )
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sub
        mock_db.execute.return_value = mock_result

        eligible, reason = await subscription_service.check_mega_discount_eligibility(mock_db, 102)
        assert eligible is False
        assert "avval" in reason.lower()

    @pytest.mark.anyio
    async def test_ineligible_checkout_raises_exception(self):
        """Attempting to create checkout for an ineligible tenant raises IneligibleForMegaDiscountError."""
        sub = Subscription(
            id=3,
            organization_id=103,
            plan_id=1,
            status="subscription_active",
            mega_discount_used=True
        )
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sub
        mock_db.execute.return_value = mock_result

        with pytest.raises(IneligibleForMegaDiscountError):
            await subscription_service.create_mega_discount_checkout(
                db=mock_db,
                organization_id=103,
                user_id=1,
                plan_code="pro",
                return_url="/settings/billing"
            )


# ============================================================================
# 3. REGULAR SUBSCRIPTION CYCLES & STRICT REJECTION OF WEEKLY
# ============================================================================

class TestRegularSubscriptionCyclesAndRejectionOfWeekly:
    """Verify monthly (calendar month), yearly (12 calendar months), and rejection of weekly."""

    def test_calendar_month_calculations(self):
        """Verify calendar month addition handling day overflow and leap years."""
        # Normal mid-month: Jan 15 -> Feb 15
        dt1 = datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        assert add_calendar_months(dt1, 1) == datetime(2026, 2, 15, 10, 0, 0, tzinfo=timezone.utc)

        # Non-leap year end of month: Jan 31, 2025 -> Feb 28, 2025
        dt2 = datetime(2025, 1, 31, 10, 0, 0, tzinfo=timezone.utc)
        assert add_calendar_months(dt2, 1) == datetime(2025, 2, 28, 10, 0, 0, tzinfo=timezone.utc)

        # Leap year end of month: Jan 31, 2024 -> Feb 29, 2024
        dt3 = datetime(2024, 1, 31, 10, 0, 0, tzinfo=timezone.utc)
        assert add_calendar_months(dt3, 1) == datetime(2024, 2, 29, 10, 0, 0, tzinfo=timezone.utc)

        # 31-day month to 30-day month: March 31 -> April 30
        dt4 = datetime(2026, 3, 31, 10, 0, 0, tzinfo=timezone.utc)
        assert add_calendar_months(dt4, 1) == datetime(2026, 4, 30, 10, 0, 0, tzinfo=timezone.utc)

    def test_calendar_year_calculations(self):
        """Verify 12 calendar months / yearly addition handling leap years."""
        # Standard: Nov 20, 2026 -> Nov 20, 2027
        dt1 = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)
        assert add_calendar_years(dt1, 1) == datetime(2027, 11, 20, 10, 0, 0, tzinfo=timezone.utc)

        # Leap year Feb 29 to next year Feb 28
        dt2 = datetime(2024, 2, 29, 10, 0, 0, tzinfo=timezone.utc)
        assert add_calendar_years(dt2, 1) == datetime(2025, 2, 28, 10, 0, 0, tzinfo=timezone.utc)

    @pytest.mark.anyio
    async def test_weekly_subscription_is_strictly_rejected(self):
        """Attempting to create checkout with cycle 'weekly' raises SubscriptionError."""
        mock_db = AsyncMock()
        with pytest.raises(SubscriptionError) as exc_info:
            await subscription_service.create_subscription_checkout(
                db=mock_db,
                organization_id=201,
                user_id=1,
                plan_code="pro",
                billing_cycle="weekly",
                return_url="/settings/billing"
            )
        assert "haftalik obuna mavjud emas" in str(exc_info.value).lower()

    @pytest.mark.anyio
    async def test_monthly_checkout_creation(self):
        """Valid monthly subscription checkout issues single-use bill with calendar month target."""
        plan = Plan(
            id=2,
            code="pro",
            name="PRO",
            price_monthly=59,
            price_yearly=590,
            price_monthly_uzs=76700000,
            price_yearly_uzs=767000000,
            currency="USD",
            is_active=True,
        )
        sub = Subscription(id=5, organization_id=202, plan_id=2, status="awaiting_subscription_selection")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_plan_res = MagicMock()
        mock_plan_res.scalar_one_or_none.return_value = plan
        mock_sub_res = MagicMock()
        mock_sub_res.scalar_one_or_none.return_value = sub

        mock_db.execute.side_effect = [mock_plan_res, mock_sub_res]

        checkout = await subscription_service.create_subscription_checkout(
            db=mock_db,
            organization_id=202,
            user_id=1,
            plan_code="pro",
            billing_cycle="monthly",
            return_url="/settings/billing"
        )
        assert checkout["billing_cycle"] == "monthly"
        assert checkout["plan_code"] == "pro"
        assert checkout["amount_tiyin"] == 76700000
        assert checkout["amount_uzs"] == 767000
        assert "bill_id" in checkout
        assert "checkout_url" in checkout
        assert sub.status == "awaiting_monthly_payment"

    @pytest.mark.anyio
    async def test_yearly_checkout_creation(self):
        """Valid yearly subscription checkout sets status to awaiting_yearly_payment."""
        plan = Plan(
            id=3,
            code="ultra",
            name="ULTRA",
            price_monthly=149,
            price_yearly=1490,
            price_monthly_uzs=193700000,
            price_yearly_uzs=1937000000,
            currency="USD",
            is_active=True,
        )
        sub = Subscription(id=6, organization_id=203, plan_id=3, status="awaiting_subscription_selection")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_plan_res = MagicMock()
        mock_plan_res.scalar_one_or_none.return_value = plan
        mock_sub_res = MagicMock()
        mock_sub_res.scalar_one_or_none.return_value = sub

        mock_db.execute.side_effect = [mock_plan_res, mock_sub_res]

        checkout = await subscription_service.create_subscription_checkout(
            db=mock_db,
            organization_id=203,
            user_id=1,
            plan_code="ultra",
            billing_cycle="yearly",
            return_url="/settings/billing"
        )
        assert checkout["billing_cycle"] == "yearly"
        assert checkout["amount_tiyin"] == 1937000000
        assert sub.status == "awaiting_yearly_payment"


# ============================================================================
# 4. TEN-STATE SUBSCRIPTION LIFECYCLE STATE MACHINE
# ============================================================================

class TestTenStateLifecycleStateMachine:
    """Validate all 10 states and authoritative state transitions."""

    def test_ten_states_specification(self):
        """Ensure exactly the 10 defined lifecycle states are supported."""
        expected_states = {
            "mega_discount_active",
            "mega_discount_expired",
            "awaiting_subscription_selection",
            "awaiting_monthly_payment",
            "awaiting_yearly_payment",
            "subscription_active",
            "renewal_due",
            "renewal_pending",
            "subscription_expired",
            "cancelled",
        }
        assert VALID_SUBSCRIPTION_STATES == expected_states

    @pytest.mark.anyio
    async def test_transition_mega_discount_active_to_expired(self):
        """When current_time >= current_period_end, status transitions to mega_discount_expired."""
        past_end = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)
        sub = Subscription(
            id=10,
            organization_id=301,
            plan_id=1,
            status="mega_discount_active",
            current_period_start=past_end - timedelta(days=7),
            current_period_end=past_end,
            mega_discount_used=True
        )

        mock_db = AsyncMock()
        mock_sub_res = MagicMock()
        mock_sub_res.scalar_one_or_none.return_value = sub
        mock_db.execute.return_value = mock_sub_res

        eval_time = past_end + timedelta(minutes=5)
        synced_sub = await subscription_service.evaluate_and_sync_subscription_state(
            mock_db, organization_id=301, current_time=eval_time
        )
        assert synced_sub.status == "mega_discount_expired"
        mock_db.commit.assert_awaited()

    @pytest.mark.anyio
    async def test_transition_active_to_renewal_due(self):
        """When regular subscription reaches end of period, transitions to renewal_due."""
        past_end = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)
        sub = Subscription(
            id=11,
            organization_id=302,
            plan_id=2,
            status="subscription_active",
            current_period_start=past_end - timedelta(days=30),
            current_period_end=past_end
        )

        mock_db = AsyncMock()
        mock_sub_res = MagicMock()
        mock_sub_res.scalar_one_or_none.return_value = sub
        mock_db.execute.return_value = mock_sub_res

        eval_time = past_end + timedelta(seconds=1)
        synced_sub = await subscription_service.evaluate_and_sync_subscription_state(
            mock_db, organization_id=302, current_time=eval_time
        )
        assert synced_sub.status == "renewal_due"

    @pytest.mark.anyio
    async def test_transition_renewal_due_to_subscription_expired_after_grace(self):
        """After 3-day grace period, renewal_due transitions to subscription_expired."""
        period_end = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)
        sub = Subscription(
            id=12,
            organization_id=303,
            plan_id=2,
            status="renewal_due",
            current_period_start=period_end - timedelta(days=30),
            current_period_end=period_end
        )

        mock_db = AsyncMock()
        mock_sub_res = MagicMock()
        mock_sub_res.scalar_one_or_none.return_value = sub
        mock_db.execute.return_value = mock_sub_res

        eval_time = period_end + timedelta(days=4)
        synced_sub = await subscription_service.evaluate_and_sync_subscription_state(
            mock_db, organization_id=303, current_time=eval_time
        )
        assert synced_sub.status == "subscription_expired"

    @pytest.mark.anyio
    async def test_transition_cancelled_to_subscription_expired_at_period_end(self):
        """Cancelled subscription reaches current_period_end and becomes subscription_expired."""
        period_end = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)
        sub = Subscription(
            id=13,
            organization_id=304,
            plan_id=2,
            status="cancelled",
            current_period_start=period_end - timedelta(days=30),
            current_period_end=period_end
        )

        mock_db = AsyncMock()
        mock_sub_res = MagicMock()
        mock_sub_res.scalar_one_or_none.return_value = sub
        mock_db.execute.return_value = mock_sub_res

        eval_time = period_end + timedelta(seconds=10)
        synced_sub = await subscription_service.evaluate_and_sync_subscription_state(
            mock_db, organization_id=304, current_time=eval_time
        )
        assert synced_sub.status == "subscription_expired"


# ============================================================================
# 5. NON-DESTRUCTIVE FEATURE SUSPENSION & PRESERVATION OF DATA
# ============================================================================

class TestNonDestructiveFeatureSuspension:
    """Verify commercial access is suspended upon expiration while data remains intact."""

    @pytest.mark.anyio
    async def test_active_promo_allows_commercial_features(self):
        """During active 7-day mega discount, commercial access is enabled."""
        org = Organization(id=401, name="Active Promo Store")
        plan = Plan(id=2, code="pro", name="PRO", features={"advanced_rag": True, "ai_auto_reply": True})
        sub = Subscription(
            id=20,
            organization_id=401,
            plan_id=2,
            status="mega_discount_active",
            mega_discount_used=True,
            current_period_end=datetime.now(timezone.utc) + timedelta(days=5)
        )

        mock_db = AsyncMock()
        with patch("app.services.entitlement_service.get_organization_plan_and_subscription", return_value=(org, plan, sub)):
            allowed = await has_feature(mock_db, 401, "advanced_rag")
            assert allowed is True

    @pytest.mark.anyio
    async def test_expired_promo_suspends_features_non_destructively(self):
        """When mega discount expires, features are blocked but data is preserved."""
        org = Organization(id=402, name="Preserved Store")
        plan = Plan(id=2, code="pro", name="PRO", features={"advanced_rag": True, "ai_auto_reply": True})
        sub = Subscription(
            id=21,
            organization_id=402,
            plan_id=2,
            status="mega_discount_expired",
            mega_discount_used=True,
            current_period_end=datetime.now(timezone.utc) - timedelta(days=1)
        )

        mock_db = AsyncMock()
        with patch("app.services.entitlement_service.get_organization_plan_and_subscription", return_value=(org, plan, sub)):
            allowed = await has_feature(mock_db, 402, "ai_auto_reply")
            assert allowed is False

            with pytest.raises(FeatureNotAvailableException) as exc_info:
                await require_feature(mock_db, 402, "ai_auto_reply")

            exc = exc_info.value
            assert exc.status_code == 402
            assert exc.detail["error"] == "FEATURE_NOT_AVAILABLE"
            assert exc.detail["message"] == MEGA_DISCOUNT_EXPIRED_NOTIFICATION

        # Verify organization record is unchanged and not deleted
        assert org.name == "Preserved Store"
        assert org.id == 402

    @pytest.mark.anyio
    async def test_subscription_overview_exposes_upgrade_options_when_expired(self):
        """Expired tenant can still fetch subscription overview and see regular plan pricing."""
        plan = Plan(
            id=1,
            code="start",
            name="START",
            price_monthly=19,
            price_yearly=190,
            price_monthly_uzs=24500000,
            price_yearly_uzs=245000000
        )
        sub = Subscription(
            id=22,
            organization_id=403,
            plan_id=1,
            status="mega_discount_expired",
            billing_cycle="mega_discount",
            mega_discount_used=True,
            current_period_start=datetime.now(timezone.utc) - timedelta(days=8),
            current_period_end=datetime.now(timezone.utc) - timedelta(days=1)
        )

        mock_db = AsyncMock()
        async def mock_execute(statement, *args, **kwargs):
            res = MagicMock()
            sql_str = str(statement)
            if "subscriptions" in sql_str.lower():
                res.scalar_one_or_none.return_value = sub
            elif "plans" in sql_str.lower():
                res.scalar_one_or_none.return_value = plan
            else:
                res.scalar_one_or_none.return_value = None
                res.scalars.return_value = MagicMock(first=lambda: None)
            return res

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        overview = await subscription_service.get_subscription_overview(mock_db, 403)
        assert overview["status"] == "mega_discount_expired"
        assert overview["is_commercial_access_active"] is False
        assert overview["notification"] == MEGA_DISCOUNT_EXPIRED_NOTIFICATION
        assert overview["notification_details"]["title"] == MEGA_DISCOUNT_EXPIRED_TITLE
        assert overview["notification_details"]["cta"] == MEGA_DISCOUNT_EXPIRED_CTA
        assert overview["plan_prices"]["monthly_usd"] == 19
        assert overview["plan_prices"]["yearly_usd"] == 190


# ============================================================================
# 6. EXPLICIT RENEWAL CONSENT RECORDING
# ============================================================================

class TestExplicitRenewalConsent:
    """Verify explicit, non-prechecked user consent recording and storage."""

    @pytest.mark.anyio
    async def test_record_explicit_renewal_consent(self):
        """Store user_id, subscription_id, consent_timestamp, agreed_amount, terms version."""
        sub = Subscription(id=30, organization_id=501, plan_id=2, status="subscription_active")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_sub_res = MagicMock()
        mock_sub_res.scalar_one_or_none.return_value = sub
        mock_db.execute.return_value = mock_sub_res

        consent = await subscription_service.record_explicit_renewal_consent(
            db=mock_db,
            organization_id=501,
            user_id=42,
            billing_cycle="monthly",
            agreed_amount=76700000,
            accepted_terms_version="v2.1",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 Test Browser"
        )

        assert consent.user_id == 42
        assert consent.organization_id == 501
        assert consent.subscription_id == 30
        assert consent.selected_billing_cycle == "monthly"
        assert consent.agreed_amount == 76700000
        assert consent.agreed_currency == "UZS"
        assert consent.accepted_terms_version == "v2.1"
        assert consent.renewal_state == "consent_given"
        assert consent.ip_address == "192.168.1.100"
        assert consent.consent_timestamp is not None
        mock_db.commit.assert_awaited()

    @pytest.mark.anyio
    async def test_disable_automatic_renewal(self):
        """Disabling renewal consent marks cancel_at_period_end and logs audit."""
        sub = Subscription(
            id=31,
            organization_id=502,
            plan_id=2,
            status="subscription_active",
            cancel_at_period_end=False,
            current_period_end=datetime.now(timezone.utc) + timedelta(days=20)
        )
        consent = SubscriptionConsent(
            id=1,
            user_id=1,
            organization_id=502,
            subscription_id=31,
            renewal_state="consent_given"
        )

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_sub_res = MagicMock(scalar_one_or_none=lambda: sub)
        mock_consent_res = MagicMock()
        mock_consent_res.scalars.return_value = MagicMock(first=lambda: consent)

        mock_db.execute.side_effect = [mock_sub_res, mock_consent_res]

        res = await subscription_service.disable_automatic_renewal(
            db=mock_db,
            organization_id=502,
            user_id=1
        )
        assert res["status"] == "disabled"
        assert res["cancel_at_period_end"] is True
        assert consent.renewal_state == "cancelled"
        assert sub.cancel_at_period_end is True


# ============================================================================
# 7. TEZCHECK PAYMENT INTEGRATION & SECURITY
# ============================================================================

class TestTezCheckPaymentIntegrationAndSecurity:
    """Verify single-use bill creation, HMAC-SHA256 signature verification, and idempotency."""

    @pytest.mark.anyio
    async def test_tezcheck_create_bill_single_use(self):
        """TezCheck service creates single-use checkout session with unique bill_id."""
        tz_svc = TezCheckService()
        res = await tz_svc.create_bill(
            amount=1300000,
            currency="UZS",
            order_id="order_test_123",
            description="Test Bill",
            return_url="https://selloi.uz/success"
        )
        assert "bill_id" in res
        assert "pay_url" in res
        assert res["amount"] == 1300000
        assert res["currency"] == "UZS"

    def test_hmac_sha256_signature_verification_success(self):
        """Valid HMAC-SHA256 signature is accepted."""
        secret = "test_tezcheck_secret_key_12345"
        payload_bytes = json.dumps({"bill_id": "b_01", "status": "paid", "amount": 1300000}).encode("utf-8")
        valid_sig = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

        tz_svc = TezCheckService(secret_key=secret, mock_mode=False)
        assert tz_svc.verify_webhook_signature(payload_bytes, valid_sig) is True

    def test_tezcheck_official_v1_signature_verification_success(self):
        """Official TezCheck v1 webhook signature with timestamp and delivery id is accepted."""
        secret = "whsec_test_secret_12345"
        payload_bytes = json.dumps({
            "id": "oev_test123",
            "type": "payment.succeeded",
            "data": {
                "bill_id": "link_test_bill_1",
                "amount_minor": 1300000,
                "state": "succeeded"
            }
        }).encode("utf-8")
        ts = "1786000000"
        deliv = "whd_test_deliv_1"
        msg = f"{ts}.{deliv}.".encode("utf-8") + payload_bytes
        valid_v1_sig = "v1=" + hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

        tz_svc = TezCheckService(secret_key=secret, mock_mode=False)
        assert tz_svc.verify_webhook_signature(
            raw_body=payload_bytes,
            signature_header=valid_v1_sig,
            timestamp=ts,
            delivery_id=deliv
        ) is True

    def test_hmac_sha256_signature_verification_tampered_payload_rejected(self):
        """Tampered payload fails HMAC signature verification."""
        secret = "test_tezcheck_secret_key_12345"
        original_bytes = json.dumps({"bill_id": "b_01", "status": "paid", "amount": 1300000}).encode("utf-8")
        valid_sig = hmac.new(secret.encode("utf-8"), original_bytes, hashlib.sha256).hexdigest()

        tampered_bytes = json.dumps({"bill_id": "b_01", "status": "paid", "amount": 9999999}).encode("utf-8")

        tz_svc = TezCheckService(secret_key=secret, mock_mode=False)
        with pytest.raises(TezCheckSignatureVerificationError):
            tz_svc.verify_webhook_signature(tampered_bytes, valid_sig)

    def test_missing_signature_rejected(self):
        """Missing signature raises TezCheckSignatureVerificationError when not in mock mode."""
        tz_svc = TezCheckService(secret_key="my_secret", mock_mode=False)
        with pytest.raises(TezCheckSignatureVerificationError):
            tz_svc.verify_webhook_signature(b'{"test": 1}', None)

    @pytest.mark.anyio
    async def test_idempotent_bill_confirmation(self):
        """Re-delivering the same paid bill webhook returns already_paid without error."""
        bill = PaymentBill(
            id=10,
            bill_id="bill_already_paid_123",
            organization_id=601,
            user_id=1,
            plan_code="pro",
            billing_cycle="mega_discount",
            amount=2600000,
            currency="UZS",
            status="paid"
        )
        mock_db = AsyncMock()
        mock_bill_res = MagicMock()
        mock_bill_res.scalar_one_or_none.return_value = bill
        mock_db.execute.return_value = mock_bill_res

        result = await subscription_service.confirm_payment_and_activate(
            db=mock_db,
            bill_id="bill_already_paid_123",
            paid_amount=2600000,
            currency="UZS"
        )
        assert result["status"] == "already_paid"
        assert result["bill_id"] == "bill_already_paid_123"

    @pytest.mark.anyio
    async def test_payment_amount_mismatch_rejected(self):
        """Mismatched paid amount raises SubscriptionError."""
        bill = PaymentBill(
            id=11,
            bill_id="bill_mismatch_123",
            organization_id=602,
            user_id=1,
            plan_code="pro",
            billing_cycle="monthly",
            amount=76700000,
            currency="UZS",
            status="pending"
        )
        mock_db = AsyncMock()
        mock_bill_res = MagicMock()
        mock_bill_res.scalar_one_or_none.return_value = bill
        mock_db.execute.return_value = mock_bill_res

        with pytest.raises(SubscriptionError) as exc_info:
            await subscription_service.confirm_payment_and_activate(
                db=mock_db,
                bill_id="bill_mismatch_123",
                paid_amount=50000000,
                currency="UZS"
            )
        assert "to'lov miqdori mos kelmadi" in str(exc_info.value).lower()

    @pytest.mark.anyio
    async def test_payment_currency_mismatch_rejected(self):
        """Mismatched paid currency raises SubscriptionError."""
        bill = PaymentBill(
            id=12,
            bill_id="bill_curr_mismatch_123",
            organization_id=603,
            user_id=1,
            plan_code="pro",
            billing_cycle="monthly",
            amount=76700000,
            currency="UZS",
            status="pending"
        )
        mock_db = AsyncMock()
        mock_bill_res = MagicMock()
        mock_bill_res.scalar_one_or_none.return_value = bill
        mock_db.execute.return_value = mock_bill_res

        with pytest.raises(SubscriptionError) as exc_info:
            await subscription_service.confirm_payment_and_activate(
                db=mock_db,
                bill_id="bill_curr_mismatch_123",
                paid_amount=76700000,
                currency="EUR"
            )
        assert "to'lov valyutasi mos kelmadi" in str(exc_info.value).lower()


# ============================================================================
# 8. AUDIT LOGGING OF SUBSCRIPTION LIFECYCLE EVENTS
# ============================================================================

class TestAuditLogging:
    """Verify immutable audit log emission on billing activation and consent."""

    @pytest.mark.anyio
    async def test_mega_discount_activation_emits_audit_log(self):
        """Activation of mega discount records audit log with bill_id and expiration."""
        bill = PaymentBill(
            id=15,
            bill_id="bill_promo_audit_1",
            organization_id=701,
            user_id=5,
            plan_code="start",
            billing_cycle="mega_discount",
            amount=1300000,
            currency="UZS",
            status="pending"
        )
        sub = Subscription(id=50, organization_id=701, plan_id=1, status="awaiting_subscription_selection")
        plan = Plan(id=1, code="start", name="START")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_bill_res = MagicMock(scalar_one_or_none=lambda: bill)
        mock_sub_res = MagicMock(scalar_one_or_none=lambda: sub)
        mock_plan_res = MagicMock(scalar_one_or_none=lambda: plan)

        mock_db.execute.side_effect = [mock_bill_res, mock_sub_res, mock_plan_res]

        paid_at = datetime(2026, 11, 20, 15, 0, 0, tzinfo=timezone.utc)
        result = await subscription_service.confirm_payment_and_activate(
            db=mock_db,
            bill_id="bill_promo_audit_1",
            paid_amount=1300000,
            currency="UZS",
            verified_paid_at=paid_at
        )

        assert result["status"] == "activated"
        assert result["subscription_status"] == "mega_discount_active"
        assert sub.mega_discount_used is True
        assert sub.current_period_end == paid_at + timedelta(days=7)

        added_objects = [call[0][0] for call in mock_db.add.call_args_list]
        audit_logs = [obj for obj in added_objects if isinstance(obj, AuditLog)]
        assert len(audit_logs) == 1
        assert audit_logs[0].action == "mega_discount_activated"
        assert audit_logs[0].organization_id == 701
        assert audit_logs[0].user_id == 5
        assert audit_logs[0].metadata_json["bill_id"] == "bill_promo_audit_1"


# ============================================================================
# 9. COMPLETE PHASE 10 SCENARIOS: TEST 01 THROUGH TEST 12
# ============================================================================

class TestPhase10Scenarios:
    """Direct, explicit verification of the 12 required acceptance scenarios."""

    @pytest.mark.anyio
    async def test_01_user_purchases_start_mega_discount_7_days(self):
        """TEST 01: User purchases START Mega Discount ($1). Activates for exactly 7 days."""
        bill = PaymentBill(
            id=101,
            bill_id="b_start_promo",
            organization_id=801,
            user_id=1,
            plan_code="start",
            billing_cycle="mega_discount",
            amount=1300000,
            currency="UZS",
            status="pending"
        )
        sub = Subscription(id=81, organization_id=801, plan_id=1, status="awaiting_subscription_selection")
        plan = Plan(id=1, code="start", name="START", features={"ai_auto_reply": True, "advanced_rag": False})

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=lambda: bill),
            MagicMock(scalar_one_or_none=lambda: sub),
            MagicMock(scalar_one_or_none=lambda: plan),
        ]

        paid_at = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)
        res = await subscription_service.confirm_payment_and_activate(
            db=mock_db, bill_id="b_start_promo", paid_amount=1300000, currency="UZS", verified_paid_at=paid_at
        )

        assert res["status"] == "activated"
        assert sub.status == "mega_discount_active"
        assert sub.current_period_end == paid_at + timedelta(days=7)

    @pytest.mark.anyio
    async def test_02_user_purchases_pro_mega_discount_7_days(self):
        """TEST 02: User purchases PRO Mega Discount ($2). Activates for exactly 7 days."""
        bill = PaymentBill(
            id=102,
            bill_id="b_pro_promo",
            organization_id=802,
            user_id=2,
            plan_code="pro",
            billing_cycle="mega_discount",
            amount=2600000,
            currency="UZS",
            status="pending"
        )
        sub = Subscription(id=82, organization_id=802, plan_id=1, status="awaiting_subscription_selection")
        plan = Plan(id=2, code="pro", name="PRO", features={"ai_auto_reply": True, "advanced_rag": True})

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=lambda: bill),
            MagicMock(scalar_one_or_none=lambda: sub),
            MagicMock(scalar_one_or_none=lambda: plan),
        ]

        paid_at = datetime(2026, 11, 20, 12, 0, 0, tzinfo=timezone.utc)
        res = await subscription_service.confirm_payment_and_activate(
            db=mock_db, bill_id="b_pro_promo", paid_amount=2600000, currency="UZS", verified_paid_at=paid_at
        )

        assert res["status"] == "activated"
        assert sub.status == "mega_discount_active"
        assert sub.plan_id == 2
        assert sub.current_period_end == paid_at + timedelta(days=7)

    @pytest.mark.anyio
    async def test_03_user_purchases_ultra_mega_discount_7_days(self):
        """TEST 03: User purchases ULTRA Mega Discount ($3). Activates for exactly 7 days."""
        bill = PaymentBill(
            id=103,
            bill_id="b_ultra_promo",
            organization_id=803,
            user_id=3,
            plan_code="ultra",
            billing_cycle="mega_discount",
            amount=3900000,
            currency="UZS",
            status="pending"
        )
        sub = Subscription(id=83, organization_id=803, plan_id=1, status="awaiting_subscription_selection")
        plan = Plan(id=3, code="ultra", name="ULTRA", features={"custom_ai_tools": True, "advanced_rag": True})

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=lambda: bill),
            MagicMock(scalar_one_or_none=lambda: sub),
            MagicMock(scalar_one_or_none=lambda: plan),
        ]

        paid_at = datetime(2026, 11, 20, 14, 0, 0, tzinfo=timezone.utc)
        res = await subscription_service.confirm_payment_and_activate(
            db=mock_db, bill_id="b_ultra_promo", paid_amount=3900000, currency="UZS", verified_paid_at=paid_at
        )

        assert res["status"] == "activated"
        assert sub.status == "mega_discount_active"
        assert sub.plan_id == 3
        assert sub.current_period_end == paid_at + timedelta(days=7)

    @pytest.mark.anyio
    async def test_04_mega_discount_expiration_feature_lock_without_data_loss(self):
        """TEST 04: Mega Discount reaches expiration. Paid features locked without deleting store data."""
        org = Organization(id=804, name="Store 804", slug="store-804")
        plan = Plan(id=2, code="pro", name="PRO", features={"ai_auto_reply": True, "advanced_rag": True})
        sub = Subscription(
            id=84,
            organization_id=804,
            plan_id=2,
            status="mega_discount_expired",
            mega_discount_used=True,
            current_period_end=datetime.now(timezone.utc) - timedelta(hours=2)
        )

        mock_db = AsyncMock()
        with patch("app.services.entitlement_service.get_organization_plan_and_subscription", return_value=(org, plan, sub)):
            # Commercial features suspended
            assert await has_feature(mock_db, 804, "ai_auto_reply") is False
            assert await has_feature(mock_db, 804, "advanced_rag") is False

            # Require feature raises 402 with exact notification message
            with pytest.raises(FeatureNotAvailableException) as exc_info:
                await require_feature(mock_db, 804, "ai_auto_reply")
            assert exc_info.value.status_code == 402
            assert exc_info.value.detail["message"] == MEGA_DISCOUNT_EXPIRED_NOTIFICATION

        # Store data intact
        assert org.name == "Store 804"
        assert org.slug == "store-804"

    @pytest.mark.anyio
    async def test_05_monthly_start_subscription_one_calendar_month(self):
        """TEST 05: Monthly START subscription activates for exactly one calendar month."""
        paid_at = datetime(2026, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        computed_end = SubscriptionService.calculate_regular_period_end(paid_at, "monthly")
        assert computed_end == datetime(2026, 2, 15, 10, 0, 0, tzinfo=timezone.utc)

        # Test month-end overflow handling
        jan31 = datetime(2026, 1, 31, 10, 0, 0, tzinfo=timezone.utc)
        feb_end = SubscriptionService.calculate_regular_period_end(jan31, "monthly")
        assert feb_end == datetime(2026, 2, 28, 10, 0, 0, tzinfo=timezone.utc)

    @pytest.mark.anyio
    async def test_06_yearly_ultra_subscription_twelve_calendar_months(self):
        """TEST 06: Yearly ULTRA subscription activates for twelve calendar months."""
        paid_at = datetime(2026, 11, 20, 10, 0, 0, tzinfo=timezone.utc)
        computed_end = SubscriptionService.calculate_regular_period_end(paid_at, "yearly")
        assert computed_end == datetime(2027, 11, 20, 10, 0, 0, tzinfo=timezone.utc)

        # Leap year handling
        leap_start = datetime(2024, 2, 29, 10, 0, 0, tzinfo=timezone.utc)
        leap_end = SubscriptionService.calculate_regular_period_end(leap_start, "yearly")
        assert leap_end == datetime(2025, 2, 28, 10, 0, 0, tzinfo=timezone.utc)

    @pytest.mark.anyio
    async def test_07_unconsented_renewal_keeps_auto_charge_disabled(self):
        """TEST 07: Automatic renewal consent is not checked. Auto charging remains disabled."""
        sub = Subscription(
            id=87,
            organization_id=807,
            plan_id=1,
            status="subscription_active",
            cancel_at_period_end=False
        )
        mock_db = AsyncMock()
        async def mock_execute(statement, *args, **kwargs):
            res = MagicMock()
            sql_str = str(statement)
            if "subscriptions" in sql_str.lower():
                res.scalar_one_or_none.return_value = sub
            else:
                res.scalar_one_or_none.return_value = None
                res.scalars.return_value = MagicMock(first=lambda: None)
            return res

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        overview = await subscription_service.get_subscription_overview(mock_db, 807)
        assert overview["renewal_consented"] is False
        assert overview["renewal_state"] == "unconsented"
        assert overview["recurring_auto_charge_supported"] is False

    @pytest.mark.anyio
    async def test_08_consented_renewal_with_unsupported_provider_falls_back_to_manual(self):
        """TEST 08: Auto-renewal consented, but TezCheck has no tokenized auto-charge. Manual renewal used."""
        sub = Subscription(id=88, organization_id=808, plan_id=2, status="subscription_active")
        consent = SubscriptionConsent(
            id=1,
            user_id=1,
            organization_id=808,
            subscription_id=88,
            renewal_state="consent_given",
            selected_billing_cycle="monthly"
        )
        mock_db = AsyncMock()
        async def mock_execute(statement, *args, **kwargs):
            res = MagicMock()
            sql_str = str(statement)
            if "subscriptions" in sql_str.lower():
                res.scalar_one_or_none.return_value = sub
            elif "subscription_consents" in sql_str.lower():
                res.scalars.return_value = MagicMock(first=lambda: consent)
            else:
                res.scalar_one_or_none.return_value = None
                res.scalars.return_value = MagicMock(first=lambda: None)
            return res

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        overview = await subscription_service.get_subscription_overview(mock_db, 808)
        assert overview["renewal_state"] == "consent_given"
        # Provider limitation strictly reported: no silent pretending that auto card charges happen
        assert overview["recurring_auto_charge_supported"] is False

    @pytest.mark.anyio
    async def test_09_duplicate_webhook_no_duplicate_entitlement(self):
        """TEST 09: A duplicate payment webhook arrives. No duplicate entitlement is created."""
        bill = PaymentBill(
            id=109,
            bill_id="b_idempotent_test",
            organization_id=809,
            user_id=1,
            plan_code="start",
            billing_cycle="monthly",
            amount=24500000,
            currency="UZS",
            status="paid"
        )
        mock_db = AsyncMock()
        mock_bill_res = MagicMock(scalar_one_or_none=lambda: bill)
        mock_db.execute.return_value = mock_bill_res

        result = await subscription_service.confirm_payment_and_activate(
            db=mock_db,
            bill_id="b_idempotent_test",
            paid_amount=24500000,
            currency="UZS"
        )
        assert result["status"] == "already_paid"
        assert result["bill_id"] == "b_idempotent_test"

    @pytest.mark.anyio
    async def test_10_cross_user_store_access_denied(self):
        """TEST 10: A user attempts to access another user's store. Access is denied (403)."""
        admin = Admin(id=1, username="user_a", telegram_user_id=111, organization_id=10, role="manager")
        mock_db = AsyncMock()

        user = User(id=1, telegram_user_id=111, is_platform_owner=False)
        user_res = MagicMock(scalar_one_or_none=lambda: user)
        # Not a member of target store 999
        mem_res = MagicMock(scalar_one_or_none=lambda: None)
        mock_db.execute.side_effect = [user_res, mem_res]

        with pytest.raises(HTTPException) as exc_info:
            await get_admin_tenant_id(
                current_admin=admin,
                x_organization_id="999",
                db=mock_db
            )
        assert exc_info.value.status_code == 403
        assert "Siz ushbu tashkilot" in exc_info.value.detail

    @pytest.mark.anyio
    async def test_11_active_session_expiration_denies_requests_immediately(self):
        """TEST 11: Subscription expires during an active session. Protected requests denied without refresh."""
        org = Organization(id=811, name="Store 811")
        plan = Plan(id=1, code="start", name="START", features={"ai_auto_reply": True})
        # DB status might still say 'subscription_active', but timestamp has expired
        sub = Subscription(
            id=811,
            organization_id=811,
            plan_id=1,
            status="subscription_active",
            current_period_start=datetime.now(timezone.utc) - timedelta(days=31),
            current_period_end=datetime.now(timezone.utc) - timedelta(seconds=15)
        )

        mock_db = AsyncMock()
        with patch("app.services.entitlement_service.get_organization_plan_and_subscription", return_value=(org, plan, sub)):
            allowed = await has_feature(mock_db, 811, "ai_auto_reply")
            assert allowed is False

            with pytest.raises(FeatureNotAvailableException) as exc_info:
                await require_feature(mock_db, 811, "ai_auto_reply")
            assert exc_info.value.status_code == 402

    @pytest.mark.anyio
    async def test_12_renew_expired_subscription_restores_access(self):
        """TEST 12: User renews an expired subscription. Store and data become accessible again."""
        org = Organization(id=812, name="Restored Store")
        plan = Plan(id=2, code="pro", name="PRO", features={"ai_auto_reply": True, "advanced_rag": True})
        # Expired sub
        sub = Subscription(
            id=812,
            organization_id=812,
            plan_id=1,
            status="subscription_expired",
            current_period_end=datetime.now(timezone.utc) - timedelta(days=3)
        )
        bill = PaymentBill(
            id=112,
            bill_id="b_renewal_112",
            organization_id=812,
            user_id=1,
            plan_code="pro",
            billing_cycle="monthly",
            amount=76700000,
            currency="UZS",
            status="pending"
        )

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.execute.side_effect = [
            MagicMock(scalar_one_or_none=lambda: bill),
            MagicMock(scalar_one_or_none=lambda: sub),
            MagicMock(scalar_one_or_none=lambda: plan),
        ]

        res = await subscription_service.confirm_payment_and_activate(
            db=mock_db, bill_id="b_renewal_112", paid_amount=76700000, currency="UZS"
        )
        assert res["status"] == "activated"
        assert sub.status == "subscription_active"
        assert sub.plan_id == 2

        with patch("app.services.entitlement_service.get_organization_plan_and_subscription", return_value=(org, plan, sub)):
            assert await has_feature(mock_db, 812, "advanced_rag") is True
            assert await has_feature(mock_db, 812, "ai_auto_reply") is True
