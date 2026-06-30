import assert from 'node:assert/strict';

import { selectMarketAmbienceEntry } from '../src/ui/renderMarket.mjs';

const target = {
  _lastMarketAmbienceFile: null,
  Math: { random: () => 0 },
};

const first = selectMarketAmbienceEntry(target);
const second = selectMarketAmbienceEntry(target);
const third = selectMarketAmbienceEntry(target);

assert.notEqual(second.file, first.file, 'market ambience should not repeat the previous track');
assert.notEqual(third.file, second.file, 'market ambience should continue rotating away from the previous track');
assert.equal(target._lastMarketAmbienceFile, third.file, 'last market ambience track should be stored for the next store opening');

console.log('Market ambience validation cases passed.');
