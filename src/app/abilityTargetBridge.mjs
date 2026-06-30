const START_ABILITY_TARGETING = 'START_ABILITY_TARGETING';
const TOGGLE_ABILITY_TARGET = 'TOGGLE_ABILITY_TARGET';
const CLEAR_ABILITY_TARGETING = 'CLEAR_ABILITY_TARGETING';

// The store owns the serializable targeting selection (valid/picked ids, title,
// count). The confirm callback and preview function cannot live in the store, so
// they are held here while a pick is active and the store-derived
// `state.abilitySelect` mirror points at them for the renderer.
let pendingCallbacks = { cb: null, previewFn: null };
function clearPendingCallbacks() { pendingCallbacks = { cb: null, previewFn: null }; }
export function getPendingPreviewFn() { return pendingCallbacks.previewFn; }

// Auto-confirm beat: once a tap fills the last required pick, give the
// picked-card ring color a moment to register before resolving, so the tap
// reads as "selected, then resolved" rather than an instant cut. Ability
// targeting never lifts/moves cards (see .ability-target in mobile.css), so
// there's no position animation for this delay to race or cut off.
const AUTO_CONFIRM_DELAY_MS = 120;
let pendingAutoConfirmTimer = null;
function clearPendingAutoConfirm() {
  if (pendingAutoConfirmTimer) { clearTimeout(pendingAutoConfirmTimer); pendingAutoConfirmTimer = null; }
}

function runtime(target) { return target.tlrRuntime || {}; }
function stateOf(target) { return runtime(target).state || target.state; }
function storeReady(target) { return !!(target.tlrStore && target.tlrStore.getState && target.tlrStore.dispatch); }

function arrayEq(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function validIdsArray(selection) {
  if (!selection) return [];
  if (selection.validIds instanceof Set) return [...selection.validIds];
  if (Array.isArray(selection.validIds)) return selection.validIds;
  if (Array.isArray(selection.validCardIds)) return selection.validCardIds;
  return [];
}

function storeTargeting(target) {
  return target.tlrStore?.getState?.()?.run?.ability?.targeting || null;
}

function legacySelectionNeedsStoreSync(legacy, targeting) {
  if (!legacy) return false;
  if (!targeting) return true;
  if (legacy.title !== targeting.title) return true;
  if (legacy.prompt !== targeting.prompt) return true;
  if ((legacy.count || 1) !== (targeting.count || 1)) return true;
  if (!arrayEq(validIdsArray(legacy), targeting.validCardIds || [])) return true;
  return false;
}

function syncLegacySelectionToStore(target) {
  if (!storeReady(target)) return;
  const state = stateOf(target);
  const legacy = state?.abilitySelect;
  if (!legacy) return;
  const targeting = storeTargeting(target);
  if (!legacySelectionNeedsStoreSync(legacy, targeting)) return;

  target.tlrStore.dispatch({
    type: START_ABILITY_TARGETING,
    selection: {
      title: legacy.title || '',
      prompt: legacy.prompt || '',
      validCardIds: validIdsArray(legacy),
      count: legacy.count || 1,
    },
  });
}

function syncBoth(target) {
  syncLegacySelectionToStore(target);
}

function allSelectableCards(target) {
  const state = stateOf(target);
  return [...(state?.hand || []), ...((state?.spread || []).filter(Boolean))];
}

export function installAbilityTargetBridge(target = window) {
  if (!target || target.__tlrAbilityTargetBridgeInstalled) return;
  target.__tlrAbilityTargetBridgeInstalled = true;

  const originalRender = target.render;
  if (typeof originalRender === 'function') {
    target.render = function (...args) {
      syncBoth(target);
      return originalRender.apply(this, args);
    };
  }

  const originalRefresh = target.refreshHandState;
  if (typeof originalRefresh === 'function') {
    target.refreshHandState = function (...args) {
      syncBoth(target);
      return originalRefresh.apply(this, args);
    };
  }

  // Store-native targeting initiation. Replaces writing `state.abilitySelect`
  // directly from readingFlow: the selection lives in the store and only the
  // callback/preview are held locally. The legacy mirror is still produced for
  // the current renderer via syncStoreSelectionToLegacy.
  target.tlrStartAbilityTargeting = function ({ title, prompt, validCardIds = [], count = 1, cb = null, previewFn = null }) {
    clearPendingAutoConfirm();
    pendingCallbacks = { cb, previewFn };
    if (storeReady(target)) {
      target.tlrStore.dispatch({
        type: START_ABILITY_TARGETING,
        selection: { title: title || '', prompt: prompt || '', validCardIds: [...validCardIds], count: count || 1 },
      });
    }
    if (typeof target.render === 'function') target.render();
  };

  // Cancelling never costs anything (the source card stays discarded either
  // way — see resolveAbility's retry loop), so it's available at every step,
  // not just the first.
  target.tlrCanCancelAbilitySelection = function () {
    return !!storeTargeting(target);
  };

  target.handleAbilityHandClick = function (card) {
    if (!card || !storeTargeting(target)) return;
    syncBoth(target);
    target.tlrStore.dispatch({ type: TOGGLE_ABILITY_TARGET, cardId: card.uid });
    if (typeof target.refreshHandState === 'function') target.refreshHandState();

    // If this tap just filled the last required pick (added, not removed),
    // resolve automatically instead of waiting for a separate Choose tap.
    const targeting = storeTargeting(target);
    const justPicked = !!targeting && targeting.pickedCardIds.includes(card.uid);
    const complete = !!targeting && targeting.pickedCardIds.length >= (targeting.count || 1);
    clearPendingAutoConfirm();
    if (justPicked && complete) {
      pendingAutoConfirmTimer = setTimeout(() => {
        pendingAutoConfirmTimer = null;
        target.confirmAbilitySelection?.();
      }, AUTO_CONFIRM_DELAY_MS);
    }
  };

  target.confirmAbilitySelection = function () {
    clearPendingAutoConfirm();
    const targeting = storeTargeting(target);
    if (!targeting) return;
    syncBoth(target);
    const pickedIds = targeting.pickedCardIds || [];
    if (pickedIds.length < (targeting.count || 1)) return;

    const cards = allSelectableCards(target);
    const picked = pickedIds.map(id => cards.find(card => card.uid === id)).filter(Boolean);
    const cb = pendingCallbacks.cb;
    clearPendingCallbacks();

    target.tlrStore.dispatch({ type: CLEAR_ABILITY_TARGETING });
    if (typeof target.render === 'function') target.render();
    if (typeof cb === 'function') cb(...picked);
  };

  // Cancel backs out of the current targeting step without touching the
  // discard — the source card stays spent. Resolving the pending callback
  // with no picks signals cancellation up through buildAbilityChoiceAsync,
  // and resolveAbility's retry loop re-shows targeting from the start.
  target.cancelAbilitySelection = function () {
    clearPendingAutoConfirm();
    const targeting = storeTargeting(target);
    if (!targeting) return false;
    const cb = pendingCallbacks.cb;
    clearPendingCallbacks();
    target.tlrStore.dispatch({ type: CLEAR_ABILITY_TARGETING });
    if (typeof target.render === 'function') target.render();
    if (typeof cb === 'function') cb();
    return true;
  };
}
