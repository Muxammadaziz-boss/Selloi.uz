import { chromium } from 'playwright';

async function debugAfter() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const btn = page.locator('.selloi-hero-btn').first();
  await btn.hover();

  const details = await page.evaluate(() => {
    const el = document.querySelector('.selloi-hero-btn');
    const style = window.getComputedStyle(el, '::after');
    return {
      content: style.content,
      display: style.display,
      position: style.position,
      width: style.width,
      height: style.height,
      opacity: style.opacity,
      transform: style.transform,
      animation: style.animation,
      backgroundImage: style.backgroundImage,
      zIndex: style.zIndex,
      rect: el.getBoundingClientRect()
    };
  });

  console.log('AFTER_DEBUG:', JSON.stringify(details, null, 2));
  await browser.close();
}

debugAfter().catch(console.error);
