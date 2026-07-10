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
    const EventType = target.CustomEvent || CustomEvent;
    target.dispatchEvent(new EventType(name, { detail }));
  } catch {}
}

export function installPresentationDirector(target = window) {
  if (!target?.document) return null;
  if (target.tlrPresentation) return target.tlrPresentation;

  const doc = target.document;
  const cueTimers = new Map();
  const flags = new Set();
  const domState = {
    placing: false,
    patterning: false,
    thresholdComplete: false,
  };
  let primaryState = 'idle';
  let observer = null;
  let syncRaf = 0;

  const body = () => doc.body;

  const setStyleValue = (root, property, value) => {
    if (root.style.getPropertyValue(property) === value) return;
    root.style.setProperty(property, value);
  };

  const writePayload = payload => {
    const root = body();
    if (!root || !payload || typeof payload !== 'object') return;
    if (Object.hasOwn(payload, 'intensity')) {
      const intensity = Math.max(0, Math.min(1, finite(payload.intensity, 0)));
      setStyleValue(root, '--presentation-intensity', String(intensity));
    }
    if (Object.hasOwn(payload, 'x')) {
      setStyleValue(root, '--presentation-origin-x', `${finite(payload.x, 50)}%`);
    }
    if (Object.hasOwn(payload, 'y')) {
      setStyleValue(root, '--presentation-origin-y', `${finite(payload.y, 50)}%`);
    }
  };

  const applyPrimary = (name, payload = {}) => {
    const root = body();
    if (!root) return false;
    const state = PRIMARY_STATES.has(name) ? name : 'idle';
    const changed = primaryState !== state;
    if (changed) {
      root.classList.remove(`presentation-${primaryState}`);
      primaryState = state;
      root.classList.add(`presentation-${primaryState}`);
      root.dataset.presentationState = primaryState;
    }
    writePayload(payload);
    if (changed || Object.keys(payload).length) {
      dispatch(target, 'tlr:presentation-state', { state: primaryState, payload });
    }
    return true;
  };

  const setFlag = (name, active = true, payload = {}) => {
    const token = safeToken(name);
    const root = body();
    if (!token || !root) return false;
    const next = Boolean(active);
    const previous = flags.has(token);
    const changed = previous !== next;
    if (changed) {
      root.classList.toggle(`${FLAG_PREFIX}${token}`, next);
      if (next) flags.add(token);
      else flags.delete(token);
    }
    if (next) writePayload(payload);
    if (changed || Object.keys(payload).length) {
      dispatch(target, 'tlr:presentation-flag', { flag: token, active: next, payload });
    }
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
    const patterning = Boolean(doc.querySelector('#spread .card.bump'));
    setFlag('card-selected', selected);
    setFlag('card-dragging', dragging);
    setFlag('card-placing', placing);

    if (patterning && !domState.patterning) {
      cue('pattern', { duration: 700, intensity: .65 });
    }

    const threshold = readNumber('threshold');
    const current = readNumber('current');
    const ratio = threshold > 0 ? current / threshold : 0;
    const thresholdNear = ratio >= 0.8 && ratio < 1;
    const thresholdComplete = threshold > 0 && ratio >= 1;
    setFlag('threshold-near', thresholdNear, { intensity: Math.min(1, ratio) });
    setFlag('threshold-complete', thresholdComplete, { intensity: 1 });
    if (thresholdComplete && !domState.thresholdComplete) {
      cue('threshold-clear', { duration: 1100, intensity: 1 });
    }

    const inAdventure = root.classList.contains('mode-adventure');
    const rewardHeading = doc.querySelector('#summary .result-panel h3')?.textContent?.trim().toLowerCase() || '';
    const hasRewards = Boolean(doc.querySelector('#summary .adv-rewards'));
    const adventureReward = inAdventure && hasRewards && rewardHeading.includes('choose your reward');
    const adventureRecovery = inAdventure && hasRewards && !rewardHeading.includes('choose your reward');
    const adventureOutcome = inAdventure && Boolean(doc.querySelector('#summary .adv-narrative')) && !hasRewards;
    setFlag('adventure-reward', adventureReward);
    setFlag('adventure-recovery', adventureRecovery);
    setFlag('adventure-outcome', adventureOutcome);

    const nextPrimary = adventureReward ? 'adventure-reward'
      : adventureRecovery ? 'adventure-recovery'
      : adventureOutcome ? 'adventure-outcome'
      : patterning ? 'pattern-resolving'
      : placing ? 'card-placing'
      : dragging ? 'card-dragging'
      : selected ? 'card-selected'
      : thresholdNear ? 'threshold-near'
      : 'idle';
    applyPrimary(nextPrimary);

    domState.placing = placing;
    domState.patterning = patterning;
    domState.thresholdComplete = thresholdComplete;
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
      attributeFilter: ['class', 'aria-hidden'],
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
    Object.keys(domState).forEach(key => { domState[key] = false; });
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
