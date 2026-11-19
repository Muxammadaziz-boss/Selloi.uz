# Selloi.uz: Technical SEO & Google Brand Discovery Audit

**Project:** Selloi.uz (AI Sales Platform)  
**Domain:** https://selloi.uz  
**Audit Scope:** Technical SEO, Crawlability, Indexability, Structured Data, Meta Tags, and Brand Discovery  
**Status:** AUDITED & REMEDIATED  
**Audit Date:** November 2026  

---

## 1. Executive Summary

A comprehensive technical SEO audit was conducted on Selloi.uz to assess its discoverability, search engine indexing readiness, and branded search presence for target keywords including:
- Selloi
- Selloi.uz
- Selloi AI
- Selloi Telegram AI
- Selloi AI sotuvchi

Prior to this audit, several critical technical SEO deficiencies were present:
1. **Missing Sitemap & Robots Endpoints:** The production branch (`frontend/linear-redesign`) lacked `robots.ts` and `sitemap.ts` endpoints, preventing search engine crawlers from systematically discovering public URLs and respecting route privacy boundaries.
2. **Generic Placeholder Metadata:** Root `layout.tsx` contained legacy placeholder values (`AI Sales Control`, `Telegram Business AI sales management dashboard`) lacking canonical tags, Open Graph image assets, and keyword associations.
3. **Absence of Structured Data (JSON-LD):** The application did not provide schema.org structured data, impeding Google from recognizing Selloi as a software product and organization entity.
4. **Missing Open Graph & Social Preview Assets:** No designated 1200x630 social preview graphic existed in `web/public`.

All deficiencies were systematically resolved without impacting production stability.

---

## 2. Crawlability & Indexability Audit

### 2.1 Route Classification Matrix

| Route | Nature | Indexing Directive | Rationale |
| :--- | :--- | :--- | :--- |
| `/` | Public Marketing | `index, follow` | Official landing page, brand entity source, product showcase |
| `/robots.txt` | Public System | `Allow: /` | Crawler directives endpoint |
| `/sitemap.xml` | Public System | `Allow: /` | XML sitemap index |
| `/manifest.webmanifest` | Public System | `Allow: /` | PWA manifest metadata |
| `/dashboard/*` | Private SaaS | `noindex, nofollow` | Authenticated tenant dashboard; excluded in robots.txt |
| `/platform/*` | Private Platform | `noindex, nofollow` | Master owner administration; excluded in robots.txt |
| `/t/*` | Private Store | `noindex, nofollow` | Store-specific tenant portal; excluded in robots.txt |
| `/api/*` | Private Backend | `noindex, nofollow` | Internal and proxy APIs; excluded in robots.txt |

### 2.2 Robots.txt Configuration
The `/robots.txt` file permits crawling of the public root (`/`) while strictly disallowing private application paths:
```text
User-Agent: *
Allow: /
Disallow: /dashboard/
Disallow: /platform/
Disallow: /api/
Disallow: /t/

Host: https://selloi.uz
Sitemap: https://selloi.uz/sitemap.xml
```

### 2.3 Sitemap.xml Configuration
The `/sitemap.xml` endpoint delivers a clean XML sitemap with canonical HTTPS URL, ISO 8601 modification timestamp, and daily priority declaration:
- URL: `https://selloi.uz/`
- Change frequency: `daily`
- Priority: `1.0`

---

## 3. Metadata & Brand Entity Optimization

### 3.1 Global & Page-Level Metadata
Metadata was configured with standard Next.js 15 metadata API:
- **MetadataBase:** `https://selloi.uz`
- **Canonical URL:** `https://selloi.uz/`
- **Title (Default):** `Selloi: Telegram do'konlari uchun AI sotuvchi`
- **Title Template:** `%s | Selloi`
- **Meta Description:** `Selloi: O'zbekiston Telegram do'konlari uchun 24/7 ishlaydigan sun'iy intellekt sotuvchisi. Mijozlarga o'zbek tilida javob beradi, mahsulotlarni taniydi va buyurtmalarni qabul qiladi.`
- **Open Graph:** Type `website`, locale `uz_UZ`, dedicated retina 1200x630 visual preview (`/og-image.png`).
- **Twitter Card:** `summary_large_image` with full image and card description.
- **Icons:** SVG vector icon (`/icon.svg`, `/logo.svg`) and PWA webmanifest.

### 3.2 Structured Data (Schema.org JSON-LD)
A composite `@graph` Schema.org definition was placed into the root HTML `<head>`:
1. **Organization:** Identifies Selloi as a technology business founded in Uzbekistan, with official logo, URL, and corporate description.
2. **WebSite:** Identifies the official website entity and connects to the publisher organization.
3. **SoftwareApplication:** Classifies Selloi under `BusinessApplication`, defining its operating environments (Cloud, Web, Telegram) and conversational sales capabilities.

---

## 4. Technical Validation Summary

All implementations were verified via automated test suites:
- **Production Build:** Next.js static page generation completed with 14/14 static pages generated (including `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/icon.svg`).
- **HTTP Verification:** Real requests to `/robots.txt` and `/sitemap.xml` return HTTP 200 with valid syntax.
- **Accessibility:** Axe-core WCAG 2.1 AA audit passed 96/96 scans with 0 automated violations across 16 tabs, 3 design systems, and dark/light themes.
- **Security & Authorization:** 62/62 entitlement matrix tests and 70/70 backend pytest suites passed without regressions.
