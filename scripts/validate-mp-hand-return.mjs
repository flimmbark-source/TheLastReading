import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { installMpAbilitySurfaceCleanup } from '../src/app/mpAbilitySurfaceCleanup.mjs';

const dom = new JSDOM(`<!doctype html><html><head></head><body class="mp-game-active">
  <div id="hand" class="hand">
    <div class="card hand-card-dragging" data-uid="11"></div>
  </div>
  <div id="spread"><div class="slot"></div></div>
</body></html>`);
const target = dom.window;
const doc = target.document;
const card = doc.querySelector('#hand .card');
const slot = doc.querySelector('#spread .slot');

let cancelCalls = 0;
let downstreamPointerUps = 0;
let cardClicks = 0;

target.tlrCancelHandDrag = () => {
  cancelCalls += 1;
  card.classList.remove('hand-card-dragging');
  return true;
};
target.__handGestureSuppressClickUntil = 123;
card.onclick = () => { cardClicks += 1; };

doc.addEventListener('pointerup', () => { downstreamPointerUps += 1; }, true);
installMpAbilitySurfaceCleanup(target);

slot.getBoundingClientRect = () => ({ left: 100, right: 200, top: 100, bottom: 220, width: 100, height: 120 });
card.getBoundingClientRect = () => ({ left: 10, right: 90, top: 300, bottom: 420, width: 80, height: 120 });

// Returning over the hand/non-placement area must be handled entirely by the
// duel adapter and must not fall through to gestureCard's single-player commit.
card.classList.add('hand-card-dragging');
const returnEvent = new target.Event('pointerup', { bubbles: true, cancelable: true });
card.dispatchEvent(returnEvent);
assert.equal(cancelCalls, 1, 'duel hand return should invoke the native cancel/FLIP path once');
assert.equal(downstreamPointerUps, 0, 'duel hand return must not reach the single-player pointerup handler');
assert.equal(target.__handGestureSuppressClickUntil, 0, 'broad post-drag click suppression should be cleared');
assert.equal(returnEvent.defaultPrevented, true, 'duel hand return should consume the release');

// The synthetic click created by the drag release is swallowed once; the next
// real click remains available to the card selection handler.
const syntheticClick = new target.MouseEvent('click', { bubbles: true, cancelable: true });
card.dispatchEvent(syntheticClick);
assert.equal(syntheticClick.defaultPrevented, true, 'the drag-generated click should be suppressed');
assert.equal(cardClicks, 0, 'the drag-generated click must not toggle card selection');
const realClick = new target.MouseEvent('click', { bubbles: true, cancelable: true });
card.dispatchEvent(realClick);
assert.equal(realClick.defaultPrevented, false, 'the next real click should not be suppressed');
assert.equal(cardClicks, 1, 'the next real click should reach card selection');

// A valid empty spread slot remains owned by the shared gesture controller.
card.getBoundingClientRect = () => ({ left: 110, right: 190, top: 110, bottom: 210, width: 80, height: 100 });
card.classList.add('hand-card-dragging');
const placementEvent = new target.Event('pointerup', { bubbles: true, cancelable: true });
card.dispatchEvent(placementEvent);
assert.equal(cancelCalls, 1, 'valid spread placement must not cancel the drag');
assert.equal(downstreamPointerUps, 1, 'valid spread placement must pass through to the shared controller');
assert.equal(placementEvent.defaultPrevented, false, 'valid spread placement should remain unconsumed');

console.log('Multiplayer hand-return gesture checks passed.');
