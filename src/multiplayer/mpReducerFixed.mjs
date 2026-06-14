import { mpReducer as baseMpReducer } from './mpReducer.mjs';
import { MP_ACTIONS } from './mpActions.mjs';
import { handSizeForPersona } from './mpState.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';

function actionWithPlayer(action, playerIndex = action?.playerIndex) {
  return action && typeof action === 'object' ? { ...action, playerIndex } : null;
}

function pendingActionsFor(state, action) {
  if (!action || !state?.players) return [];

  if (action.type !== MP_ACTIONS.MP_SUBMIT_ACTION) return [actionWithPlayer(action)].filter(Boolean);

  const pending = [...(state.pendingActions || [null, null])];
  pending[action.playerIndex] = actionWithPlayer(action.action, action.playerIndex);
  return pending.filter(Boolean);
}

function isWorldInvoke(state, action) {
  if (action?.type !== MP_ACTIONS.MP_INVOKE_ABILITY) return false;
  const player = state?.players?.[action.playerIndex];
  const card = player?.hand?.find(item => item.uid === action.cardUid);
  const ability = card?.ability ? getAbility(card.ability) : null;
  return ability?.type === ABILITY_TYPES.WORLD;
}

function worldInvokePlayerIndexes(state, action) {
  return [...new Set(pendingActionsFor(state, action)
    .filter(submitted => isWorldInvoke(state, submitted))
    .map(submitted => submitted.playerIndex))];
}

function withoutUids(cards, blocked) {
  return (cards || []).filter(card => card && !blocked.has(card.uid));
}

function repairWorldReshufflePlayer(beforePlayer, afterPlayer) {
  if (!beforePlayer || !afterPlayer) return afterPlayer;

  const preservedSpread = beforePlayer.spread || [];
  const spreadUids = new Set(preservedSpread.filter(Boolean).map(card => card.uid));
  let hand = withoutUids(afterPlayer.hand, spreadUids);
  let deck = withoutUids(afterPlayer.deck, spreadUids);
  const discard = withoutUids(afterPlayer.discard, spreadUids);
  const targetHandSize = handSizeForPersona(beforePlayer.persona);

  while (hand.length < targetHandSize && deck.length) {
    hand = [...hand, deck[0]];
    deck = deck.slice(1);
  }

  return {
    ...afterPlayer,
    hand,
    deck,
    discard,
    spread: preservedSpread.slice(),
    playedSlotHistory: [...(beforePlayer.playedSlotHistory || [])],
    anchoredSlotIndex: beforePlayer.anchoredSlotIndex ?? null,
    silencedCardUids: [...(beforePlayer.silencedCardUids || [])],
  };
}

function repairWorldReshuffles(before, after, playerIndexes) {
  if (!playerIndexes.length || !after?.players) return after;
  const players = after.players.map((player, index) => (
    playerIndexes.includes(index)
      ? repairWorldReshufflePlayer(before?.players?.[index], player)
      : player
  ));
  return { ...after, players };
}

export function mpReducer(state, action) {
  const worldIndexes = worldInvokePlayerIndexes(state, action);
  const next = baseMpReducer(state, action);
  return repairWorldReshuffles(state, next, worldIndexes);
}
