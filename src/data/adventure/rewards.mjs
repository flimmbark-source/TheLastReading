// Adventure Mode — reward types and offer generation.
//
// Rewards are granted after Success (show 3, choose 1) or Triumph (show 4,
// choose 2). Relics and statuses can adjust those counts; that adjustment is
// applied in run.mjs, which owns the run context the generator needs.

export const REWARD_TYPES = Object.freeze({
  ADD_CARD: 'ADD_CARD',
  REMOVE_CARD: 'REMOVE_CARD',
  RESTORE_RESOLVE: 'RESTORE_RESOLVE',
  REMOVE_STATUS: 'REMOVE_STATUS',
  GAIN_RELIC: 'GAIN_RELIC',
});

// How many rewards are shown / chosen by result tier.
export const REWARD_OFFER_RULES = Object.freeze({
  success: { show: 3, choose: 1 },
  triumph: { show: 4, choose: 2 },
});

// Prototype reward templates. `weight` biases the random pool; some templates
// are only meaningful when the run is in a particular state (e.g. there is a
// status to remove), gated by `available`.
export const REWARD_TEMPLATES = Object.freeze([
  {
    type: REWARD_TYPES.RESTORE_RESOLVE,
    weight: 3,
    label: 'Restore 1 Resolve',
    amount: 1,
    available: run => run.resolve < run.maxResolve,
  },
  {
    type: REWARD_TYPES.ADD_CARD,
    weight: 3,
    label: 'Add a card to your deck',
  },
  {
    type: REWARD_TYPES.REMOVE_CARD,
    weight: 2,
    label: 'Remove a card from your deck',
  },
  {
    type: REWARD_TYPES.REMOVE_STATUS,
    weight: 2,
    label: 'Remove a status',
    available: run => Array.isArray(run.statuses) && run.statuses.length > 0,
  },
  {
    type: REWARD_TYPES.GAIN_RELIC,
    weight: 1,
    label: 'Gain a relic',
  },
]);
