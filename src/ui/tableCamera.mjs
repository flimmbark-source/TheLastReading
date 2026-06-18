// Fixed-view table camera controller for the physical-table presentation.
// The camera is derived from real interaction state rather than scattered
// one-off class toggles: selected/dragging/ability/purge => inspect, otherwise seated.

let interactionDepth = 0;
let returnTimer = null;
let inspectHoldTimer = null;
let inspectHoldUntil = 0;
let installed = false;

function isSingleplayerTable(target = window) {
  const body = target.document?.body;
  if (!body) return false;
  return !body.classList.contains('mp-game-active');
}

function selectedCardId(target = window) {
  const run = target.tlrStore?.getState?.()?.run;
  if (run && Object.prototype.hasOwnProperty.call(run, 'selectedCardId')) {
    return run.selectedCardId;
  }
  return target.state?.selected ?? null;
}

function hasAbilityTargeting(target = window) {
  const run = target.tlrStore?.getState?.()?.run;
  return !!(run?.ability ?? target.state?.abilitySelect);
}

function hasPurgeTargeting(target = window) {
  const run = target.tlrStore?.getState?.()?.run;
  const purge = run?.purge ?? target.state?.purgeSelect;
  return purge !== null && purge !== undefined;
}

function hasInspectHold() {
  return performance.now() < inspectHoldUntil;
}

function shouldInspect(target = window) {
  return interactionDepth > 0 ||
    hasInspectHold() ||
    selectedCardId(target) !== null ||
    hasAbilityTargeting(target) ||
    hasPurgeTargeting(target);
}

function clearInspectHold(target = window) {
  inspectHoldUntil = 0;
  if (inspectHoldTimer !== null) {
    target.clearTimeout(inspectHoldTimer);
    inspectHoldTimer = null;
  }
}

function holdInspectFor(duration, target = window) {
  clearInspectHold(target);
  inspectHoldUntil = performance.now() + Math.max(0, Number(duration) || 0);
  setTableView('inspect', target);
  inspectHoldTimer = target.setTimeout(() => {
    inspectHoldTimer = null;
    inspectHoldUntil = 0;
    syncTableView(target);
  }, Math.max(0, Number(duration) || 0));
}

export function setTableView(view, target = window) {
  const body = target.document?.body;
  if (!body || !isSingleplayerTable(target)) return;
  const next = view === 'inspect' ? 'inspect' : 'seated';
  if (body.dataset.tableView === next) return;
  body.dataset.tableView = next;
}

export function syncTableView(target = window) {
  if (returnTimer !== null) {
    target.clearTimeout(returnTimer);
    returnTimer = null;
  }
  setTableView(shouldInspect(target) ? 'inspect' : 'seated', target);
}

export function beginTableInteraction(target = window) {
  if (!isSingleplayerTable(target)) return;
  clearInspectHold(target);
  if (returnTimer !== null) {
    target.clearTimeout(returnTimer);
    returnTimer = null;
  }
  interactionDepth += 1;
  target.document.body.classList.add('table-interacting');
  setTableView('inspect', target);
}

export function endTableInteraction(options = {}, target = window) {
  if (!isSingleplayerTable(target)) return;
  interactionDepth = Math.max(0, interactionDepth - 1);
  if (interactionDepth > 0) return;

  target.document.body.classList.remove('table-interacting');
  const delay = Math.max(0, Number(options.delay ?? 0));
  if (returnTimer !== null) target.clearTimeout(returnTimer);
  returnTimer = target.setTimeout(() => {
    returnTimer = null;
    setTableView(shouldInspect(target) ? 'inspect' : 'seated', target);
  }, delay);
}

export function installTableCamera(target = window) {
  if (installed || !target?.document) return;
  installed = true;
  const doc = target.document;
  const body = doc.body;
  const activePointers = new Set();
  let pressedSelectedUid = null;
  if (!body.dataset.tableView) body.dataset.tableView = 'seated';

  target.__tlrBeginTableInteraction = () => beginTableInteraction(target);
  target.__tlrEndTableInteraction = options => endTableInteraction(options, target);
  target.__tlrSyncTableView = () => syncTableView(target);
  target.__tlrSetTableView = view => setTableView(view, target);

  // Switch before drag recognition starts and capture the pointer immediately.
  // This keeps portrait drags attached to the original card even when the finger
  // leaves the visible card bounds while the camera is moving.
  doc.addEventListener('pointerdown', event => {
    if (!isSingleplayerTable(target)) return;
    const card = event.target instanceof Element
      ? event.target.closest('#hand .card[data-uid]')
      : null;
    if (!card) return;
    if (activePointers.has(event.pointerId)) return;
    const uid = Number(card.dataset.uid);
    pressedSelectedUid = selectedCardId(target) === uid ? uid : null;
    activePointers.add(event.pointerId);
    try { card.setPointerCapture(event.pointerId); } catch (error) {}
    beginTableInteraction(target);
  }, true);

  const finishPointer = event => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.delete(event.pointerId);
    if (event.type === 'pointercancel') pressedSelectedUid = null;
    // A short grace period allows the synthetic click to commit selection before
    // deciding whether to return to seated view. Placement/cancelled drag returns.
    endTableInteraction({ delay: event.type === 'pointercancel' ? 0 : 90 }, target);
  };
  doc.addEventListener('pointerup', finishPointer, true);
  doc.addEventListener('pointercancel', finishPointer, true);

  // Selection, ability, purge, and placement are reducer-backed in the current
  // architecture. Subscribe once so camera state follows non-pointer changes too.
  const store = target.tlrStore;
  if (store && typeof store.subscribe === 'function') {
    store.subscribe(() => target.queueMicrotask(() => syncTableView(target)));
  }

  // Legacy paths can still change selection during click handlers.
  doc.addEventListener('click', event => {
    const element = event.target instanceof Element ? event.target : null;
    const card = element?.closest('#hand .card[data-uid]') || null;
    const relevant = element &&
      element.closest('#hand .card[data-uid],#spread .slot,.spread-actions,#abilityPrompt,#purgePrompt');
    if (!relevant) return;

    const wasSelectedUid = pressedSelectedUid;
    pressedSelectedUid = null;
    target.queueMicrotask(() => {
      const clickedUid = card ? Number(card.dataset.uid) : null;
      const deselected = clickedUid !== null &&
        clickedUid === wasSelectedUid &&
        selectedCardId(target) === null &&
        !hasAbilityTargeting(target) &&
        !hasPurgeTargeting(target);

      if (deselected) {
        holdInspectFor(2000, target);
        return;
      }
      syncTableView(target);
    });
  }, true);

  target.addEventListener('pageshow', () => syncTableView(target));
  target.addEventListener('blur', () => {
    activePointers.clear();
    pressedSelectedUid = null;
    interactionDepth = 0;
    clearInspectHold(target);
    body.classList.remove('table-interacting');
    syncTableView(target);
  });

  syncTableView(target);
}
