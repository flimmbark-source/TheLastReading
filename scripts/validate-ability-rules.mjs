import assert from 'node:assert/strict';

import { ABILITY_TYPES, getAbility } from '../src/data/abilities.mjs';
import { ACTIONS } from '../src/game/actions.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { createGameState } from '../src/game/state.mjs';
import { buildDeck } from '../src/systems/deck.mjs';
import {
  abilityHeldCards,
  abilityWithRevealUpgrades,
  betweenCardIds,
  mirrorCardId,
  mirrorCardIds,
  neighborCardIds,
  validHandTargetsForAbility,
} from '../src/systems/abilities.mjs';

const deck = buildDeck();
const byId = new Map(deck.map(card => [card.id, card]));
const clone = (id, uid) => ({ ...byId.get(id), uid });

// Mirror: Majors remain singular; Courts mirror by opposite rank across suits.
assert.equal(mirrorCardId(byId.get('major_18')), 'major_3', 'Moon has one singular Major mirror');
assert.equal(mirrorCardId(byId.get('court_Cups_Queen')), null, 'Court mirrors require the plural API');
assert.deepEqual(
  mirrorCardIds(byId.get('court_Cups_Queen')),
  ['court_Cups_Knight', 'court_Wands_Knight', 'court_Swords_Knight', 'court_Pentacles_Knight'],
  'a Queen can mirror to every Knight regardless of suit',
);

const queenCups = clone('court_Cups_Queen', 5001);
const knightWands = clone('court_Wands_Knight', 5002);
const knightSwords = clone('court_Swords_Knight', 5003);
const unrelatedKing = clone('court_Cups_King', 5004);
const mirrorHeld = abilityHeldCards(
  [knightWands, unrelatedKing, knightSwords],
  getAbility('MIRROR_1'),
  [queenCups],
);
assert.deepEqual(mirrorHeld.map(card => card.uid), [knightWands.uid, knightSwords.uid], 'Mirror returns every available opposite-rank card and nothing else');

const mirrorTargets = validHandTargetsForAbility('MIRROR_1', {
  hand: [queenCups, unrelatedKing, clone('major_0', 5005)],
  deck: [knightWands, knightSwords],
});
assert.deepEqual(mirrorTargets.map(card => card.uid), [queenCups.uid], 'only anchors with a live Mirror result are legal targets');

// Neighbor: Major adjacency is numeric; Court adjacency stays within suit.
assert.deepEqual(neighborCardIds(byId.get('major_18')), ['major_17', 'major_19'], 'Major Neighbor uses adjacent numbers');
assert.deepEqual(
  neighborCardIds(byId.get('court_Cups_Queen')),
  ['court_Cups_Knight', 'court_Cups_King'],
  'Court Neighbor uses adjacent ranks in the same suit',
);
const neighborTargets = validHandTargetsForAbility('NEIGHBOR_2', {
  hand: [clone('court_Cups_Queen', 5010), clone('court_Wands_Queen', 5011)],
  deck: [clone('court_Cups_Knight', 5012)],
});
assert.deepEqual(neighborTargets.map(card => card.uid), [5010], 'Neighbor greys anchors whose adjacent cards are not in the deck');

// Kin: same Arcana means Major with Major or Court with Court.
const kinMajor = clone('major_5', 5020);
const kinCourt = clone('court_Cups_Page', 5021);
assert.deepEqual(
  abilityHeldCards([clone('major_8', 5022), clone('court_Wands_King', 5023)], getAbility('KIN_2'), [kinMajor]).map(card => card.uid),
  [5022],
  'Kin reveals only cards of the anchor Arcana',
);
assert.deepEqual(
  validHandTargetsForAbility('KIN_2', { hand: [kinMajor, kinCourt], deck: [clone('major_8', 5024)] }).map(card => card.uid),
  [kinMajor.uid],
  'Kin greys an Arcana with no matching card in the deck',
);

// Between: both anchors must share an Arcana and have a live result between them.
assert.deepEqual(betweenCardIds(byId.get('major_5'), byId.get('major_8')), ['major_6', 'major_7'], 'Major Between returns the strict numeric interior');
assert.deepEqual(
  validHandTargetsForAbility('BETWEEN_2', {
    hand: [clone('major_5', 5030), clone('major_8', 5031), clone('court_Cups_Page', 5032)],
    deck: [clone('major_7', 5033)],
  }).map(card => card.uid),
  [5030, 5031],
  'Between greys anchors that have no legal partner producing a live deck result',
);

// Reveal upgrades: Deeper Threads now affects Between; Mirror is already reveal-all.
assert.equal(
  abilityWithRevealUpgrades(getAbility('BETWEEN_2'), { relation_plus: 2 }).count,
  4,
  'Deeper Threads increases Between reveal count',
);
assert.equal(
  abilityWithRevealUpgrades(getAbility('NEIGHBOR_2'), { lens_mastery: 1, relation_plus: 1 }).count,
  4,
  'Lens Mastery and Deeper Threads both increase Neighbor',
);
assert.equal(
  abilityWithRevealUpgrades(getAbility('KIN_2'), { lens_mastery: 1, relation_plus: 1 }).count,
  4,
  'Lens Mastery and Deeper Threads both increase Kin',
);
assert.equal(
  abilityWithRevealUpgrades(getAbility('MIRROR_1'), { lens_mastery: 5 }).count,
  1,
  'Mirror does not apply a meaningless reveal bonus when every legal mirror is already shown',
);

// Shuffle / Full Reset intentionally leaves the placed spread intact.
const placed = clone('major_17', 5040);
let worldState = createGameState({
  run: {
    deck: [clone('major_1', 5041)],
    hand: [clone('major_2', 5042)],
    discard: [clone('major_3', 5043)],
    spread: [placed, null, null, null, null],
    ability: { id: 'WORLD' },
    busy: true,
  },
});
worldState = reducer(worldState, {
  type: ACTIONS.RESOLVE_ABILITY,
  result: { kind: 'world', handSize: 2 },
  rng: () => 0,
});
assert.equal(worldState.run.spread[0]?.uid, placed.uid, 'Shuffle preserves cards already placed in the spread');
assert.equal(worldState.run.spread.filter(Boolean).length, 1, 'Shuffle does not add or remove spread cards');
assert.match(getAbility('WORLD').prompt, /spread stays in place/i, 'Shuffle text states that the spread is preserved');

// Non-targeted abilities retain their basic definitions.
for (const id of ['DRAW_1', 'DRAW_2', 'DRAW_3', 'PEEK_3', 'PEEK_5', 'SEARCH', 'WORLD']) {
  assert.ok(getAbility(id), `${id} remains defined`);
}
assert.equal(getAbility('SEARCH').type, ABILITY_TYPES.SEARCH, 'Search retains its non-anchor ability type');

console.log('Ability rule checks passed.');
