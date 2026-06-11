export const SETS_PER_ROUND = 2;

export const CONSTELLATIONS = Object.freeze([
  {
    id: 'closed_palm',
    name: 'The Closed Palm',
    label: 'Closed Palm',
    sigil: ['✦   ✦', '  ✋', '✦   ✦'],
    shortRule: 'Place 2 cards before discarding.',
    rule: 'You may not discard until at least 2 cards are placed each Set.',
  },
  {
    id: 'unasked_question',
    name: 'The Unasked Question',
    label: 'Unasked Question',
    sigil: ['  ✦', '✦ ? ✦', '  ✦'],
    shortRule: 'First placed card cannot be targeted.',
    rule: 'The first card placed each Set cannot be targeted by abilities or effects this Round.',
  },
  {
    id: 'ashen_hand',
    name: 'The Ashen Hand',
    label: 'Ashen Hand',
    sigil: ['✦ ✦ ✦', '  ☄', '✦   ✦'],
    shortRule: 'Ability-taken cards lose base points.',
    rule: 'Cards taken by abilities score no base points, but still count for patterns.',
  },
  {
    id: 'hungry_threshold',
    name: 'The Hungry Threshold',
    label: 'Hungry Threshold',
    sigil: ['✦   ✦', '  ◉', '✦—✦'],
    shortRule: 'Each discard raises the Threshold by 5.',
    rule: 'The Round Threshold rises by 5 each time you discard.',
  },
  {
    id: 'narrow_gate',
    name: 'The Narrow Gate',
    label: 'Narrow Gate',
    sigil: ['✦ | ✦', '  |', '✦ | ✦'],
    shortRule: 'Clear requires at least one pattern.',
    rule: 'The Round cannot be cleared unless at least one Set forms a scoring pattern.',
  },
]);

export const CONSTELLATION_BY_ID = Object.freeze(
  Object.fromEntries(CONSTELLATIONS.map(constellation => [constellation.id, constellation]))
);

export function getConstellation(id) {
  return CONSTELLATION_BY_ID[id] || null;
}

export function constellationForRound(roundIndex = 0) {
  const index = ((roundIndex % CONSTELLATIONS.length) + CONSTELLATIONS.length) % CONSTELLATIONS.length;
  return CONSTELLATIONS[index];
}
