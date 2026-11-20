import { chromium } from 'playwright';

async function testVisual() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Create a minimal HTML test in the browser to isolate
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { background: #0D0D0D; padding: 50px; }
        .test-btn {
          width: 300px;
          height: 48px;
          border-radius: 40px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-family: sans-serif;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .test-btn::after {
          content: '';
          position: absolute;
          top: -50%;
          left: 0;
          width: 100%;
          height: 200%;
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
          );
          transform: translateX(100px) skewX(-25deg);
          pointer-events: none;
        }
      </style>
    </head>
    <body>
      <button class="test-btn">Test Glass Button</button>
    </body>
    </html>
  `);

  const btn = page.locator('.test-btn');
  await btn.screenshot({ path: 'tests/screenshots/test_static_glare.png' });
  console.log('STATIC GLARE SAVED');
  await browser.close();
}

testVisual().catch(console.error);
