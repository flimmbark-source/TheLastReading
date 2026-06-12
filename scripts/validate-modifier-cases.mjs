import assert from 'node:assert/strict';

import { buildDeck } from '../src/systems/deck.mjs';
import { computeScore } from '../src/systems/scoring.mjs';

const deck = buildDeck();
const byId = new Map(deck.map(card => [card.id, card]));

function cards(ids) {
  return ids.map(id => {
    const card = byId.get(id);
    assert.ok(card, `Unknown card id: ${id}`);
    return card;
  });
}

function score(ids, options = {}) {
  return computeScore(cards(ids), options);
}

function meld(result, name) {
  return result.melds.find(entry => entry.name === name);
}

function assertMeld(result, name) {
  const found = meld(result, name);
  assert.ok(found, `Expected meld: ${name}`);
  return found;
}

let result = score(['court_Cups_Page', 'court_Wands_Page', 'court_Swords_Page'], {
  upgrades: { rank: 1, rank_mult: 1 },
});
let found = assertMeld(result, 'Three of a Kind (Pages)');
assert.equal(found.chips, 10, 'rank upgrade should add 5 chips');
assert.equal(found.mult, 1.5, 'rank_mult upgrade should add 0.25 pattern mult');

result = score(['major_17', 'major_18', 'major_19'], {
  upgrades: { sequence: 1, seq_mult: 1 },
});
found = assertMeld(result, 'Sequence of 3');
assert.equal(found.chips, 15, 'sequence upgrade should add 5 chips');
assert.equal(found.mult, 1.75, 'seq_mult upgrade should add 0.5 pattern mult');

result = score(['court_Cups_Page', 'court_Cups_Knight', 'court_Cups_Queen'], {
  upgrades: { royal_court_chips: 1, royal_court_mult: 1 },
});
found = assertMeld(result, 'Royal Court (3, Cups)');
assert.equal(found.chips, 18, 'royal_court_chips upgrade should add 8 chips');
assert.equal(found.mult, 1.75, 'royal_court_mult upgrade should add 0.25 pattern mult');

result = score(['major_0', 'major_1', 'major_21'], {
  upgrades: { path_chips: 1, path_mult: 1 },
});
found = assertMeld(result, 'Path of the Magi');
assert.equal(found.chips, 25, 'path_chips upgrade should add 15 chips');
assert.equal(found.mult, 2.5, 'path_mult upgrade should add 0.5 pattern mult');

result = score(['major_17', 'major_18', 'court_Cups_Page'], {
  upgrades: {
    major_chips: 1,
    minor_chips: 1,
    cups_chips: 2,
    flat_mult: 1,
    major_mult: 1,
    minor_mult: 1,
    cups_mult: 1,
  },
});
assert.equal(assertMeld(result, 'Major Arcana').chips, 4, 'major_chips should add 2 per major');
assert.equal(assertMeld(result, 'Minor Arcana').chips, 1, 'minor_chips should add 1 per minor');
assert.equal(assertMeld(result, 'Cups').chips, 2, 'cups_chips should add per Cup card');
assert.equal(assertMeld(result, 'Ritual Mult').mult, 0.25, 'flat_mult should add additive mult');
assert.equal(assertMeld(result, 'Major Arcana Mult').mult, 0.2, 'major_mult should add 0.10 per major');
assert.equal(assertMeld(result, 'Minor Arcana Mult').mult, 0.05, 'minor_mult should add 0.05 per minor');
assert.equal(assertMeld(result, 'Cups Mult').mult, 0.05, 'cups_mult should add 0.05 per Cup');

result = score(['major_17'], {
  upgrades: { first_light: 2 },
});
assert.equal(assertMeld(result, 'First Light').chips, 6, 'first_light should add 3 chips per level');

result = score(['major_17'], {
  upgrades: { deep_reserve: 2, quick_release: 1 },
  context: { handCount: 3, discardedCount: 2 },
});
assert.equal(assertMeld(result, 'Deep Reserve').chips, 12, 'deep_reserve should scale with cards left in hand');
assert.equal(assertMeld(result, 'Quick Release').chips, 6, 'quick_release should scale with discarded cards');

result = score(['major_17', 'major_18'], {
  relics: ['gilded_fool', 'hermit_lantern', 'still_pool'],
  context: { discardedCount: 0 },
});
assert.equal(assertMeld(result, 'The Gilded Fool').chips, 10, 'Gilded Fool should add 10 chips');
assert.equal(assertMeld(result, "Hermit's Lantern").mult, 0.5, "Hermit's Lantern should add 0.25 mult per major");
assert.equal(assertMeld(result, 'The Still Pool').mult, 1, 'Still Pool should add 1 mult when no discards were used');

result = score(['major_17', 'major_18'], {
  relics: ['still_pool'],
  context: { discardedCount: 1 },
});
assert.equal(meld(result, 'The Still Pool'), undefined, 'Still Pool should not trigger after a discard');

result = score(['major_17', 'major_17', 'court_Cups_Page', 'court_Wands_Page'], {
  relics: ['mirror_shard'],
});
assert.equal(assertMeld(result, 'Mirror Shard').mult, 2, 'Mirror Shard should add 1 mult per pair');

result = score(['court_Cups_Page', 'court_Wands_Knight', 'court_Swords_Queen'], {
  relics: ['loaded_die'],
});
assert.equal(assertMeld(result, 'Loaded Die').chips, 9, 'Loaded Die should add court card point totals');

console.log('Modifier validation cases passed.');
