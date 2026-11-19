# Google Search Console: Selloi Brand Discovery & Indexing Checklist

**Domain:** `https://selloi.uz`  
**Target Search Queries:**  
- Selloi  
- Selloi.uz  
- Selloi AI  
- Selloi Telegram AI  
- Selloi AI sotuvchi  

---

## 1. Domain Ownership Verification

1. Go to [Google Search Console](https://search.google.com/search-console).
2. Add a new Property using the **Domain** method: `selloi.uz` (recommended for capturing both root and subdomains).
3. Copy the provided TXT verification record.
4. Open the **Cloudflare Dashboard** for `selloi.uz`.
5. Navigate to **DNS** -> **Records** -> **Add Record**:
   - **Type:** TXT
   - **Name:** `@` (or `selloi.uz`)
   - **Content:** `google-site-verification=...`
   - **TTL:** Auto
6. Return to Google Search Console and click **Verify**.

---

## 2. Submit XML Sitemap

1. Once the domain is verified, navigate to **Sitemaps** in the left sidebar menu.
2. Under "Add a new sitemap", enter:
   ```text
   sitemap.xml
   ```
3. Click **Submit**.
4. Confirm that the status reports **Success** and that `https://selloi.uz/` is recognized.

---

## 3. URL Inspection & Request Indexing

1. At the top search bar in Search Console, paste the official URL:
   ```text
   https://selloi.uz/
   ```
2. Click **Test Live URL** to confirm Googlebot can fetch the HTML, title, meta description, and schema.org JSON-LD structured data.
3. Once the live test confirms availability, click **Request Indexing**.

---

## 4. Brand Search Presence Monitoring

Within 1 to 2 weeks of submission:
1. Navigate to **Performance** -> **Search results**.
2. Filter by Query to track clicks, impressions, CTR, and average position for:
   - `selloi`
   - `selloi.uz`
   - `selloi ai`
   - `selloi telegram`
   - `selloi ai sotuvchi`
3. Inspect **Enhancements** to confirm Google detects the `SoftwareApplication` and `Organization` structured data without errors.
4. Review **Page indexing** report to verify that only public pages are indexed and private paths (`/dashboard/`, `/platform/`, `/api/`, `/t/`) remain correctly blocked by robots.txt directives.
