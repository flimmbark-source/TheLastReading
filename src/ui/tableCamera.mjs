// Fixed-view table camera controller.
// Views change only through explicit player intent:
// - click/tap the spread to inspect it
// - tap the hand swipe area without swiping to return to the seated view

let installed = false;

function isSingleplayerTable(target = window) {
  const body = target.document?.body;
  if (!body) return false;
  return !body.classList.contains('mp-game-active');
}

export function setTableView(view, target = window) {
  const body = target.document?.body;
  if (!body || !isSingleplayerTable(target)) return;
  const next = view === 'inspect' ? 'inspect' : 'seated';
  if (body.dataset.tableView === next) return;
  body.dataset.tableView = next;
}

// Retained for compatibility with existing callers. The camera is no longer
// derived from card selection, dragging, ability targeting, or purge state.
export function syncTableView(target = window) {
  const body = target.document?.body;
  if (!body || body.dataset.tableView) return;
  setTableView('seated', target);
}

export function beginTableInteraction(target = window) {
  setTableView('inspect', target);
}

export function endTableInteraction(options = {}, target = window) {
  if (options?.returnToSeated) setTableView('seated', target);
}

export function installTableCamera(target = window) {
  if (installed || !target?.document) return;
  installed = true;

  const doc = target.document;
  const body = doc.body;
  const TAP_SLOP = 12;
  let swipeTap = null;

  if (!body.dataset.tableView) body.dataset.tableView = 'seated';

  target.__tlrBeginTableInteraction = () => setTableView('inspect', target);
  target.__tlrEndTableInteraction = options => endTableInteraction(options, target);
  target.__tlrSyncTableView = () => syncTableView(target);
  target.__tlrSetTableView = view => setTableView(view, target);

  // Clicking anywhere on the actual spread enters the close top-down view.
  doc.addEventListener('click', event => {
    if (!isSingleplayerTable(target)) return;
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest('#spread')) setTableView('inspect', target);
  }, true);

  // The swipe strip doubles as the deliberate "lean back" control, but only
  // when the pointer did not travel far enough to count as a swipe.
  doc.addEventListener('pointerdown', event => {
    if (!isSingleplayerTable(target)) return;
    const element = event.target instanceof Element ? event.target : null;
    if (!element?.closest('#handSwipeZone')) return;
    swipeTap = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }, true);

  doc.addEventListener('pointermove', event => {
    if (!swipeTap || event.pointerId !== swipeTap.pointerId) return;
    const dx = event.clientX - swipeTap.startX;
    const dy = event.clientY - swipeTap.startY;
    if (Math.hypot(dx, dy) > TAP_SLOP) swipeTap.moved = true;
  }, true);

  const finishSwipeTap = event => {
    if (!swipeTap || event.pointerId !== swipeTap.pointerId) return;
    const shouldReturn = event.type === 'pointerup' && !swipeTap.moved;
    swipeTap = null;
    if (shouldReturn) setTableView('seated', target);
  };

  doc.addEventListener('pointerup', finishSwipeTap, true);
  doc.addEventListener('pointercancel', finishSwipeTap, true);

  target.addEventListener('pageshow', () => syncTableView(target));
  target.addEventListener('blur', () => {
    swipeTap = null;
  });
}
