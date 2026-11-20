import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/#suhbat-namunasi...");
  await page.goto("http://localhost:3000/#suhbat-namunasi", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Scroll to demo section
  const demoSection = page.locator("#suhbat-namunasi");
  await demoSection.scrollIntoViewIfNeeded();

  console.log("Waiting for user message step (step 1)...");
  await page.waitForSelector(".selloi-demo-user-msg", { timeout: 8000 });
  console.log("User message appeared!");

  console.log("Waiting for bot response (step 3)...");
  await page.waitForSelector(".selloi-demo-bot-msg", { timeout: 8000 });
  console.log("Bot message appeared!");

  console.log("Waiting for photo card (step 5)...");
  await page.waitForSelector(".selloi-demo-user-photo-card", { timeout: 8000 });
  console.log("Photo card appeared with sample sneaker!");

  console.log("Waiting for AI vision recognition & order card (step 8)...");
  await page.waitForSelector(".selloi-demo-order-card", { timeout: 12000 });
  console.log("Order card appeared!");

  // Take screenshot of the completed conversation
  await page.waitForTimeout(1000);
  const screenshotPath = "C:/Users/Administrator/.gemini/antigravity/brain/cb7c0854-f8a8-4ee9-9f38-c81f1a97459d/live_demo_screenshot.png";
  const demoCard = page.locator(".selloi-demo-card");
  await demoCard.screenshot({ path: screenshotPath });
  console.log("Saved card screenshot to:", screenshotPath);

  // Take whole section screenshot
  await demoSection.screenshot({ path: "C:/Users/Administrator/.gemini/antigravity/brain/cb7c0854-f8a8-4ee9-9f38-c81f1a97459d/live_demo_section.png" });
  console.log("Saved section screenshot!");

  await browser.close();
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
