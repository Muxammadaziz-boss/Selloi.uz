import { chromium } from 'playwright';

async function testInspect() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const info = await page.evaluate(() => {
    const ids = ['top', 'imkoniyatlar', 'qanday-ishlaydi', 'tariflar', 'faq', 'boshlash'];
    return ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return { id, exists: false };
      const rect = el.getBoundingClientRect();
      return {
        id,
        top: rect.top + window.scrollY,
        height: rect.height
      };
    });
  });

  console.log('SECTIONS_COORDINATES:', JSON.stringify(info, null, 2));
  await browser.close();
}

testInspect().catch(console.error);
