const START_ABILITY_TARGETING = 'START_ABILITY_TARGETING';
const TOGGLE_ABILITY_TARGET = 'TOGGLE_ABILITY_TARGET';
const CLEAR_ABILITY_TARGETING = 'CLEAR_ABILITY_TARGETING';

// The store owns the serializable targeting selection (valid/picked ids, title,
// count). The confirm callback and preview function cannot live in the store, so
// they are held here while a pick is active and the store-derived
// `state.abilitySelect` mirror points at them for the renderer.
let pendingCallbacks = { cb: null, previewFn: null };
function clearPendingCallbacks() { pendingCallbacks = { cb: null, previewFn: null }; }

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

function syncStoreSelectionToLegacy(target) {
  const state = stateOf(target);
  if (!state) return;
  const targeting = storeTargeting(target);
  if (!targeting) {
    if (state.abilitySelect && state.abilitySelect.__storeOwned) state.abilitySelect = null;
    clearPendingCallbacks();
    return;
  }

  const previous = state.abilitySelect || {};
  state.abilitySelect = {
    ...previous,
    __storeOwned: true,
    title: targeting.title || previous.title || '',
    prompt: targeting.prompt || previous.prompt || '',
    validIds: new Set(targeting.validCardIds || []),
    picked: [...(targeting.pickedCardIds || [])],
    count: targeting.count || previous.count || 1,
    cb: pendingCallbacks.cb ?? previous.cb,
    previewFn: pendingCallbacks.previewFn ?? previous.previewFn,
  };
}

function syncBoth(target) {
  syncLegacySelectionToStore(target);
  syncStoreSelectionToLegacy(target);
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
    pendingCallbacks = { cb, previewFn };
    if (storeReady(target)) {
      target.tlrStore.dispatch({
        type: START_ABILITY_TARGETING,
        selection: { title: title || '', prompt: prompt || '', validCardIds: [...validCardIds], count: count || 1 },
      });
      syncStoreSelectionToLegacy(target);
    } else {
      const state = stateOf(target);
      if (state) state.abilitySelect = { title, prompt, validIds: new Set(validCardIds), picked: [], count, cb, previewFn };
    }
    if (typeof target.render === 'function') target.render();
  };

  target.handleAbilityHandClick = function (card) {
    const state = stateOf(target);
    if (!card || !state?.abilitySelect) return;
    syncBoth(target);
    if (storeReady(target)) {
      target.tlrStore.dispatch({ type: TOGGLE_ABILITY_TARGET, cardId: card.uid });
      syncStoreSelectionToLegacy(target);
    } else {
      const selection = state.abilitySelect;
      if (!selection.validIds?.has?.(card.uid)) return;
      const index = selection.picked.indexOf(card.uid);
      if (index >= 0) selection.picked.splice(index, 1);
      else {
        if (selection.picked.length >= selection.count) selection.picked.shift();
        selection.picked.push(card.uid);
      }
    }
    if (typeof target.refreshHandState === 'function') target.refreshHandState();
  };

  target.confirmAbilitySelection = function () {
    const state = stateOf(target);
    if (!state?.abilitySelect) return;
    syncBoth(target);
    const selection = state.abilitySelect;
    const pickedIds = storeTargeting(target)?.pickedCardIds || selection.picked || [];
    if (pickedIds.length < (selection.count || 1)) return;

    const cards = allSelectableCards(target);
    const picked = pickedIds.map(id => cards.find(card => card.uid === id)).filter(Boolean);
    const cb = pendingCallbacks.cb || selection.cb;
    clearPendingCallbacks();

    if (storeReady(target)) target.tlrStore.dispatch({ type: CLEAR_ABILITY_TARGETING });
    state.abilitySelect = null;
    if (typeof target.render === 'function') target.render();
    if (typeof cb === 'function') cb(...picked);
  };
}
