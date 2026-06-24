// Adventure Mode — hidden interpretation data.
//
// These values are NEVER shown to the player. They exist only to bias which
// event outcome is selected after a successful reading. The design intent is
// that players form *intuitions* ("the Moon tends to lead somewhere strange")
// rather than solving a visible stat check.
//
// This file is pure data. Tuning these numbers changes game feel without
// touching any system code.

/**
 * The ten hidden meaning axes a spread can express.
 * @typedef {('courage'|'fear'|'curiosity'|'compassion'|'authority'|'violence'|'persistence'|'change'|'intuition'|'secrets')} MeaningTag
 */
export const MEANING_TAGS = Object.freeze([
  'courage',
  'fear',
  'curiosity',
  'compassion',
  'authority',
  'violence',
  'persistence',
  'change',
  'intuition',
  'secrets',
]);

// Tags that read as "supernatural" — used by the Haunted status to amplify
// eerie outcomes.
export const SUPERNATURAL_TAGS = Object.freeze(['fear', 'secrets', 'intuition', 'change']);

// Bespoke per-card meanings, keyed by card id (see src/data/cards.mjs).
// Not every card needs an entry; cards without one still receive suit/court
// defaults. The full Major Arcana is authored here because the majors carry
// most of the narrative personality.
export const CARD_MEANINGS = Object.freeze({
  major_0: { curiosity: 2, courage: 1, change: 1 }, // Fool — beginnings, naivety
  major_1: { authority: 2, secrets: 1, change: 1 }, // Magician — will, manipulation
  major_2: { intuition: 3, secrets: 2 }, // High Priestess — mystery
  major_3: { compassion: 2, persistence: 1 }, // Empress — nurture
  major_4: { authority: 3, persistence: 1 }, // Emperor — structure
  major_5: { authority: 2, persistence: 1 }, // Hierophant — doctrine
  major_6: { compassion: 2, change: 1 }, // Lovers — union, choice
  major_7: { courage: 2, persistence: 2 }, // Chariot — resolve
  major_8: { courage: 3, persistence: 2 }, // Strength — courage, patience
  major_9: { intuition: 2, secrets: 1, persistence: 1 }, // Hermit — solitude, search
  major_10: { change: 3 }, // Wheel — cycles, fortune
  major_11: { authority: 2, persistence: 1 }, // Justice — truth, fairness
  major_12: { intuition: 2, change: 1, persistence: 1 }, // Hanged Man — surrender
  major_13: { change: 3, fear: 1 }, // Death — transformation
  major_14: { persistence: 2, compassion: 1, intuition: 1 }, // Temperance — balance
  major_15: { violence: 2, secrets: 2, fear: 1 }, // Devil — bondage
  major_16: { violence: 3, change: 3 }, // Tower — upheaval, ruin
  major_17: { compassion: 2, intuition: 1, change: 1 }, // Star — hope, renewal
  major_18: { fear: 2, intuition: 2, secrets: 2 }, // Moon — illusion, fear
  major_19: { courage: 2, compassion: 1 }, // Sun — joy, vitality
  major_20: { change: 2, authority: 1, intuition: 1 }, // Judgement — awakening
  major_21: { persistence: 2, change: 1, authority: 1 }, // World — completion
});

// Hidden suit defaults applied to every minor (court) card of that suit.
export const SUIT_MEANINGS = Object.freeze({
  Swords: { violence: 1, courage: 1 },
  Wands: { courage: 1, change: 1 },
  Cups: { compassion: 1, intuition: 1 },
  Pentacles: { persistence: 1, authority: 1 },
});

// Hidden court defaults applied by rank.
export const COURT_MEANINGS = Object.freeze({
  Page: { curiosity: 1 },
  Knight: { courage: 1 },
  Queen: { compassion: 1 },
  King: { authority: 1 },
});

/** A zeroed meaning record with every tag present. */
export function emptyMeanings() {
  const out = {};
  for (const tag of MEANING_TAGS) out[tag] = 0;
  return out;
}
