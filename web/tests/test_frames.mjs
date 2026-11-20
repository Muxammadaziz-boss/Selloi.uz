import { chromium } from 'playwright';

async function testFrames() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const btn = page.locator('.selloi-hero-btn').first();
  await btn.scrollIntoViewIfNeeded();

  const box = await btn.boundingBox();
  // Move cursor right onto the button
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  for (let t = 0; t <= 800; t += 100) {
    await page.waitForTimeout(100);
    await btn.screenshot({ path: `tests/screenshots/btn_frame_${t}.png` });
  }

  await browser.close();
  console.log('FRAMES CAPTURED SUCCESSFULLY');
}

testFrames().catch(console.error);
