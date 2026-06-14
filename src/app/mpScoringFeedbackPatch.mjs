import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { computeScore } from '../systems/scoring.mjs';

const EFFECT_WINDOW_MS = 2600;
const COURT_RANKS = ['Page', 'Knight', 'Queen', 'King'];
const MINOR_SUITS = ['Cups', 'Wands', 'Swords', 'Pentacles'];

export function installMpScoringFeedbackPatch(target = window) {
  if (!target || target.__tlrMpScoringFeedbackPatchInstalled) return;
  target.__tlrMpScoringFeedbackPatchInstalled = true;

  const doc = target.document;
  if (!doc) return;

  let lastState = null;
  let latestEffectsUntil = 0;
  let delayedNextRoundQueued = false;

  installStyle(doc);
  wrapMatchStart();
  wrapActionHandlers();
  wrapDispatchForEffectDelay();

  function wrapMatchStart() {
    const original = target.tlrMpOnMatchStart;
    if (typeof original !== 'function') return;
    target.tlrMpOnMatchStart = function (state, meta) {
      ensureRoundMults(state, null, true);
      lastState = cloneState(state);
      const result = original.call(this, state, meta);
      updateScoreMultPills(state);
      return result;
    };
  }

  function wrapActionHandlers() {
    const originalLocal = target.tlrMpOnLocalAction;
    const originalPeer = target.tlrMpOnPeerAction;

    if (typeof originalLocal === 'function') {
      target.tlrMpOnLocalAction = function (action, state) {
        const before = lastState ? cloneState(lastState) : cloneState(state);
        applyDerivedScoringState(before, state, action);
        const result = originalLocal.call(this, action, state);
        updateScoreMultPills(state);
        playPlacementFeedback(before, state);
        lastState = cloneState(state);
        return result;
      };
    }

    if (typeof originalPeer === 'function') {
      target.tlrMpOnPeerAction = function (action, state) {
        const before = lastState ? cloneState(lastState) : cloneState(state);
        applyDerivedScoringState(before, state, action);
        const result = originalPeer.call(this, action, state);
        updateScoreMultPills(state);
        playPlacementFeedback(before, state);
        lastState = cloneState(state);
        return result;
      };
    }
  }

  function wrapDispatchForEffectDelay() {
    const original = target.tlrMpDispatch;
    if (typeof original !== 'function') return;
    target.tlrMpDispatch = function (action) {
      if (action?.type === MP_ACTIONS.MP_NEW_ROUND && target.tlrMpGetState?.()?.phase === MP_PHASES.BETWEEN_ROUNDS) {
        const remaining = Math.max(0, latestEffectsUntil - Date.now());
        if (remaining > 40) {
          if (!delayedNextRoundQueued) {
            delayedNextRoundQueued = true;
            target.setTimeout(() => {
              delayedNextRoundQueued = false;
              if (target.tlrMpGetState?.()?.phase === MP_PHASES.BETWEEN_ROUNDS) original.call(this, action);
            }, remaining);
          }
          return target.tlrMpGetState?.() ?? null;
        }
      }
      return original.call(this, action);
    };
  }

  function applyDerivedScoringState(before, state, action) {
    if (!state?.players) return;
    ensureRoundMults(state, before, action?.type === MP_ACTIONS.MP_INIT);

    if (action?.type === MP_ACTIONS.MP_SUBMIT_ACTION) {
      accumulateNewPlacementMult(before, state);
      return;
    }

    if (action?.type === MP_ACTIONS.MP_SCORE_ROUND) {
      correctScoreRoundWithAccumulatedMult(before, state);
      return;
    }

    if (action?.type === MP_ACTIONS.MP_NEW_ROUND) {
      ensureRoundMults(state, before, false);
    }
  }

  function ensureRoundMults(state, before = null, reset = false) {
    if (!state?.players) return;
    state.players.forEach((player, index) => {
      const previous = before?.players?.[index]?.roundMult;
      player.roundMult = reset ? 1 : normalizeMult(player.roundMult ?? previous ?? 1);
    });
  }

  function accumulateNewPlacementMult(before, state) {
    if (!before?.players || !state?.players) return;
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex += 1) {
      if (!spreadChangedByPlacement(before.players[playerIndex], state.players[playerIndex])) continue;
      const beforeScore = scoreSpreadRaw(before.players[playerIndex]);
      const afterScore = scoreSpreadRaw(state.players[playerIndex]);
      const delta = Math.max(0, (afterScore.mult || 1) - (beforeScore.mult || 1));
      if (delta > 0) {
        state.players[playerIndex].roundMult = normalizeMult((state.players[playerIndex].roundMult ?? 1) + delta);
      }
    }
  }

  function correctScoreRoundWithAccumulatedMult(before, state) {
    if (!before?.players || !state?.players) return;
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex += 1) {
      const beforePlayer = before.players[playerIndex];
      const player = state.players[playerIndex];
      const adjusted = scoreWithRoundMult(beforePlayer);
      const beforeTotal = beforePlayer?.totalScore ?? 0;
      player.roundMult = normalizeMult(player.roundMult ?? beforePlayer?.roundMult ?? 1);
      player.roundScore = adjusted;
      player.totalScore = beforeTotal + adjusted;
    }

    const [p0, p1] = state.players;
    const targetScore = state.scoreTarget ?? 200;
    if ((p0.totalScore ?? 0) >= targetScore || (p1.totalScore ?? 0) >= targetScore) {
      state.phase = MP_PHASES.COMPLETE;
      if (p0.totalScore === p1.totalScore) state.winner = 'draw';
      else state.winner = p0.totalScore > p1.totalScore ? 0 : 1;
    } else {
      state.phase = MP_PHASES.BETWEEN_ROUNDS;
      state.winner = null;
    }
  }

  function playPlacementFeedback(before, state) {
    if (!before?.players || !state?.players) return;
    const placements = findPlacements(before, state);
    if (!placements.length) return;

    latestEffectsUntil = Math.max(latestEffectsUntil, Date.now() + EFFECT_WINDOW_MS);
    target.holdEffects?.(EFFECT_WINDOW_MS);

    target.requestAnimationFrame?.(() => {
      placements.forEach((placement, index) => {
        target.setTimeout(() => playSinglePlacementFeedback(before, state, placement), index * 120);
      });
    });
  }

  function playSinglePlacementFeedback(before, state, placement) {
    const { playerIndex, slotIndex, card } = placement;
    const slotEl = slotElementForPlayer(playerIndex, slotIndex);
    if (!slotEl) return;

    const cardEl = slotEl.querySelector('.card');
    if (cardEl) {
      cardEl.classList.add('landing');
      cardEl.addEventListener('animationend', () => cardEl.classList.remove('landing'), { once: true });
    }

    slotGhost(slotEl, `+${card.points || 0}`);
    scoreGhost(playerIndex, '+1');
    target.playSound?.('place');
    target.haptic?.(12);

    const beforeScore = scoreSpreadRaw(before.players[playerIndex]);
    const afterScore = scoreSpreadRaw(state.players[playerIndex]);
    const newMelds = diffMelds(beforeScore, afterScore);
    let delay = 420;
    let announceOffset = 0;

    for (const meld of newMelds) {
      const slots = slotsForMeld(state.players[playerIndex]?.spread || [], meld.name);
      const visualSlots = slots.map(index => slotElementForPlayer(playerIndex, index)).filter(Boolean);
      visualSlots.forEach((slot, index) => target.setTimeout(() => bumpSlot(slot), delay + index * 130));

      const anchor = visualSlots[visualSlots.length - 1] || slotEl;
      const ghostDelay = delay + visualSlots.length * 130 + 120;
      target.setTimeout(() => slotGhost(anchor, meldText(meld), true), ghostDelay);

      if (!meld.name.startsWith('⚷') && meld.name !== 'Omen' && meld.name !== 'Resonance') {
        target.setTimeout(() => {
          target.centerGhost?.(normMeldName(meld.name), meld.mult > 1.5 || (meld.mode === 'add' && meld.mult >= 1.5));
          target.playSound?.('meld');
          target.haptic?.([0, 10, 35, 12]);
        }, delay + announceOffset);
      }

      if (meld.mult > 0) {
        const shownMult = meld.mode === 'add' ? meld.mult : meld.mult - 1;
        const label = signed(shownMult);
        target.setTimeout(() => scoreGhost(playerIndex, label, true), ghostDelay + 200);
      }

      delay += visualSlots.length * 130 + 700;
      announceOffset += 600;
      latestEffectsUntil = Math.max(latestEffectsUntil, Date.now() + delay + 1100);
      target.holdEffects?.(delay + 1100);
    }

    target.setTimeout(() => updateScoreMultPills(state), Math.min(delay + 180, EFFECT_WINDOW_MS));
  }

  function findPlacements(before, state) {
    const out = [];
    for (let playerIndex = 0; playerIndex < state.players.length; playerIndex += 1) {
      const beforeSpread = before.players[playerIndex]?.spread || [];
      const afterSpread = state.players[playerIndex]?.spread || [];
      for (let slotIndex = 0; slotIndex < afterSpread.length; slotIndex += 1) {
        const beforeCard = beforeSpread[slotIndex];
        const afterCard = afterSpread[slotIndex];
        if (!beforeCard && afterCard) out.push({ playerIndex, slotIndex, card: afterCard });
      }
    }
    return out;
  }

  function spreadChangedByPlacement(beforePlayer, afterPlayer) {
    const beforeSpread = beforePlayer?.spread || [];
    const afterSpread = afterPlayer?.spread || [];
    return afterSpread.some((card, index) => card && !beforeSpread[index]);
  }

  function scoreSpreadRaw(player) {
    const cards = scoredCards(player);
    if (!cards.length) return emptyScore();
    return computeScore(cards, { skipFlatBonuses: true, skipRelics: true });
  }

  function scoreWithRoundMult(player) {
    const score = scoreSpreadRaw(player);
    return Math.floor((score.chips || 0) * normalizeMult(player?.roundMult ?? 1));
  }

  function displayScoreForPlayer(state, playerIndex) {
    const player = state?.players?.[playerIndex];
    if (!player) return 0;
    const total = player.totalScore ?? 0;
    if (state.phase === MP_PHASES.PLACEMENT || state.phase === MP_PHASES.SCORING) {
      return total + scoreWithRoundMult(player);
    }
    return total;
  }

  function scoredCards(player) {
    const silenced = new Set(player?.silencedCardUids || []);
    return (player?.spread || []).filter(card => card && !silenced.has(card.uid));
  }

  function updateScoreMultPills(state = target.tlrMpGetState?.()) {
    if (!state?.players) return;
    const myIndex = target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
    updateOneScorePill('mpMyScore', state, myIndex);
    updateOneScorePill('mpOppScore', state, 1 - myIndex);
  }

  function updateOneScorePill(scoreId, state, playerIndex) {
    const scoreNode = doc.getElementById(scoreId);
    if (!scoreNode) return;
    const player = state.players[playerIndex];
    const score = String(displayScoreForPlayer(state, playerIndex));
    if (scoreNode.textContent !== score) scoreNode.textContent = score;

    const pill = scoreNode.closest('.mp-pill-score') || scoreNode.parentElement;
    if (!pill) return;
    let mult = pill.querySelector('.mp-mult-inline');
    if (!mult) {
      mult = doc.createElement('span');
      mult.className = 'mp-mult-inline';
      pill.appendChild(mult);
    }
    mult.textContent = `(${formatMult(player?.roundMult ?? 1)}x)`;
  }

  function slotElementForPlayer(playerIndex, slotIndex) {
    const myIndex = target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
    const spreadId = playerIndex === myIndex ? 'spread' : 'mpOppSpread';
    const spread = doc.getElementById(spreadId);
    return spread?._mpSlots?.[slotIndex] || spread?.querySelectorAll?.('.slot')?.[slotIndex] || null;
  }

  function bumpSlot(slot) {
    slot.classList.remove('bump');
    void slot.offsetWidth;
    slot.classList.add('bump');
  }

  function slotGhost(slot, text, big = false) {
    if (!slot) return;
    target.holdEffects?.(1700);
    const rect = slot.getBoundingClientRect();
    const ghost = doc.createElement('div');
    ghost.className = `ghost ${big ? 'big' : ''}`;
    ghost.textContent = text;
    ghost.style.setProperty('--dx', `${(Math.random() * 20 - 10).toFixed(1)}px`);
    ghost.style.setProperty('--rot', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
    ghost.style.position = 'fixed';
    ghost.style.left = `${rect.left + rect.width / 2}px`;
    ghost.style.top = `${rect.top - 10}px`;
    ghost.style.zIndex = '99999';
    doc.body.appendChild(ghost);

    const card = slot.querySelector('.card');
    if (card?.animate && !prefersReducedMotion()) {
      card.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.22)' }, { filter: 'brightness(1)' }], { duration: 220, easing: 'ease-out' });
    }
    target.setTimeout(() => ghost.remove(), 1700);
  }

  function scoreGhost(playerIndex, label, isMult = false) {
    const myIndex = target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
    const id = playerIndex === myIndex ? 'mpMyScore' : 'mpOppScore';
    const scoreNode = doc.getElementById(id);
    const pill = scoreNode?.closest?.('.mp-pill-score') || scoreNode;
    if (!pill) return;
    const rect = pill.getBoundingClientRect();
    const ghost = doc.createElement('span');
    ghost.className = `score-ghost ${isMult ? 'mult' : ''}`;
    ghost.textContent = label;
    ghost.style.left = `${rect.left + 8 + Math.random() * Math.max(1, rect.width - 16)}px`;
    ghost.style.top = `${rect.top + rect.height * 0.25}px`;
    doc.body.appendChild(ghost);
    if (pill.animate && !prefersReducedMotion()) {
      pill.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.25)' }, { filter: 'brightness(1)' }], { duration: 260, easing: 'ease-out' });
    }
    target.setTimeout(() => ghost.remove(), 950);
  }

  function diffMelds(beforeScore, afterScore) {
    const before = new Map((beforeScore.melds || []).map(meld => [meld.name, meld]));
    const out = [];
    for (const meld of afterScore.melds || []) {
      const old = before.get(meld.name);
      if (!old) {
        out.push(meld);
        continue;
      }
      const chips = (meld.chips || 0) - (old.chips || 0);
      const mult = (meld.mult || 0) - (old.mult || 0);
      if (chips > 0 || mult > 0) out.push({ ...meld, chips, mult });
    }
    return out;
  }

  function slotsForMeld(spread, name) {
    const filled = (spread || []).map((card, index) => card ? { card, index } : null).filter(Boolean);

    if (name.startsWith('Three of a Kind') || name.startsWith('Four of a Kind')) {
      const rank = COURT_RANKS.find(rankName => name.includes(`${rankName}s`));
      const limit = name.startsWith('Three') ? 3 : 4;
      return rank ? filled.filter(item => item.card.type === 'court' && item.card.rank === rank).slice(0, limit).map(item => item.index) : [];
    }

    if (name.startsWith('Full Court')) {
      const limit = tierFrom(name) || 4;
      const seen = new Set();
      const out = [];
      for (const item of filled) {
        if (out.length >= limit) break;
        if (item.card.type === 'court' && COURT_RANKS.includes(item.card.rank) && !seen.has(item.card.rank)) {
          seen.add(item.card.rank);
          out.push(item.index);
        }
      }
      return out;
    }

    if (name.startsWith('Royal Court')) {
      const suit = MINOR_SUITS.find(suitName => name.includes(suitName));
      const limit = tierFrom(name) || 4;
      return suit ? filled.filter(item => item.card.suit === suit).slice(0, limit).map(item => item.index) : [];
    }

    if (name.startsWith('Sequence')) {
      const majors = filled
        .filter(item => item.card.type === 'major')
        .sort((a, b) => majorNumber(a.card) - majorNumber(b.card));
      if (!majors.length) return [];
      let bestStart = 0, bestLen = 1, curStart = 0, curLen = 1;
      for (let i = 1; i < majors.length; i += 1) {
        if (majorNumber(majors[i].card) === majorNumber(majors[i - 1].card) + 1) {
          curLen += 1;
          if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
        } else {
          curStart = i;
          curLen = 1;
        }
      }
      const want = tierFrom(name) || bestLen;
      return majors.slice(bestStart, bestStart + want).map(item => item.index);
    }

    if (name === 'Path of the Magi') {
      const ids = new Set(['I', 'II', 'V']);
      return filled.filter(item => ids.has(item.card.id)).map(item => item.index);
    }

    return filled.map(item => item.index);
  }

  function meldText(meld) {
    if (typeof target.meldStr === 'function') return target.meldStr([meld.name, meld.chips || 0, meld.mult || 0, meld.mode]);
    const shown = meld.mode === 'add' ? meld.mult : meld.mult - 1;
    if (meld.chips && meld.mult) return `${signed(meld.chips)} ${signed(shown)}`;
    if (meld.chips) return signed(meld.chips);
    if (meld.mult) return signed(shown);
    return '';
  }

  function normMeldName(name) {
    if (typeof target.normMeldName === 'function') return target.normMeldName(name);
    if (name.startsWith('Sequence')) return 'Sequence';
    if (name.startsWith('Royal Court')) return 'Royal Court';
    if (name.startsWith('Full Court')) return 'Full Court';
    if (name.startsWith('Three of a Kind')) return 'Three of a Kind';
    if (name.startsWith('Four of a Kind')) return 'Four of a Kind';
    return name;
  }

  function tierFrom(name) {
    const match = String(name).match(/\((\d+)/) || String(name).match(/of (\d+)/);
    return match ? Number(match[1]) : 0;
  }

  function majorNumber(card) {
    return card.number ?? card.num ?? 0;
  }

  function signed(value) {
    const number = Number(value || 0);
    return `${number >= 0 ? '+' : ''}${number.toFixed(2).replace(/\.?0+$/, '')}`;
  }

  function normalizeMult(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(1, Number(number.toFixed(2)));
  }

  function formatMult(value) {
    return normalizeMult(value).toFixed(2).replace(/\.?0+$/, '');
  }

  function emptyScore() {
    return { baseChips: 0, chips: 0, mult: 1, melds: [], finalScore: 0 };
  }

  function cloneState(state) {
    if (!state) return null;
    try { return structuredClone(state); }
    catch (_) { return JSON.parse(JSON.stringify(state)); }
  }

  function prefersReducedMotion() {
    try { return !!target.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  }
}

function installStyle(doc) {
  if (doc.getElementById('mp-scoring-feedback-patch-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-scoring-feedback-patch-style';
  style.textContent = `
    body.mp-game-active .mp-pill-score {
      width: 146px !important;
      gap: 5px !important;
    }
    .mp-mult-inline {
      color: #ff5a4f;
      font: 900 10px/1 system-ui, sans-serif;
      letter-spacing: .02em;
      text-shadow: 0 0 7px rgba(255,70,60,.35), 0 1px 2px rgba(0,0,0,.85);
      margin-left: 1px;
      white-space: nowrap;
    }
    body.mp-game-active .mp-overlay:not(.mp-ov-hidden) {
      pointer-events: auto;
    }
  `;
  doc.head.appendChild(style);
}
