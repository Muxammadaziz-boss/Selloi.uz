import { chromium } from 'playwright';

async function cropFigmaSection() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Load the figma reference image and crop the Boshlash section (around y=3220)
  await page.setContent(`
    <html>
      <body style="margin:0; background:black;">
        <img src="file:///D:/Ishchi stoli/proyekt/Telegram ai agent/web/tests/screenshots/figma_reference_desktop.png" style="position:absolute; top:-3200px; left:0; width:1440px;" />
      </body>
    </html>
  `);

  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/screenshots/figma_boshlash_crop.png', clip: { x: 0, y: 0, width: 1440, height: 450 } });

  // Also crop the current implementation at the same section
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const ctaSection = page.locator('.selloi-cta-section');
  await ctaSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await ctaSection.screenshot({ path: 'tests/screenshots/implemented_boshlash_crop.png' });

  console.log('BOTH CROPS SAVED FOR COMPARISON');
  await browser.close();
}

cropFigmaSection().catch(console.error);
