export const RELIC_EVENT_TYPES = Object.freeze({
  SCORING: 'scoring',
  READING_START: 'reading_start',
  CARD_PLACED: 'card_placed',
  DISCARD_USED: 'discard_used',
  MARKET: 'market',
  PURCHASE: 'purchase',
  SESSION_END: 'session_end',
});

export const RELICS = Object.freeze({
  gilded_fool: {
    id: 'gilded_fool',
    rarity: 'common',
    name: 'The Gilded Fool',
    icon: '🃏',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'If the spread has at least 1 card, add +10 Chips.',
  },
  hermit_lantern: {
    id: 'hermit_lantern',
    rarity: 'common',
    name: "Hermit's Lantern",
    icon: '🔦',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each Major Arcana in the spread adds +0.25 Mult.',
  },
  mirror_shard: {
    id: 'mirror_shard',
    rarity: 'common',
    name: 'Mirror Shard',
    icon: '🪞',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each pair of matching Court ranks adds +0.5 Mult.',
  },
  still_pool: {
    id: 'still_pool',
    rarity: 'common',
    name: 'The Still Pool',
    icon: '🪷',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'If no Discards were used this set, add +0.75 Mult.',
  },
  loaded_die: {
    id: 'loaded_die',
    rarity: 'common',
    name: 'Loaded Die',
    icon: '🎲',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Court cards in the spread add their point values again as Chips.',
  },
  gilded_discard: {
    id: 'gilded_discard',
    rarity: 'common',
    name: 'Gilded Discard',
    icon: '✨',
    event: RELIC_EVENT_TYPES.DISCARD_USED,
    description: 'The first Discard each reading costs no charge.',
  },
  threadbare_tarot: {
    id: 'threadbare_tarot',
    rarity: 'common',
    name: 'Threadbare Tarot',
    icon: '🎴',
    event: RELIC_EVENT_TYPES.READING_START,
    description: 'Draw 1 extra card at the start of each reading.',
  },
  merchants_scale: {
    id: 'merchants_scale',
    rarity: 'common',
    name: "Merchant's Scale",
    icon: '⚖',
    event: RELIC_EVENT_TYPES.MARKET,
    description: 'All packs cost 3 fewer Reserve.',
  },
  court_favor: {
    id: 'court_favor',
    rarity: 'rare',
    name: 'Court Favor',
    icon: '👑',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each Court card in the spread adds +0.25 Mult.',
  },
  hanged_coin: {
    id: 'hanged_coin',
    rarity: 'rare',
    name: "Hanged Man's Coin",
    icon: '🪙',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Discarded cards contribute their full base Chips to the score.',
  },
  miser: {
    id: 'miser',
    rarity: 'rare',
    name: 'The Miser',
    icon: '💰',
    event: RELIC_EVENT_TYPES.SESSION_END,
    description: 'Gain +5 bonus Reserve each time you clear a threshold.',
  },
  arcana_codex: {
    id: 'arcana_codex',
    rarity: 'rare',
    name: 'Arcana Codex',
    icon: '📖',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each distinct scoring upgrade you own adds +0.1 Mult.',
  },
  lovers_knot: {
    id: 'lovers_knot',
    rarity: 'rare',
    name: "The Lovers' Knot",
    icon: '🔗',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'If a Court rank appears 3 or more times, add +1 Mult.',
  },
  temperance_flask: {
    id: 'temperance_flask',
    rarity: 'rare',
    name: 'Temperance Flask',
    icon: '⚗',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Using exactly 1 Discard this set grants +1 Mult when scoring.',
  },
  strengths_grip: {
    id: 'strengths_grip',
    rarity: 'rare',
    name: 'Strength',
    icon: '💪',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'If the spread contains exactly 3 Court cards, gain +1 Mult.',
  },
  the_world: {
    id: 'the_world',
    rarity: 'rare',
    name: 'The World',
    icon: '🌍',
    event: RELIC_EVENT_TYPES.SCORING,
    description: '10% of Chips scored above the threshold carry into the first set of the next reading.',
  },
  fool_reversed: {
    id: 'fool_reversed',
    rarity: 'rare',
    name: 'The Fool Reversed',
    icon: '🙃',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Your hand size is reduced by 1, but all cards in the spread gain +3 Chips.',
  },
  watcher: {
    id: 'watcher',
    rarity: 'rare',
    name: 'The Watcher',
    icon: '👁',
    event: RELIC_EVENT_TYPES.READING_START,
    active: true,
    description: 'Once per reading: reveal the top 3 cards of your deck, take 1, return the rest to the bottom.',
  },
});

export const RELIC_LIST = Object.freeze(Object.values(RELICS));

// Sprite-sheet grid coordinates [col, row] for relic icons (relic icons.png, 6×4 grid).
export const RELIC_SPRITE = Object.freeze({
  gilded_fool:[0,0],hermit_lantern:[1,0],mirror_shard:[2,0],arcana_codex:[3,0],threadbare_tarot:[4,0],merchants_scale:[5,0],
  still_pool:[0,1],loaded_die:[1,1],
  court_favor:[0,2],hanged_coin:[1,2],miser:[2,2],gilded_discard:[3,2],
  lovers_knot:[0,3],temperance_flask:[1,3],strengths_grip:[2,3],the_world:[3,3],fool_reversed:[4,3],watcher:[5,3],
});

export function getRelic(id) {
  return RELICS[id] || null;
}

export function relicsForEvent(eventType) {
  return RELIC_LIST.filter(relic => relic.event === eventType);
}
