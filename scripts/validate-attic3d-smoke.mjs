// Headless smoke for the opt-in react-three-fiber attic (?attic3d=1).
//
// Drives the full loop the feature promises: boot a reading, enter the attic,
// let the stand-up choreography finish, focus + rummage a prop through the
// 3D scene (asserting the existing pickup/archive flow still runs), then sit
// back down at the chair and confirm the game lands back on the table UI with
// the 3D layer fully unmounted. Also asserts the flag-off default never
// mounts the chunk.
//
// Requires a Playwright chromium (npx playwright install chromium). Software
// WebGL (SwiftShader) is fine — the scene is deliberately light.

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.ATTIC3D_PORT || 18090);
const baseUrl = `http://127.0.0.1:${port}`;

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

async function launchBrowser() {
  const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
  try {
    return await chromium.launch({ headless: true, args });
  } catch (error) {
    // Container images ship a bare chromium binary outside Playwright's
    // versioned browser layout; fall back to it before giving up.
    try {
      return await chromium.launch({ headless: true, args, executablePath: '/opt/pw-browsers/chromium' });
    } catch {
      throw error;
    }
  }
}

async function newGamePage(browser, { attic3d }) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('tlr_tut_done', '1');
      window.localStorage.setItem('tlr_attic_tutored', '1');
      window.localStorage.setItem('tlr_attic_tutored_obals', '1');
    } catch {}
  });
  await page.goto(`${baseUrl}/game.html${attic3d ? '?attic3d=1' : ''}`, { waitUntil: 'load' });
  await page.waitForSelector('button[onclick="tlrMainMenuNewGame()"]');
  await page.click('button[onclick="tlrMainMenuNewGame()"]');
  await page.waitForFunction(() => document.getElementById('mainMenu')?.hidden === true, null, { timeout: 20000 });
  await page.waitForFunction(() => typeof window.tlrDebugEnterAttic === 'function', null, { timeout: 20000 });
  return { page, pageErrors };
}

const rigState = () => window.__tlrAttic3d?.api?.getState?.() || null;

async function main() {
  let browser;
  try {
    browser = await launchBrowser();
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      const message = '3D attic smoke skipped: Playwright browser executable is not installed.';
      if (process.env.CI === 'true' || process.env.ATTIC3D_VISUAL_REQUIRED === '1') {
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

    // ── flag off: the classic attic must stay classic ──
    {
      const { page, pageErrors } = await newGamePage(browser, { attic3d: false });
      await page.evaluate(() => window.tlrDebugEnterAttic(3, false));
      await page.waitForFunction(() => document.body.classList.contains('mode-attic'), null, { timeout: 8000 });
      await page.waitForTimeout(700);
      const classic = await page.evaluate(() => ({
        canvas: Boolean(document.getElementById('attic3dRoot')),
        live: document.body.classList.contains('attic3d-live'),
        panVisible: getComputedStyle(document.getElementById('atticPan')).display !== 'none',
      }));
      assert.equal(classic.canvas, false, 'flag off: no 3D container should mount');
      assert.equal(classic.live, false, 'flag off: attic3d-live must not be set');
      assert.equal(classic.panVisible, true, 'flag off: 2D pan layer should be visible');
      assert.deepEqual(pageErrors, [], `flag off: no page errors, got: ${pageErrors.join(' | ')}`);
      await page.close();
    }

    // ── flag on: full stand up → rummage → sit down loop ──
    const { page, pageErrors } = await newGamePage(browser, { attic3d: true });
    await page.evaluate(() => window.tlrDebugEnterAttic(3, false));

    await page.waitForFunction(
      () => document.body.classList.contains('attic3d-live') && window.__tlrAttic3d?.mounted === true,
      null,
      { timeout: 30000 },
    );
    const mountInfo = await page.evaluate(() => {
      const canvas = document.querySelector('#attic3dRoot canvas');
      return {
        hasCanvas: Boolean(canvas),
        width: canvas?.clientWidth || 0,
        height: canvas?.clientHeight || 0,
        webgl: Boolean(canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))),
        panHidden: getComputedStyle(document.getElementById('atticPan')).display === 'none',
        returnHidden: getComputedStyle(document.getElementById('atticTableReturn')).display === 'none',
      };
    });
    assert.ok(mountInfo.hasCanvas, 'flag on: canvas should mount inside #attic3dRoot');
    assert.ok(mountInfo.width > 200 && mountInfo.height > 200, 'canvas should fill the scene');
    assert.ok(mountInfo.webgl, 'canvas should hold a live WebGL context');
    assert.ok(mountInfo.panHidden, '2D pan layer should hand over to the canvas');
    assert.ok(mountInfo.returnHidden, 'DOM return button should hand over to the diegetic chair');

    // Stand-up choreography: begins seated, ends free at standing height.
    // (The debug api registers from a React effect, one tick after mount.)
    await page.waitForFunction(() => Boolean(window.__tlrAttic3d?.api?.getState?.()), null, { timeout: 15000 });
    const early = await page.evaluate(rigState);
    assert.ok(['rising', 'free'].includes(early.phase), `rig should start in the stand-up beat, got ${early.phase}`);
    await page.waitForFunction(state => window.__tlrAttic3d?.api?.getState?.()?.phase === 'free', null, {
      timeout: 20000,
    });
    const standing = await page.evaluate(rigState);
    assert.ok(Math.abs(standing.position[1] - 1.58) < 0.08, `standing eye height, got ${standing.position[1]}`);
    await page.screenshot({ path: 'artifacts/attic3d-1-standing.png' });

    // Room view toward the candle shelf + window (art review shot).
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(2.4, 1.9, 0.71, 0.02));
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'artifacts/attic3d-5-room-view.png' });

    // Walk to the coat and focus it: the diegetic prompt should appear.
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(-2.35, -0.4, Math.PI / 2, -0.1));
    await page.waitForFunction(() => window.__tlrAttic3d?.api?.getState?.()?.focusId === 'coat_01', null, {
      timeout: 8000,
    });
    await page.screenshot({ path: 'artifacts/attic3d-2-focus-coat.png' });

    // Rummage through the 3D interact path: the existing DOM pickup flow and
    // archive unlock must run unchanged.
    await page.evaluate(() => window.__tlrAttic3d.api.interact());
    await page.waitForSelector('#atticPickup', { timeout: 8000 });
    await page.screenshot({ path: 'artifacts/attic3d-3-pickup.png' });
    await page.click('#atticPickup');
    await page.waitForFunction(
      () => {
        try {
          return JSON.parse(localStorage.getItem('tlr_attic_found_items') || '[]').includes('letter_01');
        } catch {
          return false;
        }
      },
      null,
      { timeout: 5000 },
    );
    const storeSawIt = await page.evaluate(() =>
      Boolean(window.tlrStore?.getState?.()?.persist?.discoveredArchiveItems?.includes?.('letter_01')),
    );
    assert.ok(storeSawIt, 'DISCOVER_ARCHIVE_ITEM should land in the architecture store');

    // Searched props go quiet: the coat should no longer take focus.
    await page.waitForFunction(() => window.__tlrAttic3d?.api?.getState?.()?.focusId !== 'coat_01', null, {
      timeout: 5000,
    });

    // Sit back down at the chair: choreography plays, then the normal
    // attic->table transition runs and the 3D layer unmounts. (Stand behind
    // the chair looking down at it — the table itself is a collision zone.)
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(0, 2.25, 0, -0.62));
    await page.waitForFunction(() => window.__tlrAttic3d?.api?.getState?.()?.focusId === 'chair', null, {
      timeout: 8000,
    });
    await page.evaluate(() => window.__tlrAttic3d.api.interact());
    await page.waitForFunction(() => document.body.classList.contains('mode-reading'), null, { timeout: 20000 });
    await page.waitForFunction(
      () => !document.getElementById('attic3dRoot') && !document.body.classList.contains('attic3d-live'),
      null,
      { timeout: 8000 },
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'artifacts/attic3d-4-back-at-table.png' });
    const backAtTable = await page.evaluate(() => ({
      spreadVisible: Boolean(document.querySelector('.spread-wrap')),
      atticHidden: document.getElementById('atticScene')?.getAttribute('aria-hidden') === 'true',
    }));
    assert.ok(backAtTable.spreadVisible, 'table spread should be back after sitting down');
    assert.ok(backAtTable.atticHidden, 'attic scene should be aria-hidden after leaving');

    // Re-entry must remount cleanly (fresh visit, fresh canvas).
    await page.evaluate(() => window.tlrDebugEnterAttic(2, false));
    await page.waitForFunction(
      () => document.body.classList.contains('attic3d-live') && window.__tlrAttic3d?.mounted === true,
      null,
      { timeout: 20000 },
    );
    await page.evaluate(() => window.tlrDebugLeaveAttic());
    await page.waitForFunction(() => !document.getElementById('attic3dRoot'), null, { timeout: 8000 });

    assert.deepEqual(pageErrors, [], `flag on: no page errors, got: ${pageErrors.join(' | ')}`);
    await page.close();
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log('3D attic smoke checks passed.');
}

await main();
