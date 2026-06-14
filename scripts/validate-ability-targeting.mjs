import assert from 'node:assert/strict';

import { createGameState } from '../src/game/state.mjs';
import { reducer } from '../src/game/reducerWithPurge.mjs';
import { buildDeck } from '../src/systems/deck.mjs';

const hand = buildDeck().slice(0, 3).map((card, index) => ({ ...card, uid: 3000 + index }));
let state = createGameState({
  run: {
    hand,
    deck: [],
    spread: Array(5).fill(null),
    ability: { id: 'NEIGHBOR_2', sourceCardId: hand[0].uid },
    busy: true,
  },
});

state = reducer(state, {
  type: 'START_ABILITY_TARGETING',
  selection: {
    title: 'Neighbor',
    prompt: 'Choose an anchor card.',
    validCardIds: [hand[0].uid, hand[1].uid],
    count: 1,
  },
});
assert.equal(state.run.ability.targeting.title, 'Neighbor', 'ability targeting stores title');
assert.deepEqual(state.run.ability.targeting.validCardIds, [hand[0].uid, hand[1].uid], 'ability targeting stores valid ids');
assert.deepEqual(state.run.ability.targeting.pickedCardIds, [], 'ability targeting starts empty');

state = reducer(state, { type: 'TOGGLE_ABILITY_TARGET', cardId: hand[0].uid });
assert.deepEqual(state.run.ability.targeting.pickedCardIds, [hand[0].uid], 'toggle picks a valid target');

state = reducer(state, { type: 'TOGGLE_ABILITY_TARGET', cardId: hand[1].uid });
assert.deepEqual(state.run.ability.targeting.pickedCardIds, [hand[1].uid], 'single-target ability replaces old pick');

state = reducer(state, { type: 'TOGGLE_ABILITY_TARGET', cardId: hand[2].uid });
assert.deepEqual(state.run.ability.targeting.pickedCardIds, [hand[1].uid], 'toggle ignores invalid target');

state = reducer(state, { type: 'CLEAR_ABILITY_TARGETING' });
assert.equal(state.run.ability.targeting, undefined, 'clear removes targeting but keeps active ability');
assert.equal(state.run.ability.id, 'NEIGHBOR_2', 'clear keeps ability identity');

console.log('Ability targeting reducer checks passed.');
