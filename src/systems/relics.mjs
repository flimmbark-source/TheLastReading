import { RELICS } from '../data/relics.mjs';

function majorCards(cards) {
  return cards.filter(card => card.type === 'major');
}

function courtCards(cards) {
  return cards.filter(card => card.type === 'court');
}

export function hasRelic(relics, id) {
  return new Set(relics || []).has(id);
}

function chipMeld(name, chips) {
  if (!chips) return null;
  return { name, chips, mult: 0, mode: 'chips', source: 'relic' };
}

function additiveMultMeld(name, mult) {
  if (!mult) return null;
  return { name, chips: 0, mult: Number(mult.toFixed(2)), mode: 'add', source: 'relic' };
}

function matchingPairCount(cards) {
  const counts = new Map();
  for (const card of cards) {
    const key = card.rank || String(card.number ?? card.num);
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
    melds.push(additiveMultMeld(RELICS.mirror_shard.name, matchingPairCount(courtCards(cards)) * 0.5));
  }

  if (hasRelic(relics, RELICS.still_pool.id) && !(context.discardedCount || 0)) {
    melds.push(additiveMultMeld(RELICS.still_pool.name, 0.75));
  }

  if (hasRelic(relics, RELICS.loaded_die.id)) {
    melds.push(chipMeld(RELICS.loaded_die.name, courtCards(cards).reduce((sum, card) => sum + card.points, 0)));
  }

  if (hasRelic(relics, RELICS.court_favor.id)) {
    melds.push(additiveMultMeld(RELICS.court_favor.name, courtCards(cards).length * 0.25));
  }

  if (hasRelic(relics, RELICS.arcana_codex.id)) {
    const upgrades = context.upgrades || {};
    const owned = SCORING_UPGRADE_GROUPS.filter(group => group.some(key => (upgrades[key] || 0) > 0)).length;
    melds.push(additiveMultMeld(RELICS.arcana_codex.name, Number((owned * 0.1).toFixed(2))));
  }

  if (hasRelic(relics, RELICS.hanged_coin.id) && (context.discardedCards || []).length) {
    const bonus = context.discardedCards.reduce((sum, card) => sum + card.points, 0);
    melds.push(chipMeld(RELICS.hanged_coin.name, bonus));
  }

  if (hasRelic(relics, RELICS.lovers_knot.id)) {
    const counts = new Map();
    for (const card of courtCards(cards)) {
      counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
    }
    const groups = [...counts.values()].filter(count => count >= 3).length;
    melds.push(additiveMultMeld(RELICS.lovers_knot.name, groups));
  }

  if (hasRelic(relics, RELICS.temperance_flask.id) && (context.discardedCount || 0) === 1) {
    melds.push(additiveMultMeld(RELICS.temperance_flask.name, 1));
  }

  if (hasRelic(relics, RELICS.strengths_grip.id) && courtCards(cards).length === 3) {
    melds.push(additiveMultMeld(RELICS.strengths_grip.name, 1));
  }

  if (hasRelic(relics, RELICS.fool_reversed.id)) {
    melds.push(chipMeld(RELICS.fool_reversed.name, cards.length * 3));
  }

  if (hasRelic(relics, RELICS.the_world.id) && (context.worldCarry || 0)) {
    melds.push(chipMeld(RELICS.the_world.name, context.worldCarry));
  }

  // The mult built up in earlier Sets of this round carries forward.
  if (hasRelic(relics, RELICS.endless_thread.id) && (context.carriedMult || 0) > 0) {
    melds.push(additiveMultMeld(RELICS.endless_thread.name, Number((context.carriedMult || 0).toFixed(2))));
  }

  return melds.filter(Boolean);
}

// Logical scoring upgrades. Paired Chip/Mult keys count once for Arcana Codex,
// matching how the player sees a direct pattern purchase in the market.
const SCORING_UPGRADE_GROUPS = [
  ['rank', 'rank_mult'],
  ['sequence', 'seq_mult'],
  ['court_chips', 'court_mult'],
  ['royal_court_chips', 'royal_court_mult'],
  ['path_chips', 'path_mult'],
  ['balanced_reading', 'balanced_reading_mult'],
  ['elemental_harmony', 'elemental_harmony_mult'],
  ['omen'], ['resonance'], ['minor_chips'], ['major_chips'], ['number_chips'],
  ['cups_chips'], ['wands_chips'], ['swords_chips'], ['pentacles_chips'],
  ['flat_mult'], ['major_mult'], ['minor_mult'], ['court_mult_base'],
  ['cups_mult'], ['wands_mult'], ['swords_mult'], ['pentacles_mult'],
];

export function thresholdClearBonusFromRelics(relics = []) {
  return hasRelic(relics, RELICS.miser.id) ? 5 : 0;
}

export function worldCarryFromRelics(relics = [], finalScore = 0, threshold = 0) {
  if (!hasRelic(relics, RELICS.the_world.id)) return 0;
  return Math.floor((finalScore - threshold) * 0.1);
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
  if (hasRelic(relics, RELICS.merchants_scale.id)) nextCost -= 3;
  return Math.max(0, nextCost);
}

export function startingHandBonusFromRelics(relics = []) {
  return hasRelic(relics, RELICS.threadbare_tarot.id) ? 1 : 0;
}

export function firstDiscardIsFree(relics = []) {
  return hasRelic(relics, RELICS.gilded_discard.id);
}
