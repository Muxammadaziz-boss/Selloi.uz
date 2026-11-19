/**
 * Phase 4.2 Exhaustive Browser & API Entitlement Integration Test Suite
 *
 * Verifies end-to-end runtime security and entitlement enforcement in Chromium:
 * 1. ULTRA Subscription API: Premium, iOS, and Classic available; selects Premium.
 * 2. PRO Subscription API: Premium locked (shows ULTRA badge + opens Upgrade Modal); iOS & Classic available; auto-downgrades saved Premium.
 * 3. START Subscription API: Premium and iOS locked; only Classic permitted.
 * 4. Missing Subscription (404): Strict Classic enforcement with error state.
 * 5. Expired / Canceled Subscription: Elevated designs locked; fallback to Classic.
 * 6. API Failure (500 Error): Graceful error handling; fallback to Classic without crash.
 * 7. Platform Owner Authenticated Session: Verified server-backed override enables Premium regardless of tenant plan.
 * 8. Non-Owner Spoof Attempt: Tenant owner (role="owner", isPlatformOwner=false) tampering localStorage is sanitized to Classic.
 * 9. Logout Revocation: Logging out clears localStorage ("ai_sales_design_system") and resets data-design to "classic".
 * 10. Organization Switching: Switching between ULTRA and START orgs updates active design and localStorage.
 * 11. Live Downgrade Transition: Dynamically demotes active design on plan change.
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import { fileURLToPath } from "url";
import { BASE_URL, DASHBOARD_PASSWORD, SESSION_SECRET, getLaunchOptions, getRunMetadata } from "./test_config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function createSignedSessionToken(payload, secret = SESSION_SECRET) {
  const data = {
    ...payload,
    issuedAt: Math.floor(Date.now() / 1000),
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`ai-sales:v2:${encoded}`).digest().toString("hex");
  return `v2.${encoded}.${signature}`;
}

const testResults = {
  metadata: getRunMetadata("entitlement_integration_suite"),
  unauthenticated_state: {},
  ultra_plan: {},
  pro_plan: {},
  start_plan: {},
  missing_subscription_404: {},
  expired_subscription: {},
  api_failure_500: {},
  platform_owner_session: {},
  non_owner_spoof_sanitization: {},
  logout_revocation: {},
  org_switching: {},
  downgrade_transition: {},
  summary: { total: 0, passed: 0, failed: 0, overall_status: "PENDING" },
};

function recordTest(suite, name, passed, details = "") {
  testResults.summary.total++;
  if (passed) {
    testResults.summary.passed++;
    testResults[suite][name] = { status: "PASSED", details };
    console.log(`  [PASSED] ${suite}: ${name} - ${details}`);
  } else {
    testResults.summary.failed++;
    testResults[suite][name] = { status: "FAILED", details };
    console.error(`  [FAILED] ${suite}: ${name} - ${details}`);
  }
}

async function runEntitlementIntegration() {
  console.log("==================================================================");
  console.log("ENTITLEMENT INTEGRATION TEST SUITE (PLAYWRIGHT BROWSER + LIVE RUNTIME)");
  console.log(`Target: ${BASE_URL} | Commit: ${testResults.metadata.commitSha}`);
  console.log("==================================================================");

  let browser;
  try {
    const launchOptions = getLaunchOptions();
    browser = await chromium.launch(launchOptions);
    testResults.metadata.browserVersion = browser.version();
  } catch (err) {
    console.error("[FATAL ERROR] Browser launch failed:", err.message);
    testResults.summary.overall_status = "FAILED";
    fs.writeFileSync(
      path.join(__dirname, "entitlement_integration_results.json"),
      JSON.stringify(testResults, null, 2)
    );
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Helper to establish a tenant session
  async function setTenantSession(orgId = 2) {
    const token = createSignedSessionToken({
      userId: 42,
      email: "tenant_admin@shop.uz",
      role: "owner", // Tenant organization owner, NOT platform owner
      isPlatformOwner: false,
      organizationId: orgId,
    });
    const parsedUrl = new URL(BASE_URL);
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
  }

  // Helper to establish a platform owner session
  async function setPlatformOwnerSession() {
    const token = createSignedSessionToken({
      userId: 1,
      email: "owner@aisales.uz",
      role: "owner",
      isPlatformOwner: true,
      organizationId: 1,
    });
    const parsedUrl = new URL(BASE_URL);
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
  }

  // Helper to mock subscription endpoint (both direct and via /api/proxy)
  async function mockSubscription(planCode, status = "active", extra = {}) {
    await page.route(
      (url) =>
        url.pathname.includes("/api/subscription") ||
        (url.pathname.includes("/api/proxy") && decodeURIComponent(url.search).includes("/subscription")),
      async (route) => {
        if (planCode === 404) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Obuna ma'lumotlari topilmadi" }),
          });
          return;
        }
        if (planCode === 500) {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Database connection failed" }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            plan: { code: planCode, name: String(planCode).toUpperCase(), price_usd: 49.0 },
            status: status,
            is_active: status === "active",
            trial_days_remaining: 14,
            ...extra,
          }),
        });
      }
    );
  }

  try {
    // -------------------------------------------------------------
    // TEST CASE 0: UNAUTHENTICATED ACCESS & ROOT DEFAULTS
    // -------------------------------------------------------------
    console.log("\n[0] Testing Unauthenticated Session & Design Security...");
    await context.clearCookies();
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    const docDesignUnauth = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    const pwdInputVisible = await page.locator("#admin-pwd, input[type='password']").first().isVisible();
    recordTest("unauthenticated_state", "unauthenticated_shows_login_card", pwdInputVisible, "Login form displayed");
    recordTest("unauthenticated_state", "unauthenticated_defaults_to_classic", docDesignUnauth === "classic", `data-design=${docDesignUnauth}`);

    // -------------------------------------------------------------
    // TEST CASE 1: ULTRA SUBSCRIPTION API RESPONSE (TENANT SESSION)
    // -------------------------------------------------------------
    console.log("\n[1] Testing ULTRA Subscription API Response (Tenant Session)...");
    await setTenantSession();
    await mockSubscription("ultra");

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.goto(`${BASE_URL}/dashboard#profile`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    const designCards = page.locator('.col-12.col-md-4');
    const cardsCount = await designCards.count();
    recordTest("ultra_plan", "designs_rendered", cardsCount >= 3, `Found ${cardsCount} design option cards`);

    // Click Premium design
    const premiumCard = page.locator('.col-12.col-md-4').filter({ hasText: "Premium Minimal" });
    await premiumCard.click();
    await page.waitForTimeout(400);

    const docDesignUltra = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    const storedDesignUltra = await page.evaluate(() => localStorage.getItem("ai_sales_design_system"));
    recordTest("ultra_plan", "select_premium", docDesignUltra === "premium", `data-design=${docDesignUltra}`);
    recordTest("ultra_plan", "persist_premium", storedDesignUltra === "premium", `localStorage=${storedDesignUltra}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "entitlement_01_ultra_premium.png") });

    // -------------------------------------------------------------
    // TEST CASE 2: PRO SUBSCRIPTION API RESPONSE
    // -------------------------------------------------------------
    console.log("\n[2] Testing PRO Subscription API Response...");
    await mockSubscription("pro");

    // Reload with saved Premium in storage on PRO plan -> verify auto-downgrade to classic
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    const docDesignProAfterReload = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    const storedDesignProAfterReload = await page.evaluate(() => localStorage.getItem("ai_sales_design_system"));
    recordTest("pro_plan", "auto_downgrade_premium_to_classic", docDesignProAfterReload === "classic", `data-design=${docDesignProAfterReload}`);
    recordTest("pro_plan", "storage_sanitized_to_classic", storedDesignProAfterReload === "classic", `localStorage=${storedDesignProAfterReload}`);

    // Click locked Premium card -> verify upgrade modal opens
    const premiumCardPro = page.locator('.col-12.col-md-4').filter({ hasText: "Premium Minimal" });
    await premiumCardPro.click();
    await page.waitForTimeout(500);

    const upgradeModal = page.locator('.modal-dialog, [role="dialog"]').filter({ hasText: "Tarifni Yangilash" });
    const modalVisible = await upgradeModal.isVisible();
    recordTest("pro_plan", "premium_locked_opens_upgrade_modal", modalVisible, "Upgrade modal opened on locked design click");

    // Close upgrade modal with Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // Click iOS design -> verify allowed on PRO
    const iosCardPro = page.locator('.col-12.col-md-4').filter({ hasText: "Apple iOS Uslubi" });
    await iosCardPro.click();
    await page.waitForTimeout(400);

    const docDesignIos = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("pro_plan", "select_ios_allowed", docDesignIos === "ios", `data-design=${docDesignIos}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "entitlement_02_pro_ios.png") });

    // -------------------------------------------------------------
    // TEST CASE 3: START SUBSCRIPTION API RESPONSE
    // -------------------------------------------------------------
    console.log("\n[3] Testing START Subscription API Response...");
    await mockSubscription("start");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    const docDesignStart = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("start_plan", "defaults_to_classic", docDesignStart === "classic", `data-design=${docDesignStart}`);

    // Click iOS on START -> verify locked
    const iosCardStart = page.locator('.col-12.col-md-4').filter({ hasText: "Apple iOS Uslubi" });
    await iosCardStart.click();
    await page.waitForTimeout(400);

    const startUpgradeModal = page.locator('.modal-dialog, [role="dialog"]').filter({ hasText: "Tarifni Yangilash" });
    const startModalVisible = await startUpgradeModal.isVisible();
    recordTest("start_plan", "ios_locked_on_start", startModalVisible, "Modal triggered for iOS on START plan");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "entitlement_03_start_classic.png") });

    // -------------------------------------------------------------
    // TEST CASE 4: MISSING SUBSCRIPTION (HTTP 404)
    // -------------------------------------------------------------
    console.log("\n[4] Testing Missing Subscription (404)...");
    await mockSubscription(404);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    const docDesign404 = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("missing_subscription_404", "enforces_classic_on_404", docDesign404 === "classic", `data-design=${docDesign404}`);

    // Verify tamper attack during 404 is sanitized to classic
    await page.evaluate(() => localStorage.setItem("ai_sales_design_system", "premium"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const docDesign404Tamper = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    const storedDesign404 = await page.evaluate(() => localStorage.getItem("ai_sales_design_system"));
    recordTest("missing_subscription_404", "blocks_tamper_on_404", docDesign404Tamper === "classic" && storedDesign404 === "classic", `data-design=${docDesign404Tamper}`);

    // -------------------------------------------------------------
    // TEST CASE 5: EXPIRED / CANCELED SUBSCRIPTION
    // -------------------------------------------------------------
    console.log("\n[5] Testing Expired / Canceled Subscription...");
    await mockSubscription("start", "canceled", { is_active: false, trial_days_remaining: 0 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    const docDesignExpired = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("expired_subscription", "expired_plan_forces_classic", docDesignExpired === "classic", `data-design=${docDesignExpired}`);

    // -------------------------------------------------------------
    // TEST CASE 6: API FAILURE (HTTP 500)
    // -------------------------------------------------------------
    console.log("\n[6] Testing API Failure (500 Error)...");
    await mockSubscription(500);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    const docDesign500 = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("api_failure_500", "safe_classic_fallback_on_500", docDesign500 === "classic", `data-design=${docDesign500}`);

    // -------------------------------------------------------------
    // TEST CASE 7: PLATFORM OWNER AUTHENTICATED SESSION
    // -------------------------------------------------------------
    console.log("\n[7] Testing Verified Platform Owner Session Override...");
    await setPlatformOwnerSession();
    await mockSubscription("start");

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    // Platform Owner can select Premium even on START plan
    const premiumCardOwner = page.locator('.col-12.col-md-4').filter({ hasText: "Premium Minimal" });
    await premiumCardOwner.click();
    await page.waitForTimeout(400);

    const docDesignOwner = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("platform_owner_session", "owner_override_premium_on_start_plan", docDesignOwner === "premium", `data-design=${docDesignOwner}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "entitlement_04_owner_override.png") });

    // -------------------------------------------------------------
    // TEST CASE 8: NON-OWNER SPOOF ATTEMPT
    // -------------------------------------------------------------
    console.log("\n[8] Testing Non-Owner Tenant Spoof Attempt...");
    // Return to tenant session (isPlatformOwner: false)
    await setTenantSession();
    await mockSubscription("start");

    // Tenant user injects "premium" into localStorage while on START plan
    await page.evaluate(() => localStorage.setItem("ai_sales_design_system", "premium"));
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    const docDesignSpoof = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    const storedDesignSpoof = await page.evaluate(() => localStorage.getItem("ai_sales_design_system"));
    recordTest("non_owner_spoof_sanitization", "tenant_owner_denied_platform_override", docDesignSpoof === "classic", `data-design=${docDesignSpoof}`);
    recordTest("non_owner_spoof_sanitization", "spoofed_storage_sanitized_to_classic", storedDesignSpoof === "classic", `localStorage=${storedDesignSpoof}`);

    // -------------------------------------------------------------
    // TEST CASE 9: LOGOUT REVOCATION & ACTUAL UI LOGOUT
    // -------------------------------------------------------------
    console.log("\n[9] Testing Actual UI Logout & Elevated Design Revocation...");
    // Set Platform Owner session and active premium design
    await setPlatformOwnerSession();
    await page.goto(`${BASE_URL}/dashboard#profile`);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      localStorage.setItem("ai_sales_design_system", "premium");
      document.documentElement.setAttribute("data-design", "premium");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Verify Premium was active prior to logout
    const docDesignPreLogout = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("logout_revocation", "premium_active_pre_logout", docDesignPreLogout === "premium", `pre-logout data-design=${docDesignPreLogout}`);

    // Trigger actual UI logout via the rendered Logout button on ProfileTab
    const profileLogoutBtn = page.locator('button:has-text("Tizimdan chiqish"), button:has-text("Logout")').first();
    let clickedUiLogout = false;
    if (await profileLogoutBtn.isVisible()) {
      await profileLogoutBtn.click();
      clickedUiLogout = true;
    } else {
      // Topbar user menu fallback trigger
      const userMenuTrigger = page.locator('header button').filter({ has: page.locator('.rounded-circle') }).last();
      if (await userMenuTrigger.isVisible()) {
        await userMenuTrigger.click();
        await page.waitForTimeout(300);
        const topbarLogoutBtn = page.locator('button:has-text("Chiqish")').first();
        if (await topbarLogoutBtn.isVisible()) {
          await topbarLogoutBtn.click();
          clickedUiLogout = true;
        }
      }
    }

    recordTest("logout_revocation", "actual_ui_logout_clicked", clickedUiLogout, `UI logout button clicked successfully without test-side eval`);

    // Await transition to unauthenticated state (Login form displayed)
    await page.waitForSelector('#admin-pwd, input[type="password"]', { timeout: 8000 });
    await page.waitForTimeout(500);

    // 1. Verify server session cookie invalidation
    const cookiesAfterLogout = await context.cookies();
    const sessionCookie = cookiesAfterLogout.find((c) => c.name === "sales_session");
    const cookieInvalidated = !sessionCookie || sessionCookie.value === "" || sessionCookie.expires <= Math.floor(Date.now() / 1000);
    recordTest("logout_revocation", "server_cookie_invalidated", cookieInvalidated, `cookie status: ${sessionCookie ? (sessionCookie.value === "" ? "empty" : "active") : "cleared"}`);

    // 2. Verify root DOM design reset to classic
    const docDesignAfterLogout = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("logout_revocation", "design_reset_to_classic", docDesignAfterLogout === "classic", `post-logout data-design=${docDesignAfterLogout}`);

    // 3. Verify localStorage design key purged
    const storedAfterLogout = await page.evaluate(() => localStorage.getItem("ai_sales_design_system"));
    recordTest("logout_revocation", "storage_cleared", storedAfterLogout === null, `localStorage=${storedAfterLogout}`);

    // 4. Verify unauthenticated login card rendered
    const loginCardVisible = await page.locator("#admin-pwd").isVisible();
    recordTest("logout_revocation", "unauthenticated_view_rendered", loginCardVisible, `login card visible=${loginCardVisible}`);

    // -------------------------------------------------------------
    // TEST CASE 10: ORGANIZATION SWITCHING (ULTRA <-> START)
    // -------------------------------------------------------------
    console.log("\n[10] Testing Organization Switching Plan Adjustment...");
    await setTenantSession(101); // Org 1 (ULTRA)
    await mockSubscription("ultra");

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.goto(`${BASE_URL}/dashboard#profile`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);

    // In Org 1 (ULTRA), select Premium
    const cardPrem = page.locator('.col-12.col-md-4').filter({ hasText: "Premium Minimal" });
    await cardPrem.first().click();
    await page.waitForTimeout(500);

    const org1Design = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("org_switching", "org1_ultra_selects_premium", org1Design === "premium", `Org 1 design=${org1Design}`);

    // Switch to Org 2 (START)
    await setTenantSession(102); // Org 2 (START)
    await mockSubscription("start");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const org2Design = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("org_switching", "org2_start_demotes_to_classic", org2Design === "classic", `Org 2 design=${org2Design}`);

    // Switch back to Org 1 (ULTRA)
    await setTenantSession(101); // Back to Org 1
    await mockSubscription("ultra");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const cardPremBack = page.locator('.col-12.col-md-4').filter({ hasText: "Premium Minimal" });
    if (await cardPremBack.isVisible()) {
      await cardPremBack.click();
      await page.waitForTimeout(300);
    }
    const org1DesignBack = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("org_switching", "org1_reauthorize_premium", org1DesignBack === "premium", `Org 1 design back=${org1DesignBack}`);

    // -------------------------------------------------------------
    // TEST CASE 11: DOWNGRADE TRANSITION
    // -------------------------------------------------------------
    console.log("\n[11] Testing Live Downgrade Demotion...");
    // Current design is Premium on Org 1. Organization subscription is downgraded to START.
    await mockSubscription("start");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const finalDesign = await page.evaluate(() => document.documentElement.getAttribute("data-design"));
    recordTest("downgrade_transition", "active_premium_gracefully_demoted_to_classic", finalDesign === "classic", `final data-design=${finalDesign}`);

    // Record Overall Status
    testResults.summary.overall_status = testResults.summary.failed === 0 ? "PASSED" : "FAILED";
  } catch (err) {
    console.error("\n[SUITE EXCEPTION]", err);
    testResults.summary.overall_status = "FAILED";
    testResults.unhandled_exception = err.message;
  } finally {
    if (browser) {
      await browser.close();
    }

    fs.writeFileSync(
      path.join(__dirname, "entitlement_integration_results.json"),
      JSON.stringify(testResults, null, 2)
    );

    console.log("\n==================================================================");
    console.log(`ENTITLEMENT INTEGRATION SUITE FINISHED: ${testResults.summary.passed}/${testResults.summary.total} PASSED (${testResults.summary.failed} failed)`);
    console.log(`Overall Status: ${testResults.summary.overall_status}`);
    console.log("==================================================================");

    if (testResults.summary.failed > 0) {
      process.exit(1);
    }
  }
}

runEntitlementIntegration();
