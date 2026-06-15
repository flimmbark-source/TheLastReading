import { ACTIONS } from './actions.mjs';
import { reducer as baseReducer } from './reducer.mjs';
import { shuffleDeck } from '../systems/deck.mjs';
import { hasRelic } from '../systems/relics.mjs';

const START_ABILITY_TARGETING = 'START_ABILITY_TARGETING';
const TOGGLE_ABILITY_TARGET = 'TOGGLE_ABILITY_TARGET';
const CLEAR_ABILITY_TARGETING = 'CLEAR_ABILITY_TARGETING';
const SET_ABILITY_PICKS = 'SET_ABILITY_PICKS';

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

function maxHandSize(persist) {
  return 5 + ((persist?.upgrades?.hand) || 0) - (hasRelic(persist?.relics || [], 'fool_reversed') ? 1 : 0);
}

function mulliganHand(state) {
  const { run, persist } = state;
  if (!run.mulliganCharges || run.mulliganCharges <= 0) return state;
  if (run.spread.some(Boolean)) return state;
  const handSize = maxHandSize(persist);
  if (run.hand.length !== handSize) return state;
  const combined = shuffleDeck([...(run.deck || []), ...(run.hand || [])]);
  const hand = combined.splice(0, handSize);
  return replaceRun(state, {
    deck: combined,
    hand,
    selectedCardId: null,
    mulliganCharges: run.mulliganCharges - 1,
  });
}

function reorderHand(state, action) {
  const hand = [...state.run.hand];
  const fromIndex = hand.findIndex(c => c.uid === action.uid);
  if (fromIndex < 0) return state;
  const [card] = hand.splice(fromIndex, 1);
  hand.splice(action.toIndex, 0, card);
  const selectedCardId = state.run.selectedCardId === action.uid ? null : state.run.selectedCardId;
  return replaceRun(state, { hand, selectedCardId });
}

function setAbilityPicks(state, action) {
  const targeting = state.run.ability?.targeting;
  if (!targeting) return state;
  const requested = (action.cardIds || []).filter(id => targeting.validCardIds.includes(id));
  const pickedCardIds = requested.slice(-targeting.count);
  return replaceAbility(state, { targeting: { ...targeting, pickedCardIds } });
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
    case SET_ABILITY_PICKS:
      return setAbilityPicks(state, action);
    case ACTIONS.REORDER_HAND:
      return reorderHand(state, action);
    case ACTIONS.MULLIGAN:
      return mulliganHand(state);
    case ACTIONS.SET_BUSY:
      return replaceRun(state, { busy: !!action.busy });
    case ACTIONS.SET_PURGE_PICKS: {
      if (!Array.isArray(state.run.purge)) return state;
      const picks = (action.cardIds || [])
        .filter(id => state.run.hand.some(c => c.uid === id))
        .slice(0, 3);
      return replaceRun(state, { purge: picks });
    }
    case ACTIONS.UPDATE_RESONATION_BONUS: {
      const existing = state.run.resonationBonus || { chips: 0, mult: 0 };
      return replaceRun(state, {
        resonationBonus: {
          chips: (existing.chips || 0) + (action.chips || 0),
          mult: (existing.mult || 0) + (action.mult || 0),
          name: action.name || existing.name || '',
        },
      });
    }
    case CLEAR_ABILITY_TARGETING:
      return clearAbilityTargeting(state);
    default:
      return baseReducer(state, action);
  }
}
