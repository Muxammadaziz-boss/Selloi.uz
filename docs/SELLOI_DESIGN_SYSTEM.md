# Selloi.uz: Direction C Design System Specification

> **Product:** Selloi.uz: AI Commerce Operating System  
> **Aesthetic Direction:** Direction C: Adaptive Commercial SaaS  
> **Status:** SPECIFICATION / PROPOSAL  
> **Date:** November 19, 2026  

---

## 1. Design Philosophy

**"Intelligence should feel engineered, not decorated."**

Selloi is designed for commercial clarity, operational trust, and conversational speed. Every component is balanced between two key goals:
1. **Editorial Sophistication:** Controlled typography, high contrast, balanced whitespace, and purposeful composition.
2. **Operational Clarity:** High-density business data, clear chat dialogues, and real-time system feedback.

---

## 2. Core Color Palette & Design Tokens

### 2.1 Neutral Foundation (Obsidian Canvas)
| Token | CSS Variable | Hex Value | Role & Application |
|---|---|---|---|
| **Canvas** | `--s-bg-canvas` | `#090909` | Deepest background foundation |
| **Surface 1** | `--s-bg-card` | `#111111` | Primary cards, content panels |
| **Surface 2** | `--s-bg-elevated` | `#171717` | Elevated cards, dropdown menus, modals |
| **Surface 3** | `--s-bg-interactive` | `#202020` | Hover states, active tabs, inputs |
| **Border Subtle** | `--s-border-subtle` | `#222222` | Passive separators and dividers |
| **Border Default** | `--s-border` | `#292929` | Standard card and container borders |
| **Border Strong** | `--s-border-strong` | `#3A3A3A` | Focused inputs, hover borders |

### 2.2 Typography Colors
| Token | CSS Variable | Hex Value | Role & Application | Contrast Ratio |
|---|---|---|---|---|
| **Text Primary** | `--s-text-primary` | `#F4F4F4` | Primary headlines, titles, active labels | 17.2:1 (AAA) |
| **Text Secondary** | `--s-text-secondary` | `#A1A1AA` | Body copy, subtitles, explanations | 7.8:1 (AAA) |
| **Text Muted** | `--s-text-muted` | `#71717A` | Metadata, timestamps, passive hints | 4.6:1 (AA) |

### 2.3 Signature Brand Accent
| Token | CSS Variable | Hex Value | Role & Application |
|---|---|---|---|
| **Brand Accent** | `--s-accent` | `#E6A15A` | Signature Selloi Bronze Gold |
| **Brand Hover** | `--s-accent-hover` | `#F0B272` | Lighter gold hover state |
| **Brand Subdued** | `--s-accent-subtle` | `rgba(230, 161, 90, 0.12)` | Active pill backgrounds, highlights |
| **Brand Border** | `--s-accent-border` | `rgba(230, 161, 90, 0.35)` | Active selection borders |

### 2.4 Semantic Status Colors
| Status | Token Variable | Hex Value | Meaning |
|---|---|---|---|
| **Success** | `--s-status-success` | `#10B981` | Order confirmed, active bot status |
| **Warning** | `--s-status-warning` | `#F59E0B` | Low stock, verification needed |
| **Error** | `--s-status-error` | `#EF4444` | Payment failed, disconnected |
| **Info / Tech** | `--s-status-info` | `#38BDF8` | Latency, protocol, API stats |

---

## 3. Typography System

- **Primary Interface Typeface:** `Geist Sans` (fallback: `Inter`, system sans-serif)
- **Monospace & Metadata Typeface:** `Geist Mono` (metrics, order numbers, pricing figures)

### Modular Type Scale
| Level | Font Size | Line Height | Weight | Letter Spacing | Purpose |
|---|---|---|---|---|---|
| **Display** | 48px - 56px | 1.1 | 700 Bold | -0.025em | Main hero headline |
| **H1** | 36px - 40px | 1.15 | 700 Bold | -0.02em | Major section titles |
| **H2** | 24px - 28px | 1.25 | 600 SemiBold | -0.015em | Feature headlines |
| **H3** | 18px - 20px | 1.35 | 600 SemiBold | -0.01em | Card titles, plan names |
| **Body Large** | 16px - 18px | 1.55 | 400 Regular | normal | Hero subheadlines |
| **Body Default** | 14px - 15px | 1.5 | 400 Regular | normal | Standard body text |
| **Body Small** | 13px | 1.45 | 400 Regular | normal | Explanatory notes |
| **Micro / Tag** | 11px - 12px | 1.3 | 600 SemiBold | +0.05em | Uppercase category tags |

---

## 4. Elevation, Radii & Spacing

### 4.1 Corner Radii
| Component Type | Radius Value | CSS Variable |
|---|---|---|
| Buttons & Interactive Inputs | `6px` | `--s-radius-sm` |
| Cards & Modals | `10px` | `--s-radius-md` |
| Hero Mockup Frame | `14px` | `--s-radius-lg` |
| Badges & Status Pills | `9999px` | `--s-radius-pill` |

### 4.2 Spacing Grid (8pt Scale)
- `4px`: Micro gap between icon and text
- `8px`: Inner element padding, badge spacing
- `12px`: Input vertical padding
- `16px`: Compact card padding, button horizontal padding
- `24px`: Standard card interior padding
- `32px`: Section subtitle bottom margin
- `48px`: Feature grid gutter
- `80px - 100px`: Major vertical section padding
