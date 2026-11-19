# SELLOI.UZ : HYBRID PRICING ARCHITECTURE AUDIT (REVISION 1.1)

**Document Version:** 1.1.0 (Phase 0 Architecture Revision)  
**Target:** Selloi.uz Production SaaS  
**Date:** November 19, 2026  
**Methodology:** Design Analyst & Enhancer (Strict Approval Mode)  
**Status:** ARCHITECTURE AUDIT COMPLETE : AWAITING OWNER APPROVAL TO IMPLEMENT  
**Strict Prohibition:** Zero code modifications. Zero startup schema alterations. Zero em dashes.  

---

## 1. Executive Summary

This architecture audit evaluates the end-to-end pricing, subscription, billing, and visual representation systems of Selloi.uz.

The current system has foundational SaaS data models in the backend (`Plan`, `Subscription`, `AuditLog`), but exhibits six major architectural vulnerabilities that prevent production deployment of dynamic pricing:
1. **Frontend-Backend Decoupling:** The public landing page (`PricingSection.tsx`) does not consume backend APIs. It relies on static dictionary files where prices were left as placeholder strings (`[NARX]`).
2. **Absence of Customer-Specific Pricing:** There is no database entity or API to grant negotiated custom prices, percentage discounts, or time-bounded promotions to specific tenant organizations.
3. **Lack of Subscription Rate Snapshotting:** The `Subscription` model links to `Plan.id` by foreign key without storing an immutable agreed price snapshot (`locked_price`, `locked_currency`, `locked_interval`). Changing a global plan's price alters the reported cost of existing customer subscriptions.
4. **Field Name Mismatches in Owner Controls:** The Platform Owner subtab in `PlatformOwnerTab.tsx` emits `monthly_price_usd` and `yearly_price_usd`, whereas `app/api/platform.py` accepts `price_monthly` and `price_yearly`, preventing successful price persistence.
5. **Lack of a Server-Authoritative Pricing Resolution Engine:** Payable amounts are not derived through a single unified service that evaluates active customer offers before global prices with anti-stacking protection.
6. **Improper Migration Patterns:** Performing DDL alterations during application startup creates schema drift, race conditions, and deployment instability. Schema changes must execute strictly via the existing Alembic migration framework.

---

## 2. Technical Stack & Component Inventory

| Dimension | Production Technology | File Location | Evaluation |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | FastAPI (Python 3.11) + SQLAlchemy AsyncIO | `app/main.py` | High performance asynchronous API engine |
| **Database Engine** | PostgreSQL 16 + pgvector | Docker container `telegram_ai_seller-db-1` | Relational integrity, ACID compliant |
| **Migration Framework** | Alembic (Strictly decoupled from app startup) | `alembic/versions/` | Version-controlled, reversible schema migrations |
| **Frontend Framework** | Next.js 15.2.0 (App Router) + React 19 + TypeScript | `web/app/` | React Server Components + Client hydration |
| **State & Cache** | Redis 7 Alpine + In-memory + Next.js HTTP cache | `telegram_ai_seller-redis-1` | High-speed plan caching with automated revalidation |
| **Authentication** | Cryptographic JWT Bearer + HMAC Master API Token | `app/dependencies/auth.py` | Multi-tier RBAC (`is_platform_owner` vs Tenant Admin) |
| **Billing Providers** | Stripe (Production) + MockProvider (Development/Offline) | `app/services/billing_service.py` | Provider-agnostic abstraction pattern |

---

## 3. Deep-Dive Inspection of Existing Subsystems

### 3.1. Database Layer (`app/models.py`)

#### Existing `Plan` Entity:
```python
class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="")
    price_monthly: Mapped[int] = mapped_column(Integer, default=19)  # USD
    price_yearly: Mapped[int] = mapped_column(Integer, default=190)  # USD
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    features: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    limits: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
```
- **Identified Gaps:**
  - Lacks `price_monthly_uzs` and `price_yearly_uzs` for explicit dual-currency operations.
  - Lacks `is_public` to distinguish publicly advertised tiers from unlisted partner plans.
  - Lacks `display_order` to control frontend visual sequence.
  - Lacks an audit table (`plan_price_history`) to record historical price changes.

#### Existing `Subscription` Entity:
```python
class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, index=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="trialing", index=True)
    billing_cycle: Mapped[str] = mapped_column(String(16), default="monthly")
    provider: Mapped[str] = mapped_column(String(32), default="stripe")
```
- **Identified Gaps:**
  - No rate snapshotting: missing `locked_price`, `locked_currency`, `locked_interval`, `applied_offer_id`, and `snapshot_created_at`.
  - If the Owner changes the global plan price, active subscriptions lose their original agreed rate on invoice calculation.

---

### 3.2. Missing Customer-Specific Pricing Entity (`CustomerPricing`)

Currently, Selloi has no mechanism to assign negotiated commercial terms to specific tenants.
We introduce the `CustomerPricing` entity:
- `customer_id` (ForeignKey to `organizations.id`): Target tenant organization.
- `plan_id` (ForeignKey to `plans.id`): Applicable plan tier.
- `billing_interval`: `'monthly'`, `'yearly'`, or `'both'`.
- `currency`: `'USD'` or `'UZS'`.
- `discount_type`: `'percentage'`, `'fixed_amount'`, or `'custom_price'`.
- `discount_value`: Integer minor units or whole percent.
- `starts_at` and `expires_at`: Strict validity time bounds.
- `status`: `'active'`, `'expired'`, `'revoked'`, `'superseded'`.
- `created_by_id` (ForeignKey to `users.id`): Restricts assignment strictly to Platform Owners.
- **Anti-Stacking:** Enforced via database partial unique index:
  `CREATE UNIQUE INDEX uq_customer_pricing_active ON customer_pricing (customer_id, plan_id, billing_interval) WHERE status = 'active';`

---

### 3.3. Pricing Resolution Engine

Currently, pricing calculations are fragmented between `saas_service.py` defaults and billing provider mocks.
The revised architecture introduces a centralized, server-authoritative `PricingResolutionEngine` in `app/services/pricing_service.py`:
1. **Precedence Hierarchy:**
   - Step 1: Active, valid `CustomerPricing` offer for `(customer_id, plan_id, billing_interval)`.
   - Step 2: Published global rate in `plans` (`is_active = True`, `is_public = True`).
   - Step 3: Server-authoritative quote generation. Never trust client-submitted payable amounts.
2. **Anti-Stacking:** Exactly one pricing rule is applied. Coupons cannot be stacked on top of individual customer agreements.
3. **Expired/Revoked Behavior:**
   - Revoked offers are immediately bypassed.
   - Expired offers fall back to standard global catalog rates on renewal, with an automated alert sent 7 days in advance.

---

### 3.4. Currency and Monetary Precision

- **Zero Floating-Point Drift:** All prices are stored as integers in minor units (cents for USD, tiyin for UZS).
- **Explicit Storage:** USD and UZS are stored as explicit distinct database columns. The system never performs dynamic, unpredictable runtime exchange rate conversions between currencies.
- **Rounding:** Standard financial half-up rounding (`ROUND_HALF_UP`) via Python `Decimal`.

---

### 3.5. Migration Framework Governance

- **Alembic Exclusively:** Schema modifications belong strictly in Alembic revision scripts (`alembic/versions/`).
- **No Startup Schema Modification:** Application startup (`app.main:lifespan`) must NEVER execute DDL statements or `create_all()`.
- **Pre-Migration Safety:** Compressed binary backup (`pg_dump -Fc`) and automated rollback procedures (`alembic downgrade 3d38b39cf960`).

---

## 4. Architectural Deficiencies & Targeted Remediations

| Ref | Identified Architectural Weakness | Root Cause | Production Remediation |
| :--- | :--- | :--- | :--- |
| **GAP-01** | Landing page displays hardcoded `[NARX]` placeholder text. | Decoupled static dictionary `data.ts`. | Refactor `PricingSection.tsx` to fetch `/api/plans` with graceful offline fallback. |
| **GAP-02** | Active subscribers vulnerable to silent price changes. | `subscriptions` lacks price snapshots. | Add `locked_price`, `locked_currency`, `locked_interval` to `subscriptions`. |
| **GAP-03** | No mechanism for custom enterprise customer pricing. | Missing relational model. | Create `CustomerPricing` table with partial unique index for anti-stacking. |
| **GAP-04** | Owner dashboard payload key mismatch. | `monthly_price_usd` vs `price_monthly`. | Align TypeScript interfaces and Pydantic schemas in `PlatformOwnerTab.tsx` and `app/api/platform.py`. |
| **GAP-05** | Ambiguous currency conversion risks. | Ad-hoc calculations. | Explicit dual-currency storage in minor units (cents / tiyin) with zero floating-point math. |
| **GAP-06** | Dangerous DDL execution during app startup. | `init_db()` running DDL. | Enforce Alembic migrations (`alembic upgrade head`) and make startup read-only. |

---

## 5. Audit Conclusion & Phase Sign-Off

Phase 0 architectural investigation is complete across backend models, APIs, database schemas, frontend components, and migration pipelines.
Zero source code or production databases were modified.
All revisions are documented in the specification suite awaiting Owner sign-off to proceed to Phase 1.
