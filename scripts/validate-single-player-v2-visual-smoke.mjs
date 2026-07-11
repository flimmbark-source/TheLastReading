import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.SPV2_VISUAL_PORT || 18080);
const baseUrl = `http://127.0.0.1:${port}`;
const widths = [360, 390, 430];
const height = 844;

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

async function verifyCardDetailTrigger(page, width) {
  // Select through the app's real card click handler, but invoke it directly so
  // the perpetual hand idle animation cannot make Playwright reject the setup
  // click as "not stable" before the detail-button test even begins.
  await page.evaluate(() => document.querySelector('#hand > .card[data-uid]')?.click());
  await page.waitForSelector('.card-detail-trigger');
  await page.waitForTimeout(450);

  const hit = await page.evaluate(() => {
    const trigger = document.querySelector('.card-detail-trigger');
    const rect = trigger?.getBoundingClientRect();
    if (!trigger || !rect) return null;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    const chain = [];
    for (let node = top; node && chain.length < 6; node = node.parentElement) {
      chain.push(`${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.className ? `.${String(node.className).trim().replace(/\s+/g, '.')}` : ''}`);
    }
    return {
      x,
      y,
      triggerIsTop: top === trigger || trigger.contains(top),
      chain,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    };
  });

  assert.ok(hit, `detail trigger should have live geometry at ${width}px`);
  assert.ok(
    hit.triggerIsTop,
    `detail trigger should be the live hit target at ${width}px; topmost=${hit.chain.join(' > ')} rect=${JSON.stringify(hit.rect)}`,
  );

  await page.touchscreen.tap(hit.x, hit.y);
  await page.waitForSelector('.card-detail-backdrop', { timeout: 1500 });
  await page.evaluate(() => window.closeCardDetail?.());
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      const message = 'Single Player V2 visual smoke skipped: Playwright browser executable is not installed.';
      if (process.env.CI === 'true' || process.env.SPV2_VISUAL_REQUIRED === '1') {
        throw new Error(`${message} Run: npx playwright install chromium`);
      }
      console.warn(message);
      return;
    }
    throw error;
  }

  const server = startServer();
  try {
    await waitForServer();
    mkdirSync('artifacts', { recursive: true });

    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true });
      // Skip the first-run tutorial overlay so it can't intercept the clicks below.
      await page.addInitScript(() => {
        try { window.localStorage.setItem('tlr_tut_done', '1'); } catch {}
      });
      await page.goto(`${baseUrl}/game.html`, { waitUntil: 'networkidle' });

      // Drive the real main-menu boot path instead of forcing SPv2 body classes:
      // the SPv2 game engine (gesture drawers, ability handlers, generated-sheet
      // art) only loads once a game actually starts, so a synthetic class swap
      // renders an empty shell and can't catch real interaction regressions.
      await page.click('button[onclick="tlrMainMenuNewGame()"]');
      await page.waitForFunction(() => document.body.classList.contains('generated-sheet-ready'));
      await page.waitForFunction(() => document.getElementById('mainMenu')?.hidden === true);
      await page.waitForSelector('#abilitiesBtn');

      const snapshot = await page.evaluate(() => {
        const boxFor = selector => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            display: style.display,
            visibility: style.visibility,
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
          };
        };
        return {
          abilities: boxFor('#abilitiesBtn'),
          menu: boxFor('#menuBtn'),
          scoring: boxFor('#scoringBtn'),
          scoreHud: boxFor('.score-stack'),
          spread: boxFor('.spread'),
          handDock: boxFor('.handDock'),
        };
      });

      for (const [name, box] of Object.entries(snapshot)) {
        assert.ok(box, `${name} should exist at ${width}px`);
        assert.notEqual(box.display, 'none', `${name} should not be display:none at ${width}px`);
        assert.notEqual(box.visibility, 'hidden', `${name} should not be visibility:hidden at ${width}px`);
        assert.ok(box.width > 0, `${name} should have width at ${width}px`);
        assert.ok(box.height > 0, `${name} should have height at ${width}px`);
        assert.ok(box.left >= -4, `${name} should not be clipped off the left edge at ${width}px`);
        assert.ok(box.left + box.width <= width + 4, `${name} should not be clipped off the right edge at ${width}px`);
      }

      const utilityTops = [snapshot.abilities.top, snapshot.menu.top, snapshot.scoring.top];
      const topSpread = Math.max(...utilityTops) - Math.min(...utilityTops);
      assert.ok(topSpread <= 28, `utility medallions should remain in one top cluster at ${width}px`);
      assert.ok(snapshot.scoreHud.top < snapshot.spread.top, `score HUD should render above spread at ${width}px`);
      assert.ok(snapshot.spread.top < snapshot.handDock.top, `spread should render above hand dock at ${width}px`);

      await verifyCardDetailTrigger(page, width);

      await page.click('#abilitiesBtn');
      await page.waitForFunction(() => document.querySelector('#abilitiesPullWrap')?.classList.contains('open'));
      await page.screenshot({ path: `artifacts/spv2-smoke-${width}.png`, fullPage: true });
      await page.close();
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log('Single Player V2 visual smoke checks passed.');
}

await main();
