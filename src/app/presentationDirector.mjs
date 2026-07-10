// Central presentation-state coordinator.
//
// This module owns transient visual state only. It deliberately does not mutate
// scoring, deck, reward, ability, or Adventure run state. Components may publish
// presentation flags/cues without becoming coupled to one another's DOM.

const PRIMARY_STATES = new Set([
  'idle',
  'card-selected',
  'card-dragging',
  'card-placing',
  'pattern-resolving',
  'threshold-near',
  'threshold-clearing',
  'adventure-outcome',
  'adventure-reward',
  'adventure-recovery',
  'run-ending',
]);

const FLAG_PREFIX = 'presentation-flag-';
const CUE_PREFIX = 'presentation-cue-';

function safeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dispatch(target, name, detail) {
  try {
    target.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {}
}

export function installPresentationDirector(target = window) {
  if (!target?.document) return null;
  if (target.tlrPresentation) return target.tlrPresentation;

  const doc = target.document;
  const cueTimers = new Map();
  const flags = new Set();
  let primaryState = 'idle';
  let observer = null;
  let syncRaf = 0;

  const body = () => doc.body;

  const writePayload = payload => {
    const root = body();
    if (!root) return;
    const intensity = Math.max(0, Math.min(1, finite(payload?.intensity, 0)));
    root.style.setProperty('--presentation-intensity', String(intensity));
    root.style.setProperty('--presentation-origin-x', `${finite(payload?.x, 50)}%`);
    root.style.setProperty('--presentation-origin-y', `${finite(payload?.y, 50)}%`);
  };

  const applyPrimary = (name, payload = {}) => {
    const root = body();
    if (!root) return false;
    const state = PRIMARY_STATES.has(name) ? name : 'idle';
    if (primaryState !== state) {
      root.classList.remove(`presentation-${primaryState}`);
      primaryState = state;
      root.classList.add(`presentation-${primaryState}`);
      root.dataset.presentationState = primaryState;
    }
    writePayload(payload);
    dispatch(target, 'tlr:presentation-state', { state: primaryState, payload });
    return true;
  };

  const setFlag = (name, active = true, payload = {}) => {
    const token = safeToken(name);
    const root = body();
    if (!token || !root) return false;
    const className = `${FLAG_PREFIX}${token}`;
    root.classList.toggle(className, Boolean(active));
    if (active) flags.add(token);
    else flags.delete(token);
    if (active) writePayload(payload);
    dispatch(target, 'tlr:presentation-flag', { flag: token, active: Boolean(active), payload });
    return true;
  };

  const clearCue = name => {
    const token = safeToken(name);
    if (!token) return;
    const timer = cueTimers.get(token);
    if (timer) target.clearTimeout(timer);
    cueTimers.delete(token);
    body()?.classList.remove(`${CUE_PREFIX}${token}`);
  };

  const cue = (name, payload = {}) => {
    const token = safeToken(name);
    const root = body();
    if (!token || !root) return () => {};
    clearCue(token);
    root.classList.add(`${CUE_PREFIX}${token}`);
    writePayload(payload);
    dispatch(target, 'tlr:presentation-cue', { cue: token, payload });

    const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const requested = Math.max(0, finite(payload.duration, 500));
    const duration = reduced ? Math.min(requested, 120) : requested;
    if (duration > 0) {
      cueTimers.set(token, target.setTimeout(() => clearCue(token), duration));
    }
    return () => clearCue(token);
  };

  const readNumber = id => {
    const raw = doc.getElementById(id)?.textContent ?? '';
    const value = Number(String(raw).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(value) ? value : 0;
  };

  const syncFromDom = () => {
    syncRaf = 0;
    const root = body();
    if (!root) return;

    const selected = Boolean(doc.querySelector('#hand .card.sel, #hand .card.ability-picked'));
    const dragging = Boolean(doc.querySelector('.hand-card-dragging'));
    const placing = Boolean(doc.querySelector('#spread .card.landing'));
    setFlag('card-selected', selected);
    setFlag('card-dragging', dragging);
    setFlag('card-placing', placing);

    const threshold = readNumber('threshold');
    const current = readNumber('current');
    const ratio = threshold > 0 ? current / threshold : 0;
    setFlag('threshold-near', ratio >= 0.8 && ratio < 1, { intensity: Math.min(1, ratio) });
    setFlag('threshold-complete', threshold > 0 && ratio >= 1, { intensity: 1 });

    const inAdventure = root.classList.contains('mode-adventure');
    const rewardHeading = doc.querySelector('#summary .result-panel h3')?.textContent?.trim().toLowerCase() || '';
    const hasRewards = Boolean(doc.querySelector('#summary .adv-rewards'));
    setFlag('adventure-reward', inAdventure && hasRewards && rewardHeading.includes('choose your reward'));
    setFlag('adventure-recovery', inAdventure && hasRewards && !rewardHeading.includes('choose your reward'));
    setFlag('adventure-outcome', inAdventure && Boolean(doc.querySelector('#summary .adv-narrative')) && !hasRewards);
  };

  const scheduleSync = () => {
    if (syncRaf) return;
    syncRaf = target.requestAnimationFrame(syncFromDom);
  };

  const observe = () => {
    if (observer || !doc.documentElement) return;
    observer = new MutationObserver(scheduleSync);
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-hidden'],
    });
    scheduleSync();
  };

  const reset = () => {
    const root = body();
    if (root) {
      root.classList.remove(`presentation-${primaryState}`);
      flags.forEach(flag => root.classList.remove(`${FLAG_PREFIX}${flag}`));
      [...cueTimers.keys()].forEach(clearCue);
      delete root.dataset.presentationState;
      root.style.removeProperty('--presentation-intensity');
      root.style.removeProperty('--presentation-origin-x');
      root.style.removeProperty('--presentation-origin-y');
    }
    flags.clear();
    primaryState = 'idle';
    applyPrimary('idle');
  };

  const api = Object.freeze({
    states: Object.freeze([...PRIMARY_STATES]),
    get state() { return primaryState; },
    get flags() { return Object.freeze([...flags]); },
    setState: applyPrimary,
    clearState(name) { if (!name || name === primaryState) applyPrimary('idle'); },
    setFlag,
    cue,
    clearCue,
    sync: scheduleSync,
    reset,
    destroy() {
      observer?.disconnect();
      observer = null;
      if (syncRaf) target.cancelAnimationFrame(syncRaf);
      reset();
      delete target.tlrPresentation;
    },
  });

  target.tlrPresentation = api;
  const boot = () => {
    body()?.classList.add('presentation-idle');
    if (body()) body().dataset.presentationState = 'idle';
    observe();
  };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  return api;
}
