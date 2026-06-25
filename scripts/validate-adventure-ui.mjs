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
// The reusable card picker (used by add/remove-card rewards): auto-pick first.
window.choice = (title, prompt, cards, cb) => cb(cards[0]);

// A live Score Mode profile + run that Adventure must NOT read or write.
const LIVE_PERSIST = { pool: 99, up: { hand: 3, discards: 2, omen: 4 }, relics: ['gilded_fool'], relicUsed: { a: 1 } };
const LIVE_STATE = { deck: [{ uid: 1 }], hand: [{ uid: 2 }], th: 5, discards: 6 };
window.persist = LIVE_PERSIST;
window.state = LIVE_STATE;

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

// The Adventure run owns an evolving deck, dealt into each reading.
const advDeck = window.tlrAdventureBuildDeck();
assert.equal(advDeck.length, 38, 'reading is dealt from the full Adventure deck');
assert.equal(new Set(advDeck.map(c => c.uid)).size, 38, 'deck cards get unique uids');
assert.ok(window.document.getElementById('advHud').innerHTML.includes('Deck'), 'HUD shows the deck count');

// Isolation: Adventure runs on a FRESH profile, not the live Score Mode one.
assert.notEqual(window.persist, LIVE_PERSIST, 'live persist is swapped out, not mutated');
assert.equal(window.persist.up.hand, 0, 'fresh profile ignores Score-Mode hand upgrade');
assert.equal(window.persist.up.omen, 0, 'fresh profile ignores Score-Mode scoring upgrades');
assert.equal((window.persist.relics || []).length, 0, 'fresh profile has no Score-Mode relics');
assert.equal(window.persist.pool, 0, 'fresh profile has no Score-Mode reserve');
assert.deepEqual(LIVE_PERSIST.relics, ['gilded_fool'], 'the live persist object is untouched');

// --- Event 1: Triumph outcome + reward shape --------------------------------
window.tlrAdventureResolveReading(40, spread); // Iron Gate triumph is 38
assert.ok(summary().innerHTML.includes('Triumph'), 'triumph outcome shown');
assert.ok(summary().querySelector('.adv-debug'), 'hidden meanings shown in dev debug panel');
window.tlrAdventureAfterOutcome();
assert.ok(summary().querySelector('.adv-reward'), 'reward offers shown after success');
const deals = readingDeals;
resolveRewards();
assert.ok(readingDeals > deals, 'a fresh reading is dealt for the next event');
assert.ok(deckText().includes('Ambush'), 'advanced to the second event');

// --- Play out the rest of the run: 6 events (recovery after #3), then boss ---
function resolveOneEvent(score) {
  window.tlrAdventureResolveReading(score, spread);
  window.tlrAdventureAfterOutcome(); // outcome → rewards
  resolveRewards();                  // confirm → advance to the next beat
}

let eventsPlayed = 1; // event 1 already played above
let guard = 0;
while (!summary().innerHTML.includes('Woman in the Well') && guard < 24) {
  guard += 1;
  if (summary().innerHTML.includes('Breathe')) { window.tlrAdventureRecovery('rest'); continue; }
  resolveOneEvent(40);
  eventsPlayed += 1;
}
assert.equal(eventsPlayed, 6, 'six standard events precede the boss');
assert.ok(summary().innerHTML.includes('Woman in the Well'), 'the boss appears after the run');
// Across the whole run, Adventure rewards never leak into the live persist.
assert.equal((window.persist.relics || []).length, 0, 'Adventure relics never land in the live persist');

// --- The boss: three phases, then a meaning-driven victory ------------------
window.tlrAdventureAfterOutcome(); // descend → deal phase 1
assert.ok(deckText().includes('Descent'), 'boss deck shows phase 1');
window.tlrAdventureResolveReading(40, spread); // phase 1 (target 24)
assert.ok(summary().innerHTML.includes('Descent'), 'phase 1 resolves');
window.tlrAdventureAfterOutcome(); // → phase 2
window.tlrAdventureResolveReading(46, spread); // phase 2 (target 30)
window.tlrAdventureAfterOutcome(); // → phase 3
window.tlrAdventureResolveReading(54, spread); // phase 3 (target 36)
window.tlrAdventureAfterOutcome(); // complete → final outcome
assert.ok(summary().innerHTML.includes('New Run'), 'the boss resolves to a victory screen');
assert.ok(!summary().innerHTML.includes('Resolve fails'), 'the boss was completed, not lost');

// --- Leaving restores the menu and the live Score Mode profile -------------
window.tlrAdventureLeave();
assert.equal(window.__tlrAdventureActive, false, 'adventure flag cleared so Score Mode scoring resumes');
assert.ok(!window.document.getElementById('advEventDeck'), 'event deck removed on leave');
assert.ok(!window.document.body.classList.contains('mode-adventure'), 'mode-adventure cleared on leave');
assert.ok(returned, 'returns to the main menu');
assert.equal(window.persist, LIVE_PERSIST, 'the exact live persist object is restored on leave');
assert.equal(window.persist.up.hand, 3, 'Score-Mode upgrades restored unchanged');
assert.deepEqual(window.persist.relics, ['gilded_fool'], 'Score-Mode relics restored unchanged');
assert.equal(window.persist.pool, 99, 'Score-Mode reserve restored unchanged');
assert.equal(window.state, LIVE_STATE, 'Score-Mode run restored unchanged');

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
