import { chromium } from 'playwright';

async function testElementAtPoint() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const btn = page.locator('.selloi-hero-btn').first();
  const box = await btn.boundingBox();

  const atPoint = await page.evaluate((pos) => {
    const el = document.elementFromPoint(pos.x, pos.y);
    return {
      tagName: el?.tagName,
      className: el?.className,
      id: el?.id,
      outerHTML: el?.outerHTML?.substring(0, 150)
    };
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

  console.log('ELEMENT_AT_POINT:', JSON.stringify(atPoint, null, 2));
  await browser.close();
}

testElementAtPoint().catch(console.error);
