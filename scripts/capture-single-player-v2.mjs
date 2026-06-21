import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.TLR_CAPTURE_URL || 'http://127.0.0.1:8080';
const outputDir = process.env.TLR_CAPTURE_DIR || 'artifacts/single-player-v2';

const viewports = [
  { name: '360x740', width: 360, height: 740 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '430x932', width: 430, height: 932 },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });

    await context.addInitScript(() => {
      [
        'tlr_tut_done',
        'tlr_tut_pattern',
        'tlr_tut_reading_complete',
        'tlr_tut_purge',
        'tlr_tut_archives_found',
        'tlr_tut_oracle_market',
        'tlr_tut_constellation',
        'tlr_tut_threshold',
        'tlr_tut_discard',
      ].forEach(key => localStorage.setItem(key, '1'));
      localStorage.removeItem('tlr_save');
      localStorage.removeItem('tlr_hand_hint_step');
    });

    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => consoleErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: 'New Game' }).click();
    await page.waitForSelector('body.single-player-v2.generated-sheet-ready', { timeout: 15000 });

    await page.evaluate(() => {
      const tip = document.getElementById('tutTip');
      if (tip) {
        tip.classList.remove('show', 'tut-center');
        tip.style.display = 'none';
      }
    });

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${outputDir}/${viewport.name}-empty-spread.png`,
      fullPage: false,
    });

    const metrics = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      };

      const styleInfo = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const style = getComputedStyle(element);
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          zIndex: style.zIndex,
          color: style.color,
          fontSize: style.fontSize,
          text: element.textContent?.trim() || '',
          className: element.className,
        };
      };

      return {
        viewport: { width: innerWidth, height: innerHeight },
        title: rect('#titleWrap'),
        hud: rect('.score-stack'),
        readingField: rect('.spread-wrap'),
        spread: rect('#spread'),
        firstSlot: rect('#spread .slot'),
        firstCard: rect('#hand .card'),
        handDock: rect('.handDock'),
        swipeZone: rect('.hand-swipe-zone'),
        handHint: rect('.hand-swipe-hint'),
        handHintStyle: styleInfo('.hand-swipe-hint'),
        handHintLine1: rect('.swipe-hint-line-1'),
        handHintLine1Style: styleInfo('.swipe-hint-line-1'),
        actions: rect('.spread-actions'),
        discard: rect('#discardBtn'),
        purge: rect('#purgeBtn'),
        actionParent: document.querySelector('.spread-actions')?.parentElement?.tagName || null,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });

    const result = { viewport: viewport.name, metrics, consoleErrors };
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(`${outputDir}/metrics.json`, JSON.stringify(results, null, 2));
