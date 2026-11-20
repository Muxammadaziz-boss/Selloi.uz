import { chromium } from 'playwright';

async function testLeftAlignedSheen() {
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
          transparent 0px,
          rgba(255, 255, 255, 0.3) 8px,
          #FFFFFF 14px,
          rgba(255, 255, 255, 0.3) 20px,
          transparent 24px,
          transparent 32px,
          rgba(255, 255, 255, 0.4) 38px,
          #FFFFFF 50px,
          rgba(255, 255, 255, 0.4) 62px,
          transparent 72px,
          transparent 100%
        ) !important;
        transform: translateX(-80px) skewX(-25deg) !important;
        pointer-events: none !important;
        z-index: 5 !important;
        opacity: 0 !important;
      }
      .selloi-btn-glass:hover::after {
        opacity: 1 !important;
        animation: selloi-glass-glare-test 1.4s ease-in-out infinite !important;
      }
      @keyframes selloi-glass-glare-test {
        0% {
          transform: translateX(-80px) skewX(-25deg);
          opacity: 0;
        }
        5% {
          opacity: 1;
        }
        70% {
          transform: translateX(100%) skewX(-25deg);
          opacity: 1;
        }
        71% {
          opacity: 0;
        }
        100% {
          transform: translateX(100%) skewX(-25deg);
          opacity: 0;
        }
      }
    `
  });

  const btn = page.locator('.selloi-hero-btn').first();
  await btn.scrollIntoViewIfNeeded();

  // Initial
  await btn.screenshot({ path: 'tests/screenshots/perfect_before.png' });

  // Hover
  await btn.hover();
  // Wait 400ms (when it's ~40% across the button!)
  await page.waitForTimeout(400);
  await btn.screenshot({ path: 'tests/screenshots/perfect_mid.png' });

  // Wait another 300ms (when it's ~70% across)
  await page.waitForTimeout(300);
  await btn.screenshot({ path: 'tests/screenshots/perfect_late.png' });

  console.log('TEST COMPLETED');
  await browser.close();
}

testLeftAlignedSheen().catch(console.error);
