# Selloi.uz: Technical SEO Implementation Report

**Project:** Selloi.uz  
**Repository:** https://github.com/Muxammadaziz-boss/Selloi.uz.git  
**Branch:** `frontend/linear-redesign`  
**Execution Date:** November 2026  
**Implementation Standard:** Next.js 15 App Router SEO Architecture & Schema.org Standards  

---

## 1. Overview of Changes

To establish technical SEO foundations and Google brand recognition for **Selloi**, the following files were implemented and validated:

1. `web/app/robots.ts`: Next.js Route Handler generating dynamic `/robots.txt`.
2. `web/app/sitemap.ts`: Next.js Route Handler generating dynamic `/sitemap.xml`.
3. `web/app/manifest.ts`: Web App Manifest handler for PWA and search rich snippet support.
4. `web/app/layout.tsx`: Root layout with comprehensive metadataBase, canonical URL, Open Graph, Twitter cards, and Schema.org JSON-LD structured data.
5. `web/app/page.tsx`: Page-level metadata with brand search keywords, canonical alternate link, and title formatting.
6. `web/public/og-image.png`: High-definition (1200x630, 2x retina) Open Graph image asset designed specifically for social link previews and search cards.
7. `web/app/icon.svg` & `web/app/apple-icon.svg`: App icon assets linked to the official Selloi vector emblem.

---

## 2. Code Implementations

### 2.1 Robots Directive (`web/app/robots.ts`)
```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",
          "/platform/",
          "/api/",
          "/t/",
        ],
      },
    ],
    sitemap: "https://selloi.uz/sitemap.xml",
    host: "https://selloi.uz",
  };
}
```

### 2.2 Sitemap Delivery (`web/app/sitemap.ts`)
```typescript
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://selloi.uz";
  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];
}
```

### 2.3 Structured Data (`web/app/layout.tsx`)
```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://selloi.uz/#organization",
      "name": "Selloi",
      "url": "https://selloi.uz",
      "logo": "https://selloi.uz/logo.svg",
      "description":
        "O'zbekiston Telegram do'konlari uchun 24/7 ishlaydigan sun'iy intellekt sotuvchisi va savdoni avtomatlashtirish platformasi.",
      "foundingLocation": "Uzbekistan",
    },
    {
      "@type": "WebSite",
      "@id": "https://selloi.uz/#website",
      "url": "https://selloi.uz",
      "name": "Selloi",
      "publisher": { "@id": "https://selloi.uz/#organization" },
      "inLanguage": "uz",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://selloi.uz/#software",
      "name": "Selloi",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Cloud, Web, Telegram",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
      },
      "description":
        "Telegram do'konlari uchun AI sotuvchi. Mijozlarga o'zbek tilida 24/7 xizmat ko'rsatish, mahsulot fotosuratlarini tanish va buyurtmalarni avtomatlashtirish.",
      "publisher": { "@id": "https://selloi.uz/#organization" },
    },
  ],
};
```

---

## 3. Verification & Live Endpoint Evidence

### 3.1 Next.js Production Build Output
```text
Route (app)                                 Size  First Load JS
┌ ƒ /                                    35.4 kB         162 kB
├ ○ /_not-found                            142 B         103 kB
├ ƒ /api/auth/status                       142 B         103 kB
├ ƒ /api/login                             142 B         103 kB
├ ƒ /api/logout                            142 B         103 kB
├ ƒ /api/proxy                             142 B         103 kB
├ ƒ /dashboard                             128 B         183 kB
├ ○ /icon.svg                                0 B            0 B
├ ○ /manifest.webmanifest                  142 B         103 kB
├ ƒ /platform                              128 B         183 kB
├ ○ /robots.txt                            142 B         103 kB
├ ○ /sitemap.xml                           142 B         103 kB
└ ƒ /t/[tenantSlug]                        128 B         183 kB
```

### 3.2 Live Endpoint Responses
1. **Robots Endpoint:**
   `GET /robots.txt` returns HTTP 200 with MIME type `text/plain` and valid crawler directives.
2. **Sitemap Endpoint:**
   `GET /sitemap.xml` returns HTTP 200 with MIME type `application/xml` containing `https://selloi.uz/`.
3. **Structured Data:**
   Rendered HTML `<head>` includes verified schema.org JSON-LD graph.
4. **Social Sharing Assets:**
   `GET /og-image.png` serves 704 KB high-resolution brand preview.
