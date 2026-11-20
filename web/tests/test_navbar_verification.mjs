import { chromium } from 'playwright';

async function testNavbar() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Take screenshot at the very top
  await page.screenshot({ path: 'tests/screenshots/navbar_top.png' });

  // 2. Scroll down 800px to verify navbar is fixed and frozen at top
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'tests/screenshots/navbar_scrolled.png' });

  // 3. Hover over a nav link to inspect hover styling
  const firstLink = page.locator('.selloi-nav-link').first();
  await firstLink.hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tests/screenshots/navbar_hover_link.png' });

  // 4. Hover over the CTA button
  const ctaBtn = page.locator('.selloi-btn-glass').first();
  await ctaBtn.hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tests/screenshots/navbar_hover_cta.png' });

  // 5. Check styles
  const styles = await page.evaluate(() => {
    const link = document.querySelector('.selloi-nav-link');
    const nav = document.querySelector('.selloi-navbar');
    const logo = document.querySelector('.selloi-nav-logo');
    const logoImg = document.querySelector('.selloi-nav-logo img');
    const logoText = document.querySelector('.selloi-nav-logo-text');
    return {
      linkTextDecoration: window.getComputedStyle(link).textDecorationLine,
      navPosition: window.getComputedStyle(nav).position,
      navZIndex: window.getComputedStyle(nav).zIndex,
      logoGap: window.getComputedStyle(logo).gap,
      logoImgWidth: logoImg?.getBoundingClientRect().width,
      logoImgHeight: logoImg?.getBoundingClientRect().height,
      logoTextFontSize: window.getComputedStyle(logoText).fontSize,
      logoTextFontWeight: window.getComputedStyle(logoText).fontWeight,
    };
  });

  console.log('COMPUTED_STYLES:', JSON.stringify(styles, null, 2));
  await browser.close();
}

testNavbar().catch(console.error);
