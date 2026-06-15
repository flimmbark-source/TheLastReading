import assert from 'node:assert/strict';

import { ACTIONS } from '../src/game/actions.mjs';
import { createGameState } from '../src/game/state.mjs';
import { reducer } from '../src/game/reducerWithPurge.mjs';
import { buildDeck } from '../src/systems/deck.mjs';

const hand = buildDeck().slice(0, 4).map((card, index) => ({ ...card, uid: 2000 + index }));
let state = createGameState({
  run: {
    hand,
    selectedCardId: hand[0].uid,
    discards: 1,
  },
});

state = reducer(state, { type: ACTIONS.START_PURGE });
assert.deepEqual(state.run.purge, [], 'start purge creates an empty purge selection');
assert.equal(state.run.selectedCardId, null, 'start purge clears card selection');

state = reducer(state, { type: ACTIONS.TOGGLE_PURGE_CARD, cardId: hand[0].uid });
state = reducer(state, { type: ACTIONS.TOGGLE_PURGE_CARD, cardId: hand[1].uid });
state = reducer(state, { type: ACTIONS.TOGGLE_PURGE_CARD, cardId: hand[2].uid });
assert.deepEqual(state.run.purge, [hand[0].uid, hand[1].uid, hand[2].uid], 'toggle purge collects up to three cards');

state = reducer(state, { type: ACTIONS.TOGGLE_PURGE_CARD, cardId: hand[3].uid });
assert.deepEqual(state.run.purge, [hand[0].uid, hand[1].uid, hand[2].uid], 'toggle purge ignores a fourth card');

state = reducer(state, { type: ACTIONS.CONFIRM_PURGE });
assert.deepEqual(state.run.hand.map(card => card.uid), [hand[3].uid], 'confirm purge removes chosen cards from hand');
assert.equal(state.run.discards, 2, 'confirm purge grants one discard');
assert.equal(state.run.purge, null, 'confirm purge exits purge mode');

state = reducer(state, { type: ACTIONS.START_PURGE });
assert.equal(state.run.purge, null, 'start purge is ignored when fewer than three cards remain');

// REORDER_HAND: moves a card to a new position without mutating legacy state.hand
{
  const h = buildDeck().slice(0, 3).map((card, i) => ({ ...card, uid: 3100 + i }));
  let s = createGameState({ run: { hand: h, selectedCardId: h[0].uid } });

  s = reducer(s, { type: ACTIONS.REORDER_HAND, uid: h[0].uid, toIndex: 2 });
  assert.deepEqual(s.run.hand.map(c => c.uid), [h[1].uid, h[2].uid, h[0].uid], 'REORDER_HAND moves card to target index');
  assert.equal(s.run.selectedCardId, null, 'REORDER_HAND clears selection when the dragged card was selected');

  s = reducer(s, { type: ACTIONS.REORDER_HAND, uid: h[2].uid, toIndex: 0 });
  assert.deepEqual(s.run.hand.map(c => c.uid), [h[2].uid, h[1].uid, h[0].uid], 'REORDER_HAND: middle card moves to front');

  s = createGameState({ run: { hand: h, selectedCardId: h[2].uid } });
  s = reducer(s, { type: ACTIONS.REORDER_HAND, uid: h[0].uid, toIndex: 1 });
  assert.equal(s.run.selectedCardId, h[2].uid, 'REORDER_HAND preserves selection when a different card is dragged');
}

// MULLIGAN: shuffles hand back into deck and draws new cards
{
  const deck = buildDeck().slice(5, 10).map((c, i) => ({ ...c, uid: 4000 + i }));
  const hand = buildDeck().slice(0, 5).map((c, i) => ({ ...c, uid: 4100 + i }));
  let s = createGameState({
    persist: { upgrades: {}, relics: [] },
    run: { deck, hand, spread: Array(5).fill(null), mulliganCharges: 1, selectedCardId: hand[0].uid },
  });
  s = reducer(s, { type: ACTIONS.MULLIGAN });
  assert.equal(s.run.mulliganCharges, 0, 'MULLIGAN decrements mulligan charges');
  assert.equal(s.run.hand.length, 5, 'MULLIGAN draws back to max hand size');
  assert.equal(s.run.deck.length, deck.length, 'MULLIGAN combined cards stay the same count');
  assert.equal(s.run.selectedCardId, null, 'MULLIGAN clears selection');
  // All original cards should still exist somewhere in hand + deck
  const allUids = new Set([...s.run.hand, ...s.run.deck].map(c => c.uid));
  [...hand, ...deck].forEach(c => assert.ok(allUids.has(c.uid), `MULLIGAN preserves card uid ${c.uid}`));

  // Should be ignored when no charges remain
  s = reducer(s, { type: ACTIONS.MULLIGAN });
  assert.equal(s.run.mulliganCharges, 0, 'MULLIGAN is a no-op when charges are exhausted');

  // Should be ignored when spread is not empty
  let s2 = createGameState({
    persist: { upgrades: {}, relics: [] },
    run: { deck, hand, spread: [hand[0], null, null, null, null], mulliganCharges: 1 },
  });
  s2 = reducer(s2, { type: ACTIONS.MULLIGAN });
  assert.equal(s2.run.mulliganCharges, 1, 'MULLIGAN is a no-op when spread is occupied');
}

console.log('Purge reducer checks passed.');
