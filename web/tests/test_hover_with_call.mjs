import { chromium } from 'playwright';

async function testHoverWithCall() {
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
        left: -140px !important;
        width: 110px !important;
        height: 200% !important;
        background: linear-gradient(
          90deg,
          transparent 0px,
          transparent 15px,
          rgba(255, 255, 255, 0.4) 20px,
          rgba(255, 255, 255, 0.9) 25px,
          rgba(255, 255, 255, 0.4) 30px,
          transparent 36px,
          transparent 46px,
          rgba(255, 255, 255, 0.5) 52px,
          #FFFFFF 64px,
          rgba(255, 255, 255, 0.5) 76px,
          transparent 90px,
          transparent 110px
        ) !important;
        transform: skewX(-25deg) !important;
        pointer-events: none !important;
        z-index: 5 !important;
        opacity: 0 !important;
      }
      .selloi-btn-glass:hover::after {
        opacity: 1 !important;
        animation: test-glare 1.8s ease-in-out infinite !important;
      }
      @keyframes test-glare {
        0% {
          left: -140px;
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        55% {
          left: 115%;
          opacity: 1;
        }
        56% {
          opacity: 0;
        }
        100% {
          left: 115%;
          opacity: 0;
        }
      }
    `
  });

  const btn = page.locator('.selloi-hero-btn').first();
  await btn.scrollIntoViewIfNeeded();

  // 1. Take before hover
  await btn.screenshot({ path: 'tests/screenshots/hover_before.png' });

  // 2. Call .hover()
  await btn.hover();
  await page.waitForTimeout(400); // 400ms into the animation
  await btn.screenshot({ path: 'tests/screenshots/hover_mid.png' });

  const isDifferent = await page.evaluate(() => {
    const el = document.querySelector('.selloi-hero-btn');
    const style = window.getComputedStyle(el, '::after');
    return {
      left: style.left,
      opacity: style.opacity,
      animation: style.animation
    };
  });

  console.log('HOVER_EVAL:', JSON.stringify(isDifferent, null, 2));
  await browser.close();
}

testHoverWithCall().catch(console.error);
