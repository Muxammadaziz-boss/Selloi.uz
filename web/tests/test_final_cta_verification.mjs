import { chromium } from 'playwright';

async function testFinalCta() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const ctaSection = page.locator('#boshlash');
  await ctaSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  // Take screenshot of the exact section
  await page.screenshot({ path: 'tests/screenshots/final_cta_verified.png' });

  // Get computed styles of card, button, and note
  const styles = await page.evaluate(() => {
    const card = document.querySelector('.selloi-cta-card');
    const title = document.querySelector('.selloi-cta-title');
    const btn = document.querySelector('.selloi-cta-btn');
    const note = document.querySelector('.selloi-cta-note');

    return {
      cardBg: window.getComputedStyle(card).backgroundColor,
      cardBorder: window.getComputedStyle(card).borderColor,
      cardRadius: window.getComputedStyle(card).borderRadius,
      cardWidth: card.getBoundingClientRect().width,
      cardHeight: card.getBoundingClientRect().height,
      titleFontSize: window.getComputedStyle(title).fontSize,
      titleLineHeight: window.getComputedStyle(title).lineHeight,
      btnWidth: btn.getBoundingClientRect().width,
      btnHeight: btn.getBoundingClientRect().height,
      btnFontSize: window.getComputedStyle(btn).fontSize,
      btnFontWeight: window.getComputedStyle(btn).fontWeight,
      noteFontSize: window.getComputedStyle(note).fontSize,
      noteColor: window.getComputedStyle(note).color,
    };
  });

  console.log('FINAL_CTA_STYLES:', JSON.stringify(styles, null, 2));
  await browser.close();
}

testFinalCta().catch(console.error);
