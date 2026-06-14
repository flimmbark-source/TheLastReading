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

  const mirror = target.state.abilitySelect;
  assert.ok(mirror?.__storeOwned, 'legacy mirror is store-owned');
  assert.ok(mirror.validIds.has(cardA.uid) && mirror.validIds.has(cardB.uid), 'mirror exposes valid ids for the renderer');
  assert.equal(mirror.cb, cb, 'callback is mirrored from the local holder, not the store');
  assert.equal(mirror.previewFn, previewFn, 'preview function is mirrored from the local holder');

  // --- Picking toggles through the store ---
  target.handleAbilityHandClick(cardB);
  assert.deepEqual(targeting(target).pickedCardIds, [cardB.uid], 'tap picks a valid target in the store');
  target.handleAbilityHandClick(cardA);
  assert.deepEqual(targeting(target).pickedCardIds, [cardA.uid], 'single-count ability replaces the previous pick');

  // --- Confirm invokes the callback with the picked card, then clears ---
  target.confirmAbilitySelection();
  assert.deepEqual(received, [cardA], 'confirm invokes the callback with the picked card object');
  assert.equal(targeting(target), null, 'confirm clears the store targeting');
  assert.equal(target.state.abilitySelect, null, 'confirm clears the legacy mirror');
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

console.log('Ability targeting bridge checks passed.');
