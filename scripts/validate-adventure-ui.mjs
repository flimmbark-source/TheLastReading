// Adventure Mode UI smoke (jsdom): the menu hand-off opens the overlay, the
// click-to-place spread builder fills, casting grades via the real engine,
// rewards resolve, and the debug panel respects the dev gate.

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="mainMenu"></div></body></html>', { url: 'http://localhost/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.__tlrAdvRng = (() => {
  let seed = 7;
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
})();

let returned = false;
window.tlrReturnToMenu = () => { returned = true; };

const { installAdventureMode } = await import('../src/app/adventureMode.mjs');
installAdventureMode(window);

const click = node => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const overlay = () => window.document.getElementById('adventureMode');

window.tlrStartAdventure();
const el = overlay();
assert.ok(el.classList.contains('adv-open'), 'overlay opens');
assert.ok(document.body.classList.contains('single-player-v2'), 'reuses the V2 body skin');
assert.ok(document.body.classList.contains('mode-adventure'), 'flags Adventure mode on the body');
assert.ok(el.querySelector('.adv-event-deck'), 'event deck replaces the score/threshold area');
assert.ok(el.querySelector('.spread-wrap .spread .slot'), 'reuses the V2 spread/slot markup');
assert.ok(el.querySelector('.handDock .hand'), 'reuses the V2 hand dock markup');
assert.equal(el.querySelectorAll('.handDock .hand .card').length, 5, 'hand is dealt (5 cards)');
assert.ok(el.querySelector('[data-act=cast]').disabled, 'cannot cast an empty spread');
// The four bottom utility medallions + the top discard/remove pair.
assert.equal(el.querySelectorAll('.adv-util-bar [data-act]').length, 4, 'bottom row has four utility buttons');
for (const act of ['menu', 'archive', 'scoring', 'abilities']) {
  assert.ok(el.querySelector(`.adv-util-bar [data-act=${act}]`), `utility button: ${act}`);
}
assert.ok(el.querySelector('.adv-action-bar [data-act=discard]'), 'discard medallion up top');
assert.ok(el.querySelector('.adv-action-bar [data-act=purge]'), 'remove medallion up top');

// Utility panels open and close back to the event screen.
click(el.querySelector('[data-act=scoring]'));
assert.ok(overlay().textContent.includes('Scoring Patterns'), 'scoring panel opens');
click(overlay().querySelector('[data-act=closePanel]'));
assert.ok(overlay().querySelector('.handDock .hand'), 'closing a panel returns to the event');

// Discard swaps a card (replacement drawn); Remove thins the deck.
click(overlay().querySelector('.handDock .hand .card')); // select
const discardsBefore = Number(overlay().querySelector('.adv-action-bar [data-act=discard] .adv-medallion__badge').textContent);
click(overlay().querySelector('[data-act=discard]'));
assert.equal(overlay().querySelectorAll('.handDock .hand .card').length, 5, 'discard draws a replacement (hand stays 5)');
assert.equal(
  Number(overlay().querySelector('.adv-action-bar [data-act=discard] .adv-medallion__badge').textContent),
  discardsBefore - 1, 'discard spends a charge',
);
click(overlay().querySelector('.handDock .hand .card')); // select
click(overlay().querySelector('[data-act=purge]'));
assert.equal(overlay().querySelectorAll('.handDock .hand .card').length, 4, 'remove takes the card out without a redraw');

// Restart for a clean full run-through (deck/hand reset).
window.tlrStartAdventure();

function playOneEvent() {
  // Pick up each hand card, then lay it into the first empty slot.
  for (let i = 0; i < 5; i += 1) {
    const card = overlay().querySelector('.handDock .hand .card');
    assert.ok(card, 'a hand card is available to place');
    click(card); // select
    const slot = overlay().querySelector('.spread .slot.empty');
    assert.ok(slot, 'an empty slot is available');
    click(slot); // lay
  }
  assert.equal(overlay().querySelectorAll('.spread .slot .card').length, 5, 'spread filled');
  assert.ok(!overlay().querySelector('[data-act=cast]').disabled, 'cast enabled at 5 cards');
  click(overlay().querySelector('[data-act=cast]'));
  assert.ok(overlay().querySelector('.adv-result'), 'outcome screen shows a result');
  assert.ok(overlay().querySelector('.adv-debug'), 'debug panel shows on localhost');
  click(overlay().querySelector('[data-act=afterOutcome]'));
  // Reward step (success/triumph) or straight advance (failure).
  const rewards = overlay().querySelectorAll('.adv-reward[data-reward]');
  if (rewards.length) {
    click(rewards[0]);
    const confirm = overlay().querySelector('[data-act=confirmRewards]');
    if (confirm && confirm.disabled) click(rewards[1]); // triumph needs 2
    click(overlay().querySelector('[data-act=confirmRewards]'));
  }
}

// Play through the run until an end screen or recovery appears.
let guard = 0;
while (guard < 12) {
  guard += 1;
  const recovery = overlay().querySelector('[data-recovery]');
  if (recovery) { click(recovery); continue; }
  if (overlay().querySelector('.adv-bigmsg')) break; // win/lose screen
  if (overlay().querySelector('.handDock .hand')) { playOneEvent(); continue; }
  break;
}
assert.ok(overlay().querySelector('.adv-bigmsg'), 'the run reaches an end screen');

// Leaving restores the menu.
const leaveBtn = overlay().querySelector('[data-act=leave]');
assert.ok(leaveBtn, 'end screen offers Leave');
click(leaveBtn);
assert.ok(returned, 'leaving Adventure Mode returns to the main menu');
assert.ok(!overlay().classList.contains('adv-open'), 'overlay is closed on leave');
assert.ok(!document.body.classList.contains('mode-adventure'), 'Adventure body flag cleared on leave');

// Debug panel is gated off in production.
const { isAdventureDebugEnabled } = await import('../src/ui/adventure/adventureHud.mjs');
assert.equal(isAdventureDebugEnabled({ location: { hostname: 'thelastreading.app', search: '' } }), false, 'no debug panel in production');

console.log('Adventure Mode UI smoke checks passed.');
