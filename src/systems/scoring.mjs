import { RANKS, SUITS } from '../data/cards.mjs';
import { DEFAULT_UPGRADES, SCORING_PATTERNS, upgradedChips, upgradedMult } from '../data/scoringPatterns.mjs';
import { applyRelicMeldsToScore, getScoringRelicMelds } from './relics.mjs';
import { getConstellation } from '../data/constellations.mjs';

function addChipMeld(result, name, chips, source = 'upgrade') {
  if (!chips) return;
  result.melds.push({ name, chips, mult: 0, mode: 'chips', source });
  result.chips += chips;
}

function addAdditiveMultMeld(result, name, mult, source = 'upgrade') {
  if (!mult) return;
  const rounded = Number(mult.toFixed(2));
  result.melds.push({ name, chips: 0, mult: rounded, mode: 'add', source });
  result.mult += rounded;
}

function addPatternMeld(result, name, chips, patternMult, source = 'pattern') {
  result.melds.push({ name, chips, mult: patternMult, mode: 'pattern', source });
  result.chips += chips;
  result.mult += patternMult - 1;
}

// Balanced Reading and Elemental Harmony multiply the running mult instead of
// adding to it (matches the live game).
function addMultiplicativePatternMeld(result, name, chips, patternMult, source = 'pattern') {
  result.melds.push({ name, chips, mult: patternMult, mode: 'pattern', source });
  result.chips += chips;
  result.mult *= patternMult;
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

function applyConstellationScoreAdjustments(result, cards, context) {
  if (context.constellationId !== 'ashen_hand') return;
  const taken = new Set(context.abilityTakenCardIds || []);
  if (!taken.size) return;
  const lost = cards
    .filter(card => taken.has(card.uid))
    .reduce((sum, card) => sum + (card.points || 0), 0);
  if (!lost) return;
  result.baseChips -= lost;
  result.chips -= lost;
  // Label the penalty with the active constellation's name (e.g. "Gemini") so
  // players recognise it -- "The Ashen Hand" is the effect's internal name and
  // appears nowhere else in the UI.
  const constellationName = getConstellation(context.constellationId)?.name || 'Constellation';
  result.melds.push({ name: constellationName, chips: -lost, mult: 0, mode: 'chips', source: 'constellation' });
}

// A Major stamped with the Suit Stamp gains the suit(s) and rank shown in its
// own card art, so it plays as a wildcard court card for rank- and
// suit-based patterns below.
function stampedMajorsInPlay(cards, context = {}) {
  const stampedIds = new Set(context.stampedMajors || []);
  return majorCards(cards).filter(
    card => stampedIds.has(card.id) && Array.isArray(card.suits) && card.suits.length > 0 && card.rank
  );
}

function applyRankPatterns(result, cards, upgrades, context = {}) {
  const three = SCORING_PATTERNS.THREE_OF_A_KIND;
  const four = SCORING_PATTERNS.FOUR_OF_A_KIND;
  const rankable = [...courtCards(cards), ...stampedMajorsInPlay(cards, context)];

  for (const rank of RANKS) {
    const count = rankable.filter(card => card.rank === rank).length;
    if (count >= 3) addPatternMeld(result, `Three of a Kind (${rank}s)`, upgradedChips(three, upgrades), upgradedMult(three, upgrades));
    if (count >= 4) addPatternMeld(result, `Four of a Kind (${rank}s)`, upgradedChips(four, upgrades), upgradedMult(four, upgrades));
  }
}

function applyCourtPatterns(result, cards, upgrades, context = {}) {
  const courts = courtCards(cards);
  const stampedMajors = stampedMajorsInPlay(cards, context);
  const rankTokens = new Set(courts.map(card => card.rank));
  stampedMajors.forEach(card => rankTokens.add(card.rank));
  const distinctRanks = rankTokens.size;
  let royalSuit = null;
  let royalCount = 0;

  if (distinctRanks >= 3) {
    for (const suit of SUITS) {
      const tokensInSuit = new Set(courts.filter(card => card.suit === suit).map(card => card.rank));
      stampedMajors.filter(card => card.suits.includes(suit)).forEach(card => tokensInSuit.add(card.rank));
      if (tokensInSuit.size >= 3) {
        royalSuit = suit;
        royalCount = tokensInSuit.size;
        break;
      }
    }
  }

  const full = SCORING_PATTERNS.FULL_COURT;
  const royal = SCORING_PATTERNS.ROYAL_COURT;

  for (let tier = 3; tier <= 4; tier += 1) {
    if (royalSuit && royalCount >= tier) {
      addPatternMeld(result, `Royal Court (${tier}, ${royalSuit})`, upgradedChips(royal, upgrades), upgradedMult(royal, upgrades));
    } else if (distinctRanks >= tier) {
      addPatternMeld(result, `Full Court (${tier})`, upgradedChips(full, upgrades), upgradedMult(full, upgrades));
    }
  }
}

function calcRunLength(sortedNums) {
  if (!sortedNums.length) return 0;
  let best = 1, current = 1;
  for (let i = 1; i < sortedNums.length; i += 1) {
    if (sortedNums[i] === sortedNums[i - 1] + 1) { current += 1; best = Math.max(best, current); }
    else { current = 1; }
  }
  return best;
}

export function bestMajorRunLength(cards) {
  const nums = [...new Set(majorCards(cards).map(card => card.number ?? card.num))].sort((a, b) => a - b);
  return calcRunLength(nums);
}

// Five Star Stamp: each stamped card in the spread acts as a wildcard that
// can slot into a sequence as any multiple of 5 (5, 10, 15, 20).
// We try each candidate position and return the best possible run length.
function bestMajorRunLengthWithStamp(cards, stampedFiveIds) {
  const baseNums = [...new Set(majorCards(cards).map(card => card.number ?? card.num))].sort((a, b) => a - b);
  let best = calcRunLength(baseNums);
  const wildcards = cards.filter(card => stampedFiveIds.has(card.id)).length;
  if (!wildcards) return best;
  for (const candidate of [5, 10, 15, 20]) {
    if (baseNums.includes(candidate)) continue;
    const augmented = [...baseNums, candidate].sort((a, b) => a - b);
    best = Math.max(best, calcRunLength(augmented));
  }
  return best;
}

function applyMajorPatterns(result, cards, upgrades, context = {}) {
  const sequence = SCORING_PATTERNS.SEQUENCE;
  const path = SCORING_PATTERNS.PATH_OF_THE_MAGI;
  const stampedFive = new Set(context.stampedFive || []);
  const bestRun = stampedFive.size > 0
    ? bestMajorRunLengthWithStamp(cards, stampedFive)
    : bestMajorRunLength(cards);

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
      const mult = Number((1.25 + (upgrades.balanced_reading_mult || 0) * 0.25).toFixed(2));
      addMultiplicativePatternMeld(result, 'Balanced Reading', chips, mult, 'upgrade');
    }
  }

  if (upgrades.elemental_harmony) {
    const suitCount = new Set(cards.filter(card => card.type !== 'major').map(card => card.suit)).size;
    if (suitCount >= 4) {
      const chips = upgrades.elemental_harmony * 10;
      const mult = Number((1.25 + (upgrades.elemental_harmony_mult || 0) * 0.5).toFixed(2));
      addMultiplicativePatternMeld(result, 'Elemental Harmony', chips, mult, 'upgrade');
    }
  }
}

function applyContextBonuses(result, cards, upgrades, context) {
  // Chosen: cards taken into hand by abilities score bonus chips.
  if (upgrades.chosen) {
    const taken = new Set(context.abilityTakenCardIds || []);
    if (taken.size) {
      const count = cards.filter(card => taken.has(card.uid)).length;
      addChipMeld(result, 'Chosen', count * upgrades.chosen * 5);
    }
  }

  // Resonation bonuses accumulate during play and join the final score.
  const resonation = context.resonationBonus;
  if (resonation && (resonation.chips || resonation.mult)) {
    result.melds.push({ name: `⚷ ${resonation.name || 'Resonation'}`, chips: resonation.chips || 0, mult: resonation.mult || 0, mode: 'add', source: 'resonation' });
    result.chips += resonation.chips || 0;
    result.mult += resonation.mult || 0;
  }
}

export function computeScore(cards, options = {}) {
  const upgrades = { ...DEFAULT_UPGRADES, ...(options.upgrades || {}) };
  const context = options.context || {};
  const baseChips = cards.reduce((sum, card) => sum + card.points, 0);
  const result = {
    baseChips,
    chips: baseChips,
    mult: 1,
    melds: [],
    finalScore: 0,
  };

  applyConstellationScoreAdjustments(result, cards, context);
  if (!options.skipFlatBonuses) applyFlatUpgradeBonuses(result, cards, upgrades, context);
  applyRankPatterns(result, cards, upgrades, context);
  applyCourtPatterns(result, cards, upgrades, context);
  applyMajorPatterns(result, cards, upgrades, context);
  applySpecialUpgradePatterns(result, cards, upgrades);
  applyContextBonuses(result, cards, upgrades, context);
  if (!options.skipRelics) applyRelicMeldsToScore(result, getScoringRelicMelds(cards, options.relics || [], { ...context, upgrades }));

  result.finalScore = Math.floor(result.chips * result.mult);
  return result;
}
