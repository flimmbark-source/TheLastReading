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
  assert.ok(meld(result, name), `Expected meld: ${name}`);
}

function assertNoMeld(result, name) {
  assert.equal(meld(result, name), undefined, `Did not expect meld: ${name}`);
}

let result = score(['major_17', 'major_18', 'major_19']);
assert.equal(result.baseChips, 3, 'three 1-point majors should have 3 base chips');
assertMeld(result, 'Sequence of 3');
assert.equal(meld(result, 'Sequence of 3').chips, 15);
assert.equal(meld(result, 'Sequence of 3').mult, 1.25);

result = score(['major_16', 'major_17', 'major_18', 'major_19']);
assertMeld(result, 'Sequence of 3');
assertMeld(result, 'Sequence of 4');
assertNoMeld(result, 'Sequence of 5');

result = score(['major_15', 'major_16', 'major_17', 'major_18', 'major_19']);
assertMeld(result, 'Sequence of 3');
assertMeld(result, 'Sequence of 4');
assertMeld(result, 'Sequence of 5');

result = score(['major_0', 'major_1', 'major_21']);
assert.equal(result.baseChips, 15, '0/I/XXI should have 15 base chips');
assertMeld(result, 'Path of the Magi');
assert.equal(meld(result, 'Path of the Magi').chips, 15);
assert.equal(meld(result, 'Path of the Magi').mult, 2);

result = score(['court_Cups_Page', 'court_Wands_Page', 'court_Swords_Page']);
assertMeld(result, 'Three of a Kind (Pages)');
assert.equal(meld(result, 'Three of a Kind (Pages)').chips, 5);
assert.equal(meld(result, 'Three of a Kind (Pages)').mult, 1.25);

result = score(['court_Cups_Page', 'court_Wands_Page', 'court_Swords_Page', 'court_Pentacles_Page']);
assertMeld(result, 'Three of a Kind (Pages)');
assertMeld(result, 'Four of a Kind (Pages)');

result = score(['court_Cups_Page', 'court_Wands_Knight', 'court_Swords_Queen']);
assertMeld(result, 'Full Court (3)');
assert.equal(meld(result, 'Full Court (3)').mult, 1.25);
assertNoMeld(result, 'Royal Court (3, Cups)');

result = score(['court_Cups_Page', 'court_Wands_Knight', 'court_Swords_Queen', 'court_Pentacles_King']);
assertMeld(result, 'Full Court (3)');
assertMeld(result, 'Full Court (4)');
assert.equal(meld(result, 'Full Court (4)').mult, 1.25);

result = score(['court_Cups_Page', 'court_Cups_Knight', 'court_Cups_Queen']);
assertMeld(result, 'Royal Court (3, Cups)');
assert.equal(meld(result, 'Royal Court (3, Cups)').mult, 1.5);
assertNoMeld(result, 'Full Court (3)');

result = score(['court_Cups_Page', 'court_Cups_Knight', 'court_Cups_Queen', 'court_Wands_King']);
assertMeld(result, 'Royal Court (3, Cups)');
assertMeld(result, 'Full Court (4)');
assertNoMeld(result, 'Royal Court (4, Cups)');
assertNoMeld(result, 'Full Court (3)');

result = score(['court_Cups_Page', 'court_Cups_Knight', 'court_Cups_Queen', 'court_Cups_King']);
assertMeld(result, 'Royal Court (3, Cups)');
assertMeld(result, 'Royal Court (4, Cups)');
assert.equal(meld(result, 'Royal Court (4, Cups)').mult, 1.5);

// Suit Stamp: a stamped Major gains the rank and suits shown in its own card
// art, and plays as a wildcard court card for Rank and Court patterns.
result = score(['court_Cups_Queen', 'court_Wands_Queen', 'major_2'], {
  context: { stampedMajors: ['major_2'] },
});
assertMeld(result, 'Three of a Kind (Queens)');

result = score(['court_Cups_Queen', 'court_Wands_Queen', 'major_2']);
assertNoMeld(result, 'Three of a Kind (Queens)');

result = score(['court_Cups_Page', 'court_Cups_Knight', 'major_2'], {
  context: { stampedMajors: ['major_2'] },
});
assertMeld(result, 'Royal Court (3, Cups)');
assertNoMeld(result, 'Full Court (3)');

result = score(['court_Cups_Page', 'court_Cups_Knight', 'major_2']);
assertNoMeld(result, 'Royal Court (3, Cups)');
assertNoMeld(result, 'Full Court (3)');

// Two stamped Majors sharing the same rank must not double-count as distinct
// Royal Court tokens (the wildcard token is the Major's real rank now, not
// its unique card id).
result = score(['court_Cups_Page', 'major_2', 'major_17'], {
  context: { stampedMajors: ['major_2', 'major_17'] },
});
assertNoMeld(result, 'Royal Court (3, Cups)');

result = score(['court_Cups_King', 'court_Wands_King', 'court_Swords_King', 'major_1'], {
  context: { stampedMajors: ['major_1'] },
});
assertMeld(result, 'Three of a Kind (Kings)');
assertMeld(result, 'Four of a Kind (Kings)');

result = score(['major_17', 'court_Cups_Page'], {
  upgrades: { balanced_reading: 1 },
});
assertMeld(result, 'Balanced Reading');
assert.equal(meld(result, 'Balanced Reading').chips, 5);
assert.equal(meld(result, 'Balanced Reading').mult, 1.25);

result = score(['court_Cups_Page', 'court_Wands_Knight', 'court_Swords_Queen', 'court_Pentacles_King'], {
  upgrades: { elemental_harmony: 1 },
});
assertMeld(result, 'Elemental Harmony');
assert.equal(meld(result, 'Elemental Harmony').chips, 10);
assert.equal(meld(result, 'Elemental Harmony').mult, 1.25);

console.log('Scoring validation cases passed.');
