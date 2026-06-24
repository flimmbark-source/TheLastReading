// Adventure Mode controller smoke (jsdom): drives the real-table integration
// with the live game stubbed out (startReading / showOverlay / clearOverlay).
// The hand, gestures and scoring are the real Single-Player systems and are
// covered by the existing suites; here we verify the Adventure resolution flow
// that sits on top of them.

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ALL_CARD_DEFINITIONS } from '../src/data/cards.mjs';

const dom = new JSDOM('<!doctype html><html><body><div id="summary"></div></body></html>', { url: 'http://localhost/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.__tlrAdvRng = (() => { let s = 7; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();

let readingDeals = 0;
window.startReading = () => { readingDeals += 1; };
window.showOverlay = html => { const s = window.document.getElementById('summary'); s.className = 'modal show'; s.innerHTML = html; };
window.clearOverlay = () => { const s = window.document.getElementById('summary'); s.className = ''; s.innerHTML = ''; };
let returned = false;
window.tlrReturnToMenu = () => { returned = true; };

const { installAdventureMode } = await import('../src/app/adventureMode.mjs');
installAdventureMode(window);

const byId = new Map(ALL_CARD_DEFINITIONS.map((c, uid) => [c.id, { ...c, uid }]));
const spread = ['major_8', 'major_16', 'court_Swords_King', 'court_Swords_Queen', 'court_Swords_Knight'].map(id => byId.get(id));
const summary = () => window.document.getElementById('summary');
const deckText = () => window.document.getElementById('advEventDeck').textContent;

function resolveRewards() {
  // Pick valid offers until Confirm enables, then confirm.
  const n = summary().querySelectorAll('.adv-reward').length;
  let i = 0;
  while (i < n && summary().querySelector('.rbtns button[disabled]')) {
    window.tlrAdventurePickReward(i);
    i += 1;
  }
  window.tlrAdventureConfirmRewards();
}

// --- Start: runs on the real table -----------------------------------------
window.tlrStartAdventure();
assert.equal(window.__tlrAdventureActive, true, 'adventure flag set so scoreReading delegates');
assert.ok(window.document.body.classList.contains('mode-adventure'), 'mode-adventure on body');
assert.ok(window.document.body.classList.contains('single-player-v2'), 'real V2 table skin active');
assert.ok(window.document.getElementById('advEventDeck'), 'event deck mounted (replaces score/threshold)');
assert.ok(window.document.getElementById('advHud'), 'resolve HUD mounted');
assert.ok(readingDeals >= 1, 'a reading is dealt on the real table');
assert.ok(deckText().includes('Iron Gate'), 'event deck shows the first event');

// --- Event 1: Triumph -------------------------------------------------------
window.tlrAdventureResolveReading(40, spread); // Iron Gate triumph is 38
assert.ok(summary().innerHTML.includes('Triumph'), 'triumph outcome shown');
assert.ok(summary().querySelector('.adv-debug'), 'hidden meanings shown in dev debug panel');
window.tlrAdventureAfterOutcome();
assert.ok(summary().querySelector('.adv-reward'), 'reward offers shown after success');
const deals = readingDeals;
resolveRewards();
assert.ok(readingDeals > deals, 'a fresh reading is dealt for the next event');
assert.ok(deckText().includes('Ambush'), 'advanced to the second event');

// --- Event 2: Success ------------------------------------------------------
window.tlrAdventureResolveReading(30, spread); // Ambush target 24, triumph 40
assert.ok(summary().innerHTML.includes('Success'), 'success outcome shown');
window.tlrAdventureAfterOutcome();
resolveRewards();
assert.ok(deckText().includes('Strange Shrine'), 'advanced to the third event');

// --- Event 3: Triumph, then the recovery beat ------------------------------
window.tlrAdventureResolveReading(40, spread);
window.tlrAdventureAfterOutcome();
resolveRewards();
assert.ok(summary().innerHTML.includes('Breathe'), 'recovery event appears after event 3');

// Recovery → run complete (victory).
window.tlrAdventureRecovery('rest');
assert.ok(summary().innerHTML.includes('road is yours'), 'completing the run shows the victory screen');

// --- Leaving restores the menu ---------------------------------------------
window.tlrAdventureLeave();
assert.equal(window.__tlrAdventureActive, false, 'adventure flag cleared so Score Mode scoring resumes');
assert.ok(!window.document.getElementById('advEventDeck'), 'event deck removed on leave');
assert.ok(!window.document.body.classList.contains('mode-adventure'), 'mode-adventure cleared on leave');
assert.ok(returned, 'returns to the main menu');

// --- A failed reading costs Resolve ----------------------------------------
window.tlrStartAdventure();
window.tlrAdventureResolveReading(1, spread); // below Iron Gate target 22
assert.ok(summary().innerHTML.includes('Failure'), 'a low score is a failure');
assert.ok(window.document.getElementById('advHud').innerHTML.includes('<b>3</b>'), 'failure costs 1 Resolve (4 → 3)');
window.tlrAdventureLeave();

// --- Debug panel is gated off in production --------------------------------
const { isAdventureDebugEnabled } = await import('../src/ui/adventure/adventureHud.mjs');
assert.equal(isAdventureDebugEnabled({ location: { hostname: 'thelastreading.app', search: '' } }), false, 'no debug panel in production');

console.log('Adventure Mode controller smoke checks passed.');
