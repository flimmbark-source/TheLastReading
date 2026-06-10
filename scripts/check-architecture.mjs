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

console.log('Architecture smoke checks passed.');
