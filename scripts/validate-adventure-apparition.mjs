import assert from 'node:assert/strict';
import {
  AGGRESSION_WEBP_DATA_URL,
  AGGRESSION_WEBP_DURATION_MS,
} from '../src/app/apparitions/aggressionWebp.mjs';

const prefix = 'data:image/webp;base64,';
assert.ok(AGGRESSION_WEBP_DATA_URL.startsWith(prefix), 'Aggression apparition must be an embedded WebP data URL');

const bytes = Buffer.from(AGGRESSION_WEBP_DATA_URL.slice(prefix.length), 'base64');
assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF', 'Aggression apparition must have a RIFF header');
assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WEBP', 'Aggression apparition must have a WEBP signature');
assert.ok(bytes.length > 8000, 'Aggression apparition data should contain the complete animated clip');
assert.ok(AGGRESSION_WEBP_DURATION_MS >= 1000, 'Aggression apparition should remain visible for its full first playback');

console.log('Adventure apparition validation passed.');
