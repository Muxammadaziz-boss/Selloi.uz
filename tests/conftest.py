import pytest
import asyncio
from sqlalchemy import text
from app.core.db import engine, SessionLocal
from app.models import Base


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    """Ensure database extension, all tables, and SaaS defaults are initialized for testing."""
    async def _init():
        try:
            async with engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                await conn.run_sync(Base.metadata.create_all)
            async with SessionLocal() as db:
                from app.services import saas_service, admin_service
                await saas_service.seed_plans_and_defaults(db)
                await admin_service.ensure_owner(db)
                await db.commit()
            await engine.dispose()
        except Exception as e:
            # In unit environments without live DB, ignore connection errors
            print(f"[pytest conftest] Test database initialization note: {e}")

    try:
        asyncio.run(_init())
    except RuntimeError:
        # Loop already running
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_init())
        else:
            loop.run_until_complete(_init())
