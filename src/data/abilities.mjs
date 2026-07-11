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
    prompt: '[[draw]] 1 card.',
  },
  DRAW_2: {
    id: 'DRAW_2',
    type: ABILITY_TYPES.DRAW,
    title: 'Draw 2',
    count: 2,
    prompt: '[[draw]] 2 cards.',
  },
  DRAW_3: {
    id: 'DRAW_3',
    type: ABILITY_TYPES.DRAW,
    title: 'Draw 3',
    count: 3,
    prompt: '[[draw]] 3 cards.',
  },
  PEEK_3: {
    id: 'PEEK_3',
    type: ABILITY_TYPES.PEEK,
    title: 'Peek 3',
    count: 3,
    take: 1,
    prompt: '[[reveal]] 3 cards. [[take]] 1.',
  },
  PEEK_5: {
    id: 'PEEK_5',
    type: ABILITY_TYPES.PEEK,
    title: 'Peek 5',
    count: 5,
    take: 1,
    prompt: '[[reveal]] 5 cards. [[take]] 1.',
  },
  SEARCH: {
    id: 'SEARCH',
    type: ABILITY_TYPES.SEARCH,
    title: 'Search',
    take: 1,
    prompt: 'Search the [[deck]]. [[take]] 1, then shuffle.',
  },
  WORLD: {
    id: 'WORLD',
    type: ABILITY_TYPES.WORLD,
    title: 'Full Reset',
    prompt: 'Shuffle your [[hand]] and discard pile into the [[deck]]. [[draw]] a new [[hand]]. Your Spread stays in place.',
  },
  NEIGHBOR_2: {
    id: 'NEIGHBOR_2',
    type: ABILITY_TYPES.NEIGHBOR,
    title: 'Neighbor',
    count: 2,
    take: 1,
    prompt: 'Choose a card. [[reveal]] up to 2 neighboring cards. [[take]] 1.',
  },
  KIN_2: {
    id: 'KIN_2',
    type: ABILITY_TYPES.KIN,
    title: 'Kin',
    count: 2,
    take: 1,
    prompt: 'Choose a card. [[reveal]] up to 2 cards of its Arcana. [[take]] 1.',
  },
  MIRROR_1: {
    // The legacy id is retained for save/card compatibility. Mirror's actual
    // base reveal count is 2, matching the player-facing card rule.
    id: 'MIRROR_1',
    type: ABILITY_TYPES.MIRROR,
    title: 'Mirror',
    count: 2,
    take: 1,
    prompt: 'Choose a card. [[reveal]] up to 2 cards opposite it across its Arcana. [[take]] 1.',
  },
  BETWEEN_2: {
    id: 'BETWEEN_2',
    type: ABILITY_TYPES.BETWEEN,
    title: 'Between',
    count: 2,
    take: 1,
    prompt: 'Choose 2 cards. [[reveal]] up to 2 cards [[between]] them in sequence. [[take]] 1.',
  },
});

export function getAbility(id) {
  return ABILITIES[id] || null;
}
