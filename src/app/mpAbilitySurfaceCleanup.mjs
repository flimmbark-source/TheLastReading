function pointIsOverHand(doc, event, draggedCard) {
  const stack = typeof doc.elementsFromPoint === 'function'
    ? doc.elementsFromPoint(event.clientX, event.clientY)
    : [];

  if (stack.some(node => {
    if (node === draggedCard || typeof node?.closest !== 'function') return false;
    return !!node.closest('#hand,.handDock') && !node.closest('#spread');
  })) return true;

  const dock = doc.querySelector('.handDock');
  const rect = dock?.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return event.clientX >= rect.left
    && event.clientX <= rect.right
    && event.clientY >= rect.top
    && event.clientY <= rect.bottom;
}

function installMpReturnedDragClickGuard(target, doc) {
  if (target.__tlrMpReturnedDragClickGuardInstalled) return;
  target.__tlrMpReturnedDragClickGuardInstalled = true;

  target.addEventListener('click', event => {
    const pending = target.__tlrMpReturnedDragClick;
    if (!pending) return;
    const card = event.target?.closest?.('#hand .card[data-uid]');
    if (!card || String(card.dataset.uid) !== pending.uid) return;

    target.__tlrMpReturnedDragClick = null;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  }, true);

  target.__tlrArmMpReturnedDragClick = uid => {
    const token = {};
    target.__tlrMpReturnedDragClick = { uid: String(uid), token };
    target.setTimeout?.(() => {
      if (target.__tlrMpReturnedDragClick?.token === token) {
        target.__tlrMpReturnedDragClick = null;
      }
    }, 0);
  };
}

function installMpHandReturnGuard(target, doc) {
  if (target.__tlrMpHandReturnGuardInstalled) return;
  target.__tlrMpHandReturnGuardInstalled = true;

  const finishBackInHand = event => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    const draggedCard = doc.querySelector('.hand-card-dragging[data-uid]');
    if (!draggedCard) return;
    if (event.type !== 'pointercancel' && !pointIsOverHand(doc, event, draggedCard)) return;

    const uid = draggedCard.dataset.uid;
    target.__tlrArmMpReturnedDragClick?.(uid);
    if (target.tlrCancelHandDrag?.()) {
      // The generic gesture controller suppresses clicks for 800ms from drag
      // start. Duel mode replaces that broad timer with the one-shot guard above
      // so the drag's synthetic click is swallowed but the player's next real
      // tap can select a card immediately.
      target.__handGestureSuppressClickUntil = 0;
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    } else {
      target.__tlrMpReturnedDragClick = null;
    }
  };

  // Window capture runs before gestureCard's document-capture pointerup handler.
  // That prevents duel drops over the hand from entering the single-player
  // REORDER_HAND/render path, which can replace the multiplayer hand with the
  // unrelated single-player hand state.
  target.addEventListener('pointerup', finishBackInHand, true);
  target.addEventListener('pointercancel', finishBackInHand, true);
}

function installDuelReferenceSurfaceStyle(doc) {
  if (doc.getElementById('mp-reference-surface-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-reference-surface-style';
  style.textContent = `
    body.mp-game-active #scoringPullTab,
    body.mp-game-active #abilitiesPullTab { display: none !important; }

    body.mp-game-active #scoringPullWrap > .spv2-menu-close-tab,
    body.mp-game-active #abilitiesPullWrap > .spv2-menu-close-tab {
      display: none !important;
      left: 50% !important;
      right: auto !important;
      transform: translateX(-50%) !important;
    }

    body.mp-game-active #scoringPullWrap.open > .spv2-menu-close-tab,
    body.mp-game-active #abilitiesPullWrap.open > .spv2-menu-close-tab {
      display: flex !important;
    }

    body.mp-game-active #titleWrap {
      z-index: 2147483100 !important;
    }

    body.mp-game-active #titleWrap .actions,
    body.mp-game-active #scoringBtn,
    body.mp-game-active #abilitiesBtn {
      z-index: auto !important;
    }

    body.mp-game-active #scoringPullWrap.open,
    body.mp-game-active #abilitiesPullWrap.open {
      z-index: 2147483250 !important;
    }
  `;
  doc.head.appendChild(style);
}

export function installMpAbilitySurfaceCleanup(target = window) {
  if (!target || target.__tlrMpAbilitySurfaceCleanupInstalled) return;
  target.__tlrMpAbilitySurfaceCleanupInstalled = true;
  const doc = target.document;
  if (!doc) return;
  installMpReturnedDragClickGuard(target, doc);
  installMpHandReturnGuard(target, doc);
  installDuelReferenceSurfaceStyle(doc);
}
