// Unit test for the singleplayer ability-targeting bridge.
//
// Phase 2 made targeting initiation store-native: readingFlow.selectFromHand
// delegates to target.tlrStartAbilityTargeting, which owns the selection in the
// store and keeps the confirm callback / preview function off the legacy state
// object. This drives the bridge against a real store (no DOM needed) and checks
// the full pick → confirm round-trip, including the legacy render mirror.

import assert from 'node:assert/strict';

import { createStore } from '../src/app/store.mjs';
import { installAbilityTargetBridge } from '../src/app/abilityTargetBridge.mjs';

function makeTarget() {
  const store = createStore();
  const cardA = { uid: 1, id: 'major_5', type: 'major' };
  const cardB = { uid: 2, id: 'major_8', type: 'major' };
  const cardC = { uid: 3, id: 'major_3', type: 'major' };
  const target = {
    tlrStore: store,
    state: { hand: [cardA, cardB, cardC], spread: [], abilitySelect: null },
    renderCount: 0,
    refreshCount: 0,
    render() { this.renderCount += 1; },
    refreshHandState() { this.refreshCount += 1; },
  };
  installAbilityTargetBridge(target);
  return { target, cardA, cardB, cardC };
}

function targeting(target) {
  return target.tlrStore.getState().run?.ability?.targeting || null;
}

// --- Initiation is store-native and produces a legacy mirror with callbacks ---
{
  const { target, cardA, cardB } = makeTarget();
  let received = null;
  const cb = (...picked) => { received = picked; };
  const previewFn = a => (a ? 'preview:' + a.uid : '');

  target.tlrStartAbilityTargeting({
    title: 'Neighbor', prompt: 'Pick one.',
    validCardIds: [cardA.uid, cardB.uid], count: 1, cb, previewFn,
  });

  const t = targeting(target);
  assert.ok(t, 'store owns the targeting selection after initiation');
  assert.deepEqual(t.validCardIds, [cardA.uid, cardB.uid], 'store holds the valid ids');
  assert.deepEqual(t.pickedCardIds, [], 'store starts with no picks');
  assert.equal(t.count, 1, 'store holds the count');
  assert.equal(target.state.abilitySelect, null, 'state.abilitySelect is not mirrored when store is ready');

  // --- Picking toggles through the store ---
  target.handleAbilityHandClick(cardB);
  assert.deepEqual(targeting(target).pickedCardIds, [cardB.uid], 'tap picks a valid target in the store');
  target.handleAbilityHandClick(cardA);
  assert.deepEqual(targeting(target).pickedCardIds, [cardA.uid], 'single-count ability replaces the previous pick');

  // --- Confirm invokes the callback with the picked card, then clears ---
  target.confirmAbilitySelection();
  assert.deepEqual(received, [cardA], 'confirm invokes the callback with the picked card object');
  assert.equal(targeting(target), null, 'confirm clears the store targeting');
}

// --- A second pick does not leak the previous callback ---
{
  const { target, cardA, cardB } = makeTarget();
  let firstCalls = 0;
  target.tlrStartAbilityTargeting({ title: 'A', validCardIds: [cardA.uid], count: 1, cb: () => { firstCalls += 1; } });
  // Abandon the first without confirming and start a new one.
  let secondReceived = null;
  target.tlrStartAbilityTargeting({ title: 'B', validCardIds: [cardB.uid], count: 1, cb: (...p) => { secondReceived = p; } });
  target.handleAbilityHandClick(cardB);
  target.confirmAbilitySelection();
  assert.deepEqual(secondReceived, [cardB], 'second pick uses the second callback');
  assert.equal(firstCalls, 0, 'the abandoned first callback is never invoked');
}

// --- Cancel never rolls back the discard — it's available at every step and
// just resolves with no picks, so resolveAbility's retry loop re-shows
// targeting fresh. No claim/gating: the source card stays discarded either way. ---
{
  const { target, cardA, cardB } = makeTarget();
  let cancelledArgs = null;

  target.tlrStore.dispatch({ type: 'START_ABILITY', abilityId: 'BETWEEN_2', sourceCardId: 99 });
  target.tlrStartAbilityTargeting({
    title: 'Between', validCardIds: [cardA.uid, cardB.uid], count: 1,
    cb: (...picked) => { cancelledArgs = picked; },
  });
  assert.equal(target.tlrCanCancelAbilitySelection(), true, 'cancel is available on the first targeting step');
  assert.equal(typeof target.cancelPendingDiscardAbility, 'undefined', 'no rollback affordance to call');
  assert.equal(target.cancelAbilitySelection(), true, 'cancel succeeds');
  assert.deepEqual(cancelledArgs, [], 'cancel resolves targeting with no selected cards');
  assert.equal(targeting(target), null, 'cancel closes targeting');

  // A later step (e.g. Between's second pick) offers the exact same Cancel —
  // no "only the first step" restriction now that nothing is being refunded.
  target.tlrStore.dispatch({ type: 'START_ABILITY', abilityId: 'BETWEEN_2', sourceCardId: 99 });
  target.tlrStartAbilityTargeting({ title: 'Between step 2', validCardIds: [cardB.uid], count: 1, cb: () => {} });
  assert.equal(target.tlrCanCancelAbilitySelection(), true, 'later targeting steps also expose Cancel');
  assert.equal(target.cancelAbilitySelection(), true, 'cancel succeeds on a later step too');
  assert.equal(targeting(target), null, 'cancel closes targeting on a later step too');
}

// --- Filling the last required pick auto-confirms without an explicit confirm call ---
{
  const { target, cardA } = makeTarget();
  let received = null;
  target.tlrStartAbilityTargeting({ title: 'Mirror', validCardIds: [cardA.uid], count: 1, cb: (...picked) => { received = picked; } });

  target.handleAbilityHandClick(cardA);
  assert.equal(received, null, 'the pick is not resolved on the same tick — it gets a beat to render first');
  assert.deepEqual(targeting(target).pickedCardIds, [cardA.uid], 'the pick is recorded immediately');

  await new Promise(resolve => setTimeout(resolve, 250));
  assert.deepEqual(received, [cardA], 'auto-confirm fires shortly after the last required pick lands');
  assert.equal(targeting(target), null, 'auto-confirm clears the store targeting');
}

// --- Deselecting (not completing) a pick never schedules an auto-confirm ---
{
  const { target, cardA, cardB } = makeTarget();
  let calls = 0;
  target.tlrStartAbilityTargeting({ title: 'Between', validCardIds: [cardA.uid, cardB.uid], count: 2, cb: () => { calls += 1; } });

  target.handleAbilityHandClick(cardA);
  target.handleAbilityHandClick(cardA); // deselect before the set is ever complete
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(calls, 0, 'an incomplete, abandoned pick never auto-confirms');
}

console.log('Ability targeting bridge checks passed.');
