# DESIGN SYSTEM ENTITLEMENT & ACCESS CONTROL MATRIX

**Project:** Telegram AI Sales Control Center  
**Repository:** `https://github.com/Muxammadaziz-boss/Telegram-Ai-saller.git`  
**Branch:** `frontend/linear-redesign`  
**Date:** November 14, 2026  
**Status:** **ACTIVE & ENFORCED**  

---

## 1. Plan-Based Entitlement Matrix

The Telegram AI Sales Control Center enforces a strict three-tier design system access policy based on the organization's active backend subscription plan:

| Subscription Tier | Code | Premium Design | iOS Design | Classic Design | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **ULTRA** | `ultra` | **YES** | **YES** | **YES** | Full access to all three visual design systems. |
| **PRO** | `pro` | **NO** (Locked) | **YES** | **YES** | Access to iOS and Classic; Premium requires ULTRA. |
| **START / STANDARD** | `start` / `standard` | **NO** (Locked) | **NO** (Locked) | **YES** | Baseline enterprise standard design system only. |
| **Platform Owner** | `owner` | **YES** | **YES** | **YES** | Master admin override; unrestricted access across all designs. |

---

## 2. Enforcement Architecture

### 2.1 Backend Contract Preservation
In strict accordance with the non-negotiable rule ("DO NOT rewrite backend or change existing API endpoints"), the subscription tier is retrieved directly from the existing SaaS endpoint:
- **Endpoint:** `GET /api/saas/subscription`
- **Response Property:** `plan.code` (`"start"`, `"pro"`, `"ultra"`)
- **Master Admin Session:** Sourced securely via `isPlatformOwner` from `/api/login` session state.

### 2.2 Client-Side Entitlement Engine (`web/app/lib/design-entitlements.ts`)
The core validation rules are codified as pure, testable functions:

```typescript
export function getAvailableDesigns(plan: SubscriptionPlanCode, isPlatformOwner: boolean = false): DesignSystemId[] {
  if (isPlatformOwner) {
    return ["premium", "ios", "classic"];
  }
  switch (plan) {
    case "ultra":
      return ["premium", "ios", "classic"];
    case "pro":
      return ["ios", "classic"];
    case "start":
    case "standard":
    default:
      return ["classic"];
  }
}

export function canUseDesign(design: DesignSystemId, plan: SubscriptionPlanCode, isPlatformOwner: boolean = false): boolean {
  return getAvailableDesigns(plan, isPlatformOwner).includes(design);
}

export function getFallbackDesign(plan: SubscriptionPlanCode, isPlatformOwner: boolean = false): DesignSystemId {
  const available = getAvailableDesigns(plan, isPlatformOwner);
  return available[0] || "classic";
}

export function validateDesignSelection(
  requestedDesign: string | null | undefined,
  plan: SubscriptionPlanCode,
  isPlatformOwner: boolean = false
): DesignSystemId {
  if (requestedDesign && isValidDesignId(requestedDesign) && canUseDesign(requestedDesign, plan, isPlatformOwner)) {
    return requestedDesign;
  }
  return getFallbackDesign(plan, isPlatformOwner);
}
```

---

## 3. Anti-Spoofing & Downgrade Protection

### 3.1 LocalStorage Tampering Defense
If a malicious user on a `start` or `pro` plan directly manipulates browser storage:
```javascript
localStorage.setItem("preferred_design_system", "premium");
```
Upon the next render or page refresh:
1. `validateDesignSelection()` inspects the requested ID against active `getAvailableDesigns(plan, isPlatformOwner)`.
2. The unauthorized selection fails `canUseDesign()`.
3. The engine automatically sanitizes state and reverts to `getFallbackDesign()` (`"classic"` for `start`, `"ios"` for `pro`).
4. `localStorage` is overwritten with the legitimate fallback design, completely neutralizing client-side privilege spoofing.

### 3.2 Subscription Downgrade Recovery
When a tenant on `ultra` downgrades to `start`:
1. The new subscription data is received by `DesignProvider`.
2. The current design (`"premium"`) is re-evaluated.
3. Because `"premium"` is no longer permitted under `start`, `DesignContext` immediately switches `design` to `"classic"`.
4. `document.documentElement.setAttribute("data-design", "classic")` executes synchronously.

---

## 4. UI Interaction & Upgrade Modal (`DesignSelector.tsx`)

In the **Profile & Appearance** tab:
1. Each design card displays an entitlement badge:
   - **PREMIUM:** `ULTRA ONLY`
   - **IOS:** `PRO / ULTRA`
   - **CLASSIC:** `STANDART (ALL)`
2. If the user's plan permits the design:
   - Clicking the card instantly activates the design system.
   - A green `FaCheck` active indicator appears.
3. If the design is locked for the current plan:
   - The card displays a padlock icon (`FaLock`).
   - Clicking the card **does not** activate the design.
   - Instead, it dispatches the `DesignUpgradeModal`, showing:
     - Target plan required (e.g. ULTRA for Premium).
     - Key visual & productivity features of the selected design system.
     - Direct CTA: `"Rejani Yangilash"` (Upgrade Plan) which immediately navigates the user to `#billing`.

---

## 5. Verification Test Evidence

The entitlement logic was rigorously tested using an automated Node.js test harness:
`node --experimental-strip-types web/tests/design_entitlement_suite.mjs`

### Test Output Summary:
```
==================================================================
DESIGN SYSTEM ENTITLEMENT & ACCESS CONTROL TEST SUITE
==================================================================
[PASSED] ULTRA plan: getAvailableDesigns returns all 3 designs
[PASSED] ULTRA plan: canUseDesign returns true for 'premium'
[PASSED] ULTRA plan: canUseDesign returns true for 'ios'
[PASSED] ULTRA plan: canUseDesign returns true for 'classic'
[PASSED] ULTRA plan: getFallbackDesign returns 'premium'
[PASSED] ULTRA plan: validateDesignSelection('premium') returns 'premium'
[PASSED] ULTRA plan: validateDesignSelection('ios') returns 'ios'
[PASSED] ULTRA plan: validateDesignSelection('classic') returns 'classic'
[PASSED] PRO plan: getAvailableDesigns returns ['ios', 'classic']
[PASSED] PRO plan: canUseDesign returns false for 'premium'
[PASSED] PRO plan: canUseDesign returns true for 'ios'
[PASSED] PRO plan: canUseDesign returns true for 'classic'
[PASSED] PRO plan: getFallbackDesign returns 'ios'
[PASSED] PRO plan: validateDesignSelection('premium') returns fallback 'ios'
[PASSED] PRO plan: validateDesignSelection('ios') returns 'ios'
[PASSED] PRO plan: validateDesignSelection('classic') returns 'classic'
[PASSED] START/STANDARD plan: getAvailableDesigns returns ['classic']
[PASSED] START/STANDARD plan: canUseDesign returns false for 'premium'
[PASSED] START/STANDARD plan: canUseDesign returns false for 'ios'
[PASSED] START/STANDARD plan: canUseDesign returns true for 'classic'
[PASSED] START/STANDARD plan: getFallbackDesign returns 'classic'
[PASSED] START/STANDARD plan: validateDesignSelection('premium') returns 'classic'
[PASSED] START/STANDARD plan: validateDesignSelection('ios') returns 'classic'
[PASSED] START/STANDARD plan: validateDesignSelection('classic') returns 'classic'
[PASSED] Platform Owner: has access to all designs regardless of plan
[PASSED] Invalid design IDs gracefully fallback to valid design
[PASSED] Null or undefined inputs safely fallback to valid design

==================================================================
ENTITLEMENT SUITE SUMMARY: 27/27 PASSED (0 failed)
STATUS: PASSED
==================================================================
```
