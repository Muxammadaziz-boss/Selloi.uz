import { chromium } from 'playwright';

async function testUserFlow() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Check Initial State (Uzbek)
  const initialTitle = await page.locator('.selloi-hero-title').innerText();
  const initialLang = await page.locator('.selloi-btn-lang').innerText();
  console.log('1. Initial Language:', initialLang, '| Title:', initialTitle.replace(/\n/g, ' '));

  // 2. Click Lang button to cycle to Russian
  await page.locator('.selloi-btn-lang').click();
  await page.waitForTimeout(300);
  const ruTitle = await page.locator('.selloi-hero-title').innerText();
  const ruLang = await page.locator('.selloi-btn-lang').innerText();
  console.log('2. After 1st Click:', ruLang, '| Title:', ruTitle.replace(/\n/g, ' '));

  // 3. Click Lang button to cycle to English
  await page.locator('.selloi-btn-lang').click();
  await page.waitForTimeout(300);
  const enTitle = await page.locator('.selloi-hero-title').innerText();
  const enLang = await page.locator('.selloi-btn-lang').innerText();
  console.log('3. After 2nd Click:', enLang, '| Title:', enTitle.replace(/\n/g, ' '));

  // 4. Click Lang button to cycle back to Uzbek
  await page.locator('.selloi-btn-lang').click();
  await page.waitForTimeout(300);
  const backUzTitle = await page.locator('.selloi-hero-title').innerText();
  const backUzLang = await page.locator('.selloi-btn-lang').innerText();
  console.log('4. After 3rd Click:', backUzLang, '| Title:', backUzTitle.replace(/\n/g, ' '));

  // 5. Test Glass Button Hover Styles
  const heroBtn = page.locator('.selloi-hero-btn').first();
  await heroBtn.hover();
  await page.waitForTimeout(100);

  const hoverStyle = await page.evaluate(() => {
    const el = document.querySelector('.selloi-hero-btn');
    const after = window.getComputedStyle(el, '::after');
    return {
      overflow: window.getComputedStyle(el).overflow,
      afterContent: after.content,
      afterAnimation: after.animation,
      afterPosition: after.position,
      afterZIndex: after.zIndex
    };
  });
  console.log('5. Glass Button Hover Computed Style:', JSON.stringify(hoverStyle, null, 2));

  await browser.close();
}

testUserFlow().catch(console.error);
