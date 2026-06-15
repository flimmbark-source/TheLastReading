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

export function startPurge(target = window) {
  const state = stateOf(target);
  if (!storeReady(target)) {
    if (state.busy || state.hand.length < 3 || state.abilitySelect || state.purgeSelect !== null) return;
    state.purgeSelect = [];
    state.selected = null;
    if (typeof target.render === 'function') target.render();
    return;
  }
  syncBeforePurgeAction(target);
  target.tlrStore.dispatch({ type: target.tlrActions.START_PURGE });
  syncRunToLegacy(target);
  if (typeof target.render === 'function') target.render();
}

export function togglePurgeCard(uid, target = window) {
  const state = stateOf(target);
  if (!storeReady(target)) {
    if (state.purgeSelect === null) return;
    const idx = state.purgeSelect.indexOf(uid);
    if (idx >= 0) state.purgeSelect.splice(idx, 1);
    else if (state.purgeSelect.length < 3) state.purgeSelect.push(uid);
    if (typeof target.refreshHandState === 'function') target.refreshHandState();
    return;
  }
  target.tlrStore.dispatch({ type: target.tlrActions.TOGGLE_PURGE_CARD, cardId: uid });
  syncRunToLegacy(target);
  if (typeof target.refreshHandState === 'function') target.refreshHandState();
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
  target.tlrPurgeRuntime = { startPurge, togglePurgeCard, confirmPurge, cancelPurge };
  target.startPurge = () => startPurge(target);
  target.togglePurgeCard = uid => togglePurgeCard(uid, target);
  target.confirmPurge = () => confirmPurge(target);
  target.cancelPurge = () => cancelPurge(target);
}
