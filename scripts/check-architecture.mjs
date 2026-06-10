import assert from 'node:assert/strict';

import { buildDeck } from '../src/systems/deck.mjs';
import { computeScore } from '../src/systems/scoring.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { createGameState } from '../src/game/state.mjs';
import { ACTIONS } from '../src/game/actions.mjs';

const deck = buildDeck();
assert.equal(deck.length, 38, 'deck should contain 22 majors and 16 court cards');
assert.equal(new Set(deck.map(card => card.id)).size, 38, 'card definitions should have unique ids');

const byId = new Map(deck.map(card => [card.id, card]));

const sequenceScore = computeScore([
  byId.get('major_17'),
  byId.get('major_18'),
  byId.get('major_19'),
]);
assert.ok(sequenceScore.melds.some(meld => meld.name === 'Sequence of 3'), '17/18/19 should score Sequence of 3');

const pathScore = computeScore([
  byId.get('major_0'),
  byId.get('major_1'),
  byId.get('major_21'),
]);
assert.ok(pathScore.melds.some(meld => meld.name === 'Path of the Magi'), '0/I/XXI should score Path of the Magi');

const rankScore = computeScore([
  byId.get('court_Cups_Page'),
  byId.get('court_Wands_Page'),
  byId.get('court_Swords_Page'),
]);
assert.ok(rankScore.melds.some(meld => meld.name === 'Three of a Kind (Pages)'), 'three Pages should score Three of a Kind');

let state = createGameState();
state = reducer(state, { type: ACTIONS.START_READING, rng: () => 0.5 });
assert.equal(state.run.hand.length, 5, 'starting hand should draw 5 cards');
assert.equal(state.run.spread.length, 5, 'spread should have 5 slots');

state = reducer(state, { type: ACTIONS.SELECT_CARD, cardId: state.run.hand[0].uid });
state = reducer(state, { type: ACTIONS.PLACE_CARD, slotIndex: 0 });
assert.equal(state.run.spread.filter(Boolean).length, 1, 'placing should move one card into the spread');
assert.equal(state.run.hand.length, 4, 'placing should remove one card from hand');

console.log('Architecture smoke checks passed.');
