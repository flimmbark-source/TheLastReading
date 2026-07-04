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

    await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });
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

    const metrics = await page.evaluate(async () => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          right: Math.round(box.right),
          bottom: Math.round(box.bottom),
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

      const zone = document.getElementById('handSwipeZone');
      const hand = document.getElementById('hand');
      const lower = zone?.querySelector('.hand-swipe-zone-lower');

      const waitFrames = () => new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      const fire = (target, type, data) => {
        target.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: data.pointerId,
          pointerType: 'touch',
          isPrimary: true,
          clientX: data.x,
          clientY: data.y,
          buttons: type === 'pointerup' ? 0 : 1,
          pressure: type === 'pointerup' ? 0 : .5,
        }));
      };

      const testPoint = async (label, x, y, pointerId) => {
        const target = document.elementFromPoint(x, y);
        const beforeLift = hand?.style.getPropertyValue('--hand-lift-y') || '';
        const beforeOffset = hand?.style.getPropertyValue('--track-offset') || '';
        if (!target) return { label, x, y, target: null, started: false };

        fire(target, 'pointerdown', { pointerId, x, y });
        const started = !!zone?.classList.contains('dragging');
        fire(document, 'pointermove', { pointerId, x: x + 24, y: y + 24 });
        await waitFrames();
        const duringLift = hand?.style.getPropertyValue('--hand-lift-y') || '';
        const duringOffset = hand?.style.getPropertyValue('--track-offset') || '';
        fire(document, 'pointerup', { pointerId, x: x + 24, y: y + 24 });
        await waitFrames();

        return {
          label,
          x: Math.round(x),
          y: Math.round(y),
          target: target instanceof Element ? `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${target.className ? `.${String(target.className).trim().replace(/\s+/g, '.')}` : ''}` : target.nodeName,
          insideZone: target instanceof Element && (target === zone || !!zone?.contains(target)),
          started,
          beforeLift,
          duringLift,
          beforeOffset,
          duringOffset,
          moved: duringLift !== beforeLift || duringOffset !== beforeOffset,
        };
      };

      const zoneBox = zone?.getBoundingClientRect();
      const lowerBox = lower?.getBoundingClientRect();
      const dockBox = document.querySelector('.handDock')?.getBoundingClientRect();

      const upperPoint = zoneBox
        ? { x: innerWidth / 2, y: zoneBox.top + 18 }
        : null;

      let openHandPoint = null;
      if (lowerBox) {
        const candidateYs = [lowerBox.top + 20, lowerBox.top + lowerBox.height * .45, lowerBox.bottom - 18];
        for (const y of candidateYs) {
          for (let x = 8; x < innerWidth - 8; x += 8) {
            const el = document.elementFromPoint(x, y);
            if (el instanceof Element && (el === zone || zone?.contains(el))) {
              openHandPoint = { x, y };
              break;
            }
          }
          if (openHandPoint) break;
        }
      }

      const belowPoint = dockBox
        ? { x: innerWidth / 2, y: Math.min(innerHeight - 8, dockBox.bottom + 18) }
        : null;

      const interactionTests = [];
      if (upperPoint) interactionTests.push(await testPoint('upper-zone', upperPoint.x, upperPoint.y, 501));
      if (openHandPoint) interactionTests.push(await testPoint('open-hand-extension', openHandPoint.x, openHandPoint.y, 502));
      if (belowPoint) interactionTests.push(await testPoint('below-hand', belowPoint.x, belowPoint.y, 503));

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
        swipeZoneLower: rect('.hand-swipe-zone-lower'),
        handHint: rect('.hand-swipe-hint'),
        handHintStyle: styleInfo('.hand-swipe-hint'),
        handHintLine1: rect('.swipe-hint-line-1'),
        handHintLine1Style: styleInfo('.swipe-hint-line-1'),
        actions: rect('.spread-actions'),
        discard: rect('#discardBtn'),
        purge: rect('#purgeBtn'),
        actionParent: document.querySelector('.spread-actions')?.parentElement?.tagName || null,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        interactionTests,
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
