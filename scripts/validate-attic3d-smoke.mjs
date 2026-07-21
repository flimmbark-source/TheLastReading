// Headless smoke for the react-three-fiber single-player layer (on by
// default; ?attic3d=0 is the kill-switch): the run-start approach cinematic
// and the walkable 3D attic.
//
// Drives the full loop the feature promises: boot a reading through the
// approach overlay (and skip it), enter the attic, let the stand-up
// choreography finish, tap-walk across the room, auto-walk to a prop and
// rummage it through the 3D interact path (asserting the existing
// pickup/archive flow still runs), then sit back down at the chair and
// confirm the game lands back on the table UI with the 3D layer fully
// unmounted. Also asserts the flag-off default never mounts either surface.
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
  // 3D is on by default now: the on-pass uses the plain URL to prove the
  // default path, the off-pass exercises the ?attic3d=0 kill-switch.
  await page.goto(`${baseUrl}/game.html${attic3d ? '' : '?attic3d=0'}`, { waitUntil: 'load' });
  await page.waitForSelector('button[onclick="tlrMainMenuNewGame()"]');
  await page.click('button[onclick="tlrMainMenuNewGame()"]');
  return { page, pageErrors };
}

async function finishBoot(page) {
  await page.waitForFunction(() => document.getElementById('mainMenu')?.hidden === true, null, { timeout: 30000 });
  await page.waitForFunction(() => typeof window.tlrDebugEnterAttic === 'function', null, { timeout: 20000 });
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

    // ── kill-switch (?attic3d=0): no approach overlay, classic attic stays classic ──
    {
      const { page, pageErrors } = await newGamePage(browser, { attic3d: false });
      await finishBoot(page);
      const overlayOff = await page.evaluate(() => ({
        approach: Boolean(document.getElementById('table3dApproach') || window.__tlrTable3d),
      }));
      assert.equal(overlayOff.approach, false, 'flag off: no approach overlay should mount');
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
      const noSeat = await page.evaluate(() => Boolean(document.getElementById('table3dSeat')));
      assert.equal(noSeat, false, 'flag off: no seated-table backdrop should mount');
      assert.deepEqual(pageErrors, [], `flag off: no page errors, got: ${pageErrors.join(' | ')}`);
      await page.close();
    }

    // ── flag on: approach cinematic, then the full attic loop ──
    const { page, pageErrors } = await newGamePage(browser, { attic3d: true });

    // Run-start approach: overlay mounts, walks in from the door, and a tap
    // (or api skip) jumps to the seat; the fade waits for the boot beneath.
    await page.waitForFunction(() => Boolean(window.__tlrTable3d?.api?.getState?.()), null, { timeout: 45000 });
    const approachState = await page.evaluate(() => window.__tlrTable3d.api.getState());
    assert.ok(
      ['approach', 'done'].includes(approachState.phase),
      `approach overlay should be playing its timeline, got ${approachState.phase}`,
    );
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'artifacts/attic3d-6-approach.png' });
    await page.evaluate(() => window.__tlrTable3d.skip());
    await page.waitForFunction(() => !document.getElementById('table3dApproach'), null, { timeout: 20000 });
    await finishBoot(page);
    const afterApproach = await page.evaluate(() => ({
      spread: Boolean(document.querySelector('.spread-wrap')),
      overlayGone: !window.__tlrTable3d,
    }));
    assert.ok(afterApproach.spread, 'table UI should be live after the approach fades');
    assert.ok(afterApproach.overlayGone, 'approach debug handle should clear on dispose');

    // Hybrid seated table: the 3D room stays mounted beneath the live SPv2
    // DOM, the painted body background comes off, and the spread is anchored
    // onto the projected cloth. The hand dock intentionally stays in its native
    // bottom-of-screen position unless the comparison-only opt-in is enabled.
    await page.waitForFunction(() => window.__tlrTableSeat?.mounted === true, null, { timeout: 15000 });
    await page.waitForFunction(
      () =>
        document.body.classList.contains('table3d-live') &&
        document.body.classList.contains('table3d-anchored'),
      null,
      { timeout: 12000 },
    );
    const defaultHandAnchored = await page.evaluate(() =>
      document.body.classList.contains('table3d-anchored-hand'),
    );
    assert.equal(defaultHandAnchored, false, 'the default seated view should keep the hand dock native');
    const hybrid = await page.evaluate(() => {
      const canvas = document.querySelector('#table3dSeat canvas');
      const rootStyle = getComputedStyle(document.documentElement);
      const spread = document.getElementById('spread');
      const rect = spread.getBoundingClientRect();
      return {
        hasCanvas: Boolean(canvas),
        bodyBackgroundImage: getComputedStyle(document.body).backgroundImage,
        anchorX: Number.parseFloat(rootStyle.getPropertyValue('--t3d-spread-c-x')),
        anchorY: Number.parseFloat(rootStyle.getPropertyValue('--t3d-spread-c-y')),
        spreadCenterX: rect.left + rect.width / 2,
        spreadCenterY: rect.top + rect.height / 2,
      };
    });
    assert.ok(hybrid.hasCanvas, 'seated backdrop canvas should be mounted');
    assert.equal(hybrid.bodyBackgroundImage, 'none', 'painted table background should be off in hybrid mode');
    assert.ok(
      Math.abs(hybrid.spreadCenterX - hybrid.anchorX) < 30 && Math.abs(hybrid.spreadCenterY - hybrid.anchorY) < 30,
      `spread should sit on its projected anchor (anchor ${hybrid.anchorX},${hybrid.anchorY} vs rect ${hybrid.spreadCenterX},${hybrid.spreadCenterY})`,
    );
    await page.screenshot({ path: 'artifacts/attic3d-8-seated-hybrid.png' });

    // The native hand dock must stay fully interactive over the seated
    // backdrop: a real click on a card selects it.
    const cardPoint = await page.evaluate(() => {
      const cards = document.querySelectorAll('#hand .card[data-uid]');
      const card = cards[cards.length - 1]; // rightmost: top of the fan stack
      const r = card.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.65 };
    });
    await page.mouse.click(cardPoint.x, cardPoint.y);
    await page.waitForFunction(
      () => document.querySelector('#hand .card.sel, #hand .card.ability-picked, .card-detail-trigger'),
      null,
      { timeout: 6000 },
    );

    // Enter the attic: the seated backdrop hands over to the walkable scene.
    await page.evaluate(() => window.tlrDebugEnterAttic(3, false));
    await page.waitForFunction(() => !document.getElementById('table3dSeat'), null, { timeout: 8000 });
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
    await page.waitForFunction(() => window.__tlrAttic3d?.api?.getState?.()?.phase === 'free', null, {
      timeout: 20000,
    });
    const standing = await page.evaluate(rigState);
    assert.ok(Math.abs(standing.position[1] - 1.58) < 0.08, `standing eye height, got ${standing.position[1]}`);
    await page.screenshot({ path: 'artifacts/attic3d-1-standing.png' });

    // Tap-to-move on open floor: a real canvas click on empty floor should
    // engage an auto-walk (gold ring marker) and actually travel. Aim down
    // the -X wall from beside the trunk — no interactable projects anywhere
    // near the tap point, so this exercises the pure floor path.
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(2.6, -1.0, Math.PI / 2, -0.3));
    await page.waitForTimeout(250);
    await page.mouse.click(640, 620); // floor a couple of meters ahead
    await page.waitForFunction(() => Boolean(window.__tlrAttic3d?.api?.getState?.()?.autoWalk), null, {
      timeout: 5000,
    });
    await page.waitForFunction(
      () => {
        const state = window.__tlrAttic3d?.api?.getState?.();
        return state && !state.autoWalk && state.position[0] < 1.7;
      },
      null,
      { timeout: 15000 },
    );
    const noStrayPickup = await page.evaluate(() => Boolean(document.getElementById('atticPickup')));
    assert.equal(noStrayPickup, false, 'a pure floor tap must not open any pickup');

    // Blocked auto-walk must TIME OUT, not walk forever: stand just north of
    // the trunk and aim at a point directly behind it. The trunk keep-out
    // pins the player, so no progress is made — the walk should give up
    // within ~1.5s instead of grinding against the obstacle indefinitely.
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(2.85, -0.9, Math.PI, -0.2));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__tlrAttic3d.api.walkTo(2.85, -2.9, null));
    await page.waitForFunction(() => Boolean(window.__tlrAttic3d?.api?.getState?.()?.autoWalk), null, {
      timeout: 3000,
    });
    await page.waitForFunction(() => !window.__tlrAttic3d?.api?.getState?.()?.autoWalk, null, { timeout: 3000 });
    const afterBlocked = await page.evaluate(() => window.__tlrAttic3d.api.getState());
    assert.ok(
      afterBlocked.position[2] > -1.6,
      `blocked walk should stall at the trunk, not pass through it (z=${afterBlocked.position[2]})`,
    );

    // Tap-to-use: walking to a prop by pointing at it rummages it on arrival —
    // the existing DOM pickup flow and archive unlock must run unchanged.
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(-0.5, 1.6, 0.4, 0));
    await page.evaluate(() => window.__tlrAttic3d.api.walkTo(-2.35, -0.4, 'coat_01'));
    await page.waitForSelector('#atticPickup', { timeout: 20000 });
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

    // The discovery becomes physical: a keepsake for the letter appears on
    // the trunk lid, driven by the store's discoveredArchiveItems.
    await page.waitForFunction(
      () => window.__tlrAttic3d?.api?.dumpScene?.().some(object => object.name === 'keepsake-letter_01'),
      null,
      { timeout: 8000 },
    );

    // The trunk is the archives: focusing and using it opens the drawer.
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(2.4, -0.5, -0.3, -0.25));
    await page.waitForFunction(() => window.__tlrAttic3d?.api?.getState?.()?.focusId === 'archives_trunk', null, {
      timeout: 8000,
    });
    await page.evaluate(() => window.__tlrAttic3d.api.interact());
    await page.waitForFunction(() => document.getElementById('invWrap')?.classList.contains('open'), null, {
      timeout: 5000,
    });
    await page.waitForTimeout(700); // drawer slide-in
    await page.screenshot({ path: 'artifacts/attic3d-7-trunk-archives.png' });
    await page.evaluate(() => window.tlrCloseArchives());
    await page.waitForFunction(() => !document.getElementById('invWrap')?.classList.contains('open'), null, {
      timeout: 5000,
    });

    // Sit back down by TAPPING the chair from across the room: the tap must
    // pick the chair (enlarged hit radius), auto-walk into range, and trigger
    // the sit on arrival — the whole one-tap "go sit down" the player expects.
    // Then the normal attic->table transition runs and the 3D layer unmounts.
    await page.evaluate(() => window.__tlrAttic3d.api.teleport(-2.0, 2.0, -1.38, -0.12));
    await page.waitForTimeout(200);
    const chairPt = await page.evaluate(() => window.__tlrAttic3d.api.projectPoint([0, 0.9, 1.62]));
    assert.ok(chairPt[2] < 1, 'chair should project on-screen for the tap');
    await page.evaluate(pt => window.__tlrAttic3d.api.tapAt(pt[0], pt[1]), chairPt);
    // The tap resolves to the chair: either already walking to it, or (once
    // arrived) the sit choreography / seated hand-off has begun.
    await page.waitForFunction(
      () => {
        const s = window.__tlrAttic3d?.api?.getState?.();
        return s && (s.autoWalk?.interactId === 'chair' || s.phase === 'sitting' || s.phase === 'done');
      },
      null,
      { timeout: 6000 },
    );
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

    // ...and the seated backdrop returns for the reading.
    await page.waitForFunction(
      () => window.__tlrTableSeat?.mounted === true && document.body.classList.contains('table3d-live'),
      null,
      { timeout: 10000 },
    );

    // Re-entry must remount cleanly (fresh visit, fresh canvas).
    await page.evaluate(() => window.tlrDebugEnterAttic(2, false));
    await page.waitForFunction(
      () => document.body.classList.contains('attic3d-live') && window.__tlrAttic3d?.mounted === true,
      null,
      { timeout: 20000 },
    );
    await page.evaluate(() => window.tlrDebugLeaveAttic());
    await page.waitForFunction(() => !document.getElementById('attic3dRoot'), null, { timeout: 8000 });

    // Returning to the main menu tears the backdrop down and restores the
    // painted background for whatever comes next.
    await page.waitForFunction(() => window.__tlrTableSeat?.mounted === true, null, { timeout: 10000 });
    await page.evaluate(() => window.tlrReturnToMenu());
    await page.waitForFunction(
      () => !document.getElementById('table3dSeat') && !document.body.classList.contains('table3d-live'),
      null,
      { timeout: 8000 },
    );

    assert.deepEqual(pageErrors, [], `flag on: no page errors, got: ${pageErrors.join(' | ')}`);
    await page.close();
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log('3D attic smoke checks passed.');
}

await main();
