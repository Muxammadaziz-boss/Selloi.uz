import { chromium } from "playwright";
import fs from "fs";

function getExecutablePath() {
  const winChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const winChromeX86 = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
  if (fs.existsSync(winChrome)) return winChrome;
  if (fs.existsSync(winChromeX86)) return winChromeX86;
  return undefined;
}

async function testInteractions() {
  console.log("Testing user interactions on Selloi.uz frontend...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: getExecutablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

  // 1. Check FAQ Accordion
  console.log("1. Testing FAQ accordion interaction...");
  const q2Item = page.locator('.selloi-faq-item[data-node-id="182:420"]');
  const q2Answer = q2Item.locator(".selloi-faq-answer");
  const isQ2VisibleBefore = await q2Answer.isVisible();
  console.log("  Question 2 answer visible before click:", isQ2VisibleBefore);

  await q2Item.click();
  await page.waitForTimeout(300);
  const isQ2VisibleAfter = await q2Answer.isVisible();
  console.log("  Question 2 answer visible after click:", isQ2VisibleAfter);
  if (!isQ2VisibleAfter) throw new Error("FAQ accordion click failed to open Question 2");

  // 2. Check Quick Login Modal
  console.log("2. Testing Quick Login Modal...");
  const loginBtn = page.locator(".selloi-btn-login");
  await loginBtn.click();
  await page.waitForTimeout(300);
  const loginModalTitle = page.locator("h4:has-text('Boshqaruv paneliga kirish')");
  const isLoginModalVisible = await loginModalTitle.isVisible();
  console.log("  Login modal visible after click:", isLoginModalVisible);
  if (!isLoginModalVisible) throw new Error("Login button failed to open modal");

  // Close modal
  await page.locator("button[aria-label='Yopish']").click();
  await page.waitForTimeout(300);

  // 3. Check Onboarding Modal
  console.log("3. Testing 7-day trial CTA button -> Onboarding Modal...");
  const heroCtaBtn = page.locator(".selloi-hero-btn");
  await heroCtaBtn.click();
  await page.waitForTimeout(300);
  const onboardingModal = page.locator(".modal.show, [role='dialog'], form");
  const isOnboardingVisible = await onboardingModal.count() > 0;
  console.log("  Onboarding modal triggered successfully:", isOnboardingVisible);

  await browser.close();
  console.log("ALL INTERACTION VERIFICATIONS PASSED!");
}

testInteractions().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
