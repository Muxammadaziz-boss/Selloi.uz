import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_DIR = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function getLaunchOptions() {
  const opts = { headless: true };
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    opts.executablePath = process.env.CHROME_PATH;
    return opts;
  }
  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        opts.executablePath = candidate;
        return opts;
      }
    }
  }
  return opts;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 3105;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttpReady(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      // retry until server listens
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for Next.js server at ${url}`);
}

function createSignedSessionCookie(payload, secret) {
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      issuedAt: payload.issuedAt || Math.floor(Date.now() / 1000),
    })
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(`ai-sales:v2:${data}`).digest("hex");
  return `v2.${data}.${sig}`;
}

function buildMockProxyPayload(apiPath) {
  if (apiPath.startsWith("/admin/overview")) {
    return {
      conversations: 14,
      ai_active: 11,
      human_takeover: 3,
      knowledge_posts: 28,
      orders: 4,
    };
  }
  if (apiPath.startsWith("/admin/conversations")) {
    if (apiPath.includes("/messages")) {
      return [
        { id: 1, direction: "customer", text: "Salom, iPhone 16 Pro narxi qancha?", created_at: new Date().toISOString() },
        { id: 2, direction: "assistant", text: "Salom! iPhone 16 Pro 256GB narxi $1,199.", created_at: new Date().toISOString() },
      ];
    }
    return [
      {
        id: 101,
        customer_name: "Aziz Karimov",
        username: "aziz_k",
        chat_id: 9001122,
        status: "ai_active",
        last_message_at: new Date().toISOString(),
      },
    ];
  }
  if (apiPath.startsWith("/admin/knowledge")) {
    return [
      {
        id: 1,
        channel_username: "techhub_uz",
        telegram_message_id: 42,
        text: "iPhone 16 Pro 256GB Desert Titanium - $1,199",
        image_description: "Smartphone",
      },
    ];
  }
  if (apiPath.startsWith("/admin/channels")) {
    return [{ id: 1, channel_username: "techhub_uz", title: "TechHub UZ", is_active: true, posts_count: 28 }];
  }
  if (apiPath.startsWith("/admin/products")) {
    return [
      {
        id: "PRD-01",
        name: "iPhone 16 Pro 256GB",
        category: "Smartfonlar",
        specs: "256GB, Natural Titanium",
        price: "$1,199",
        stock: "In Stock",
        warranty: "1 yil",
      },
    ];
  }
  if (apiPath.startsWith("/admin/orders")) {
    return [
      {
        id: "ORD-101",
        db_id: 101,
        conversation_id: 101,
        customer: "Aziz Karimov",
        username: "aziz_k",
        product: "iPhone 16 Pro 256GB",
        amount: "$1,199",
        status: "Confirmed",
        date: new Date().toISOString(),
        channel: "@techhub_uz",
      },
    ];
  }
  if (apiPath.startsWith("/admin/admins")) {
    return [
      {
        id: 1,
        telegram_user_id: 1234567,
        name: "Store Owner",
        username: "owner_uz",
        role: "owner",
        permissions: {},
        is_active: true,
      },
    ];
  }
  if (apiPath.startsWith("/admin/settings")) {
    return { public_channel: "techhub_uz" };
  }
  if (apiPath.startsWith("/admin/logs")) {
    return { logs: [] };
  }
  if (apiPath.startsWith("/admin/payments/config")) {
    return { provider: "tezcheck", is_enabled: false };
  }
  if (apiPath.startsWith("/admin/followup/config")) {
    return { config: { is_enabled: true, first_delay_minutes: 30, second_delay_minutes: 180 }, history: [], stats: {} };
  }
  if (apiPath.startsWith("/admin/reports/config")) {
    return { config: { is_enabled: true, send_hour: 21, timezone: "Asia/Tashkent" }, history: [] };
  }
  if (apiPath.startsWith("/api/subscription")) {
    return {
      plan: { code: "pro", name: "PRO", price_usd: 49 },
      status: "active",
      is_active: true,
      billing_cycle: "monthly",
      trial_days_remaining: 0,
    };
  }
  if (apiPath.startsWith("/api/usage")) {
    return {
      items: [{ key: "ai_messages", label: "AI xabarlar", used: 320, limit: 5000, percentage: 6.4 }],
    };
  }
  if (apiPath.startsWith("/api/plans")) {
    return {
      plans: [
        { code: "start", name: "START", price_usd: 19 },
        { code: "pro", name: "PRO", price_usd: 49 },
        { code: "ultra", name: "ULTRA", price_usd: 99 },
      ],
    };
  }
  if (apiPath.startsWith("/api/organizations/current")) {
    return {
      id: 1,
      name: "TechHub Toshkent",
      slug: "techhub-toshkent",
      bot_username: "techhub_sales_bot",
      custom_system_prompt: "Sotuv konsultanti sifatida javob bering.",
    };
  }
  if (apiPath.startsWith("/api/organizations")) {
    return { organizations: [{ id: 1, name: "TechHub Toshkent", slug: "techhub-toshkent" }] };
  }
  if (apiPath.startsWith("/api/platform/metrics")) {
    return {
      mrr_usd: 1470,
      arr_usd: 17640,
      arpu_usd: 49,
      total_organizations: 12,
      active_subscriptions: 9,
      trial_organizations: 3,
      churn_rate_percent: 2.1,
      total_ai_messages_this_month: 24500,
      total_ai_cost_usd: 38.4,
      gross_margin_percent: 97.4,
      plan_distribution: { start: 4, pro: 5, ultra: 3 },
    };
  }
  if (apiPath.startsWith("/api/platform/organizations")) {
    return {
      organizations: [
        {
          id: 1,
          name: "TechHub Toshkent",
          slug: "techhub-toshkent",
          category: "Elektronika",
          status: "active",
          plan: "pro",
          subscription_status: "active",
          monthly_revenue_usd: 49,
          ai_messages_this_month: 320,
          ai_cost_usd: 0.45,
          orders_count: 18,
          owner_email: "owner@techhub.uz",
        },
      ],
    };
  }
  if (apiPath.startsWith("/api/platform/users")) {
    return {
      users: [
        {
          id: 1,
          email: "owner@selloi.uz",
          full_name: "Platform Owner",
          is_platform_owner: true,
          is_platform_admin: true,
          is_active: true,
        },
      ],
    };
  }
  if (apiPath.startsWith("/api/platform/system-health")) {
    return { database: "healthy", latency_ms: 4, status: "ok", version: "2.0.0" };
  }
  if (apiPath.startsWith("/api/platform/audit-logs")) {
    return { logs: [] };
  }
  return { ok: true };
}

async function attachApiMocks(page) {
  await page.route("**/api/proxy**", async (route) => {
    const reqUrl = new URL(route.request().url());
    const targetPath = decodeURIComponent(reqUrl.searchParams.get("path") || "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildMockProxyPayload(targetPath)),
    });
  });

  await page.route("**/api/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "event: ping\ndata: {}\n\n",
    });
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  if (overflow.scrollWidth > overflow.innerWidth + 2) {
    throw new Error(
      `${label}: horizontal overflow detected (scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.innerWidth})`
    );
  }
}

async function assertNoCriticalA11yViolations(page, label) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical");
  if (critical.length > 0) {
    const summary = critical
      .map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes -> ${v.nodes.map((n) => n.target.join(" ")).join(", ")})`)
      .join("; ");
    throw new Error(`${label}: critical WCAG violations -> ${summary}`);
  }
  return results.violations.length;
}

async function runSuite() {
  const envFromFiles = {
    ...parseEnvFile(path.join(WEB_DIR, ".env")),
    ...parseEnvFile(path.join(WEB_DIR, ".env.local")),
  };
  const sessionSecret =
    process.env.SESSION_SECRET ||
    envFromFiles.SESSION_SECRET ||
    "selloi-local-e2e-regression-secret-2026";

  let serverProc = null;
  let baseUrl = (process.env.TEST_BASE_URL || "").replace(/\/$/, "");

  if (!baseUrl) {
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const nextBin = path.join(WEB_DIR, "node_modules", "next", "dist", "bin", "next");
    if (!fs.existsSync(nextBin)) {
      throw new Error(`Next binary not found at ${nextBin}. Run npm install in web/ first.`);
    }
    serverProc = spawn(process.execPath, [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"], {
      cwd: WEB_DIR,
      env: { ...process.env, SESSION_SECRET: sessionSecret },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverErr = "";
    serverProc.stderr.on("data", (chunk) => {
      serverErr += chunk.toString();
    });
    try {
      await waitForHttpReady(baseUrl, 30000);
    } catch (err) {
      serverProc.kill();
      throw new Error(`${err.message}\n${serverErr}`);
    }
  }

  console.log(`[E2E] Target URL: ${baseUrl}`);
  const browser = await chromium.launch(getLaunchOptions());
  const report = [];

  try {
    const originUrl = new URL(baseUrl);

    // 1. Public Landing & Legal Routes + Responsive + Axe
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message}`));

      const res = await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      if (!res || res.status() >= 400) throw new Error(`Landing returned HTTP ${res?.status()}`);
      await page.waitForSelector("body");
      const text = await page.textContent("body");
      if (!text || !text.includes("Selloi")) throw new Error("Landing page missing Selloi branding");
      await assertNoHorizontalOverflow(page, "Landing desktop");
      const a11yCount = await assertNoCriticalA11yViolations(page, "Landing desktop");

      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);
      await assertNoHorizontalOverflow(page, "Landing mobile");

      for (const legalRoute of ["/privacy", "/terms"]) {
        const lRes = await page.goto(`${baseUrl}${legalRoute}`, { waitUntil: "domcontentloaded" });
        if (!lRes || lRes.status() >= 400) throw new Error(`${legalRoute} returned HTTP ${lRes?.status()}`);
        await assertNoHorizontalOverflow(page, `${legalRoute} mobile`);
      }

      if (pageErrors.length > 0) throw new Error(`Public pages JS errors: ${pageErrors.join(" | ")}`);
      report.push(`PASS landing + legal routes (0 critical a11y, ${a11yCount} minor/moderate)`);
      await ctx.close();
    }

    // 2. /login Page (UZ/RU/EN switch + 2-Step Forgot Password Modal + Mobile + Axe)
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message}`));

      await page.route("**/api/auth/forgot-password", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, message: "Kod yuborildi" }),
        });
      });

      const res = await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
      if (!res || res.status() >= 400) throw new Error(`/login returned HTTP ${res?.status()}`);

      await page.getByRole("button", { name: "RU", exact: true }).click();
      await page.getByText("Экосистема продаж на базе искусственного интеллекта").waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "EN", exact: true }).click();
      await page.getByText("AI-Powered Sales Automation Ecosystem").waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "UZ", exact: true }).click();
      await page.getByText("Sun'iy intellekt asosidagi savdo ekotizimi").waitFor({ timeout: 5000 });

      await page.locator(".selloi-forgot-link").click();
      await page.locator(".selloi-modal-content").waitFor({ state: "visible", timeout: 5000 });
      await page.locator(".selloi-modal-content input[type='email']").fill("merchant@selloi.uz");
      await page.locator(".selloi-modal-btn-confirm").click();
      await page.locator('.selloi-modal-content input[maxlength="6"]').waitFor({ state: "visible", timeout: 5000 });
      await page.locator(".selloi-modal-btn-cancel").click();

      const loginA11y = await assertNoCriticalA11yViolations(page, "Login desktop");
      await page.setViewportSize({ width: 375, height: 812 });
      await assertNoHorizontalOverflow(page, "Login mobile");
      if (pageErrors.length > 0) throw new Error(`/login JS errors: ${pageErrors.join(" | ")}`);
      report.push(`PASS /login i18n + 2-step reset modal (0 critical a11y, ${loginA11y} minor/moderate)`);
      await ctx.close();
    }

    // 3. Authenticated Store Dashboard (/dashboard)
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const token = createSignedSessionCookie(
        {
          userId: 101,
          email: "store@selloi.uz",
          fullName: "TechHub Store Owner",
          role: "owner",
          organizationId: 1,
          isPlatformOwner: false,
          isPlatformAdmin: false,
        },
        sessionSecret
      );
      await ctx.addCookies([
        {
          name: "sales_session",
          value: token,
          domain: originUrl.hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      const page = await ctx.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await attachApiMocks(page);

      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) {
        throw new Error("Store session was rejected and redirected to /login");
      }

      await page.getByText("TechHub Toshkent").first().waitFor({ timeout: 10000 });
      for (const tabName of ["orders", "products", "settings"]) {
        await page.goto(`${baseUrl}/dashboard#${tabName}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(250);
      }

      await assertNoHorizontalOverflow(page, "Dashboard desktop");
      const dashA11y = await assertNoCriticalA11yViolations(page, "Dashboard desktop");
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);
      await assertNoHorizontalOverflow(page, "Dashboard mobile");

      if (pageErrors.length > 0) throw new Error(`/dashboard JS errors: ${pageErrors.join(" | ")}`);
      report.push(`PASS /dashboard refactored tabs + responsive (0 critical a11y, ${dashA11y} minor/moderate)`);
      await ctx.close();
    }

    // 4. Authenticated Platform Owner Admin Portal (/admin)
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const adminToken = createSignedSessionCookie(
        {
          userId: 1,
          email: "owner@selloi.uz",
          fullName: "Selloi Platform Owner",
          role: "owner",
          organizationId: 1,
          isPlatformOwner: true,
          isPlatformAdmin: true,
        },
        sessionSecret
      );
      await ctx.addCookies([
        {
          name: "sales_session",
          value: adminToken,
          domain: originUrl.hostname,
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      const page = await ctx.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await attachApiMocks(page);

      await page.goto(`${baseUrl}/admin`, { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) {
        throw new Error("Platform Owner session was rejected and redirected to /login");
      }

      await page.getByText("MRR").first().waitFor({ timeout: 10000 });
      await assertNoHorizontalOverflow(page, "Admin desktop");
      const adminA11y = await assertNoCriticalA11yViolations(page, "Admin desktop");
      await page.setViewportSize({ width: 375, height: 812 });
      await page.waitForTimeout(200);
      await assertNoHorizontalOverflow(page, "Admin mobile");

      // Platform Owner visiting /dashboard must be strictly redirected to /admin
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded" });
      if (!new URL(page.url()).pathname.startsWith("/admin")) {
        throw new Error(`Expected Platform Owner on /dashboard to redirect to /admin, got ${page.url()}`);
      }

      // Platform Owner visiting a store via /t/[slug] has NO yellow reminder banner and HAS "Admin panelga qaytish" in Profile menu
      await page.goto(`${baseUrl}/t/techhub-toshkent`, { waitUntil: "domcontentloaded" });
      await page.getByText("TechHub Toshkent").first().waitFor({ timeout: 10000 });
      const bannerCount = await page.getByText("Platformaga qaytish").count();
      if (bannerCount > 0) {
        throw new Error("Sticky impersonation reminder banner should not be rendered inside client store mode");
      }
      await page.getByRole("button", { name: /profil menyusi/i }).click();
      const returnBtn = page.getByRole("button", { name: /Admin panelga qaytish/i });
      await returnBtn.waitFor({ state: "visible", timeout: 5000 });
      await returnBtn.click();
      await page.getByPlaceholder("Do'kon nomi yoki slug...").waitFor({ state: "visible", timeout: 10000 });
      if (!new URL(page.url()).pathname.startsWith("/admin")) {
        throw new Error(`Expected returning from profile menu to navigate to /admin, got ${page.url()}`);
      }

      if (pageErrors.length > 0) throw new Error(`/admin JS errors: ${pageErrors.join(" | ")}`);
      report.push(`PASS /admin redirect + /t/[slug] profile return flow (0 critical a11y, ${adminA11y} minor/moderate)`);
      await ctx.close();
    }

    console.log("\n=== SELLOI REGRESSION E2E SUMMARY ===");
    for (const line of report) console.log(` - ${line}`);
  } finally {
    await browser.close();
    if (serverProc && !serverProc.killed) {
      serverProc.kill("SIGTERM");
    }
  }
}

runSuite().catch((err) => {
  console.error("[E2E FAILED]", err);
  process.exit(1);
});
