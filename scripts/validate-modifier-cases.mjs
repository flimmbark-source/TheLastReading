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
assert.equal(found.chips, 20, 'sequence upgrade should add 5 chips to each completed tier');
assert.equal(found.mult, 1.5, 'seq_mult upgrade should add 0.25 pattern mult to each completed tier');

result = score(['major_17', 'major_18', 'major_19', 'major_20', 'major_21'], {
  upgrades: { sequence: 1, seq_mult: 1 },
});
assert.equal(assertMeld(result, 'Sequence of 3').mult, 1.5, 'long sequences should retain the tier-3 reward');
assert.equal(assertMeld(result, 'Sequence of 4').mult, 1.5, 'long sequences should retain the tier-4 reward');
assert.equal(assertMeld(result, 'Sequence of 5').mult, 1.5, 'long sequences should score every completed tier');

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
assert.equal(found.chips, 30, 'path_chips upgrade should add 15 chips');
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
assert.equal(assertMeld(result, 'Major Arcana').chips, 4, 'legacy major_chips saves should still score');
assert.equal(assertMeld(result, 'Minor Arcana').chips, 1, 'legacy minor_chips saves should still score');
assert.equal(assertMeld(result, 'Cups').chips, 2, 'legacy cups_chips saves should still score');
assert.equal(assertMeld(result, 'Ritual Mult').mult, 0.25, 'dormant flat_mult should still score');
assert.equal(assertMeld(result, 'Major Arcana Mult').mult, 0.2, 'dormant major_mult should still score');
assert.equal(assertMeld(result, 'Minor Arcana Mult').mult, 0.05, 'dormant minor_mult should still score');
assert.equal(assertMeld(result, 'Cups Mult').mult, 0.05, 'dormant cups_mult should still score');

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
assert.equal(assertMeld(result, 'The Still Pool').mult, 0.75, 'Still Pool should add 0.75 mult when no discards were used');

result = score(['major_17', 'major_18'], {
  relics: ['still_pool'],
  context: { discardedCount: 1 },
});
assert.equal(meld(result, 'The Still Pool'), undefined, 'Still Pool should not trigger after a discard');

result = score(['court_Cups_Page', 'court_Wands_Page', 'court_Cups_King', 'court_Wands_King'], {
  relics: ['mirror_shard'],
});
assert.equal(assertMeld(result, 'Mirror Shard').mult, 1, 'Mirror Shard should add 0.5 mult per matching Court pair');

result = score(['court_Cups_Page', 'court_Wands_Page', 'court_Swords_Page'], {
  relics: ['lovers_knot', 'strengths_grip', 'court_favor'],
});
assert.equal(assertMeld(result, "The Lovers' Knot").mult, 1, "Lovers' Knot should reward three matching Court ranks");
assert.equal(assertMeld(result, 'Strength').mult, 1, 'Strength should reward exactly three Court cards');
assert.equal(assertMeld(result, 'Court Favor').mult, 0.75, 'Court Favor should add 0.25 mult per Court');

result = score(['court_Cups_Page', 'court_Wands_Knight', 'court_Swords_Queen'], {
  relics: ['loaded_die'],
});
assert.equal(assertMeld(result, 'Loaded Die').chips, 9, 'Loaded Die should add court card point totals');

console.log('Modifier validation cases passed.');
