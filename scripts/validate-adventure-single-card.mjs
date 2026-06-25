import assert from 'node:assert/strict';
import { ALL_CARD_DEFINITIONS } from '../src/data/cards.mjs';
import { ADVENTURE_EVENTS } from '../src/data/adventure/events.mjs';
import { missingCardNodeIds, cardAdventureProfile } from '../src/data/adventure/cardNodes.mjs';
import { routeNode } from '../src/systems/adventure/nodeGraph.mjs';
import {
  SINGLE_CARD_RESULTS,
  createSingleCardRunState,
  resolveSingleCardEvent,
  buildSetEventDeck,
} from '../src/systems/adventure/singleCardRun.mjs';

assert.deepEqual(missingCardNodeIds(ALL_CARD_DEFINITIONS), [], 'every current card needs exactly one authored Adventure node');

const strength = ALL_CARD_DEFINITIONS.find(card => card.id === 'major_8');
assert.deepEqual(cardAdventureProfile(strength), { node: 'physical', potency: 1 }, 'potency must remain the printed card number');

const exact = routeNode('compassion', ['aggression', 'compassion', 'deception']);
assert.deepEqual(exact, { sourceNode: 'compassion', resolvedNode: 'compassion', exact: true, distance: 0 });

const indirect = routeNode('physical', ['aggression', 'compassion', 'deception']);
assert.equal(indirect.resolvedNode, 'aggression');
assert.equal(indirect.exact, false);
assert.equal(indirect.distance, 1);

const ambush = ADVENTURE_EVENTS.find(event => event.id === 'ambush');
const run = createSingleCardRunState(() => 0.5);

const swordKnight = ALL_CARD_DEFINITIONS.find(card => card.id === 'court_Swords_Knight');
const indirectSuccess = resolveSingleCardEvent({ event: ambush, card: swordKnight, run });
assert.equal(indirectSuccess.potency, 3, 'graph distance must never reduce potency');
assert.equal(indirectSuccess.resolvedNode, 'aggression');
assert.equal(indirectSuccess.tier, SINGLE_CARD_RESULTS.GREAT_SUCCESS, 'an exact Aggression node with enough potency is a Great Success');

const wandKnight = ALL_CARD_DEFINITIONS.find(card => card.id === 'court_Wands_Knight');
const routedSuccess = resolveSingleCardEvent({ event: ambush, card: wandKnight, run });
assert.equal(routedSuccess.potency, 3);
assert.equal(routedSuccess.resolvedNode, 'aggression');
assert.equal(routedSuccess.tier, SINGLE_CARD_RESULTS.SUCCESS, 'a nearby node with enough potency is a normal Success');

const weakStrength = resolveSingleCardEvent({ event: ambush, card: strength, run });
assert.equal(weakStrength.tier, SINGLE_CARD_RESULTS.FAILURE, 'an exact or routed idea still fails when potency is below the branch requirement');

const secondSet = buildSetEventDeck({
  setIndex: 1,
  previousNodes: ['aggression', 'aggression', 'compassion', 'authority', 'mystery'],
  completedEventIds: ['iron_gate'],
  rng: () => 0.25,
});
assert.equal(secondSet.length, 5);
assert.equal(new Set(secondSet).size, 5, 'a Set cannot contain duplicate Events');

console.log('Adventure single-card validation passed.');
