import { installMpGame as installBaseMpGame } from './mpGame.mjs';

const RESULT_OVERLAY_MIN_DELAY_MS = 1250;
const POINT_EFFECT_SELECTOR = '.score-ghost,.ghost';

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
  let resultsOverlayHoldUntil = 0;
  let resultsOverlayTimer = null;

  installOverlayLayerFix(target, doc);

  const syncLater = () => {
    syncMultSpans(target, doc, stateRef, myIndex);
    target.requestAnimationFrame?.(() => syncMultSpans(target, doc, stateRef, myIndex));
  };

  const holdResultsOverlay = (action, state) => {
    if (!isScoreResultAction(action, state)) return;
    const overlay = doc.getElementById('mpOverlay');
    if (!overlay || overlay.classList.contains('mp-ov-hidden')) return;

    const holdUntil = Date.now() + RESULT_OVERLAY_MIN_DELAY_MS;
    resultsOverlayHoldUntil = Math.max(resultsOverlayHoldUntil, holdUntil);
    overlay.classList.add('mp-ov-hidden');
    doc.body.classList.remove('mp-overlay-active');

    const revealWhenReady = () => {
      if (!doc.body.classList.contains('mp-game-active')) return;
      const remaining = Math.max(0, resultsOverlayHoldUntil - Date.now());
      const pointEffectsActive = !!doc.querySelector(POINT_EFFECT_SELECTOR);
      const currentOverlay = doc.getElementById('mpOverlay');
      if (!currentOverlay) return;
      if (remaining > 0 || pointEffectsActive) {
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

  wrapDispatchForResultHold(target, () => resultsOverlayHoldUntil, () => !!doc.querySelector(POINT_EFFECT_SELECTOR));

  const onMatchStart = target.tlrMpOnMatchStart;
  if (typeof onMatchStart === 'function') {
    target.tlrMpOnMatchStart = function (state, meta = {}) {
      stateRef = state;
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
      holdResultsOverlay(action, state);
      return result;
    };
  }

  const onLeave = target.tlrMpLeave;
  if (typeof onLeave === 'function') {
    target.tlrMpLeave = function () {
      stateRef = null;
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

function isScoreResultAction(action, state) {
  if (action?.type !== 'MP_SCORE_ROUND') return false;
  return state?.phase === 'BETWEEN_ROUNDS' || state?.phase === 'COMPLETE';
}

function wrapDispatchForResultHold(target, getHoldUntil, hasPointEffects) {
  if (target.__tlrMpResultHoldDispatchWrapped) return;
  const dispatch = target.tlrMpDispatch;
  if (typeof dispatch !== 'function') return;
  target.__tlrMpResultHoldDispatchWrapped = true;

  target.tlrMpDispatch = function (action) {
    if (action?.type === 'MP_NEW_ROUND') {
      const wait = Math.max(0, getHoldUntil() - Date.now());
      if (wait > 40 || hasPointEffects()) {
        target.setTimeout(() => target.tlrMpDispatch?.(action), Math.max(120, wait || 180));
        return target.tlrMpGetState?.() ?? null;
      }
    }
    return dispatch.apply(this, arguments);
  };
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
