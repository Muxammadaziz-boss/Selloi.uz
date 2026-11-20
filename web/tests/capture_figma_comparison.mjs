import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");

function getExecutablePath() {
  const winChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const winChromeX86 = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
  if (fs.existsSync(winChrome)) return winChrome;
  if (fs.existsSync(winChromeX86)) return winChromeX86;
  return undefined;
}

async function main() {
  console.log("Starting screenshot capture...");
  const executablePath = getExecutablePath();
  console.log("Using Chrome executable:", executablePath);

  const browser = await chromium.launch({
    headless: true,
    executablePath,
  });

  // 1. Desktop 1440px
  const contextDesktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const pageDesktop = await contextDesktop.newPage();
  await pageDesktop.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await pageDesktop.waitForTimeout(1000);

  const desktopScreenshotPath = path.join(SCREENSHOT_DIR, "implemented_desktop_1440.png");
  await pageDesktop.screenshot({
    path: desktopScreenshotPath,
    fullPage: true,
  });
  console.log("Desktop screenshot saved:", desktopScreenshotPath);

  // Measure section dimensions & bounding boxes
  const sectionMetrics = await pageDesktop.evaluate(() => {
    const sections = [
      { name: "Navbar", selector: ".selloi-navbar" },
      { name: "Hero", selector: ".selloi-hero-section" },
      { name: "Imkoniyatlar", selector: "#imkoniyatlar" },
      { name: "QandayIshlaydi", selector: "#qanday-ishlaydi" },
      { name: "SuhbatNamunasi", selector: "#suhbat-namunasi" },
      { name: "Tariflar", selector: "#tariflar" },
      { name: "FAQ", selector: "#faq" },
      { name: "FinalCTA", selector: "#boshlash" },
      { name: "Footer", selector: ".selloi-footer" },
    ];
    return sections.map((s) => {
      const el = document.querySelector(s.selector);
      if (!el) return { name: s.name, found: false };
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        name: s.name,
        found: true,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top + window.scrollY),
        bg: style.backgroundColor,
      };
    });
  });
  console.log("Section metrics:", JSON.stringify(sectionMetrics, null, 2));

  // 2. Responsive: Tablet 768px
  const contextTablet = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 1,
  });
  const pageTablet = await contextTablet.newPage();
  await pageTablet.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await pageTablet.waitForTimeout(500);
  const tabletScreenshotPath = path.join(SCREENSHOT_DIR, "implemented_tablet_768.png");
  await pageTablet.screenshot({
    path: tabletScreenshotPath,
    fullPage: true,
  });
  console.log("Tablet screenshot saved:", tabletScreenshotPath);

  // 3. Responsive: Mobile 375px
  const contextMobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const pageMobile = await contextMobile.newPage();
  await pageMobile.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await pageMobile.waitForTimeout(500);
  const mobileScreenshotPath = path.join(SCREENSHOT_DIR, "implemented_mobile_375.png");
  await pageMobile.screenshot({
    path: mobileScreenshotPath,
    fullPage: true,
  });
  console.log("Mobile screenshot saved:", mobileScreenshotPath);

  // Check overflow
  const overflows = {
    desktop: await pageDesktop.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    tablet: await pageTablet.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    mobile: await pageMobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  };
  console.log("No overflow checks (true = pass):", overflows);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
