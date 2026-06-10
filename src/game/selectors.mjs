import { computeScore } from '../systems/scoring.mjs';
import { currentThreshold } from '../data/thresholds.mjs';
import { getCardHints, getHandHints } from '../systems/hints.mjs';

export function placedCards(state) {
  return state.run.spread.filter(Boolean);
}

export function selectedCard(state) {
  if (state.run.selectedCardId == null) return null;
  return state.run.hand.find(card => card.uid === state.run.selectedCardId) || null;
}

export function thresholdValue(state) {
  return currentThreshold(state.run.thresholdIndex, state.run.thresholdBonus);
}

export function scoringContext(state) {
  return {
    handCount: state.run.hand.length,
    discardedCount: state.run.discardedCards.length,
    discardedCards: state.run.discardedCards,
    abilityTakenCardIds: state.run.abilityTakenCardIds,
    resonationBonus: state.run.resonationBonus,
    worldCarry: state.run.worldCarry,
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
  return Boolean(selectedCard(state)) && state.run.discards > 0 && !state.run.busy && !state.run.ability && !state.run.purge;
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
    canDiscard: canDiscardSelected(state),
    canScore: canScoreReading(state),
  };
}
