import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { computeScore } from '../systems/scoring.mjs';

const OPPONENT_REVEAL_DELAY_MS = 750;

export function installMpScorePillStabilityPatch(target = window) {
  if (!target || target.__tlrMpScorePillStabilityInstalled) return;
  target.__tlrMpScorePillStabilityInstalled = true;

  const doc = target.document;
  if (!doc) return;

  wrapMatchStart();
  wrapActionHandlers();

  function myIndex() {
    return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
  }

  function scoredCards(player) {
    const silenced = new Set(player?.silencedCardUids || []);
    return (player?.spread || []).filter(card => card && !silenced.has(card.uid));
  }

  function normalizeMult(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(1, Number(number.toFixed(2)));
  }

  function liveSpreadScore(player) {
    const cards = scoredCards(player);
    if (!cards.length) return 0;
    const score = computeScore(cards, { skipFlatBonuses: true, skipRelics: true });
    return Math.floor((score.chips || 0) * normalizeMult(player?.roundMult ?? 1));
  }

  function displayScoreForPlayer(state, playerIndex) {
    const player = state?.players?.[playerIndex];
    if (!player) return 0;
    const total = player.totalScore ?? 0;
    if (state.phase === MP_PHASES.PLACEMENT || state.phase === MP_PHASES.SCORING) return total + liveSpreadScore(player);
    return total;
  }

  function syncMyScore(state = target.tlrMpGetState?.()) {
    if (!state?.players || !doc.body.classList.contains('mp-game-active')) return;
    const node = doc.getElementById('mpMyScore');
    if (!node) return;
    const expected = String(displayScoreForPlayer(state, myIndex()));
    if (node.textContent !== expected) node.textContent = expected;
  }

  function scheduleSyncs(state) {
    syncMyScore(state);
    target.requestAnimationFrame?.(() => syncMyScore(state));
    target.setTimeout(() => syncMyScore(state), OPPONENT_REVEAL_DELAY_MS + 80);
  }

  function wrapMatchStart() {
    const original = target.tlrMpOnMatchStart;
    if (typeof original !== 'function') return;
    target.tlrMpOnMatchStart = function (state, meta) {
      const result = original.call(this, state, meta);
      scheduleSyncs(state);
      return result;
    };
  }

  function wrapActionHandlers() {
    const originalLocal = target.tlrMpOnLocalAction;
    const originalPeer = target.tlrMpOnPeerAction;

    if (typeof originalLocal === 'function') {
      target.tlrMpOnLocalAction = function (action, state) {
        const result = originalLocal.call(this, action, state);
        scheduleSyncs(state);
        return result;
      };
    }

    if (typeof originalPeer === 'function') {
      target.tlrMpOnPeerAction = function (action, state) {
        const result = originalPeer.call(this, action, state);
        scheduleSyncs(state);
        return result;
      };
    }
  }
}
