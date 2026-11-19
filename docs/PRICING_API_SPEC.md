# SELLOI.UZ : CENTRALIZED HYBRID DYNAMIC PRICING API SPECIFICATION (REVISION 1.1)

**Document Version:** 1.1.0 (Phase 0 Revision)  
**Status:** SPECIFICATION APPROVED FOR PHASE 1 REVIEW  
**Framework:** FastAPI 0.115 + Pydantic v2 + SQLAlchemy 2.0  
**Security Scopes:** Public Catalog, Authenticated Customer Quote, and Platform Owner Control Plane  
**Strict Prohibition:** Never trust client-submitted payable amounts. Zero floating-point math.  

---

## 1. Executive Summary & Security Scopes

This specification defines the complete RESTful API contract for the Selloi Hybrid Dynamic Pricing System.
The system enforces strict separation of responsibilities:
1. **Public Read-Only Catalog (`/api/plans`):** Fast, cached endpoint consumed by public landing pages (`https://selloi.uz/#tariflar`).
2. **Customer/Tenant Resolution Engine (`/api/pricing/checkout-quote`):** Server-authoritative endpoint resolving the payable amount for an authenticated organization, checking active customer offers first, then global rates.
3. **Owner Platform Control Plane (`/api/platform/pricing/*`, `/api/platform/plans*`, `/api/platform/customers/{customer_id}/pricing*`):** Restricted strictly to verified Platform Owners (`is_platform_owner == True`) for plan configuration, individual customer pricing assignments, and audit inspection.

### Authentication & Authorization Matrix

| Endpoint Group | Base Path | Authentication | Authorization Policy | Cache Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Public Catalog** | `/api/plans` | Optional / Anonymous | Public access | Cache-Control: max-age=60, stale-while-revalidate=300 |
| **Customer Quote** | `/api/pricing/checkout-quote` | JWT / Session Token | Authenticated Organization Member | Cache-Control: no-store, private |
| **Owner Global Plans** | `/api/platform/plans*` | JWT + Session Token | `require_platform_owner` (HTTP 403 otherwise) | Cache-Control: no-cache, must-revalidate |
| **Owner Customer Pricing** | `/api/platform/customers/{customer_id}/pricing*` | JWT + Session Token | `require_platform_owner` (HTTP 403 otherwise) | Cache-Control: no-store, private |
| **Owner Audit & History** | `/api/platform/pricing/history`, `/api/platform/pricing/audit-logs` | JWT + Session Token | `require_platform_owner` (HTTP 403 otherwise) | Cache-Control: no-store, private |

---

## 2. Public Pricing Endpoints

### 2.1. GET `/api/plans`
Retrieves all active and published global pricing plans for public presentation.

* **Method:** `GET`
* **Path:** `/api/plans`
* **Access:** Public (anonymous)
* **Response Cache:** 60s TTL; invalidated automatically when the Owner updates any plan.

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `currency` | string | No | `USD` | Preferred display currency (`USD` or `UZS`). |
| `billing_cycle` | string | No | `monthly` | Preferred billing cycle (`monthly` or `yearly`). |

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "currency": "USD",
  "billing_cycle": "monthly",
  "data": [
    {
      "id": 1,
      "code": "start",
      "name": "Start",
      "display_order": 1,
      "price_monthly": 1900,
      "price_yearly": 19000,
      "price_monthly_uzs": 24500000,
      "price_yearly_uzs": 245000000,
      "price_monthly_formatted": "$19",
      "price_yearly_formatted": "$190",
      "currency": "USD",
      "features": {
        "monthly_orders": 200,
        "max_products": 50,
        "team_seats": 1,
        "design_themes": ["classic"],
        "analytics_level": "basic",
        "custom_branding": false,
        "priority_support": false
      },
      "description": "Kichik do'konlar va yangi boshlovchi sotuvchilar uchun qulay start.",
      "is_popular": false,
      "is_public": true,
      "badge": null
    },
    {
      "id": 2,
      "code": "pro",
      "name": "Pro",
      "display_order": 2,
      "price_monthly": 5900,
      "price_yearly": 59000,
      "price_monthly_uzs": 76000000,
      "price_yearly_uzs": 760000000,
      "price_monthly_formatted": "$59",
      "price_yearly_formatted": "$590",
      "currency": "USD",
      "features": {
        "monthly_orders": 1500,
        "max_products": 500,
        "team_seats": 3,
        "design_themes": ["classic", "ios"],
        "analytics_level": "advanced",
        "custom_branding": true,
        "priority_support": true
      },
      "description": "Faol savdo qiluvchi o'rta bizneslar uchun kengaytirilgan imkoniyatlar.",
      "is_popular": true,
      "badge": "Eng ommabop"
    },
    {
      "id": 3,
      "code": "ultra",
      "name": "Ultra",
      "display_order": 3,
      "price_monthly": 14900,
      "price_yearly": 149000,
      "price_monthly_uzs": 192000000,
      "price_yearly_uzs": 1920000000,
      "price_monthly_formatted": "$149",
      "price_yearly_formatted": "$1490",
      "currency": "USD",
      "features": {
        "monthly_orders": 10000,
        "max_products": 5000,
        "team_seats": 10,
        "design_themes": ["classic", "ios", "premium"],
        "analytics_level": "enterprise",
        "custom_branding": true,
        "priority_support": true,
        "dedicated_manager": true
      },
      "description": "Yirik brendlar va korporativ savdo tarmoqlari uchun cheksiz quvvat.",
      "is_popular": false,
      "badge": "Maksimal imkoniyat"
    }
  ]
}
```

---

## 3. Customer/Tenant Authoritative Pricing Engine

### 3.1. GET `/api/pricing/checkout-quote`
Server-authoritative calculation of the payable rate for an authenticated tenant.
Applies the **Pricing Resolution Engine Hierarchy**:
1. Checks for an active, valid `CustomerPricing` record for `(customer_id, plan_id, billing_interval)`.
2. If none, falls back to the published global plan price in `plans`.
3. Verifies that the effective price is non-negative and locks the calculated quote.

* **Method:** `GET`
* **Path:** `/api/pricing/checkout-quote`
* **Access:** Authenticated Organization Member (`Authorization: Bearer <jwt>`)

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `plan_code` | string | Yes | Target plan code: `start`, `pro`, `ultra`. |
| `interval` | string | Yes | Billing interval: `monthly` or `yearly`. |
| `currency` | string | No | Target currency: `USD` (default) or `UZS`. |

#### Successful Response with Active CustomerPricing Discount (`200 OK`)
```json
{
  "customer_id": 42,
  "customer_name": "Silk Road Apparel",
  "plan": {
    "id": 2,
    "code": "pro",
    "name": "Pro"
  },
  "billing_interval": "monthly",
  "currency": "USD",
  "quote": {
    "catalog_base_price_cents": 5900,
    "catalog_base_price_formatted": "$59.00",
    "effective_price_cents": 4130,
    "effective_price_formatted": "$41.30",
    "discount_applied": true,
    "discount_details": {
      "pricing_id": 14,
      "discount_type": "percentage",
      "discount_value": 30,
      "discount_amount_cents": 1770,
      "starts_at": "2026-11-01T00:00:00Z",
      "expires_at": "2026-12-31T23:59:59Z",
      "notes": "Yillik strategik hamkorlik kelishuvi"
    },
    "tax_amount_cents": 0,
    "total_due_cents": 4130,
    "total_due_formatted": "$41.30",
    "quote_expires_at": "2026-11-20T19:00:00Z"
  }
}
```

---

## 4. Platform Owner CustomerPricing Management

Allows the Platform Owner to create, list, and revoke individual pricing terms for specific tenant organizations.
Protected strictly by `require_platform_owner`. Non-owners receive `HTTP 403 Forbidden`.

### 4.1. GET `/api/platform/customers/{customer_id}/pricing`
Lists all individual customer pricing records for a specified customer organization.

* **Method:** `GET`
* **Path:** `/api/platform/customers/{customer_id}/pricing`
* **Access:** Platform Owner Only

#### Successful Response (`200 OK`)
```json
{
  "customer_id": 42,
  "customer_name": "Silk Road Apparel",
  "pricing_records": [
    {
      "id": 14,
      "customer_id": 42,
      "plan_id": 2,
      "plan_code": "pro",
      "billing_interval": "monthly",
      "currency": "USD",
      "discount_type": "percentage",
      "discount_value": 30,
      "starts_at": "2026-11-01T00:00:00Z",
      "expires_at": "2026-12-31T23:59:59Z",
      "status": "active",
      "created_by_id": 1,
      "notes": "Yillik strategik hamkorlik kelishuvi",
      "created_at": "2026-10-30T10:00:00Z",
      "updated_at": "2026-10-30T10:00:00Z"
    }
  ]
}
```

---

### 4.2. POST `/api/platform/customers/{customer_id}/pricing`
Creates a new customer-specific pricing agreement for a tenant organization.
Enforces the **Anti-Stacking Rule:** If an active offer already exists for the same customer, plan, and interval, it must be superseded or revoked.

* **Method:** `POST`
* **Path:** `/api/platform/customers/{customer_id}/pricing`
* **Access:** Platform Owner Only

#### Request Body
```json
{
  "plan_code": "ultra",
  "billing_interval": "monthly",
  "currency": "USD",
  "discount_type": "custom_price",
  "discount_value": 9900,
  "starts_at": "2026-12-01T00:00:00Z",
  "expires_at": "2027-11-30T23:59:59Z",
  "notes": "VIP chakana tarmog'i bilan maxsus shartnoma",
  "supersede_existing": true
}
```

#### Validation & Security Constraints
1. `discount_type` must be strictly one of: `'percentage'`, `'fixed_amount'`, `'custom_price'`.
2. If `discount_type == 'percentage'`, `discount_value` must be between `1` and `100`.
3. If `discount_type == 'custom_price'` or `'fixed_amount'`, `discount_value` must be an integer minor unit > 0.
4. `expires_at` must be strictly after `starts_at`.
5. `customer_id` must reference an existing, active `Organization`.
6. `created_by_id` is automatically extracted from the authenticated user token and verified to have `is_platform_owner == True`.

#### Successful Response (`201 Created`)
```json
{
  "success": true,
  "message": "Mijoz uchun individual narx muvaffaqiyatli belgilandi.",
  "pricing_id": 19,
  "customer_id": 42,
  "plan_code": "ultra",
  "effective_price_formatted": "$99.00 / oy",
  "status": "active"
}
```

#### Error Responses
* **`400 Bad Request`:** Invalid discount values or `expires_at <= starts_at`.
* **`403 Forbidden`:** Authenticated caller is not a Platform Owner.
* **`404 Not Found`:** Customer organization or plan code does not exist.
* **`409 Conflict`:** Conflicting active offer already exists and `supersede_existing` was not set to `true`.

---

### 4.3. DELETE `/api/platform/customers/{customer_id}/pricing/{pricing_id}`
Revokes an individual customer pricing agreement. Future renewals automatically revert to the standard global catalog price.

* **Method:** `DELETE`
* **Path:** `/api/platform/customers/{customer_id}/pricing/{pricing_id}`
* **Access:** Platform Owner Only

#### Request Body
```json
{
  "revocation_reason": "Mijoz bilan shartnoma muddati tugadi yoki qayta ko'rib chiqildi"
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "message": "Individual narx bekor qilindi. Keyingi hisob-kitoblar standart global tarif bo'yicha amalga oshiriladi.",
  "pricing_id": 14,
  "status": "revoked"
}
```

---

## 5. Platform Owner Global Plan Management

### 5.1. GET `/api/platform/plans`
Returns all global plans including unpublished, archived, and draft plans, with active subscriber counts.

* **Method:** `GET`
* **Path:** `/api/platform/plans`
* **Access:** Platform Owner Only

---

### 5.2. POST `/api/platform/plans`
Creates a new global pricing tier.

* **Method:** `POST`
* **Path:** `/api/platform/plans`
* **Access:** Platform Owner Only

#### Request Body
```json
{
  "code": "scale",
  "name": "Scale Enterprise",
  "display_order": 4,
  "price_monthly": 29900,
  "price_yearly": 299000,
  "price_monthly_uzs": 38500000,
  "price_yearly_uzs": 385000000,
  "currency": "USD",
  "is_active": true,
  "is_public": true,
  "description": "Tez kengayayotgan korporativ bizneslar uchun maxsus plan.",
  "features": {
    "monthly_orders": 50000,
    "max_products": 25000,
    "team_seats": 25,
    "design_themes": ["classic", "ios", "premium"]
  }
}
```

---

### 5.3. PUT `/api/platform/plans/{code}`
Updates an existing global plan.
**Strict Rule:** When prices change:
1. Automatically snapshots the new price in `plan_price_history`.
2. Existing subscriber `locked_price` values in `subscriptions` remain completely unchanged.
3. Invalidates public `/api/plans` cache.

* **Method:** `PUT`
* **Path:** `/api/platform/plans/{code}`
* **Access:** Platform Owner Only

---

### 5.4. PATCH `/api/platform/plans/{code}/status`
Toggles publication visibility (`is_public`) or operational activation (`is_active`).

* **Method:** `PATCH`
* **Path:** `/api/platform/plans/{code}/status`
* **Access:** Platform Owner Only

---

## 6. Simulation & Audit Log Endpoints

### 6.1. POST `/api/platform/pricing/preview-resolution`
Dry-run simulator that computes the exact payable charge for a customer without modifying the database or creating invoices.

* **Method:** `POST`
* **Path:** `/api/platform/pricing/preview-resolution`
* **Access:** Platform Owner Only

#### Request Body
```json
{
  "customer_id": 42,
  "plan_code": "pro",
  "interval": "monthly",
  "currency": "USD",
  "simulation_date": "2026-11-20T00:00:00Z"
}
```

#### Successful Response (`200 OK`)
```json
{
  "simulation": {
    "customer_id": 42,
    "customer_name": "Silk Road Apparel",
    "plan_code": "pro",
    "interval": "monthly",
    "currency": "USD",
    "catalog_base_price": 5900,
    "resolution_applied": "individual_customer_pricing",
    "matched_pricing": {
      "pricing_id": 14,
      "discount_type": "percentage",
      "discount_value": 30
    },
    "calculation_trace": [
      "1. Global monthly catalog price: $59.00 (5900 cents)",
      "2. Active CustomerPricing #14 matched: 30% discount",
      "3. Calculated discount: $17.70 (1770 cents)",
      "4. Final computed charge: $41.30 (4130 cents)"
    ],
    "final_charge_cents": 4130,
    "final_charge_formatted": "$41.30"
  }
}
```

---

### 6.2. GET `/api/platform/pricing/history`
Retrieves historical global pricing modifications from `plan_price_history`.

---

### 6.3. GET `/api/platform/pricing/audit-logs`
Administrative audit trail for all pricing activities (global updates, customer pricing assignments, revocations).

---

## 7. Standard Error Structure

```json
{
  "success": false,
  "error": {
    "code": "CUSTOMER_PRICING_ACTIVE_CONFLICT",
    "message": "Ushbu mijoz uchun ushbu tarif va interval bo'yicha faol individual narx allaqachon mavjud.",
    "details": {
      "existing_pricing_id": 14,
      "resolution": "Yangi individual narxni kuchga kiritish uchun 'supersede_existing: true' parametrini yuboring."
    }
  }
}
```
