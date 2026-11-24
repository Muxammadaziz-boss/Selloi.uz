"""Centralized Pricing Engine & UZS Tariff Management Test Suite.

Verifies all 12 core requirements:
1. Administrator changes START price.
2. Website displays the new approved UZS price.
3. Checkout uses the exact approved UZS amount.
4. TezCheck receives the correct integer tiyin amount (amount_minor = amount_uzs * 100).
5. Existing payment orders retain their original price snapshots.
6. New orders use the current price version.
7. USD reference API becomes unavailable (handles gracefully).
8. Existing customer prices remain unchanged during exchange-rate API failure.
9. Unauthorized users cannot modify prices.
10. Mega Discount remains exactly seven days.
11. Monthly and yearly prices work independently.
12. Schema.org reflects the current approved UZS prices.
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import httpx
from sqlalchemy import select
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models import (
    Base,
    Admin,
    User,
    Plan,
    PlanPriceHistory,
    PaymentBill,
    CustomerPricing,
)
from app.services.centralized_pricing_service import (
    CentralizedPricingService,
    PERIOD_MEGA_DISCOUNT_7D,
    PERIOD_MONTHLY,
    PERIOD_YEARLY,
    TARIFF_START,
    TARIFF_PRO,
    TARIFF_ULTRA,
    CANONICAL_BASELINE_PRICING,
)
from app.services.cbu_currency_service import CbuCurrencyService


def run_in_test_db(coro_fn):
    """Run an async test function inside an isolated in-memory SQLite database session."""
    async def _runner():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, poolclass=StaticPool)
        tables = [
            Admin.__table__,
            User.__table__,
            Plan.__table__,
            PlanPriceHistory.__table__,
            PaymentBill.__table__,
            CustomerPricing.__table__,
        ]
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=tables))
        session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with session_factory() as session:
            service = CentralizedPricingService()
            await service.seed_or_verify_tariffs(session)
            await coro_fn(session, service)
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.drop_all(sync_conn, tables=tables))
        await engine.dispose()

    asyncio.run(_runner())


# ============================================================================
# 1. Administrator changes START price
# ============================================================================
def test_01_admin_changes_start_price():
    """Admin updates START monthly price and an immutable audit record is stored."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        admin_id = 999
        res = await service.update_tariff_pricing(
            db=db,
            plan_code="start",
            price_monthly_uzs=250_000,
            admin_id=admin_id,
            change_reason="QQS va infratuzilma xarajatlari moslashuvi",
            approval_status="approved",
        )

        assert res["status"] == "updated"
        assert res["price_version"] >= 2
        assert res["tariff"]["price_monthly_uzs"] == 250_000
        assert res["tariff"]["price_monthly_tiyin"] == 25_000_000

        # Verify immutable audit log in PlanPriceHistory
        hist_res = await db.execute(
            select(PlanPriceHistory)
            .where(PlanPriceHistory.plan_code == "start")
            .order_by(PlanPriceHistory.id.desc())
        )
        hist = hist_res.scalars().first()
        assert hist is not None
        assert hist.new_price_uzs == 250_000
        assert hist.previous_price_uzs == 244_000
        assert hist.admin_id == admin_id
        assert hist.approval_status == "approved"
        assert hist.change_reason == "QQS va infratuzilma xarajatlari moslashuvi"

    run_in_test_db(_test)


# ============================================================================
# 2. Website displays the new approved UZS price
# ============================================================================
def test_02_website_displays_new_approved_uzs_price():
    """get_active_tariffs returns formatted and active approved UZS prices."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        await service.update_tariff_pricing(
            db=db,
            plan_code="start",
            price_monthly_uzs=255_000,
            change_reason="Website display check",
        )

        tariffs_list = await service.get_active_tariffs(db)
        start_plan = next((t for t in tariffs_list if t["code"] == "start"), None)

        assert start_plan is not None
        assert start_plan["pricing"][PERIOD_MONTHLY]["amount_uzs"] == 255_000
        assert "255 000" in start_plan["pricing"][PERIOD_MONTHLY]["formatted"]
        assert "so'm / oy" in start_plan["pricing"][PERIOD_MONTHLY]["formatted"]
        assert start_plan["currency"] == "UZS"

    run_in_test_db(_test)


# ============================================================================
# 3. Checkout uses the exact approved UZS amount
# ============================================================================
def test_03_checkout_uses_exact_approved_uzs_amount():
    """Checkout price snapshot resolves exact approved UZS price."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        # Monthly checkout
        snapshot_monthly = await service.get_tariff_price(db, "start", PERIOD_MONTHLY)
        assert snapshot_monthly["price_uzs"] == 244_000
        assert snapshot_monthly["amount_minor"] == 24_400_000

        # 7-day Promo checkout
        snapshot_promo = await service.get_tariff_price(db, "start", PERIOD_MEGA_DISCOUNT_7D)
        assert snapshot_promo["price_uzs"] == 13_000
        assert snapshot_promo["amount_minor"] == 1_300_000

    run_in_test_db(_test)


# ============================================================================
# 4. TezCheck receives the correct integer tiyin amount
# ============================================================================
def test_04_tezcheck_receives_correct_integer_tiyin_amount():
    """TezCheck minor unit calculation must be exactly amount_uzs * 100 as integer."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        for code, expected_promo_uzs, expected_month_uzs, expected_year_uzs in [
            ("start", 13_000, 244_000, 2_440_000),
            ("pro", 26_000, 499_000, 4_990_000),
            ("ultra", 39_000, 999_000, 9_990_000),
        ]:
            promo_snap = await service.get_tariff_price(db, code, PERIOD_MEGA_DISCOUNT_7D)
            assert isinstance(promo_snap["amount_minor"], int)
            assert promo_snap["amount_minor"] == expected_promo_uzs * 100

            month_snap = await service.get_tariff_price(db, code, PERIOD_MONTHLY)
            assert isinstance(month_snap["amount_minor"], int)
            assert month_snap["amount_minor"] == expected_month_uzs * 100

            year_snap = await service.get_tariff_price(db, code, PERIOD_YEARLY)
            assert isinstance(year_snap["amount_minor"], int)
            assert year_snap["amount_minor"] == expected_year_uzs * 100

    run_in_test_db(_test)


# ============================================================================
# 5. Existing payment orders retain their original price snapshots
# ============================================================================
def test_05_existing_payment_orders_retain_original_price_snapshots():
    """When tariff price is edited, existing PaymentBill retains immutable snapshot."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        plan = await service.get_plan_by_code(db, "start")

        # 1. Create a bill with initial price (244,000 UZS, version 1)
        bill = PaymentBill(
            bill_id="BILL-TEST-001",
            order_id="SELLOI-ORD-TEST-001",
            organization_id=1,
            user_id=10,
            plan_id=plan.id,
            billing_period=PERIOD_MONTHLY,
            price_uzs=244_000,
            currency="UZS",
            price_version=plan.price_version or 1,
            discount_amount_uzs=0,
            final_amount_uzs=244_000,
            amount_minor=24_400_000,
            amount=24_400_000,
            status="pending",
        )
        db.add(bill)
        await db.commit()
        await db.refresh(bill)

        # 2. Administrator updates START price to 300,000 UZS (version 2)
        await service.update_tariff_pricing(
            db=db,
            plan_code="start",
            price_monthly_uzs=300_000,
            change_reason="Yangi narx siyosati",
        )

        # 3. Reload existing bill from DB and verify it was NOT modified
        saved_bill = await db.get(PaymentBill, bill.id)
        assert saved_bill.order_id == "SELLOI-ORD-TEST-001"
        assert saved_bill.price_uzs == 244_000
        assert saved_bill.amount_minor == 24_400_000
        assert saved_bill.price_version == 1

    run_in_test_db(_test)


# ============================================================================
# 6. New orders use the current price version
# ============================================================================
def test_06_new_orders_use_current_price_version():
    """Subsequent orders created after price change reflect the new version."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        await service.update_tariff_pricing(
            db=db,
            plan_code="pro",
            price_monthly_uzs=550_000,
            change_reason="PRO narxi yangilandi",
        )

        updated_plan = await service.get_plan_by_code(db, "pro")
        snap = await service.get_tariff_price(db, "pro", PERIOD_MONTHLY)

        assert snap["price_uzs"] == 550_000
        assert snap["amount_minor"] == 55_000_000
        assert snap["price_version"] == updated_plan.price_version

    run_in_test_db(_test)


# ============================================================================
# 7. USD reference API becomes unavailable
# ============================================================================
def test_07_usd_reference_api_unavailable():
    """When CBU API fails (timeout/500), service provides safe fallback with is_stale: True."""
    async def _test():
        service = CbuCurrencyService()
        with patch.object(httpx.AsyncClient, "get", side_effect=httpx.ConnectTimeout("CBU server unreachable")):
            res = await service.get_usd_reference_rate()
            assert res["currency"] == "USD"
            assert res["is_stale"] is True
            assert res["rate"] > 0
            assert "unreachable" in res.get("error", "").lower() or "fallback" in res.get("source", "").lower()

    asyncio.run(_test())


# ============================================================================
# 8. Existing customer prices remain unchanged during CBU API failure
# ============================================================================
def test_08_customer_prices_remain_unchanged_during_cbu_failure():
    """CBU exchange rate failures have ZERO impact on domestic customer UZS pricing."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        cbu_service = CbuCurrencyService()

        with patch.object(httpx.AsyncClient, "get", side_effect=Exception("Total CBU outage")):
            _ = await cbu_service.get_usd_reference_rate()

            tariffs_list = await service.get_active_tariffs(db)
            start = next(t for t in tariffs_list if t["code"] == "start")
            pro = next(t for t in tariffs_list if t["code"] == "pro")
            ultra = next(t for t in tariffs_list if t["code"] == "ultra")

            assert start["pricing"][PERIOD_MONTHLY]["amount_uzs"] == 244_000
            assert pro["pricing"][PERIOD_MONTHLY]["amount_uzs"] == 499_000
            assert ultra["pricing"][PERIOD_MONTHLY]["amount_uzs"] == 999_000

            snap = await service.get_tariff_price(db, "start", PERIOD_MONTHLY)
            assert snap["price_uzs"] == 244_000
            assert snap["amount_minor"] == 24_400_000

    run_in_test_db(_test)


# ============================================================================
# 9. Unauthorized users cannot modify prices
# ============================================================================
def test_09_unauthorized_users_cannot_modify_prices():
    """Regular tenant admin cannot modify global platform pricing (403 Forbidden)."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        from app.api.platform import require_platform_owner
        from fastapi import HTTPException

        regular_admin = Admin(
            id=55,
            name="Tenant Admin",
            role="admin",
            telegram_user_id=12345,
        )
        setattr(regular_admin, "_is_platform_owner", False)

        with pytest.raises(HTTPException) as exc_info:
            await require_platform_owner(admin=regular_admin, db=db)

        assert exc_info.value.status_code == 403
        assert "Faqat Platforma egasi" in exc_info.value.detail

    run_in_test_db(_test)


# ============================================================================
# 10. Mega Discount remains exactly seven days
# ============================================================================
def test_10_mega_discount_remains_exactly_seven_days():
    """Mega discount trial duration must strictly equal 7 days."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        snap = await service.get_tariff_price(db, "start", PERIOD_MEGA_DISCOUNT_7D)

        assert snap["duration_days"] == 7
        assert snap["billing_period"] == PERIOD_MEGA_DISCOUNT_7D

        now = datetime.now(timezone.utc)
        expires = now + timedelta(days=snap["duration_days"])
        delta = expires - now
        assert delta.days == 7
        assert delta.total_seconds() == 7 * 86400

    run_in_test_db(_test)


# ============================================================================
# 11. Monthly and yearly prices work independently
# ============================================================================
def test_11_monthly_and_yearly_prices_work_independently():
    """Modifying monthly tariff does not mutate yearly tariff and vice versa."""
    async def _test(db: AsyncSession, service: CentralizedPricingService):
        plan = await service.get_plan_by_code(db, "pro")
        orig_yearly = plan.price_yearly_uzs

        # Update only monthly
        await service.update_tariff_pricing(
            db=db,
            plan_code="pro",
            price_monthly_uzs=520_000,
            change_reason="Monthly only adjustment",
        )

        plan_reloaded = await service.get_plan_by_code(db, "pro")
        assert plan_reloaded.price_monthly_uzs == 520_000 * 100
        assert plan_reloaded.price_yearly_uzs == orig_yearly

        # Update only yearly
        await service.update_tariff_pricing(
            db=db,
            plan_code="pro",
            price_yearly_uzs=5_200_000,
            change_reason="Yearly only adjustment",
        )

        plan_reloaded2 = await service.get_plan_by_code(db, "pro")
        assert plan_reloaded2.price_monthly_uzs == 520_000 * 100
        assert plan_reloaded2.price_yearly_uzs == 5_200_000 * 100

    run_in_test_db(_test)


# ============================================================================
# 12. Schema.org reflects current approved UZS prices
# ============================================================================
def test_12_schema_org_reflects_current_approved_uzs_prices():
    """Verify that layout.tsx Schema.org metadata uses currency UZS and correct values."""
    with open("web/app/layout.tsx", "r", encoding="utf-8") as f:
        content = f.read()

    assert '"priceCurrency": "UZS"' in content
    assert '"price": "13000"' in content  # START 7d promo
    assert '"price": "26000"' in content  # PRO 7d promo
    assert '"price": "39000"' in content  # ULTRA 7d promo
    assert '"price": "0"' not in content
    assert "bepul" not in content.lower()
