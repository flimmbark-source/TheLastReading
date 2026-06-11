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
assert.equal(state.run.constellationId, 'closed_palm', 'first round should start under The Closed Palm');

state = reducer(state, { type: ACTIONS.SELECT_CARD, cardId: state.run.hand[0].uid });
assert.equal(canDiscardSelected(state), false, 'Closed Palm should block discards at reading start');
assert.ok(scorePreview(state), 'selected card should produce a score preview');
state = reducer(state, { type: ACTIONS.PLACE_CARD, slotIndex: 0 });
assert.equal(state.run.spread.filter(Boolean).length, 1, 'placing should move one card into the spread');
assert.equal(state.run.hand.length, 4, 'placing should remove one card from hand');
assert.equal(publicRunSnapshot(state).spreadCount, 1, 'public snapshot should expose spread count');

state = reducer(state, { type: ACTIONS.SELECT_CARD, cardId: state.run.hand[0].uid });
assert.equal(canDiscardSelected(state), false, 'Closed Palm should still block discards after only 1 placed card');
state = reducer(state, { type: ACTIONS.PLACE_CARD, slotIndex: 1 });
state = reducer(state, { type: ACTIONS.SELECT_CARD, cardId: state.run.hand[0].uid });
assert.equal(canDiscardSelected(state), true, 'Closed Palm should allow discards after 2 placed cards');

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
    return { phase: 'table', reading: 1, threshold: 30, reserve: 0, totalScore: 0, handCount: 0, deckCount: 0, discardCount: 0, spreadCount: 0, discards: 3, selectedCardId: null };
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

// Phase 12+: reducer/state smoke checks
{
  let s = reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_PERSIST, persist: { reserve: 10, relics: ['threadbare_tarot', 'fool_reversed'], upgrades: { hand: 1, discards: 2, mulligan: 1, offering: 2, deep_current: 1 } } });
  s = reducer(s, { type: ACTIONS.SYNC_LEGACY_RUN, run: { thresholdBonus: 3, thresholdBonusPending: 4, worldCarry: 7 } });
  s = reducer(s, { type: ACTIONS.START_READING });
  assert.equal(s.run.hand.length, 7, 'start should deal 5+1(hand)-1(fool) +1(threadbare)+1(deep_current)');
  assert.equal(s.run.discards, 5, 'start should grant 3+2 discards');
  assert.equal(s.run.mulliganCharges, 1, 'start should grant mulligan charges');
  assert.equal(s.persist.reserve, 20, 'offering should bank +5 per level at reading start');
  assert.equal(s.run.thresholdBonus, 7, 'pending threshold bonus should roll over');
  assert.equal(s.run.thresholdBonusPending, 0, 'pending threshold bonus should clear');
  assert.equal(s.run.worldCarry, 7, 'world carry should survive into the next reading');
  assert.equal(s.run.deck.length + s.run.hand.length, 38, 'deal should conserve the deck');

  // A legacy-supplied deck is used as-is.
  const suppliedDeck = buildDeck();
  let l = reducer(createGameState(), { type: ACTIONS.START_READING, deck: suppliedDeck });
  assert.equal(l.run.hand[0].uid, suppliedDeck[0].uid, 'supplied deck should deal from the top');

  // END_SESSION records the end screen state.
  let e = reducer(createGameState(), { type: ACTIONS.END_SESSION, totalScore: 123, obals: 3 });
  assert.equal(e.run.phase, 'sessionEnd', 'end session should set the phase');
  assert.equal(e.run.lastSessionScore, 123, 'end session should record the score');
  assert.equal(e.run.lastSessionObals, 3, 'end session should record the obals');

  // RESET_SESSION clears session-scoped persist, keeps permanent progress.
  let r = reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_PERSIST, persist: { reserve: 50, totalScore: 200, relics: ['miser'], relicUsed: { miser: true }, upgrades: { hand: 2, relicSlot: 2 }, obals: 9, unlockedFragments: ['f1'] } });
  r = reducer(r, { type: ACTIONS.RESET_SESSION });
  assert.equal(r.persist.reserve, 0, 'reset should clear reserve');
  assert.equal(r.persist.totalScore, 0, 'reset should clear total score');
  assert.deepEqual(r.persist.relics, [], 'reset should clear relics');
  assert.equal(r.persist.upgrades.relicSlot, 0, 'reset should clear relic slots');
  assert.equal(r.persist.upgrades.hand, 2, 'reset should keep permanent upgrades');
  assert.equal(r.persist.obals, 9, 'reset should keep obals');
  assert.deepEqual(r.persist.unlockedFragments, ['f1'], 'reset should keep unlocked fragments');
  assert.equal(r.run.reading, 1, 'reset should start a fresh run');
}

// Phase 14: attic/archive data, unlock rules, obals.
{
  const { obalsFromScore, canSearchAtticObject, searchAtticObject } = await import('../src/systems/attic.mjs');
  const { ATTIC_OBJECTS } = await import('../src/data/atticObjects.mjs');
  const { ARCHIVE_FRAGMENTS, RESONATIONS } = await import('../src/data/archiveFragments.mjs');
  const { archiveEntries, unlockedFragments, obals } = await import('../src/game/selectors.mjs');

  // Live obal ladder: 50->2, 100->3, 250->4, 450->5, 700->6, 1000->7, else 1.
  for (const [score, expected] of [[0, 1], [49, 1], [50, 2], [99, 2], [100, 3], [250, 4], [450, 5], [700, 6], [1000, 7], [5000, 7]]) {
    assert.equal(obalsFromScore(score), expected, `score ${score} should grant ${expected} obals`);
  }

  // Search rules: blocked when already searched or already found.
  const someObjectId = Object.keys(ATTIC_OBJECTS)[0];
  const itemId = ATTIC_OBJECTS[someObjectId].itemId;
  assert.equal(canSearchAtticObject(someObjectId), true, 'fresh object should be searchable');
  assert.equal(canSearchAtticObject(someObjectId, { [someObjectId]: true }), false, 'searched object should be blocked');
  assert.equal(canSearchAtticObject(someObjectId, {}, [itemId]), false, 'already-found item should be blocked');
  const searchResult = searchAtticObject(someObjectId);
  assert.equal(searchResult.foundItemId, itemId, 'search should find the object item');

  // Resonation fragments resolve in the catalog.
  assert.ok(ARCHIVE_FRAGMENTS[RESONATIONS[0].fragmentId], 'resonation fragment should exist in the catalog');

  // Unlocks are idempotent; attic entry banks obals; selectors read them.
  let a = reducer(createGameState(), { type: ACTIONS.UNLOCK_FRAGMENT, fragmentId: RESONATIONS[0].fragmentId });
  a = reducer(a, { type: ACTIONS.UNLOCK_FRAGMENT, fragmentId: RESONATIONS[0].fragmentId });
  assert.equal(a.persist.unlockedFragments.length, 1, 'fragment unlock should not duplicate');
  assert.equal(unlockedFragments(a).length, 1, 'unlocked fragment selector should resolve content');
  a = reducer(a, { type: ACTIONS.DISCOVER_ARCHIVE_ITEM, itemId: 'clipping_01' });
  a = reducer(a, { type: ACTIONS.DISCOVER_ARCHIVE_ITEM, itemId: 'clipping_01' });
  assert.equal(a.persist.discoveredArchiveItems.length, 1, 'item discovery should not duplicate');
  assert.equal(archiveEntries(a).length, 2, 'archive should render discovered item + unlocked fragment');
  a = reducer(a, { type: ACTIONS.ENTER_ATTIC, obals: 4 });
  assert.equal(a.run.phase, 'attic', 'attic entry should set the phase');
  assert.equal(obals(a), 4, 'attic entry should bank the obal grant');
  a = reducer(a, { type: ACTIONS.LEAVE_ATTIC });
  assert.equal(a.run.phase, 'table', 'leaving the attic should return to the table');
  assert.equal(obals(a), 4, 'obals should persist after leaving the attic');
}

console.log('Architecture smoke checks passed.');
