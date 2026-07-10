import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.SELECTION_DIAG_PORT || 18084);
const baseUrl = process.env.SELECTION_DIAG_URL || `http://127.0.0.1:${port}`;
const outputDir = process.env.SELECTION_DIAG_DIR || 'artifacts/selection-diagnostic';
const viewports = [
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
];

function startServer() {
  if (process.env.SELECTION_DIAG_URL) return null;
  const child = spawn(process.execPath, ['scripts/serve.mjs', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => process.stdout.write(chunk));
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  return child;
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/game.html`, { cache: 'no-store' });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function startReading(page) {
  await page.locator('button[onclick="tlrMainMenuNewGame()"]')
    .evaluate(button => button.click());
  await page.waitForFunction(() => document.body.classList.contains('generated-sheet-ready'));
  await page.waitForFunction(() => document.getElementById('mainMenu')?.hidden === true);
  await page.waitForSelector('#hand .card[data-uid]');
  await page.waitForTimeout(500);
}

async function installEventRecorder(page) {
  await page.evaluate(() => {
    window.__selectionGeometryEvents = [];
    const record = event => {
      const target = event.target instanceof Element ? event.target : null;
      window.__selectionGeometryEvents.push({
        type: event.type,
        time: performance.now(),
        target: target?.id || target?.className || target?.tagName || null,
        uid: target?.closest?.('.card[data-uid]')?.getAttribute('data-uid') || null,
        bodyClass: document.body.className,
        selected: document.querySelector('#hand .card.sel')?.getAttribute('data-uid') || null,
      });
    };
    for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) {
      document.addEventListener(type, record, true);
    }
  });
}

async function snapshot(page, label) {
  return page.evaluate(snapshotLabel => {
    const rectOf = element => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    };

    const styleOf = element => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        display: style.display,
        visibility: style.visibility,
        position: style.position,
        top: style.top,
        right: style.right,
        bottom: style.bottom,
        left: style.left,
        width: style.width,
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        transform: style.transform,
        translate: style.translate,
        scale: style.scale,
        transformOrigin: style.transformOrigin,
        overflow: style.overflow,
        contain: style.contain,
      };
    };

    const animationOf = element => element?.getAnimations?.().map(animation => ({
      playState: animation.playState,
      currentTime: animation.currentTime,
      startTime: animation.startTime,
      effect: animation.effect?.getTiming?.() || null,
    })) || [];

    const matchingRules = (element, properties) => {
      if (!element) return [];
      const matches = [];
      const visit = (rules, href, media = '') => {
        for (const rule of rules || []) {
          if (rule.cssRules) {
            let active = true;
            if (rule.media?.mediaText) active = matchMedia(rule.media.mediaText).matches;
            if (active) visit(rule.cssRules, href, rule.media?.mediaText || media);
            continue;
          }
          if (!rule.selectorText) continue;
          let matched = false;
          try { matched = element.matches(rule.selectorText); } catch {}
          if (!matched) continue;
          const declarations = {};
          for (const property of properties) {
            const value = rule.style?.getPropertyValue(property);
            if (value) declarations[property] = {
              value: value.trim(),
              priority: rule.style.getPropertyPriority(property),
            };
          }
          if (Object.keys(declarations).length) {
            matches.push({ selector: rule.selectorText, href, media, declarations });
          }
        }
      };
      for (const sheet of document.styleSheets) {
        try { visit(sheet.cssRules, sheet.href || 'inline'); } catch {}
      }
      return matches;
    };

    const spreadWrap = document.querySelector('.spread-wrap');
    const spread = document.getElementById('spread');
    const firstSlot = document.querySelector('#spread .slot');
    const scorePreview = document.getElementById('scorePreview');
    const handDock = document.querySelector('.handDock');
    const hand = document.getElementById('hand');
    const selectedCard = document.querySelector('#hand .card.sel');
    const firstCard = document.querySelector('#hand .card[data-uid]');
    const properties = [
      'display', 'position', 'top', 'bottom', 'left', 'right', 'width', 'height',
      'min-height', 'max-height', 'margin-top', 'margin-bottom', 'padding-top',
      'padding-bottom', 'transform', 'translate', 'scale', 'overflow', 'contain',
    ];

    return {
      label: snapshotLabel,
      now: performance.now(),
      bodyClass: document.body.className,
      presentationState: document.body.dataset.presentationState || null,
      selectedUid: selectedCard?.dataset.uid || null,
      scroll: {
        x: window.scrollX,
        y: window.scrollY,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        bodyHeight: document.body.scrollHeight,
        visualViewport: window.visualViewport ? {
          offsetLeft: window.visualViewport.offsetLeft,
          offsetTop: window.visualViewport.offsetTop,
          width: window.visualViewport.width,
          height: window.visualViewport.height,
          scale: window.visualViewport.scale,
        } : null,
      },
      elements: {
        spreadWrap: {
          rect: rectOf(spreadWrap),
          style: styleOf(spreadWrap),
          offsetTop: spreadWrap?.offsetTop ?? null,
          offsetHeight: spreadWrap?.offsetHeight ?? null,
          animations: animationOf(spreadWrap),
          matchingRules: matchingRules(spreadWrap, properties),
        },
        spread: {
          rect: rectOf(spread),
          style: styleOf(spread),
          offsetTop: spread?.offsetTop ?? null,
          offsetHeight: spread?.offsetHeight ?? null,
          animations: animationOf(spread),
          matchingRules: matchingRules(spread, properties),
        },
        firstSlot: {
          rect: rectOf(firstSlot),
          style: styleOf(firstSlot),
          offsetTop: firstSlot?.offsetTop ?? null,
          offsetHeight: firstSlot?.offsetHeight ?? null,
          animations: animationOf(firstSlot),
        },
        scorePreview: {
          rect: rectOf(scorePreview),
          style: styleOf(scorePreview),
          offsetTop: scorePreview?.offsetTop ?? null,
          offsetHeight: scorePreview?.offsetHeight ?? null,
          hiddenClass: scorePreview?.classList.contains('hidden') ?? null,
          text: scorePreview?.textContent?.trim() || '',
          matchingRules: matchingRules(scorePreview, properties),
        },
        handDock: {
          rect: rectOf(handDock),
          style: styleOf(handDock),
          offsetTop: handDock?.offsetTop ?? null,
          offsetHeight: handDock?.offsetHeight ?? null,
          animations: animationOf(handDock),
        },
        hand: {
          rect: rectOf(hand),
          style: styleOf(hand),
          offsetTop: hand?.offsetTop ?? null,
          offsetHeight: hand?.offsetHeight ?? null,
        },
        firstCard: {
          rect: rectOf(firstCard),
          style: styleOf(firstCard),
          uid: firstCard?.dataset.uid || null,
        },
        selectedCard: {
          rect: rectOf(selectedCard),
          style: styleOf(selectedCard),
          uid: selectedCard?.dataset.uid || null,
        },
      },
      events: [...(window.__selectionGeometryEvents || [])],
      stylesheets: [...document.styleSheets].map(sheet => sheet.href || 'inline'),
    };
  }, label);
}

function delta(before, after, path) {
  const read = (object, keys) => keys.reduce((value, key) => value?.[key], object);
  const keys = path.split('.');
  const a = Number(read(before, keys));
  const b = Number(read(after, keys));
  return Number.isFinite(a) && Number.isFinite(b) ? b - a : null;
}

async function diagnoseViewport(browser, viewport) {
  const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tlr_tut_done', '1');
      localStorage.setItem('tlr_spv2_hand_hint_seen', '1');
    } catch {}
  });

  const consoleMessages = [];
  page.on('console', message => consoleMessages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => consoleMessages.push({ type: 'pageerror', text: String(error) }));

  await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });
  await startReading(page);
  await installEventRecorder(page);

  const label = `${viewport.width}x${viewport.height}`;
  const before = await snapshot(page, 'before');
  await page.screenshot({ path: `${outputDir}/${label}-before.png`, fullPage: true });

  const firstCard = page.locator('#hand .card[data-uid]').first();
  const cardBox = await firstCard.boundingBox();
  const hitTarget = cardBox ? await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return {
      target: element?.id || element?.className || element?.tagName || null,
      cardUid: element?.closest?.('.card[data-uid]')?.getAttribute('data-uid') || null,
    };
  }, { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 }) : null;

  let tapError = null;
  try {
    await firstCard.tap({ timeout: 5000 });
  } catch (error) {
    tapError = String(error);
  }

  const checkpoints = [];
  for (const delay of [0, 16, 50, 120, 250, 500]) {
    if (delay) await page.waitForTimeout(delay - (checkpoints.at(-1)?.delay || 0));
    checkpoints.push({ delay, snapshot: await snapshot(page, `after-${delay}`) });
  }
  await page.screenshot({ path: `${outputDir}/${label}-after-500.png`, fullPage: true });

  const after = checkpoints.at(-1).snapshot;
  const summary = {
    spreadWrapTop: delta(before, after, 'elements.spreadWrap.rect.top'),
    spreadWrapHeight: delta(before, after, 'elements.spreadWrap.rect.height'),
    spreadTop: delta(before, after, 'elements.spread.rect.top'),
    spreadHeight: delta(before, after, 'elements.spread.rect.height'),
    firstSlotTop: delta(before, after, 'elements.firstSlot.rect.top'),
    scrollY: delta(before, after, 'scroll.y'),
    visualViewportOffsetTop: delta(before, after, 'scroll.visualViewport.offsetTop'),
    scorePreviewHeight: delta(before, after, 'elements.scorePreview.rect.height'),
    handDockTop: delta(before, after, 'elements.handDock.rect.top'),
  };

  await page.close();
  return {
    viewport,
    hitTarget,
    tapError,
    before,
    checkpoints,
    summary,
    consoleMessages,
  };
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const server = startServer();
  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
    const reports = [];
    for (const viewport of viewports) {
      const report = await diagnoseViewport(browser, viewport);
      reports.push(report);
      console.log(`SELECTION_GEOMETRY ${viewport.width}x${viewport.height} ${JSON.stringify(report.summary)}`);
      if (report.tapError) console.log(`SELECTION_TAP_ERROR ${viewport.width}x${viewport.height} ${report.tapError}`);
    }
    writeFileSync(`${outputDir}/report.json`, JSON.stringify({ baseUrl, reports }, null, 2));
  } finally {
    await browser?.close();
    server?.kill('SIGTERM');
  }
}

await main();
