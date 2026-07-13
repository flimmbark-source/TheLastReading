// Pilot RECOVERY stage. Unlike the card-first events, recovery is a small,
// explicit menu that supports the new state model: rest reduces strain, treat
// removes Wounded when a treatment exists, gather adds a named material within
// the three-slot capacity, and cleanse eases a supernatural attachment when a
// cleansing source is present. Recovery does not automatically repay every
// Compassion or Creation cost.

import { PILOT_MATERIALS } from './vocab.mjs';

const MATERIAL_POOL = ['timber', 'cloth', 'oil', 'worked_iron'];

// Deterministically choose three distinct materials to offer, given a seeded
// value in [0,1).
function gatherOptions(seedValue) {
  const pool = [...MATERIAL_POOL];
  const chosen = [];
  let v = seedValue;
  while (chosen.length < 3 && pool.length) {
    v = (v * 9301 + 49297) % 233280 / 233280;
    const index = Math.floor(v * pool.length) % pool.length;
    chosen.push(pool.splice(index, 1)[0]);
  }
  return chosen;
}

export const RECOVERY_EVENT = {
  id: 'recovery',
  title: 'A Place to Rest',
  kind: 'recovery',
  description:
    'The road offers a pause — a dry hollow, a cold spring, a windbreak of stone. You will not get another before the road turns hard again. Spend the respite on one thing.',
};

// Returns the recovery choices available for this run. `seedValue` is a
// deterministic value used only to pick the three gather materials.
export function buildRecoveryChoices(run, seedValue = 0.5) {
  const choices = [];

  if (run.strain !== 'clear') {
    choices.push({
      id: 'rest',
      label: 'Rest',
      description: 'Reduce your strain by one stage.',
      effects: { reduceStrain: 1 },
      consequenceLines: ['You rested and recovered some strength.', 'Your strain eased by one stage.', 'The road still waits ahead.'],
    });
  } else {
    choices.push({
      id: 'rest',
      label: 'Rest',
      description: 'Already clear — recover a provision instead.',
      effects: { addProvisions: 1 },
      consequenceLines: ['You were already rested, so you resupplied.', 'You gained a provision.', 'The road still waits ahead.'],
    });
  }

  if (run.statuses.includes('wounded') && run.items.includes('healing_salve')) {
    choices.push({
      id: 'treat',
      label: 'Treat the wound',
      description: 'Consume Healing Salve to remove Wounded.',
      effects: { removeStatuses: ['wounded'], consumeItems: ['healing_salve'] },
      consequenceLines: ['You dressed the wound with the salve.', 'You are no longer Wounded.', 'The salve is spent.'],
    });
  }

  const options = gatherOptions(seedValue);
  const firstAffordable = options.find(mat => run.materials.length < 3) || options[0];
  choices.push({
    id: 'gather',
    label: `Gather ${PILOT_MATERIALS[firstAffordable].name}`,
    description: run.materials.length < 3 ? `Add ${PILOT_MATERIALS[firstAffordable].name} to your materials.` : 'Your materials are full.',
    gatherOptions: options,
    effects: run.materials.length < 3 ? { addMaterials: [firstAffordable] } : {},
    consequenceLines:
      run.materials.length < 3
        ? [`You gathered ${PILOT_MATERIALS[firstAffordable].name}.`, 'It joins your materials.', 'The road still waits ahead.']
        : ['Your material slots are full.', 'You gathered nothing.', 'The road still waits ahead.'],
  });

  const canCleanse =
    (run.statuses.includes('haunted') || run.statuses.includes('deeply_haunted')) &&
    (run.statuses.includes('blessed') || run.items.includes('roadkeepers_lamp') || run.items.includes('gravekeepers_candle'));
  if (canCleanse) {
    const deep = run.statuses.includes('deeply_haunted');
    choices.push({
      id: 'cleanse',
      label: 'Cleanse',
      description: deep ? 'Reduce Deeply Haunted to Haunted.' : 'Remove Haunted.',
      effects: deep
        ? { removeStatuses: ['deeply_haunted', 'blessed'], addStatuses: ['haunted'] }
        : { removeStatuses: ['haunted', 'blessed'] },
      consequenceLines: deep
        ? ['You spent your cleansing source on the presence.', 'Deeply Haunted eased to Haunted.', 'The worst of it has receded.']
        : ['You spent your cleansing source on the presence.', 'You are no longer Haunted.', 'Your thoughts are your own again.'],
    });
  }

  return choices;
}
