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
assert.equal(el.querySelectorAll('.adv-hand .adv-card').length, 8, 'hand is dealt');
assert.ok(el.querySelector('[data-act=cast]').disabled, 'cannot cast an empty spread');

function playOneEvent() {
  // Fill the spread, then cast and walk through outcome + rewards/recovery.
  for (let i = 0; i < 5; i += 1) {
    const card = overlay().querySelector('.adv-hand .adv-card');
    assert.ok(card, 'a hand card is available to place');
    click(card);
  }
  assert.equal(overlay().querySelectorAll('.adv-spread .adv-card').length, 5, 'spread filled');
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
  if (overlay().querySelector('.adv-hand')) { playOneEvent(); continue; }
  break;
}
assert.ok(overlay().querySelector('.adv-bigmsg'), 'the run reaches an end screen');

// Leaving restores the menu.
const leaveBtn = overlay().querySelector('[data-act=leave]');
assert.ok(leaveBtn, 'end screen offers Leave');
click(leaveBtn);
assert.ok(returned, 'leaving Adventure Mode returns to the main menu');
assert.ok(!overlay().classList.contains('adv-open'), 'overlay is closed on leave');

// Debug panel is gated off in production.
const { isAdventureDebugEnabled } = await import('../src/ui/adventure/adventureHud.mjs');
assert.equal(isAdventureDebugEnabled({ location: { hostname: 'thelastreading.app', search: '' } }), false, 'no debug panel in production');

console.log('Adventure Mode UI smoke checks passed.');
