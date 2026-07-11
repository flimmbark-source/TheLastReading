import assert from 'node:assert/strict';

import { reconcileAbilityAction } from '../src/app/mpGameHost.mjs';
import { buildDeck } from '../src/systems/deck.mjs';

const cards = buildDeck();
const byId = new Map(cards.map(card => [card.id, card]));
const clone = (id, uid, patch = {}) => ({ ...byId.get(id), uid, ...patch });

// Multiplayer must submit the exact capped reveal set that the player saw.
{
  const source = clone('major_18', 1000, { ability: 'MIRROR_1' });
  const queen = clone('court_Cups_Queen', 1001);
  const knightWands = clone('court_Wands_Knight', 1002);
  const knightSwords = clone('court_Swords_Knight', 1003);
  const knightPentacles = clone('court_Pentacles_Knight', 1004);
  const state = {
    players: [{
      hand: [source, queen],
      spread: [null, null, null, null, null],
      deck: [knightWands, knightSwords, knightPentacles],
      discard: [],
    }],
  };
  const action = {
    type: 'MP_SUBMIT_ACTION',
    playerIndex: 0,
    action: {
      type: 'MP_INVOKE_ABILITY',
      cardUid: source.uid,
      abilityChoice: { anchorUids: [queen.uid], takenCardUid: knightSwords.uid },
    },
  };
  const reconciled = reconcileAbilityAction(action, state, 0);
  assert.deepEqual(
    reconciled.action.abilityChoice.heldCardUids,
    [knightWands.uid, knightSwords.uid],
    'multiplayer records exactly Mirror’s first 2 eligible cards in deck order',
  );
}

// Multiplayer Full Reset may receive a client order polluted with spread UIDs.
// Reconciliation filters placed cards without losing the intended shuffle order
// or shrinking the redrawn hand.
{
  const source = clone('major_21', 2000, { ability: 'WORLD' });
  const handCard = clone('major_1', 2001);
  const deckA = clone('major_2', 2002);
  const deckB = clone('major_3', 2003);
  const discard = clone('major_4', 2004);
  const placed = clone('major_5', 2999);
  const state = {
    players: [{
      hand: [source, handCard],
      spread: [placed, null, null, null, null],
      deck: [deckA, deckB],
      discard: [discard],
    }],
  };
  const action = {
    type: 'MP_SUBMIT_ACTION',
    playerIndex: 0,
    action: {
      type: 'MP_INVOKE_ABILITY',
      cardUid: source.uid,
      abilityChoice: {
        handUids: [placed.uid, deckB.uid, handCard.uid],
        deckUids: [source.uid, deckA.uid, discard.uid],
      },
    },
  };
  const reconciled = reconcileAbilityAction(action, state, 0);
  const choice = reconciled.action.abilityChoice;
  assert.deepEqual(choice.handUids, [deckB.uid, handCard.uid, source.uid], 'Full Reset fills the requested hand size using only unplayed cards');
  assert.deepEqual(choice.deckUids, [deckA.uid, discard.uid], 'Full Reset preserves the remaining valid shuffled order');
  assert.ok(![...choice.handUids, ...choice.deckUids].includes(placed.uid), 'Full Reset never includes a spread card in its shuffled pool');
}

console.log('Ability rule reconciliation checks passed.');
