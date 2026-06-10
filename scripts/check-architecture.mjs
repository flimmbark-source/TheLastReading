import assert from 'node:assert/strict';

import { buildDeck } from '../src/systems/deck.mjs';
import { computeScore } from '../src/systems/scoring.mjs';
import { getCardHints } from '../src/systems/hints.mjs';
import { betweenCardIds, mirrorCardId, neighborCardIds, validHandTargetsForAbility } from '../src/systems/abilities.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { createGameState } from '../src/game/state.mjs';
import { ACTIONS } from '../src/game/actions.mjs';
import { canDiscardSelected, publicRunSnapshot, scorePreview } from '../src/game/selectors.mjs';
import { createStore } from '../src/app/store.mjs';
import { deserializePersistState, serializePersistState } from '../src/app/save.mjs';
import { installArchitectureBridge, uninstallArchitectureBridge } from '../src/app/bootstrap.mjs';
import { installLiveMirror } from '../src/app/liveMirror.mjs';

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

const starMoonState = {
  spread: [byId.get('major_17')],
  hand: [byId.get('major_18')],
};
const moonHints = getCardHints(byId.get('major_18'), starMoonState);
assert.ok(moonHints.some(hint => hint.label === 'Sequence'), '18 next to 17 should receive a Sequence hint');

const fiveSixState = {
  spread: [byId.get('major_5')],
  hand: [byId.get('major_6')],
};
const sixHints = getCardHints(byId.get('major_6'), fiveSixState);
assert.ok(sixHints.some(hint => hint.label === 'Sequence'), '6 next to 5 should receive a Sequence hint');

assert.equal(mirrorCardId(byId.get('major_18')), 'major_3', 'Moon should mirror to Empress across the major centerline');
assert.deepEqual(neighborCardIds(byId.get('major_18')), ['major_17', 'major_19'], 'Moon neighbors should be Star and Sun');
assert.deepEqual(betweenCardIds(byId.get('major_5'), byId.get('major_8')), ['major_6', 'major_7'], 'Between 5 and 8 should reveal 6 and 7');

const abilityState = {
  hand: [byId.get('major_5'), byId.get('major_18'), byId.get('court_Cups_Page')],
  deck: [byId.get('major_6'), byId.get('major_7'), byId.get('major_3')],
};
assert.ok(validHandTargetsForAbility('BETWEEN_2', abilityState).some(card => card.id === 'major_5'), 'Hierophant should be a valid Between target when a between card exists in deck');
assert.ok(validHandTargetsForAbility('MIRROR_1', abilityState).some(card => card.id === 'major_18'), 'Moon should be a valid Mirror target when Empress is in deck');

let state = createGameState();
state = reducer(state, { type: ACTIONS.START_READING, rng: () => 0.5 });
assert.equal(state.run.hand.length, 5, 'starting hand should draw 5 cards');
assert.equal(state.run.spread.length, 5, 'spread should have 5 slots');

state = reducer(state, { type: ACTIONS.SELECT_CARD, cardId: state.run.hand[0].uid });
assert.equal(canDiscardSelected(state), true, 'selected card should be discardable at reading start');
assert.ok(scorePreview(state), 'selected card should produce a score preview');
state = reducer(state, { type: ACTIONS.PLACE_CARD, slotIndex: 0 });
assert.equal(state.run.spread.filter(Boolean).length, 1, 'placing should move one card into the spread');
assert.equal(state.run.hand.length, 4, 'placing should remove one card from hand');
assert.equal(publicRunSnapshot(state).spreadCount, 1, 'public snapshot should expose spread count');

const store = createStore(createGameState(), reducer);
let listenerCalled = false;
const unsubscribe = store.subscribe(() => { listenerCalled = true; });
store.dispatch({ type: ACTIONS.START_READING, rng: () => 0.25 });
assert.equal(listenerCalled, true, 'store listeners should fire after state changes');
unsubscribe();

const saved = serializePersistState({ ...state.persist, reserve: 12, obals: 3 });
const loaded = deserializePersistState(saved);
assert.equal(loaded.reserve, 12, 'save helper should preserve reserve');
assert.equal(loaded.obals, 3, 'save helper should preserve obals');

const bridgeTarget = {};
const runtime = installArchitectureBridge(bridgeTarget, { storage: null, persist: { reserve: 7 } });
assert.equal(bridgeTarget.tlrStore, runtime.store, 'bridge should expose tlrStore');
assert.equal(bridgeTarget.tlrActions.START_READING, ACTIONS.START_READING, 'bridge should expose actions');
assert.equal(bridgeTarget.tlrStore.getState().persist.reserve, 7, 'bridge should preserve supplied persist state');
uninstallArchitectureBridge(bridgeTarget);
assert.equal(bridgeTarget.tlrStore, undefined, 'bridge uninstall should remove tlrStore');

const mirrorTarget = {
  console: { info() {} },
  tlrReadLiveSnapshot() {
    return { phase: 'table', reading: 1, threshold: 10, reserve: 0, totalScore: 0, handCount: 0, deckCount: 0, discardCount: 0, spreadCount: 0, discards: 3, selectedCardId: null };
  },
};
installLiveMirror(mirrorTarget, { storage: null });
assert.equal(typeof mirrorTarget.tlrMirrorLiveState, 'function', 'live mirror should install mirror function');
const mirrorReport = mirrorTarget.tlrMirrorLiveState();
assert.equal(Array.isArray(mirrorReport.mismatches), true, 'live mirror report should include mismatches');
assert.equal(mirrorTarget.tlrLastMirrorReport, mirrorReport, 'live mirror should store last report');
const syncedReport = mirrorTarget.tlrMirrorLiveState({ sync: true });
assert.equal(syncedReport.ok, true, 'syncing the legacy snapshot should make the diagnostic mirror match');
assert.deepEqual(mirrorTarget.tlrStore.getState().run.legacySnapshot, syncedReport.live, 'sync should store the normalized legacy snapshot');

// Phase 5: continuous mirroring. The legacy app mutates its state after each
// player action, then re-syncs quietly; the mirror must track every change.
const liveState = { phase: 'table', reading: 1, threshold: 10, reserve: 0, totalScore: 0, handCount: 5, deckCount: 33, discardCount: 0, spreadCount: 0, discards: 3, selectedCardId: null };
const continuousTarget = {
  console: { info() { throw new Error('quiet sync/mirror should not log'); } },
  tlrReadLiveSnapshot: () => ({ ...liveState }),
};
installLiveMirror(continuousTarget, { storage: null });
continuousTarget.tlrSyncArchitectureToLiveSnapshot({ quiet: true });
assert.equal(continuousTarget.tlrMirrorLiveState({ quiet: true }).ok, true, 'mirror should match after initial quiet sync');
liveState.selectedCardId = 12;
assert.equal(continuousTarget.tlrMirrorLiveState({ quiet: true }).ok, false, 'mirror should detect legacy drift before the next sync');
continuousTarget.tlrSyncArchitectureToLiveSnapshot({ quiet: true });
liveState.selectedCardId = null;
liveState.handCount = 4;
liveState.spreadCount = 1;
continuousTarget.tlrSyncArchitectureToLiveSnapshot({ quiet: true });
assert.equal(continuousTarget.tlrMirrorLiveState({ quiet: true }).ok, true, 'mirror should match again after each action re-sync');

// Phase 7: legacy check-in followed by a store-owned PLACE_CARD.
{
  const legacyHand = [byId.get('major_0'), byId.get('major_1'), byId.get('court_Cups_Page')];
  let state7 = reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_RUN, run: { deck: [byId.get('major_2')], hand: legacyHand, discard: [], spread: Array(5).fill(null), discards: 3 } });
  state7 = reducer(state7, { type: ACTIONS.SELECT_CARD, cardId: legacyHand[1].uid });
  state7 = reducer(state7, { type: ACTIONS.PLACE_CARD, slotIndex: 2 });
  assert.equal(state7.run.hand.length, 2, 'check-in + place should remove exactly one card from hand');
  assert.equal(state7.run.spread[2], legacyHand[1], 'placed card should land in the chosen slot');
  assert.equal(state7.run.selectedCardId, null, 'placement should clear selection');
  assert.equal(state7.run.deck.length, 1, 'placement should not touch the deck');
  const persist7 = reducer(state7, { type: ACTIONS.SYNC_LEGACY_PERSIST, persist: { reserve: 12, relics: ['gilded_discard'] } });
  assert.equal(persist7.persist.reserve, 12, 'persist check-in should set reserve');
  assert.deepEqual(persist7.persist.relics, ['gilded_discard'], 'persist check-in should set relics');
}

// Phase 8: discard rules — charge spend, Gilded Discard, sight_cost.
{
  const draw1 = byId.get('major_4'); // DRAW_1
  const peek3 = byId.get('major_0'); // PEEK_3 (sight ability)
  const seed = (relics = [], upgrades = {}) => {
    let s = reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_RUN, run: { deck: [byId.get('major_2')], hand: [draw1, peek3], discard: [], spread: Array(5).fill(null), discards: 3, discardedCards: [], freeDiscardUsed: false, sightChargesUsed: 0 } });
    return reducer(s, { type: ACTIONS.SYNC_LEGACY_PERSIST, persist: { relics, upgrades: { ...s.persist.upgrades, ...upgrades } } });
  };

  // Plain discard: spends a charge, no replacement draw by the reducer (the
  // discarded card's ability draws — still legacy-owned).
  let s = seed();
  s = reducer(s, { type: ACTIONS.SELECT_CARD, cardId: draw1.uid });
  s = reducer(s, { type: ACTIONS.DISCARD_SELECTED });
  assert.equal(s.run.discards, 2, 'plain discard should spend a charge');
  assert.equal(s.run.hand.length, 1, 'discard should remove exactly one card');
  assert.equal(s.run.deck.length, 1, 'reducer discard should not draw');
  assert.equal(s.run.discard.length, 1, 'discard pile should gain the card');
  assert.equal(s.run.lastDiscardedCard, draw1, 'reducer should expose the discarded card for legacy ability resolution');
  assert.equal(s.run.discardedCards.length, 0, 'discardedCards should not be tracked without hanged_coin/quick_release');

  // Gilded Discard: first discard is free, second spends.
  s = seed(['gilded_discard']);
  s = reducer(s, { type: ACTIONS.SELECT_CARD, cardId: draw1.uid });
  s = reducer(s, { type: ACTIONS.DISCARD_SELECTED });
  assert.equal(s.run.discards, 3, 'gilded discard should make the first discard free');
  assert.equal(s.run.freeDiscardUsed, true, 'free discard should be marked used');
  s = reducer(s, { type: ACTIONS.SELECT_CARD, cardId: peek3.uid });
  s = reducer(s, { type: ACTIONS.DISCARD_SELECTED });
  assert.equal(s.run.discards, 2, 'second discard should spend a charge');

  // sight_cost: discarding a peek/search/mirror card uses a sight charge.
  s = seed([], { sight_cost: 1 });
  s = reducer(s, { type: ACTIONS.SELECT_CARD, cardId: peek3.uid });
  s = reducer(s, { type: ACTIONS.DISCARD_SELECTED });
  assert.equal(s.run.discards, 3, 'sight ability discard should not spend a charge while sight charges remain');
  assert.equal(s.run.sightChargesUsed, 1, 'sight charge should be consumed');
  s = reducer(s, { type: ACTIONS.SELECT_CARD, cardId: draw1.uid });
  s = reducer(s, { type: ACTIONS.DISCARD_SELECTED });
  assert.equal(s.run.discards, 2, 'non-sight discard should spend a charge');

  // hanged_coin tracks discarded cards.
  s = seed(['hanged_coin']);
  s = reducer(s, { type: ACTIONS.SELECT_CARD, cardId: draw1.uid });
  s = reducer(s, { type: ACTIONS.DISCARD_SELECTED });
  assert.equal(s.run.discardedCards.length, 1, 'hanged_coin should track discarded cards');

  // No charges left: discard is rejected.
  s = seed();
  s = reducer(s, { type: ACTIONS.SYNC_LEGACY_RUN, run: { discards: 0 } });
  s = reducer(s, { type: ACTIONS.SELECT_CARD, cardId: draw1.uid });
  const blocked = reducer(s, { type: ACTIONS.DISCARD_SELECTED });
  assert.equal(blocked.run.hand.length, 2, 'discard with no charges should be a no-op');
}

console.log('Architecture smoke checks passed.');
