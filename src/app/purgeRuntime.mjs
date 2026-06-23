function runtime(target) { return target.tlrRuntime || {}; }
function stateOf(target) { return runtime(target).state || target.state; }
function storeReady(target) { return !!(target.tlrStore && target.tlrActions); }

function syncRunToLegacy(target) {
  const state = stateOf(target);
  const run = target.tlrStore.getState().run;
  state.hand = run.hand.slice();
  state.discards = run.discards;
  state.selected = run.selectedCardId;
  state.purgeSelect = Array.isArray(run.purge) ? run.purge.slice() : null;
}

function syncBeforePurgeAction(target) {
  if (typeof target.tlrSyncRunToStore === 'function') target.tlrSyncRunToStore();
}

export function canStartPurgeWithCard(uid, target = window) {
  const state = stateOf(target);
  const run = target.tlrStore?.getState?.()?.run;
  if (!state || (run?.busy ?? state.busy)) return false;
  if ((run?.ability?.targeting || state.abilitySelect) || (run?.purge ?? state.purgeSelect) !== null) return false;
  const hand = run?.hand || state.hand || [];
  return hand.length >= 3 && hand.some(card => card.uid === uid);
}

export function startPurge(target = window) {
  const state = stateOf(target);
  if (!storeReady(target)) {
    if (state.busy || state.hand.length < 3 || state.abilitySelect || state.purgeSelect !== null) return false;
    state.purgeSelect = [];
    state.selected = null;
    if (typeof target.render === 'function') target.render();
    return true;
  }
  syncBeforePurgeAction(target);
  target.tlrStore.dispatch({ type: target.tlrActions.START_PURGE });
  syncRunToLegacy(target);
  if (typeof target.render === 'function') target.render();
  return Array.isArray(state.purgeSelect);
}

export function togglePurgeCard(uid, target = window) {
  const state = stateOf(target);
  if (!storeReady(target)) {
    if (state.purgeSelect === null) return false;
    const idx = state.purgeSelect.indexOf(uid);
    if (idx >= 0) state.purgeSelect.splice(idx, 1);
    else if (state.purgeSelect.length < 3) state.purgeSelect.push(uid);
    if (typeof target.refreshHandState === 'function') target.refreshHandState();
    return true;
  }
  target.tlrStore.dispatch({ type: target.tlrActions.TOGGLE_PURGE_CARD, cardId: uid });
  syncRunToLegacy(target);
  if (typeof target.refreshHandState === 'function') target.refreshHandState();
  return Array.isArray(state.purgeSelect) && state.purgeSelect.includes(uid);
}

export function startPurgeWithCard(uid, target = window) {
  if (!canStartPurgeWithCard(uid, target)) return false;
  if (!startPurge(target)) return false;
  return togglePurgeCard(uid, target);
}

export function confirmPurge(target = window) {
  const state = stateOf(target);
  if (!storeReady(target)) {
    if (!state.purgeSelect || state.purgeSelect.length !== 3) return;
    state.hand = state.hand.filter(card => !state.purgeSelect.includes(card.uid));
    state.discards += 1;
    state.purgeSelect = null;
    if (typeof target.render === 'function') target.render();
    if (typeof target.checkEnd === 'function') target.checkEnd();
    return;
  }
  target.tlrStore.dispatch({ type: target.tlrActions.CONFIRM_PURGE });
  syncRunToLegacy(target);
  if (typeof target.render === 'function') target.render();
  if (typeof target.checkEnd === 'function') target.checkEnd();
}

export function cancelPurge(target = window) {
  const state = stateOf(target);
  if (!storeReady(target)) {
    state.purgeSelect = null;
    if (typeof target.render === 'function') target.render();
    return;
  }
  target.tlrStore.dispatch({ type: target.tlrActions.CANCEL_PURGE });
  syncRunToLegacy(target);
  if (typeof target.render === 'function') target.render();
}

export function installPurgeRuntime(target = window) {
  if (!target || target.__tlrPurgeRuntimeInstalled) return;
  target.__tlrPurgeRuntimeInstalled = true;
  target.tlrPurgeRuntime = { startPurge, startPurgeWithCard, canStartPurgeWithCard, togglePurgeCard, confirmPurge, cancelPurge };
  target.startPurge = () => startPurge(target);
  target.startPurgeWithCardUid = uid => startPurgeWithCard(uid, target);
  target.canStartPurgeWithCardUid = uid => canStartPurgeWithCard(uid, target);
  target.togglePurgeCard = uid => togglePurgeCard(uid, target);
  target.confirmPurge = () => confirmPurge(target);
  target.cancelPurge = () => cancelPurge(target);
}
