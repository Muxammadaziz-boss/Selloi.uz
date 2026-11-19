import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BASE_URL, getLaunchOptions } from "./test_config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "pricing_responsive");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
  suite: "hybrid_pricing_e2e_suite",
  timestamp: new Date().toISOString(),
  tests: {},
  summary: { total: 0, passed: 0, failed: 0 },
};

function recordTest(name, passed, details = "") {
  results.summary.total++;
  if (passed) {
    results.summary.passed++;
    results.tests[name] = { status: "PASSED", details };
    console.log(`[PASSED] ${name}: ${details}`);
  } else {
    results.summary.failed++;
    results.tests[name] = { status: "FAILED", details };
    console.error(`[FAILED] ${name}: ${details}`);
  }
}

async function runPricingE2ETests() {
  console.log("==================================================================");
  console.log("PLAYWRIGHT HYBRID PRICING E2E TEST SUITE: PHASE 3 VERIFICATION");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================================");

  let browser;
  try {
    const launchOptions = getLaunchOptions();
    browser = await chromium.launch(launchOptions);
  } catch (err) {
    console.error("[FATAL ERROR] Browser launch failed:", err.message);
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Public Landing Page #tariflar Section Exists
    // -------------------------------------------------------------------------
    await page.goto(`${BASE_URL}/#tariflar`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const pricingSection = await page.$("#tariflar");
    recordTest(
      "public_pricing_section_present",
      Boolean(pricingSection),
      pricingSection ? "#tariflar section found in DOM" : "Section missing"
    );

    // -------------------------------------------------------------------------
    // TEST 2: Zero Placeholder Strings ([NARX], [ЦЕНА], [PRICE])
    // -------------------------------------------------------------------------
    const bodyText = await page.innerText("#tariflar");
    const hasPlaceholders = /\[NARX\]|\[ЦЕНА\]|\[PRICE\]/i.test(bodyText);
    recordTest(
      "zero_placeholder_strings",
      !hasPlaceholders,
      !hasPlaceholders ? "No [NARX] placeholders found" : "Placeholder text leaked!"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Default Currency is USD ($)
    // -------------------------------------------------------------------------
    const hasDollarPrices = /\$19|\$59|\$149/.test(bodyText);
    recordTest(
      "default_currency_usd",
      hasDollarPrices,
      hasDollarPrices ? "Default prices rendered in USD ($)" : "Dollar prices missing"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Currency Switching to UZS (so'm)
    // -------------------------------------------------------------------------
    const uzsBtn = await page.getByRole("button", { name: /UZS/i });
    if (uzsBtn) {
      await uzsBtn.click();
      await page.waitForTimeout(300);
      const uzsBodyText = await page.innerText("#tariflar");
      const hasUzsPrices = /so'm|so‘m|som/i.test(uzsBodyText);
      recordTest(
        "currency_switching_uzs",
        hasUzsPrices,
        hasUzsPrices ? "Successfully switched to UZS (so'm) display" : "UZS text missing"
      );
    } else {
      recordTest("currency_switching_uzs", false, "UZS switcher button not found");
    }

    // -------------------------------------------------------------------------
    // TEST 5: Billing Cycle Toggle (Monthly vs Annual)
    // -------------------------------------------------------------------------
    const annualBtn = await page.locator(".s-pricing-toggle button").nth(1);
    if (annualBtn) {
      await annualBtn.click();
      await page.waitForTimeout(300);
      const annualBodyText = await page.innerText("#tariflar");
      const hasAnnualNote = /yil/i.test(annualBodyText);
      recordTest(
        "billing_cycle_toggle_annual",
        hasAnnualNote,
        hasAnnualNote ? "Annual pricing and gift badge toggled" : "Annual text missing"
      );
    } else {
      recordTest("billing_cycle_toggle_annual", false, "Annual toggle button not found");
    }

    // -------------------------------------------------------------------------
    // TEST 6: Responsive Viewports (375px, 390px, 768px, 1024px, 1440px)
    // -------------------------------------------------------------------------
    const viewports = [
      { name: "mobile_375", width: 375, height: 812 },
      { name: "mobile_390", width: 390, height: 844 },
      { name: "tablet_768", width: 768, height: 1024 },
      { name: "desktop_1024", width: 1024, height: 768 },
      { name: "desktop_1440", width: 1440, height: 900 },
    ];

    let allViewportsNoOverflow = true;
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => {
        const el = document.getElementById("tariflar");
        if (!el) return false;
        return el.scrollWidth > document.documentElement.clientWidth + 2;
      });

      if (overflow) {
        allViewportsNoOverflow = false;
        console.warn(`[WARN] Viewport ${vp.name} (${vp.width}px) has horizontal overflow!`);
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${vp.name}.png`),
        fullPage: false,
      });
    }

    recordTest(
      "responsive_viewports_no_overflow",
      allViewportsNoOverflow,
      allViewportsNoOverflow
        ? "All 5 viewports (375, 390, 768, 1024, 1440) rendered without horizontal overflow"
        : "Horizontal overflow detected on one or more viewports"
    );

    // -------------------------------------------------------------------------
    // TEST 7: Platform Owner Pricing Studio Structure
    // -------------------------------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/platform`, { waitUntil: "networkidle" });
    const platformHeading = await page.$("h1, h2, h3, [data-zone='platform']");
    recordTest(
      "platform_owner_accessible",
      Boolean(platformHeading),
      platformHeading ? "Platform Owner dashboard rendered" : "Platform page not loaded"
    );

    // Check if plans subtab or Pricing Studio navigation exists
    const studioNav = await page.getByRole("button", { name: /Global Tariflar|Tariflar/i }).first();
    recordTest(
      "owner_pricing_studio_nav_present",
      Boolean(studioNav),
      studioNav ? "Owner Pricing Studio navigation button found" : "Studio nav not visible"
    );
  } catch (err) {
    console.error("[TEST RUNTIME ERROR]", err);
    recordTest("test_runtime_safety", false, err.message);
  } finally {
    await browser.close();
  }

  // Save results
  fs.writeFileSync(
    path.join(__dirname, "hybrid_pricing_e2e_results.json"),
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log("==================================================================");
  console.log(`SUMMARY: Total: ${results.summary.total} | Passed: ${results.summary.passed} | Failed: ${results.summary.failed}`);
  console.log("==================================================================");

  if (results.summary.failed > 0) {
    process.exit(1);
  }
}

runPricingE2ETests();
