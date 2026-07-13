// Adventure Mode Pilot — shared vocabulary registries.
//
// This module is the single source of truth for the stable IDs used by the
// consequence-driven pilot. Content modules and the resolver reference these
// IDs; the pilot content validator asserts that every reading only touches
// registered statuses, materials, items, companions, memory fields, threads,
// and endings. There are NO numeric requirements, potencies, or success tiers
// anywhere in the pilot vocabulary — a journey advances or ends for authored,
// state-driven reasons.

import { ACTION_NODES, ACTION_NODE_LIST } from '../nodes.mjs';

export { ACTION_NODES, ACTION_NODE_LIST };

// ---------------------------------------------------------------------------
// Strain track
// ---------------------------------------------------------------------------

export const STRAIN_STAGES = Object.freeze(['clear', 'spent', 'exhausted']);

export const STRAIN_WARNINGS = Object.freeze({
  spent: 'Much of your strength is spent. Another demanding action will exhaust you.',
  exhausted: 'You are near collapse. Another severe exertion may end your journey.',
});

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export const PILOT_STATUSES = Object.freeze({
  wounded: {
    id: 'wounded',
    name: 'Wounded',
    danger: true,
    description: 'A serious physical injury.',
    warning: 'Another serious physical injury may end your journey.',
  },
  haunted: {
    id: 'haunted',
    name: 'Haunted',
    danger: false,
    description: 'A supernatural presence has access to you.',
    deepensTo: 'deeply_haunted',
  },
  deeply_haunted: {
    id: 'deeply_haunted',
    name: 'Deeply Haunted',
    danger: true,
    description: 'You are close to possession or the loss of yourself.',
    warning: 'The presence is becoming hard to distinguish from your own thoughts.',
  },
  distrusted: {
    id: 'distrusted',
    name: 'Distrusted',
    danger: false,
    description: 'Stories and evidence make others suspicious of you.',
  },
  hunted: {
    id: 'hunted',
    name: 'Hunted',
    danger: true,
    description: 'A named enemy is actively pursuing you.',
    warning: 'Your pursuers are close enough to leave signs.',
  },
  prepared: {
    id: 'prepared',
    name: 'Prepared',
    danger: false,
    description: 'A one-use advantage created by foresight.',
  },
  blessed: {
    id: 'blessed',
    name: 'Blessed',
    danger: false,
    description: 'A one-use protective spiritual state.',
  },
});

export const PILOT_STATUS_LIST = Object.freeze(Object.values(PILOT_STATUSES));
export const PILOT_STATUS_IDS = Object.freeze(Object.keys(PILOT_STATUSES));

export function getPilotStatus(id) {
  return PILOT_STATUSES[id] || null;
}

// ---------------------------------------------------------------------------
// Materials (capacity: three slots)
// ---------------------------------------------------------------------------

export const MATERIAL_CAPACITY = 3;

export const PILOT_MATERIALS = Object.freeze({
  timber: { id: 'timber', name: 'Timber' },
  cloth: { id: 'cloth', name: 'Cloth' },
  oil: { id: 'oil', name: 'Oil' },
  worked_iron: { id: 'worked_iron', name: 'Worked Iron' },
});

export const PILOT_MATERIAL_IDS = Object.freeze(Object.keys(PILOT_MATERIALS));

// ---------------------------------------------------------------------------
// Signature items and companions
// ---------------------------------------------------------------------------

export const PILOT_COMPANIONS = Object.freeze({
  greyfang: { id: 'greyfang', name: 'Greyfang' },
});

export const PILOT_COMPANION_IDS = Object.freeze(Object.keys(PILOT_COMPANIONS));

export const PILOT_ITEMS = Object.freeze({
  provision: { id: 'provision', name: 'Provision', supply: true },
  healing_salve: { id: 'healing_salve', name: 'Healing Salve' },
  gatekeepers_ring: { id: 'gatekeepers_ring', name: "Gatekeeper's Ring" },
  bound_gatekeepers_ring: { id: 'bound_gatekeepers_ring', name: "Bound Gatekeeper's Ring" },
  road_token: { id: 'road_token', name: 'Road Token' },
  old_road_map: { id: 'old_road_map', name: 'Old Road Map' },
  silver_toll_seal: { id: 'silver_toll_seal', name: 'Silver Toll Seal' },
  broken_chain: { id: 'broken_chain', name: 'Broken Chain' },
  reversed_lock_teeth: { id: 'reversed_lock_teeth', name: 'Reversed Lock Teeth' },
  roadkeepers_lamp: { id: 'roadkeepers_lamp', name: "Roadkeeper's Lamp" },
  gravekeepers_candle: { id: 'gravekeepers_candle', name: "Gravekeeper's Candle" },
  beast_fang_knife: { id: 'beast_fang_knife', name: 'Beast-Fang Knife' },
  notched_blade: { id: 'notched_blade', name: 'Notched Blade' },
  bandits_buckler: { id: 'bandits_buckler', name: "Bandit's Buckler" },
  smoke_cloth_cloak: { id: 'smoke_cloth_cloak', name: 'Smoke-Cloth Cloak' },
  soldiers_insignia: { id: 'soldiers_insignia', name: "Soldier's Insignia" },
  stolen_horse: { id: 'stolen_horse', name: 'Stolen Horse' },
  trapmakers_key_fragment: { id: 'trapmakers_key_fragment', name: "Trapmaker's Key Fragment" },
  bandit_route_ledger: { id: 'bandit_route_ledger', name: 'Bandit Route Ledger' },
  tollhouse_master_key: { id: 'tollhouse_master_key', name: 'Tollhouse Master Key' },
  black_mile_token: { id: 'black_mile_token', name: 'Black Mile Token' },
  roads_favor: { id: 'roads_favor', name: "Road's Favor" },
  witness_object: { id: 'witness_object', name: 'Witness Object' },
  bound_trap_presence: { id: 'bound_trap_presence', name: 'Bound Trap Presence' },
  road_trap_key: { id: 'road_trap_key', name: 'Road-Trap Key' },
  roadkeepers_verse: { id: 'roadkeepers_verse', name: "Roadkeeper's Verse" },
  ledger_page: { id: 'ledger_page', name: 'Copied Ledger Page' },
  trap_ledger_page: { id: 'trap_ledger_page', name: 'Trap Ledger Page' },
});

export const PILOT_ITEM_IDS = Object.freeze(Object.keys(PILOT_ITEMS));

export function pilotNounName(id) {
  return (
    PILOT_ITEMS[id]?.name ||
    PILOT_COMPANIONS[id]?.name ||
    PILOT_MATERIALS[id]?.name ||
    PILOT_STATUSES[id]?.name ||
    id
  );
}

// ---------------------------------------------------------------------------
// Structured world memories
// ---------------------------------------------------------------------------

export const MEMORY_FIELDS = Object.freeze({
  beast: {
    fate: ['trapped', 'contained', 'freed', 'companion', 'killed', 'loose', 'cursed'],
    responsibility: ['helped', 'helped_by_force', 'abandoned', 'harmed', 'redirected'],
  },
  ironGate: {
    state: ['functional', 'destroyed', 'unstable', 'bypassed', 'stabilized', 'rebuilt', 'partially_collapsed'],
    claim: ['none', 'asserted', 'inherited', 'bound', 'deceived'],
    travelers: ['none', 'helped', 'escorted', 'abandoned', 'in_care'],
  },
  bandits: {
    state: ['active', 'divided', 'leaderless', 'scattered'],
    relation: ['hunting', 'humiliated', 'fearful', 'indebted', 'neutral', 'none'],
    possession: ['none', 'player_belonging', 'player_horse'],
  },
  // roadOutcome is a single string field.
  roadOutcome: [
    'keeper',
    'broken',
    'released',
    'pardoned',
    'commissioned',
    'contested',
    'outlaw',
    'unrecorded',
    'accounted',
    'freed',
    'refuge',
    'unsettled',
    'bound',
    'reworked',
  ],
  // roadTrapEvidence is a numeric counter.
  // falseIdentity / stolenBelonging / fire / tollhouse / impostor are string|null flags.
  fire: ['active', 'resolved', 'redirected'],
  tollhouse: ['reworked', 'firebreak', 'refuge', 'destroyed'],
});

export const SCALAR_MEMORY_FIELDS = Object.freeze([
  'roadOutcome',
  'roadTrapEvidence',
  'falseIdentity',
  'stolenBelonging',
  'fire',
  'tollhouse',
  'impostor',
]);

export const NESTED_MEMORY_FIELDS = Object.freeze(['beast', 'ironGate', 'bandits']);

export const ALL_MEMORY_FIELDS = Object.freeze([...NESTED_MEMORY_FIELDS, ...SCALAR_MEMORY_FIELDS]);

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export const THREAD_URGENCY = Object.freeze(['urgent', 'active', 'dormant']);

// Each thread declares which pilot events can consume it. The content
// validator asserts that every major thread created by a reading has at least
// one consumer among these events.
export const PILOT_THREADS = Object.freeze({
  beast_after_pass: { id: 'beast_after_pass', consumers: ['beast_after_pass', 'beast_kings_road'] },
  beast_returns: { id: 'beast_returns', consumers: ['beast_after_pass', 'beast_kings_road'] },
  cursed_beast: { id: 'cursed_beast', consumers: ['beast_kings_road', 'beast_after_pass'] },
  bandits_return: { id: 'bandits_return', consumers: ['bandits_return', 'name_another_hand'] },
  young_bandit_deserter: { id: 'young_bandit_deserter', consumers: ['bandits_return', 'name_another_hand'] },
  road_remembers: { id: 'road_remembers', consumers: ['road_remembers'] },
  roadside_fire: { id: 'roadside_fire', consumers: ['smoke_tollhouse'] },
  roadkeeper_obligation: { id: 'roadkeeper_obligation', consumers: ['smoke_tollhouse', 'road_remembers'] },
  gatekeeper_duty: { id: 'gatekeeper_duty', consumers: ['road_remembers', 'beast_after_pass'] },
  pursuers_close: { id: 'pursuers_close', consumers: ['bandits_return', 'name_another_hand'] },
  stolen_belonging: { id: 'stolen_belonging', consumers: ['name_another_hand', 'bandits_return'] },
  false_identity: { id: 'false_identity', consumers: ['road_remembers', 'name_another_hand', 'beast_kings_road'] },
  trapmaker_truth: { id: 'trapmaker_truth', consumers: ['road_remembers', 'beast_kings_road'] },
  traveler_in_care: { id: 'traveler_in_care', consumers: ['road_remembers', 'smoke_tollhouse'] },
  guardian_of_cursed_beast: { id: 'guardian_of_cursed_beast', consumers: ['beast_kings_road'] },
  impostor_drawing_pursuit: { id: 'impostor_drawing_pursuit', consumers: ['name_another_hand'] },
});

export const PILOT_THREAD_IDS = Object.freeze(Object.keys(PILOT_THREADS));

// Threads considered "major" for the consumer-coverage validator. Every one of
// these, when created, must be consumable by at least one authored event.
export const MAJOR_THREAD_IDS = Object.freeze([
  'beast_after_pass',
  'beast_returns',
  'cursed_beast',
  'bandits_return',
  'young_bandit_deserter',
  'road_remembers',
  'roadside_fire',
  'stolen_belonging',
  'false_identity',
  'trapmaker_truth',
]);

// ---------------------------------------------------------------------------
// Terminal endings
// ---------------------------------------------------------------------------

export const PILOT_ENDINGS = Object.freeze({
  ending_wounded_physical: {
    id: 'ending_wounded_physical',
    title: 'The Wound That Would Not Wait',
    warningSource: 'wounded',
    prose:
      'You were already Wounded when the road demanded your body again. This time it did not give the injury back.',
  },
  ending_exhausted_exertion: {
    id: 'ending_exhausted_exertion',
    title: 'Where Your Strength Ran Out',
    warningSource: 'strain:exhausted',
    prose:
      'You were already Exhausted when you chose another severe exertion. There was nothing left to spend, and the road kept the rest.',
  },
  ending_possession: {
    id: 'ending_possession',
    title: 'A Voice That Was No Longer Yours',
    warningSource: 'deeply_haunted',
    prose:
      'You were Deeply Haunted when you reached again for the hidden. The presence answered from inside you, and did not give you back.',
  },
  ending_captured: {
    id: 'ending_captured',
    title: 'The Pursuit That Closed',
    warningSource: 'hunted',
    prose:
      'Your pursuers were already close when the road offered no way out. This time your chosen answer left nowhere to run.',
  },
});

export const PILOT_ENDING_IDS = Object.freeze(Object.keys(PILOT_ENDINGS));

export function getPilotEnding(id) {
  return PILOT_ENDINGS[id] || null;
}

// ---------------------------------------------------------------------------
// Echoes (methods repeatedly trusted). Keyed by trait/node id.
// ---------------------------------------------------------------------------

export const ECHO_KEYS = ACTION_NODE_LIST;

export const TRAIT_LABELS = Object.freeze({
  physical: 'Physical',
  aggression: 'Aggression',
  protection: 'Protection',
  endurance: 'Endurance',
  compassion: 'Compassion',
  authority: 'Authority',
  mystery: 'Mystery',
  deception: 'Deception',
  investigation: 'Investigation',
  transformation: 'Transformation',
  creation: 'Creation',
  fortune: 'Fortune',
});
