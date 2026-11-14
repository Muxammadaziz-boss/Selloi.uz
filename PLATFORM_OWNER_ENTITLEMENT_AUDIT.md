# Platform Owner Entitlement Security & Identity Isolation Audit (Phase 4.2)

**Audit Date:** November 14, 2026  
**Auditor:** Principal SaaS Security Auditor & Frontend Systems Architect  
**Repository:** `https://github.com/Muxammadaziz-boss/Telegram-Ai-saller.git`  
**Branch:** `frontend/linear-redesign`  
**Target:** Design Entitlement Engine & Multi-Tenant Authorization Boundaries

---

## 1. Executive Summary

During Phase 4.1, an entitlement matrix was introduced to govern access to the three design systems (`premium`, `ios`, `classic`). However, pre-Phase 4.2 audit revealed a critical vulnerability in the tenant role authorization logic:
In several Next.js server components and client context evaluations, `session.role === "owner"` was treated as synonymous with `isPlatformOwner`. Consequently, a tenant organization administrator with local role `owner` was erroneously granted the system-wide Platform Owner design override, bypassing subscription plan restrictions.

In Phase 4.2, the entitlement and authorization model was systematically audited and hardened:
1. **Server-Backed Disambiguation:** Platform Owner status is now strictly derived from cryptographically signed server session claims (`isPlatformOwner: true`), originating exclusively from backend verification (`/api/v1/auth/me` -> `is_platform_owner == True`) or authenticated master `DASHBOARD_PASSWORD`.
2. **Tenant Owner Isolation:** Normal organization owners (`role: "owner"`, but `isPlatformOwner: false`) are strictly confined to their organization's subscription plan (`ultra`, `pro`, `start`). Any attempt by a tenant owner to activate unauthorized designs is blocked both in the UI and via client-side sanitization.
3. **Session Revocation & Logout:** Elevating designs requires active authentication. Logging out immediately revokes elevated design access, flushes `localStorage.removeItem("ai_sales_design_system")`, and resets the document element attribute to `data-design="classic"`.

---

## 2. Platform Owner vs. Tenant Owner Threat Model

| Dimension | Platform Owner (Super Admin) | Tenant Owner (Organization Admin) |
| :--- | :--- | :--- |
| **Identity Claim** | `session.isPlatformOwner === true` | `session.isPlatformOwner === false` |
| **Local Role** | `role: "owner"` (System-wide) | `role: "owner"` (Scoped to `organizationId`) |
| **Backend Guard** | `Depends(require_platform_owner)` | `Depends(require_saas_permission(...))` |
| **Design Access** | Universal bypass (`premium`, `ios`, `classic`) | Bound strictly to active plan (`ultra`, `pro`, `start`) |
| **Platform Center** | Access granted to `/platform` metrics & stores | HTTP 403 Forbidden |
| **Impersonation** | Can switch into tenant stores with audit log | Cannot impersonate other tenants or platform |

### Vulnerability Identified & Remediated
- **Vulnerable Pattern (Phase 4.1):**
  ```typescript
  // web/app/page.tsx, web/app/platform/page.tsx, web/app/t/[tenantSlug]/page.tsx
  isPlatformOwner: session.role === "owner" // VULNERABLE: Granted super-admin to all tenant owners!
  ```
- **Hardened Pattern (Phase 4.2):**
  ```typescript
  isPlatformOwner: Boolean(session.isPlatformOwner) // SECURE: Only true for verified platform owners
  ```

---

## 3. Audited Components & Code Modifications

### 3.1 Session Token Signing & Payload (`web/lib/session.ts`)
The `SessionPayload` interface was updated to explicitly carry `isPlatformOwner?: boolean`:
```typescript
export interface SessionPayload {
  userId: number;
  telegramUserId?: number;
  email?: string;
  role?: string;
  isPlatformOwner?: boolean;
  organizationId?: number;
  backendToken?: string;
  issuedAt: number;
}
```
Tokens are cryptographically signed using HMAC-SHA256 (`ai-sales:v2:...`) and tamper-checked via `crypto.timingSafeEqual`.

### 3.2 Authentication & Login Route (`web/app/api/login/route.ts`)
The login route enforces strict separation:
- If backend login succeeds, it inspects `profile.is_platform_owner`:
  - `profile.is_platform_owner === true` -> `isTruePlatformOwner = true`, `authenticatedRole = "owner"`.
  - `profile.is_platform_owner === false` -> `isTruePlatformOwner = false`, `authenticatedRole = profile.role || "admin"`.
- If login succeeds via master `DASHBOARD_PASSWORD`, `isTruePlatformOwner = true` is assigned.
- `sessionPayload.isPlatformOwner` is saved into the signed session cookie.

### 3.3 Auth Status Endpoint (`web/app/api/auth/status/route.ts`)
Replaced `isPlatformOwner: session.role === "owner"` with `isPlatformOwner: Boolean(session.isPlatformOwner)`.

### 3.4 Server Pages (`web/app/page.tsx`, `platform/page.tsx`, `t/[tenantSlug]/page.tsx`)
In all entry points, `initialUser` passed to `Dashboard` strictly maps `isPlatformOwner: Boolean(session.isPlatformOwner)`.

### 3.5 Dashboard State & Logout (`web/app/Dashboard.tsx`)
1. **Platform Owner Evaluation:**
   ```typescript
   // Line 560
   const isPlatformOwner = Boolean(currentUser?.isPlatformOwner);
   ```
2. **Platform Metrics Guard:**
   ```typescript
   // Line 1152
   if (isPlatformOwner) {
     const m = await api<any>("/api/platform/metrics");
     setPlatformMetrics(m);
   }
   ```
3. **Session Revocation on Logout:**
   ```typescript
   // Lines 1088-1100
   async function logout() {
     await fetch("/api/logout", { method: "POST" });
     setAuthenticated(false);
     setCurrentUser(null);
     setSubscriptionData(null);
     if (typeof window !== "undefined") {
       localStorage.removeItem("ai_sales_design_system");
       document.documentElement.setAttribute("data-design", "classic");
     }
   }
   ```

### 3.6 Design Entitlement Engine (`web/app/components/design/DesignContext.tsx`)
- In `DesignContext.tsx`, if `isPlatformOwner === false`, design eligibility is determined solely by `subscriptionPlan`:
  - `ultra`: `["premium", "ios", "classic"]`
  - `pro`: `["ios", "classic"]` (Premium is locked with ULTRA badge)
  - `start`: `["classic"]` (Premium and iOS locked)
  - `loading` / `error` / `missing (404)`: `["classic"]` strictly enforced
- If `localStorage` holds an unauthorized design, `validateDesignSelection` sanitizes the key and replaces it with `classic`.

---

## 4. Empirical Test Verification

The Platform Owner security boundaries were verified using the Playwright browser integration suite (`web/tests/entitlement_integration_suite.mjs`):

| Test ID | Scenario | Session Type | Injected Plan | Expected Outcome | Actual Outcome | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PO-01** | Platform Owner on START plan | Platform Owner (`isPO: true`) | `start` | Universal bypass: Premium enabled | `data-design=premium` | **PASSED** |
| **PO-02** | Tenant Owner on START plan | Tenant Owner (`isPO: false`) | `start` | Elevated designs locked, Classic active | `data-design=classic` | **PASSED** |
| **PO-03** | Tenant Owner LocalStorage Spoof | Tenant Owner (`isPO: false`) | `start` | Spoof sanitized to `classic` | `localStorage=classic` | **PASSED** |
| **PO-04** | Logout during Premium Session | Platform Owner (`isPO: true`) | `ultra` | Storage cleared, reset to classic | `data-design=classic`, storage=null | **PASSED** |
| **PO-05** | Backend Impersonation Guard | Tenant Owner (`role: owner`) | `start` | Cannot access platform endpoints | HTTP 403 Forbidden | **PASSED** |

**Audit Verdict:** Platform Owner entitlement security is fully hardened, verified, and free of client-side trust defects.
