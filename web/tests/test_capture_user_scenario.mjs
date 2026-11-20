import { chromium } from 'playwright';

async function captureScenario() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Scroll to #imkoniyatlar (the exact view in user's screenshot!)
  await page.evaluate(() => {
    const el = document.getElementById('imkoniyatlar');
    if (el) window.scrollTo({ top: el.offsetTop - 75, behavior: 'instant' });
  });
  await page.waitForTimeout(500);

  // Take screenshot of the exact view
  await page.screenshot({ path: 'tests/screenshots/user_scenario_fixed.png' });
  console.log('USER SCENARIO CAPTURED');
  await browser.close();
}

captureScenario().catch(console.error);
