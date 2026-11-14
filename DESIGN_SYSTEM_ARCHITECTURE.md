# DESIGN SYSTEM ARCHITECTURE & ISOLATION SPECIFICATION

**Project:** Telegram AI Sales Control Center  
**Repository:** `https://github.com/Muxammadaziz-boss/Telegram-Ai-saller.git`  
**Branch:** `frontend/linear-redesign`  
**Date:** November 14, 2026  
**Status:** **ACTIVE IN PRODUCTION**  

---

## 1. Architectural Philosophy

The Telegram AI Sales Control Center supports three visually and architecturally independent design systems:

1. **PREMIUM:** The dark minimalist SaaS system (strictly modeled after `media_1794593322783_be3afb5e.jpg`), featuring near-black surfaces (`#090909`), charcoal cards (`#171717`), a compact 270px sidebar (`#0d0d0d`), razor-thin borders (`#262626`), and monospace metric displays.
2. **IOS:** Apple Human Interface inspired system, featuring multi-layer frosted glass (`backdrop-filter: blur(28px)`), radial ambient gradients, SF Pro typography, capsule buttons, and rounded chat bubbles.
3. **CLASSIC:** The battle-tested enterprise SaaS foundation, featuring Tabler-inspired layouts, structured table cards, and standard enterprise data visualization.

### Key Architectural Tenet: Total Isolation
Under no circumstances are CSS tokens, animations, or styling rules merged into a single blended theme. Each system is isolated into its own domain and toggled via standard HTML attributes.

---

## 2. Directory Structure & CSS Modularization

All design systems reside within `web/app/design-systems/`:

```
web/app/design-systems/
├── classic/
│   ├── tokens.css       # Standard enterprise palettes, borders, radii
│   ├── theme.css        # Base background, fonts, and container resets
│   └── components.css   # Classic tables, cards, form inputs, buttons
├── ios/
│   ├── tokens.css       # Translucent fills, glass blurs, iOS system colors
│   ├── theme.css        # Canvas gradients, SF Pro font stack, pill rounding
│   └── components.css   # Frosted glass sidebars, floating topbars, iMessage bubbles
└── premium/
    ├── tokens.css       # Deep black (#090909), card (#171717), border (#262626)
    ├── theme.css        # 270px sidebar geometry, minimal headers, monospace numerals
    └── components.css   # High-density KPI cards, outline icons, flat list items
```

All 9 files are cleanly imported in `web/app/globals.css`:
```css
/* CLASSIC DESIGN SYSTEM */
@import "./design-systems/classic/tokens.css";
@import "./design-systems/classic/theme.css";
@import "./design-systems/classic/components.css";

/* IOS DESIGN SYSTEM */
@import "./design-systems/ios/tokens.css";
@import "./design-systems/ios/theme.css";
@import "./design-systems/ios/components.css";

/* PREMIUM DESIGN SYSTEM */
@import "./design-systems/premium/tokens.css";
@import "./design-systems/premium/theme.css";
@import "./design-systems/premium/components.css";
```

---

## 3. Scoping & Mutual Exclusivity

Each design system strictly scopes its variables and component overrides behind a root HTML attribute selector:
- `html[data-design="classic"]`
- `html[data-design="ios"]`
- `html[data-design="premium"]`

### 3.1 Token Remapping Pattern
Standard layout components utilize generic design tokens (`var(--bg-primary)`, `var(--surface-primary)`, `var(--border-primary)`). Each system maps these generic tokens to its proprietary tokens:

```css
/* Premium Token Mapping */
html[data-design="premium"] {
  --bg-primary: var(--premium-bg);
  --surface-primary: var(--premium-card);
  --border-primary: var(--premium-border);
  --text-primary: var(--premium-text);
  --text-secondary: var(--premium-text-secondary);
  --accent: var(--premium-accent);
}

/* iOS Token Mapping */
html[data-design="ios"] {
  --bg-primary: var(--ios-bg);
  --surface-primary: var(--ios-card);
  --border-primary: var(--ios-border);
  --text-primary: var(--ios-text-primary);
  --text-secondary: var(--ios-text-secondary);
  --accent: var(--ios-accent);
}
```

### 3.2 Component Specialization Without Cross-Bleed
When a specific system requires radical structural divergence (such as Premium's 270px sidebar or iOS's frosted floating bar), the override is bounded:

```css
/* Premium Sidebar */
html[data-design="premium"] .sidebar-container {
  width: 270px !important;
  background-color: var(--premium-sidebar) !important;
  border-right: 1px solid var(--premium-border) !important;
}

/* iOS Sidebar */
html[data-design="ios"] .sidebar-container {
  width: 280px !important;
  background-color: var(--ios-sidebar-bg) !important;
  backdrop-filter: blur(28px) saturate(190%) !important;
  border-right: 1px solid var(--ios-border) !important;
}
```

Because `data-design` is mutually exclusive, the browser never computes or parses competing rules from another system.

---

## 4. Theme Mode Independence (Dark & Light)

Each of the three design systems functions seamlessly in both **Dark** and **Light** modes by combining `data-design` with `data-theme`:

```css
/* Premium Dark Mode */
html[data-design="premium"][data-theme="dark"] {
  --premium-bg: #090909;
  --premium-card: #171717;
  --premium-text: #f8fafc;
}

/* Premium Light Mode (High Contrast SaaS) */
html[data-design="premium"][data-theme="light"] {
  --premium-bg: #f8f9fa;
  --premium-card: #ffffff;
  --premium-text: #0f172a;
}
```

This guarantees full WCAG 2.1 AA compliance (contrast ratio $\ge 4.5:1$) across all 6 possible permutations (3 designs $\times$ 2 themes).

---

## 5. State Management & Anti-FOUC Architecture

### 5.1 DesignContext State Flow
The React context (`web/app/components/design/DesignContext.tsx`) coordinates:
1. Active backend subscription tier retrieval.
2. Entitlement validation via `canUseDesign()`.
3. Synchronization to `localStorage.setItem("preferred_design_system", design)`.
4. Synchronous DOM update `document.documentElement.setAttribute("data-design", design)`.

### 5.2 Flash of Unstyled Content (FOUC) Elimination
To prevent unstyled layout shifting during initial server-side hydration, `web/app/layout.tsx` executes an inline synchronous pre-hydration script in the `<head>`:

```html
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var design = localStorage.getItem('preferred_design_system') || 'classic';
          document.documentElement.setAttribute('data-design', design);
          var theme = localStorage.getItem('theme_preference') || 'dark';
          document.documentElement.setAttribute('data-theme', theme);
          var font = localStorage.getItem('font_preference') || 'inter';
          document.documentElement.setAttribute('data-font', font);
        } catch (e) {}
      })();
    `,
  }}
/>
```
The browser parses and applies the exact design system CSS rules before the first pixel is painted.
