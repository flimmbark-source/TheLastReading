export const SETS_PER_ROUND = 2;
export const ZODIAC_SPRITE = './assets/Star_signs.png';

const EFFECTS = Object.freeze({
  BLOCK_EARLY_DISCARD: 'block_early_discard',
  UNTARGETABLE_FIRST: 'untargetable_first',
  ASHEN_HAND: 'ashen_hand',
  HUNGRY_THRESHOLD: 'hungry_threshold',
  NARROW_GATE: 'narrow_gate',
});

export const NO_CONSTELLATION = Object.freeze({
  id: null,
  name: '',
  label: '',
  effect: '',
  shortRule: '',
  rule: '',
});

const ZODIAC_SIGNS = [
  ['closed_palm', 'Aries', 0, 0, EFFECTS.BLOCK_EARLY_DISCARD, 'Place 2 cards before discarding.', 'You may not discard until at least 2 cards are placed each Set.'],
  ['unasked_question', 'Taurus', 1, 0, EFFECTS.UNTARGETABLE_FIRST, 'First placed card cannot be targeted.', 'The first card placed each Set cannot be targeted by abilities or effects this Round.'],
  ['ashen_hand', 'Gemini', 2, 0, EFFECTS.ASHEN_HAND, 'Ability-taken cards lose base points.', 'Cards taken by abilities score no base points, but still count for patterns.'],
  ['hungry_threshold', 'Cancer', 3, 0, EFFECTS.HUNGRY_THRESHOLD, 'Each discard raises the Threshold by 5.', 'The Round Threshold rises by 5 each time you discard.'],
  ['narrow_gate', 'Leo', 0, 1, EFFECTS.NARROW_GATE, 'Clear requires at least one pattern.', 'The Round cannot be cleared unless at least one Set forms a scoring pattern.'],
  ['virgo', 'Virgo', 1, 1, EFFECTS.BLOCK_EARLY_DISCARD, 'Place 2 cards before discarding.', 'You may not discard until at least 2 cards are placed each Set.'],
  ['libra', 'Libra', 2, 1, EFFECTS.UNTARGETABLE_FIRST, 'First placed card cannot be targeted.', 'The first card placed each Set cannot be targeted by abilities or effects this Round.'],
  ['scorpio', 'Scorpio', 3, 1, EFFECTS.ASHEN_HAND, 'Ability-taken cards lose base points.', 'Cards taken by abilities score no base points, but still count for patterns.'],
  ['sagittarius', 'Sagittarius', 0, 2, EFFECTS.HUNGRY_THRESHOLD, 'Each discard raises the Threshold by 5.', 'The Round Threshold rises by 5 each time you discard.'],
  ['capricorn', 'Capricorn', 1, 2, EFFECTS.NARROW_GATE, 'Clear requires at least one pattern.', 'The Round cannot be cleared unless at least one Set forms a scoring pattern.'],
  ['aquarius', 'Aquarius', 2, 2, EFFECTS.BLOCK_EARLY_DISCARD, 'Place 2 cards before discarding.', 'You may not discard until at least 2 cards are placed each Set.'],
  ['pisces', 'Pisces', 3, 2, EFFECTS.UNTARGETABLE_FIRST, 'First placed card cannot be targeted.', 'The first card placed each Set cannot be targeted by abilities or effects this Round.'],
];

export const CONSTELLATIONS = Object.freeze(
  ZODIAC_SIGNS.map(([id, label, col, row, effect, shortRule, rule]) => Object.freeze({
    id,
    name: label,
    label,
    effect,
    sprite: { image: ZODIAC_SPRITE, col, row, cols: 4, rows: 3 },
    shortRule,
    rule,
  }))
);

export const CONSTELLATION_BY_ID = Object.freeze(
  Object.fromEntries(CONSTELLATIONS.map(constellation => [constellation.id, constellation]))
);

export function getConstellation(id) {
  return CONSTELLATION_BY_ID[id] || null;
}

export function constellationForRound(roundIndex = 0, rng = null) {
  if (roundIndex <= 0) return NO_CONSTELLATION;
  if (rng) return CONSTELLATIONS[Math.floor(rng() * CONSTELLATIONS.length)];
  const shiftedIndex = roundIndex - 1;
  const index = ((shiftedIndex % CONSTELLATIONS.length) + CONSTELLATIONS.length) % CONSTELLATIONS.length;
  return CONSTELLATIONS[index];
}
