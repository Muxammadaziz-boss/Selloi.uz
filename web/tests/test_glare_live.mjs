import { chromium } from 'playwright';

async function testGlareLive() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  await page.addStyleTag({
    content: `
      .selloi-btn-glass {
        position: relative !important;
        overflow: hidden !important;
      }
      .selloi-btn-glass::after {
        content: '' !important;
        position: absolute !important;
        top: -50% !important;
        left: 0 !important;
        width: 100% !important;
        height: 200% !important;
        background: linear-gradient(
          90deg,
          transparent 0%,
          transparent 10%,
          rgba(255, 255, 255, 0.4) 14%,
          rgba(255, 255, 255, 0.95) 17%,
          rgba(255, 255, 255, 0.4) 20%,
          transparent 23%,
          transparent 28%,
          rgba(255, 255, 255, 0.5) 32%,
          #FFFFFF 38%,
          rgba(255, 255, 255, 0.5) 44%,
          transparent 50%,
          transparent 100%
        ) !important;
        transform: translateX(-60%) skewX(-25deg) !important;
        pointer-events: none !important;
        opacity: 0 !important;
        z-index: 5 !important;
      }
      .selloi-btn-glass:hover::after {
        animation: selloi-glass-glare-new 1.6s cubic-bezier(0.25, 0.1, 0.25, 1) infinite !important;
      }
      @keyframes selloi-glass-glare-new {
        0% {
          transform: translateX(-60%) skewX(-25deg);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        75% {
          transform: translateX(110%) skewX(-25deg);
          opacity: 1;
        }
        85% {
          opacity: 0;
        }
        100% {
          transform: translateX(110%) skewX(-25deg);
          opacity: 0;
        }
      }
    `
  });

  const btn = page.locator('.selloi-hero-btn').first();
  await btn.scrollIntoViewIfNeeded();

  await btn.screenshot({ path: 'tests/screenshots/glare_unhovered.png' });

  // Hover the button
  await btn.hover();

  // Capture at 300ms, 600ms, 900ms
  await page.waitForTimeout(300);
  await btn.screenshot({ path: 'tests/screenshots/glare_300ms.png' });

  await page.waitForTimeout(300);
  await btn.screenshot({ path: 'tests/screenshots/glare_600ms.png' });

  await page.waitForTimeout(300);
  await btn.screenshot({ path: 'tests/screenshots/glare_900ms.png' });

  console.log('GLARE SCREENSHOTS TAKEN');
  await browser.close();
}

testGlareLive().catch(console.error);
