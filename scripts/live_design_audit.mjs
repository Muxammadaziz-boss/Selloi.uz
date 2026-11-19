import { chromium } from '../web/node_modules/playwright/index.mjs';
import AxeBuilder from '../web/node_modules/@axe-core/playwright/dist/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_URL = 'https://selloi.uz/';
const OUTPUT_DIR = path.resolve('docs/audit_screenshots');
const ARTIFACT_DIR = 'C:/Users/Administrator/.gemini/antigravity/brain/1dea3d39-e3e6-4c01-be57-34ecc1b74f8f/audit_screenshots';

const VIEWPORTS = [
  { name: 'desktop_1440x900', width: 1440, height: 900, isMobile: false },
  { name: 'desktop_1920x1080', width: 1920, height: 1080, isMobile: false },
  { name: 'tablet_768x1024', width: 768, height: 1024, isMobile: true },
  { name: 'mobile_375x812', width: 375, height: 812, isMobile: true },
  { name: 'mobile_390x844', width: 390, height: 844, isMobile: true }
];

async function copyToArtifacts(filename) {
  const src = path.join(OUTPUT_DIR, filename);
  const dest = path.join(ARTIFACT_DIR, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

async function runAudit() {
  console.log(`Starting Live Design Audit for: ${TARGET_URL}`);
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });

  const auditResults = {
    url: TARGET_URL,
    timestamp: new Date().toISOString(),
    viewports: {},
    sections: {},
    typography: {},
    interactiveStates: {},
    accessibility: {},
    consoleErrors: [],
    networkErrors: []
  };

  // 1. Initial Desktop Session to collect structure and errors
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      auditResults.consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });

  page.on('pageerror', err => {
    auditResults.consoleErrors.push({ text: err.message, stack: err.stack });
  });

  page.on('requestfailed', req => {
    auditResults.networkErrors.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  console.log(`Navigating to ${TARGET_URL}...`);
  const response = await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  auditResults.httpStatus = response.status();
  auditResults.pageTitle = await page.title();

  // Wait 2 seconds for any client animations/hydration
  await page.waitForTimeout(2000);

  // 2. Viewport Inspections
  for (const vp of VIEWPORTS) {
    console.log(`Inspecting viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(1000);

    const aboveFoldName = `${vp.name}_above_fold.png`;
    const fullPageName = `${vp.name}_full_page.png`;

    await page.screenshot({ path: path.join(OUTPUT_DIR, aboveFoldName), fullPage: false });
    await copyToArtifacts(aboveFoldName);

    await page.screenshot({ path: path.join(OUTPUT_DIR, fullPageName), fullPage: true });
    await copyToArtifacts(fullPageName);

    // Check header visibility and navigation
    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('header') || document.querySelector('nav');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      const style = window.getComputedStyle(header);
      return {
        tag: header.tagName,
        height: rect.height,
        position: style.position,
        backdropFilter: style.backdropFilter,
        backgroundColor: style.backgroundColor,
        zIndex: style.zIndex
      };
    });

    // Mobile specific checks: mobile hamburger menu
    let mobileMenuInfo = null;
    if (vp.isMobile) {
      const hamburger = await page.$('button[aria-label*="menu" i], button.navbar-toggler, header button:has(svg)');
      if (hamburger) {
        const box = await hamburger.boundingBox();
        mobileMenuInfo = { hasHamburger: true, box };
        try {
          await hamburger.click();
          await page.waitForTimeout(500);
          const menuOpenName = `${vp.name}_menu_open.png`;
          await page.screenshot({ path: path.join(OUTPUT_DIR, menuOpenName) });
          await copyToArtifacts(menuOpenName);
          // close it back
          await hamburger.click();
          await page.waitForTimeout(300);
        } catch (e) {
          mobileMenuInfo.clickError = e.message;
        }
      } else {
        mobileMenuInfo = { hasHamburger: false };
      }
    }

    auditResults.viewports[vp.name] = {
      width: vp.width,
      height: vp.height,
      header: headerInfo,
      mobileMenu: mobileMenuInfo,
      aboveFoldScreenshot: aboveFoldName,
      fullPageScreenshot: fullPageName
    };
  }

  // Set back to 1440x900 for detailed section inspection
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);

  // 3. Section by Section Inspection
  console.log('Inspecting page sections and extracting computed styles...');
  const sectionMetrics = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section, main > div, header, footer'));
    return sections.map((sec, idx) => {
      const rect = sec.getBoundingClientRect();
      const style = window.getComputedStyle(sec);
      const heading = sec.querySelector('h1, h2, h3');
      return {
        index: idx,
        tag: sec.tagName.toLowerCase(),
        id: sec.id || null,
        className: sec.className || null,
        headingText: heading ? heading.innerText.trim() : null,
        height: Math.round(rect.height),
        backgroundColor: style.backgroundColor,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom
      };
    });
  });
  auditResults.sections = sectionMetrics;

  // 4. Capture Key Section Visuals
  const sectionsToCapture = [
    { selector: 'header', name: 'section_01_header' },
    { selector: 'section:has(h1), main > div:first-of-type', name: 'section_02_hero' },
    { selector: 'section:has(h2:has-text("Nega")), section:nth-of-type(2)', name: 'section_03_features' },
    { selector: 'section:has-text("Jonli"), section:has-text("Demo")', name: 'section_04_interactive_demo' },
    { selector: 'section:has-text("Tarif"), section:has-text("Narx")', name: 'section_05_pricing' },
    { selector: 'section:has-text("Savollar"), section:has(details), section:has(.accordion)', name: 'section_06_faq' },
    { selector: 'footer', name: 'section_07_footer' }
  ];

  for (const item of sectionsToCapture) {
    try {
      const el = await page.$(item.selector);
      if (el) {
        const fname = `${item.name}.png`;
        await el.screenshot({ path: path.join(OUTPUT_DIR, fname) });
        await copyToArtifacts(fname);
        console.log(`Captured ${fname}`);
      }
    } catch (e) {
      console.log(`Could not capture ${item.name}: ${e.message}`);
    }
  }

  // 5. Typography and Contrast extraction
  console.log('Extracting typography and text contrast metrics...');
  const typographyData = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, a, button'));
    const samples = [];
    for (const el of headings) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const text = el.innerText ? el.innerText.trim().slice(0, 50) : '';
      if (!text) continue;
      const style = window.getComputedStyle(el);
      samples.push({
        tag: el.tagName.toLowerCase(),
        text,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        color: style.color,
        backgroundColor: style.backgroundColor
      });
    }
    return samples.slice(0, 30);
  });
  auditResults.typography = typographyData;

  // 6. Interactive Testing: FAQ accordion
  console.log('Testing interactive elements...');
  try {
    const faqItem = await page.$('details, .accordion-button, [data-bs-toggle="collapse"], button:has-text("Qanday")');
    if (faqItem) {
      await faqItem.click();
      await page.waitForTimeout(400);
      const faqOpenName = 'interaction_faq_expanded.png';
      await page.screenshot({ path: path.join(OUTPUT_DIR, faqOpenName) });
      await copyToArtifacts(faqOpenName);
      auditResults.interactiveStates.faqToggle = 'success';
    }
  } catch (e) {
    auditResults.interactiveStates.faqToggle = `failed: ${e.message}`;
  }

  // 7. Interactive Testing: Interactive Demo tabs / buttons
  try {
    const demoButtons = await page.$$('button:has-text("Buyurtma"), button:has-text("Savol"), [data-demo-scenario]');
    if (demoButtons.length > 0) {
      await demoButtons[0].click();
      await page.waitForTimeout(500);
      const demoInteractionName = 'interaction_demo_clicked.png';
      await page.screenshot({ path: path.join(OUTPUT_DIR, demoInteractionName) });
      await copyToArtifacts(demoInteractionName);
      auditResults.interactiveStates.demoInteraction = 'success';
    }
  } catch (e) {
    auditResults.interactiveStates.demoInteraction = `failed: ${e.message}`;
  }

  // 8. Run Axe-Core WCAG AA Accessibility Scan on Live Site
  console.log('Running Axe-Core Accessibility Scan on live site...');
  try {
    const axeResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    auditResults.accessibility = {
      violationsCount: axeResults.violations.length,
      violations: axeResults.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodesCount: v.nodes.length,
        failureSummary: v.nodes[0]?.failureSummary,
        target: v.nodes[0]?.target
      })),
      passesCount: axeResults.passes.length,
      incompleteCount: axeResults.incomplete.length
    };
  } catch (e) {
    auditResults.accessibility = { error: e.message };
  }

  // 9. Buttons and Touch Targets
  const touchTargets = await page.evaluate(() => {
    const targets = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
    return targets.map(t => {
      const rect = t.getBoundingClientRect();
      const style = window.getComputedStyle(t);
      return {
        tag: t.tagName.toLowerCase(),
        text: t.innerText ? t.innerText.trim().slice(0, 30) : (t.getAttribute('aria-label') || ''),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        isTooSmall: rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)
      };
    }).filter(t => t.width > 0 && t.height > 0);
  });
  auditResults.touchTargets = {
    total: touchTargets.length,
    tooSmallCount: touchTargets.filter(t => t.isTooSmall).length,
    smallTargets: touchTargets.filter(t => t.isTooSmall).slice(0, 15)
  };

  await browser.close();

  // Save audit results to JSON
  const jsonPath = path.join(OUTPUT_DIR, 'live_audit_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2));
  console.log(`Live Design Audit completed. Results saved to ${jsonPath}`);
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
