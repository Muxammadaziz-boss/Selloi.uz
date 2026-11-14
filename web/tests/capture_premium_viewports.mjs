import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import { fileURLToPath } from "url";
import { BASE_URL, SESSION_SECRET, getLaunchOptions } from "./test_config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

function createOwnerToken() {
  const data = {
    userId: 1,
    email: "owner@aisales.uz",
    role: "owner",
    isPlatformOwner: true,
    organizationId: 1,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(`ai-sales:v2:${encoded}`).digest().toString("hex");
  return `v2.${encoded}.${signature}`;
}

async function capture() {
  const browser = await chromium.launch(getLaunchOptions());
  const token = createOwnerToken();
  const parsedUrl = new URL(BASE_URL);

  const viewports = [
    { name: "desktop_1440x900", width: 1440, height: 900 },
    { name: "laptop_1366x768", width: 1366, height: 768 },
    { name: "mobile_375x812", width: 375, height: 812, isMobile: true },
  ];

  const measurements = {};

  for (const vp of viewports) {
    console.log(`Capturing Premium at ${vp.width}x${vp.height}...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: !!vp.isMobile,
    });

    await context.addCookies([
      {
        name: "sales_session",
        value: token,
        domain: parsedUrl.hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage();
    // Intercept subscription to return ULTRA
    await page.route(
      (url) =>
        url.pathname.includes("/api/subscription") ||
        (url.pathname.includes("/api/proxy") && decodeURIComponent(url.search).includes("/subscription")),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            plan: { code: "ultra", name: "Ultra", price_usd: 99.0 },
            status: "active",
            is_active: true,
          }),
        });
      }
    );

    // Set Premium design in storage
    await page.goto(`${BASE_URL}/#overview`);
    await page.evaluate(() => {
      localStorage.setItem("ai_sales_design_system", "premium");
      localStorage.setItem("theme", "dark");
      document.documentElement.setAttribute("data-design", "premium");
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const shotPath = path.join(SCREENSHOT_DIR, `premium_${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved screenshot: ${shotPath}`);

    // Measure exact CSS and DOM geometry
    const geom = await page.evaluate(() => {
      const sidebar = document.querySelector(".app-sidebar") || document.querySelector("aside");
      const card = document.querySelector(".card") || document.querySelector(".linear-card");
      const body = document.body;
      const html = document.documentElement;

      const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : null;
      const cardStyle = card ? window.getComputedStyle(card) : null;
      const bodyStyle = window.getComputedStyle(body);

      return {
        dataDesign: html.getAttribute("data-design"),
        dataTheme: html.getAttribute("data-theme"),
        sidebarWidth: sidebar ? sidebar.getBoundingClientRect().width : null,
        sidebarComputedWidth: sidebarStyle ? sidebarStyle.width : null,
        bodyBg: bodyStyle.backgroundColor,
        cardBg: cardStyle ? cardStyle.backgroundColor : null,
        cardBorder: cardStyle ? cardStyle.borderColor : null,
        cardBackdropFilter: cardStyle ? cardStyle.backdropFilter : null,
        cardBoxShadow: cardStyle ? cardStyle.boxShadow : null,
      };
    });

    measurements[vp.name] = geom;
    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(__dirname, "premium_viewport_measurements.json"),
    JSON.stringify(measurements, null, 2)
  );

  console.log("Measurements complete:");
  console.log(JSON.stringify(measurements, null, 2));
}

capture().catch(console.error);
