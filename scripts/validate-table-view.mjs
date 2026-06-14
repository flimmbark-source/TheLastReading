import assert from 'node:assert/strict';

import { buildDeck } from '../src/systems/deck.mjs';
import { createGameState } from '../src/game/state.mjs';
import { tableView } from '../src/game/selectors.mjs';

const deck = buildDeck();
const selected = { ...deck[0], uid: 1500 };

const gameState = createGameState({
  persist: { reserve: 12 },
  run: {
    hand: [selected],
    selectedCardId: selected.uid,
    spread: Array(5).fill(null),
    discards: 2,
    thresholdBonusPending: 3,
  },
});

const view = tableView(gameState, { inPurge: false, inAbility: false });
assert.equal(view.reserve, 12, 'table view exposes reserve from persist state');
assert.equal(view.discards, 2, 'table view exposes discards from run state');
assert.equal(view.thresholdBonusPending, 3, 'table view exposes pending threshold bonus');
assert.equal(view.discardDisabled, false, 'selected card with discards enables discard');
assert.equal(view.purgeDisabled, true, 'short hand disables purge');
assert.equal(tableView(gameState, { inPurge: true }).discardDisabled, true, 'purge mode disables discard');
assert.equal(tableView(gameState, { inAbility: true }).purgeDisabled, true, 'ability selection disables purge');

console.log('Table view selector checks passed.');
