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

console.log('Purge reducer checks passed.');
