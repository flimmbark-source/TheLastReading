const START_ABILITY_TARGETING = 'START_ABILITY_TARGETING';
const TOGGLE_ABILITY_TARGET = 'TOGGLE_ABILITY_TARGET';
const CLEAR_ABILITY_TARGETING = 'CLEAR_ABILITY_TARGETING';
const CANCEL_ABILITY = 'CANCEL_ABILITY';
const SYNC_LEGACY_RUN = 'SYNC_LEGACY_RUN';

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

function mirrorDiscardStateFromRun(target, run, lastDiscardedCard = undefined) {
  const state = stateOf(target);
  if (!state || !run) return;
  state.hand = [...(run.hand || [])];
  state.discard = [...(run.discard || [])];
  state.discardedCards = [...(run.discardedCards || [])];
  state.discards = run.discards;
  state.freeDiscardUsed = !!run.freeDiscardUsed;
  state.sightChargesUsed = Number(run.sightChargesUsed || 0);
  state.roundDiscardCount = Number(run.roundDiscardCount || 0);
  state.selected = run.selectedCardId ?? null;
  if (lastDiscardedCard !== undefined) state.lastDiscardedCard = lastDiscardedCard;
}

function restoreCancelledAbilityDiscard(target) {
  const rollback = target.__tlrPendingAbilityDiscardRollback;
  const run = target.tlrStore?.getState?.()?.run;
  if (!rollback || !run) return false;

  const sourceCardId = rollback.card?.uid ?? run.ability?.sourceCardId ?? run.sourceCardId;
  const discard = [...(run.discard || [])];
  const discardIndex = discard.findIndex(card => card.uid === sourceCardId);
  if (discardIndex < 0) return false;

  const [card] = discard.splice(discardIndex, 1);
  const hand = [...(run.hand || [])];
  const insertAt = Math.max(0, Math.min(Number(rollback.handIndex ?? hand.length), hand.length));
  hand.splice(insertAt, 0, card);

  target.tlrStore.dispatch({
    type: SYNC_LEGACY_RUN,
    run: {
      hand,
      discard,
      selectedCardId: null,
      discards: rollback.discards,
      freeDiscardUsed: rollback.freeDiscardUsed,
      sightChargesUsed: rollback.sightChargesUsed,
      discardedCards: [...(rollback.discardedCards || [])],
      roundDiscardCount: rollback.roundDiscardCount,
    },
  });

  const restoredRun = target.tlrStore.getState().run;
  mirrorDiscardStateFromRun(target, restoredRun, rollback.lastDiscardedCard ?? null);
  target.__tlrPendingAbilityDiscardRollback = null;
  return true;
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

  target.tlrCanCancelAbilitySelection = function () {
    return !!storeTargeting(target) || !!target.__tlrPendingAbilityDiscardRollback;
  };

  // Cancel an active non-targeting ability (for example Peek's reveal-choice
  // modal). These abilities never create store targeting, but they still have
  // the same pending discard rollback captured before resolution began.
  target.tlrCancelActiveAbility = function () {
    clearPendingAutoConfirm();
    clearPendingCallbacks();
    const restored = restoreCancelledAbilityDiscard(target);
    if (storeReady(target)) target.tlrStore.dispatch({ type: CANCEL_ABILITY });
    const state = stateOf(target);
    if (state) { state.abilitySelect = null; state.busy = false; }
    if (typeof target.render === 'function') target.render();
    return restored;
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

  // Complete cancellation rolls back the discard that activated the ability.
  // The exact pre-discard hand position and resource counters are captured by
  // discardRuntime, then restored here before the active ability is cleared.
  target.cancelAbilitySelection = function () {
    clearPendingAutoConfirm();
    const targeting = storeTargeting(target);
    if (!targeting) return false;
    const cb = pendingCallbacks.cb;
    clearPendingCallbacks();
    restoreCancelledAbilityDiscard(target);
    target.tlrStore.dispatch({ type: CANCEL_ABILITY });
    const state = stateOf(target);
    if (state) { state.abilitySelect = null; state.busy = false; }
    if (typeof target.render === 'function') target.render();
    if (typeof cb === 'function') cb(null);
    return true;
  };

  // Hard abandon for navigation (e.g. Return to Menu) intentionally does not
  // restore the discarded card or resolve the pending targeting callback.
  target.tlrForceCloseAbilityTargeting = function () {
    clearPendingAutoConfirm();
    clearPendingCallbacks();
    target.__tlrPendingAbilityDiscardRollback = null;
    if (storeReady(target) && target.tlrActions) {
      target.tlrStore.dispatch({ type: target.tlrActions.CANCEL_ABILITY });
    }
    const state = stateOf(target);
    if (state) { state.abilitySelect = null; state.busy = false; }
  };
}
