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
  merchant_scale: {
    id: 'merchant_scale',
    name: "Merchant's Scale",
    icon: '⚖',
    event: RELIC_EVENT_TYPES.MARKET,
    description: 'All packs cost 3 fewer Reserve.',
  },
});

export const RELIC_LIST = Object.freeze(Object.values(RELICS));

export function getRelic(id) {
  return RELICS[id] || null;
}

export function relicsForEvent(eventType) {
  return RELIC_LIST.filter(relic => relic.event === eventType);
}
