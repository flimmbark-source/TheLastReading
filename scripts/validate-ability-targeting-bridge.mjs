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
  const cardC = { uid: 3, id: 'major_3', type: 'major', ability: 'BETWEEN_2' };
  const target = {
    tlrStore: store,
    state: {
      hand: [cardA, cardB, cardC], spread: [], discard: [], discardedCards: [],
      discards: 3, freeDiscardUsed: false, sightChargesUsed: 0,
      roundDiscardCount: 0, lastDiscardedCard: null, abilitySelect: null,
    },
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

// --- Complete cancel restores the source card and pre-discard resources. ---
{
  const { target, cardA, cardB, cardC } = makeTarget();
  let cancelledArgs = null;
  const rollback = {
    card: cardC,
    handIndex: 2,
    discards: 3,
    freeDiscardUsed: false,
    sightChargesUsed: 0,
    discardedCards: [],
    roundDiscardCount: 0,
    lastDiscardedCard: null,
  };

  target.state.hand = [cardA, cardB];
  target.state.discard = [cardC];
  target.state.discardedCards = [cardC];
  target.state.discards = 2;
  target.state.roundDiscardCount = 1;
  target.state.lastDiscardedCard = cardC;
  target.__tlrPendingAbilityDiscardRollback = rollback;
  target.tlrStore.dispatch({
    type: 'SYNC_LEGACY_RUN',
    run: {
      hand: [cardA, cardB], discard: [cardC], discardedCards: [cardC],
      discards: 2, freeDiscardUsed: false, sightChargesUsed: 0,
      roundDiscardCount: 1, selectedCardId: null,
    },
  });
  target.tlrStore.dispatch({
    type: 'START_ABILITY',
    ability: { id: 'BETWEEN_2', sourceCardId: cardC.uid },
    sourceCardId: cardC.uid,
  });
  target.tlrStartAbilityTargeting({
    title: 'Between', validCardIds: [cardA.uid, cardB.uid], count: 1,
    cb: (...picked) => { cancelledArgs = picked; },
  });

  assert.equal(target.tlrCanCancelAbilitySelection(), true, 'cancel is available on the initial targeting step');
  assert.equal(target.cancelAbilitySelection(), true, 'cancel succeeds');
  assert.deepEqual(cancelledArgs, [null], 'cancel signals an explicit targeting-flow exit');
  assert.equal(targeting(target), null, 'cancel closes targeting');

  const run = target.tlrStore.getState().run;
  assert.equal(run.ability, null, 'cancel clears the active ability');
  assert.equal(run.busy, false, 'cancel releases the table busy state');
  assert.deepEqual(run.hand.map(card => card.uid), [cardA.uid, cardB.uid, cardC.uid], 'cancel returns the source card to its original hand position');
  assert.deepEqual(run.discard, [], 'cancel removes the source card from discard');
  assert.equal(run.discards, 3, 'cancel refunds the spent discard');
  assert.deepEqual(run.discardedCards, [], 'cancel restores discard-tracking history');
  assert.equal(run.roundDiscardCount, 0, 'cancel restores the round discard count');
  assert.deepEqual(target.state.hand.map(card => card.uid), [cardA.uid, cardB.uid, cardC.uid], 'legacy hand mirrors the restored store hand');
  assert.deepEqual(target.state.discard, [], 'legacy discard mirrors the restored store discard');
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
