import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.PRESENTATION_CAPTURE_PORT || 18082);
const baseUrl = `http://127.0.0.1:${port}`;
const viewports = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

function startServer() {
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

async function captureReadingStates(page, label) {
  await page.screenshot({ path: `artifacts/presentation-${label}-reading-idle.png`, fullPage: true });

  await page.click('#hand .card[data-uid]');
  await page.waitForFunction(() => document.body.classList.contains('presentation-flag-card-selected'));
  await page.screenshot({ path: `artifacts/presentation-${label}-card-selected.png`, fullPage: true });

  const card = await page.locator('#hand .card[data-uid]').first().boundingBox();
  const slot = await page.locator('#spread .slot').first().boundingBox();
  if (card && slot) {
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.down();
    await page.mouse.move(slot.x + slot.width / 2, slot.y + slot.height / 2, { steps: 8 });
    await page.waitForFunction(() => document.body.classList.contains('presentation-flag-card-dragging'));
    await page.screenshot({ path: `artifacts/presentation-${label}-card-dragging.png`, fullPage: true });
    await page.mouse.up();
    await page.waitForTimeout(350);
  }
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
  await page.screenshot({ path: `artifacts/presentation-${label}-adventure-event.png`, fullPage: true });
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
    mkdirSync('artifacts', { recursive: true });

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
      await captureAdventureState(page, label);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }

  console.log('Presentation state captures written to artifacts/.');
}

await main();
