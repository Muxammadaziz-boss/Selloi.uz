from datetime import datetime, timezone
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from app.core.config import settings


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================================
# 1. SAAS MULTI-TENANT ENTITIES
# ============================================================================

class User(Base):
    """Platform user who can belong to one or more organizations."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), default="")
    full_name: Mapped[str] = mapped_column(String(255), default="")
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True, nullable=True)
    is_platform_owner: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    token_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)

    memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Organization(Base):
    """Independent tenant representing a business or team."""
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="Retail")
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)  # active, suspended, archived
    retention_days: Mapped[int] = mapped_column(Integer, default=90)
    ai_language: Mapped[str] = mapped_column(String(16), default="uz")
    ai_personality: Mapped[str] = mapped_column(String(64), default="Professional & Courteous")
    custom_system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Per‑organization AI provider API keys (stored encrypted with Fernet)
    openai_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    gemini_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Telegram bot token dedicated to this organization (stored encrypted)
    telegram_bot_token: Mapped[str | None] = mapped_column(Text, nullable=True, unique=True)
    webhook_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Telegram MTProto / User Client credentials & Owner chat ID (per-store isolation)
    telegram_api_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    telegram_api_hash: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fernet encrypted
    telegram_phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    admin_chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    @property
    def decrypted_bot_token(self) -> str | None:
        if not self.telegram_bot_token:
            return None
        from app.core.security import decrypt_secret
        return decrypt_secret(self.telegram_bot_token)

    @property
    def decrypted_api_hash(self) -> str | None:
        if not self.telegram_api_hash:
            return None
        from app.core.security import decrypt_secret
        return decrypt_secret(self.telegram_api_hash)

    @property
    def decrypted_openai_api_key(self) -> str | None:
        if not self.openai_api_key:
            return None
        from app.core.security import decrypt_secret
        return decrypt_secret(self.openai_api_key)

    @property
    def decrypted_gemini_api_key(self) -> str | None:
        if not self.gemini_api_key:
            return None
        from app.core.security import decrypt_secret
        return decrypt_secret(self.gemini_api_key)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    subscription: Mapped["Subscription | None"] = relationship(back_populates="organization", uselist=False, cascade="all, delete-orphan")


class OrganizationMember(Base):
    """Association between User and Organization with specific RBAC role."""
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_member"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(32), default="operator", index=True)  # owner, admin, manager, operator, viewer
    permissions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Plan(Base):
    """Commercial pricing tiers: START, PRO, ULTRA."""
    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)  # start, pro, ultra
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="")
    price_monthly: Mapped[int] = mapped_column(Integer, default=19)  # USD
    price_yearly: Mapped[int] = mapped_column(Integer, default=190)  # USD (~17% discount)
    price_monthly_uzs: Mapped[int] = mapped_column(BigInteger, default=24400000, nullable=False)  # in tiyin (244,000 UZS)
    price_yearly_uzs: Mapped[int] = mapped_column(BigInteger, default=244000000, nullable=False)  # in tiyin (2,440,000 UZS)
    price_promo_uzs: Mapped[int] = mapped_column(BigInteger, default=1300000, nullable=False)  # in tiyin (13,000 UZS for 7d mega discount)
    price_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="UZS")
    features: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    limits: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class CustomerPricing(Base):
    """Customer-specific pricing, individual discounts, and custom commercial terms."""
    __tablename__ = "customer_pricing"
    __table_args__ = (
        Index(
            "uq_customer_pricing_active",
            "customer_id",
            "plan_id",
            "billing_interval",
            unique=True,
            postgresql_where=text("status = 'active'"),
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"), index=True, nullable=False)
    billing_interval: Mapped[str] = mapped_column(String(16), default="monthly", nullable=False)  # monthly, yearly
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)  # USD, UZS
    discount_type: Mapped[str] = mapped_column(String(32), nullable=False)  # percentage, fixed_amount, custom_price
    discount_value: Mapped[int] = mapped_column(Integer, nullable=False)  # minor units or whole percent
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", index=True, nullable=False)  # active, expired, revoked, superseded
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    customer: Mapped["Organization"] = relationship()
    plan: Mapped["Plan"] = relationship()
    created_by: Mapped["User"] = relationship()


class PlanPriceHistory(Base):
    """Immutable chronological audit trail of global plan price adjustments."""
    __tablename__ = "plan_price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), index=True, nullable=False)
    plan_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    billing_period: Mapped[str] = mapped_column(String(32), default="ALL", nullable=False)
    price_monthly: Mapped[int] = mapped_column(Integer, default=1900, nullable=False)  # USD cents
    price_yearly: Mapped[int] = mapped_column(Integer, default=19000, nullable=False)  # USD cents
    price_monthly_uzs: Mapped[int] = mapped_column(BigInteger, default=24400000, nullable=False)  # UZS tiyin
    price_yearly_uzs: Mapped[int] = mapped_column(BigInteger, default=244000000, nullable=False)  # UZS tiyin
    previous_price_uzs: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    new_price_uzs: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    price_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    admin_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approval_status: Mapped[str] = mapped_column(String(32), default="approved", nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="UZS", nullable=False)
    change_reason: Mapped[str] = mapped_column(String(255), default="")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True, nullable=False)
    effective_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    plan: Mapped["Plan"] = relationship()


class Subscription(Base):
    """Organization's active subscription status, billing cycle, and trial."""
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="trialing", index=True)  # trialing, active, past_due, cancelled, expired, paused
    billing_cycle: Mapped[str] = mapped_column(String(16), default="monthly")  # monthly, yearly
    provider: Mapped[str] = mapped_column(String(32), default="stripe")  # stripe, mock, payme, click, lemon_squeezy
    provider_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Server-Authoritative Rate Snapshot
    locked_plan_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    locked_price: Mapped[int | None] = mapped_column(Integer, nullable=True)  # in minor units (cents / tiyin)
    locked_currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    locked_interval: Mapped[str] = mapped_column(String(16), default="monthly", nullable=False)
    price_source: Mapped[str] = mapped_column(String(32), default="global_catalog", nullable=False)
    applied_offer_id: Mapped[int | None] = mapped_column(ForeignKey("customer_pricing.id", ondelete="SET NULL"), nullable=True, index=True)
    snapshot_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    # First-Time Mega Discount Tracking
    mega_discount_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mega_discount_plan_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mega_discount_order_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    mega_discount_paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mega_discount_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="subscription")
    plan: Mapped[Plan] = relationship()
    applied_offer: Mapped["CustomerPricing | None"] = relationship()
    consents: Mapped[list["SubscriptionConsent"]] = relationship(back_populates="subscription", cascade="all, delete-orphan")


class SubscriptionConsent(Base):
    """Explicit user consent for subscription renewals and billing frequency."""
    __tablename__ = "subscription_consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    subscription_id: Mapped[int] = mapped_column(ForeignKey("subscriptions.id", ondelete="CASCADE"), index=True, nullable=False)
    consent_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    accepted_terms_version: Mapped[str] = mapped_column(String(32), default="v1.0", nullable=False)
    selected_billing_cycle: Mapped[str] = mapped_column(String(16), nullable=False)  # monthly, yearly
    agreed_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # minor units (tiyin / cents)
    agreed_currency: Mapped[str] = mapped_column(String(8), default="UZS", nullable=False)
    renewal_state: Mapped[str] = mapped_column(String(32), default="consent_given", nullable=False)  # consent_given, consent_revoked
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship()
    organization: Mapped["Organization"] = relationship()
    subscription: Mapped["Subscription"] = relationship(back_populates="consents")


class PaymentBill(Base):
    """TezCheck single-use fixed-amount payment invoices and audit trail."""
    __tablename__ = "payment_bills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bill_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    order_id: Mapped[str | None] = mapped_column(String(128), unique=True, index=True, nullable=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("plans.id", ondelete="SET NULL"), index=True, nullable=True)
    plan_code: Mapped[str] = mapped_column(String(32), default="start", nullable=False)  # start, pro, ultra
    billing_cycle: Mapped[str] = mapped_column(String(32), default="monthly", nullable=False)  # mega_discount, monthly, yearly
    billing_period: Mapped[str | None] = mapped_column(String(32), nullable=True)
    price_uzs: Mapped[int | None] = mapped_column(BigInteger, default=0, nullable=True)
    price_version: Mapped[int | None] = mapped_column(Integer, default=1, nullable=True)
    discount_amount_uzs: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    final_amount_uzs: Mapped[int | None] = mapped_column(BigInteger, default=0, nullable=True)
    amount_minor: Mapped[int | None] = mapped_column(BigInteger, default=0, nullable=True)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)  # in minor units (tiyin)
    currency: Mapped[str] = mapped_column(String(8), default="UZS", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)  # pending, paid, expired, failed, cancelled
    checkout_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    environment: Mapped[str] = mapped_column(String(16), default="production", nullable=False)
    provider: Mapped[str] = mapped_column(String(32), default="tezcheck", nullable=False)
    provider_response: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    organization: Mapped["Organization"] = relationship()
    user: Mapped["User"] = relationship()

    @property
    def payment_status(self) -> str:
        return self.status


class AdminPaymentTest(Base):
    """Admin Payment Testing Studio records.

    Exclusively for platform owners to diagnose and test TezCheck payment integrations
    with configurable small amounts (1,000 - 10,000 UZS).
    NEVER activates plans, subscriptions, or tenant entitlements.
    """
    __tablename__ = "admin_payment_tests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    test_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    admin_email: Mapped[str] = mapped_column(String(255), nullable=False)

    amount_uzs: Mapped[int] = mapped_column(BigInteger, nullable=False)  # 1,000 to 10,000 UZS
    amount_tiyin: Mapped[int] = mapped_column(BigInteger, nullable=False)  # 100,000 to 1,000,000 tiyin
    currency: Mapped[str] = mapped_column(String(8), default="UZS", nullable=False)

    environment: Mapped[str] = mapped_column(String(16), default="sandbox", index=True, nullable=False)  # sandbox, live
    payment_purpose: Mapped[str] = mapped_column(String(64), default="admin_payment_test", nullable=False)

    provider: Mapped[str] = mapped_column(String(32), default="tezcheck", nullable=False)
    provider_bill_id: Mapped[str | None] = mapped_column(String(128), unique=True, index=True, nullable=True)
    external_reference: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)  # created, pending, paid, failed, cancelled, expired
    checkout_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    idempotency_key: Mapped[str | None] = mapped_column(String(128), unique=True, index=True, nullable=True)
    confirm_live: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    metadata_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    provider_response: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    admin: Mapped["User"] = relationship()


class UsageRecord(Base):
    """Centralized metrics tracking for monthly and lifetime tenant usage."""
    __tablename__ = "usage_records"
    __table_args__ = (UniqueConstraint("organization_id", "metric", "period", name="uq_usage_org_metric_period"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    metric: Mapped[str] = mapped_column(String(64), index=True)
    period: Mapped[str] = mapped_column(String(16), index=True)  # YYYY-MM or 'lifetime'
    used: Mapped[int] = mapped_column(BigInteger, default=0)
    limit: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



class WebhookEvent(Base):
    """Idempotent store for payment and external platform webhook receipts."""
    __tablename__ = "webhook_events"
    __table_args__ = (
        UniqueConstraint("provider", "event_id", name="uq_webhook_events_provider_event"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    event_id: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(128), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending, processed, failed, ignored
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TelegramInbox(Base):
    """PostgreSQL-backed durable inbox for incoming Telegram webhook updates.

    Guarantees ACID persistence before HTTP 200 acknowledgment, preventing update loss
    during worker crashes or restarts. Supports multi-worker atomic job claiming via
    SELECT ... FOR UPDATE SKIP LOCKED.
    """
    __tablename__ = "telegram_inbox"
    __table_args__ = (
        UniqueConstraint("bot_id", "update_id", name="uq_telegram_inbox_bot_update"),
        Index("ix_telegram_inbox_status_attempt", "status", "next_attempt_at", "lease_expires_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bot_id: Mapped[str] = mapped_column(String(64), default="default", index=True, nullable=False)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    update_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)  # pending, processing, completed, retry, dead_letter
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    lease_owner: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    fencing_generation: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class TelegramOutbox(Base):
    """PostgreSQL-backed transactional outbox for outgoing Telegram API actions and side effects.

    Allows staging external side effects (send message, notify admin) inside the same ACID
    transaction as business domain changes, dispatched reliably with at-least-once semantics.
    """
    __tablename__ = "telegram_outbox"
    __table_args__ = (
        Index("ix_telegram_outbox_status_retry", "status", "next_retry_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)  # pending, processing, sent, retry, dead_letter, uncertain
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    lease_owner: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_token: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    fencing_generation: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class AuditLog(Base):
    """Immutable audit trail for security and regulatory compliance."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    resource: Mapped[str] = mapped_column(String(64))
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class AIModelConfiguration(Base):
    """Dynamic plan-based model routing configured by platform owner."""
    __tablename__ = "ai_model_configurations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(32), default="gemini")
    model: Mapped[str] = mapped_column(String(64), default="gemini-3.1-flash-lite")
    max_tokens: Mapped[int] = mapped_column(Integer, default=2048)
    temperature: Mapped[float] = mapped_column(Float, default=0.2)
    vision_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



# ============================================================================
# 2. BUSINESS ENTITIES (SCOPED BY ORGANIZATION_ID)
# ============================================================================

class BusinessConnection(Base):
    __tablename__ = "business_connections"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    owner_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    rights: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("business_connection_id", "chat_id", name="uq_conversation_business_chat"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    business_connection_id: Mapped[str] = mapped_column(ForeignKey("business_connections.id", ondelete="CASCADE"), index=True)
    chat_id: Mapped[int] = mapped_column(BigInteger, index=True)
    customer_name: Mapped[str] = mapped_column(String(255), default="Mijoz")
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="ai_active", index=True)
    handoff_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("conversation_id", "telegram_message_id", name="uq_message_telegram_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    telegram_message_id: Mapped[int] = mapped_column(BigInteger)
    reply_to_telegram_message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    direction: Mapped[str] = mapped_column(String(20))  # customer, assistant, admin
    text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class ChannelPost(Base):
    __tablename__ = "channel_posts"
    __table_args__ = (UniqueConstraint("channel_username", "telegram_message_id", name="uq_channel_post_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    channel_username: Mapped[str] = mapped_column(String(255), index=True)
    telegram_message_id: Mapped[int] = mapped_column(BigInteger)
    text: Mapped[str] = mapped_column(Text, default="")
    image_description: Mapped[str] = mapped_column(Text, default="")
    image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_file_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.openai_embedding_dim), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    conversation_id: Mapped[int | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(64), default="")
    product_summary: Mapped[str] = mapped_column(Text, default="")
    delivery_address: Mapped[str] = mapped_column(Text, default="")
    amount: Mapped[str] = mapped_column(String(64), default="$0")
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    idempotency_key: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Product(Base):
    """Tenant product catalog items."""
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(64), index=True)  # LAP-01, etc.
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="Gaming")
    specs: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[str] = mapped_column(String(64), default="$0")
    stock: Mapped[str] = mapped_column(String(32), default="In Stock")  # In Stock, Low Stock, Pre-order
    warranty: Mapped[str] = mapped_column(String(64), default="2 oy kafolat")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



class Customer(Base):
    """Tenant customer directory."""
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("organization_id", "telegram_user_id", name="uq_org_customer_telegram"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), default="Mijoz")
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[str] = mapped_column(String(64), default="$0")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



class ConnectedChannel(Base):
    __tablename__ = "connected_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    channel_username: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    added_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    posts_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    value: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



class Admin(Base):
    """Legacy admin table preserved for backward-compatibility with Telegram bot commands."""
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=True)
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="")
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="moderator", index=True)  # owner, admin, moderator
    permissions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    added_by: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    token_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)


class StorePaymentConfig(Base):
    """Per-organization merchant payment gateway settings (encrypted secrets)."""
    __tablename__ = "store_payment_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(32), default="tezcheck", nullable=False)  # tezcheck, click, payme, manual_card
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tezcheck_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fernet encrypted
    tezcheck_secret_key: Mapped[str | None] = mapped_column(Text, nullable=True)  # Fernet encrypted
    tezcheck_cash_desk_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    click_service_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    click_merchant_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    payme_merchant_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    card_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    card_holder: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    @property
    def decrypted_tezcheck_api_key(self) -> str | None:
        if not self.tezcheck_api_key:
            return None
        from app.core.security import decrypt_secret
        return decrypt_secret(self.tezcheck_api_key)

    @property
    def decrypted_tezcheck_secret_key(self) -> str | None:
        if not self.tezcheck_secret_key:
            return None
        from app.core.security import decrypt_secret
        return decrypt_secret(self.tezcheck_secret_key)


class StoreOrderPayment(Base):
    """Store-level customer order payment links and settlement records."""
    __tablename__ = "store_order_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True, nullable=False)
    conversation_id: Mapped[int | None] = mapped_column(ForeignKey("conversations.id", ondelete="SET NULL"), index=True, nullable=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    bill_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    external_reference: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    amount_uzs: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True, nullable=False)  # pending, paid, cancelled, failed
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class StoreFollowupConfig(Base):
    """Per-organization Smart Follow-up automation rules and anti-spam limits."""
    __tablename__ = "store_followup_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    delay_hours: Mapped[int] = mapped_column(Integer, default=6, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    business_hours_only: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    start_hour: Mapped[int] = mapped_column(Integer, default=9, nullable=False)
    end_hour: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    offer_discount_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    custom_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class FollowupLog(Base):
    """Audit trail of automated Smart Follow-up nudges sent per conversation."""
    __tablename__ = "followup_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=False)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    message_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="sent", index=True, nullable=False)  # sent, failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class PasswordResetToken(Base):
    """Short-lived hashed OTP token for Telegram-verified password resets."""
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class StoreReportConfig(Base):
    """Per-store daily Telegram report schedule and preferences."""
    __tablename__ = "store_report_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    send_hour: Mapped[int] = mapped_column(Integer, default=21, nullable=False)  # Tashkent local hour 0..23
    include_orders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    include_customers: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sent_date: Mapped[str | None] = mapped_column(String(16), nullable=True)  # YYYY-MM-DD (Tashkent)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



