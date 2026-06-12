import { MP_PHASES } from './mpState.mjs';

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
  return player.hand.some(c => c.uid === cardUid && c.ability);
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
