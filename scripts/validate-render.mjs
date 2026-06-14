// Headless DOM smoke test for the singleplayer renderers.
//
// The UI layer still reads the legacy global `state`. Until that is migrated
// onto the store there are no automated checks that a renderer actually produces
// the right DOM, which makes the renderer-cutover phases of the migration risky.
// This harness boots the real data globals + hint runtime against a jsdom
// document and exercises renderHand's uid-keyed diffing, giving the migration a
// verification anchor to build on.

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { buildDeck } from '../src/systems/deck.mjs';
import * as hintsSystem from '../src/systems/hints.mjs';
import { installDataGlobals } from '../src/app/dataGlobals.mjs';
import { installRuntimeState } from '../src/app/runtimeState.mjs';
import { installHintRuntime } from '../src/app/hintRuntime.mjs';

const dom = new JSDOM('<!DOCTYPE html><body><div id="hand"></div></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.$ = selector => dom.window.document.querySelector(selector);

const deck = buildDeck();
const hand = deck.slice(0, 5).map((card, i) => ({ ...card, uid: 100 + i }));

// Seed the legacy global state, then let the real runtime adopt it so the hint
// runtime (which reads through tlrRuntime/tlrHints) resolves the same object.
globalThis.state = { hand, selected: hand[2].uid, spread: Array(5).fill(null), purgeSelect: null, busy: false };
installRuntimeState(globalThis);
globalThis.tlrHints = hintsSystem;
installDataGlobals(globalThis);
installHintRuntime(globalThis);

const { renderHand } = await import('../src/ui/renderHand.mjs');

// --- Initial render: one DOM card per hand card, in order ---
renderHand(null, false);
let cards = [...dom.window.document.querySelectorAll('#hand > .card')];
assert.equal(cards.length, 5, 'renders one DOM card per hand card');
assert.deepEqual(cards.map(el => Number(el.dataset.uid)), hand.map(c => c.uid), 'DOM order matches hand order');
assert.ok(cards.some(el => el.classList.contains('sel')), 'the selected card gets the sel class');
const selEl = cards.find(el => Number(el.dataset.uid) === hand[2].uid);
assert.ok(selEl.classList.contains('sel'), 'sel marks the correct card');

// --- Diffing render: removing a card drops exactly one node and reuses the rest ---
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

// --- View model: explicit display data overrides the global state ---
{
  // Global state currently holds the diffed-down 4-card hand (uids 101..104).
  // Render a different hand through an explicit view model and assert the DOM
  // follows the view, not the global — this is what multiplayer relies on.
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

  // Omitting the view falls back to the global state (singleplayer back-compat).
  renderHand(null, false);
  cards = [...dom.window.document.querySelectorAll('#hand > .card')];
  assert.deepEqual(
    cards.map(el => Number(el.dataset.uid)),
    globalThis.state.hand.map(c => c.uid),
    'no view -> global state hand (back-compat)',
  );
}

console.log('Render smoke checks passed.');
