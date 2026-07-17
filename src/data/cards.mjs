export const ROMAN = [
  '0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'
];

export const SUITS = ['Cups', 'Wands', 'Swords', 'Pentacles'];
export const RANKS = ['Page', 'Knight', 'Queen', 'King'];

export const SUIT_GLYPHS = {
  Cups: '🍷',
  Wands: '🪄',
  Swords: '🗡️',
  Pentacles: '𖤐',
};

export const ABILITY_LABELS = {
  DRAW_1: 'Draw 1',
  DRAW_2: 'Draw 2',
  DRAW_3: 'Draw 3',
  PEEK_3: 'Peek 3',
  PEEK_5: 'Peek 5',
  SEARCH: 'Search',
  WORLD: 'Full Reset',
  NEIGHBOR_2: 'Neighbor',
  KIN_2: 'Kin',
  MIRROR_1: 'Mirror',
  BETWEEN_2: 'Between',
};

export const MAJOR_GLYPHS = {
  0: '✦',
  1: '∞',
  2: '☾',
  3: '♀',
  4: '♛',
  5: '☥',
  6: '♡',
  7: '⚔',
  8: '∞',
  9: '☼',
  10: '⊛',
  11: '⚖',
  12: '✝',
  13: '✟',
  14: '⚱',
  15: '⛧',
  16: '⚡',
  17: '✧',
  18: '☽',
  19: '☉',
  20: '⚭',
  21: '○',
};

export const MAJOR_ARCANA = [
  { number: 0,  name: 'Fool',          points: 5, trull: true,  ability: 'PEEK_3',    suits: ['Wands'], rank: 'Page' },
  { number: 1,  name: 'Magician',      points: 5, trull: true,  ability: 'SEARCH',    suits: ['Wands', 'Cups', 'Swords', 'Pentacles'], rank: 'King' },
  { number: 2,  name: 'High Priestess',points: 1, trull: false, ability: 'NEIGHBOR_2',suits: ['Cups'], rank: 'Queen' },
  { number: 3,  name: 'Empress',       points: 1, trull: false, ability: 'DRAW_2',    suits: ['Wands', 'Pentacles'], rank: 'Queen' },
  { number: 4,  name: 'Emperor',       points: 1, trull: false, ability: 'DRAW_1',    suits: ['Wands', 'Pentacles'], rank: 'King' },
  { number: 5,  name: 'Hierophant',    points: 1, trull: false, ability: 'BETWEEN_2', suits: ['Wands'], rank: 'King' },
  { number: 6,  name: 'Lovers',        points: 1, trull: false, ability: 'KIN_2' },
  { number: 7,  name: 'Chariot',       points: 1, trull: false, ability: 'DRAW_1' },
  { number: 8,  name: 'Strength',      points: 1, trull: false, ability: 'DRAW_1' },
  { number: 9,  name: 'Hermit',        points: 1, trull: false, ability: 'NEIGHBOR_2',suits: ['Wands'], rank: 'Knight' },
  { number: 10, name: 'Wheel',         points: 1, trull: false, ability: 'MIRROR_1' },
  { number: 11, name: 'Justice',       points: 1, trull: false, ability: 'KIN_2',     suits: ['Swords', 'Pentacles'], rank: 'King' },
  { number: 12, name: 'Hanged Man',    points: 1, trull: false, ability: 'BETWEEN_2' },
  { number: 13, name: 'Death',         points: 1, trull: false, ability: 'DRAW_3' },
  { number: 14, name: 'Temperance',    points: 1, trull: false, ability: 'BETWEEN_2', suits: ['Cups'], rank: 'Queen' },
  { number: 15, name: 'Devil',         points: 1, trull: false, ability: 'DRAW_2' },
  { number: 16, name: 'Tower',         points: 1, trull: false, ability: 'DRAW_2',    suits: ['Wands', 'Swords'], rank: 'Knight' },
  { number: 17, name: 'Star',          points: 1, trull: false, ability: 'KIN_2',     suits: ['Cups'], rank: 'Queen' },
  { number: 18, name: 'Moon',          points: 1, trull: false, ability: 'MIRROR_1',  suits: ['Cups'], rank: 'Page' },
  { number: 19, name: 'Sun',           points: 1, trull: false, ability: 'DRAW_2',    suits: ['Wands'], rank: 'Knight' },
  { number: 20, name: 'Judgement',     points: 1, trull: false, ability: 'MIRROR_1' },
  { number: 21, name: 'World',         points: 5, trull: true,  ability: 'WORLD',     suits: ['Wands', 'Pentacles'], rank: 'King' },
].map(card => ({
  ...card,
  id: `major_${card.number}`,
  type: 'major',
}));

export const COURT_CARD_TEMPLATES = [
  { rank: 'Page', points: 2, ability: 'DRAW_1' },
  { rank: 'Knight', points: 3, ability: 'PEEK_3' },
  { rank: 'Queen', points: 4, ability: 'DRAW_2' },
  { rank: 'King', points: 5, ability: 'PEEK_5' },
];

export const COURT_CARDS = SUITS.flatMap(suit =>
  COURT_CARD_TEMPLATES.map(card => ({
    ...card,
    suit,
    id: `court_${suit}_${card.rank}`,
    type: 'court',
    name: `${card.rank} of ${suit}`,
  }))
);

export const CARD_MEANINGS = {
  major_0: ['Beginnings, innocence', 'Recklessness, naivety'],
  major_1: ['Will, mastery', 'Manipulation, illusion'],
  major_2: ['Intuition, mystery', 'Secrets withheld'],
  major_3: ['Abundance, creation', 'Dependence, neglect'],
  major_4: ['Authority, structure', 'Domination, rigidity'],
  major_5: ['Tradition, doctrine', 'Rebellion, reform'],
  major_6: ['Union, choice', 'Disharmony, betrayal'],
  major_7: ['Resolve, victory', 'Loss of direction'],
  major_8: ['Courage, patience', 'Self-doubt, weakness'],
  major_9: ['Solitude, search', 'Isolation, lost'],
  major_10: ['Cycles, fortune', 'Resistance, stagnation'],
  major_11: ['Truth, fairness', 'Injustice, evasion'],
  major_12: ['Surrender, suspension', 'Stalling, vain sacrifice'],
  major_13: ['Endings, transformation', 'Resistance to change'],
  major_14: ['Balance, patience', 'Excess, imbalance'],
  major_15: ['Bondage, addiction', 'Release, awareness'],
  major_16: ['Upheaval, ruin', 'Averting disaster'],
  major_17: ['Hope, renewal', 'Despair, lost faith'],
  major_18: ['Illusion, fear', 'Truth revealed'],
  major_19: ['Joy, vitality', 'False optimism'],
  major_20: ['Awakening, reckoning', 'Refused calling'],
  major_21: ['Completion, wholeness', 'Unfinished, stagnation'],
};

export const COURT_MEANINGS = {
  Page: ['Curiosity, learning', 'Inexperience, gossip'],
  Knight: ['Action, pursuit', 'Recklessness, haste'],
  Queen: ['Compassion, intuition', 'Withdrawal, anxiety'],
  King: ['Mastery, command', 'Cruelty, coldness'],
};

export const SUIT_MEANINGS = {
  Cups: ['Emotion, love', 'Hidden feelings'],
  Wands: ['Will, creation', 'Burnout, delay'],
  Swords: ['Truth, conflict', 'Deceit, anguish'],
  Pentacles: ['Work, abundance', 'Greed, loss'],
};

export const ALL_CARD_DEFINITIONS = [...MAJOR_ARCANA, ...COURT_CARDS];
