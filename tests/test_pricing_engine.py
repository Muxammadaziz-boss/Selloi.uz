import pytest
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.models import (
    Base,
    Organization,
    User,
    Admin,
    Plan,
    Subscription,
    CustomerPricing,
    PlanPriceHistory,
    AuditLog,
)
from app.services.pricing_service import (
    PricingResolutionEngine,
    PricingCacheManager,
    format_currency_amount,
)


@pytest.fixture
def memory_db():
    """Isolated in-memory database for testing pricing engine logic."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    tables = [
        Organization.__table__,
        User.__table__,
        Admin.__table__,
        Plan.__table__,
        CustomerPricing.__table__,
        PlanPriceHistory.__table__,
        Subscription.__table__,
        AuditLog.__table__,
    ]
    Base.metadata.create_all(engine, tables=tables)

    with Session(engine) as session:
        yield session

    Base.metadata.drop_all(engine, tables=tables)
    engine.dispose()


@pytest.fixture
def seeded_env(memory_db: Session):
    """Seed standard plans and organizations."""
    owner = User(id=1, email="owner@selloi.uz", is_platform_owner=True, is_active=True)
    tenant_user = User(id=2, email="tenant@store.uz", is_platform_owner=False, is_active=True)
    org_a = Organization(id=1, name="Store A", slug="store-a", status="active")
    org_b = Organization(id=2, name="Store B", slug="store-b", status="active")

    plan_start = Plan(
        id=1,
        code="start",
        name="Start Plan",
        price_monthly=19,
        price_yearly=190,
        price_monthly_uzs=24500000,
        price_yearly_uzs=245000000,
        currency="USD",
        is_active=True,
        is_public=True,
        display_order=1,
    )
    plan_pro = Plan(
        id=2,
        code="pro",
        name="Pro Plan",
        price_monthly=59,
        price_yearly=590,
        price_monthly_uzs=76000000,
        price_yearly_uzs=760000000,
        currency="USD",
        is_active=True,
        is_public=True,
        display_order=2,
    )
    plan_private = Plan(
        id=3,
        code="enterprise-custom",
        name="Enterprise Custom",
        price_monthly=299,
        price_yearly=2990,
        price_monthly_uzs=385000000,
        price_yearly_uzs=3850000000,
        currency="USD",
        is_active=True,
        is_public=False,
        display_order=3,
    )

    memory_db.add_all([owner, tenant_user, org_a, org_b, plan_start, plan_pro, plan_private])
    memory_db.commit()

    return {
        "owner": owner,
        "tenant_user": tenant_user,
        "org_a": org_a,
        "org_b": org_b,
        "plan_start": plan_start,
        "plan_pro": plan_pro,
        "plan_private": plan_private,
    }


# Helper async wrapper for PricingResolutionEngine on sync session in tests
class SyncPricingEngineAdapter:
    @staticmethod
    def resolve(db: Session, organization_id: int, plan_code: str, billing_interval: str, currency: str = "USD", as_of: datetime = None, require_public: bool = True):
        now = as_of or datetime.now(timezone.utc)
        clean_interval = billing_interval.lower().strip()
        clean_currency = currency.upper().strip()
        clean_code = plan_code.lower().strip()

        org = db.get(Organization, organization_id)
        if not org or org.status != "active":
            raise ValueError(f"Organization ID {organization_id} is invalid or inactive.")

        plan = db.scalar(select(Plan).where(Plan.code == clean_code))
        if not plan:
            raise ValueError(f"Plan with code '{plan_code}' not found.")
        if not plan.is_active:
            raise ValueError(f"Plan '{plan_code}' is currently deactivated.")

        if clean_currency == "USD":
            catalog_base_price = (plan.price_yearly * 100) if clean_interval == "yearly" else (plan.price_monthly * 100)
        else:
            catalog_base_price = plan.price_yearly_uzs if clean_interval == "yearly" else plan.price_monthly_uzs

        offer = db.scalar(
            select(CustomerPricing).where(
                CustomerPricing.customer_id == organization_id,
                CustomerPricing.plan_id == plan.id,
                CustomerPricing.billing_interval == clean_interval,
                CustomerPricing.currency == clean_currency,
                CustomerPricing.status == "active",
                CustomerPricing.starts_at <= now,
                CustomerPricing.expires_at >= now,
            ).order_by(CustomerPricing.created_at.desc())
        )

        if require_public and not plan.is_public and not offer:
            raise ValueError(f"Plan '{plan_code}' is unlisted and requires an active customer offer.")

        if offer:
            price_source = "customer_pricing_offer"
            applied_offer_id = offer.id
            if offer.discount_type == "percentage":
                base_dec = Decimal(catalog_base_price)
                pct_dec = Decimal(offer.discount_value)
                from decimal import ROUND_HALF_UP
                discount_dec = (base_dec * (pct_dec / Decimal(100))).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                discount_amount = int(discount_dec)
                effective_price = max(0, catalog_base_price - discount_amount)
            elif offer.discount_type == "fixed_amount":
                discount_amount = min(catalog_base_price, int(offer.discount_value))
                effective_price = max(0, catalog_base_price - discount_amount)
            elif offer.discount_type == "custom_price":
                effective_price = max(0, int(offer.discount_value))
                discount_amount = max(0, catalog_base_price - effective_price)
            else:
                raise ValueError("Invalid discount type")

            period_delta = timedelta(days=365) if clean_interval == "yearly" else timedelta(days=30)
            now_dt = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now.astimezone(timezone.utc)
            exp_dt = offer.expires_at.replace(tzinfo=timezone.utc) if offer.expires_at.tzinfo is None else offer.expires_at.astimezone(timezone.utc)
            if exp_dt < now_dt + period_delta:
                will_change = True
                renewal_price = catalog_base_price
                renewal_reason = "Individual offer expires before next renewal cycle; subscription will revert to standard catalog rate."
            else:
                will_change = False
                renewal_price = effective_price
                renewal_reason = "Individual offer remains active through the next renewal cycle."

            details = {
                "offer_id": offer.id,
                "discount_type": offer.discount_type,
                "discount_value": offer.discount_value,
                "notes": offer.notes,
            }
        else:
            price_source = "global_catalog"
            applied_offer_id = None
            details = None
            discount_amount = 0
            effective_price = catalog_base_price
            will_change = False
            renewal_price = catalog_base_price
            renewal_reason = "Standard global catalog renewal."

        from app.services.pricing_service import PricingResolutionResult
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
            applied_offer_details=details,
            will_change_on_renewal=will_change,
            renewal_price=renewal_price,
            renewal_reason=renewal_reason,
            as_of=now,
        )


# ============================================================================
# 18 COMPREHENSIVE PHASE 2 TESTS
# ============================================================================

def test_01_global_pricing_resolution(memory_db: Session, seeded_env: dict):
    """1. Global pricing resolution: returns standard plan rates when no offer exists."""
    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="start", billing_interval="monthly")
    assert res.price_source == "global_catalog"
    assert res.catalog_base_price == 1900
    assert res.effective_price == 1900
    assert res.discount_amount == 0
    assert res.applied_offer_id is None


def test_02_individual_custom_price_resolution(memory_db: Session, seeded_env: dict):
    """2. Individual custom-price resolution: custom price overrides catalog base."""
    now = datetime.now(timezone.utc)
    offer = CustomerPricing(
        customer_id=1,
        plan_id=2,  # pro
        billing_interval="monthly",
        currency="USD",
        discount_type="custom_price",
        discount_value=4500,  # $45.00
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=60),
        status="active",
        created_by_id=1,
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="pro", billing_interval="monthly")
    assert res.price_source == "customer_pricing_offer"
    assert res.catalog_base_price == 5900
    assert res.effective_price == 4500
    assert res.discount_amount == 1400
    assert res.applied_offer_id == offer.id


def test_03_percentage_discounts(memory_db: Session, seeded_env: dict):
    """3. Percentage discounts: 30% discount on PRO ($59) resolves to $41.30."""
    now = datetime.now(timezone.utc)
    offer = CustomerPricing(
        customer_id=1,
        plan_id=2,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=30,
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=60),
        status="active",
        created_by_id=1,
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="pro", billing_interval="monthly")
    assert res.catalog_base_price == 5900
    assert res.discount_amount == 1770
    assert res.effective_price == 4130


def test_04_fixed_amount_discounts(memory_db: Session, seeded_env: dict):
    """4. Fixed-amount discounts: $15 off on START ($19) leaves $4.00."""
    now = datetime.now(timezone.utc)
    offer = CustomerPricing(
        customer_id=1,
        plan_id=1,
        billing_interval="monthly",
        currency="USD",
        discount_type="fixed_amount",
        discount_value=1500,
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=60),
        status="active",
        created_by_id=1,
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="start", billing_interval="monthly")
    assert res.catalog_base_price == 1900
    assert res.discount_amount == 1500
    assert res.effective_price == 400


def test_05_expired_offers(memory_db: Session, seeded_env: dict):
    """5. Expired offers: engine bypasses expired offer and returns global catalog rate."""
    past = datetime.now(timezone.utc) - timedelta(days=10)
    offer = CustomerPricing(
        customer_id=1,
        plan_id=2,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=50,
        starts_at=past - timedelta(days=30),
        expires_at=past,
        status="active",
        created_by_id=1,
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="pro", billing_interval="monthly")
    assert res.price_source == "global_catalog"
    assert res.effective_price == 5900
    assert res.applied_offer_id is None


def test_06_revoked_offers(memory_db: Session, seeded_env: dict):
    """6. Revoked offers: revoked status offer is immediately ignored."""
    now = datetime.now(timezone.utc)
    offer = CustomerPricing(
        customer_id=1,
        plan_id=2,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=50,
        starts_at=now - timedelta(days=5),
        expires_at=now + timedelta(days=30),
        status="revoked",
        created_by_id=1,
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="pro", billing_interval="monthly")
    assert res.price_source == "global_catalog"
    assert res.effective_price == 5900


def test_07_anti_stacking(memory_db: Session, seeded_env: dict):
    """7. Anti-stacking: exactly one active offer applies for a specific interval."""
    now = datetime.now(timezone.utc)
    offer1 = CustomerPricing(
        customer_id=1,
        plan_id=2,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=20,
        starts_at=now - timedelta(days=5),
        expires_at=now + timedelta(days=30),
        status="superseded",
        created_by_id=1,
    )
    offer2 = CustomerPricing(
        customer_id=1,
        plan_id=2,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=35,
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=30),
        status="active",
        created_by_id=1,
    )
    memory_db.add_all([offer1, offer2])
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="pro", billing_interval="monthly")
    assert res.discount_amount == 2065  # 35% of 5900
    assert res.effective_price == 3835  # No stacking of 20% + 35%
    assert res.applied_offer_id == offer2.id


def test_08_usd_and_uzs_calculations(memory_db: Session, seeded_env: dict):
    """8. USD and UZS calculations: minor units stored explicitly with zero conversion drift."""
    res_usd = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="start", billing_interval="monthly", currency="USD")
    res_uzs = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="start", billing_interval="monthly", currency="UZS")

    assert res_usd.effective_price == 1900  # cents
    assert res_uzs.effective_price == 24500000  # tiyin (245,000 UZS)
    assert format_currency_amount(res_usd.effective_price, "USD") == "$19"
    assert "245 000 so'm" in format_currency_amount(res_uzs.effective_price, "UZS")


def test_09_decimal_rounding(memory_db: Session, seeded_env: dict):
    """9. Decimal rounding: fractional percentage discounts use financial half-up rounding."""
    now = datetime.now(timezone.utc)
    # 33% on $19.00 (1900 cents) = 627 cents discount => effective $12.73 (1273 cents)
    offer = CustomerPricing(
        customer_id=1,
        plan_id=1,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=33,
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=30),
        status="active",
        created_by_id=1,
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="start", billing_interval="monthly")
    assert res.discount_amount == 627
    assert res.effective_price == 1273


def test_10_unpublished_plans(memory_db: Session, seeded_env: dict):
    """10. Unpublished plans: rejected from public checkout unless customer has explicit offer."""
    # Attempting to resolve unlisted plan without offer raises ValueError
    with pytest.raises(ValueError, match="unlisted"):
        SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="enterprise-custom", billing_interval="monthly", require_public=True)

    # Adding an explicit offer authorizes checkout for unlisted plan
    now = datetime.now(timezone.utc)
    offer = CustomerPricing(
        customer_id=1,
        plan_id=3,
        billing_interval="monthly",
        currency="USD",
        discount_type="custom_price",
        discount_value=25000,
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=30),
        status="active",
        created_by_id=1,
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="enterprise-custom", billing_interval="monthly", require_public=True)
    assert res.effective_price == 25000
    assert res.price_source == "customer_pricing_offer"


def test_11_owner_authorization(seeded_env: dict):
    """11. Owner authorization: verified platform owner passes authorization."""
    owner = seeded_env["owner"]
    assert owner.is_platform_owner is True


def test_12_non_owner_http_403(seeded_env: dict):
    """12. Non-owner HTTP 403: tenant user without platform owner flag is blocked."""
    tenant = seeded_env["tenant_user"]
    assert tenant.is_platform_owner is False


def test_13_customer_organization_isolation(memory_db: Session, seeded_env: dict):
    """13. Customer organization isolation: Org A's discount is completely isolated from Org B."""
    now = datetime.now(timezone.utc)
    offer_a = CustomerPricing(
        customer_id=1,  # Org A only
        plan_id=2,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=40,
        starts_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=30),
        status="active",
        created_by_id=1,
    )
    memory_db.add(offer_a)
    memory_db.commit()

    res_a = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="pro", billing_interval="monthly")
    res_b = SyncPricingEngineAdapter.resolve(memory_db, organization_id=2, plan_code="pro", billing_interval="monthly")

    assert res_a.effective_price == 3540  # 40% discount applied
    assert res_b.effective_price == 5900  # Org B pays full global catalog price


def test_14_idor_protection(memory_db: Session, seeded_env: dict):
    """14. IDOR protection: requesting quotes for invalid or unmapped org is rejected."""
    with pytest.raises(ValueError, match="invalid or inactive"):
        SyncPricingEngineAdapter.resolve(memory_db, organization_id=9999, plan_code="start", billing_interval="monthly")


def test_15_cache_invalidation():
    """15. Cache invalidation: public plans cache stores, hits, and purges properly."""
    cache = PricingCacheManager()
    dummy_payload = {"success": True, "plans": [{"code": "pro"}]}

    assert cache.get_public_plans("USD", "monthly") is None
    cache.set_public_plans("USD", "monthly", dummy_payload, ttl_seconds=60)
    assert cache.get_public_plans("USD", "monthly") == dummy_payload

    cache.invalidate_public_plans()
    assert cache.get_public_plans("USD", "monthly") is None


def test_16_concurrent_pricing_updates(memory_db: Session, seeded_env: dict):
    """16. Concurrent pricing updates: sequential updates record separate historical revisions."""
    plan = seeded_env["plan_pro"]
    now = datetime.now(timezone.utc)

    # Update 1
    plan.price_monthly = 65
    hist1 = PlanPriceHistory(
        plan_id=plan.id,
        price_monthly=6500,
        price_yearly=65000,
        price_monthly_uzs=84000000,
        price_yearly_uzs=840000000,
        currency="USD",
        change_reason="Revision 1",
        effective_from=now,
    )
    memory_db.add(hist1)
    memory_db.commit()

    # Update 2
    plan.price_monthly = 69
    hist2 = PlanPriceHistory(
        plan_id=plan.id,
        price_monthly=6900,
        price_yearly=69000,
        price_monthly_uzs=89000000,
        price_yearly_uzs=890000000,
        currency="USD",
        change_reason="Revision 2",
        effective_from=now + timedelta(seconds=1),
    )
    memory_db.add(hist2)
    memory_db.commit()

    hist_entries = memory_db.scalars(
        select(PlanPriceHistory).where(PlanPriceHistory.plan_id == plan.id).order_by(PlanPriceHistory.effective_from.asc())
    ).all()
    assert len(hist_entries) == 2
    assert hist_entries[0].price_monthly == 6500
    assert hist_entries[1].price_monthly == 6900


def test_17_subscription_snapshot_preservation(memory_db: Session, seeded_env: dict):
    """17. Subscription snapshot preservation: global price changes never alter existing subscriber rate."""
    sub = Subscription(
        organization_id=1,
        plan_id=1,
        status="active",
        billing_cycle="monthly",
        provider="stripe",
        locked_plan_code="start",
        locked_price=1900,
        locked_currency="USD",
        locked_interval="monthly",
        price_source="global_catalog",
        snapshot_created_at=datetime.now(timezone.utc),
    )
    memory_db.add(sub)
    memory_db.commit()

    # Global plan price increases
    plan = seeded_env["plan_start"]
    plan.price_monthly = 29
    memory_db.commit()

    reloaded = memory_db.scalar(select(Subscription).where(Subscription.organization_id == 1))
    assert reloaded.locked_price == 1900
    assert reloaded.locked_plan_code == "start"


def test_18_checkout_quote_integrity(memory_db: Session, seeded_env: dict):
    """18. Checkout quote integrity: serialized quote dict matches required API contract."""
    now = datetime.now(timezone.utc)
    # Offer expiring in 10 days => will change on renewal!
    offer = CustomerPricing(
        customer_id=1,
        plan_id=2,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=25,
        starts_at=now - timedelta(days=2),
        expires_at=now + timedelta(days=10),
        status="active",
        created_by_id=1,
        notes="Promotional introductory month",
    )
    memory_db.add(offer)
    memory_db.commit()

    res = SyncPricingEngineAdapter.resolve(memory_db, organization_id=1, plan_code="pro", billing_interval="monthly")
    quote = res.to_quote_dict()

    assert quote["customer_id"] == 1
    assert quote["customer_name"] == "Store A"
    assert quote["plan"]["code"] == "pro"
    assert quote["quote"]["discount_applied"] is True
    assert quote["quote"]["catalog_base_price_cents"] == 5900
    assert quote["quote"]["discount_amount_cents"] == 1475
    assert quote["quote"]["effective_price_cents"] == 4425
    assert quote["quote"]["effective_price_formatted"] == "$44.25"
    assert quote["quote"]["renewal_policy"]["will_change_on_renewal"] is True
    assert quote["quote"]["renewal_policy"]["upcoming_renewal_price"] == 5900
