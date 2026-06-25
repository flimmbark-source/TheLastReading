import assert from 'node:assert/strict';
import {
  playAggressionApparition,
  AGGRESSION_APPARITION_DURATION_MS,
} from '../src/app/apparitions/aggressionApparition.mjs';
import { apparitionFor } from '../src/app/apparitions/registry.mjs';
import { NODE_APPARITION_SPECS } from '../src/app/apparitions/nodeApparitions.mjs';
import { ACTION_NODES } from '../src/data/adventure/nodes.mjs';
import {
  playAdventureInteractionFx,
  installAdventureInteractionFxV9,
} from '../src/app/adventureInteractionFxV9.mjs';
import { playEventOutcome } from '../src/app/apparitions/outcomes.mjs';

// Apparitions are generated from code rather than baked sprites/WebP, so we
// validate the runtime contract instead of image bytes.
assert.equal(typeof playAggressionApparition, 'function', 'aggression must export a play function');
assert.ok(
  Number.isFinite(AGGRESSION_APPARITION_DURATION_MS) && AGGRESSION_APPARITION_DURATION_MS >= 1000,
  'aggression should advertise its full on-screen duration',
);

assert.equal(typeof playAdventureInteractionFx, 'function', 'V9 must export the FX entry point');
assert.equal(typeof installAdventureInteractionFxV9, 'function', 'V9 must export its installer');

// Code-driven Event outcomes degrade gracefully without a host document.
assert.equal(typeof playEventOutcome, 'function', 'outcomes must export a play function');
for (const tier of ['failure', 'success', 'great_success']) {
  const ran = await playEventOutcome({}, { root: null, card: null, rect: { left: 0, top: 0, width: 100, height: 140 }, tier });
  assert.equal(ran, false, `outcome ${tier} should no-op without a host`);
}

// Every action node must resolve to an apparition play function, and each must
// degrade gracefully (return false, not throw) without a host document.
const anchor = { left: 0, top: 0, width: 100, height: 140 };
for (const node of Object.values(ACTION_NODES)) {
  const play = apparitionFor(node);
  assert.equal(typeof play, 'function', `node ${node} must have an apparition`);
  const ran = await play({}, anchor, { potency: 3 });
  assert.equal(ran, false, `node ${node} apparition should no-op without a document`);
}

// Each non-Aggression spec must declare a tone, a build and a run step.
for (const [node, spec] of Object.entries(NODE_APPARITION_SPECS)) {
  assert.ok(spec.tone && spec.tone.accent, `spec ${node} must declare a tone`);
  assert.equal(typeof spec.build, 'function', `spec ${node} must declare build()`);
  assert.equal(typeof spec.run, 'function', `spec ${node} must declare run()`);
}

assert.equal(
  apparitionFor('definitely-not-a-node'), null,
  'unknown nodes should have no apparition (so V6 can take over)',
);

console.log('Adventure apparition validation passed.');
