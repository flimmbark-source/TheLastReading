import { ACTIONS } from './actions.mjs';
import { reducer as baseReducer } from './reducer.mjs';

const START_ABILITY_TARGETING = 'START_ABILITY_TARGETING';
const TOGGLE_ABILITY_TARGET = 'TOGGLE_ABILITY_TARGET';
const CLEAR_ABILITY_TARGETING = 'CLEAR_ABILITY_TARGETING';

function replaceRun(state, patch) {
  return { ...state, run: { ...state.run, ...patch } };
}

function replaceAbility(state, abilityPatch) {
  const current = state.run.ability || {};
  return replaceRun(state, { ability: { ...current, ...abilityPatch } });
}

function startPurge(state) {
  const { run } = state;
  if (run.busy || run.hand.length < 3 || run.ability || run.purge !== null) return state;
  return replaceRun(state, { purge: [], selectedCardId: null });
}

function togglePurgeCard(state, cardId) {
  const { run } = state;
  if (!Array.isArray(run.purge)) return state;
  if (!run.hand.some(card => card.uid === cardId)) return state;

  const purge = [...run.purge];
  const index = purge.indexOf(cardId);
  if (index >= 0) purge.splice(index, 1);
  else if (purge.length < 3) purge.push(cardId);

  return replaceRun(state, { purge });
}

function confirmPurge(state) {
  const { run } = state;
  if (!Array.isArray(run.purge) || run.purge.length !== 3) return state;
  const purged = new Set(run.purge);
  return replaceRun(state, {
    hand: run.hand.filter(card => !purged.has(card.uid)),
    discards: run.discards + 1,
    purge: null,
    selectedCardId: null,
  });
}

function cancelPurge(state) {
  if (state.run.purge === null) return state;
  return replaceRun(state, { purge: null });
}

function startAbilityTargeting(state, action) {
  const payload = action.selection || action.targeting || {};
  const validCardIds = [...new Set((payload.validCardIds || payload.validIds || []).filter(Number.isFinite))];
  const count = Math.max(1, Number(payload.count || 1));
  return replaceAbility(state, {
    targeting: {
      title: String(payload.title || ''),
      prompt: String(payload.prompt || ''),
      validCardIds,
      pickedCardIds: [],
      count,
    },
  });
}

function toggleAbilityTarget(state, action) {
  const targeting = state.run.ability?.targeting;
  if (!targeting) return state;
  const cardId = action.cardId ?? action.uid;
  if (!targeting.validCardIds.includes(cardId)) return state;

  const pickedCardIds = [...targeting.pickedCardIds];
  const index = pickedCardIds.indexOf(cardId);
  if (index >= 0) pickedCardIds.splice(index, 1);
  else {
    while (pickedCardIds.length >= targeting.count) pickedCardIds.shift();
    pickedCardIds.push(cardId);
  }

  return replaceAbility(state, {
    targeting: { ...targeting, pickedCardIds },
  });
}

function clearAbilityTargeting(state) {
  const ability = state.run.ability;
  if (!ability?.targeting) return state;
  const { targeting: _targeting, ...rest } = ability;
  return replaceRun(state, { ability: Object.keys(rest).length ? rest : null });
}

export function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.START_PURGE:
      return startPurge(state);
    case ACTIONS.TOGGLE_PURGE_CARD:
      return togglePurgeCard(state, action.cardId ?? action.uid);
    case ACTIONS.CONFIRM_PURGE:
      return confirmPurge(state);
    case ACTIONS.CANCEL_PURGE:
      return cancelPurge(state);
    case START_ABILITY_TARGETING:
      return startAbilityTargeting(state, action);
    case TOGGLE_ABILITY_TARGET:
      return toggleAbilityTarget(state, action);
    case CLEAR_ABILITY_TARGETING:
      return clearAbilityTargeting(state);
    default:
      return baseReducer(state, action);
  }
}
