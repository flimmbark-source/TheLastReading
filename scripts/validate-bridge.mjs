// Legacy <-> store bridge contract.
//
// The game keeps a mutable `window.state` (legacy) in sync with the immutable
// store `run`. Field drift between those two shapes is exactly the class of bug
// that destabilized multiplayer abilities, so this suite pins the contract:
//   1. app/legacyBridge.mjs#syncRunToStore must emit *exactly* the run fields the
//      reducer whitelists in LEGACY_RUN_FIELDS (add to one side only -> fail).
//   2. Each legacy field name maps to the right store field with the right value.
//   3. resolveAbilityThroughStore copies the resolved piles back onto legacy.
//
// It runs headless: no DOM, just a mock `window`-like target.

import assert from 'node:assert/strict';

import { createStore } from '../src/app/store.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { createGameState } from '../src/game/state.mjs';
import { ACTIONS } from '../src/game/actions.mjs';
import { LEGACY_RUN_FIELDS } from '../src/game/reducer.mjs';
import { syncRunToStore, resolveAbilityThroughStore } from '../src/app/legacyBridge.mjs';

const card = uid => ({ uid, id: `major_${uid}`, type: 'major', number: uid, points: uid });

function makeLegacyState() {
  return {
    deck: [card(1), card(2)],
    hand: [card(3)],
    discard: [card(4)],
    spread: [card(5), null, null, null, null],
    selected: 3,
    discards: 7,
    discardedCards: [card(4)],
    freeDiscardUsed: true,
    sightChargesUsed: 2,
    th: 3,
    thBonus: 5,
    thBonusPending: 6,
    reading: 4,
    pendingPool: 9,
    worldCarry: 8,
    abilityTakenUids: new Set([3]),
    resonationBonus: { chips: 2, mult: 1, name: 'Thread Bond' },
    setIndex: 1,
    setsPerRound: 2,
    roundScore: 42,
    setScores: [10, 20],
    roundDiscardCount: 1,
    roundPatternCount: 2,
    constellationId: 'closed_palm',
    untargetableCardUids: [5],
    awaitingNextSet: true,
    lastOutcome: 'nextSet',
  };
}

const persist = { pool: 100, totalScore: 250, up: { hand: 1 }, relics: ['miser'], relicUsed: { miser: true } };

// A target that records dispatched actions so we can inspect the emitted patch.
function makeTarget(state) {
  const base = createStore(createGameState(), reducer);
  const dispatched = [];
  return {
    dispatched,
    tlrActions: ACTIONS,
    tlrRuntime: { state, persist },
    tlrStore: {
      getState: base.getState,
      subscribe: base.subscribe,
      dispatch(action) {
        dispatched.push(action);
        return base.dispatch(action);
      },
    },
  };
}

// --- 1. Drift guard: emitted run keys === reducer whitelist ---
{
  const target = makeTarget(makeLegacyState());
  syncRunToStore(target);
  const runAction = target.dispatched.find(a => a.type === ACTIONS.SYNC_LEGACY_RUN);
  assert.ok(runAction, 'syncRunToStore dispatches SYNC_LEGACY_RUN');
  assert.deepEqual(
    Object.keys(runAction.run).sort(),
    [...LEGACY_RUN_FIELDS].sort(),
    'syncRunToStore must emit exactly the whitelisted run fields (legacy<->store drift)',
  );
}

// --- 2. Value mapping legacy -> store ---
{
  const state = makeLegacyState();
  const target = makeTarget(state);
  syncRunToStore(target);
  const run = target.tlrStore.getState().run;

  assert.equal(run.deck, state.deck, 'deck passes through by reference');
  assert.equal(run.hand, state.hand, 'hand passes through');
  assert.equal(run.discard, state.discard, 'discard passes through');
  assert.equal(run.selectedCardId, 3, 'selected -> selectedCardId');
  assert.equal(run.discards, 7, 'discards map across');
  assert.equal(run.thresholdIndex, 3, 'th -> thresholdIndex');
  assert.equal(run.thresholdBonus, 5, 'thBonus -> thresholdBonus');
  assert.equal(run.thresholdBonusPending, 6, 'thBonusPending -> thresholdBonusPending');
  assert.equal(run.reading, 4, 'reading maps across');
  assert.equal(run.pendingReserve, 9, 'pendingPool -> pendingReserve');
  assert.equal(run.worldCarry, 8, 'worldCarry maps across');
  assert.deepEqual(run.abilityTakenCardIds, [3], 'abilityTakenUids Set -> abilityTakenCardIds array');
  assert.deepEqual(run.resonationBonus, state.resonationBonus, 'resonationBonus maps across');
  assert.equal(run.setIndex, 1, 'setIndex maps across');
  assert.equal(run.setsPerRound, 2, 'setsPerRound maps across');
  assert.equal(run.roundScore, 42, 'roundScore maps across');
  assert.deepEqual(run.setScores, [10, 20], 'setScores map across');
  assert.equal(run.roundDiscardCount, 1, 'roundDiscardCount maps across');
  assert.equal(run.roundPatternCount, 2, 'roundPatternCount maps across');
  assert.equal(run.constellationId, 'closed_palm', 'constellationId passes through when th > 0');
  assert.deepEqual(run.untargetableCardIds, [5], 'untargetableCardUids -> untargetableCardIds when th > 0');
  assert.equal(run.awaitingNextSet, true, 'awaitingNextSet maps across');
  assert.equal(run.lastOutcome, 'nextSet', 'lastOutcome maps across');
}

// --- 2b. Constellation/untargetable suppressed on the first reading (th === 0) ---
{
  const state = { ...makeLegacyState(), th: 0 };
  const target = makeTarget(state);
  syncRunToStore(target);
  const run = target.tlrStore.getState().run;
  assert.equal(run.constellationId, null, 'no constellation on the opening reading');
  assert.deepEqual(run.untargetableCardIds, [], 'no untargetable cards on the opening reading');
}

// --- 3. Persist mapping legacy -> store ---
{
  const target = makeTarget(makeLegacyState());
  syncRunToStore(target);
  const p = target.tlrStore.getState().persist;
  assert.equal(p.reserve, 100, 'pool -> reserve');
  assert.equal(p.totalScore, 250, 'totalScore maps across');
  assert.equal(p.upgrades.hand, 1, 'up -> upgrades');
  assert.deepEqual(p.relics, ['miser'], 'relics map across');
  assert.deepEqual(p.relicUsed, { miser: true }, 'relicUsed maps across');
}

// --- 4. resolveAbilityThroughStore copies resolved piles back onto legacy ---
{
  const state = makeLegacyState();
  const target = makeTarget(state);
  const ok = resolveAbilityThroughStore({ kind: 'draw', count: 1 }, target);
  assert.equal(ok, true, 'resolveAbilityThroughStore reports success');
  const run = target.tlrStore.getState().run;
  assert.equal(state.hand.length, 2, 'drawing one card grows the legacy hand');
  assert.equal(state.deck.length, 1, 'drawing one card shrinks the legacy deck');
  assert.deepEqual(
    state.hand.map(c => c.uid),
    run.hand.map(c => c.uid),
    'legacy hand mirrors the store after resolution',
  );
  assert.deepEqual(
    state.deck.map(c => c.uid),
    run.deck.map(c => c.uid),
    'legacy deck mirrors the store after resolution',
  );
}

console.log('Bridge contract checks passed.');
