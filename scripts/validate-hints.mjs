import assert from 'node:assert/strict';
import { getCardHints, HINT_LEVELS } from '../src/systems/hints.mjs';
import { SCORING_PATTERNS } from '../src/data/scoringPatterns.mjs';

function page(uid, suit) {
  return {
    uid,
    id: `court_${suit}_Page`,
    type: 'court',
    rank: 'Page',
    suit,
    name: `Page of ${suit}`,
    points: 2,
  };
}

function hasHint(hints, level, label) {
  return hints.some(hint => hint.level === level && hint.label === label);
}

const cards = [
  page(1001, 'Cups'),
  page(1002, 'Wands'),
  page(1003, 'Swords'),
];

// A set relationship must remain visible when one member moves into the spread.
const splitState = {
  spread: [cards[0], null, null, null, null],
  hand: [cards[1], cards[2]],
};

for (const card of cards) {
  const hints = getCardHints(card, splitState, { poolCards: cards });
  assert.ok(
    hasHint(hints, HINT_LEVELS.NEAR, SCORING_PATTERNS.THREE_OF_A_KIND.label),
    `split hand/spread Page ${card.uid} keeps its Three of a Kind hint`,
  );
}

// Once all three are placed, every participating card must keep the completed
// set glow. This specifically catches treating a placed card as a duplicate
// candidate appended to the spread.
const completedState = {
  spread: [cards[0], cards[1], cards[2], null, null],
  hand: [],
};

for (const card of cards) {
  const hints = getCardHints(card, completedState, { poolCards: cards });
  assert.ok(
    hasHint(hints, HINT_LEVELS.COMPLETE, SCORING_PATTERNS.THREE_OF_A_KIND.label),
    `placed Page ${card.uid} keeps its completed Three of a Kind hint`,
  );
}

console.log('Hint persistence checks passed.');
