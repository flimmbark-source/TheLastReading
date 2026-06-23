import assert from 'node:assert/strict';

import { ABILITY_TYPES } from '../src/data/abilities.mjs';
import { buildAbilityChoiceAsync } from '../src/app/abilityFlowAsync.mjs';

const major = (number, uid) => ({ uid, id: `major_${number}`, type: 'major', number, name: `Major ${number}` });
const firstPossible = major(0, 100);
const chosenFirst = major(2, 102);
const invalidSecond = major(3, 103);
const onlyResult = major(1, 201);
const targetSteps = [];

const choice = await buildAbilityChoiceAsync(
  { type: ABILITY_TYPES.BETWEEN, count: 2, title: 'Between' },
  { deck: [onlyResult], hand: [firstPossible, chosenFirst, invalidSecond], spread: [], sourceCardUid: null },
  {
    showChoice: async (_title, _prompt, cards) => {
      assert.deepEqual(cards.map(card => card.uid), [onlyResult.uid], 'Between reveals the remaining result card');
      return onlyResult;
    },
    selectTargets: async (_title, _prompt, cards) => {
      targetSteps.push(cards.map(card => card.uid));
      return targetSteps.length === 1 ? [chosenFirst] : [firstPossible];
    },
    sortCards: cards => cards.slice().sort((a, b) => a.number - b.number),
    cleanName: card => card.name,
    shuffleDeck: cards => cards,
    isTargetable: () => true,
  },
);

assert.deepEqual(targetSteps[0], [firstPossible.uid, chosenFirst.uid, invalidSecond.uid], 'all anchors with at least one valid partner are offered first');
assert.deepEqual(targetSteps[1], [firstPossible.uid], 'the second step excludes a pair with no card remaining between it');
assert.deepEqual(choice.anchorUids, [chosenFirst.uid, firstPossible.uid], 'Between records the submitted valid pair');
assert.deepEqual(choice.heldCardUids, [onlyResult.uid], 'Between holds only the available result');
assert.equal(choice.takenCardUid, onlyResult.uid, 'Between takes the chosen result card');

// The Cancel button resolves the targeting promise with no cards; this must exit
// the ability builder cleanly instead of treating an empty array as a valid pick.
{
  let choiceOpened = false;
  const cancelled = await buildAbilityChoiceAsync(
    { type: ABILITY_TYPES.BETWEEN, count: 2, title: 'Between' },
    { deck: [onlyResult], hand: [firstPossible, chosenFirst, invalidSecond], spread: [], sourceCardUid: null },
    {
      showChoice: async () => { choiceOpened = true; return onlyResult; },
      selectTargets: async () => [],
      sortCards: cards => cards.slice().sort((a, b) => a.number - b.number),
      cleanName: card => card.name,
      shuffleDeck: cards => cards,
      isTargetable: () => true,
    },
  );
  assert.equal(cancelled, null, 'empty target selection is treated as cancellation');
  assert.equal(choiceOpened, false, 'cancellation never opens the result-card choice');
}

console.log('Ability choice flow checks passed.');
