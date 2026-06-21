import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

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

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });

    await context.addInitScript(() => {
      localStorage.setItem('tlr_tut_done', '1');
      localStorage.removeItem('tlr_save');
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
        actions: rect('.spread-actions'),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      };
    });

    console.log(JSON.stringify({ viewport: viewport.name, metrics, consoleErrors }, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}
