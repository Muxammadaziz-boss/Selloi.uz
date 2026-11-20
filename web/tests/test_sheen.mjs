import { chromium } from 'playwright';

async function testSheen() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Inject the new CSS directly on page to preview immediately
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

  // Move mouse onto button
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // Wait 400ms (right in the middle of transit 10%-55%!)
  await page.waitForTimeout(400);
  await btn.screenshot({ path: 'tests/screenshots/btn_test_mid_glare.png' });
  await page.screenshot({ path: 'tests/screenshots/page_test_mid_glare.png' });

  console.log('SCREENSHOT SAVED WITH ACTIVE GLARE');
  await browser.close();
}

testSheen().catch(console.error);
