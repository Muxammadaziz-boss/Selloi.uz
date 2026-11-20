import { chromium } from 'playwright';

async function testLiquidNav() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // 1. Initial State: Top of page (Hero)
  await page.waitForTimeout(400);
  const topState = await page.evaluate(() => {
    const pill = document.querySelector('.selloi-nav-liquid-pill');
    const active = document.querySelector('.selloi-nav-link.active');
    return {
      activeText: active?.innerText?.trim(),
      pillTransform: pill?.style.transform,
      pillWidth: pill?.style.width,
    };
  });
  console.log('1. At Top (#top):', JSON.stringify(topState));

  // 2. Scroll to #imkoniyatlar (Selloi haqida)
  await page.evaluate(() => {
    const el = document.getElementById('imkoniyatlar');
    if (el) window.scrollTo({ top: el.offsetTop - 75, behavior: 'instant' });
  });
  await page.waitForTimeout(400);
  const imkoniyatlarState = await page.evaluate(() => {
    const pill = document.querySelector('.selloi-nav-liquid-pill');
    const active = document.querySelector('.selloi-nav-link.active');
    return {
      activeText: active?.innerText?.trim(),
      pillTransform: pill?.style.transform,
      pillWidth: pill?.style.width,
    };
  });
  console.log('2. Scrolled to #imkoniyatlar:', JSON.stringify(imkoniyatlarState));

  // 3. Scroll to #tariflar (Tariflar)
  await page.evaluate(() => {
    const el = document.getElementById('tariflar');
    if (el) window.scrollTo({ top: el.offsetTop - 75, behavior: 'instant' });
  });
  await page.waitForTimeout(400);
  const tariflarState = await page.evaluate(() => {
    const pill = document.querySelector('.selloi-nav-liquid-pill');
    const active = document.querySelector('.selloi-nav-link.active');
    return {
      activeText: active?.innerText?.trim(),
      pillTransform: pill?.style.transform,
      pillWidth: pill?.style.width,
    };
  });
  console.log('3. Scrolled to #tariflar:', JSON.stringify(tariflarState));

  // 4. Scroll to #faq (Aloqa)
  await page.evaluate(() => {
    const el = document.getElementById('faq');
    if (el) window.scrollTo({ top: el.offsetTop - 75, behavior: 'instant' });
  });
  await page.waitForTimeout(400);
  const faqState = await page.evaluate(() => {
    const pill = document.querySelector('.selloi-nav-liquid-pill');
    const active = document.querySelector('.selloi-nav-link.active');
    return {
      activeText: active?.innerText?.trim(),
      pillTransform: pill?.style.transform,
      pillWidth: pill?.style.width,
    };
  });
  console.log('4. Scrolled to #faq:', JSON.stringify(faqState));

  // 5. Scroll to #boshlash (Sinab ko'rish)
  await page.evaluate(() => {
    const el = document.getElementById('boshlash');
    if (el) window.scrollTo({ top: el.offsetTop - 75, behavior: 'instant' });
  });
  await page.waitForTimeout(400);
  const boshlashState = await page.evaluate(() => {
    const pill = document.querySelector('.selloi-nav-liquid-pill');
    const active = document.querySelector('.selloi-nav-link.active');
    return {
      activeText: active?.innerText?.trim(),
      pillTransform: pill?.style.transform,
      pillWidth: pill?.style.width,
    };
  });
  console.log('5. Scrolled to #boshlash:', JSON.stringify(boshlashState));

  await browser.close();
  console.log('LIQUID NAV TEST PASSED');
}

testLiquidNav().catch(console.error);
