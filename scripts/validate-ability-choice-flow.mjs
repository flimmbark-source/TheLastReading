import assert from 'node:assert/strict';

import { ABILITY_TYPES } from '../src/data/abilities.mjs';
import { buildAbilityChoiceAsync } from '../src/app/abilityFlowAsync.mjs';

const major = (number, uid) => ({ uid, id: `major_${number}`, type: 'major', number, name: `Major ${number}` });
const court = (suit, rank, uid) => ({ uid, id: `court_${suit}_${rank}`, type: 'court', suit, rank, name: `${rank} of ${suit}` });
const sortCards = cards => cards.slice().sort((a, b) => {
  if (a.type !== b.type) return a.type.localeCompare(b.type);
  if (a.type === 'major') return a.number - b.number;
  return a.name.localeCompare(b.name);
});
const baseUi = {
  sortCards,
  cleanName: card => card.name,
  shuffleDeck: cards => cards,
  isTargetable: () => true,
};

// BETWEEN: invalid first anchors are greyed out, and the second step remains
// pair-specific. The Court card has no Court partner and must not be offered.
{
  const firstPossible = major(0, 100);
  const chosenFirst = major(2, 102);
  const otherPossible = major(3, 103);
  const invalidCourt = court('Cups', 'Page', 104);
  const onlyResult = major(1, 201);
  const targetSteps = [];

  const choice = await buildAbilityChoiceAsync(
    { type: ABILITY_TYPES.BETWEEN, count: 2, title: 'Between' },
    { deck: [onlyResult], hand: [firstPossible, chosenFirst, otherPossible, invalidCourt], spread: [], sourceCardUid: null },
    {
      ...baseUi,
      showChoice: async (_title, _prompt, cards) => {
        assert.deepEqual(cards.map(card => card.uid), [onlyResult.uid], 'Between reveals the remaining result card');
        return onlyResult;
      },
      selectTargets: async (_title, _prompt, cards) => {
        targetSteps.push(cards.map(card => card.uid));
        return targetSteps.length === 1 ? [chosenFirst] : [firstPossible];
      },
    },
  );

  assert.deepEqual(targetSteps[0], [firstPossible.uid, chosenFirst.uid, otherPossible.uid], 'Between excludes a first anchor with no legal partner');
  assert.deepEqual(targetSteps[1], [firstPossible.uid], 'the second step excludes pairs with no card remaining between them');
  assert.deepEqual(choice.anchorUids, [chosenFirst.uid, firstPossible.uid], 'Between records the submitted valid pair');
  assert.deepEqual(choice.heldCardUids, [onlyResult.uid], 'Between holds only the available result');
  assert.equal(choice.takenCardUid, onlyResult.uid, 'Between takes the chosen result card');
}

// MIRROR: a Court anchor exposes every opposite-rank card in the deck even
// though the legacy ability id/count is MIRROR_1. Invalid anchors are greyed.
{
  const queenCups = court('Cups', 'Queen', 300);
  const invalidMajor = major(0, 301);
  const knightWands = court('Wands', 'Knight', 400);
  const knightSwords = court('Swords', 'Knight', 401);
  let offeredAnchors = [];
  let offeredResults = [];

  const choice = await buildAbilityChoiceAsync(
    { type: ABILITY_TYPES.MIRROR, count: 1, title: 'Mirror' },
    { deck: [knightWands, knightSwords], hand: [queenCups, invalidMajor], spread: [], sourceCardUid: null },
    {
      ...baseUi,
      selectTargets: async (_title, _prompt, cards) => {
        offeredAnchors = cards.map(card => card.uid);
        return [queenCups];
      },
      showChoice: async (_title, _prompt, cards) => {
        offeredResults = cards.map(card => card.uid);
        return knightSwords;
      },
    },
  );

  assert.deepEqual(offeredAnchors, [queenCups.uid], 'Mirror offers only anchors with a live legal result');
  assert.deepEqual(offeredResults, [knightSwords.uid, knightWands.uid], 'Mirror offers every opposite-rank Court card for selection');
  assert.deepEqual(choice.heldCardUids, offeredResults, 'Mirror records every revealed option');
  assert.equal(choice.takenCardUid, knightSwords.uid, 'Mirror records the Knight selected by the player');
}

// NEIGHBOR: an anchor whose adjacent card is absent is not selectable.
{
  const valid = major(5, 500);
  const invalid = major(20, 501);
  const neighbor = major(6, 502);
  let offeredAnchors = [];

  const choice = await buildAbilityChoiceAsync(
    { type: ABILITY_TYPES.NEIGHBOR, count: 2, title: 'Neighbor' },
    { deck: [neighbor], hand: [valid, invalid], spread: [], sourceCardUid: null },
    {
      ...baseUi,
      selectTargets: async (_title, _prompt, cards) => {
        offeredAnchors = cards.map(card => card.uid);
        return [valid];
      },
      showChoice: async (_title, _prompt, cards) => cards[0],
    },
  );

  assert.deepEqual(offeredAnchors, [valid.uid], 'Neighbor greys an anchor with no adjacent card in the deck');
  assert.equal(choice.takenCardUid, neighbor.uid, 'Neighbor takes its legal result');
}

// KIN: only an Arcana represented in the deck is selectable.
{
  const majorAnchor = major(5, 600);
  const courtAnchor = court('Cups', 'Page', 601);
  const majorResult = major(8, 602);
  let offeredAnchors = [];

  await buildAbilityChoiceAsync(
    { type: ABILITY_TYPES.KIN, count: 2, title: 'Kin' },
    { deck: [majorResult], hand: [majorAnchor, courtAnchor], spread: [], sourceCardUid: null },
    {
      ...baseUi,
      selectTargets: async (_title, _prompt, cards) => {
        offeredAnchors = cards.map(card => card.uid);
        return [majorAnchor];
      },
      showChoice: async (_title, _prompt, cards) => cards[0],
    },
  );

  assert.deepEqual(offeredAnchors, [majorAnchor.uid], 'Kin greys an Arcana with no matching deck card');
}

// No legal anchor resolves to the deliberate fallback without opening either UI.
{
  let targetingOpened = false;
  let choiceOpened = false;
  const fallback = await buildAbilityChoiceAsync(
    { type: ABILITY_TYPES.MIRROR, count: 1, title: 'Mirror' },
    { deck: [major(8, 701)], hand: [major(0, 700)], spread: [], sourceCardUid: null },
    {
      ...baseUi,
      selectTargets: async () => { targetingOpened = true; return []; },
      showChoice: async () => { choiceOpened = true; return null; },
    },
  );
  assert.deepEqual(fallback, { kind: 'fallback', count: 1 }, 'an ability with no legal anchor falls back once');
  assert.equal(targetingOpened, false, 'no-target fallback does not open targeting');
  assert.equal(choiceOpened, false, 'no-target fallback does not open a result choice');
}

// The targeting prompt's Cancel button resolves with one explicit null marker.
// This ends the ability as a no-op instead of returning null, which the reading
// flow intentionally interprets as "retry from the first targeting step."
{
  const firstPossible = major(0, 800);
  const chosenFirst = major(2, 802);
  const onlyResult = major(1, 803);
  let choiceOpened = false;
  const cancelled = await buildAbilityChoiceAsync(
    { type: ABILITY_TYPES.BETWEEN, count: 2, title: 'Between' },
    { deck: [onlyResult], hand: [firstPossible, chosenFirst], spread: [], sourceCardUid: null },
    {
      ...baseUi,
      showChoice: async () => { choiceOpened = true; return onlyResult; },
      selectTargets: async () => [null],
    },
  );
  assert.deepEqual(cancelled, {}, 'explicit targeting cancellation ends the ability as a no-op');
  assert.equal(choiceOpened, false, 'cancellation never opens the result-card choice');
}

console.log('Ability choice flow checks passed.');
