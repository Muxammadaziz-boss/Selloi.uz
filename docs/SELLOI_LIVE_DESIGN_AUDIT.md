# Selloi.uz: Live Website Visual & UX Design Audit

> **Conducted by:** Principal Product Designer, Senior UI/UX Auditor & Design Systems Architect  
> **Framework:** Design Analyst & Enhancer (100-Point Analytical Intelligence Methodology)  
> **Target:** `https://selloi.uz/`  
> **Audit Date:** November 19, 2026  
> **Evaluation Mode:** Real Browser Inspection (Google Chrome via Playwright Automation)  
> **Governance:** Analysis Only (Zero Code/CSS Modifications Executed)  

---

## 1. Executive Summary

A comprehensive, browser-first visual, UX, and accessibility audit was executed against the live production deployment of **Selloi.uz** (`https://selloi.uz/`) across 5 responsive viewports (Desktop 1440x900, Desktop 1920x1080, Tablet 768x1024, Mobile 375x812, Mobile 390x844).

The website currently exhibits a strong visual foundation: a modern dark aesthetic, high contrast ratios (0 automated WCAG AA violations on live scan), responsive reflow without horizontal scrollbars, and interactive simulated Telegram chat components.

However, the audit identified critical UX, conversion, and visual inconsistencies that prevent Selloi from achieving true tier-one international SaaS status:
1. **Critical Placeholder Pricing:** The Start and Pro pricing tier cards literally render unreplaced template strings `[NARX] so'm / oyiga`, preventing prospects from seeing actual prices.
2. **Broken Mockup Content:** The third interactive card in the workflow section renders duplicated labels (`Mahsulot: Mahsulot:`, `Mijoz: Mijoz:`) instead of mock order details.
3. **Tablet Navigation Breakage:** At 768px viewport width, desktop navigation links are hidden via media queries, but no mobile hamburger menu is displayed, leaving tablet users unable to navigate to anchor sections.
4. **Dual Accent Palette Clash:** Warm Selloi Bronze Gold (`#E6A15A`) is used for category badges and heading spans, while primary CTAs use discordant Electric Indigo/Blue (`#4f46e5` / `#6366f1`).
5. **System Font Degradation on Windows:** The font stack falls back to standard `Segoe UI` on Windows operating systems instead of rendering the intended bespoke `Geist` or `Inter` geometric typography.

**Overall Design Score:** **73 / 100** (Solid Emerging SaaS, Requires Polish for Enterprise/Premium Tier)

---

## 2. Skill Activation Confirmation

| Parameter | Configuration Value | Status |
|---|---|---|
| **Skill Name** | `design-analyst-enhancer` | **ACTIVATED** |
| **Skill Location** | `C:\Users\Administrator\Skill creator\.agents\skills\design-analyst-enhancer\` | **VERIFIED** |
| **Governance Mode** | Approval-First Autonomy (Inspection & Analysis Only) | **COMPLIANT** |
| **Design Scope** | All (Landing, Navigation, Hero, Components, Pricing, Mobile) | **COVERED** |
| **Design Style** | Adaptive (Tailored to Uzbek Telegram Commerce) | **APPLIED** |
| **Inspection Tools** | Real Google Chrome Browser, Playwright Engine, Axe-Core WCAG Scanner | **UTILIZED** |

---

## 3. Real Browser Inspection Evidence & Viewport Coverage

The audit was conducted on live rendered HTML/CSS in Google Chrome. All visual artifacts, full-page screenshots, and section captures were stored locally and mirrored to the artifact repository.

### Viewport Matrix

| Viewport | Dimensions | Orientation | Rendering Status | Key Observations |
|---|---|---|---|---|
| **Desktop Standard** | 1440 x 900 | Landscape | **Rendered** | Clean 2-column hero, sticky header with blur, high contrast, balanced white space. |
| **Desktop Large** | 1920 x 1080 | Landscape | **Rendered** | Max-width container prevents over-stretching; background gradients center well. |
| **Tablet Portrait** | 768 x 1024 | Portrait | **Defect Identified** | Desktop nav links hidden, but hamburger menu missing. Navigation unreachable. |
| **Mobile Standard** | 375 x 812 | Portrait | **Rendered** | Hamburger menu active, hero chat mockup pushed below fold, buttons stacked. |
| **Mobile Modern** | 390 x 844 | Portrait | **Rendered** | High readability, clean card stacking, bottom CTA accessible. |

### Captured Visual Evidence

- [Desktop 1440x900 Above Fold](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/desktop_1440x900_above_fold.png)
- [Desktop 1440x900 Full Page](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/desktop_1440x900_full_page.png)
- [Desktop 1920x1080 Full Page](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/desktop_1920x1080_full_page.png)
- [Tablet 768x1024 Above Fold & Language Menu](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/tablet_768x1024_menu_open.png)
- [Mobile 375x812 Above Fold](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/mobile_375x812_above_fold.png)
- [Mobile 375x812 Full Page](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/mobile_375x812_full_page.png)
- [Interactive Demo State (Tab 03 Highlight)](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/interaction_demo_clicked.png)
- [Interactive FAQ State (Item 2 Expanded)](file:///d:/Ishchi%20stoli/proyekt/Telegram%20ai%20agent/docs/audit_screenshots/interaction_faq_expanded.png)

---

## 4. Nine-Category Design Intelligence Scorecard

```
+---------------------------------------------------------------+
|                      DESIGN SCORECARD                         |
|                                                               |
|  Visual Hierarchy       [11 / 15]  ███████████░░░░            |
|  Layout & Composition   [11 / 15]  ███████████░░░░            |
|  Typography             [ 7 / 10]  ███████░░░                 |
|  Color System           [ 8 / 10]  ████████░░                 |
|  Spacing & Alignment    [ 8 / 10]  ████████░░                 |
|  UX & Usability         [ 9 / 15]  █████████░░░░░░            |
|  Responsive Design      [ 7 / 10]  ███████░░░                 |
|  Accessibility (WCAG)   [ 8 / 10]  ████████░░                 |
|  Design Consistency     [ 4 /  5]  ████░                      |
|                                                               |
|  TOTAL DESIGN SCORE:    [73 / 100] GRADE: B- (Solid / Polish) |
+---------------------------------------------------------------+
```

### Detailed Score Justifications

#### 1. Visual Hierarchy: 11 / 15
- **Strengths:** The Hero Section has a strong, unambiguous primary focal point: the large headline and the high-fidelity Telegram chat window mockup. Primary CTA is immediately identifiable.
- **Weaknesses:** Below the hero, every section repeats an identical vertical composition: center-aligned pill tag with sparkle emoji (`✨`) -> large heading with 2 words in gold gradient -> subtitle -> 3 identical dark rectangular cards. Without variation in scale, density, or asymmetrical composition, visual fatigue sets in by the third section.

#### 2. Layout & Composition: 11 / 15
- **Strengths:** Strict container max-widths, well-balanced left-right symmetry in the hero, and clean 3-column card reflow.
- **Weaknesses:** Section rhythm is predictable and repetitive. The page feels excessively tall because every single feature is given an identical card container rather than using inline interactive widgets, split showcases, or asymmetric editorial layouts.

#### 3. Typography: 7 / 10
- **Strengths:** Excellent contrast, high legibility, clean letter-spacing on uppercase category tags.
- **Weaknesses:** 
  1. The live CSS font stack begins with `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter`. On Windows platforms (the majority of desktop users in Central Asia), the browser falls back directly to default `Segoe UI`, losing the crisp geometric personality of `Geist` or `Inter`.
  2. Fractional font sizes (`14.72px`, `13.12px`, `14.08px`) indicate uncalibrated rem/em scaling or inherited bootstrap rem calculations rather than an intentional 4px/8px typographic modular scale.

#### 4. Color System: 8 / 10
- **Strengths:** Rich dark background (`#09090b` canvas), clean surface elevation (`#111113`, `#18181b`), subtle borders (`#27272a`).
- **Weaknesses:** **Dual Accent Disconnect.** Selloi's brand accent is warm Bronze Gold (`#E6A15A`), which is used effectively for heading emphasis, active tabs, and category badges. However, the primary CTA buttons (`7 kun bepul sinab ko'rish`, `Do'kon ochish`) use vibrant Electric Indigo/Purple (`#4f46e5` / `#6366f1`). This creates an aesthetic clash between warm luxury commerce and cold generic tech SaaS.

#### 5. Spacing & Alignment: 8 / 10
- **Strengths:** Consistent vertical section margins (80px to 100px), uniform card gutters (16px to 24px), alignment of button rows.
- **Weaknesses:** Some card interiors have inconsistent padding (e.g. 16px horizontal vs 24px vertical), causing mock chat bubbles to sit close to card borders while leaving excessive empty space at the bottom.

#### 6. UX & Usability: 9 / 15
- **Strengths:** Clear value proposition, fast perceived loading (510ms), working scroll-spy that highlights active navigation links as the user scrolls.
- **Weaknesses (Critical Severity):**
  1. **Placeholder Pricing `[NARX]`:** Visitors evaluating the Start and Pro tiers cannot see what the software costs.
  2. **Duplicated Field Labels in Card 3:** `Mahsulot: Mahsulot:`, `Mijoz: Mijoz:`, `Manzil: Manzil:`, `To'lov: To'lov:`.
  3. **Non-functional Demo Input Bar:** The interactive demo displays a simulated input bar `Yuqoridagi ssenariylardan birini tanlang yoki o'z do'koningizni ulab sinang...`, but clicking it does not permit typing, confusing users who expect a true sandbox.
  4. **Broken Testimonial Label:** The store identifiers display `TO'LQONING: Do'kon`, an unfinished or garbled placeholder.

#### 7. Responsive Design: 7 / 10
- **Strengths:** Zero horizontal overflow or broken viewport clipping from 375px to 1920px. Mobile card stacking is natural.
- **Weaknesses:** 
  1. **Tablet Navigation Black Hole:** At 768px, navigation links are hidden via media queries, but the mobile hamburger icon is not displayed, leaving tablet users stranded without navigation.
  2. **Mobile Above-the-Fold Loss:** On 375px/390px, the hero chat mockup drops entirely below the fold, so first-time mobile visitors only see text and buttons without visual product evidence.

#### 8. Accessibility (WCAG 2.1 AA): 8 / 10
- **Strengths:** **0 automated WCAG AA violations** detected by Axe-Core on the live page! Text contrast passes 4.5:1 on all primary headings and paragraphs.
- **Weaknesses:** **32 Touch Targets Under 44px.** Header navigation links (`32px` height), language selector button (`35px` height), and stage buttons (`38px` height) fail the recommended mobile touch target standard of 44x44px.

#### 9. Design Consistency: 4 / 5
- **Strengths:** Consistent border-radius philosophy, uniform dark card surfaces, cohesive icon set from Tabler/Lucide.
- **Weaknesses:** Visual discordance between button styles (purple pill, dark border card, bronze pill).

---

## 5. Detailed Visual & Structural Findings

### A. Visual Identity: International SaaS vs. Template
- **Current Impression:** Selloi looks significantly better than typical generic AI wrapper sites, but it still has tells of an AI-generated template: repetitive sparkle icons (`✨`), repetitive 3-card sections, and uncoordinated CTA colors.
- **Verdict:** Middle-tier modern SaaS. To reach the tier of Linear, Supabase, or Raycast, it needs a disciplined typographic system, unified accent identity, and asymmetrical editorial layouts.

### B. Hero Section: 5-Second Test
- **Question:** Does a first-time visitor understand what Selloi does within 5 seconds?
- **Finding:** **YES on Desktop, PARTIALLY on Mobile.**
  - On Desktop, the headline `Telegram do'koningiz uchun 24/7 ishlovchi AI sotuvchi` paired with the simulated Telegram chat showing product photo recognition (`IMG_2048.jpg -> Air Runner Pro 360,000 UZS`) communicates the value proposition in under 3 seconds.
  - On Mobile, because the mockup is pushed below the fold, visitors must scroll to see the visual proof.

### C. Layout & Content Repetition
- Every section follows an identical layout formula:
  `Tag Badge -> Heading (with gold gradient span) -> Subtitle -> 3 Column Grid`
- This formula is used in:
  1. Section 2 (Mijoz murojaatidan...)
  2. Section 3 (Telegram savdosi uchun mukammal vositalar)
  3. Section 5 (Selloi bilan boshlash juda oson)
  4. Section 6 (Do'kon egalarining haqiqiy tajribalari)
  5. Section 7 (Biznesingiz uchun mos tarifni tanlang)
- **Recommendation:** Break the monotony by converting Section 2 into an interactive horizontal split stepper, Section 3 into an asymmetric bento grid, and Section 5 into a connected horizontal timeline.

---

## 6. Critical & High-Priority Issues Register

| Issue ID | Severity | Category | Location | Problem Description | Recommended Improvement | Expected UX Benefit |
|---|---|---|---|---|---|---|
| **ISS-01** | **CRITICAL** | UX / Conversion | Pricing Section (`#tariflar`) | START and PRO cards display raw placeholder text `[NARX] so'm / oyiga`. | Inject actual production prices (e.g., 290,000 so'm and 590,000 so'm) from plan constants. | Eliminates conversion killer; allows prospects to make buying decisions. |
| **ISS-02** | **CRITICAL** | Visual / Content | Flow Card 3 (`Smart Buyurtma`) | Right side values duplicate labels: `Mahsulot: Mahsulot:`, `Mijoz: Mijoz:`, `Manzil: Manzil:`, `To'lov: To'lov:`. | Render realistic order data (e.g. `Pro Wireless ANC`, `Alisher N.`, `Toshkent sh.`, `Click / Payme`). | Restores credibility to the product automation showcase. |
| **ISS-03** | **HIGH** | Responsive / UX | Header (`nav`) at 768px Tablet | Desktop nav links are hidden via CSS breakpoint, but hamburger toggle is absent. | Show hamburger toggle at `< 992px` or keep compact nav links on tablet viewports. | Restores section navigation for all iPad and Android tablet visitors. |
| **ISS-04** | **HIGH** | Brand / Color | Global CTAs & Header | Dual accent clash: Warm Selloi Bronze Gold (`#E6A15A`) vs. Cold Electric Indigo (`#4f46e5`). | Unify primary high-intent CTAs around Bronze Gold or deep obsidian with gold trim. | Harmonizes brand visual identity; eliminates generic SaaS appearance. |
| **ISS-05** | **HIGH** | Typography | Global Typography | System font stack falls back to standard `Segoe UI` on Windows PCs. | Self-host and load `Geist` or `Inter` directly via Next.js `next/font/google`. | Ensures identical, premium editorial typography across all OS environments. |
| **ISS-06** | **MEDIUM** | Mobile UX | Mobile Hero (`< 576px`) | Telegram chat mockup is 100% below the fold on mobile viewports. | Show a compact, animated preview badge or scaled mini-card directly below headline on mobile. | Immediate visual comprehension for 70%+ of mobile traffic. |
| **ISS-07** | **MEDIUM** | Accessibility | Header & Navigation | 32 touch targets have bounding height < 44px (links: 32px, buttons: 35px-41px). | Increase touch target hit area using invisible padding (`::after` overlay or min-h-11). | Meets WCAG 2.5.8 mobile touch target guidelines; prevents mis-taps. |
| **ISS-08** | **LOW** | Content / Polish | Testimonials Section | Store titles display broken string `TO'LQONING: Do'kon`. | Fix translation/label string to display `Do'kon: BrandName` or owner name. | Polishes social proof credibility. |

---

## 7. Strategic Design Direction Proposals

Three distinct directions were evaluated based on Selloi's target audience (Uzbek Telegram merchants, brand owners, and retail entrepreneurs).

### Direction A: Editorial Dark Minimalism (Linear / Raycast Style)
- **Concept:** High-density, restrained, monochrome canvas (`#090909`), ultra-crisp borders (`#1f1f1f`), zero neon glows, pure typography with `Geist` and `Geist Mono`.
- **Pros:** Maximum trust, highly sophisticated, signals enterprise engineering maturity.
- **Cons:** Can feel somewhat cold or intimidating to non-technical Uzbek retail shop owners who sell fashion or cosmetics on Telegram.

### Direction B: Immersive AI Playground (Interactive Canvas)
- **Concept:** Prominent full-screen Telegram phone simulator where visitors can type real questions and receive live simulated AI responses with photo recognition.
- **Pros:** Extremely engaging, demonstrative, high viral potential.
- **Cons:** Performance heavy on low-end mobile devices; high development overhead; risk of distraction from core business pricing and onboarding.

### Direction C: Adaptive Commercial SaaS (RECOMMENDED)
- **Concept:** Combines the structured clarity and trust of **Direction A** with selective, high-converting interactive showcases from **Direction B**.
- **Key Enhancements in Direction C:**
  1. **Unified Accent:** Warm Selloi Bronze Gold (`#E6A15A`) becomes the undisputed signature accent across badges, highlights, and primary CTAs.
  2. **Asymmetric Bento Layout:** Replaces the repetitive 3-card sections with an informative Bento grid that contrasts conversational speed, vision AI, and payment automation.
  3. **Self-Hosted Geist Typography:** Guarantees crisp, authoritative typography on Windows, Mac, iOS, and Android alike.
  4. **Mobile-First Product Visibility:** Integrates a compact 2-message floating preview into the mobile hero so that value is proven above the fold.
  5. **Clean Data & Pricing Transparency:** Resolves `[NARX]` with real tier values and populates all mockup cards with authentic Uzbek retail scenarios.

---

## 8. Prioritized Improvement Roadmap

```
PHASE 1: CRITICAL DATA & INTEGRITY (Immediate)
├── Fix Pricing Section [NARX] placeholder -> real tier figures
├── Fix Flow Card 3 duplicated labels (Mahsulot:, Mijoz:, etc.)
└── Correct Testimonial "TO'LQONING:" translation artifacts

PHASE 2: RESPONSIVE & ACCESSIBILITY POLISH (Within 48h)
├── Add Hamburger Navigation for 768px Tablet breakpoint
├── Enlarge interactive touch targets to 44px (header links, tabs)
└── Refactor mobile hero above-the-fold to surface mini chat preview

PHASE 3: BRAND HARMONIZATION & TYPOGRAPHY (Next Sprint)
├── Migrate Next.js font loader to self-hosted Geist / Geist Mono
├── Unify primary CTA buttons with Selloi Bronze Gold design token
└── Break repetitive 3-card rhythm with asymmetric Bento Feature layout
```

---

## 9. Governance & Non-Destructive Status

In strict accordance with task governance:
- **No source code was altered.**
- **No production assets or configurations were modified.**
- All findings are derived exclusively from live browser automation and computed DOM measurements.
- Any implementation of Phase 1, 2, or 3 improvements requires separate, explicit authorization from the project owner.
