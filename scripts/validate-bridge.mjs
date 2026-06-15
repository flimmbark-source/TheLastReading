// Legacy <-> store bridge contract.
//
// syncRunToStore has been retired; run state now flows store-first via individual
// dispatch-then-sync-back operations (PLACE_CARD, DISCARD_SELECTED, etc.).
// This suite now pins:
//   1. syncPersistToStore emits SYNC_LEGACY_PERSIST with the correct field mapping.
//   2. resolveAbilityThroughStore still copies resolved piles back onto legacy state.
//   3. SYNC_LEGACY_RUN still exists for bootstrap use (mainMenu syncInitialRunToStore).

import assert from 'node:assert/strict';

import { createStore } from '../src/app/store.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { createGameState } from '../src/game/state.mjs';
import { ACTIONS } from '../src/game/actions.mjs';
import { syncPersistToStore, resolveAbilityThroughStore } from '../src/app/legacyBridge.mjs';

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
    abilityTakenUids: new Set([3]),
    resonationBonus: { chips: 2, mult: 1, name: 'Thread Bond' },
  };
}

const persist = { pool: 100, totalScore: 250, up: { hand: 1 }, relics: ['miser'], relicUsed: { miser: true } };

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

// --- 1. syncPersistToStore maps legacy persist to store ---
{
  const target = makeTarget(makeLegacyState());
  syncPersistToStore(target);
  const persistAction = target.dispatched.find(a => a.type === ACTIONS.SYNC_LEGACY_PERSIST);
  assert.ok(persistAction, 'syncPersistToStore dispatches SYNC_LEGACY_PERSIST');
  assert.equal(persistAction.persist.reserve, 100, 'pool -> reserve');
  assert.equal(persistAction.persist.totalScore, 250, 'totalScore maps across');
  assert.equal(persistAction.persist.upgrades.hand, 1, 'up -> upgrades');
  assert.deepEqual(persistAction.persist.relics, ['miser'], 'relics map across');
  assert.deepEqual(persistAction.persist.relicUsed, { miser: true }, 'relicUsed maps across');

  const p = target.tlrStore.getState().persist;
  assert.equal(p.reserve, 100, 'store persist.reserve updated');
  assert.equal(p.totalScore, 250, 'store persist.totalScore updated');
}

// --- 2. resolveAbilityThroughStore copies resolved piles back onto legacy ---
{
  const state = makeLegacyState();
  const target = makeTarget(state);
  // Seed store with initial run state (simulates what mainMenu.syncInitialRunToStore does)
  target.tlrStore.dispatch({ type: ACTIONS.SYNC_LEGACY_RUN, run: {
    deck: state.deck, hand: state.hand, discard: state.discard, spread: state.spread,
    selectedCardId: state.selected, discards: state.discards, discardedCards: state.discardedCards,
    freeDiscardUsed: false, sightChargesUsed: 0, thresholdIndex: 0, thresholdBonus: 0,
    thresholdBonusPending: 0, reading: 1, pendingReserve: 0, worldCarry: 0,
    abilityTakenCardIds: [...state.abilityTakenUids], resonationBonus: state.resonationBonus,
    setIndex: 0, setsPerRound: 2, roundScore: 0, setScores: [], roundDiscardCount: 0,
    roundPatternCount: 0, constellationId: null, untargetableCardIds: [],
    awaitingNextSet: false, lastOutcome: null,
  }});

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
}

// --- 3. SYNC_LEGACY_RUN still handled by reducer (bootstrap path) ---
{
  const base = createStore(createGameState(), reducer);
  const state = makeLegacyState();
  base.dispatch({ type: ACTIONS.SYNC_LEGACY_RUN, run: {
    deck: state.deck, hand: state.hand, discard: state.discard, spread: state.spread,
    selectedCardId: state.selected, discards: state.discards, discardedCards: state.discardedCards,
    freeDiscardUsed: false, sightChargesUsed: 0, thresholdIndex: 0, thresholdBonus: 0,
    thresholdBonusPending: 0, reading: 1, pendingReserve: 0, worldCarry: 0,
    abilityTakenCardIds: [], resonationBonus: null, setIndex: 0, setsPerRound: 2,
    roundScore: 0, setScores: [], roundDiscardCount: 0, roundPatternCount: 0,
    constellationId: null, untargetableCardIds: [], awaitingNextSet: false, lastOutcome: null,
  }});
  const run = base.getState().run;
  assert.equal(run.hand, state.hand, 'SYNC_LEGACY_RUN still seeds store hand (bootstrap)');
  assert.equal(run.discards, 7, 'SYNC_LEGACY_RUN seeds discards');
}

console.log('Bridge contract checks passed.');
