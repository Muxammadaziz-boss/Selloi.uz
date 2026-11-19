# Selloi: Centralized Dynamic Pricing System Specification & Architecture Plan

> **Document Type:** System Architecture Specification & Implementation Plan  
> **Target System:** Selloi.uz Production SaaS  
> **Status:** PHASE 0 COMPLETE / READY FOR OWNER APPROVAL  
> **Date:** November 19, 2026  
> **Framework:** Design Analyst & Enhancer (Approval Mode)  

---

## 1. Executive Summary & Objective

The objective of this initiative is to replace all hardcoded frontend subscription pricing across Selloi.uz with an authoritative, centralized, database-driven pricing system managed exclusively by the Platform Owner.

When the Owner updates a plan's price, features, or visibility from the Platform Owner Dashboard:
1. The changes persist immediately to the central database (`plans` table).
2. An immutable audit log records who made the change, when, and the before/after delta.
3. Cache invalidation triggers across all relevant endpoints.
4. The public landing page (`https://selloi.uz/#tariflar`) and user dashboards immediately display the updated pricing without requiring manual code changes, rebuilds, or container redeployments.
5. Existing customer subscriptions remain on their agreed billing terms without unexpected price alterations.

---

## 2. Current Architecture Audit & Discovered Disconnections

A thorough inspection of the repository revealed the exact current implementation:

### 2.1 Backend Models & Data Structure (`app/models.py`)
- The `Plan` model exists in `app/models.py` (lines 131-147) with columns: `id`, `code`, `name`, `description`, `price_monthly`, `price_yearly`, `currency`, `features`, `limits`, `is_active`, `is_featured`, `created_at`, `updated_at`.
- The `Subscription` model exists in `app/models.py` (lines 151-175) linked to `Plan` via `plan_id = ForeignKey('plans.id', ondelete='RESTRICT')`.
- The `AuditLog` model exists in `app/models.py` (lines 207-220) with columns: `id`, `organization_id`, `user_id`, `action`, `resource`, `resource_id`, `metadata_json`, `ip`, `user_agent`, `created_at`.
- **Gaps Identified:**
  - `Plan` lacks a `sort_order` column, causing unpredictable ordering.
  - `Plan` lacks an `is_public` column to distinguish between plans visible on the public landing page versus private enterprise plans.
  - `Plan` lacks promotional pricing fields (`promotional_price_monthly`, `promotional_price_yearly`, `promo_badge`).
  - `Plan` lacks an `updated_by_id` column linking to the Owner user who authorized the change.
  - No historical price tracking table exists to record time-series pricing adjustments.

### 2.2 Existing APIs (`app/api/saas.py` & `app/api/platform.py`)
- `GET /api/plans` in `app/api/saas.py` (lines 133-154) is a public endpoint returning active plans.
- `PUT /api/platform/plans/{plan_code}` in `app/api/platform.py` (lines 343-394) is an Owner-protected endpoint with `require_platform_owner`.
- **Gaps Identified:**
  - Field name mismatch: `app/api/platform.py` expects `price_monthly` and `price_yearly`, but the frontend `PlatformOwnerTab.tsx` was sending `monthly_price_usd` and `yearly_price_usd`.
  - No endpoint exists for the Owner to create a brand new plan (`POST /api/platform/plans`).
  - No endpoint exists to archive or toggle visibility of plans.
  - `GET /api/plans` lacks HTTP cache-control headers (`s-maxage`, `stale-while-revalidate`).

### 2.3 Frontend Landing Page (`web/app/components/landing/PricingSection.tsx`)
- `PricingSection.tsx` currently ignores the backend API entirely. It imports `PRICING_PLANS_BY_LANG` from `data.ts`, where prices are hardcoded as `"[NARX]"`.
- **Gaps Identified:**
  - Zero dynamic API integration on the public landing page.
  - Visitors see unreplaced template placeholders.

### 2.4 User Dashboard & Onboarding (`web/app/components/saas/`)
- `PlatformOwnerTab.tsx` (subtab `plans`): Contains hardcoded default cards (`defaultM: 19, defaultY: 190`) instead of rendering the live database records.
- `OnboardingModal.tsx` (step 9): Hardcoded plan cards (`$19/oy`, `$59/oy`, `$149/oy`).
- `PricingTab.tsx`: Already wired to receive dynamic `plans: PlanItem[]`, but depends on `Dashboard.tsx` passing live data.

---

## 3. Database Architecture & Schema Enhancements

### 3.1 Enhancements to `Plan` Model (`app/models.py`)
We will add the following columns to `Plan`:
```python
sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
promotional_price_monthly: Mapped[int | None] = mapped_column(Integer, nullable=True)
promotional_price_yearly: Mapped[int | None] = mapped_column(Integer, nullable=True)
promo_badge: Mapped[str | None] = mapped_column(String(64), nullable=True)
updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
```

### 3.2 New `PlanPriceHistory` Model (`app/models.py`)
To maintain a strict, immutable financial audit trail:
```python
class PlanPriceHistory(Base):
    """Immutable audit trail for pricing revisions."""
    __tablename__ = "plan_price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("plans.id", ondelete="CASCADE"), index=True, nullable=False)
    plan_code: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    old_price_monthly: Mapped[int] = mapped_column(Integer, nullable=False)
    new_price_monthly: Mapped[int] = mapped_column(Integer, nullable=False)
    old_price_yearly: Mapped[int] = mapped_column(Integer, nullable=False)
    new_price_yearly: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    reason: Mapped[str] = mapped_column(String(255), default="")
    changed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
```

### 3.3 Safe Database Migration Strategy
The application lifecycle in `app/main.py` (lines 60-70) executes `Base.metadata.create_all` and safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
We will add idempotent migration statements in the startup lifespan:
```sql
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS promotional_price_monthly INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS promotional_price_yearly INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS promo_badge VARCHAR(64);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
```
This ensures zero downtime and non-destructive application on both development and production PostgreSQL instances.

---

## 4. Backend API Design & Security Architecture

### 4.1 Public Pricing Endpoint (`GET /api/plans`)
- **Path:** `/api/plans`
- **Access:** Public (No authentication required)
- **Response Format:**
  ```json
  {
    "currency": "USD",
    "plans": [
      {
        "id": 1,
        "code": "start",
        "name": "START",
        "description": "Kichik do'konlar va yangi boshlagan tadbirkorlar uchun.",
        "price_monthly": 19,
        "price_yearly": 190,
        "currency": "USD",
        "is_featured": false,
        "promo_badge": null,
        "features": { ... },
        "limits": { ... }
      },
      {
        "id": 2,
        "code": "pro",
        "name": "PRO",
        "description": "Tez o'sayotgan Telegram do'konlar va faol savdo uchun.",
        "price_monthly": 59,
        "price_yearly": 590,
        "currency": "USD",
        "is_featured": true,
        "promo_badge": "ENG OMMABOP",
        "features": { ... },
        "limits": { ... }
      }
    ]
  }
  ```
- **Caching Headers:** `Cache-Control: public, max-age=60, stale-while-revalidate=300`.

### 4.2 Owner Pricing Management Endpoints (`/api/platform/plans`)
All endpoints protected by `require_platform_owner`.

1. **`GET /api/platform/plans`**:
   - Returns all plans (active, inactive, public, private) with active subscriber counts and pricing history.
2. **`POST /api/platform/plans`**:
   - Creates a new subscription tier with code validation, unique constraint check, and audit logging.
3. **`PUT /api/platform/plans/{plan_code}`**:
   - Updates plan prices, currency, limits, features, and visibility.
   - Accepts both `price_monthly` and `price_yearly`.
   - Records an entry in `plan_price_history` and `audit_logs`.
   - Invalidates cached public pricing responses.
4. **`PATCH /api/platform/plans/{plan_code}/visibility`**:
   - Toggles `is_public` and `is_active`.
5. **`POST /api/platform/plans/preview`**:
   - Simulates annual savings, percentage discounts, and currency conversions without modifying data.

### 4.3 Input Validation & Authorization Constraints
- Reject negative prices: `price_monthly >= 0`, `price_yearly >= 0`.
- Allowed currencies: `USD` and `UZS`.
- Ensure annual price does not exceed `12 * price_monthly`.
- Enforce that tenant administrators cannot access `/api/platform/*` endpoints.

---

## 5. Frontend Public Landing Page Integration

### 5.1 Architecture for `PricingSection.tsx`
- Replace the hardcoded `PRICING_PLANS_BY_LANG` loop with dynamic state:
  ```tsx
  const [plans, setPlans] = useState<DynamicPlan[]>(defaultVerifiedPlans);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/plans")
      .then(res => res.json())
      .then(data => {
        if (data.plans && data.plans.length > 0) {
          setPlans(data.plans);
        }
      })
      .catch(() => {
        // Graceful fallback to verified defaults
      });
  }, []);
  ```
- Pre-seed with verified production baseline values (`START = $19`, `PRO = $59`, `ULTRA = Kelishuv asosida`) so the page renders instantly without layout shifts (CLS = 0) even before the API returns.
- Eliminate raw `[NARX]` string completely.

---

## 6. Platform Owner Pricing Management Studio

### 6.1 Subtab `plans` in `PlatformOwnerTab.tsx`
Upgrade the existing rudimentary plan view into a full Pricing Management Studio:
1. **Plan Cards Matrix:**
   - Displays real-time database values for START, PRO, ULTRA, and any custom plans.
   - Shows active subscriber count and monthly recurring revenue (MRR) per tier.
   - Badges for `Public`, `Active`, `Popular`.
2. **Edit Plan Modal:**
   - Plan Name, Slug (Code), Description.
   - Monthly Price and Annual Price inputs with instant annual discount calculator (e.g. "Save 17%").
   - Currency Selector (`USD` / `UZS`).
   - Public Visibility toggle (`is_public`).
   - Feature checkboxes (AI Chat, AI Vision, Telegram Sync, Click/Payme, etc.).
   - Limit inputs (AI Messages quota, Team seats, Channel count).
3. **Price Revision History Table:**
   - Date & Time.
   - Plan Name.
   - Previous Price vs New Price.
   - Updated By (Owner name).
   - Reason / Notes.
4. **Safety & Confirmation Guard:**
   - Preview step showing how the pricing card will look on the public website before publishing.

---

## 7. User Dashboard & Subscription Integrity

1. **Dashboard `PricingTab.tsx`:**
   - Receives dynamic plans from `plansList` in `Dashboard.tsx`.
   - Reflects updated global pricing for new subscriptions or plan switches.
2. **Existing Subscriptions Protection:**
   - Subscriptions store a snapshot of their agreed terms in `subscriptions` table.
   - Changing global plan prices does NOT automatically charge existing active subscriptions higher rates without a dedicated migration flow.
3. **Onboarding Modal (`OnboardingModal.tsx`):**
   - Step 9 dynamically maps plans from `/api/plans`, ensuring new signups see the exact active tiers published by the Owner.

---

## 8. Cache & Consistency Strategy

1. **Backend Cache Invalidation:**
   - When the Owner updates a plan via `PUT /api/platform/plans/{code}`, an in-memory / Redis cache bust signal is executed.
2. **HTTP Cache Control:**
   - `/api/plans` returns `Cache-Control: public, max-age=60, s-maxage=120, stale-while-revalidate=300`.
   - Browsers revalidate within 60 seconds; CDN revalidates within 120 seconds.
3. **Frontend Immediate Optimistic Refresh:**
   - In the Owner Dashboard, updating a plan immediately refreshes local state and refetches `/api/plans` to confirm changes.

---

## 9. Risk Assessment & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Invalid price entry (negative or NaN) | Broken checkout / financial loss | Strict Pydantic validation on backend: `conint(ge=0)` |
| Currency mismatch (USD vs UZS) | Misleading price labels | Explicit currency field on plan, validated against allowed enum |
| Unauthorized price alteration | Malicious pricing tampering | `require_platform_owner` dependency strictly enforced on backend |
| Accidental plan deletion with active users | Database foreign key error or orphaned users | Foreign key `ondelete="RESTRICT"` prevents plan deletion if subscriptions exist |
| Stale pricing displayed to prospective customers | Conflicting pricing expectations | Short cache TTL (60s) with `stale-while-revalidate` |
| Zero network / offline fallback | Blank pricing section on landing | Verified baseline defaults embedded in frontend state |

---

## 10. Phase-by-Phase Execution Plan

### Phase 0: Audit & Architecture Specification (COMPLETED)
- Inspect existing models, APIs, and components.
- Formulate complete technical plan.
- **Zero code modified.**

### Phase 1: Database & Backend Implementation (Ready for Approval)
- Add columns to `Plan` model in `app/models.py`.
- Add `PlanPriceHistory` model in `app/models.py`.
- Add startup migration statements in `app/main.py`.
- Update `app/services/saas_service.py` to support dynamic plan creation and price history recording.
- Update `app/api/saas.py` `/api/plans` endpoint with filtering, sorting, and cache headers.
- Update `app/api/platform.py` with full Owner plan management endpoints (`GET`, `POST`, `PUT`, `PATCH`).

### Phase 2: Frontend Owner Dashboard Implementation
- Upgrade `PlatformOwnerTab.tsx` subtab `plans` with complete Pricing Management Studio (live data, edit modal, create modal, audit history).
- Fix payload key mismatch in `Dashboard.tsx` (`price_monthly` and `price_yearly`).

### Phase 3: Public Website & Dashboard Dynamic Integration
- Update `PricingSection.tsx` to fetch dynamic plans from `/api/plans` with verified fallback.
- Update `OnboardingModal.tsx` to use dynamic plans.
- Eliminate all remaining hardcoded `[NARX]` occurrences.

### Phase 4: Automated Verification & Security Testing
- Pytest suite covering Owner authorization, price updates, validation, and audit logging.
- Next.js TypeScript check and production build verification.
- Playwright browser test verifying Owner updates price -> public page displays new price.
