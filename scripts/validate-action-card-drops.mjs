import assert from 'node:assert/strict';

import {
  discardCardByUid,
  canDiscardCard,
  claimPendingDiscardAbilityCancel,
  canCancelPendingDiscardAbility,
  cancelPendingDiscardAbility,
} from '../src/app/discardRuntime.mjs';
import { startPurgeWithCard, canStartPurgeWithCard } from '../src/app/purgeRuntime.mjs';

function card(uid, ability = null) {
  return { uid, id: `major_${uid}`, type: 'major', points: 1, ability };
}

// Drag-to-discard selects the explicit card, spends a discard, and resolves its ability.
{
  const chosen = card(1, 'DRAW_1');
  const other = card(2);
  let resolved = null;
  let rendered = 0;
  const target = {
    tlrRuntime: {
      state: {
        hand: [chosen, other], spread: Array(5).fill(null), discard: [], discardedCards: [],
        selected: null, discards: 2, busy: false, abilitySelect: null, purgeSelect: null,
        freeDiscardUsed: false,
      },
      persist: { relics: [], up: {} },
    },
    resolveAbility(ability, done, source) { resolved = { ability, source }; done(); },
    render() { rendered += 1; },
    checkEnd() {}, playSound() {}, haptic() {},
  };

  assert.equal(canDiscardCard(chosen.uid, target), true, 'dragged card is eligible for discard');
  assert.equal(discardCardByUid(chosen.uid, target), true, 'dragged card discards by uid');
  assert.deepEqual(target.tlrRuntime.state.hand, [other], 'discard removes the dragged card from hand');
  assert.deepEqual(target.tlrRuntime.state.discard, [chosen], 'discard moves the dragged card to discard');
  assert.equal(target.tlrRuntime.state.discards, 1, 'discard spends one charge');
  assert.deepEqual(resolved, { ability: 'DRAW_1', source: chosen }, 'discard activates the dragged card ability');
  assert.equal(rendered, 1, 'discard finishes through the normal render path');
}

// Cancelling the first targeting step restores the whole pre-discard transaction.
{
  const source = card(21, 'KIN_2');
  const other = card(22);
  const previousDiscard = card(90);
  let rendered = 0;
  const state = {
    hand: [source, other], spread: Array(5).fill(null), discard: [previousDiscard], discardedCards: [previousDiscard],
    selected: null, discards: 2, busy: false, abilitySelect: null, purgeSelect: null,
    freeDiscardUsed: false, sightChargesUsed: 1, roundDiscardCount: 4, lastDiscardedCard: previousDiscard,
  };
  const target = {
    tlrRuntime: { state, persist: { relics: [], up: {} } },
    resolveAbility() {}, render() { rendered += 1; }, checkEnd() {}, playSound() {}, haptic() {},
  };

  assert.equal(discardCardByUid(source.uid, target), true, 'targeting card is initially discarded');
  assert.deepEqual(state.hand, [other], 'source card leaves the hand before targeting');
  assert.equal(state.discards, 1, 'targeting initially spends a discard');
  assert.equal(claimPendingDiscardAbilityCancel(target), true, 'first targeting step claims the refund option');
  assert.equal(claimPendingDiscardAbilityCancel(target), false, 'later targeting steps cannot claim the same refund');
  state.busy = true;
  state.abilitySelect = { title: 'Kin', validIds: new Set([other.uid]), picked: [], count: 1 };
  assert.equal(canCancelPendingDiscardAbility(target), true, 'refund is available while first targeting is open');
  assert.equal(cancelPendingDiscardAbility(target), true, 'cancel restores the discard transaction');
  assert.deepEqual(state.hand, [source, other], 'cancel returns the source card to its original hand position');
  assert.deepEqual(state.discard, [previousDiscard], 'cancel removes the source card from discard');
  assert.deepEqual(state.discardedCards, [previousDiscard], 'cancel restores discard-history tracking');
  assert.equal(state.selected, source.uid, 'cancel restores the source card selection');
  assert.equal(state.discards, 2, 'cancel refunds the spent discard');
  assert.equal(state.freeDiscardUsed, false, 'cancel restores free-discard relic state');
  assert.equal(state.sightChargesUsed, 1, 'cancel restores Sight charge tracking');
  assert.equal(state.roundDiscardCount, 4, 'cancel restores round discard tracking');
  assert.equal(state.lastDiscardedCard, previousDiscard, 'cancel restores the previous last-discarded card');
  assert.equal(state.busy, false, 'cancel leaves the table interactive');
  assert.equal(state.abilitySelect, null, 'cancel closes targeting');
  assert.equal(rendered, 1, 'cancel rerenders the restored table once');
}

// Drag-to-purge starts the three-card selection with the dragged card preselected.
{
  const first = card(11);
  const target = {
    tlrRuntime: {
      state: {
        hand: [first, card(12), card(13), card(14)], selected: null, discards: 1,
        busy: false, abilitySelect: null, purgeSelect: null,
      },
    },
    render() {}, refreshHandState() {},
  };

  assert.equal(canStartPurgeWithCard(first.uid, target), true, 'dragged card can begin purge');
  assert.equal(startPurgeWithCard(first.uid, target), true, 'purge starts from the dragged card');
  assert.deepEqual(target.tlrRuntime.state.purgeSelect, [first.uid], 'dragged card is selection 1 of 3');
}

console.log('Action card drop checks passed.');
