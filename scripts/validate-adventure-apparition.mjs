import assert from 'node:assert/strict';
import {
  playAggressionApparition,
  AGGRESSION_APPARITION_DURATION_MS,
} from '../src/app/apparitions/aggressionApparition.mjs';
import {
  playAdventureInteractionFx,
  installAdventureInteractionFxV8,
} from '../src/app/adventureInteractionFxV8.mjs';

// The Aggression apparition is now generated from code rather than a baked
// WebP/sprite sheet, so we validate the runtime contract instead of image bytes.
assert.equal(typeof playAggressionApparition, 'function', 'apparition must export a play function');
assert.ok(
  Number.isFinite(AGGRESSION_APPARITION_DURATION_MS) && AGGRESSION_APPARITION_DURATION_MS >= 1000,
  'apparition should advertise its full on-screen duration',
);

assert.equal(typeof playAdventureInteractionFx, 'function', 'V8 must export the FX entry point');
assert.equal(typeof installAdventureInteractionFxV8, 'function', 'V8 must export its installer');

// It must degrade gracefully when there is no host document / valid anchor,
// returning false rather than throwing so the outcome animation can proceed.
const ranWithoutDoc = await playAggressionApparition({}, { left: 0, top: 0, width: 100, height: 140 });
assert.equal(ranWithoutDoc, false, 'apparition should no-op without a document');

const ranWithoutRect = await playAggressionApparition({ document: {} }, { width: 0, height: 0 });
assert.equal(ranWithoutRect, false, 'apparition should no-op without a sized anchor');

console.log('Adventure apparition validation passed.');
