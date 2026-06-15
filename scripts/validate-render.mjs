// Headless DOM smoke test for the singleplayer renderers.
//
// The UI layer is being migrated one renderer at a time from implicit legacy
// global state toward explicit store-derived view models. This harness boots the
// real data globals + hint runtime against a jsdom document and exercises those
// renderer view boundaries.

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { buildDeck } from '../src/systems/deck.mjs';
import * as hintsSystem from '../src/systems/hints.mjs';
import { installDataGlobals } from '../src/app/dataGlobals.mjs';
import { installRuntimeState } from '../src/app/runtimeState.mjs';
import { installHintRuntime } from '../src/app/hintRuntime.mjs';

const dom = new JSDOM('<!DOCTYPE html><body><div id="hand"></div><div id="spread"></div></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.$ = selector => dom.window.document.querySelector(selector);
globalThis._slotEls = null;
globalThis.handleAbilityHandClick = () => {};
globalThis.placeCard = () => {};

const deck = buildDeck();
const hand = deck.slice(0, 5).map((card, i) => ({ ...card, uid: 100 + i }));
const spread = Array(5).fill(null);
spread[0] = { ...deck[30], uid: 300 };

// Seed the legacy global state, then let the real runtime adopt it so the hint
// runtime (which reads through tlrRuntime/tlrHints) resolves the same object.
globalThis.state = { hand, selected: hand[2].uid, spread, purgeSelect: null, busy: false };
installRuntimeState(globalThis);
globalThis.tlrHints = hintsSystem;
installDataGlobals(globalThis);
installHintRuntime(globalThis);

const { renderHand } = await import('../src/ui/renderHand.mjs');
const { renderSpread } = await import('../src/ui/renderSpread.mjs');

// --- Initial hand render: one DOM card per hand card, in order ---
renderHand(null, false);
let cards = [...dom.window.document.querySelectorAll('#hand > .card')];
assert.equal(cards.length, 5, 'renders one DOM card per hand card');
assert.deepEqual(cards.map(el => Number(el.dataset.uid)), hand.map(c => c.uid), 'DOM order matches hand order');
assert.ok(cards.some(el => el.classList.contains('sel')), 'the selected card gets the sel class');
const selEl = cards.find(el => Number(el.dataset.uid) === hand[2].uid);
assert.ok(selEl.classList.contains('sel'), 'sel marks the correct card');

// --- Hand diffing render: removing a card drops exactly one node and reuses the rest ---
const reusedNode = cards[3];
const removedUid = hand[0].uid;
globalThis.state.hand = hand.slice(1);
globalThis.state.selected = null;
renderHand(null, false);
cards = [...dom.window.document.querySelectorAll('#hand > .card')];
assert.equal(cards.length, 4, 'removing a hand card drops exactly one DOM node');
assert.ok(!cards.some(el => Number(el.dataset.uid) === removedUid), 'removed card is gone from the DOM');
assert.ok(cards.includes(reusedNode), 'surviving card nodes are reused, not rebuilt');
assert.ok(!cards.some(el => el.classList.contains('sel')), 'clearing selection removes sel from the DOM');

// --- Hand view model: explicit display data overrides the global state ---
{
  const viewHand = deck.slice(10, 13).map((card, i) => ({ ...card, uid: 900 + i }));
  renderHand(null, false, { hand: viewHand, selected: viewHand[1].uid, purgeSelect: null });
  let cards = [...dom.window.document.querySelectorAll('#hand > .card')];
  assert.deepEqual(cards.map(el => Number(el.dataset.uid)), viewHand.map(c => c.uid), 'view model drives the rendered hand');
  assert.ok(
    cards.find(el => Number(el.dataset.uid) === viewHand[1].uid).classList.contains('sel'),
    'view model selection applies the sel class',
  );
  const globalUids = new Set(globalThis.state.hand.map(c => c.uid));
  assert.ok(!cards.some(el => globalUids.has(Number(el.dataset.uid))), 'global hand is not rendered when a view is supplied');

  renderHand(null, false);
  cards = [...dom.window.document.querySelectorAll('#hand > .card')];
  assert.deepEqual(
    cards.map(el => Number(el.dataset.uid)),
    globalThis.state.hand.map(c => c.uid),
    'no view -> global state hand (back-compat)',
  );
}

// --- Hand view model selection: clicks route to the handler, not the global state ---
{
  const viewHand = deck.slice(20, 22).map((card, i) => ({ ...card, uid: 700 + i }));
  const before = globalThis.state.selected;
  let toggled = null;
  renderHand(null, false, { hand: viewHand, selected: null, purgeSelect: null, onToggleSelect: uid => { toggled = uid; } });
  dom.window.document.querySelector('#hand > .card').click();
  assert.equal(toggled, viewHand[0].uid, 'hand click routes to the view model onToggleSelect handler');
  assert.equal(globalThis.state.selected, before, 'view-model selection does not mutate the global state');
}

// --- Spread view model: explicit spread data overrides the global state ---
{
  const viewSpread = Array(5).fill(null);
  viewSpread[2] = { ...deck[40], uid: 940 };
  renderSpread(null, false, { spread: viewSpread, selected: 1234 });
  const slots = [...dom.window.document.querySelectorAll('#spread > .slot')];
  assert.equal(slots.length, 5, 'spread renders five stable slots');
  assert.equal(Number(slots[2].querySelector('.card').dataset.uid), 940, 'view model drives the filled spread card');
  assert.ok(slots[0].classList.contains('target'), 'view model selection marks empty spread slots as targets');
  assert.ok(!slots[2].classList.contains('target'), 'filled spread slot is not an empty target');
}

// --- Spread view model handlers: clicks route to supplied handlers ---
{
  const viewSpread = Array(5).fill(null);
  const target = { ...deck[45], uid: 945 };
  viewSpread[0] = target;
  let placed = null;
  let targeted = null;
  renderSpread(null, false, { spread: viewSpread, selected: 999, onPlaceCard: index => { placed = index; } });
  dom.window.document.querySelectorAll('#spread > .slot')[1].click();
  assert.equal(placed, 1, 'empty spread click routes to view onPlaceCard handler');

  renderSpread({ validIds: new Set([target.uid]), picked: [] }, false, {
    spread: viewSpread,
    selected: null,
    onAbilityTarget: card => { targeted = card.uid; },
  });
  dom.window.document.querySelector('#spread > .slot .card').click();
  assert.equal(targeted, target.uid, 'ability spread click routes to view onAbilityTarget handler');
}

console.log('Render smoke checks passed.');
