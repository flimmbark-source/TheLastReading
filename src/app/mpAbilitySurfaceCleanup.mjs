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

function installMpHandReturnGuard(target, doc) {
  if (target.__tlrMpHandReturnGuardInstalled) return;
  target.__tlrMpHandReturnGuardInstalled = true;

  const finishBackInHand = event => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    const draggedCard = doc.querySelector('.hand-card-dragging[data-uid]');
    if (!draggedCard) return;
    if (event.type !== 'pointercancel' && !pointIsOverHand(doc, event, draggedCard)) return;

    if (target.tlrCancelHandDrag?.()) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
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
  `;
  doc.head.appendChild(style);
}

export function installMpAbilitySurfaceCleanup(target = window) {
  if (!target || target.__tlrMpAbilitySurfaceCleanupInstalled) return;
  target.__tlrMpAbilitySurfaceCleanupInstalled = true;
  const doc = target.document;
  if (!doc) return;
  installMpHandReturnGuard(target, doc);
  installDuelReferenceSurfaceStyle(doc);
}
