import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';

const ROUND_ADVANCE_VISUAL_DELAY_MS = 3350;

export function installMpAutoAdvanceDelay(target = window) {
  if (!target || target.__tlrMpAutoAdvanceDelayInstalled) return;
  target.__tlrMpAutoAdvanceDelayInstalled = true;

  const doc = target.document;
  let nextRoundDelayUntil = 0;
  let nextRoundTimer = null;

  function markNextRoundHold(state) {
    if (state?.phase !== MP_PHASES.BETWEEN_ROUNDS) return;
    nextRoundDelayUntil = Math.max(nextRoundDelayUntil, Date.now() + ROUND_ADVANCE_VISUAL_DELAY_MS);
  }

  function wrapMatchActionHook(name) {
    const original = target[name];
    if (typeof original !== 'function') return;
    target[name] = function wrappedMpActionHook(action, state, ...rest) {
      markNextRoundHold(state);
      return original.call(this, action, state, ...rest);
    };
  }

  wrapMatchActionHook('tlrMpOnLocalAction');
  wrapMatchActionHook('tlrMpOnPeerAction');

  const originalDispatch = target.tlrMpDispatch;
  if (typeof originalDispatch === 'function') {
    target.tlrMpDispatch = function wrappedMpDispatch(action, ...args) {
      const currentState = target.tlrMpGetState?.();
      if (action?.type === MP_ACTIONS.MP_NEW_ROUND && currentState?.phase === MP_PHASES.BETWEEN_ROUNDS) {
        const remaining = nextRoundDelayUntil - Date.now();
        if (remaining > 40) {
          if (!nextRoundTimer) {
            nextRoundTimer = target.setTimeout(() => {
              nextRoundTimer = null;
              if (target.tlrMpGetState?.()?.phase === MP_PHASES.BETWEEN_ROUNDS) {
                originalDispatch.call(this, action, ...args);
              }
            }, remaining);
          }
          return currentState;
        }
      }

      const result = originalDispatch.call(this, action, ...args);
      if (action?.type === MP_ACTIONS.MP_SCORE_ROUND) markNextRoundHold(target.tlrMpGetState?.() ?? result);
      return result;
    };
  }

  installRoundCompleteOverlaySuppressor(target, doc);
}

function installRoundCompleteOverlaySuppressor(target, doc) {
  if (!doc || doc.getElementById('mp-round-overlay-suppressor-style')) return;

  const style = doc.createElement('style');
  style.id = 'mp-round-overlay-suppressor-style';
  style.textContent = `
    body.mp-game-active.mp-suppress-round-overlay #mpOverlay {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    body.mp-game-active.mp-suppress-round-overlay #mpGame {
      z-index: 9300 !important;
    }
  `;
  doc.head.appendChild(style);

  const sync = () => {
    const body = doc.body;
    if (!body) return;
    const overlay = doc.getElementById('mpOverlay');
    const title = doc.querySelector('#mpOvBox .mp-ov-title')?.textContent?.trim() || '';
    const suppress = body.classList.contains('mp-game-active')
      && overlay
      && !overlay.classList.contains('mp-ov-hidden')
      && /^Round\b/.test(title);

    body.classList.toggle('mp-suppress-round-overlay', !!suppress);
    if (suppress) body.classList.remove('mp-overlay-active');
  };

  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (MutationObserverCtor && doc.body) {
    const observer = new MutationObserverCtor(sync);
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  target.requestAnimationFrame?.(sync);
}
