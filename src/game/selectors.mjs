import { computeScore } from '../systems/scoring.mjs';
import { currentThreshold } from '../data/thresholds.mjs';
import { getCardHints, getHandHints } from '../systems/hints.mjs';
import { ARCHIVE_FRAGMENTS, ARCHIVE_ITEMS } from '../data/archiveFragments.mjs';
import { blocksDiscard, constellationThreshold } from '../systems/constellations.mjs';

export function placedCards(state) {
  return state.run.spread.filter(Boolean);
}

export function selectedCard(state) {
  if (state.run.selectedCardId == null) return null;
  return state.run.hand.find(card => card.uid === state.run.selectedCardId) || null;
}

export function handView(state, options = {}) {
  return {
    hand: state.run.hand || [],
    selected: state.run.selectedCardId ?? null,
    // Purge is not fully store-owned yet, so callers may pass the current legacy
    // purge list while the rest of the hand display data comes from the store.
    purgeSelect: options.purgeSelect ?? state.run.purge ?? null,
    onToggleSelect: options.onToggleSelect || null,
  };
}

export function spreadView(state, options = {}) {
  return {
    spread: state.run.spread || Array(5).fill(null),
    selected: state.run.selectedCardId ?? null,
    onPlaceCard: options.onPlaceCard || null,
    onAbilityTarget: options.onAbilityTarget || null,
  };
}

export function tableView(state, options = {}) {
  const run = state.run;
  const persist = state.persist;
  const inPurge = options.inPurge ?? run.purge !== null;
  const inAbility = options.inAbility ?? !!run.ability;
  const discardBlocked = blocksDiscard(run);
  return {
    threshold: thresholdValue(state),
    thresholdBonusPending: run.thresholdBonusPending || 0,
    reserve: persist.reserve,
    discards: run.discards,
    discardDisabled: selectedCard(state) === null || run.discards <= 0 || inPurge || discardBlocked,
    discardTitle: discardBlocked ? 'Place 2 cards before discarding.' : '',
    purgeDisabled: run.busy || run.hand.length < 3 || inAbility || inPurge,
  };
}

export function thresholdValue(state) {
  return constellationThreshold(currentThreshold(state.run.thresholdIndex, state.run.thresholdBonus), state.run);
}

export function scoringContext(state) {
  return {
    handCount: state.run.hand.length,
    discardedCount: state.run.discardedCards.length,
    discardedCards: state.run.discardedCards,
    abilityTakenCardIds: state.run.abilityTakenCardIds,
    resonationBonus: state.run.resonationBonus,
    worldCarry: state.run.worldCarry,
    constellationId: state.run.constellationId,
  };
}

export function scorePlacedCards(state, options = {}) {
  return computeScore(placedCards(state), {
    upgrades: state.persist.upgrades,
    relics: state.persist.relics,
    context: scoringContext(state),
    ...options,
  });
}

export function scoreIfSelectedPlaced(state, options = {}) {
  const card = selectedCard(state);
  if (!card) return null;
  return computeScore([...placedCards(state), card], {
    upgrades: state.persist.upgrades,
    relics: state.persist.relics,
    context: { ...scoringContext(state), handCount: state.run.hand.length - 1 },
    ...options,
  });
}

export function canPlaceSelectedInSlot(state, slotIndex) {
  return Boolean(selectedCard(state)) && !state.run.spread[slotIndex] && !state.run.busy && !state.run.ability && !state.run.purge;
}

export function canDiscardSelected(state) {
  return Boolean(selectedCard(state)) && state.run.discards > 0 && !blocksDiscard(state.run) && !state.run.busy && !state.run.ability && !state.run.purge;
}

export function canScoreReading(state) {
  return state.run.spread.every(Boolean) || state.run.hand.length === 0;
}

export function selectedCardHints(state, options = {}) {
  const card = selectedCard(state);
  if (!card) return [];
  return getCardHints(card, state.run, {
    upgrades: state.persist.upgrades,
    relics: state.persist.relics,
    ...options,
  });
}

export function handHints(state, options = {}) {
  return getHandHints(state.run, {
    upgrades: state.persist.upgrades,
    relics: state.persist.relics,
    ...options,
  });
}

// Converts the store-owned targeting selection into the view shape that
// renderHand / renderSpread / refreshHandState expect: { validIds: Set, picked: [] }.
// Returns null when no targeting is active.
export function abilityTargetView(state) {
  const targeting = state.run?.ability?.targeting;
  if (!targeting) return null;
  return {
    title: targeting.title || '',
    prompt: targeting.prompt || '',
    count: targeting.count || 1,
    validIds: new Set(targeting.validCardIds || []),
    picked: [...(targeting.pickedCardIds || [])],
  };
}

export function scorePreview(state) {
  const before = scorePlacedCards(state, { skipFlatBonuses: true });
  const after = scoreIfSelectedPlaced(state, { skipFlatBonuses: true });
  const card = selectedCard(state);
  if (!after || !card) return null;

  const beforeNames = new Set(before.melds.map(meld => meld.name));
  const newMelds = after.melds.filter(meld => !beforeNames.has(meld.name));

  return {
    card,
    before,
    after,
    delta: after.finalScore - before.finalScore,
    newMelds,
  };
}

// ── Archive selectors (Phase 14) ──

export function unlockedFragmentIds(state) {
  return state.persist.unlockedFragments || [];
}

export function discoveredArchiveItemIds(state) {
  return state.persist.discoveredArchiveItems || [];
}

export function unlockedFragments(state) {
  return unlockedFragmentIds(state)
    .map(id => ARCHIVE_FRAGMENTS[id])
    .filter(Boolean);
}

// Everything that renders in the Archives drawer: discovered attic items
// first, then unlocked fragments.
export function archiveEntries(state) {
  const discovered = new Set(discoveredArchiveItemIds(state));
  return [
    ...ARCHIVE_ITEMS.filter(item => discovered.has(item.id)),
    ...unlockedFragments(state),
  ];
}

export function obals(state) {
  return state.persist.obals || 0;
}

export function publicRunSnapshot(state) {
  return {
    phase: state.run.phase,
    reading: state.run.reading,
    threshold: thresholdValue(state),
    reserve: state.persist.reserve,
    totalScore: state.persist.totalScore,
    handCount: state.run.hand.length,
    deckCount: state.run.deck.length,
    discardCount: state.run.discard.length,
    spreadCount: placedCards(state).length,
    discards: state.run.discards,
    setIndex: state.run.setIndex,
    setsPerRound: state.run.setsPerRound,
    roundScore: state.run.roundScore,
    constellationId: state.run.constellationId,
    canDiscard: canDiscardSelected(state),
    canScore: canScoreReading(state),
  };
}
