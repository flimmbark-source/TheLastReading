// Adventure Mode — relic definitions.
//
// Adventure relics are a separate catalogue from Score Mode relics
// (src/data/relics.mjs); they intentionally do not touch the scoring formula.
// Prototype effects are deliberately simple and are resolved by run.mjs at the
// hook points named in `event`.

export const ADVENTURE_RELIC_EVENTS = Object.freeze({
  RESOLVE_FLOOR: 'resolve_floor', // checked when resolve would drop
  EVENT_RESOLVED: 'event_resolved', // after every event resolves
  REWARD_OFFER: 'reward_offer', // when reward offers are generated
});

export const ADVENTURE_RELICS = Object.freeze({
  travelers_charm: {
    id: 'travelers_charm',
    name: "Traveler's Charm",
    icon: '🧿',
    event: ADVENTURE_RELIC_EVENTS.REWARD_OFFER,
    description: 'Success readings offer one extra reward to choose from.',
    bonusOfferCount: 1,
  },
  lucky_coin: {
    id: 'lucky_coin',
    name: 'Lucky Coin',
    icon: '🪙',
    event: ADVENTURE_RELIC_EVENTS.EVENT_RESOLVED,
    description: 'The first failed event of the run costs no Resolve.',
    negatesFirstFailure: true,
  },
  lantern: {
    id: 'lantern',
    name: 'Lantern',
    icon: '🏮',
    event: ADVENTURE_RELIC_EVENTS.EVENT_RESOLVED,
    description: 'Mystery and Supernatural events always reveal their outcome text.',
    illuminatesHiddenTraits: ['MYSTERY', 'SUPERNATURAL'],
  },
  iron_ring: {
    id: 'iron_ring',
    name: 'Iron Ring',
    icon: '💍',
    event: ADVENTURE_RELIC_EVENTS.RESOLVE_FLOOR,
    description: 'Once per run, surviving at 0 Resolve leaves you at 1 instead of losing.',
    survivesLethalOnce: true,
  },
  prayer_beads: {
    id: 'prayer_beads',
    name: 'Prayer Beads',
    icon: '📿',
    event: ADVENTURE_RELIC_EVENTS.EVENT_RESOLVED,
    description: 'Each Triumph restores 1 Resolve (up to max).',
    triumphResolveRestore: 1,
  },
});

export const ADVENTURE_RELIC_LIST = Object.freeze(Object.values(ADVENTURE_RELICS));

export function getRelic(id) {
  return ADVENTURE_RELICS[id] || null;
}
