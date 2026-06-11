import { SCORING_PATTERNS } from '../data/scoringPatterns.mjs';
import { computeScore } from './scoring.mjs';
import { uniqueCards } from './deck.mjs';

export const HINT_LEVELS = Object.freeze({
  NEAR: 'near',
  COMPLETE: 'complete',
});

export const HINT_GROUPS = Object.freeze({
  MAJOR: 'major',
  SUIT: 'suit',
  RANK: 'rank',
  COURT: 'court',
  GOLD: 'gold',
});

export function normalizeMeldName(name) {
  if (name.startsWith('Sequence')) return SCORING_PATTERNS.SEQUENCE.label;
  if (name.startsWith('Royal Court')) return SCORING_PATTERNS.ROYAL_COURT.label;
  if (name.startsWith('Full Court')) return SCORING_PATTERNS.FULL_COURT.label;
  if (name.startsWith('Three of a Kind')) return SCORING_PATTERNS.THREE_OF_A_KIND.label;
  if (name.startsWith('Four of a Kind')) return SCORING_PATTERNS.FOUR_OF_A_KIND.label;
  return name;
}

export function hintGroup(label) {
  if (label === SCORING_PATTERNS.SEQUENCE.label || label === SCORING_PATTERNS.PATH_OF_THE_MAGI.label) return HINT_GROUPS.MAJOR;
  if (label === SCORING_PATTERNS.ROYAL_COURT.label) return HINT_GROUPS.SUIT;
  if (label === SCORING_PATTERNS.THREE_OF_A_KIND.label || label === SCORING_PATTERNS.FOUR_OF_A_KIND.label) return HINT_GROUPS.RANK;
  if (label === SCORING_PATTERNS.FULL_COURT.label) return HINT_GROUPS.COURT;
  return HINT_GROUPS.GOLD;
}

export function sequenceRunKey(number, cards) {
  const nums = new Set(cards.filter(card => card.type === 'major').map(card => card.number));
  let start = number;
  while (nums.has(start - 1)) start -= 1;
  return `seq:${start}`;
}

function extractColorKeyFromMeld(label, rawName, card, placedCards) {
  if (label === SCORING_PATTERNS.SEQUENCE.label && card.type === 'major') return sequenceRunKey(card.number, placedCards);
  if (label === SCORING_PATTERNS.ROYAL_COURT.label) {
    const match = rawName.match(/\((?:\d+,\s*)?(\w+)\)/);
    return match ? `flush:${match[1]}` : null;
  }
  if (label === SCORING_PATTERNS.THREE_OF_A_KIND.label || label === SCORING_PATTERNS.FOUR_OF_A_KIND.label) {
    const match = rawName.match(/\((\w+)s\)/);
    return match ? `rank:${match[1]}` : null;
  }
  return null;
}

function addHint(hints, seen, level, label, colorKey = null) {
  const key = `${level}:${label}:${colorKey || ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  hints.push({
    level,
    label,
    group: hintGroup(label),
    colorKey,
  });
}

function addCompletionHints({ hints, seen, card, spreadCards, scoringOptions }) {
  const placedCards = [...spreadCards, card];
  const before = new Set(computeScore(spreadCards, scoringOptions).melds.map(meld => meld.name));
  const after = computeScore(placedCards, scoringOptions);

  for (const meld of after.melds) {
    if (before.has(meld.name)) continue;
    const label = normalizeMeldName(meld.name);
    addHint(hints, seen, HINT_LEVELS.COMPLETE, label, extractColorKeyFromMeld(label, meld.name, card, placedCards));
  }
}

function addNearMajorHints({ hints, seen, card, allCards }) {
  if (card.type !== 'major') return;
  const otherMajorNumbers = new Set(allCards.filter(other => other.type === 'major' && other.uid !== card.uid).map(other => other.number));
  if (otherMajorNumbers.has(card.number - 1) || otherMajorNumbers.has(card.number + 1)) {
    addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.SEQUENCE.label, sequenceRunKey(card.number, allCards));
  }

  if (SCORING_PATTERNS.PATH_OF_THE_MAGI.requiredCardIds.includes(card.id)) {
    const pathIds = new Set(allCards.filter(other => SCORING_PATTERNS.PATH_OF_THE_MAGI.requiredCardIds.includes(other.id)).map(other => other.id));
    if (pathIds.size >= 2) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.PATH_OF_THE_MAGI.label);
  }
}

function addNearCourtHints({ hints, seen, card, allCards }) {
  if (card.type !== 'court') return;

  const sameRank = allCards.filter(other => other.type === 'court' && other.rank === card.rank);
  if (sameRank.length >= 4) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.FOUR_OF_A_KIND.label, `rank:${card.rank}`);
  else if (sameRank.length >= 2) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.THREE_OF_A_KIND.label, `rank:${card.rank}`);

  const sameSuitRanks = new Set(allCards.filter(other => other.type === 'court' && other.suit === card.suit).map(other => other.rank));
  if (sameSuitRanks.size >= 3) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.ROYAL_COURT.label, `flush:${card.suit}`);

  const ranks = new Set(allCards.filter(other => other.type === 'court').map(other => other.rank));
  if (ranks.size >= 3) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.FULL_COURT.label);
}

export function getCardHints(card, state, options = {}) {
  const spreadCards = (state.spread || []).filter(Boolean);
  const poolCards = options.poolCards || uniqueCards([...spreadCards, ...(state.hand || []), card]);
  const allCards = uniqueCards([...poolCards, card]);
  const hints = [];
  const seen = new Set();
  const scoringOptions = {
    upgrades: options.upgrades || {},
    relics: options.includeRelics ? options.relics || [] : [],
    skipRelics: !options.includeRelics,
    skipFlatBonuses: true,
  };

  if (options.patterns !== false) {
    addCompletionHints({ hints, seen, card, spreadCards, scoringOptions });
    addNearMajorHints({ hints, seen, card, allCards });
    addNearCourtHints({ hints, seen, card, allCards });
  }

  return hints;
}

export function getHandHints(state, options = {}) {
  const result = new Map();
  for (const card of state.hand || []) {
    result.set(card.uid, getCardHints(card, state, options));
  }
  return result;
}

export function hintLabel(hints) {
  return hints.map(hint => hint.label).join(' + ');
}
