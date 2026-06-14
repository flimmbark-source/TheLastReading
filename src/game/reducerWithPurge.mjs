import { ACTIONS } from './actions.mjs';
import { reducer as baseReducer } from './reducer.mjs';

function replaceRun(state, patch) {
  return { ...state, run: { ...state.run, ...patch } };
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
    default:
      return baseReducer(state, action);
  }
}
