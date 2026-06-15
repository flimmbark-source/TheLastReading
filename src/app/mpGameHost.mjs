import { installMpGame as installBaseMpGame } from './mpGame.mjs';

const RESULT_OVERLAY_MIN_DELAY_MS = 1250;
const FINAL_PLACEMENT_SCORE_DELAY_MS = 3600;
const POINT_EFFECT_SELECTOR = '.score-ghost,.ghost,.meld-announce';

function normalizeMult(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(1, Number(number.toFixed(2)));
}

function formatMult(value) {
  const number = normalizeMult(value);
  return Number.isInteger(number) ? String(number) : String(number).replace(/0+$/, '').replace(/\.$/, '');
}

function installMpHostFixes(target = window) {
  if (!target || target.__tlrMpHostFixesInstalled) return;
  target.__tlrMpHostFixesInstalled = true;

  const doc = target.document;
  if (!doc) return;

  let stateRef = null;
  let myIndex = 0;
  let effectsHoldUntil = 0;
  let scoreDispatchHoldUntil = 0;
  let resultsOverlayHoldUntil = 0;
  let resultsOverlayTimer = null;

  installOverlayLayerFix(target, doc);
  installEffectHoldTracker(target, ms => {
    const amount = Number(ms) || 0;
    effectsHoldUntil = Math.max(effectsHoldUntil, Date.now() + amount);
  });

  const currentEffectsUntil = () => Math.max(
    effectsHoldUntil,
    Number(target.effectsUntil) || 0,
    visualEffectsActive(doc) ? Date.now() + 160 : 0,
  );

  const syncLater = () => {
    syncMultSpans(target, doc, stateRef, myIndex);
    target.requestAnimationFrame?.(() => syncMultSpans(target, doc, stateRef, myIndex));
  };

  const markFinalPlacementHold = state => {
    if (!isPreScoreState(state)) return;
    scoreDispatchHoldUntil = Math.max(
      scoreDispatchHoldUntil,
      currentEffectsUntil(),
      Date.now() + FINAL_PLACEMENT_SCORE_DELAY_MS,
    );
    hidePrematureScoringOverlay(doc, scoreDispatchHoldUntil);
  };

  const holdResultsOverlay = (action, state) => {
    if (!isScoreResultAction(action, state)) return;
    const overlay = doc.getElementById('mpOverlay');
    const box = doc.getElementById('mpOvBox');
    if (!overlay || !box) return;

    renderResultsOverlayBox(box, state, myIndex);
    const holdUntil = Math.max(Date.now() + RESULT_OVERLAY_MIN_DELAY_MS, currentEffectsUntil());
    resultsOverlayHoldUntil = Math.max(resultsOverlayHoldUntil, holdUntil);
    overlay.classList.add('mp-ov-hidden');
    doc.body.classList.remove('mp-overlay-active');

    const revealWhenReady = () => {
      if (!doc.body.classList.contains('mp-game-active')) return;
      const remaining = Math.max(0, resultsOverlayHoldUntil - Date.now());
      const currentOverlay = doc.getElementById('mpOverlay');
      if (!currentOverlay) return;
      if (remaining > 0 || visualEffectsActive(doc)) {
        resultsOverlayTimer = target.setTimeout(revealWhenReady, Math.max(80, Math.min(remaining || 160, 240)));
        return;
      }
      currentOverlay.classList.remove('mp-ov-hidden');
      doc.body.classList.add('mp-overlay-active');
      syncOverlayLayerClass(doc);
    };

    if (resultsOverlayTimer) target.clearTimeout(resultsOverlayTimer);
    resultsOverlayTimer = target.setTimeout(revealWhenReady, 80);
  };

  wrapDispatchForEffectHolds(target, {
    getScoreHoldUntil: () => Math.max(scoreDispatchHoldUntil, currentEffectsUntil()),
    clearScoreHold: () => { scoreDispatchHoldUntil = 0; },
    getResultHoldUntil: () => Math.max(resultsOverlayHoldUntil, currentEffectsUntil()),
    hasVisualEffects: () => visualEffectsActive(doc),
  });

  const onMatchStart = target.tlrMpOnMatchStart;
  if (typeof onMatchStart === 'function') {
    target.tlrMpOnMatchStart = function (state, meta = {}) {
      stateRef = state;
      effectsHoldUntil = 0;
      scoreDispatchHoldUntil = 0;
      resultsOverlayHoldUntil = 0;
      if (resultsOverlayTimer) {
        target.clearTimeout(resultsOverlayTimer);
        resultsOverlayTimer = null;
      }
      myIndex = meta.role === 'host' ? 0 : 1;
      const result = onMatchStart.apply(this, arguments);
      syncLater();
      return result;
    };
  }

  const onLocalAction = target.tlrMpOnLocalAction;
  if (typeof onLocalAction === 'function') {
    target.tlrMpOnLocalAction = function (action, state) {
      stateRef = state;
      const result = onLocalAction.apply(this, arguments);
      syncLater();
      markFinalPlacementHold(state);
      holdResultsOverlay(action, state);
      return result;
    };
  }

  const onPeerAction = target.tlrMpOnPeerAction;
  if (typeof onPeerAction === 'function') {
    target.tlrMpOnPeerAction = function (action, state) {
      stateRef = state;
      const result = onPeerAction.apply(this, arguments);
      syncLater();
      markFinalPlacementHold(state);
      holdResultsOverlay(action, state);
      return result;
    };
  }

  const onLeave = target.tlrMpLeave;
  if (typeof onLeave === 'function') {
    target.tlrMpLeave = function () {
      stateRef = null;
      effectsHoldUntil = 0;
      scoreDispatchHoldUntil = 0;
      resultsOverlayHoldUntil = 0;
      if (resultsOverlayTimer) {
        target.clearTimeout(resultsOverlayTimer);
        resultsOverlayTimer = null;
      }
      doc.body.classList.remove('mp-overlay-active');
      return onLeave.apply(this, arguments);
    };
  }
}

function installEffectHoldTracker(target, onHold) {
  if (!target || target.__tlrMpHostEffectHoldTracked) return;
  const original = target.holdEffects;
  if (typeof original !== 'function') return;
  target.__tlrMpHostEffectHoldTracked = true;
  target.holdEffects = function (ms) {
    onHold?.(ms);
    return original.apply(this, arguments);
  };
}

function isPreScoreState(state) {
  return state?.phase === 'SCORING'
    && Array.isArray(state.players)
    && state.players.length === 2
    && state.players.every(player => Array.isArray(player.spread) && player.spread.every(Boolean));
}

function isScoreResultAction(action, state) {
  if (action?.type !== 'MP_SCORE_ROUND') return false;
  return state?.phase === 'BETWEEN_ROUNDS' || state?.phase === 'COMPLETE';
}

function visualEffectsActive(doc) {
  return !!doc.querySelector(POINT_EFFECT_SELECTOR);
}

function hidePrematureScoringOverlay(doc, holdUntil) {
  if (Date.now() >= holdUntil && !visualEffectsActive(doc)) return;
  const overlay = doc.getElementById('mpOverlay');
  if (!overlay) return;
  overlay.classList.add('mp-ov-hidden');
  doc.body.classList.remove('mp-overlay-active');
}

function wrapDispatchForEffectHolds(target, options) {
  if (target.__tlrMpResultHoldDispatchWrapped) return;
  const dispatch = target.tlrMpDispatch;
  if (typeof dispatch !== 'function') return;
  target.__tlrMpResultHoldDispatchWrapped = true;

  let scoreQueued = false;
  let nextRoundQueued = false;

  target.tlrMpDispatch = function (action) {
    const state = target.tlrMpGetState?.();

    if (action?.type === 'MP_SCORE_ROUND' && state?.phase === 'SCORING') {
      const wait = Math.max(0, options.getScoreHoldUntil() - Date.now());
      if (wait > 40 || options.hasVisualEffects()) {
        if (!scoreQueued) {
          scoreQueued = true;
          target.setTimeout(() => {
            scoreQueued = false;
            if (target.tlrMpGetState?.()?.phase === 'SCORING') target.tlrMpDispatch?.(action);
          }, Math.max(120, Math.min(wait || 180, 500)));
        }
        return state ?? null;
      }
      options.clearScoreHold?.();
    }

    if (action?.type === 'MP_NEW_ROUND') {
      const wait = Math.max(0, options.getResultHoldUntil() - Date.now());
      if (wait > 40 || options.hasVisualEffects()) {
        if (!nextRoundQueued) {
          nextRoundQueued = true;
          target.setTimeout(() => {
            nextRoundQueued = false;
            if (target.tlrMpGetState?.()?.phase === 'BETWEEN_ROUNDS') target.tlrMpDispatch?.(action);
          }, Math.max(120, Math.min(wait || 180, 500)));
        }
        return state ?? null;
      }
    }

    return dispatch.apply(this, arguments);
  };
}

function renderResultsOverlayBox(box, state, myIndex) {
  const players = state?.players || [];
  const my = myIndex || 0;
  const opp = 1 - my;
  const myRound = players[my]?.roundScore ?? 0;
  const oppRound = players[opp]?.roundScore ?? 0;
  const myTotal = players[my]?.totalScore ?? 0;
  const oppTotal = players[opp]?.totalScore ?? 0;
  if (state?.phase === 'COMPLETE') {
    const winner = state.winner;
    const result = winner === 'draw' ? 'Draw' : (winner === my ? 'Victory' : 'Defeat');
    const cls = winner === 'draw' ? 'draw' : (winner === my ? 'win' : 'lose');
    box.innerHTML = `<h2 class="mp-ov-title">Match Over</h2><p class="mp-ov-winner ${cls}">${result}</p><div class="mp-ov-scores"><div><div class="mp-ov-score-val">${myTotal}</div><div class="mp-ov-score-label">You</div></div><div class="mp-ov-vs">vs</div><div><div class="mp-ov-score-val">${oppTotal}</div><div class="mp-ov-score-label">Opponent</div></div></div><button class="mp-ov-btn" onclick="tlrMpLeave()" type="button">Return to Menu</button>`;
    return;
  }
  box.innerHTML = `<h2 class="mp-ov-title">Round ${state?.round ?? 1} Complete</h2><div class="mp-ov-scores"><div><div class="mp-ov-score-val">${myRound}</div><div class="mp-ov-score-label">You</div></div><div class="mp-ov-vs">vs</div><div><div class="mp-ov-score-val">${oppRound}</div><div class="mp-ov-score-label">Opponent</div></div></div><div class="mp-ov-totals">Total: ${myTotal} – ${oppTotal} / ${state?.scoreTarget ?? 200}</div><p class="mp-ov-waiting">Starting next set…</p>`;
}

function installOverlayLayerFix(target, doc) {
  if (!doc.getElementById('mp-host-layer-fix-style')) {
    const style = doc.createElement('style');
    style.id = 'mp-host-layer-fix-style';
    style.textContent = `
      body.mp-game-active.mp-overlay-active #mpGame{z-index:2147482000!important}
      body.mp-game-active #mpOverlay:not(.mp-ov-hidden){position:fixed!important;inset:0!important;z-index:2147483000!important}
    `;
    doc.head.appendChild(style);
  }

  const Observer = target.MutationObserver || globalThis.MutationObserver;
  if (Observer && !target.__tlrMpOverlayLayerObserverInstalled) {
    target.__tlrMpOverlayLayerObserverInstalled = true;
    new Observer(() => syncOverlayLayerClass(doc)).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  syncOverlayLayerClass(doc);
}

function syncOverlayLayerClass(doc) {
  const overlay = doc.getElementById('mpOverlay');
  const active = !!overlay && !overlay.classList.contains('mp-ov-hidden') && doc.body.classList.contains('mp-game-active');
  doc.body.classList.toggle('mp-overlay-active', active);
}

function syncMultSpans(target, doc, state, myIndex) {
  if (!state?.players || !doc.body.classList.contains('mp-game-active')) return;
  syncOneMultSpan(target, doc, 'mpMyScore', state.players[myIndex]);
  syncOneMultSpan(target, doc, 'mpOppScore', state.players[1 - myIndex]);
}

function syncOneMultSpan(target, doc, scoreId, player) {
  const scoreNode = doc.getElementById(scoreId);
  const pill = scoreNode?.closest?.('.mp-pill-score') || scoreNode?.parentElement;
  const parent = pill?.parentElement;
  if (!pill || !parent) return;

  let mult = pill.querySelector(':scope > .mp-mult-inline')
    || (pill.previousElementSibling?.classList?.contains('mp-mult-inline') ? pill.previousElementSibling : null)
    || (pill.nextElementSibling?.classList?.contains('mp-mult-inline') ? pill.nextElementSibling : null);
  if (!mult) {
    mult = doc.createElement('span');
    mult.className = 'mp-mult-inline';
    pill.appendChild(mult);
  }

  const text = `${formatMult(player?.roundMult ?? 1)}x`;
  if (mult.textContent !== text) mult.textContent = text;

  const isDesktop = target.matchMedia?.('(min-width: 641px)').matches ?? false;
  const putRight = isDesktop && pill.classList.contains('mp-pill-opp-score');
  if (putRight) {
    if (mult.parentElement !== parent || pill.nextElementSibling !== mult) parent.insertBefore(mult, pill.nextSibling);
    mult.classList.add('mp-mult-right');
    mult.classList.remove('mp-mult-left');
  } else {
    if (mult.parentElement !== parent || mult.nextElementSibling !== pill) parent.insertBefore(mult, pill);
    mult.classList.add('mp-mult-left');
    mult.classList.remove('mp-mult-right');
    parent.classList.add('mp-has-left-mult');
  }
  pill.style.setProperty('width', '118px', 'important');
  pill.style.setProperty('gap', '5px', 'important');
}

// The multiplayer game is self-contained in mpGame.mjs. The host keeps the
// stable import path from main.mjs and patches integration seams where the MP
// renderer crosses singleplayer UI systems.
export function installMpGame(target = window) {
  installBaseMpGame(target);
  installMpHostFixes(target);
}
