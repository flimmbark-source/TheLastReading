import { RANKS, SUITS } from '../data/cards.mjs';
import { DEFAULT_UPGRADES, SCORING_PATTERNS, upgradedChips, upgradedMult } from '../data/scoringPatterns.mjs';
import { applyRelicMeldsToScore, getScoringRelicMelds } from './relics.mjs';

function addChipMeld(result, name, chips) {
  if (!chips) return;
  result.melds.push({ name, chips, mult: 0, mode: 'chips' });
  result.chips += chips;
}

function addAdditiveMultMeld(result, name, mult) {
  if (!mult) return;
  const rounded = Number(mult.toFixed(2));
  result.melds.push({ name, chips: 0, mult: rounded, mode: 'add' });
  result.mult += rounded;
}

function addPatternMeld(result, name, chips, patternMult) {
  result.melds.push({ name, chips, mult: patternMult, mode: 'pattern' });
  result.chips += chips;
  result.mult += patternMult - 1;
}

function courtCards(cards) {
  return cards.filter(card => card.type === 'court');
}

function majorCards(cards) {
  return cards.filter(card => card.type === 'major');
}

function applyFlatUpgradeBonuses(result, cards, upgrades, context) {
  const minorCards = cards.filter(card => card.type !== 'major');
  const majors = majorCards(cards);

  addChipMeld(result, 'Omen', (upgrades.omen || 0) * cards.length);
  addChipMeld(result, 'Resonance', (upgrades.resonance || 0) * 3 * majors.length);

  addChipMeld(result, 'Minor Arcana', (upgrades.minor_chips || 0) * minorCards.length);
  addChipMeld(result, 'Major Arcana', (upgrades.major_chips || 0) * 2 * majors.length);

  for (const suit of SUITS) {
    addChipMeld(result, suit, (upgrades[`${suit.toLowerCase()}_chips`] || 0) * cards.filter(card => card.suit === suit).length);
  }

  addChipMeld(result, 'First Light', (upgrades.first_light || 0) * 3);
  addChipMeld(result, 'Deep Reserve', (context.handCount || 0) * (upgrades.deep_reserve || 0) * 2);
  addChipMeld(result, 'Quick Release', (context.discardedCount || 0) * (upgrades.quick_release || 0) * 3);

  addAdditiveMultMeld(result, 'Ritual Mult', (upgrades.flat_mult || 0) * 0.25);
  addAdditiveMultMeld(result, 'Blessed Start', (upgrades.blessed_start || 0) * 0.25);
  addAdditiveMultMeld(result, 'Major Arcana Mult', majors.length * (upgrades.major_mult || 0) * 0.10);
  addAdditiveMultMeld(result, 'Minor Arcana Mult', minorCards.length * (upgrades.minor_mult || 0) * 0.05);
  addAdditiveMultMeld(result, 'Court Mult', courtCards(cards).length * (upgrades.court_mult_base || 0) * 0.10);

  for (const suit of SUITS) {
    addAdditiveMultMeld(result, `${suit} Mult`, cards.filter(card => card.suit === suit).length * (upgrades[`${suit.toLowerCase()}_mult`] || 0) * 0.05);
  }
}

function applyRankPatterns(result, cards, upgrades) {
  const three = SCORING_PATTERNS.THREE_OF_A_KIND;
  const four = SCORING_PATTERNS.FOUR_OF_A_KIND;

  for (const rank of RANKS) {
    const count = cards.filter(card => card.type === 'court' && card.rank === rank).length;
    if (count >= 3) addPatternMeld(result, `Three of a Kind (${rank}s)`, upgradedChips(three, upgrades), upgradedMult(three, upgrades));
    if (count >= 4) addPatternMeld(result, `Four of a Kind (${rank}s)`, upgradedChips(four, upgrades), upgradedMult(four, upgrades));
  }
}

function applyCourtPatterns(result, cards, upgrades) {
  const courts = courtCards(cards);
  const distinctRanks = new Set(courts.map(card => card.rank)).size;
  let royalSuit = null;
  let royalCount = 0;

  if (distinctRanks >= 3) {
    for (const suit of SUITS) {
      const ranksInSuit = new Set(courts.filter(card => card.suit === suit).map(card => card.rank));
      if (ranksInSuit.size >= 3) {
        royalSuit = suit;
        royalCount = ranksInSuit.size;
        break;
      }
    }
  }

  const full = SCORING_PATTERNS.FULL_COURT;
  const royal = SCORING_PATTERNS.ROYAL_COURT;

  if (royalSuit) {
    for (let tier = 3; tier <= Math.min(4, royalCount); tier += 1) {
      addPatternMeld(result, `Royal Court (${tier}, ${royalSuit})`, upgradedChips(royal, upgrades), upgradedMult(royal, upgrades));
    }
    return;
  }

  if (distinctRanks >= 3) {
    for (let tier = 3; tier <= Math.min(4, distinctRanks); tier += 1) {
      addPatternMeld(result, `Full Court (${tier})`, upgradedChips(full, upgrades), upgradedMult(full, upgrades));
    }
  }
}

export function bestMajorRunLength(cards) {
  const nums = [...new Set(majorCards(cards).map(card => card.number))].sort((a, b) => a - b);
  let best = nums.length ? 1 : 0;
  let current = nums.length ? 1 : 0;

  for (let i = 1; i < nums.length; i += 1) {
    if (nums[i] === nums[i - 1] + 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function applyMajorPatterns(result, cards, upgrades) {
  const sequence = SCORING_PATTERNS.SEQUENCE;
  const path = SCORING_PATTERNS.PATH_OF_THE_MAGI;
  const bestRun = bestMajorRunLength(cards);

  if (bestRun >= 3) {
    for (let tier = 3; tier <= bestRun; tier += 1) {
      addPatternMeld(result, `Sequence of ${tier}`, upgradedChips(sequence, upgrades), upgradedMult(sequence, upgrades));
    }
  }

  if (path.requiredCardIds.every(id => cards.some(card => card.id === id))) {
    addPatternMeld(result, path.label, upgradedChips(path, upgrades), upgradedMult(path, upgrades));
  }
}

function applySpecialUpgradePatterns(result, cards, upgrades) {
  if (upgrades.balanced_reading) {
    const hasMajor = cards.some(card => card.type === 'major');
    const hasMinor = cards.some(card => card.type !== 'major');
    if (hasMajor && hasMinor) {
      const chips = upgrades.balanced_reading * 5;
      const mult = 1.25 + (upgrades.balanced_reading_mult || 0) * 0.25;
      addPatternMeld(result, 'Balanced Reading', chips, mult);
    }
  }

  if (upgrades.elemental_harmony) {
    const suitCount = new Set(cards.filter(card => card.type !== 'major').map(card => card.suit)).size;
    if (suitCount >= 4) {
      const chips = upgrades.elemental_harmony * 10;
      const mult = 1.25 + (upgrades.elemental_harmony_mult || 0) * 0.5;
      addPatternMeld(result, 'Elemental Harmony', chips, mult);
    }
  }
}

export function computeScore(cards, options = {}) {
  const upgrades = { ...DEFAULT_UPGRADES, ...(options.upgrades || {}) };
  const context = options.context || {};
  const result = {
    baseChips: cards.reduce((sum, card) => sum + card.points, 0),
    chips: cards.reduce((sum, card) => sum + card.points, 0),
    mult: 1,
    melds: [],
    finalScore: 0,
  };

  if (!options.skipFlatBonuses) applyFlatUpgradeBonuses(result, cards, upgrades, context);
  applyRankPatterns(result, cards, upgrades);
  applyCourtPatterns(result, cards, upgrades);
  applyMajorPatterns(result, cards, upgrades);
  applySpecialUpgradePatterns(result, cards, upgrades);
  if (!options.skipRelics) applyRelicMeldsToScore(result, getScoringRelicMelds(cards, options.relics || [], context));

  result.finalScore = Math.floor(result.chips * result.mult);
  return result;
}
