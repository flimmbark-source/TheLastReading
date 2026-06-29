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

const PATH_OF_THE_MAGI_COLOR_KEY = 'path:magi';

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
  if (label === SCORING_PATTERNS.PATH_OF_THE_MAGI.label) return PATH_OF_THE_MAGI_COLOR_KEY;
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

function sameHintIdentity(hint, level, label, colorKey) {
  return hint.level === level && hint.label === label && (hint.colorKey || '') === (colorKey || '');
}

function addHint(hints, seen, level, label, colorKey = null) {
  const suffix = `${label}:${colorKey || ''}`;
  const key = `${level}:${suffix}`;

  // A card that completes a pattern should not also show the same pattern as
  // merely near. This was the source of text like "Path of the Magi + Path of
  // the Magi" when the selected/drawn card both belonged to and completed the
  // Path set.
  if (level === HINT_LEVELS.NEAR && seen.has(`${HINT_LEVELS.COMPLETE}:${suffix}`)) return;
  if (level === HINT_LEVELS.COMPLETE) {
    const nearKey = `${HINT_LEVELS.NEAR}:${suffix}`;
    if (seen.has(nearKey)) {
      seen.delete(nearKey);
      const index = hints.findIndex(hint => sameHintIdentity(hint, HINT_LEVELS.NEAR, label, colorKey));
      if (index >= 0) hints.splice(index, 1);
    }
  }

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
  const cardIsPlaced = spreadCards.some(placed => placed.uid === card.uid);

  // Hand card: compare the current spread against the spread with this card
  // added. Placed card: compare the spread without this card against the real
  // spread. This keeps every card that participates in a completed pattern
  // glowing after it crosses from the hand into a slot.
  const beforeCards = cardIsPlaced
    ? spreadCards.filter(placed => placed.uid !== card.uid)
    : spreadCards;
  const afterCards = cardIsPlaced
    ? spreadCards
    : uniqueCards([...spreadCards, card]);

  const before = new Set(computeScore(beforeCards, scoringOptions).melds.map(meld => meld.name));
  const after = computeScore(afterCards, scoringOptions);

  for (const meld of after.melds) {
    if (before.has(meld.name)) continue;
    const label = normalizeMeldName(meld.name);
    addHint(hints, seen, HINT_LEVELS.COMPLETE, label, extractColorKeyFromMeld(label, meld.name, card, afterCards));
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
    if (pathIds.size >= 2) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.PATH_OF_THE_MAGI.label, PATH_OF_THE_MAGI_COLOR_KEY);
  }
}

function addNearCourtHints({ hints, seen, card, allCards, stampedMajors = [] }) {
  const stampedIds = new Set(stampedMajors);
  const isStampedMajor = card.type === 'major' && stampedIds.has(card.id) && Array.isArray(card.suits) && card.suits.length > 0;

  if (card.type !== 'court' && !isStampedMajor) return;

  if (card.type === 'court') {
    const sameRank = allCards.filter(other => other.type === 'court' && other.rank === card.rank);
    if (sameRank.length >= 4) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.FOUR_OF_A_KIND.label, `rank:${card.rank}`);
    else if (sameRank.length >= 2) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.THREE_OF_A_KIND.label, `rank:${card.rank}`);
  }

  const cardSuits = card.type === 'court' ? [card.suit] : (card.suits || []);
  for (const suit of cardSuits) {
    const tokens = new Set(allCards.filter(other => other.type === 'court' && other.suit === suit).map(other => other.rank));
    allCards.filter(other => other.type === 'major' && stampedIds.has(other.id) && (other.suits || []).includes(suit)).forEach(other => tokens.add(other.id));
    if (tokens.size >= 2) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.ROYAL_COURT.label, `flush:${suit}`);
  }

  if (card.type === 'court') {
    const ranks = new Set(allCards.filter(other => other.type === 'court').map(other => other.rank));
    if (ranks.size >= 2) addHint(hints, seen, HINT_LEVELS.NEAR, SCORING_PATTERNS.FULL_COURT.label);
  }
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
    context: { stampedMajors: options.stampedMajors || [] },
  };

  if (options.patterns !== false) {
    addCompletionHints({ hints, seen, card, spreadCards, scoringOptions });
    addNearMajorHints({ hints, seen, card, allCards });
    addNearCourtHints({ hints, seen, card, allCards, stampedMajors: options.stampedMajors || [] });
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
  const labels = [];
  const seen = new Set();
  for (const hint of hints) {
    if (!seen.has(hint.label)) {
      seen.add(hint.label);
      labels.push(hint.label);
    }
  }
  return labels.join(' + ');
}