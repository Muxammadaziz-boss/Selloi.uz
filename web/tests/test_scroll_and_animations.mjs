import { chromium } from "playwright";

async function testScrollAndAnimations() {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  console.log("Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 1. Verify Hero Animation & Glow
  const heroMockup = page.locator(".selloi-browser-mockup");
  const heroGlow = page.locator(".selloi-hero-mockup-glow");
  console.log("Hero mockup count:", await heroMockup.count());
  console.log("Hero glow count:", await heroGlow.count());

  // 2. Scroll down past Suhbat namunasi to Tariflar (#tariflar)
  console.log("Scrolling down to #tariflar...");
  const tarifSection = page.locator("#tariflar");
  await tarifSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const initialScrollY = await page.evaluate(() => window.scrollY);
  console.log("Current scrollY at #tariflar:", initialScrollY);

  // Wait 4 seconds while chat simulation runs in the background.
  // In the buggy version, this would jump back to ~2000px!
  console.log("Waiting 4 seconds to verify NO unwanted scroll jump occurs...");
  await page.waitForTimeout(4000);

  const afterWaitScrollY = await page.evaluate(() => window.scrollY);
  console.log("ScrollY after 4 seconds wait:", afterWaitScrollY);

  const diff = Math.abs(afterWaitScrollY - initialScrollY);
  if (diff > 50) {
    console.error("FAIL: Scroll position jumped! Bug still present. Diff:", diff);
    process.exit(1);
  } else {
    console.log("PASS: Scroll position is rock solid and does NOT jump! Diff:", diff);
  }

  // 3. Scroll all the way to footer
  console.log("Scrolling to footer...");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(1000);

  const footerScrollY = await page.evaluate(() => window.scrollY);
  console.log("Footer scrollY:", footerScrollY);

  // Wait another 3 seconds at footer
  await page.waitForTimeout(3000);
  const footerAfterWaitScrollY = await page.evaluate(() => window.scrollY);
  const footerDiff = Math.abs(footerAfterWaitScrollY - footerScrollY);
  if (footerDiff > 50) {
    console.error("FAIL: Scroll jumped from footer! Diff:", footerDiff);
    process.exit(1);
  } else {
    console.log("PASS: Stays completely at bottom/footer without any interruption! Diff:", footerDiff);
  }

  // 4. Capture screenshot of Tariflar & FAQ
  await tarifSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "C:/Users/Administrator/.gemini/antigravity/brain/cb7c0854-f8a8-4ee9-9f38-c81f1a97459d/verified_tariflar_scroll.png",
  });
  console.log("Screenshot saved!");

  await browser.close();
}

testScrollAndAnimations().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
