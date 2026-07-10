import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.PRESENTATION_CAPTURE_PORT || 18082);
const externalBaseUrl = process.env.PRESENTATION_CAPTURE_URL || '';
const baseUrl = externalBaseUrl || `http://127.0.0.1:${port}`;
const outputDir = process.env.PRESENTATION_CAPTURE_DIR || 'artifacts';
const viewports = [
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
];

const outputPath = (label, state) => `${outputDir}/presentation-${label}-${state}.png`;

function startServer() {
  if (externalBaseUrl) return null;
  const child = spawn(process.execPath, ['scripts/serve.mjs', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => process.stdout.write(chunk));
  child.stderr.on('data', chunk => process.stderr.write(chunk));
  return child;
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
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
  await page.click('button[onclick="tlrMainMenuNewGame()"]');
  await page.waitForFunction(() => document.body.classList.contains('generated-sheet-ready'));
  await page.waitForFunction(() => document.getElementById('mainMenu')?.hidden === true);
  await page.waitForSelector('#hand .card[data-uid]');
  await page.waitForTimeout(450);
}

async function readSpreadGeometry(page) {
  return page.evaluate(() => {
    const spread = document.getElementById('spread');
    const wrap = spread?.closest('.spread-wrap');
    if (!spread || !wrap) return null;
    const spreadRect = spread.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    return {
      scrollY: window.scrollY,
      spread: {
        top: spreadRect.top,
        left: spreadRect.left,
        width: spreadRect.width,
        height: spreadRect.height,
      },
      wrap: {
        top: wrapRect.top,
        left: wrapRect.left,
        width: wrapRect.width,
        height: wrapRect.height,
      },
    };
  });
}

function assertSelectionKeepsSpreadFixed(before, after, label) {
  if (!before || !after) throw new Error(`[${label}] Spread geometry was unavailable`);
  const tolerance = 1.5;
  const failures = [];
  for (const target of ['spread', 'wrap']) {
    for (const key of ['top', 'left', 'width']) {
      const delta = after[target][key] - before[target][key];
      if (Math.abs(delta) > tolerance) failures.push(`${target}.${key} changed ${delta.toFixed(2)}px`);
    }
  }
  const scrollDelta = after.scrollY - before.scrollY;
  if (Math.abs(scrollDelta) > tolerance) failures.push(`window.scrollY changed ${scrollDelta.toFixed(2)}px`);
  if (failures.length) {
    throw new Error(`[${label}] Selecting a card moved the play geometry: ${failures.join(', ')}`);
  }
}

async function captureReadingStates(page, label) {
  await page.screenshot({ path: outputPath(label, 'reading-idle'), fullPage: true });
  const beforeSelection = await readSpreadGeometry(page);

  // Hand cards have a continuous idle transform, so Playwright's normal click
  // actionability check never sees the card become geometrically stable. Invoke
  // the exact card element's real click handler directly for this state capture.
  await page.locator('#hand .card[data-uid]').first().evaluate(card => card.click());
  await page.waitForFunction(() => document.body.classList.contains('presentation-flag-card-selected'));
  await page.waitForTimeout(380);
  const afterSelection = await readSpreadGeometry(page);
  assertSelectionKeepsSpreadFixed(beforeSelection, afterSelection, label);
  await page.screenshot({ path: outputPath(label, 'card-selected'), fullPage: true });

  const card = await page.locator('#hand .card[data-uid]').first().boundingBox();
  const slot = await page.locator('#spread .slot').first().boundingBox();
  if (card && slot) {
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 8 });
    await page.waitForFunction(() => document.body.classList.contains('presentation-flag-card-dragging'));
    await page.screenshot({ path: outputPath(label, 'card-dragging'), fullPage: true });
    await page.mouse.up();
    await page.waitForTimeout(350);
  }
}

async function captureArchives(page, label) {
  await page.evaluate(() => {
    const first = window.INV_ITEMS?.[0];
    if (first) {
      localStorage.setItem('tlr_attic_found_items', JSON.stringify([first.id]));
      window.renderInventory?.();
    }
    document.getElementById('spv2ArchiveBtn')?.click();
  });
  await page.waitForSelector('#invWrap.open');
  await page.waitForFunction(() => document.body.classList.contains('presentation-surface-archives'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: outputPath(label, 'archives-open'), fullPage: true });

  const item = page.locator('#invDesk .inv-item').first();
  if (await item.count()) {
    await item.click();
    await page.waitForTimeout(80);
    await item.click();
    await page.waitForSelector('.inv-detail-bg');
    await page.waitForTimeout(260);
    await page.screenshot({ path: outputPath(label, 'archive-detail'), fullPage: true });
    await page.keyboard.press('Escape');
  }
  await page.evaluate(() => document.getElementById('spv2ArchiveBtn')?.click());
  await page.waitForTimeout(180);
}

async function captureMarket(page, label) {
  await page.evaluate(() => {
    if (typeof window.openShop === 'function') window.openShop();
  });
  try {
    await page.waitForSelector('.store-front-shell', { timeout: 1800 });
  } catch {
    await page.evaluate(() => {
      const summary = document.getElementById('summary');
      summary.className = 'modal show';
      summary.innerHTML = `<div class="summary store-front-shell"><div class="store-dim"></div><div class="store-candle"></div><div class="store-front store-visible"><div class="store-meta"><button class="store-refresh">Refresh</button><div class="store-reserve-display"><span class="store-reserve-label">Reserve</span><span class="store-reserve-amount">72</span></div></div><div class="store-offer-row"><div class="store-card"><div class="store-card-tag">Scoring</div><div class="store-card-main"><div class="store-card-name">Sequence</div><div class="store-card-desc">Strengthen a scoring pattern.</div></div><button class="store-card-buy">Buy ✦ 25</button></div><div class="store-card store-card--pack"><div class="store-card-tag">Pack</div><div class="store-card-main"><div class="store-card-name">Second Sight</div><div class="store-card-desc">Ability reveals.</div></div><button class="store-card-buy">Buy ✦ 30</button></div><div class="store-card store-card--vessel"><div class="store-card-tag">Relic Slot</div><div class="store-card-main"><div class="store-card-name">Relic Vessel</div><div class="store-card-desc">Gain one Relic Slot.</div></div><button class="store-card-buy">Buy ✦ 35</button></div></div><div class="store-footer"><button class="store-proceed">Continue Reading</button></div></div></div>`;
    });
    await page.waitForSelector('.store-front-shell');
  }
  await page.waitForFunction(() => document.body.classList.contains('presentation-surface-market'));
  await page.waitForTimeout(520);
  await page.screenshot({ path: outputPath(label, 'market'), fullPage: true });
  await page.evaluate(() => {
    document.getElementById('summary').className = '';
    document.getElementById('summary').innerHTML = '';
    document.body.classList.remove('tlr-shop-active');
  });
  await page.waitForTimeout(180);
}

async function captureResultSurfaces(page, label) {
  await page.evaluate(() => {
    const summary = document.getElementById('summary');
    summary.className = 'modal show';
    summary.innerHTML = `<div class="result-panel pass"><div class="rhead"><h3 class="pass">Threshold Cleared</h3></div><div class="rscore"><span class="rsc">30</span><span class="rop">+</span><span class="rsm">48</span><span class="rop">=</span><span class="rsf">78</span></div><hr class="rdiv"><table class="rtable"><tbody><tr class="grouprow"><td colspan="2">Card Points &amp; Patterns</td></tr><tr class="mrow"><td>⚜ Sequence</td><td class="r">+15</td></tr><tr class="totrow"><td>Round total</td><td class="r">78 / 60</td></tr></tbody></table><div class="rbtns"><button class="btn-gold">Visit the Market →</button></div></div>`;
  });
  await page.waitForFunction(() => document.body.classList.contains('presentation-surface-score-result'));
  await page.waitForTimeout(520);
  await page.screenshot({ path: outputPath(label, 'score-result'), fullPage: true });

  await page.evaluate(() => {
    const summary = document.getElementById('summary');
    summary.className = 'modal show';
    summary.innerHTML = `<div class="result-panel pass"><div class="rhead"><span class="rorn">✦ &nbsp; ✦ &nbsp; ✦</span><h3 class="pass">The Reading Ends</h3></div><div class="rscore"><span class="rsf">1240</span></div><span class="rverdict pass">Total Score</span><div class="rscore"><span class="rsf">12</span></div><span class="rverdict pass">Obals</span><p>Tap to close.</p></div>`;
  });
  await page.waitForFunction(() => document.body.classList.contains('presentation-surface-run-end'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: outputPath(label, 'run-ending'), fullPage: true });
  await page.evaluate(() => {
    document.getElementById('summary').className = '';
    document.getElementById('summary').innerHTML = '';
  });
  await page.waitForTimeout(180);
}

async function captureAdventureState(page, label) {
  await page.evaluate(async () => {
    if (typeof window.tlrShowMainMenu === 'function') window.tlrShowMainMenu();
    await new Promise(resolve => setTimeout(resolve, 50));
    if (typeof window.tlrMainMenuAdventure !== 'function') throw new Error('Adventure entry point unavailable');
    await window.tlrMainMenuAdventure();
  });
  await page.waitForFunction(() => document.body.classList.contains('mode-adventure'));
  await page.waitForSelector('#advEventDeck');
  await page.waitForTimeout(500);
  await page.screenshot({ path: outputPath(label, 'adventure-event'), fullPage: true });
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      console.warn('Presentation capture skipped: Playwright Chromium is not installed. Run: npx playwright install chromium');
      return;
    }
    throw error;
  }

  const server = startServer();
  try {
    await waitForServer();
    mkdirSync(outputDir, { recursive: true });

    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('tlr_tut_done', '1');
          window.localStorage.setItem('tlr_spv2_hand_hint_seen', '1');
        } catch {}
      });
      await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });
      const label = `${viewport.width}x${viewport.height}`;
      await startReading(page);
      await captureReadingStates(page, label);
      await captureArchives(page, label);
      await captureMarket(page, label);
      await captureResultSurfaces(page, label);
      await captureAdventureState(page, label);
      await page.close();
    }
  } finally {
    await browser?.close();
    server?.kill('SIGTERM');
  }

  console.log(`Presentation state captures written to ${outputDir}.`);
}

await main();