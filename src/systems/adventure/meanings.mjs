// Adventure Mode — hidden meaning calculation.
//
// Pure functions. Given a spread (the same card objects Score Mode uses) and
// the run's active statuses, produce the hidden meaning record that biases
// event outcomes. Nothing here is ever shown to the player except through the
// developer debug panel.

import {
  MEANING_TAGS,
  CARD_MEANINGS,
  SUIT_MEANINGS,
  COURT_MEANINGS,
  emptyMeanings,
} from '../../data/adventure/interpretations.mjs';
import { getStatus } from '../../data/adventure/statuses.mjs';

function addInto(target, contribution) {
  if (!contribution) return target;
  for (const tag of Object.keys(contribution)) {
    if (!(tag in target)) continue; // ignore unknown tags defensively
    target[tag] += contribution[tag];
  }
  return target;
}

// The meanings contributed by a single card, before status modification.
export function cardMeanings(card) {
  const out = emptyMeanings();
  if (!card) return out;
  addInto(out, CARD_MEANINGS[card.id]); // 1. bespoke
  if (card.suit) addInto(out, SUIT_MEANINGS[card.suit]); // 2. suit (minors)
  if (card.rank) addInto(out, COURT_MEANINGS[card.rank]); // 3. court
  return out;
}

/**
 * Calculate the hidden meanings for a spread.
 * @param {Array} spread  card objects (may contain null placeholder slots)
 * @param {string[]} statuses  active StatusIds
 * @returns {Record<string, number>}
 */
export function calculateSpreadMeanings(spread = [], statuses = []) {
  const total = emptyMeanings();
  for (const card of spread) {
    if (!card) continue;
    addInto(total, cardMeanings(card));
  }
  // 4. status modifications (Haunted etc.) run after raw accumulation.
  const cards = spread.filter(Boolean);
  for (const id of statuses) {
    const status = getStatus(id);
    if (status && typeof status.modifyMeanings === 'function') {
      status.modifyMeanings(total, cards);
    }
  }
  return total;
}

/** Sum a list of meaning tags out of a meaning record. */
export function sumMeanings(meanings, tags = []) {
  return tags.reduce((acc, tag) => acc + (meanings[tag] || 0), 0);
}

/** The single strongest meaning (ties broken by MEANING_TAGS order). */
export function dominantMeaning(meanings) {
  let best = null;
  let bestValue = -Infinity;
  for (const tag of MEANING_TAGS) {
    const value = meanings[tag] || 0;
    if (value > bestValue) {
      best = tag;
      bestValue = value;
    }
  }
  return bestValue > 0 ? best : null;
}

/** Meanings sorted strongest-first, dropping zeros. For the boss tracker. */
export function rankedMeanings(meanings) {
  return MEANING_TAGS.filter(tag => (meanings[tag] || 0) > 0).sort(
    (a, b) => (meanings[b] || 0) - (meanings[a] || 0),
  );
}
