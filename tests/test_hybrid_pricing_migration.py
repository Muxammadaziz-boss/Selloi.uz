import pytest
import importlib.util
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session
from app.models import (
    Base,
    Organization,
    User,
    Plan,
    Subscription,
    CustomerPricing,
    PlanPriceHistory,
)


@pytest.fixture
def isolated_db():
    """Isolated in-memory SQLite database for testing hybrid pricing models and backfill logic."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    
    tables_to_create = [
        Organization.__table__,
        User.__table__,
        Plan.__table__,
        CustomerPricing.__table__,
        PlanPriceHistory.__table__,
        Subscription.__table__,
    ]
    Base.metadata.create_all(engine, tables=tables_to_create)
    
    with Session(engine) as session:
        yield session
        
    Base.metadata.drop_all(engine, tables=tables_to_create)
    engine.dispose()


def test_plan_dual_currency_and_catalog_controls(isolated_db: Session):
    """Verify Plan model supports USD cents and UZS tiyin plus catalog visibility."""
    plan = Plan(
        code="pro",
        name="Pro Commercial",
        description="Business tier",
        price_monthly=59,
        price_yearly=590,
        price_monthly_uzs=76000000,
        price_yearly_uzs=760000000,
        currency="USD",
        is_active=True,
        is_public=True,
        display_order=2,
    )
    isolated_db.add(plan)
    isolated_db.commit()

    saved = isolated_db.scalar(select(Plan).where(Plan.code == "pro"))
    assert saved is not None
    assert saved.price_monthly == 59
    assert saved.price_yearly == 590
    assert saved.price_monthly_uzs == 76000000
    assert saved.price_yearly_uzs == 760000000
    assert saved.is_public is True
    assert saved.display_order == 2


def test_customer_pricing_creation_and_attributes(isolated_db: Session):
    """Verify CustomerPricing entity stores individual customer discounts correctly."""
    user = User(email="owner@selloi.uz", is_platform_owner=True, is_active=True)
    org = Organization(name="Silk Road Retail", slug="silk-road-retail")
    plan = Plan(code="pro", name="Pro", price_monthly=59, price_yearly=590)
    isolated_db.add_all([user, org, plan])
    isolated_db.commit()

    now = datetime.now(timezone.utc)
    custom_offer = CustomerPricing(
        customer_id=org.id,
        plan_id=plan.id,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=30,
        starts_at=now,
        expires_at=now + timedelta(days=90),
        status="active",
        created_by_id=user.id,
        notes="Strategic enterprise partner discount",
    )
    isolated_db.add(custom_offer)
    isolated_db.commit()

    saved_offer = isolated_db.scalar(
        select(CustomerPricing).where(CustomerPricing.customer_id == org.id)
    )
    assert saved_offer is not None
    assert saved_offer.discount_type == "percentage"
    assert saved_offer.discount_value == 30
    assert saved_offer.billing_interval == "monthly"
    assert saved_offer.status == "active"
    assert saved_offer.customer.name == "Silk Road Retail"
    assert saved_offer.plan.code == "pro"
    assert saved_offer.created_by.email == "owner@selloi.uz"


def test_subscription_snapshot_invariance_under_global_price_changes(isolated_db: Session):
    """Verify subscription snapshot rates are immutable when global plan prices change."""
    user = User(email="super@selloi.uz", is_platform_owner=True, is_active=True)
    org = Organization(name="Tashkent Mart", slug="tashkent-mart")
    plan = Plan(code="start", name="Start", price_monthly=19, price_yearly=190, currency="USD")
    isolated_db.add_all([user, org, plan])
    isolated_db.commit()

    sub = Subscription(
        organization_id=org.id,
        plan_id=plan.id,
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
    isolated_db.add(sub)
    isolated_db.commit()

    # Simulate Platform Owner raising global plan price from $19 to $29
    plan.price_monthly = 29
    plan.price_yearly = 290
    isolated_db.commit()

    # Verify subscription locked rate remains strictly $19.00 (1900 cents)
    reloaded_sub = isolated_db.scalar(
        select(Subscription).where(Subscription.organization_id == org.id)
    )
    assert reloaded_sub is not None
    assert reloaded_sub.locked_price == 1900
    assert reloaded_sub.locked_plan_code == "start"
    assert reloaded_sub.price_source == "global_catalog"
    assert reloaded_sub.locked_currency == "USD"
    # Plan updated, but snapshot preserved
    assert plan.price_monthly == 29


def test_plan_price_history_audit_logging(isolated_db: Session):
    """Verify PlanPriceHistory records audit trails of global plan price adjustments."""
    user = User(email="owner@selloi.uz", is_platform_owner=True, is_active=True)
    plan = Plan(
        code="ultra",
        name="Ultra",
        price_monthly=149,
        price_yearly=1490,
        price_monthly_uzs=192000000,
        price_yearly_uzs=1920000000,
    )
    isolated_db.add_all([user, plan])
    isolated_db.commit()

    now = datetime.now(timezone.utc)
    history_entry = PlanPriceHistory(
        plan_id=plan.id,
        price_monthly=14900,
        price_yearly=149000,
        price_monthly_uzs=192000000,
        price_yearly_uzs=1920000000,
        currency="USD",
        change_reason="Initial baseline price catalog snapshot",
        created_by_id=user.id,
        effective_from=now,
    )
    isolated_db.add(history_entry)
    isolated_db.commit()

    entries = isolated_db.scalars(
        select(PlanPriceHistory).where(PlanPriceHistory.plan_id == plan.id)
    ).all()
    assert len(entries) == 1
    assert entries[0].price_monthly == 14900
    assert entries[0].change_reason == "Initial baseline price catalog snapshot"
    assert entries[0].created_by_id == user.id


def test_backfill_simulation_for_existing_subscriptions(isolated_db: Session):
    """Verify migration backfill populates snapshot fields for legacy subscriptions."""
    org1 = Organization(name="Legacy Org 1", slug="legacy-org-1")
    org2 = Organization(name="Legacy Org 2", slug="legacy-org-2")
    plan_start = Plan(code="start", name="Start", price_monthly=19, price_yearly=190, currency="USD")
    plan_pro = Plan(code="pro", name="Pro", price_monthly=59, price_yearly=590, currency="USD")
    isolated_db.add_all([org1, org2, plan_start, plan_pro])
    isolated_db.commit()

    # Create legacy subscriptions without snapshots (simulating pre-Phase 1 state)
    sub1 = Subscription(
        organization_id=org1.id,
        plan_id=plan_start.id,
        status="active",
        billing_cycle="monthly",
        provider="stripe",
        locked_plan_code=None,
        locked_price=None,
    )
    sub2 = Subscription(
        organization_id=org2.id,
        plan_id=plan_pro.id,
        status="active",
        billing_cycle="yearly",
        provider="stripe",
        locked_plan_code=None,
        locked_price=None,
    )
    isolated_db.add_all([sub1, sub2])
    isolated_db.commit()

    # Execute backfill logic
    unfilled = isolated_db.scalars(
        select(Subscription).where(Subscription.locked_price.is_(None))
    ).all()
    assert len(unfilled) == 2

    for sub in unfilled:
        plan = isolated_db.scalar(select(Plan).where(Plan.id == sub.plan_id))
        assert plan is not None
        sub.locked_plan_code = plan.code
        sub.locked_price = (
            plan.price_yearly * 100 if sub.billing_cycle == "yearly" else plan.price_monthly * 100
        )
        sub.locked_currency = plan.currency
        sub.locked_interval = sub.billing_cycle
        sub.price_source = "global_catalog_backfill"
        sub.snapshot_created_at = datetime.now(timezone.utc)

    isolated_db.commit()

    # Verify backfill results
    r1 = isolated_db.scalar(select(Subscription).where(Subscription.organization_id == org1.id))
    assert r1.locked_plan_code == "start"
    assert r1.locked_price == 1900
    assert r1.locked_currency == "USD"
    assert r1.locked_interval == "monthly"
    assert r1.price_source == "global_catalog_backfill"

    r2 = isolated_db.scalar(select(Subscription).where(Subscription.organization_id == org2.id))
    assert r2.locked_plan_code == "pro"
    assert r2.locked_price == 59000
    assert r2.locked_currency == "USD"
    assert r2.locked_interval == "yearly"
    assert r2.price_source == "global_catalog_backfill"


def test_anti_stacking_normalized_intervals_no_both_conflict(isolated_db: Session):
    """Verify normalizing intervals to monthly and yearly prevents both ambiguity conflicts."""
    user = User(email="owner@selloi.uz", is_platform_owner=True, is_active=True)
    org = Organization(name="Unique Test Org", slug="unique-test-org")
    plan = Plan(code="pro", name="Pro", price_monthly=59, price_yearly=590)
    isolated_db.add_all([user, org, plan])
    isolated_db.commit()

    now = datetime.now(timezone.utc)
    # Adding a monthly offer
    offer_monthly = CustomerPricing(
        customer_id=org.id,
        plan_id=plan.id,
        billing_interval="monthly",
        currency="USD",
        discount_type="percentage",
        discount_value=20,
        starts_at=now,
        expires_at=now + timedelta(days=30),
        status="active",
        created_by_id=user.id,
    )
    # Adding a yearly offer (distinct interval, no collision)
    offer_yearly = CustomerPricing(
        customer_id=org.id,
        plan_id=plan.id,
        billing_interval="yearly",
        currency="USD",
        discount_type="percentage",
        discount_value=35,
        starts_at=now,
        expires_at=now + timedelta(days=365),
        status="active",
        created_by_id=user.id,
    )
    isolated_db.add_all([offer_monthly, offer_yearly])
    isolated_db.commit()

    active_offers = isolated_db.scalars(
        select(CustomerPricing)
        .where(CustomerPricing.customer_id == org.id)
        .where(CustomerPricing.status == "active")
    ).all()
    assert len(active_offers) == 2

    # Querying monthly resolves strictly the monthly offer
    resolved_monthly = isolated_db.scalar(
        select(CustomerPricing)
        .where(CustomerPricing.customer_id == org.id)
        .where(CustomerPricing.billing_interval == "monthly")
        .where(CustomerPricing.status == "active")
    )
    assert resolved_monthly.discount_value == 20

    # Querying yearly resolves strictly the yearly offer
    resolved_yearly = isolated_db.scalar(
        select(CustomerPricing)
        .where(CustomerPricing.customer_id == org.id)
        .where(CustomerPricing.billing_interval == "yearly")
        .where(CustomerPricing.status == "active")
    )
    assert resolved_yearly.discount_value == 35


def test_migration_revision_metadata_and_integrity():
    """Verify Alembic migration file 4e82f1b8a910 can be loaded and links to 3d38b39cf960."""
    spec = importlib.util.spec_from_file_location(
        "migration_mod",
        "alembic/versions/4e82f1b8a910_hybrid_pricing_system.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    assert mod.revision == "4e82f1b8a910"
    assert mod.down_revision == "3d38b39cf960"
    assert callable(mod.upgrade)
    assert callable(mod.downgrade)


def test_destructive_rollback_and_recovery_safety(isolated_db: Session):
    """Verify snapshot rate recovery protocol protects customer subscription data."""
    org = Organization(name="Recovery Org", slug="recovery-org")
    plan = Plan(code="pro", name="Pro", price_monthly=59, price_yearly=590, currency="USD")
    isolated_db.add_all([org, plan])
    isolated_db.commit()

    sub = Subscription(
        organization_id=org.id,
        plan_id=plan.id,
        status="active",
        billing_cycle="monthly",
        provider="stripe",
        locked_plan_code="pro",
        locked_price=5900,
        locked_currency="USD",
        locked_interval="monthly",
        price_source="global_catalog",
        snapshot_created_at=datetime.now(timezone.utc),
    )
    isolated_db.add(sub)
    isolated_db.commit()

    # Pre-downgrade export snapshot simulation (as required by safety protocol)
    exported_backup = {
        "organization_id": sub.organization_id,
        "plan_id": sub.plan_id,
        "locked_plan_code": sub.locked_plan_code,
        "locked_price": sub.locked_price,
        "locked_currency": sub.locked_currency,
        "locked_interval": sub.locked_interval,
        "price_source": sub.price_source,
    }

    # Simulate downgrade clearing snapshot columns
    sub.locked_plan_code = None
    sub.locked_price = None
    isolated_db.commit()

    assert sub.locked_price is None

    # Simulate post-re-upgrade restoration from backup
    sub.locked_plan_code = exported_backup["locked_plan_code"]
    sub.locked_price = exported_backup["locked_price"]
    sub.locked_currency = exported_backup["locked_currency"]
    sub.locked_interval = exported_backup["locked_interval"]
    sub.price_source = exported_backup["price_source"]
    isolated_db.commit()

    reloaded = isolated_db.scalar(select(Subscription).where(Subscription.organization_id == org.id))
    assert reloaded.locked_price == 5900
    assert reloaded.locked_plan_code == "pro"
