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

// Phase 9: SCORE_READING owns pass/fail, carry, market open, miser/world/relic-earned.
{
  const spread = [byId.get('major_17'), byId.get('major_18'), byId.get('major_19'), null, null];
  const seed = (relics = []) => {
    let s = reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_RUN, run: { deck: [], hand: [], discard: [], spread, discards: 3, discardedCards: [], thresholdIndex: 0, thresholdBonus: 0, pendingReserve: 0, worldCarry: 0 } });
    return reducer(s, { type: ACTIONS.SYNC_LEGACY_PERSIST, persist: { relics, totalScore: 0 } });
  };

  // 17/18/19 = 3 chips + Sequence(+10) = 13 chips x 1.25 = 16 vs threshold 10: pass.
  let s = reducer(seed(), { type: ACTIONS.SCORE_READING });
  assert.equal(s.run.lastPassed, true, 'sequence spread should clear threshold 10');
  assert.equal(s.run.lastThreshold, 10, 'first threshold should be 10');
  assert.equal(s.run.phase, 'market', 'pass should open the market');
  assert.equal(s.run.thresholdIndex, 1, 'pass should advance the threshold');
  assert.equal(s.run.pendingReserve, s.run.lastScore.finalScore, 'score should bank into pending reserve');
  assert.equal(s.persist.totalScore, s.run.lastScore.finalScore, 'score should accumulate into totalScore');

  // Miser adds +5 to the banked reserve but not totalScore.
  s = reducer(seed(['miser']), { type: ACTIONS.SCORE_READING });
  assert.equal(s.run.pendingReserve, s.run.lastScore.finalScore + 5, 'miser should add +5 to banked reserve');
  assert.equal(s.persist.totalScore, s.run.lastScore.finalScore, 'miser bonus should not join totalScore');

  // The World carries 10% of the overage.
  s = reducer(seed(['the_world']), { type: ACTIONS.SCORE_READING });
  assert.equal(s.run.worldCarry, Math.floor((s.run.lastScore.finalScore - 10) * 0.1), 'world carry should be 10% of overage');

  // relicEarned when score doubles the threshold (16 >= 20 is false here).
  assert.equal(s.run.relicEarned, s.run.lastScore.finalScore >= 20, 'relicEarned should require double threshold');

  // Failing spread ends the session.
  let f = seed();
  f = reducer(f, { type: ACTIONS.SYNC_LEGACY_RUN, run: { spread: [byId.get('major_4'), null, null, null, null] } });
  f = reducer(f, { type: ACTIONS.SCORE_READING });
  assert.equal(f.run.lastPassed, false, '1-chip spread should fail threshold 10');
  assert.equal(f.run.phase, 'sessionEnd', 'fail should end the session');
  assert.equal(f.run.thresholdIndex, 0, 'fail should not advance the threshold');
  assert.equal(f.persist.totalScore, 0, 'fail should not bank score');
}

// Phase 11: ability resolution — draw/take/search/world commits.
{
  const [c1, c2, c3, c4, c5] = [byId.get('major_0'), byId.get('major_1'), byId.get('major_2'), byId.get('major_3'), byId.get('major_4')];
  const seed = (run = {}, persistPatch = {}) => {
    let s = reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_RUN, run: { deck: [c1, c2, c3], hand: [c4], discard: [c5], spread: Array(5).fill(null), discardedCards: [], abilityTakenCardIds: [], ...run } });
    return reducer(s, { type: ACTIONS.SYNC_LEGACY_PERSIST, persist: persistPatch });
  };

  // START records the ability; draw resolves with reshuffle when deck dries up.
  let s = seed({ deck: [c1], discard: [c2, c3] });
  s = reducer(s, { type: ACTIONS.START_ABILITY, abilityId: 'DRAW_3', sourceCardId: c4.uid });
  assert.equal(s.run.ability.id, 'DRAW_3', 'START_ABILITY should record the ability');
  s = reducer(s, { type: ACTIONS.RESOLVE_ABILITY, result: { kind: 'draw', count: 3 } });
  assert.equal(s.run.hand.length, 4, 'draw 3 should add exactly 3 cards');
  assert.equal(s.run.deck.length, 0, 'draw should exhaust deck and reshuffled discard');
  assert.equal(s.run.discard.length, 0, 'reshuffle should consume the discard pile');
  assert.equal(s.run.ability, null, 'resolution should clear the ability');

  // take: picked goes to hand, others to the bottom of the deck.
  s = seed();
  s = reducer(s, { type: ACTIONS.RESOLVE_ABILITY, result: { kind: 'take', heldCards: [c1, c2], takenCardId: c2.uid } });
  assert.equal(s.run.hand.some(card => card.uid === c2.uid), true, 'taken card should join hand');
  assert.deepEqual(s.run.deck.map(card => card.uid), [c3.uid, c1.uid], 'unchosen held card should go to the bottom');
  assert.deepEqual(s.run.abilityTakenCardIds, [c2.uid], 'taken card should be tracked for Chosen');

  // take with thread bond and relation_chips banks resonation chips.
  s = seed({}, { upgrades: { relation_chips: 2 } });
  s = reducer(s, { type: ACTIONS.RESOLVE_ABILITY, result: { kind: 'take', heldCards: [c1], takenCardId: c1.uid, threadBond: true } });
  assert.equal(s.run.resonationBonus.chips, 2, 'thread bond should bank relation chips');

  // search: takes from anywhere in the deck and reshuffles the rest.
  s = seed();
  s = reducer(s, { type: ACTIONS.RESOLVE_ABILITY, result: { kind: 'search', takenCardId: c3.uid } });
  assert.equal(s.run.hand.some(card => card.uid === c3.uid), true, 'searched card should join hand');
  assert.equal(s.run.deck.length, 2, 'search should leave the rest of the deck');

  // world: everything reshuffles into the deck and a fresh hand is drawn.
  s = seed();
  s = reducer(s, { type: ACTIONS.RESOLVE_ABILITY, result: { kind: 'world', handSize: 2 } });
  assert.equal(s.run.hand.length, 2, 'world should draw a fresh hand');
  assert.equal(s.run.deck.length, 3, 'world should return everything else to the deck');
  assert.equal(s.run.discard.length, 0, 'world should clear the discard');

  // cancel clears the pending ability.
  s = reducer(seed(), { type: ACTIONS.START_ABILITY, abilityId: 'PEEK_3' });
  s = reducer(s, { type: ACTIONS.CANCEL_ABILITY });
  assert.equal(s.run.ability, null, 'cancel should clear the ability');
}

// Phase 12: market economy — pack spend, upgrade picks, relic rules.
{
  const seed = (persistPatch = {}) => reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_PERSIST, persist: { reserve: 30, relics: [], ...persistPatch } });

  // Pack purchase deducts reserve exactly once; can't overspend.
  let s = reducer(seed(), { type: ACTIONS.BUY_MARKET_ITEM, purchase: { kind: 'pack', packId: 'ritual', cost: 18 } });
  assert.equal(s.persist.reserve, 12, 'pack purchase should deduct the cost once');
  assert.equal(s.run.lastPurchase.purchased, true, 'pack purchase should succeed');
  s = reducer(s, { type: ACTIONS.BUY_MARKET_ITEM, purchase: { kind: 'pack', packId: 'ritual', cost: 26 } });
  assert.equal(s.persist.reserve, 12, 'unaffordable pack should not deduct');
  assert.equal(s.run.lastPurchase.purchased, false, 'unaffordable pack should be rejected');

  // Upgrade pick applies the level and the paired key.
  s = reducer(seed(), { type: ACTIONS.BUY_MARKET_ITEM, purchase: { kind: 'upgrade', upgradeKey: 'balanced_reading', pairedKey: 'balanced_reading_mult' } });
  assert.equal(s.persist.upgrades.balanced_reading, 1, 'upgrade pick should apply');
  assert.equal(s.persist.upgrades.balanced_reading_mult, 1, 'paired upgrade should apply');

  // Relics: added once, duplicates blocked, slots enforced, replace works.
  s = reducer(seed(), { type: ACTIONS.BUY_MARKET_ITEM, purchase: { kind: 'relic', relicId: 'miser' } });
  assert.deepEqual(s.persist.relics, ['miser'], 'relic should be added once');
  s = reducer(s, { type: ACTIONS.BUY_MARKET_ITEM, purchase: { kind: 'relic', relicId: 'miser' } });
  assert.equal(s.run.lastPurchase.reason, 'duplicate_relic', 'duplicate relic should be blocked');
  s = reducer(seed({ relics: ['a', 'b', 'c'] }), { type: ACTIONS.BUY_MARKET_ITEM, purchase: { kind: 'relic', relicId: 'miser' } });
  assert.equal(s.run.lastPurchase.reason, 'relic_slots_full', 'full slots should block a plain add');
  s = reducer(seed({ relics: ['a', 'b', 'c'] }), { type: ACTIONS.BUY_MARKET_ITEM, purchase: { kind: 'relic', relicId: 'miser', replaceRelicId: 'b' } });
  assert.deepEqual(s.persist.relics, ['a', 'miser', 'c'], 'replace should swap in place');

  // Shop system: costs, refresh ladder, offers.
  const { packCost, packRefreshCost, buildPackOffer, buildRelicOffer, maxRelicSlots } = await import('../src/systems/shop.mjs');
  assert.equal(packCost(14, 0, []), 14, 'base pack cost');
  assert.equal(packCost(14, 2, []), 30, 'rebuy escalation should add 8 per purchase');
  assert.equal(packCost(14, 0, ['merchants_scale']), 11, "Merchant's Scale should discount packs by 3");
  assert.equal(packRefreshCost(0), 5, 'first refresh costs 5');
  assert.equal(packRefreshCost(99), 23, 'refresh cost should clamp at the ladder top');
  assert.equal(buildPackOffer(['a', 'b', 'c', 'd', 'e']).length, 3, 'pack offer should contain 3 packs');
  const relicCatalog = [
    { id: 'c1', rarity: 'common' }, { id: 'c2', rarity: 'common' }, { id: 'c3', rarity: 'common' },
    { id: 'r1', rarity: 'rare' }, { id: 'r2', rarity: 'rare' },
  ];
  const offer = buildRelicOffer(relicCatalog, ['c1']);
  assert.equal(offer.length, 4, 'relic offer should contain 4 relics');
  assert.equal(offer.includes('c1'), false, 'owned relics should be filtered from the offer');
  assert.equal(offer.some(id => id.startsWith('r')), true, 'a rare should be guaranteed when available');
  assert.equal(maxRelicSlots({}), 3, 'base relic slots');
  assert.equal(maxRelicSlots({ relicSlot: 5 }), 5, 'relic slots cap at 3+2');

  // LEAVE_MARKET advances the reading.
  let m = reducer(createGameState(), { type: ACTIONS.SYNC_LEGACY_RUN, run: { reading: 2 } });
  m = reducer(m, { type: ACTIONS.LEAVE_MARKET });
  assert.equal(m.run.reading, 3, 'leaving the market should advance the reading');
  assert.equal(m.run.phase, 'table', 'leaving the market should return to the table');
}

// Phase 13: reading/session flow — start reset, session end, session reset.
{
  // START_READING deals 5+hand-fool_reversed +threadbare+deep_current, banks
  // offering income, rolls pending threshold bonus, resets per-reading state.
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
