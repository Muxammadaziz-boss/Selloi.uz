import asyncio
import logging
import pytest
from sqlalchemy import text
from app.core.db import engine, SessionLocal
from app.models import Base

logger = logging.getLogger("pytest.conftest")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


async def _setup_test_schema():
    """Ensure database extension and all required tables exist."""
    async with engine.begin() as conn:
        if conn.dialect.name == "postgresql":
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        if conn.dialect.name == "postgresql":
            migrations = [
                "ALTER TABLE telegram_inbox ADD COLUMN IF NOT EXISTS fencing_generation INTEGER DEFAULT 1",
                "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS lease_owner VARCHAR(64)",
                "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS lease_token VARCHAR(64)",
                "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ",
                "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS fencing_generation INTEGER DEFAULT 1",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ",
                "ALTER TABLE store_payment_configs ADD COLUMN IF NOT EXISTS click_secret_key TEXT",
                "ALTER TABLE store_payment_configs ADD COLUMN IF NOT EXISTS payme_secret_key TEXT",
                "ALTER TABLE store_order_payments ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(128)",
                "ALTER TABLE store_order_payments ADD COLUMN IF NOT EXISTS payment_meta JSONB DEFAULT '{}'::jsonb",
            ]
            for stmt in migrations:
                try:
                    await conn.execute(text(stmt))
                except Exception as m_err:
                    logger.debug(f"Test migration statement notice: {m_err}")


async def _seed_test_defaults():
    """Run mandatory database seeds for plans, super-admin, and centralized tariffs."""
    from app.services import saas_service, admin_service
    from app.services.centralized_pricing_service import centralized_pricing_service

    async with SessionLocal() as db:
        await saas_service.seed_plans_and_defaults(db)
        await admin_service.ensure_owner(db)
        await centralized_pricing_service.seed_or_verify_tariffs(db)
        await db.commit()


async def _sync_database_sequences():
    """Synchronize PostgreSQL sequences for serial columns to prevent collision with seeded IDs."""
    async with engine.begin() as conn:
        if conn.dialect.name == "postgresql":
            tables_to_sync = [
                "organizations",
                "users",
                "organization_members",
                "plans",
                "subscriptions",
                "customer_pricing",
                "plan_price_history",
                "payment_bills",
                "telegram_inbox",
                "telegram_outbox",
                "orders",
            ]
            for tbl in tables_to_sync:
                try:
                    seq_val = await conn.scalar(text(f"SELECT pg_get_serial_sequence('{tbl}', 'id')"))
                    if seq_val:
                        await conn.execute(
                            text(f"SELECT setval('{seq_val}', COALESCE((SELECT MAX(id) FROM {tbl}), 0) + 1, false)")
                        )
                except Exception as seq_err:
                    logger.warning(f"Failed synchronizing sequence for table {tbl}: {seq_err}")


async def _verify_critical_tables():
    """Verify that required tables and default records exist before running test suite."""
    async with engine.connect() as conn:
        if conn.dialect.name == "postgresql":
            result = await conn.execute(text("SELECT count(*) FROM plans"))
            plan_count = result.scalar()
            if plan_count is None or plan_count == 0:
                raise RuntimeError("Critical table 'plans' is empty after database seeding.")


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    """Deterministic, fail-fast test database initialization and seed fixture."""
    async def _init():
        try:
            await _setup_test_schema()
            await _seed_test_defaults()
            await _sync_database_sequences()
            await _verify_critical_tables()
        except Exception as e:
            logger.error(f"[pytest conftest] Test database initialization failed: {e}", exc_info=True)
            pytest.exit(f"Fatal test database initialization failure: {e}", returncode=1)
        finally:
            await engine.dispose()

    try:
        asyncio.run(_init())
    except RuntimeError:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_init())
        else:
            loop.run_until_complete(_init())
