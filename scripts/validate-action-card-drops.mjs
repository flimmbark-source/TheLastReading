import assert from 'node:assert/strict';

import { discardCardByUid, canDiscardCard } from '../src/app/discardRuntime.mjs';
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

// Discarding an ability card is a committed transaction at this layer — there
// is no rollback path here. Reconsidering which target/result to take during
// the ability flow itself is handled by abilityTargetBridge's retry loop
// (see validate-ability-targeting-bridge.mjs), not by undoing the discard.
{
  const source = card(21, 'KIN_2');
  const other = card(22);
  const state = {
    hand: [source, other], spread: Array(5).fill(null), discard: [], discardedCards: [],
    selected: null, discards: 2, busy: false, abilitySelect: null, purgeSelect: null,
    freeDiscardUsed: false,
  };
  const target = {
    tlrRuntime: { state, persist: { relics: [], up: {} } },
    resolveAbility() {}, render() {}, checkEnd() {}, playSound() {}, haptic() {},
  };

  assert.equal(discardCardByUid(source.uid, target), true, 'targeting card is discarded');
  assert.deepEqual(state.hand, [other], 'source card leaves the hand once discarded');
  assert.deepEqual(state.discard, [source], 'source card moves to discard');
  assert.equal(state.discards, 1, 'discard spends a charge');
  assert.equal(typeof target.cancelPendingDiscardAbility, 'undefined', 'no discard-rollback affordance exists at this layer');
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
