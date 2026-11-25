import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.api.admin import router as admin_router
from app.api.internal import router as internal_router
from app.api.onboarding import router as onboarding_router
from app.api.platform import router as platform_router
from app.api.saas import router as saas_router
from app.api.webhooks import router as webhook_router
from app.core.config import settings
from app.core.db import SessionLocal, engine
from app.core.logging import get_logger, setup_logging
from app.models import Base
from app.services import admin_service
from app.services.realtime import realtime_hub
from app.services.telegram import telegram
from app.services.bot_manager import bot_manager

logger = get_logger(__name__)


async def _subscription_maintenance_loop():
    """Background task checking and synchronizing subscription lifecycle transitions."""
    while True:
        try:
            await asyncio.sleep(1800)  # Check every 30 minutes
            async with SessionLocal() as db:
                from datetime import datetime, timedelta, timezone
                from sqlalchemy import update
                from app.models import Subscription

                now = datetime.now(timezone.utc)
                # 1. Expire 7-day Mega Discounts
                stmt_promo = (
                    update(Subscription)
                    .where(
                        Subscription.status == "mega_discount_active",
                        Subscription.current_period_end < now,
                    )
                    .values(status="mega_discount_expired")
                )
                res_promo = await db.execute(stmt_promo)

                # 2. Flag due regular subscriptions
                stmt_due = (
                    update(Subscription)
                    .where(
                        Subscription.status == "subscription_active",
                        Subscription.current_period_end < now,
                    )
                    .values(status="renewal_due")
                )
                res_due = await db.execute(stmt_due)

                # 3. Expire overdue subscriptions after 3-day grace period
                grace_cutoff = now - timedelta(days=3)
                stmt_exp = (
                    update(Subscription)
                    .where(
                        Subscription.status.in_(["renewal_due", "renewal_pending", "trialing"]),
                        Subscription.current_period_end < grace_cutoff,
                    )
                    .values(status="subscription_expired")
                )
                res_exp = await db.execute(stmt_exp)

                total_affected = (res_promo.rowcount or 0) + (res_due.rowcount or 0) + (res_exp.rowcount or 0)
                if total_affected > 0:
                    await db.commit()
                    logger.info("Obunalar fon tekshiruvi: %s ta obuna holati yangilandi", total_affected)
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Obunalarni tekshirish fon vazifasida xatolik")


async def verify_database_readiness(conn) -> tuple[bool, list[str]]:
    """Verify presence of mandatory tables and required columns."""
    from sqlalchemy import inspect

    def _inspect_db(sync_conn):
        inspector = inspect(sync_conn)
        tables = set(inspector.get_table_names())
        mandatory_tables = [
            "organizations",
            "users",
            "plans",
            "subscriptions",
            "telegram_inbox",
            "telegram_outbox",
            "conversations",
            "messages",
            "orders",
        ]
        missing_tables = [t for t in mandatory_tables if t not in tables]
        if missing_tables:
            return missing_tables, []

        inbox_cols = {col["name"] for col in inspector.get_columns("telegram_inbox")}
        outbox_cols = {col["name"] for col in inspector.get_columns("telegram_outbox")}
        missing_cols = []
        if "fencing_generation" not in inbox_cols:
            missing_cols.append("telegram_inbox.fencing_generation")
        if "fencing_generation" not in outbox_cols:
            missing_cols.append("telegram_outbox.fencing_generation")
        if "lease_token" not in outbox_cols:
            missing_cols.append("telegram_outbox.lease_token")
        if "lease_owner" not in outbox_cols:
            missing_cols.append("telegram_outbox.lease_owner")
        if "lease_expires_at" not in outbox_cols:
            missing_cols.append("telegram_outbox.lease_expires_at")
        return [], missing_cols

    missing_tables, missing_cols = await conn.run_sync(_inspect_db)
    all_missing = missing_tables + missing_cols
    return len(all_missing) == 0, all_missing


@asynccontextmanager
async def lifespan(application: FastAPI):
    setup_logging()
    logger.info("Starting %s (%s)", settings.app_name, settings.app_env)
    storage_path = Path(settings.storage_dir)
    storage_path.mkdir(parents=True, exist_ok=True)
    # 1. Run schema creation and extension with production fail-closed semantics
    try:
        async with engine.begin() as conn:
            if "postgresql" in str(engine.url):
                try:
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                except Exception as ext_err:
                    if settings.is_production:
                        logger.critical("PostgreSQL 'vector' extension initialization failed in production: %s", ext_err)
                        raise RuntimeError(f"PostgreSQL extension 'vector' failed: {ext_err}") from ext_err
                    logger.warning("Vector extension notice (non-production): %s", ext_err)
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        if settings.is_production:
            logger.critical("Base schema initialization failed in production: %s", e)
            raise RuntimeError(f"Base schema initialization failed in production: {e}") from e
        logger.warning("Base schema initialization notice: %s", e)

    # Safe standalone migrations (individual transactions so one skip does not abort others)
    migration_statements = [
        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(64)",
        "ALTER TABLE organizations ALTER COLUMN telegram_bot_token TYPE TEXT",
        "ALTER TABLE organizations ALTER COLUMN openai_api_key TYPE TEXT",
        "ALTER TABLE organizations ALTER COLUMN gemini_api_key TYPE TEXT",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_monthly_uzs BIGINT DEFAULT 0",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_yearly_uzs BIGINT DEFAULT 0",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_promo_uzs BIGINT DEFAULT 1300000",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_version INTEGER DEFAULT 1",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE",
        "ALTER TABLE plan_price_history ADD COLUMN IF NOT EXISTS plan_code VARCHAR(32)",
        "ALTER TABLE plan_price_history ADD COLUMN IF NOT EXISTS billing_period VARCHAR(32) DEFAULT 'ALL'",
        "ALTER TABLE plan_price_history ADD COLUMN IF NOT EXISTS previous_price_uzs BIGINT DEFAULT 0",
        "ALTER TABLE plan_price_history ADD COLUMN IF NOT EXISTS new_price_uzs BIGINT DEFAULT 0",
        "ALTER TABLE plan_price_history ADD COLUMN IF NOT EXISTS price_version INTEGER DEFAULT 1",
        "ALTER TABLE plan_price_history ADD COLUMN IF NOT EXISTS admin_id INTEGER",
        "ALTER TABLE plan_price_history ADD COLUMN IF NOT EXISTS approval_status VARCHAR(32) DEFAULT 'approved'",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS order_id VARCHAR(128)",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS plan_id INTEGER",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS billing_period VARCHAR(32)",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS price_uzs BIGINT DEFAULT 0",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS price_version INTEGER DEFAULT 1",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS discount_amount_uzs BIGINT DEFAULT 0",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS final_amount_uzs BIGINT DEFAULT 0",
        "ALTER TABLE payment_bills ADD COLUMN IF NOT EXISTS amount_minor BIGINT DEFAULT 0",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS locked_plan_code VARCHAR(32)",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS locked_price INTEGER",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS locked_currency VARCHAR(8) DEFAULT 'USD'",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS locked_interval VARCHAR(16) DEFAULT 'monthly'",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_source VARCHAR(32) DEFAULT 'global_catalog'",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS applied_offer_id INTEGER",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS snapshot_created_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mega_discount_used BOOLEAN DEFAULT FALSE",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mega_discount_plan_code VARCHAR(32)",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mega_discount_order_id VARCHAR(128)",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mega_discount_paid_at TIMESTAMPTZ",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS mega_discount_expires_at TIMESTAMPTZ",
        "ALTER TABLE telegram_inbox ADD COLUMN IF NOT EXISTS fencing_generation INTEGER DEFAULT 1",
        "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS lease_owner VARCHAR(64)",
        "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS lease_token VARCHAR(64)",
        "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ",
        "ALTER TABLE telegram_outbox ADD COLUMN IF NOT EXISTS fencing_generation INTEGER DEFAULT 1",
        "CREATE INDEX IF NOT EXISTS ix_telegram_outbox_lease_expires_at ON telegram_outbox(lease_expires_at)",
    ]

    legacy_tables = [
        "conversations",
        "messages",
        "channel_posts",
        "connected_channels",
        "orders",
        "business_connections",
        "system_settings",
        "admins",
        "products",
        "customers",
    ]
    for tbl in legacy_tables:
        migration_statements.append(
            f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE"
        )

    for stmt in migration_statements:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception as e:
            if settings.is_production and "ADD COLUMN" in stmt and "telegram_" in stmt:
                logger.critical("Critical migration statement failed in production: %s (%s)", stmt, e)
                raise RuntimeError(f"Critical migration statement failed: {stmt}") from e
            logger.debug("Migration statement skipped: %s (%s)", stmt, e)

    # 3. Verify database readiness (fail-closed in production)
    try:
        async with engine.begin() as conn:
            ready, missing_items = await verify_database_readiness(conn)
            if not ready:
                msg = f"Database schema validation failed: missing {missing_items}"
                if settings.is_production:
                    logger.critical("Production startup fail-closed: %s", msg)
                    raise RuntimeError(msg)
                logger.warning("Database schema check notice (non-production): %s", msg)
    except Exception as e:
        if settings.is_production:
            logger.critical("Production startup aborted during database readiness verification: %s", e)
            raise
        logger.warning("Database readiness inspection notice: %s", e)

    # Synchronize serial primary key sequences
    for tbl in ["organizations", "users", "organization_members", "plans", "subscriptions"]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE((SELECT MAX(id) FROM {tbl}), 0) + 1, false)"))
        except Exception:
            pass

    # Mount static files after storage directory is guaranteed to exist.
    application.mount("/storage", StaticFiles(directory=storage_path), name="storage")

    # Initialize SaaS Plans, Defaults, and Default Organization
    try:
        async with SessionLocal() as db:
            from app.services import saas_service
            await saas_service.seed_plans_and_defaults(db)
            logger.info("SaaS tariflar va birlamchi tashkilot sinxronlandi")
    except Exception:
        logger.exception("SaaS rejalari va tashkilotni yuklashda xatolik yuz berdi")

    # Ensure owner exists if ADMIN_TELEGRAM_ID is configured
    if settings.admin_telegram_id:
        try:
            async with SessionLocal() as db:
                await admin_service.ensure_owner(db)
                await db.commit()
                logger.info("Owner admin tekshirildi/yaratildi: %s", settings.admin_telegram_id)
        except Exception:
            logger.exception("Owner admin tekshirishda xatolik yuz berdi")

    # Register bot commands in Telegram menu
    if settings.telegram_bot_token and telegram is not None:
        try:
            bot_commands = [
                {"command": "admin", "description": "Admin boshqaruv paneli"},
                {"command": "help", "description": "Barcha buyruqlar va yordam"},
                {"command": "channels", "description": "Ulangan Telegram kanallari"},
                {"command": "sync", "description": "Kanallarni sinxronlash"},
                {"command": "admins", "description": "Adminlar ro'yxati"},
                {"command": "mypermissions", "description": "Mening ruxsatlarim"},
            ]
            await telegram.call("setMyCommands", {"commands": bot_commands})
            logger.info("Telegram bot menyu buyruqlari o'rnatildi (setMyCommands)")
        except Exception:
            logger.exception("setMyCommands o'rnatishda xatolik yuz berdi")

    maintenance_task = asyncio.create_task(_subscription_maintenance_loop())
    bot_task = asyncio.create_task(bot_manager.start())

    if settings.run_background_workers:
        # Verify worker prerequisites before starting supervisor
        async with engine.begin() as conn:
            ready, missing = await verify_database_readiness(conn)
            if not ready:
                raise RuntimeError(f"Cannot start background workers: schema prerequisite missing {missing}")
        from app.services.worker_supervisor import worker_supervisor
        logger.info(
            "WorkerSupervisor starting inside API process (concurrency=%s, batch_size=%s). "
            "Note: In clustered or multi-worker Uvicorn setups, run workers as a dedicated process "
            "via 'python -m app.services.worker_supervisor' and set RUN_BACKGROUND_WORKERS=false in API.",
            settings.worker_concurrency,
            settings.worker_batch_size,
        )
        await worker_supervisor.start()

    await realtime_hub.start()
    logger.info("Application ready")
    yield
    await realtime_hub.stop()
    if settings.run_background_workers:
        from app.services.worker_supervisor import worker_supervisor
        await worker_supervisor.stop()

    await bot_manager.stop()
    bot_task.cancel()
    maintenance_task.cancel()
    try:
        await maintenance_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()
    logger.info("Application shut down")


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

cors_origins = [orig.strip() for orig in settings.allowed_origins.split(",") if orig.strip()]
if not cors_origins:
    cors_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(webhook_router)
app.include_router(onboarding_router)
app.include_router(admin_router)
app.include_router(internal_router)
app.include_router(saas_router)
app.include_router(platform_router)



@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.app_env}
