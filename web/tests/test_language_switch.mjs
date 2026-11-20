import { chromium } from "playwright";
import fs from "fs";

function getExecutablePath() {
  const winChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const winChromeX86 = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
  if (fs.existsSync(winChrome)) return winChrome;
  if (fs.existsSync(winChromeX86)) return winChromeX86;
  return undefined;
}

async function testLanguageSwitch() {
  console.log("Testing 3-language switching on http://localhost:3000/ ...");
  const browser = await chromium.launch({
    headless: true,
    executablePath: getExecutablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });

  // 1. Initial State: Uzbek
  console.log("1. Checking Uzbek default state...");
  const heroTitleUz = await page.locator(".selloi-hero-title").innerText();
  console.log("  UZ Hero Title:", heroTitleUz.replace(/\n/g, " "));
  if (!heroTitleUz.includes("Do’koningiz uchun")) {
    throw new Error("Uzbek hero title not matching");
  }

  // 2. Open Language Menu and select Russian (Ru)
  console.log("2. Switching to Russian (Ru)...");
  const langBtn = page.locator(".selloi-btn-lang");
  await langBtn.click();
  await page.waitForTimeout(200);

  const ruOption = page.locator(".selloi-lang-option:has-text('Русский')");
  await ruOption.click();
  await page.waitForTimeout(400);

  const heroTitleRu = await page.locator(".selloi-hero-title").innerText();
  console.log("  RU Hero Title:", heroTitleRu.replace(/\n/g, " "));
  const heroCtaRu = await page.locator(".selloi-hero-btn").innerText();
  console.log("  RU Hero CTA:", heroCtaRu);
  if (!heroTitleRu.includes("Для вашего магазина")) {
    throw new Error("Russian hero title not matching after switch");
  }

  // 3. Open Language Menu and select English (En)
  console.log("3. Switching to English (En)...");
  await langBtn.click();
  await page.waitForTimeout(200);

  const enOption = page.locator(".selloi-lang-option:has-text('English')");
  await enOption.click();
  await page.waitForTimeout(400);

  const heroTitleEn = await page.locator(".selloi-hero-title").innerText();
  console.log("  EN Hero Title:", heroTitleEn.replace(/\n/g, " "));
  const heroCtaEn = await page.locator(".selloi-hero-btn").innerText();
  console.log("  EN Hero CTA:", heroCtaEn);
  if (!heroTitleEn.includes("For your store")) {
    throw new Error("English hero title not matching after switch");
  }

  // 4. Switch back to Uzbek
  console.log("4. Switching back to Uzbek (Uz)...");
  await langBtn.click();
  await page.waitForTimeout(200);

  const uzOption = page.locator(".selloi-lang-option:has-text('O‘zbekcha')");
  await uzOption.click();
  await page.waitForTimeout(400);

  const heroTitleUzBack = await page.locator(".selloi-hero-title").innerText();
  console.log("  UZ Hero Title (back):", heroTitleUzBack.replace(/\n/g, " "));
  if (!heroTitleUzBack.includes("Do’koningiz uchun")) {
    throw new Error("Uzbek hero title not matching when switching back");
  }

  await browser.close();
  console.log("3-LANGUAGE SWITCHING TEST PASSED 100%!");
}

testLanguageSwitch().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
