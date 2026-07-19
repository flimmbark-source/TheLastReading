// Full interaction-state pass for the portrait hybrid seated table
// (?attic3d=1, Test A: anchored spread + native hand). Verifies that real
// SPv2 gameplay states — not just the idle empty spread — composite cleanly
// with the 3D-anchored spread row: populated/face-up cards, selection and
// drag, ability targeting (a spread-targeting ability and a hand-only one),
// discard/purge targeting, near-completion hints, score ghosts + threshold
// reactions, card-detail view, the first-run tutorial, pull-tab drawers, a
// portrait aspect-ratio sweep, and rotation mid-interaction.
//
// Every step drives the real production code paths (the same window.* entry
// points click handlers call, or actual clicks/CDP touch dispatch), matching
// the house style already used by scripts/_ab/capture.mjs and the other
// validate-*.mjs smokes — this is not a CSS-only mockup. Card melds are
// chosen deliberately: placeCard() runs the real checkEnd() scoring check on
// every placement, so states that need to stay interactive afterward use
// non-melding card combinations, and only the dedicated score/threshold step
// uses a combo strong enough to clear the threshold and end the round.

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = Number(process.env.ATTIC3D_STATES_PORT || 18091);
const baseUrl = `http://127.0.0.1:${port}`;
const OUT_DIR = 'artifacts';
const PRIMARY = { width: 390, height: 844 };
// A light aspect-ratio sweep, not a full state matrix at every size — this
// only re-checks that Test A's fit gate behaves (anchors or gracefully
// doesn't) across common portrait phones.
const ASPECTS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
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

async function launchBrowser() {
  const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
  try {
    return await chromium.launch({ headless: true, args });
  } catch (error) {
    try {
      return await chromium.launch({ headless: true, args, executablePath: '/opt/pw-browsers/chromium' });
    } catch {
      throw error;
    }
  }
}

const SEED_SCRIPT = `
(() => {
  let s = 42;
  Math.random = function() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

async function newPortraitGame(browser, { width, height, skipTutorial = true } = PRIMARY) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
  await page.addInitScript(SEED_SCRIPT);
  await page.addInitScript(skip => {
    try {
      if (skip) window.localStorage.setItem('tlr_tut_done', '1');
      window.localStorage.setItem('tlr_attic_tutored', '1');
      window.localStorage.setItem('tlr_attic_tutored_obals', '1');
      window.localStorage.setItem('tlr_attic3d_hint_seen', '1');
      window.localStorage.setItem('tlr_hand_hint_step', '4');
      window.localStorage.setItem('tlr_spv2_hand_hint_seen', '1');
    } catch {}
  }, skipTutorial);
  await page.goto(`${baseUrl}/game.html?attic3d=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.body.classList.contains('main-menu-active'), null, { timeout: 20000 });
  await page.click('button[onclick="tlrMainMenuNewGame()"]');
  await page.waitForFunction(() => document.getElementById('mainMenu')?.hidden === true, null, { timeout: 30000 });
  await page.waitForFunction(() => typeof window.tlrDebugEnterAttic === 'function', null, { timeout: 20000 });
  return { context, page, pageErrors };
}

async function reachSeatedTable(page) {
  await page
    .waitForFunction(() => Boolean(window.__tlrTable3d?.api?.getState?.()), null, { timeout: 30000 })
    .catch(() => {});
  await page.evaluate(() => window.__tlrTable3d?.skip?.());
  await page.waitForFunction(() => !document.getElementById('table3dApproach'), null, { timeout: 30000 });
  await page.waitForFunction(() => window.__tlrTableSeat?.mounted === true, null, { timeout: 15000 });
}

// Seeds hand/deck/spread through the real store action, then mirrors the
// legacy `state` object the same way scripts/_ab/capture.mjs does
// (SYNC_LEGACY_RUN alone does not repaint the legacy-bridged renderer).
// `spread` entries are card ids or null and are placed directly into
// state/run — this is scene setup, not a real placeCard() call, so it never
// triggers checkEnd()'s scoring/threshold cascade. Use real placeCard() calls
// (see placeAndWait below) when the point of the state IS that cascade.
async function seedRun(page, { hand, deck = [], spread = [null, null, null, null, null] }) {
  await page.evaluate(
    ({ handIds, deckIds, spreadIds }) => {
      const byId = new Map(window.ALL_CARD_DEFINITIONS_FOR_TEST || []);
      let nextUid = 9000;
      const build = ids =>
        ids.map(id => {
          if (!id) return null;
          const def = byId.get(id);
          return { ...def, uid: nextUid++ };
        });
      const hand = build(handIds);
      const deck = build(deckIds);
      const spread = build(spreadIds);
      window.tlrStore.dispatch({
        type: window.tlrActions.SYNC_LEGACY_RUN,
        run: { hand, deck, spread, discard: [], discardedCards: [], discards: 3, selectedCardId: null },
      });
      const st = window.tlrRuntime.state;
      st.hand = hand;
      st.deck = deck;
      st.spread = spread;
      st.discard = [];
      st.discardedCards = [];
      st.discards = 3;
      st.selected = null;
      window.render();
    },
    { handIds: hand, deckIds: deck, spreadIds: spread },
  );
}

async function clickHandCardByUid(page, uid) {
  await page.evaluate(id => document.querySelector(`#hand .card[data-uid="${id}"]`)?.click(), uid);
}

// Selects the hand card with the given (test-seeded) card id and places it,
// through the real click + window.placeCard() path — the actual production
// entry point a click handler calls, per the existing house convention. The
// DOM card element doesn't carry the definition id, so the uid is resolved
// from the live legacy `state.hand` array (the same object the click reads).
async function placeAndWait(page, cardId, slotIndex, waitMs = 250) {
  const uid = await page.evaluate(
    id => window.tlrRuntime?.state?.hand?.find(card => card.id === id)?.uid ?? null,
    cardId,
  );
  if (uid === null) throw new Error(`could not resolve hand card for ${cardId}`);
  await clickHandCardByUid(page, uid);
  await page.evaluate(index => window.placeCard(index), slotIndex);
  await page.waitForTimeout(waitMs);
}

async function main() {
  let browser;
  try {
    browser = await launchBrowser();
  } catch (error) {
    if (String(error?.message || error).includes("Executable doesn't exist")) {
      const message = 'Mobile state-pass skipped: Playwright browser executable is not installed.';
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
    mkdirSync(OUT_DIR, { recursive: true });

    const cardDefsModule = await import('../src/data/cards.mjs');
    const cardDefs = cardDefsModule.ALL_CARD_DEFINITIONS.map(c => [c.id, c]);

    // ── primary portrait pass: the full interaction-state list ──
    {
      const { context, page, pageErrors } = await newPortraitGame(browser, { ...PRIMARY, skipTutorial: false });
      await page.evaluate(defs => {
        window.ALL_CARD_DEFINITIONS_FOR_TEST = defs;
      }, cardDefs);

      // 1) First-run tutorial composited over the anchored table.
      await page.waitForSelector('#tutTip', { timeout: 15000 }).catch(() => {});
      const tutVisible = await page.evaluate(() => document.getElementById('tutTip')?.offsetParent !== null);
      if (tutVisible) {
        await page.screenshot({ path: `${OUT_DIR}/mstate-01-tutorial.png` });
        await page.click('#tutSkipBtn').catch(() => {});
        await page.waitForTimeout(300);
      } else {
        console.warn('Tutorial did not appear on this run; continuing.');
      }

      await reachSeatedTable(page);
      await page.waitForFunction(
        () => document.body.classList.contains('table3d-live') && document.body.classList.contains('table3d-anchored'),
        null,
        { timeout: 15000 },
      );
      await page.waitForTimeout(400);

      // 2) Empty spread.
      await page.screenshot({ path: `${OUT_DIR}/mstate-02-empty-spread.png` });

      // Group 1: build the populated spread via REAL placeCard() calls, but
      // deliberately stay under the 30-point threshold so checkEnd() never
      // ends the round — 17/18/19 score a real "Sequence of 3" meld
      // (validated in scripts/validate-scoring-cases.mjs, ~18.75 points, a
      // Sequence of 4/5 is what would push it over 30) and 2/9 are unrelated
      // majors that fill the row without extending the sequence.
      // Two extra hand cards (14, 15) are left unplaced for steps 6-7
      // (select, drag) against the still-populated board.
      await seedRun(page, {
        hand: ['major_17', 'major_18', 'major_19', 'major_2', 'major_9', 'major_14', 'major_15'],
        deck: ['major_0', 'major_1', 'major_3'],
      });
      await page.waitForTimeout(150);

      // 3) First face-up card placed — the frame to check rim overlap on a
      // single card before the whole row is judged.
      await placeAndWait(page, 'major_18', 2);
      await page.screenshot({ path: `${OUT_DIR}/mstate-03-first-card.png` });
      const oneCardGeometry = await page.evaluate(() => {
        const r = document.querySelector('#spread .slot .card')?.getBoundingClientRect();
        return r ? { top: r.top, bottom: r.bottom } : null;
      });
      assert.ok(oneCardGeometry, 'a placed card should have live geometry');

      // 4) Three-card sequence — real "Sequence of 3" meld, real hint state
      // on the remaining hand cards that would extend it. Safely under
      // threshold (~18.75 of 30), so the round stays open.
      await placeAndWait(page, 'major_17', 1);
      await placeAndWait(page, 'major_19', 3, 400);
      await page.screenshot({ path: `${OUT_DIR}/mstate-04-sequence-hint.png` });
      const stillPlaying = await page.evaluate(() => !document.getElementById('summary')?.className);
      assert.ok(stillPlaying, 'a Sequence of 3 alone must stay under threshold and keep the round open');

      // 5) Full five-card populated spread — the frame that matters most for
      // the rim-overlap acceptance check below. The two extra majors do not
      // extend the sequence, so this also stays under threshold.
      await placeAndWait(page, 'major_2', 0);
      await placeAndWait(page, 'major_9', 4, 400);
      await page.screenshot({ path: `${OUT_DIR}/mstate-05-full-spread.png` });

      // Rim-overlap acceptance check: every placed card's top edge must sit
      // below (i.e. greater screen-Y than) the projected cloth far rim.
      const rimCheck = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('#spread .slot .card')].map(el => el.getBoundingClientRect());
        const clothTopY = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--t3d-cloth-rim-y'),
        );
        return { tops: rects.map(r => r.top), clothTopY };
      });
      console.log('RIM-CHECK:', JSON.stringify(rimCheck));
      assert.ok(Number.isFinite(rimCheck.clothTopY), 'the cloth rim anchor should be projected');
      assert.equal(rimCheck.tops.length, 5, 'all five spread cards should have live geometry');
      for (const top of rimCheck.tops) {
        assert.ok(
          top >= rimCheck.clothTopY - 6,
          `placed card top (${top.toFixed(1)}) should sit on the cloth, not above the far rim (${rimCheck.clothTopY.toFixed(1)})`,
        );
      }

      // 6) Selected hand card (still on the populated board).
      const remainingUid = await page.evaluate(() => {
        const el = document.querySelector('#hand .card[data-uid]');
        return el ? Number(el.dataset.uid) : null;
      });
      assert.ok(remainingUid !== null, 'the two extra hand cards should remain unplaced for selection/drag');
      if (remainingUid !== null) {
        await clickHandCardByUid(page, remainingUid);
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${OUT_DIR}/mstate-06-hand-selected.png` });

        // 7) Mid-drag hold (CDP touch dispatch, same technique as
        // scripts/_ab/capture.mjs's m-mid-drag case).
        const cdp = await context.newCDPSession(page);
        const r = await page.evaluate(
          id => document.querySelector(`#hand .card[data-uid="${id}"]`)?.getBoundingClientRect().toJSON(),
          remainingUid,
        );
        if (r) {
          const sx = r.x + r.width / 2;
          const sy = r.y + r.height / 2;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
          await page.waitForTimeout(100);
          for (let i = 1; i <= 8; i++) {
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x: sx, y: sy - i * 22, id: 1 }],
            });
            await page.waitForTimeout(25);
          }
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${OUT_DIR}/mstate-07-hand-dragging.png` });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
          await page.waitForTimeout(200);
        }
      }

      // Group 2: ability targeting on a pre-populated (but directly-seeded,
      // not placed) board, so opening the ability picker has real spread
      // cards to target without risking another checkEnd cascade.
      const abilityBoard = ['major_2', 'major_6', 'major_9', 'major_13', null];

      // 8) Ability targeting: a spread-targeting ability (MIRROR) — the
      // state that actually composites with the anchored spread.
      await seedRun(page, { hand: ['major_10', 'major_1'], deck: ['major_3'], spread: abilityBoard });
      await page.waitForTimeout(200);
      await page.evaluate(() => window.discardCardUid(9000)); // major_10, MIRROR_1
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT_DIR}/mstate-08-ability-mirror-target.png` });
      await page.evaluate(() => window.cancelAbilitySelection?.()).catch(() => {});
      await page.waitForTimeout(200);

      // 9) Ability targeting: a hand-only ability (BETWEEN_2). Documented as
      // hand/deck-only — it never touches the spread, so this only confirms
      // the choice UI still layers correctly above the hybrid canvas.
      await seedRun(page, {
        hand: ['major_5', 'major_1', 'major_3'],
        deck: ['major_4', 'major_6'],
        spread: abilityBoard,
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => window.discardCardUid(9000)); // major_5, BETWEEN_2
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT_DIR}/mstate-09-ability-between.png` });
      await page.evaluate(() => window.cancelAbilitySelection?.()).catch(() => {});
      await page.waitForTimeout(200);

      // 10) Discard flow.
      await seedRun(page, { hand: ['major_3', 'major_4', 'major_6'], deck: ['major_7'], spread: abilityBoard });
      await page.waitForTimeout(150);
      const discardHandUid = await page.evaluate(() => {
        const el = document.querySelector('#hand .card[data-uid]');
        return el ? Number(el.dataset.uid) : null;
      });
      if (discardHandUid !== null) await clickHandCardByUid(page, discardHandUid);
      await page.waitForTimeout(150);
      await page.click('#discardBtn').catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT_DIR}/mstate-10-discard.png` });

      // 11) Purge targeting.
      await page.evaluate(() => window.startPurge?.());
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT_DIR}/mstate-11-purge.png` });
      await page.evaluate(() => window.cancelPurge?.()).catch(() => {});
      await page.waitForTimeout(200);

      // Group 3: score ghost / threshold reaction. This combo (Sequence of 3
      // + 4, ~30-45+ points) is deliberately strong enough to clear the
      // 30-point threshold and end the round — that ending IS the state
      // under test, so it is the last placement-based step.
      await seedRun(page, { hand: ['major_16', 'major_17', 'major_18', 'major_19'], deck: ['major_1'] });
      await page.waitForTimeout(150);
      await placeAndWait(page, 'major_16', 0, 150);
      await placeAndWait(page, 'major_17', 1, 150);
      await placeAndWait(page, 'major_18', 2, 150);
      await placeAndWait(page, 'major_19', 3, 180); // catch the ghost mid-rise, before the summary overlay
      await page.screenshot({ path: `${OUT_DIR}/mstate-12-score-ghost.png` });

      // The threshold-clear summary is a real, expected result of that
      // combo; dismiss it and reset to a fresh, directly-seeded board before
      // continuing to the remaining (non-scoring) states.
      await page.waitForTimeout(1200); // let checkEnd's deferred overlay actually arrive
      await page.evaluate(() => window.clearOverlay?.()).catch(() => {});
      await page.waitForTimeout(200);
      await seedRun(page, { hand: ['major_1', 'major_3'], deck: ['major_4'], spread: abilityBoard });
      await page.waitForTimeout(300);

      // 13) Card-detail hold view.
      await page.evaluate(() => document.querySelector('#spread .slot .card')?.click());
      await page.waitForSelector('.card-detail-trigger', { timeout: 4000 }).catch(() => {});
      const trigger = await page.$('.card-detail-trigger');
      if (trigger) {
        const box = await trigger.boundingBox();
        if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForSelector('.card-detail-backdrop', { timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${OUT_DIR}/mstate-13-card-detail.png` });
        await page.evaluate(() => window.closeCardDetail?.());
        await page.waitForTimeout(150);
      }

      // 14) Pull-tab drawer (menu).
      await page.evaluate(() => window.tlrTogglePullTab?.('menu'));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT_DIR}/mstate-14-menu-drawer.png` });
      await page.evaluate(() => window.tlrTogglePullTab?.('menu'));
      await page.waitForTimeout(300);

      // 15) Rotation during a LIVE interaction (mid ability-targeting), not
      // just while idle.
      await page.evaluate(() => window.discardCardUid?.(9000)).catch(() => {});
      await page.waitForTimeout(300);
      await page.setViewportSize({ width: PRIMARY.height, height: PRIMARY.width }); // -> landscape
      await page.waitForTimeout(500);
      const midRotateErrors = [...pageErrors];
      await page.screenshot({ path: `${OUT_DIR}/mstate-15a-rotate-landscape.png` });
      await page.setViewportSize({ width: PRIMARY.width, height: PRIMARY.height }); // -> back to portrait
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT_DIR}/mstate-15b-rotate-back-portrait.png` });
      assert.deepEqual(
        midRotateErrors,
        [],
        `rotation mid-interaction should not throw, got: ${midRotateErrors.join(' | ')}`,
      );

      assert.deepEqual(pageErrors, [], `primary pass: no page errors, got: ${pageErrors.join(' | ')}`);
      await context.close();
    }

    // ── light aspect-ratio sweep: the fit gate must degrade cleanly ──
    for (const size of ASPECTS) {
      const { context, page, pageErrors } = await newPortraitGame(browser, size);
      await reachSeatedTable(page);
      await page.waitForTimeout(600);
      const info = await page.evaluate(() => ({
        anchored: document.body.classList.contains('table3d-anchored'),
        handAnchored: document.body.classList.contains('table3d-anchored-hand'),
        spreadRect: document.getElementById('spread')?.getBoundingClientRect().toJSON(),
      }));
      console.log(`ASPECT ${size.width}x${size.height}:`, JSON.stringify(info));
      assert.equal(
        info.handAnchored,
        false,
        `portrait must not anchor the hand by default at ${size.width}x${size.height}`,
      );
      await page.screenshot({ path: `${OUT_DIR}/mstate-16-aspect-${size.width}x${size.height}.png` });
      assert.deepEqual(pageErrors, [], `${size.width}x${size.height}: no page errors, got: ${pageErrors.join(' | ')}`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log('Mobile interaction-state pass completed.');
}

await main();
