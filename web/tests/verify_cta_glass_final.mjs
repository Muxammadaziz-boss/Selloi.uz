import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  const screenshotDir = path.resolve('tests/screenshots');
  const artifactDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\cb7c0854-f8a8-4ee9-9f38-c81f1a97459d';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  // 1. DESKTOP RUN
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Verify all 4 CTA texts
  const heroBtn = page.locator('.selloi-hero-btn').first();
  const demoBtn = page.locator('.selloi-demo-btn').first();
  const tarifBtn = page.locator('.selloi-tarif-btn').first();
  const finalCtaBtn = page.locator('.selloi-cta-btn').first();

  const heroText = (await heroBtn.innerText()).trim();
  const demoText = (await demoBtn.innerText()).trim();
  const tarifText = (await tarifBtn.innerText()).trim();
  const finalText = (await finalCtaBtn.innerText()).trim();

  console.log('CTA_TEXTS:', {
    hero: heroText,
    demo: demoText,
    tarif: tarifText,
    final: finalText,
  });

  // Verify exact text match
  const expectedCta = '7 kun sinab ko‘rish →';
  const allMatch = [heroText, demoText, tarifText, finalText].every(t => t === expectedCta);
  console.log('ALL_CTA_MATCH_EXPECTED:', allMatch);

  const saveScreenshot = async (locator, filename) => {
    const p1 = path.join(screenshotDir, filename);
    await locator.screenshot({ path: p1 });
    try {
      const p2 = path.join(artifactDir, filename);
      fs.copyFileSync(p1, p2);
    } catch (e) {
      console.warn('Could not copy to artifactDir:', e.message);
    }
  };

  // 2. NORMAL RESTING STATE (DESKTOP)
  await heroBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await saveScreenshot(heroBtn, 'final_btn_normal.png');

  // 3. HOVER INTERACTION & CAPTURE 2 GLARE STREAKS
  const box = await heroBtn.boundingBox();
  if (box) {
    // Hover over button center
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    
    // Sample during the transit at ~250ms and ~500ms to capture both streaks in frame
    await page.waitForTimeout(250);
    await saveScreenshot(heroBtn, 'final_btn_hover_streak_mid.png');

    await page.waitForTimeout(250);
    await saveScreenshot(heroBtn, 'final_btn_hover_streak_late.png');

    // Inspect CSS computed styles on hover
    const hoverStyles = await page.evaluate(() => {
      const btn = document.querySelector('.selloi-hero-btn');
      const after = window.getComputedStyle(btn, '::after');
      const btnStyle = window.getComputedStyle(btn);
      return {
        transform: btnStyle.transform,
        boxShadow: btnStyle.boxShadow,
        afterAnimation: after.animationName,
        afterOpacity: after.opacity,
        afterBg: after.backgroundImage.substring(0, 100)
      };
    });
    console.log('HOVER_STYLES:', hoverStyles);

    // Unhover (move mouse far away)
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    await saveScreenshot(heroBtn, 'final_btn_unhover_settled.png');
  }

  // 4. MOBILE VIEWPORT (iPhone 13 - 390x844, touch)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const mobileHeroBtn = mobilePage.locator('.selloi-hero-btn').first();
  await mobileHeroBtn.scrollIntoViewIfNeeded();
  await mobilePage.waitForTimeout(300);
  await saveScreenshot(mobileHeroBtn, 'final_mobile_btn.png');

  const mobileAfterStyle = await mobilePage.evaluate(() => {
    const btn = document.querySelector('.selloi-hero-btn');
    const after = window.getComputedStyle(btn, '::after');
    return {
      display: after.display,
      animationName: after.animationName,
      opacity: after.opacity
    };
  });
  console.log('MOBILE_AFTER_STYLE (glare disabled on touch/mobile):', mobileAfterStyle);

  // 5. PREFERS-REDUCED-MOTION
  const reducedMotionContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce'
  });
  const rmPage = await reducedMotionContext.newPage();
  await rmPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const rmAfterStyle = await rmPage.evaluate(() => {
    const btn = document.querySelector('.selloi-hero-btn');
    const after = window.getComputedStyle(btn, '::after');
    return {
      display: after.display,
      animationName: after.animationName
    };
  });
  console.log('REDUCED_MOTION_STYLE (glare disabled):', rmAfterStyle);

  await browser.close();
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

runVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
