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
  return (run?.purge ?? target.state?.purgeSelect) !== null &&
    (run?.purge ?? target.state?.purgeSelect) !== undefined;
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
  const body = target.document.body;
  if (!body.dataset.tableView) body.dataset.tableView = 'seated';

  target.__tlrBeginTableInteraction = () => beginTableInteraction(target);
  target.__tlrEndTableInteraction = options => endTableInteraction(options, target);
  target.__tlrSyncTableView = () => syncTableView(target);
  target.__tlrSetTableView = view => setTableView(view, target);

  target.addEventListener('pageshow', () => syncTableView(target));
  target.addEventListener('blur', () => {
    interactionDepth = 0;
    body.classList.remove('table-interacting');
    syncTableView(target);
  });

  syncTableView(target);
}
