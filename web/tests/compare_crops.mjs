import { chromium } from 'playwright';

async function compareCrops() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  
  // Show both side by side in an HTML page and take a screenshot
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; background: #000; color: white; font-family: sans-serif; padding: 20px;">
        <h2>Top: FIGMA REFERENCE | Bottom: IMPLEMENTED</h2>
        <div style="margin-bottom: 20px;">
          <h3 style="color: #FF4C63;">Figma Reference (Boshlash):</h3>
          <img src="file:///D:/Ishchi stoli/proyekt/Telegram ai agent/web/tests/screenshots/figma_boshlash_crop.png" style="width: 100%; border: 1px solid green;" />
        </div>
        <div>
          <h3 style="color: #FF4C63;">Current Implemented:</h3>
          <img src="file:///D:/Ishchi stoli/proyekt/Telegram ai agent/web/tests/screenshots/implemented_boshlash_crop.png" style="width: 100%; border: 1px solid blue;" />
        </div>
      </body>
    </html>
  `);

  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/screenshots/comparison_boshlash.png', fullPage: true });
  console.log('COMPARISON SAVED');
  await browser.close();
}

compareCrops().catch(console.error);
