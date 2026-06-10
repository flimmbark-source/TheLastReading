import { RELICS } from '../data/relics.mjs';

function majorCards(cards) {
  return cards.filter(card => card.type === 'major');
}

function courtCards(cards) {
  return cards.filter(card => card.type === 'court');
}

function hasRelic(relics, id) {
  return new Set(relics || []).has(id);
}

function chipMeld(name, chips) {
  if (!chips) return null;
  return { name, chips, mult: 0, mode: 'chips' };
}

function additiveMultMeld(name, mult) {
  if (!mult) return null;
  return { name, chips: 0, mult: Number(mult.toFixed(2)), mode: 'add' };
}

function matchingPairCount(cards) {
  const counts = new Map();
  for (const card of cards) {
    const key = card.rank || String(card.number);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].reduce((sum, count) => sum + Math.floor(count / 2), 0);
}

export function getScoringRelicMelds(cards, relics = [], context = {}) {
  const melds = [];

  if (hasRelic(relics, RELICS.gilded_fool.id) && cards.length) {
    melds.push(chipMeld(RELICS.gilded_fool.name, 10));
  }

  if (hasRelic(relics, RELICS.hermit_lantern.id)) {
    melds.push(additiveMultMeld(RELICS.hermit_lantern.name, majorCards(cards).length * 0.25));
  }

  if (hasRelic(relics, RELICS.mirror_shard.id)) {
    melds.push(additiveMultMeld(RELICS.mirror_shard.name, matchingPairCount(cards)));
  }

  if (hasRelic(relics, RELICS.still_pool.id) && !(context.discardedCount || 0)) {
    melds.push(additiveMultMeld(RELICS.still_pool.name, 1));
  }

  if (hasRelic(relics, RELICS.loaded_die.id)) {
    melds.push(chipMeld(RELICS.loaded_die.name, courtCards(cards).reduce((sum, card) => sum + card.points, 0)));
  }

  return melds.filter(Boolean);
}

export function applyRelicMeldsToScore(result, relicMelds) {
  for (const meld of relicMelds) {
    result.melds.push(meld);
    result.chips += meld.chips || 0;
    if (meld.mode === 'add') result.mult += meld.mult || 0;
    else if (meld.mult) result.mult += meld.mult - 1;
  }
  return result;
}

export function marketCostAfterRelics(cost, relics = []) {
  let nextCost = cost;
  if (hasRelic(relics, RELICS.merchant_scale.id)) nextCost -= 3;
  return Math.max(0, nextCost);
}

export function startingHandBonusFromRelics(relics = []) {
  return hasRelic(relics, RELICS.threadbare_tarot.id) ? 1 : 0;
}

export function firstDiscardIsFree(relics = []) {
  return hasRelic(relics, RELICS.gilded_discard.id);
}
