import assert from 'node:assert/strict';
import { ALL_CARD_DEFINITIONS } from '../src/data/cards.mjs';
import { ADVENTURE_EVENTS } from '../src/data/adventure/events.mjs';
import { EVENT_APPROACHES } from '../src/data/adventure/eventApproaches.mjs';
import { ACTION_NODE_LIST } from '../src/data/adventure/nodes.mjs';
import { missingCardNodeIds, cardAdventureProfile } from '../src/data/adventure/cardNodes.mjs';
import { NODE_VISUALS, OUTCOME_VISUALS } from '../src/app/adventureInteractionFx.mjs';
import { routeNode } from '../src/systems/adventure/nodeGraph.mjs';
import {
  SINGLE_CARD_RESULTS,
  createSingleCardRunState,
  resolveSingleCardEvent,
  buildSetEventDeck,
} from '../src/systems/adventure/singleCardRun.mjs';

assert.deepEqual(missingCardNodeIds(ALL_CARD_DEFINITIONS), [], 'every current card needs exactly one authored Adventure node');
assert.deepEqual(
  ACTION_NODE_LIST.filter(node => !NODE_VISUALS[node]),
  [],
  'every Adventure node needs a visible interaction item',
);
assert.equal(
  new Set(ACTION_NODE_LIST.map(node => NODE_VISUALS[node].icon)).size,
  ACTION_NODE_LIST.length,
  'Adventure node items should have distinct silhouettes',
);
for (const node of ACTION_NODE_LIST) {
  assert.equal(NODE_VISUALS[node].frames.length, 3, `${node} should use all three authored node frames`);
}
assert.deepEqual(
  Object.keys(OUTCOME_VISUALS).sort(),
  ['failure', 'great_success', 'success'],
  'Adventure needs authored Failure, Success, and Great Success outcomes',
);
for (const outcome of Object.values(OUTCOME_VISUALS)) {
  assert.equal(outcome.frames.length, 4, `${outcome.label} should use all four authored outcome frames`);
}

// Every approach must bind to a real outcome in its Event — a missing id would
// silently fall back to the first outcome and ship mismatched prose.
const eventsById = new Map(ADVENTURE_EVENTS.map(event => [event.id, event]));
const acceptedNodeCounts = {};
for (const [eventId, approaches] of Object.entries(EVENT_APPROACHES)) {
  const event = eventsById.get(eventId);
  assert.ok(event, `approaches reference a real Event: ${eventId}`);
  const outcomeIds = new Set(event.outcomes.map(outcome => outcome.id));
  for (const approach of approaches) {
    assert.ok(outcomeIds.has(approach.outcomeId), `${eventId} approach must bind to a real outcome: ${approach.outcomeId}`);
    acceptedNodeCounts[approach.node] = (acceptedNodeCounts[approach.node] || 0) + 1;
  }
  // Every Event authors exactly three tiered solutions: one Easy (req 1), one
  // Medium (req 2-3), one Hard (req 4-5).
  assert.equal(approaches.length, 3, `${eventId} must author exactly three approaches`);
  const reqs = approaches.map(approach => approach.requirement).sort((a, b) => a - b);
  assert.equal(reqs[0], 1, `${eventId} needs an Easy approach at requirement 1`);
  assert.ok(reqs[1] >= 2 && reqs[1] <= 3, `${eventId} needs a Medium approach at requirement 2-3`);
  assert.ok(reqs[2] >= 4 && reqs[2] <= 5, `${eventId} needs a Hard approach at requirement 4-5`);
}
// Every action node must be a valid approach somewhere, so every card and every
// apparition is reachable through real gameplay.
assert.deepEqual(
  ACTION_NODE_LIST.filter(node => !acceptedNodeCounts[node]),
  [],
  'every Adventure node must be an accepted approach in at least one Event',
);

const strength = ALL_CARD_DEFINITIONS.find(card => card.id === 'major_8');
assert.deepEqual(cardAdventureProfile(strength), { node: 'physical', potency: 1 }, 'potency must remain the printed card number');

const exact = routeNode('compassion', ['aggression', 'compassion', 'deception']);
assert.deepEqual(exact, { sourceNode: 'compassion', resolvedNode: 'compassion', exact: true, distance: 0 });

const indirect = routeNode('physical', ['aggression', 'compassion', 'deception']);
assert.equal(indirect.resolvedNode, 'aggression');
assert.equal(indirect.exact, false);
assert.equal(indirect.distance, 1);

// Ambush now accepts exactly three tiers: Protection (Easy, req 1),
// Deception (Medium, req 3), Aggression (Hard, req 5).
const ambush = ADVENTURE_EVENTS.find(event => event.id === 'ambush');
const run = createSingleCardRunState(() => 0.5);

// The intended Easy approach succeeds cleanly at potency 1.
const temperance = ALL_CARD_DEFINITIONS.find(card => card.id === 'major_14'); // Protection, potency 1
const easyGreat = resolveSingleCardEvent({ event: ambush, card: temperance, run });
assert.equal(easyGreat.resolvedNode, 'protection');
assert.equal(easyGreat.tier, SINGLE_CARD_RESULTS.GREAT_SUCCESS, 'the intended Easy approach succeeds at potency 1');

// The Hard approach matches exactly but needs potency 5; a 3 is not enough.
const swordKnight = ALL_CARD_DEFINITIONS.find(card => card.id === 'court_Swords_Knight');
const hardTooWeak = resolveSingleCardEvent({ event: ambush, card: swordKnight, run });
assert.equal(hardTooWeak.potency, 3, 'graph distance must never reduce potency');
assert.equal(hardTooWeak.resolvedNode, 'aggression');
assert.equal(hardTooWeak.tier, SINGLE_CARD_RESULTS.FAILURE, 'the Hard approach needs potency 5; a 3 cannot carry it');

// A weak routed approach still fails below its tier requirement.
const weakStrength = resolveSingleCardEvent({ event: ambush, card: strength, run });
assert.equal(weakStrength.tier, SINGLE_CARD_RESULTS.FAILURE, 'a routed approach still fails without enough potency');

const secondSet = buildSetEventDeck({
  setIndex: 1,
  previousNodes: ['aggression', 'aggression', 'compassion', 'authority', 'mystery'],
  completedEventIds: ['iron_gate'],
  rng: () => 0.25,
});
assert.equal(secondSet.length, 5);
assert.equal(new Set(secondSet).size, 5, 'a Set cannot contain duplicate Events');

console.log('Adventure single-card validation passed.');
