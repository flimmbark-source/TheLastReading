import { MP_PHASES } from './mpState.mjs';
import { MP_ABILITY_TYPES } from './interactionCards.mjs';
import { getPersona } from './personas.mjs';

export function activePlayer(state) {
  return state.players[state.activePlayerIndex] ?? null;
}

export function playerByIndex(state, index) {
  return state.players[index] ?? null;
}

export function isPlayerTurn(state, playerIndex) {
  return (
    (state.phase === MP_PHASES.PLACEMENT || state.phase === MP_PHASES.FINAL_TURN) &&
    state.activePlayerIndex === playerIndex
  );
}

export function canPlaceCard(state, playerIndex, cardUid, slotIndex) {
  if (!isPlayerTurn(state, playerIndex)) return false;
  const player = state.players[playerIndex];
  if (!player) return false;
  if (slotIndex < 0 || slotIndex >= player.spread.length) return false;
  if (player.spread[slotIndex] !== null) return false;
  return player.hand.some(c => c.uid === cardUid);
}

export function canInvokeAbility(state, playerIndex, cardUid) {
  if (!isPlayerTurn(state, playerIndex)) return false;
  const player = state.players[playerIndex];
  if (!player || player.discards <= 0) return false;
  return player.hand.some(c => c.uid === cardUid && (c.ability || c.abilityType));
}

// Whether an interaction ability (Banish/Seal) can target a specific slot.
export function canTargetSlot(state, targetPlayerIndex, slotIndex) {
  const player = state.players[targetPlayerIndex];
  if (!player) return false;
  if (slotIndex < 0 || slotIndex >= player.spread.length) return false;
  if (player.spread[slotIndex] === null) return false;
  if (player.anchoredSlotIndex === slotIndex) return false; // Anchor protection
  return true;
}

// Whether a slot is anchored (protected from interaction abilities).
export function isSlotAnchored(state, playerIndex, slotIndex) {
  const player = state.players[playerIndex];
  return player?.anchoredSlotIndex === slotIndex;
}

// Whether a card is silenced (excluded from scoring) this round.
export function isCardSilenced(state, playerIndex, cardUid) {
  return state.players[playerIndex]?.silencedCardUids?.includes(cardUid) ?? false;
}

export function canSwapSpread(state, playerIndex) {
  if (!isPlayerTurn(state, playerIndex)) return false;
  return !!(state.players[playerIndex]?.swapAvailable);
}

export function emptySlots(state, playerIndex) {
  const player = state.players[playerIndex];
  if (!player) return [];
  return player.spread.map((s, i) => s === null ? i : -1).filter(i => i >= 0);
}

export function isMatchOver(state) {
  return state.phase === MP_PHASES.COMPLETE;
}

export function isInFinalTurn(state) {
  return state.phase === MP_PHASES.FINAL_TURN;
}

export function needsScoring(state) {
  return state.phase === MP_PHASES.SCORING;
}

export function scores(state) {
  return state.players.map(p => p.totalScore);
}

export function roundScores(state) {
  return state.players.map(p => p.roundScore);
}

export function winnerName(state) {
  if (state.winner === 'draw') return 'draw';
  if (state.winner === 0 || state.winner === 1) return `Player ${state.winner + 1}`;
  return null;
}

export function personaOf(state, playerIndex) {
  const id = state.players[playerIndex]?.persona;
  return id ? getPersona(id) : null;
}

// Cards in a player's hand that are interaction cards (Banish, Seal, etc.)
export function interactionCardsInHand(state, playerIndex) {
  const player = state.players[playerIndex];
  if (!player) return [];
  return player.hand.filter(c => c.type === 'interaction');
}

// Slots in the opponent's spread that can be legally targeted right now.
export function targetableOpponentSlots(state, playerIndex) {
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  if (!opponent) return [];
  return opponent.spread
    .map((c, i) => (c !== null && opponent.anchoredSlotIndex !== i) ? i : -1)
    .filter(i => i >= 0);
}
