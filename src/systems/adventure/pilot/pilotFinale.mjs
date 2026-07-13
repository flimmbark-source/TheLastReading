// Temporary finale evaluation. This is a PLAYTEST INSTRUMENT, not final story
// content: it reads the accumulated payload and reports what the journey did to
// the traveler and the world, plus a deterministic causal summary. No runtime
// LLM — the summary is assembled from recorded facts and authored templates.

import { TRAIT_LABELS, PILOT_STATUSES, pilotNounName } from '../../../data/adventure/pilot/vocab.mjs';

const OBLIGATION_THREADS = ['roadkeeper_obligation', 'traveler_in_care', 'guardian_of_cursed_beast'];

function topEchoes(echoes = {}, count = 2) {
  return Object.entries(echoes)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, count)
    .map(([trait, value]) => ({ trait, label: TRAIT_LABELS[trait] || trait, value }));
}

function echoSentence(echoesList) {
  if (echoesList.length === 0) return 'You moved through the road without settling into any one method.';
  if (echoesList.length === 1) return `Again and again you answered the road with ${echoesList[0].label}.`;
  return `The road learned to expect ${echoesList[0].label} from you, and ${echoesList[1].label} when that was not enough.`;
}

function beastLine(memories) {
  const beast = memories.beast;
  if (!beast) return null;
  const map = {
    companion: 'The beast you helped became Greyfang and walks with you still.',
    freed: 'You freed the beast; whether it remembers you is its own affair.',
    killed: 'You killed the beast in the pass, and something, somewhere, marked it.',
    trapped: 'You left the beast trapped where you found it.',
    contained: 'You left the beast contained but alive, its problem only postponed.',
    loose: 'You set the beast loose on the road with no say in where it goes.',
    cursed: 'You left the beast cursed, drawn toward the well by the iron on its leg.',
  };
  return map[beast.fate] || null;
}

function banditLine(memories) {
  const b = memories.bandits;
  if (!b) return null;
  const rel = {
    hunting: 'The bandits are hunting you by name.',
    humiliated: 'The bandits remember being made fools of, and want it answered.',
    fearful: 'The bandits are too afraid of you to come close.',
    indebted: 'The bandits owe you, and some of them know it.',
    neutral: 'The bandits have no strong feeling about you either way.',
    none: null,
  };
  return rel[b.relation] || `The bandits are ${b.state}.`;
}

function roadLine(memories) {
  const outcome = memories.roadOutcome;
  if (!outcome) return null;
  const map = {
    keeper: 'You accepted the road’s duty and became its Keeper.',
    broken: 'You broke the old road; it owes you nothing and offers nothing.',
    released: 'You walked the keeper’s circuit and released the road’s hold.',
    pardoned: 'The road pardoned your crossing.',
    commissioned: 'The road commissioned you to a limited duty.',
    contested: 'Your claim on the road is contested, and the liability is yours.',
    outlaw: 'You are an outlaw of the old road.',
    unrecorded: 'Your crossing is unrecorded — under a name that was not yours.',
    accounted: 'You settled the road’s account and proved where blame truly lay.',
    freed: 'You made the king’s road a common road for everyone.',
    refuge: 'You rebuilt the tollhouse into a refuge on the road.',
    reworked: 'You turned the toll machine to a new purpose and ended its authority.',
    unsettled: 'The road is unsettled, still deciding what you were to it.',
    bound: 'You bound the roadkeeper into an object you carry.',
  };
  return map[outcome] || null;
}

export function buildFinalePayload(run) {
  const echoesList = topEchoes(run.echoes);
  const dangerStatuses = run.statuses.filter(id => PILOT_STATUSES[id]?.danger);
  const obligations = run.threads.filter(t => OBLIGATION_THREADS.includes(t.id)).map(t => t.id);
  const evidence = run.memories.roadTrapEvidence || 0;
  const roadTruth = evidence >= 2
    ? 'The old road’s gates and traps were built to stop living beings from reaching the Woman in the Well.'
    : evidence === 1
      ? 'You gathered a fragment of the truth about the road’s traps, but not the whole of it.'
      : null;

  const finaleHooks = [];
  if (run.companions.includes('greyfang')) finaleHooks.push('Greyfang travels with you into the finale.');
  if (['loose', 'cursed'].includes(run.memories.beast?.fate)) finaleHooks.push('A loose or cursed beast is still on the road ahead.');
  if (run.allies.includes('deserter')) finaleHooks.push('Deserters you divided may answer if called.');
  if (run.memories.bandits?.possession === 'player_belonging') finaleHooks.push('An unknown faction still carries something of yours.');
  if (run.memories.roadOutcome) finaleHooks.push(`Your road role is "${run.memories.roadOutcome}".`);
  if (run.threads.some(t => (t.tags || []).some(tag => tag.includes('secret') || tag.includes('route')))) finaleHooks.push('A secret route has opened toward the well.');
  if (run.allies.includes('road_commons')) finaleHooks.push('The public road is open to you.');
  if (evidence > 0) finaleHooks.push(`You carry Road-Trap Evidence (${evidence}).`);
  if (run.items.includes('witness_object')) finaleHooks.push('A Witness Object can testify once at the finale.');
  if (run.items.includes('roads_favor')) finaleHooks.push('The Road’s Favor can be spent once before the end.');
  if (run.items.includes('black_mile_token')) finaleHooks.push('The Black Mile Token marks a shortcut to the well.');

  const worldLines = [beastLine(run.memories), banditLine(run.memories), roadLine(run.memories)].filter(Boolean);

  return {
    playtest: true,
    reachedDestination: Boolean(run.reachedDestination) && !run.terminalEnding,
    terminalEnding: run.terminalEnding || null,
    identity: {
      topEchoes: echoesList,
      sentence: echoSentence(echoesList),
    },
    toll: {
      strain: run.strain,
      dangerStatuses,
      statuses: [...run.statuses],
      obligations,
    },
    remains: {
      companions: [...run.companions],
      items: [...run.items],
      materials: [...run.materials],
      provisions: run.provisions,
      witnesses: [...run.witnesses],
      allies: [...run.allies],
    },
    world: {
      beast: run.memories.beast,
      bandits: run.memories.bandits,
      ironGate: run.memories.ironGate,
      roadOutcome: run.memories.roadOutcome,
      roadTrapEvidence: evidence,
      roadTruth,
      falseIdentity: run.memories.falseIdentity,
      fire: run.memories.fire,
      stolenBelonging: run.memories.stolenBelonging,
      tollhouse: run.memories.tollhouse,
      lines: worldLines,
    },
    enemies: [...run.enemies],
    allies: [...run.allies],
    finaleHooks,
    causalSummary: buildCausalSummary(run, { echoesList, worldLines, roadTruth }),
  };
}

// Deterministic causal summary assembled from recorded history and memories.
export function buildCausalSummary(run, precomputed = {}) {
  const echoesList = precomputed.echoesList || topEchoes(run.echoes);
  const lines = [];

  lines.push(precomputed.roadTruth ? echoSentence(echoesList) + ' ' + precomputed.roadTruth : echoSentence(echoesList));

  // Two or three key beats from history, in order.
  const beats = run.eventHistory
    .filter(entry => entry.kind !== 'recovery' && entry.action)
    .map(entry => {
      const label = entry.traitLabel ? `${entry.traitLabel}` : entry.choiceLabel || 'a choice';
      return `At ${entry.eventTitle}, you answered with ${label}.`;
    });
  lines.push(...beats.slice(0, 4));

  for (const line of precomputed.worldLines || []) lines.push(line);

  if (run.terminalEnding) {
    lines.push(
      `Your journey ended at ${run.terminalEnding.eventTitle}: ${run.terminalEnding.prose}`,
    );
  } else if (run.reachedDestination) {
    lines.push('You reached the Woman in the Well. The final encounter is not part of this playtest.');
  }

  return lines;
}

export function describeItem(id) {
  return pilotNounName(id);
}
