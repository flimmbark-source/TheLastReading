import { MP_PHASES } from '../multiplayer/mpState.mjs';

const ROUND_ADVANCE_VISUAL_DELAY_MS = 3350;

export function installMpAutoAdvanceDelay(target = window) {
  if (!target || target.__tlrMpAutoAdvanceDelayInstalled) return;
  target.__tlrMpAutoAdvanceDelayInstalled = true;

  installRoundCompleteOverlaySuppressor(target, target.document);
  installAutoNextRoundTimerDelay(target);
}

function installAutoNextRoundTimerDelay(target) {
  if (typeof target.setTimeout !== 'function') return;

  const originalSetTimeout = target.setTimeout.bind(target);
  target.setTimeout = function tlrDelayedMpSetTimeout(callback, delay = 0, ...args) {
    if (shouldDelayAutoNextRound(callback, delay, target)) {
      return originalSetTimeout(callback, ROUND_ADVANCE_VISUAL_DELAY_MS, ...args);
    }
    return originalSetTimeout(callback, delay, ...args);
  };
}

function shouldDelayAutoNextRound(callback, delay, target) {
  if (Number(delay) !== 120) return false;
  if (typeof callback !== 'function') return false;
  if (target.tlrMpGetState?.()?.phase !== MP_PHASES.BETWEEN_ROUNDS) return false;

  const source = Function.prototype.toString.call(callback);
  return source.includes('MP_NEW_ROUND') && source.includes('tlrMpDispatch');
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
