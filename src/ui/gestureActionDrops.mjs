// Companion layer for dragging hand cards onto the singleplayer Remove (Purge)
// button. The existing gestureCard controller continues to own movement, hand
// reordering, and spread placement. This layer only intercepts release over
// the Remove button.
//
// Ability activation no longer lives here: abilities are triggered by flicking
// a held card downward (see gestureCard.mjs). The Discard button remains in the
// UI purely as a discards-left indicator and is no longer a drop target.

const DRAG_THRESHOLD = 10;
const ACTION_HIT_PAD = 14;

function containsPoint(rect, x, y, pad = ACTION_HIT_PAD) {
  return !!rect && x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
}

function pointerCancelEvent(target, pointerId, x, y) {
  const init = { bubbles: true, cancelable: true, pointerId, clientX: x, clientY: y };
  try {
    return new target.PointerEvent('pointercancel', init);
  } catch {
    const event = new target.Event('pointercancel', { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      pointerId: { value: pointerId },
      clientX: { value: x },
      clientY: { value: y },
    });
    return event;
  }
}

export function installActionDropGestures(target = window) {
  if (!target || target.__tlrActionDropGesturesInstalled) return;
  target.__tlrActionDropGesturesInstalled = true;

  const doc = target.document;
  if (!doc) return;

  if (!doc.getElementById('action-drop-target-styles')) {
    const link = doc.createElement('link');
    link.id = 'action-drop-target-styles';
    link.rel = 'stylesheet';
    link.href = 'src/styles/actionDropTargets.css?v=18';
    doc.head.appendChild(link);
  }

  let drag = null;
  let activeAction = null;
  let syncTimer = null;

  const purgeButton = () => doc.getElementById('purgeBtn');

  const clearButtonState = () => {
    const purge = purgeButton();
    purge?.classList.remove('card-drop-target');
    purge?.removeAttribute('data-drop-label');
    activeAction = null;
  };

  const clearVisualState = () => {
    if (syncTimer !== null) {
      target.clearTimeout(syncTimer);
      syncTimer = null;
    }
    clearButtonState();
    doc.body?.classList.remove('hand-card-action-drag-active');
  };

  const allowed = uid => typeof target.canStartPurgeWithCardUid === 'function' && target.canStartPurgeWithCardUid(uid);

  const setActiveAction = () => {
    if (activeAction === 'purge') return;
    clearButtonState();
    activeAction = 'purge';
    const button = purgeButton();
    if (!button) return;
    button.classList.add('card-drop-target');
    button.dataset.dropLabel = 'Release to start purge';
  };

  const syncFromPointer = (force = false) => {
    syncTimer = null;
    if (!drag || doc.body?.classList.contains('mp-game-active')) {
      clearVisualState();
      return;
    }

    const moved = Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= DRAG_THRESHOLD;
    const isNormalCardDrag = drag.cardEl?.classList.contains('hand-card-dragging');
    if (!moved || (!force && !isNormalCardDrag)) {
      clearButtonState();
      return;
    }

    doc.body?.classList.add('hand-card-action-drag-active');

    const cardCenterX = drag.x - drag.grabOffsetX;
    const cardCenterY = drag.y - drag.grabOffsetY;

    if (allowed(drag.uid) && containsPoint(purgeButton()?.getBoundingClientRect(), cardCenterX, cardCenterY)) {
      setActiveAction();
      return;
    }
    clearButtonState();
  };

  const scheduleSync = () => {
    if (syncTimer !== null) return;
    // Run after gestureCard's pointermove handler has switched the card into its
    // actual drag state. This avoids activating on purge/ability sweep gestures.
    syncTimer = target.setTimeout(() => syncFromPointer(false), 0);
  };

  target.addEventListener('pointerdown', event => {
    if (doc.body?.classList.contains('mp-game-active')) return;
    const element = event.target instanceof target.Element ? event.target : null;
    const cardEl = element?.closest?.('#hand .card[data-uid]');
    if (!cardEl) return;
    const uid = Number(cardEl.dataset.uid);
    if (!Number.isFinite(uid)) return;
    const rect = cardEl.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      uid,
      cardEl,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      grabOffsetX: event.clientX - (rect.left + rect.width / 2),
      grabOffsetY: event.clientY - (rect.top + rect.height / 2),
    };
  }, true);

  target.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    scheduleSync();
  }, true);

  target.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    syncFromPointer(true);

    const action = activeAction;
    const uid = drag.uid;
    const pointerId = drag.pointerId;
    const x = drag.x;
    const y = drag.y;

    if (!action) {
      drag = null;
      clearVisualState();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    // Let gestureCard clean up its captured pointer and drag classes without
    // committing its normal spread/reorder drop, then perform the action.
    doc.dispatchEvent(pointerCancelEvent(target, pointerId, x, y));
    drag = null;
    clearVisualState();

    target.setTimeout(() => {
      target.startPurgeWithCardUid?.(uid);
    }, 0);
  }, true);

  target.addEventListener('pointercancel', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    clearVisualState();
  }, true);

  target.addEventListener('blur', () => {
    drag = null;
    clearVisualState();
  });
}

installActionDropGestures(window);
