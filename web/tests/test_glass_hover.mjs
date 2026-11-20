import { chromium } from 'playwright';

async function testGlassHover() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Initial state screenshot of Hero CTA button
  const heroBtn = page.locator('.selloi-hero-btn').first();
  await heroBtn.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'tests/screenshots/hero_btn_normal.png' });

  // 2. Trigger hover on the hero button
  const box = await heroBtn.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Wait ~200ms to catch the sheen during transit
    await page.waitForTimeout(200);
    await page.screenshot({ path: 'tests/screenshots/hero_btn_hover_mid.png' });
    
    // Wait ~600ms for full animation completion
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'tests/screenshots/hero_btn_hover_settled.png' });
  }

  // 3. Inspect computed CSS styles of .selloi-btn-glass::after
  const cssInfo = await page.evaluate(() => {
    const btn = document.querySelector('.selloi-hero-btn');
    const afterStyle = window.getComputedStyle(btn, '::after');
    const btnStyle = window.getComputedStyle(btn);
    return {
      overflow: btnStyle.overflow,
      position: btnStyle.position,
      afterPosition: afterStyle.position,
      afterAnimationName: afterStyle.animationName,
      afterBackground: afterStyle.backgroundImage.substring(0, 100) + '...',
      afterZIndex: afterStyle.zIndex,
      afterPointerEvents: afterStyle.pointerEvents
    };
  });

  console.log('CSS_INFO:', JSON.stringify(cssInfo, null, 2));

  // 4. Test Navbar glass buttons (Lang and Login)
  const loginBtn = page.locator('.selloi-btn-login').first();
  await loginBtn.hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'tests/screenshots/navbar_login_hover.png' });

  await browser.close();
  console.log('TEST COMPLETED SUCCESSFULLY');
}

testGlassHover().catch(console.error);
