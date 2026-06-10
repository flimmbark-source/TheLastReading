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
    name: 'The Gilded Fool',
    icon: '🃏',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'If the spread has at least 1 card, add +10 Chips.',
  },
  hermit_lantern: {
    id: 'hermit_lantern',
    name: "Hermit's Lantern",
    icon: '🔦',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each Major Arcana in the spread adds +0.25 Mult.',
  },
  mirror_shard: {
    id: 'mirror_shard',
    name: 'Mirror Shard',
    icon: '🪞',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each pair of matching ranks or major numbers adds +1 Mult.',
  },
  still_pool: {
    id: 'still_pool',
    name: 'The Still Pool',
    icon: '🪷',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'If no Discards were used this reading, add +1 Mult.',
  },
  loaded_die: {
    id: 'loaded_die',
    name: 'Loaded Die',
    icon: '🎲',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Court cards in the spread add their point values again as Chips.',
  },
  gilded_discard: {
    id: 'gilded_discard',
    name: 'Gilded Discard',
    icon: '✨',
    event: RELIC_EVENT_TYPES.DISCARD_USED,
    description: 'The first Discard each reading costs no charge.',
  },
  threadbare_tarot: {
    id: 'threadbare_tarot',
    name: 'Threadbare Tarot',
    icon: '🎴',
    event: RELIC_EVENT_TYPES.READING_START,
    description: 'Draw 1 extra card at the start of each reading.',
  },
  merchants_scale: {
    id: 'merchants_scale',
    name: "Merchant's Scale",
    icon: '⚖',
    event: RELIC_EVENT_TYPES.MARKET,
    description: 'All packs cost 3 fewer Reserve.',
  },
  court_favor: {
    id: 'court_favor',
    name: 'Court Favor',
    icon: '👑',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each Court card in the spread adds +1 Mult.',
  },
  hanged_coin: {
    id: 'hanged_coin',
    name: "Hanged Man's Coin",
    icon: '🪙',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Discarded cards contribute half their base Chips to the score.',
  },
  miser: {
    id: 'miser',
    name: 'The Miser',
    icon: '💰',
    event: RELIC_EVENT_TYPES.SESSION_END,
    description: 'Gain +5 bonus Reserve each time you clear a threshold.',
  },
  arcana_codex: {
    id: 'arcana_codex',
    name: 'Arcana Codex',
    icon: '📖',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Each distinct scoring upgrade you own adds +0.1 Mult.',
  },
  lovers_knot: {
    id: 'lovers_knot',
    name: "The Lovers' Knot",
    icon: '🔗',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'For each rank that appears 2 or more times in the spread, gain +1.5 Mult.',
  },
  temperance_flask: {
    id: 'temperance_flask',
    name: 'Temperance Flask',
    icon: '⚗',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Using exactly 1 Discard per reading grants +1.5 Mult when scoring.',
  },
  strengths_grip: {
    id: 'strengths_grip',
    name: 'Strength',
    icon: '💪',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'If the spread contains 3 or more Court cards, gain +3 Mult.',
  },
  the_world: {
    id: 'the_world',
    name: 'The World',
    icon: '🌍',
    event: RELIC_EVENT_TYPES.SCORING,
    description: '10% of chips scored above the threshold carry over as bonus chips next reading.',
  },
  fool_reversed: {
    id: 'fool_reversed',
    name: 'The Fool Reversed',
    icon: '🙃',
    event: RELIC_EVENT_TYPES.SCORING,
    description: 'Your hand size is reduced by 1, but all cards in the spread gain +3 Chips.',
  },
  watcher: {
    id: 'watcher',
    name: 'The Watcher',
    icon: '👁',
    event: RELIC_EVENT_TYPES.READING_START,
    active: true,
    description: 'Once per session: reveal the top 3 cards of your deck, take 1, return the rest to the bottom.',
  },
});

export const RELIC_LIST = Object.freeze(Object.values(RELICS));

export function getRelic(id) {
  return RELICS[id] || null;
}

export function relicsForEvent(eventType) {
  return RELIC_LIST.filter(relic => relic.event === eventType);
}
