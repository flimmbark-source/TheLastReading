export const ABILITY_TYPES = Object.freeze({
  DRAW: 'draw',
  PEEK: 'peek',
  SEARCH: 'search',
  NEIGHBOR: 'neighbor',
  KIN: 'kin',
  MIRROR: 'mirror',
  BETWEEN: 'between',
  WORLD: 'world',
});

export const ABILITIES = Object.freeze({
  DRAW_1: {
    id: 'DRAW_1',
    type: ABILITY_TYPES.DRAW,
    title: 'Draw 1',
    count: 1,
    prompt: 'Draw 1 card.',
  },
  DRAW_2: {
    id: 'DRAW_2',
    type: ABILITY_TYPES.DRAW,
    title: 'Draw 2',
    count: 2,
    prompt: 'Draw 2 cards.',
  },
  DRAW_3: {
    id: 'DRAW_3',
    type: ABILITY_TYPES.DRAW,
    title: 'Draw 3',
    count: 3,
    prompt: 'Draw 3 cards.',
  },
  PEEK_3: {
    id: 'PEEK_3',
    type: ABILITY_TYPES.PEEK,
    title: 'Peek 3',
    count: 3,
    take: 1,
    prompt: 'Reveal 3 cards. Take 1.',
  },
  PEEK_5: {
    id: 'PEEK_5',
    type: ABILITY_TYPES.PEEK,
    title: 'Peek 5',
    count: 5,
    take: 1,
    prompt: 'Reveal 5 cards. Take 1.',
  },
  SEARCH: {
    id: 'SEARCH',
    type: ABILITY_TYPES.SEARCH,
    title: 'Search',
    take: 1,
    prompt: 'Search the deck. Take 1 card.',
  },
  WORLD: {
    id: 'WORLD',
    type: ABILITY_TYPES.WORLD,
    title: 'Full Reset',
    prompt: 'Shuffle hand, spread, and discard into the deck. Draw a new hand.',
  },
  NEIGHBOR_2: {
    id: 'NEIGHBOR_2',
    type: ABILITY_TYPES.NEIGHBOR,
    title: 'Neighbor',
    count: 2,
    take: 1,
    prompt: 'Choose a card. Reveal up to 2 neighboring cards from the deck. Take 1.',
  },
  KIN_2: {
    id: 'KIN_2',
    type: ABILITY_TYPES.KIN,
    title: 'Kin',
    count: 2,
    take: 1,
    prompt: 'Choose a card. Reveal up to 2 cards of the same Arcana from the deck. Take 1.',
  },
  MIRROR_1: {
    id: 'MIRROR_1',
    type: ABILITY_TYPES.MIRROR,
    title: 'Mirror',
    count: 1,
    take: 1,
    prompt: 'Choose a card. Take the card opposite it across centerline of its Arcana.',
  },
  BETWEEN_2: {
    id: 'BETWEEN_2',
    type: ABILITY_TYPES.BETWEEN,
    title: 'Between',
    count: 2,
    take: 1,
    prompt: 'Choose two cards in hand. Reveal cards between them in sequence. Take 1.',
  },
});

export function getAbility(id) {
  return ABILITIES[id] || null;
}
