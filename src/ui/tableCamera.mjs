// Fixed-view table camera controller for the physical-table presentation.
// The camera is derived from real interaction state rather than scattered
// one-off class toggles: selected/dragging/ability/purge => inspect, otherwise seated.

let interactionDepth = 0;
let returnTimer = null;
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
  return !!(run?.abilitySelection ?? target.state?.abilitySelect);
}

function hasPurgeTargeting(target = window) {
  const run = target.tlrStore?.getState?.()?.run;
  const purge = run?.purge ?? target.state?.purgeSelect;
  return purge !== null && purge !== undefined;
}

function shouldInspect(target = window) {
  return interactionDepth > 0 ||
    selectedCardId(target) !== null ||
    hasAbilityTargeting(target) ||
    hasPurgeTargeting(target);
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
    activePointers.add(event.pointerId);
    try { card.setPointerCapture(event.pointerId); } catch (error) {}
    beginTableInteraction(target);
  }, true);

  const finishPointer = event => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.delete(event.pointerId);
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
    const relevant = event.target instanceof Element &&
      event.target.closest('#hand .card[data-uid],#spread .slot,.spread-actions,#abilityPrompt,#purgePrompt');
    if (relevant) target.queueMicrotask(() => syncTableView(target));
  }, true);

  target.addEventListener('pageshow', () => syncTableView(target));
  target.addEventListener('blur', () => {
    activePointers.clear();
    interactionDepth = 0;
    body.classList.remove('table-interacting');
    syncTableView(target);
  });

  syncTableView(target);
}
