import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { installMpSingleplayerAbilityBridge } from './mpSingleplayerAbilityBridge.mjs';

const OPPONENT_REVEAL_DELAY_MS = 750;

export function installMpScorePillStabilityPatch(target = window) {
  if (!target || target.__tlrMpScorePillStabilityInstalled) return;
  target.__tlrMpScorePillStabilityInstalled = true;

  const doc = target.document;
  if (!doc) return;

  installMpSingleplayerAbilityBridge(target);

  const lastShown = [0, 0];

  wrapMatchStart();
  wrapActionHandlers();

  function myIndex() {
    return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
  }

  function scoreNodeFor(playerIndex) {
    return doc.getElementById(playerIndex === myIndex() ? 'mpMyScore' : 'mpOppScore');
  }

  function opponentIndex() {
    return 1 - myIndex();
  }

  function opponentRevealPending() {
    return !!doc.querySelector('#mpOppSpread .slot.mp-reveal-pending');
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

  function rememberExistingScores() {
    const mine = doc.getElementById('mpMyScore');
    const opp = doc.getElementById('mpOppScore');
    const my = myIndex();
    const opponent = 1 - my;
    const mineVal = Number(mine?.textContent ?? NaN);
    const oppVal = Number(opp?.textContent ?? NaN);
    if (Number.isFinite(mineVal)) lastShown[my] = mineVal;
    if (Number.isFinite(oppVal)) lastShown[opponent] = oppVal;
  }

  function syncScore(playerIndex, state, options = {}) {
    const node = scoreNodeFor(playerIndex);
    if (!node) return;

    const isOpponent = playerIndex === opponentIndex();
    const keepOpponentHidden = isOpponent && opponentRevealPending() && !options.allowOpponentAdvance;
    const expected = keepOpponentHidden
      ? String(lastShown[playerIndex] ?? state.players[playerIndex]?.totalScore ?? 0)
      : String(displayScoreForPlayer(state, playerIndex));

    if (node.textContent !== expected) node.textContent = expected;
    const numeric = Number(expected);
    if (Number.isFinite(numeric)) lastShown[playerIndex] = numeric;
  }

  function syncVisibleScores(state = target.tlrMpGetState?.(), options = {}) {
    if (!state?.players || !doc.body.classList.contains('mp-game-active')) return;
    const my = myIndex();
    syncScore(my, state, { allowOpponentAdvance: true });
    syncScore(1 - my, state, options);
  }

  function scheduleSyncs(state) {
    rememberExistingScores();
    syncVisibleScores(state, { allowOpponentAdvance: false });
    target.requestAnimationFrame?.(() => syncVisibleScores(state, { allowOpponentAdvance: false }));
    target.setTimeout(() => syncVisibleScores(state, { allowOpponentAdvance: true }), OPPONENT_REVEAL_DELAY_MS + 90);
  }

  function wrapMatchStart() {
    const original = target.tlrMpOnMatchStart;
    if (typeof original !== 'function') return;
    target.tlrMpOnMatchStart = function (state, meta) {
      const result = original.call(this, state, meta);
      lastShown[0] = state?.players?.[0]?.totalScore ?? 0;
      lastShown[1] = state?.players?.[1]?.totalScore ?? 0;
      scheduleSyncs(state);
      return result;
    };
  }

  function wrapActionHandlers() {
    const originalLocal = target.tlrMpOnLocalAction;
    const originalPeer = target.tlrMpOnPeerAction;

    if (typeof originalLocal === 'function') {
      target.tlrMpOnLocalAction = function (action, state) {
        rememberExistingScores();
        const result = originalLocal.call(this, action, state);
        scheduleSyncs(state);
        return result;
      };
    }

    if (typeof originalPeer === 'function') {
      target.tlrMpOnPeerAction = function (action, state) {
        rememberExistingScores();
        const result = originalPeer.call(this, action, state);
        scheduleSyncs(state);
        return result;
      };
    }
  }
}
