import { ALL_CARD_DEFINITIONS } from '../../data/cards.mjs';
import { ADVENTURE_EVENTS, EVENT_TRAITS } from '../../data/adventure/events.mjs';
import { getEventApproaches } from '../../data/adventure/eventApproaches.mjs';
import { cardAdventureProfile } from '../../data/adventure/cardNodes.mjs';
import { REWARD_OFFER_RULES } from '../../data/adventure/rewards.mjs';
import { getStatus } from '../../data/adventure/statuses.mjs';
import { getRelic } from '../../data/adventure/relics.mjs';
import { routeNode, nodeDistance } from './nodeGraph.mjs';

export const SINGLE_CARD_RESULTS = Object.freeze({
  FAILURE: 'failure',
  SUCCESS: 'success',
  GREAT_SUCCESS: 'great_success',
});

export const EVENTS_PER_SET = 5;
export const TOTAL_SETS = 2;
export const INITIAL_RESOLVE = 4;
export const MAX_RESOLVE = 6;

const FIRST_SET_IDS = Object.freeze([
  'iron_gate',
  'ambush',
  'traveling_merchant',
  'strange_shrine',
  'cornered_beast',
]);

const SET_ECHOES = Object.freeze({
  physical: 'The road has learned that you meet resistance with your own body.',
  aggression: 'Stories of what you have broken travel ahead of you.',
  protection: 'Those you sheltered remember, and the road begins to answer in kind.',
  endurance: 'The next stretch of road tests how long you can keep going.',
  compassion: 'Those you spared speak of you before you arrive.',
  authority: 'Your name begins to carry weight in places you have never been.',
  mystery: 'The stranger parts of the road have begun to notice you.',
  deception: 'Rumour follows you, never quite agreeing on who you are.',
  investigation: 'The road offers more secrets to the person who kept looking.',
  transformation: 'What you changed has changed the shape of what comes next.',
  creation: 'Things left better behind you make new possibilities ahead.',
  fortune: 'Chance bends around the pattern you have made.',
});

function hasStatus(run, id) {
  return Array.isArray(run.statuses) && run.statuses.includes(id);
}

function hasRelic(run, id) {
  return Array.isArray(run.relics) && run.relics.includes(id);
}

function weightedSampleWithoutReplacement(entries, count, rng) {
  const pool = entries.map(entry => ({ ...entry }));
  const chosen = [];
  while (chosen.length < count && pool.length) {
    const total = pool.reduce((sum, entry) => sum + Math.max(0.01, entry.weight), 0);
    let roll = rng() * total;
    let index = 0;
    for (; index < pool.length; index += 1) {
      roll -= Math.max(0.01, pool[index].weight);
      if (roll <= 0) break;
    }
    const [picked] = pool.splice(Math.min(index, pool.length - 1), 1);
    chosen.push(picked.id);
  }
  return chosen;
}

function eventAffinityWeight(event, previousNodes = [], completedEventIds = []) {
  const approaches = getEventApproaches(event);
  const accepted = approaches.map(approach => approach.node);
  let weight = completedEventIds.includes(event.id) ? 0.35 : 1;
  for (const node of previousNodes) {
    const best = accepted.reduce((distance, acceptedNode) => Math.min(distance, nodeDistance(node, acceptedNode)), Infinity);
    if (best === 0) weight += 3;
    else if (best === 1) weight += 1.5;
    else if (Number.isFinite(best)) weight += 0.25;
  }
  return weight;
}

export function buildSetEventDeck({ setIndex = 0, previousNodes = [], completedEventIds = [], rng = Math.random } = {}) {
  if (setIndex === 0) {
    const deck = [...FIRST_SET_IDS];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  const entries = ADVENTURE_EVENTS.map(event => ({
    id: event.id,
    weight: eventAffinityWeight(event, previousNodes, completedEventIds),
  }));
  return weightedSampleWithoutReplacement(entries, EVENTS_PER_SET, rng);
}

export function defaultAdventureCardDeck() {
  return ALL_CARD_DEFINITIONS.map(card => card.id);
}

export function createSingleCardRunState(rng = Math.random, overrides = {}) {
  const base = {
    resolve: INITIAL_RESOLVE,
    maxResolve: MAX_RESOLVE,
    setIndex: 0,
    eventIndexInSet: 0,
    eventDeck: buildSetEventDeck({ setIndex: 0, rng }),
    deck: defaultAdventureCardDeck(),
    statuses: [],
    relics: [],
    currentSetPlays: [],
    completedSets: [],
    completedEvents: [],
    flags: { firstFailureUsed: false, ironRingUsed: false, recoveryDone: false },
    lost: false,
  };
  return { ...base, ...overrides, flags: { ...base.flags, ...(overrides.flags || {}) } };
}

export function currentSingleCardEvent(run) {
  const id = run.eventDeck[run.eventIndexInSet];
  return ADVENTURE_EVENTS.find(event => event.id === id) || null;
}

export function addCardToAdventureDeck(run, cardId) {
  if (cardId) run.deck.push(cardId);
  return run;
}

export function removeCardFromAdventureDeck(run, cardId) {
  const index = run.deck.indexOf(cardId);
  if (index >= 0) run.deck.splice(index, 1);
  return run;
}

export function effectiveEventRequirement(run, approach) {
  return Math.min(5, Math.max(1, Number(approach.requirement || 1) + Number(run.setIndex || 0)));
}

export function resolveSingleCardEvent({ event, card, run }) {
  const profile = cardAdventureProfile(card);
  const approaches = getEventApproaches(event);
  const route = routeNode(profile?.node, approaches.map(approach => approach.node));
  if (!profile || !route) throw new Error(`Adventure could not route card ${card?.id || 'unknown'} for Event ${event?.id || 'unknown'}.`);

  const approach = approaches.find(candidate => candidate.node === route.resolvedNode);
  const requirement = effectiveEventRequirement(run, approach);
  const legacyOutcome = event.outcomes.find(outcome => outcome.id === approach.outcomeId) || event.outcomes[0];
  const notes = [];

  if (profile.potency < requirement) {
    const failure = approach.failure || event.failure || {};
    let resolveChange = failure.resolveChange ?? -1;
    if (hasStatus(run, 'exposed') && event.traits?.includes(EVENT_TRAITS.HOSTILE)) {
      resolveChange -= getStatus('exposed')?.extraHostileFailureResolveCost || 0;
      notes.push('Exposed deepened the hostile failure.');
    }

    let negated = false;
    if (hasRelic(run, 'lucky_coin') && !run.flags.firstFailureUsed && resolveChange < 0) {
      resolveChange = 0;
      negated = true;
      notes.push('Lucky Coin absorbed the failure.');
    }

    return {
      tier: SINGLE_CARD_RESULTS.FAILURE,
      cardId: card.id,
      potency: profile.potency,
      sourceNode: profile.node,
      resolvedNode: route.resolvedNode,
      exact: route.exact,
      distance: route.distance,
      requirement,
      outcome: failure,
      narrative: failure.text || event.failure?.text || 'The attempt fails.',
      resolveChange,
      gainStatuses: [...(failure.gainStatuses || [])],
      removeStatuses: [...(failure.removeStatuses || [])],
      rewardTier: null,
      rewardShow: 0,
      rewardChoose: 0,
      flags: { firstFailureUsed: run.flags.firstFailureUsed || negated || resolveChange < 0 },
      notes,
    };
  }

  const isGreat = route.exact;
  const tier = isGreat ? SINGLE_CARD_RESULTS.GREAT_SUCCESS : SINGLE_CARD_RESULTS.SUCCESS;
  const gainStatuses = [...(legacyOutcome.gainStatuses || [])];
  const removeStatuses = [...(legacyOutcome.removeStatuses || [])];
  let resolveChange = legacyOutcome.resolveChange ?? 0;
  const rules = isGreat ? REWARD_OFFER_RULES.triumph : REWARD_OFFER_RULES.success;
  let rewardShow = rules.show;
  let rewardChoose = rules.choose;

  if (!isGreat && hasRelic(run, 'travelers_charm')) {
    rewardShow += getRelic('travelers_charm')?.bonusOfferCount || 0;
    notes.push("Traveler's Charm widened the choices.");
  }

  if (isGreat && hasRelic(run, 'prayer_beads')) {
    resolveChange += getRelic('prayer_beads')?.triumphResolveRestore || 0;
    notes.push('Prayer Beads restored Resolve.');
  }

  if (isGreat && hasStatus(run, 'distrusted') && event.traits?.includes(EVENT_TRAITS.SOCIAL)) {
    rewardChoose = REWARD_OFFER_RULES.success.choose;
    notes.push('Distrusted suppressed the social Great Success bonus.');
  } else if (isGreat && hasStatus(run, 'blessed')) {
    const bonus = getStatus('blessed')?.bonusTriumphReward || 0;
    rewardShow += bonus;
    rewardChoose += bonus;
    if (!removeStatuses.includes('blessed')) removeStatuses.push('blessed');
    notes.push('Blessed granted an extra reward and faded.');
  }

  return {
    tier,
    cardId: card.id,
    potency: profile.potency,
    sourceNode: profile.node,
    resolvedNode: route.resolvedNode,
    exact: route.exact,
    distance: route.distance,
    requirement,
    outcome: legacyOutcome,
    narrative: isGreat && legacyOutcome.triumphText ? legacyOutcome.triumphText : legacyOutcome.text,
    resolveChange,
    gainStatuses,
    removeStatuses,
    rewardTier: isGreat ? 'triumph' : 'success',
    rewardShow,
    rewardChoose,
    flags: {},
    notes,
  };
}

export function recordSingleCardPlay(run, event, card, resolution) {
  run.currentSetPlays.push({
    eventId: event.id,
    cardId: card.id,
    node: resolution.sourceNode,
    potency: resolution.potency,
    resolvedNode: resolution.resolvedNode,
    tier: resolution.tier,
  });
  run.completedEvents.push(event.id);
  run.eventIndexInSet += 1;
  return run;
}

export function isCurrentSetComplete(run) {
  return run.currentSetPlays.length >= EVENTS_PER_SET;
}

export function buildSetProfile(plays = []) {
  const nodeCounts = {};
  for (const play of plays) nodeCounts[play.node] = (nodeCounts[play.node] || 0) + 1;
  const dominantNodes = Object.keys(nodeCounts).sort((a, b) => nodeCounts[b] - nodeCounts[a] || a.localeCompare(b));
  return {
    nodeCounts,
    dominantNodes,
    playedNodes: plays.map(play => play.node),
    plays: plays.map(play => ({ ...play })),
  };
}

export function completeCurrentSet(run) {
  const profile = buildSetProfile(run.currentSetPlays);
  run.completedSets.push(profile);
  return profile;
}

export function beginNextSet(run, profile, rng = Math.random) {
  run.setIndex += 1;
  run.eventIndexInSet = 0;
  run.currentSetPlays = [];
  run.eventDeck = buildSetEventDeck({
    setIndex: run.setIndex,
    previousNodes: profile?.playedNodes || [],
    completedEventIds: run.completedEvents,
    rng,
  });
  return run;
}

export function isAdventureRunComplete(run) {
  return run.completedSets.length >= TOTAL_SETS;
}

export function setEchoText(profile) {
  const dominant = profile?.dominantNodes?.[0];
  return SET_ECHOES[dominant] || 'The next road takes the shape of the reading you have left behind.';
}
