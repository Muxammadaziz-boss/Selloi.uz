# Selloi.uz: Premium Design Transformation Master Plan

> **Design Direction:** Direction C: Adaptive Commercial SaaS  
> **Framework:** Design Analyst & Enhancer (Approval Mode)  
> **Target:** `https://selloi.uz/`  
> **Document Status:** PROPOSAL / AWAITING APPROVAL GATE 1  
> **Date:** November 19, 2026  

---

## 1. Executive Vision & Objectives

Selloi is evolving from an early-stage AI chatbot appearance into an authoritative, world-class AI Commerce Operating System for Telegram stores.

### Core Transformation Tenets
1. **Linear-Grade Clarity:** Calm, dark foundation (`#090909`), 1px precision borders (`#292929`), restrained elevation.
2. **Raycast-Level Polish:** Micro-interactions, crisp focus rings, mechanical smoothness, zero decorative fluff.
3. **Harmonized Brand Identity:** Signature Selloi Bronze Gold (`#E6A15A`) unifies primary high-intent actions, deprecating arbitrary electric-purple CTAs.
4. **Authentic Commercial Transparency:** Accurate verified pricing (eliminating `[NARX]`), realistic Uzbek retail mockups (resolving duplicated labels), and seamless responsive navigation across all screen sizes.
5. **Preservation of Core Assets:** The desktop Hero Telegram simulation is proven to communicate value in under 3 seconds; it will be protected and refined, never discarded.

---

## 2. Phase 0: Current State Revalidation

### 2.1 Revalidated Live Audit Findings
The live browser audit conducted on `https://selloi.uz/` scored the platform **73 / 100** (Grade: B-). Empirical revalidation against the current repository state confirms:

| Finding ID | Audit Finding | Live Status | Root Cause in Code | Severity |
|---|---|---|---|---|
| **ISS-01** | Raw `[NARX]` placeholder in Start and Pro pricing cards | **Verified Live** | `web/app/components/landing/data.ts` lines 407, 408, 427, 428 hardcoded as `"[NARX]"` | **CRITICAL** |
| **ISS-02** | Duplicated labels in Smart Order demo card (`Mahsulot: Mahsulot:`, `Mijoz: Mijoz:`) | **Verified Live** | `web/app/components/landing/StorytellingSection.tsx` lines 486-487 prints both static label and `story.stage3ItemLabel` | **CRITICAL** |
| **ISS-03** | Tablet navigation disappears at 768px (no links, no hamburger menu) | **Verified Live** | `web/app/components/landing/Header.tsx` breakpoint mismatch: nav is `d-lg-flex` (>=992px) while hamburger is `d-md-none` (hidden >=768px) | **HIGH** |
| **ISS-04** | Dual accent clash (Bronze Gold `#E6A15A` vs. Electric Purple `#4f46e5`) | **Verified Live** | Primary CTA classes use Bootstrap/indigo overrides instead of Selloi design tokens | **HIGH** |
| **ISS-05** | Windows OS font degrades to default `Segoe UI` | **Verified Live** | Font stack starts with `-apple-system, BlinkMacSystemFont, "Segoe UI"`, lacking self-hosted `Geist` or `Inter` | **HIGH** |
| **ISS-06** | Mobile hero chat mockup pushed 100% below the fold | **Verified Live** | Vertical stack on `< 576px` pushes image container past 812px height | **MEDIUM** |
| **ISS-07** | 32 interactive touch targets smaller than 44px recommended size | **Verified Live** | Header nav links (32px), language switch (35px), tabs (38px) lack touch padding | **MEDIUM** |
| **ISS-08** | Broken testimonial label `TO'LQONING: Do'kon` | **Verified Live** | `web/app/components/landing/data.ts` quotes lack natural store owner attribution | **LOW** |

### 2.2 Unaffected Core Systems
- Backend database schema, SaaS plans, and multi-tenant isolation remain completely untouched.
- Authentication endpoints, Telegram bot webhooks, and payments remain untouched.
- Dashboard application components remain untouched.

---

## 3. Phase 1: Critical Conversion Fixes (Ready for Approval Gate 1)

Phase 1 focuses exclusively on high-impact conversion bugs and layout defects without altering visual design tokens or brand styles.

### Component 1: Pricing Section Transparency (Fix ISS-01)
- **Target File:** `web/app/components/landing/data.ts`
- **Verified Source Data:** 
  In `app/services/saas_service.py` (lines 35-143) and `docs/saas-audit/10_PRICING_AND_UNIT_ECONOMICS.md`:
  - **START Plan:** `$19 / oy` (Annual: `$190 / yil`, 2 months free equivalent to `$15.83 / oy`)
  - **PRO Plan:** `$59 / oy` (Annual: `$590 / yil`, 2 months free equivalent to `$49.16 / oy`)
  - **ULTRA Plan:** `Kelishuv asosida` (Enterprise custom terms)
- **Proposed Pricing Display Options (Presented for User Selection in Gate 1):**
  - **Option A (USD Official):** `$19` and `$59` (Matches backend SaaS plan definitions).
  - **Option B (UZS Localized):** `240,000 so'm` and `750,000 so'm` (Matches current Uzbekistan commercial SaaS norms at ~12,800 UZS/USD).
  - **Option C (Dual Format):** `$19 (~240,000 so'm)` and `$59 (~750,000 so'm)`.

### Component 2: Smart Order Demo Fidelity (Fix ISS-02)
- **Target Files:**
  - `web/app/components/landing/landingContent.ts`
  - `web/app/components/landing/StorytellingSection.tsx`
- **Proposed Change:**
  Add explicit value keys in `landingContent.ts`:
  ```ts
  stage3ItemValue: "Air Runner Pro (42)",
  stage3CustomerValue: "Alisher N.",
  stage3AddressValue: "Toshkent sh., Chilonzor 9",
  stage3PaymentValue: "Click (360,000 UZS)",
  ```
  Update `StorytellingSection.tsx` to render labels on the left and values on the right:
  ```tsx
  <div className="d-flex justify-content-between">
    <span style={{ color: "var(--s-text-muted)" }}>Mahsulot:</span>
    <span className="text-white fw-medium">{story.stage3ItemValue}</span>
  </div>
  ```

### Component 3: Tablet 768px Navigation Continuity (Fix ISS-03)
- **Target File:** `web/app/components/landing/Header.tsx`
- **Proposed Change:**
  Align breakpoint thresholds so that on tablet screens (768px to 991px), the hamburger menu is visible and allows full section navigation:
  ```tsx
  {/* Change d-md-none to d-lg-none so tablet displays the hamburger menu */}
  <div className="d-flex d-lg-none align-items-center gap-2">
    ...
  </div>
  ```

---

## 4. Phase Roadmap Overview

```
+-------------------------------------------------------------------+
| PHASE 0: Revalidation & Discovery (COMPLETED)                     |
| - Live site inspection, Playwright screenshots, verified scores  |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| PHASE 1: Critical Conversion Fixes (AWAITING APPROVAL GATE 1)    |
| - Pricing [NARX] resolution, mock data repair, tablet navigation  |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| PHASE 2: Design System & Token Refinement (APPROVAL GATE 2)       |
| - Direction C tokens, Bronze Gold unification, Geist typography   |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| PHASE 3: Page Composition & Asymmetric Bento Layouts (GATE 3)     |
| - Hero mobile elevation, Bento feature grid, connected timeline   |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| PHASE 4: Motion & Micro-Interactions                              |
| - Controlled transitions, prefers-reduced-motion, demo polish     |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| PHASE 5: Comprehensive Responsive & Accessibility Verification    |
| - 5 viewports re-scan, Axe-Core WCAG AA zero violation audit      |
+-------------------------------------------------------------------+
```

---

## 5. Approval Gate 1 Presentation

**Action Required from Project Owner:**
Please review the proposed Phase 1 changes and confirm:
1. Preferred Pricing Presentation (USD `$19/$59`, UZS `240,000/750,000 so'm`, or Dual).
2. Approval to apply Phase 1 modifications to `web/app/components/landing/` files.
