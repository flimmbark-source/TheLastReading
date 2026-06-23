import assert from 'node:assert/strict';

import { computeScore } from '../src/systems/scoring.mjs';
import { scoreLegacy } from '../src/app/scoringRuntime.mjs';
import { shouldAnnounceMeld } from '../src/app/placementRuntime.mjs';

const major = (number, uid) => ({ uid, id: `major_${number}`, type: 'major', number, points: 1 });
const court = (rank, suit, uid) => ({ uid, id: `${rank}_${suit}`, type: 'court', rank, suit, points: 1 });

const cards = [
  major(0, 1),
  major(1, 2),
  major(2, 3),
  court('Page', 'Cups', 4),
];

const result = computeScore(cards, {
  upgrades: {
    first_light: 1,
    balanced_reading: 1,
  },
});

const firstLight = result.melds.find(meld => meld.name === 'First Light');
const balanced = result.melds.find(meld => meld.name === 'Balanced Reading');
const sequence = result.melds.find(meld => meld.name === 'Sequence of 3');

assert.equal(firstLight?.source, 'upgrade', 'flat store upgrades are marked as upgrade scoring entries');
assert.equal(balanced?.source, 'upgrade', 'upgrade-based pseudo-patterns are marked as upgrade scoring entries');
assert.equal(sequence?.source, 'pattern', 'real scoring patterns remain marked as patterns');

assert.equal(
  shouldAnnounceMeld([firstLight.name, firstLight.chips, firstLight.mult, firstLight.mode, firstLight.source], {}),
  false,
  'flat upgrades do not create centered pattern announcements',
);
assert.equal(
  shouldAnnounceMeld([balanced.name, balanced.chips, balanced.mult, balanced.mode, balanced.source], {}),
  false,
  'upgrade-based pseudo-patterns do not create centered pattern announcements',
);
assert.equal(
  shouldAnnounceMeld([sequence.name, sequence.chips, sequence.mult, sequence.mode, sequence.source], {}),
  true,
  'real scoring patterns still create centered announcements',
);

const target = {
  tlrRuntime: {
    state: { hand: [], discardedCards: [] },
    persist: { up: { first_light: 1 }, relics: [] },
  },
  tlrScoring: { computeScore },
};
const legacy = scoreLegacy([major(5, 9)], {}, target);
assert.equal(
  legacy.melds.find(meld => meld[0] === 'First Light')?.[4],
  'upgrade',
  'legacy scoring tuples preserve upgrade source metadata for placement',
);

console.log('Upgrade announcement checks passed.');
