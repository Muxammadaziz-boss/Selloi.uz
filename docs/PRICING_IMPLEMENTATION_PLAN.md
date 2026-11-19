# SELLOI.UZ : CENTRALIZED HYBRID DYNAMIC PRICING IMPLEMENTATION PLAN (REVISION 1.1)

**Document Version:** 1.1.0 (Phase 0 Revision)  
**Status:** PHASE 0 REVISION COMPLETE : STRICT APPROVAL MODE : AWAITING OWNER APPROVAL TO EXECUTE PHASE 1  
**Author:** Selloi Enterprise Solutions Architect & Design Systems Lead  
**Related Documents:**
- Architecture Audit: [PRICING_ARCHITECTURE_AUDIT.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/PRICING_ARCHITECTURE_AUDIT.md)
- Relational Database Design: [PRICING_DATABASE_DESIGN.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/PRICING_DATABASE_DESIGN.md)
- API Specification: [PRICING_API_SPEC.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/PRICING_API_SPEC.md)

---

## 1. Executive Summary & Architecture Baseline

The Selloi Hybrid Dynamic Pricing System transforms Selloi from static hardcoded frontend pricing into an enterprise-grade, server-authoritative hybrid commercial operating system.

The system harmonizes:
1. **Global Dynamic Plans:** Centrally managed by the Platform Owner via `/platform`. Supports START, PRO, ULTRA, and custom tiers with dual-currency rates (USD and UZS), features, and public visibility toggles.
2. **Individual Customer Pricing (`CustomerPricing`):** Tailored commercial terms assigned to specific tenant organizations with strict anti-stacking controls, date bounds, and discount structures.
3. **Omnichannel Synchronization:** Changes published in the Owner dashboard instantly propagate to public landing pages (`https://selloi.uz/#tariflar`) and tenant dashboards (`/dashboard`, `/platform`).
4. **Server-Authoritative Rate Snapshotting:** Every subscription permanently locks its agreed rate (`locked_price`, `locked_currency`, `locked_interval`, `applied_offer_id`) to ensure global price changes never alter existing subscriber bills without explicit re-contracting.
5. **Decoupled Alembic Migrations:** Zero schema modifications occur during application boot. All migrations are version-controlled, automated, and fully reversible via Alembic.

---

## 2. Deep Dive: Required Architectural Components

### 2.1. CustomerPricing Model Specification
Persistent database model for customer-specific pricing terms:
- `id`: Integer Primary Key.
- `customer_id`: Integer ForeignKey -> `organizations.id` ON DELETE CASCADE (indexed).
  - *Architectural Note:* In Selloi B2B SaaS, tenant organizations (`organizations`) represent paying customer entities.
- `plan_id`: Integer ForeignKey -> `plans.id` ON DELETE RESTRICT (indexed).
- `billing_interval`: String (`monthly`, `yearly`, `both`).
- `currency`: String (`USD`, `UZS`).
- `discount_type`: String (`percentage`, `fixed_amount`, `custom_price`).
- `discount_value`: Integer minor units (e.g. cents/tiyin) or whole percent (1-100).
- `starts_at`: DateTime(timezone=True) NOT NULL.
- `expires_at`: DateTime(timezone=True) NOT NULL.
- `status`: String (`active`, `expired`, `revoked`, `superseded`).
- `created_by_id`: Integer ForeignKey -> `users.id` ON DELETE RESTRICT (Platform Owner).
- `notes`: Text (optional administrative context).
- `created_at` / `updated_at`: DateTime(timezone=True).

#### Prevention of Conflicting Active Offers & Unauthorized Assignment
1. **Anti-Stacking Partial Unique Index:**
   `CREATE UNIQUE INDEX uq_customer_pricing_active ON customer_pricing (customer_id, plan_id, billing_interval) WHERE status = 'active';`
   Guarantees at the database engine level that no customer can hold multiple concurrent active offers for the same plan and interval.
2. **Strict Platform Owner RBAC:**
   Only authenticated users with `is_platform_owner == True` can create or modify `CustomerPricing` records.
   Tenant admins attempting to modify customer pricing receive an immediate `HTTP 403 Forbidden` response.

---

### 2.2. Pricing Resolution Engine

The Pricing Resolution Engine (`app/services/pricing_service.py`) operates as a single, backend-authoritative calculation service:

```
[Incoming Checkout / Renewal Quote Request]
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│ STEP 1: Query Active CustomerPricing Record              │
│ SELECT * FROM customer_pricing                           │
│ WHERE customer_id = :customer_id                         │
│   AND plan_id = :plan_id                                 │
│   AND (billing_interval = :interval OR billing_interval = 'both')
│   AND currency = :currency                               │
│   AND status = 'active'                                  │
│   AND :target_date BETWEEN starts_at AND expires_at      │
│ ORDER BY created_at DESC LIMIT 1                         │
└────────────────────────────┬─────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼ (Active Offer Found)        ▼ (No Active Offer)
┌────────────────────────────────┐ ┌─────────────────────────────────────────┐
│ Apply Customer Discount        │ │ STEP 2: Fallback to Global Catalog Rate │
│ - custom_price: exact value    │ │ SELECT * FROM plans                     │
│ - percentage: half-up round    │ │ WHERE id = :plan_id                     │
│ - fixed_amount: minus discount │ │   AND is_active = TRUE                  │
│ Record applied_offer_id        │ │   AND is_public = TRUE                  │
└────────────────┬───────────────┘ └────────────────────┬────────────────────┘
                 │                                      │
                 ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Server-Authoritative Quote Validation                              │
│ - Never trust client-submitted payable amounts                             │
│ - Ensure effective price >= 0                                              │
│ - Prevent stacking (strictly 1 active rule applied)                        │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Lock Subscription Rate Snapshot                                    │
│ - Set subscription.locked_price = quote.effective_price                    │
│ - Set subscription.locked_currency = quote.currency                        │
│ - Set subscription.locked_interval = quote.interval                        │
│ - Set subscription.applied_offer_id = quote.applied_offer_id               │
│ - Set subscription.snapshot_created_at = utcnow()                          │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Behavior for Expired and Revoked Offers
- **Revoked Offers (`status == 'revoked'`):** Immediately bypassed by the query filter (`status = 'active'`). Quotes instantly resolve to standard global catalog rates.
- **Expired Offers (`target_date > expires_at`):**
  - Automatically bypassed by the resolution engine.
  - Subscription renewal recalculates against the published global catalog rate.
  - Automated advance notification is emitted 7 days prior to renewal alerting the tenant of standard rate application.

---

### 2.3. Currency and Price Representation

1. **Zero Floating-Point Arithmetic:**
   Floating-point types (`float`, `double`) are strictly prohibited in all financial models and billing services.
   All values are stored as integers representing minor currency units:
   - **USD:** Stored in **cents** (e.g. `$19.00` = `1900`, `$59.00` = `5900`, `$149.00` = `14900`).
   - **UZS:** Stored in **tiyin** (e.g. `245,000 UZS` = `24,500,000` tiyin, or integer UZS with explicit column naming).
2. **Explicit Dual-Currency Storage:**
   The backend stores distinct explicit values: `price_monthly` (USD cents) and `price_monthly_uzs` (UZS tiyin).
   The system never performs runtime exchange rate conversions between currencies. The Owner sets and approves explicit rates in both currencies.
3. **Rounding Rules:**
   All percentage discount computations use standard financial half-up rounding (`ROUND_HALF_UP`) via Python `decimal.Decimal` with explicit quantizing to whole minor units (`Decimal('1')`).
4. **Backend-Formatted Display:**
   The backend API returns both the integer minor unit (for payment providers) and the localized display string (`"$19.00 / month"`, `"245 000 so'm / oy"`). Frontend components never perform currency conversion or rounding math.

---

### 2.4. Subscription Price Snapshotting

1. **Immutable Snapshot Columns on `subscriptions`:**
   - `locked_price`: Integer NOT NULL (minor units).
   - `locked_currency`: String(8) NOT NULL (`USD` or `UZS`).
   - `locked_interval`: String(16) NOT NULL (`monthly` or `yearly`).
   - `applied_offer_id`: Integer NULL (ForeignKey -> `customer_pricing.id` ON DELETE SET NULL).
   - `snapshot_created_at`: DateTime(timezone=True) NOT NULL.
2. **Invariance Under Global Updates:**
   When the Owner updates a plan's price in `plans`, active subscriptions remain bound to their `locked_price`. Existing subscribers are grandfathered until they explicitly upgrade, downgrade, or cancel.
3. **Individual Offer Expiration at Renewal:**
   If `applied_offer_id` has expired before the next billing cycle:
   - The renewal runner re-evaluates pricing via `PricingResolutionEngine`.
   - The engine resolves the current global catalog rate.
   - `subscriptions.locked_price` updates to the global catalog rate, `applied_offer_id` is cleared to `NULL`, and an audit log event is recorded.

---

### 2.5. Database Migrations Governance

1. **Alembic Framework Integration:**
   All schema modifications are managed exclusively via Alembic revision scripts (`alembic/versions/`).
2. **Strict Prohibition on Startup Schema Modifications:**
   Application boot (`app.main:lifespan` or `init_db`) must NEVER execute DDL statements (`ALTER TABLE`, `CREATE TABLE`, `create_all()`). Application startup is strictly read-only schema validation.
3. **Migration Sequence & Ordering:**
   - Current revision: `3d38b39cf960` (`init_schema.py`).
   - Target revision: `4e82f1b8a910` (`4e82f1b8a910_hybrid_pricing_system.py`).
   - Down revision: `'3d38b39cf960'`.
4. **Pre-Migration Backup Protocol:**
   `pg_dump -Fc -h localhost -U postgres -d selloi_production > /var/backups/selloi_pre_pricing_$(date +%Y%m%d_%H%M%S).dump`
   Verify validity before executing: `pg_restore --list /var/backups/selloi_pre_pricing_*.dump | head -n 30`
5. **Rollback Strategy:**
   If migration encounters an error:
   `alembic downgrade 3d38b39cf960`
   The `downgrade()` function systematically removes all created constraints, indexes, tables, and columns in reverse dependency order without touching unrelated data.

---

## 3. Revised Implementation Phases

### Phase 1: Database Migration & Schema Hardening (Target: Data Layer)
*Dependencies: PostgreSQL 16, Alembic, Pre-migration Backup*
*Scope:*
- Create migration script `alembic/versions/4e82f1b8a910_hybrid_pricing_system.py`.
- Define `customer_pricing` table with partial unique index `uq_customer_pricing_active`.
- Define `plan_price_history` table for immutable price change logging.
- Add `price_monthly_uzs`, `price_yearly_uzs`, `is_public`, `display_order` to `plans`.
- Add `locked_price`, `locked_currency`, `locked_interval`, `applied_offer_id`, `snapshot_created_at` to `subscriptions`.
- Execute backfill to populate `locked_price` on existing subscriptions.
- Update SQLAlchemy ORM models in `app/models.py`.
- Security Test: Validate `downgrade()` and `upgrade()` idempotency in isolated test DB.

### Phase 2: Backend Pricing Resolution Engine & APIs (Target: Business Logic & Control Plane)
*Dependencies: Phase 1 complete*
*Scope:*
- Implement `PricingResolutionEngine` in `app/services/pricing_service.py`.
- Update `app/services/billing_service.py` to capture rate snapshots during subscription creation.
- Enhance public `GET /api/plans` with Redis caching (60s TTL) and automatic cache invalidation.
- Implement customer `GET /api/pricing/checkout-quote`.
- Implement Owner Platform APIs in `app/api/platform.py`:
  - `GET /api/platform/plans`, `POST /api/platform/plans`, `PUT /api/platform/plans/{code}`, `PATCH /api/platform/plans/{code}/status`.
  - `GET /api/platform/customers/{customer_id}/pricing`, `POST /api/platform/customers/{customer_id}/pricing`, `DELETE /api/platform/customers/{customer_id}/pricing/{pricing_id}`.
  - `POST /api/platform/pricing/preview-resolution` (dry-run simulator).
  - `GET /api/platform/pricing/history`, `GET /api/platform/pricing/audit-logs`.
- Security & Unit Tests (`tests/test_pricing_engine.py`):
  - Anti-stacking constraint test.
  - Offer expiration fallback test.
  - Grandfathering snapshot invariance test.
  - RBAC verification (non-owners receive 403 Forbidden).
  - Floating-point prevention and Decimal rounding test.

### Phase 3: Frontend Omnichannel Modernization & Dashboards (Target: User Experience)
*Dependencies: Phase 2 complete*
*Scope:*
- Refactor `web/app/components/landing/PricingSection.tsx` to dynamically fetch `/api/plans`.
- Remove hardcoded `[NARX]` strings; add graceful offline fallback for landing page.
- Update customer dashboard billing tab (`BillingTab.tsx`) to show locked rate and active discount details.
- Build Owner Pricing Manager in `web/app/components/saas/PlatformOwnerTab.tsx`:
  - Global Plans editor (with live price preview).
  - Customer-Specific Pricing management interface (assign offers, search tenants, revoke offers).
  - Dry-Run Pricing Simulator UI.
- Align payload keys (`price_monthly` vs `monthly_price_usd`).

### Phase 4: Full-Story Verification, CI/CD Gate & Deployment (Target: Production Reliability)
*Dependencies: Phase 3 complete*
*Scope:*
- Run backend pytest suite (all 70 existing tests + new pricing test suite).
- Run financial formula trace (`scripts/financial_formula_trace.py`).
- Run Next.js production build and TypeScript typecheck (`npm run typecheck`, `npm run build`).
- Run Playwright E2E suites across 5 viewports.
- Run Axe-Core WCAG 2.1 AA accessibility audit.
- Deploy via zero-downtime Docker Compose on VPS.

---

## 4. Comprehensive Risk Matrix

| Risk ID | Potential Risk | Severity | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Production table lock during migration on `subscriptions`. | High | Low | Use `ADD COLUMN IF NOT EXISTS` with nullable defaults, backfill in chunks, then add constraint. Verified non-blocking. |
| **RSK-02** | Frontend pricing shows blank state if API is temporarily down. | Critical | Low | Implement static/cached fallback in `PricingSection.tsx`. If network fails, display cached plans with retry indicator. |
| **RSK-03** | Unauthorized tenant attempts to modify customer discounts. | Critical | Low | Strict backend authorization: all `/api/platform/*` endpoints enforce `require_platform_owner`. Non-owners receive 403. |
| **RSK-04** | Conflicting active offers assigned to the same customer. | High | Low | Enforced by PostgreSQL partial unique index `uq_customer_pricing_active`. API returns 409 Conflict. |
| **RSK-05** | Currency conversion drift between USD and UZS. | Medium | Low | Dual-currency integer storage (cents/tiyin). No ad-hoc float conversions. Rounding via Decimal HALF_UP. |
| **RSK-06** | Existing subscribers inadvertently charged higher price. | Critical | Low | Subscription rate snapshotting: `locked_price` in `subscriptions` is immutable during global plan price adjustments. |

---

## 5. Architectural Decisions Requiring Owner Sign-Off

The architecture design is complete. Before Phase 1 execution can begin, the Platform Owner must decide on the following 3 operational policies:

### Decision 1: Currency Preference & Primary Display
- **Option A (Recommended):** Dual-currency display: Default display in USD (`$19`, `$59`, `$149`), with an interactive currency toggle in the UI allowing customers in Uzbekistan to view and pay in UZS (`245,000 UZS`, `760,000 UZS`, etc.).
- **Option B:** Single currency USD only for all public display and billing.

### Decision 2: Expired Offer Transition Policy
- **Option A (Recommended):** Automatic graceful transition: When an individual customer discount expires, the subscription renews at the current standard global plan price. Customer receives an email/Telegram alert 7 days prior.
- **Option B:** Hard stop: Subscription pauses at expiration until customer explicitly confirms renewal at global catalog price.

### Decision 3: Plan Upgrade / Downgrade Policy
- **Option A (Recommended):** Prorated adjustment: When a customer changes plans mid-cycle, unused days from their current rate are credited toward the new plan rate.
- **Option B:** Period-end switch: Plan updates at the next billing cycle; current cycle runs to completion at the original rate.

---

## 6. Phase 0 Revision Sign-Off

Phase 0 Revision is complete across all four specification documents:
1. [PRICING_ARCHITECTURE_AUDIT.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/PRICING_ARCHITECTURE_AUDIT.md)
2. [PRICING_DATABASE_DESIGN.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/PRICING_DATABASE_DESIGN.md)
3. [PRICING_API_SPEC.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/PRICING_API_SPEC.md)
4. [PRICING_IMPLEMENTATION_PLAN.md](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/PRICING_IMPLEMENTATION_PLAN.md)

No source code or production database schema has been modified.
Phase 1 execution awaits explicit Owner approval and decision selections.
