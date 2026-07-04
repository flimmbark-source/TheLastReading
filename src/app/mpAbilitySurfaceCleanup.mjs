const SLOT_HIT_PAD = 28;

function mpIsActive(doc) {
  return doc.body.classList.contains('mp-game-active');
}

function handElement(doc) {
  return doc.getElementById('hand') || doc.querySelector('.hand');
}

function handCardNodes(doc) {
  const hand = handElement(doc);
  return hand ? [...hand.querySelectorAll(':scope > .card[data-uid]')] : [];
}

function cardUid(node) {
  const uid = Number(node?.dataset?.uid);
  return Number.isFinite(uid) ? uid : null;
}

function mpPlayerIndex(target) {
  return target.tlrMpGetRole?.() === 'host' ? 0 : 1;
}

function mpCardForUid(target, uid) {
  const state = target.tlrMpGetState?.();
  const player = state?.players?.[mpPlayerIndex(target)];
  return (player?.hand || []).find(card => card.uid === uid) || null;
}

function validSpreadDrop(doc, draggedCard) {
  const cardRect = draggedCard?.getBoundingClientRect?.();
  if (!cardRect) return null;
  const cardCX = cardRect.left + cardRect.width / 2;
  const cardCY = cardRect.top + cardRect.height / 2;

  for (const [index, slot] of [...doc.querySelectorAll('#spread .slot')].entries()) {
    if (slot.querySelector('.card')) continue;
    const rect = slot.getBoundingClientRect();
    if (cardCX >= rect.left - SLOT_HIT_PAD
      && cardCX <= rect.right + SLOT_HIT_PAD
      && cardCY >= rect.top - SLOT_HIT_PAD
      && cardCY <= rect.bottom + SLOT_HIT_PAD) {
      return { slot, index };
    }
  }
  return null;
}

function hoverIndexForPointer(target, clientX, handLength) {
  if (handLength <= 1) return 0;
  const track = target.__handGetTrackState?.();
  if (!track?.spacingDeg || !track.handRect) return handLength - 1;
  const centerX = track.handRect.left + track.handRect.width / 2;
  const dx = clientX - centerX;
  const ratio = Math.max(-0.95, Math.min(0.95, dx / Math.max(1, track.radius)));
  const totalAngle = Math.asin(ratio) * 180 / Math.PI;
  const fractionalSlot = (totalAngle - track.offsetDeg) / track.spacingDeg;
  return Math.max(0, Math.min(handLength - 1, Math.round(fractionalSlot + (handLength - 1) / 2)));
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
      if (target.__tlrMpReturnedDragClick?.token === token) target.__tlrMpReturnedDragClick = null;
    }, 0);
  };
}

function installMpSinglePlayerHandBridge(target, doc) {
  if (target.__tlrMpSinglePlayerHandBridgeInstalled) return;
  target.__tlrMpSinglePlayerHandBridgeInstalled = true;

  let order = [];
  let drag = null;
  let applyingOrder = false;
  let orderFrame = null;

  const clearSelection = uid => {
    if (uid == null) return;
    const selected = doc.querySelector(`#hand .card.sel[data-uid="${uid}"]`);
    selected?.onclick?.();
  };

  const applyOrder = () => {
    orderFrame = null;
    if (!mpIsActive(doc) || target.__handReorderActive || applyingOrder) return;
    const hand = handElement(doc);
    const nodes = handCardNodes(doc);
    if (!hand || !nodes.length) {
      order = [];
      return;
    }

    const byUid = new Map(nodes.map(node => [cardUid(node), node]));
    order = order.filter(uid => byUid.has(uid));
    for (const node of nodes) {
      const uid = cardUid(node);
      if (uid != null && !order.includes(uid)) order.push(uid);
    }

    applyingOrder = true;
    order.forEach(uid => {
      const node = byUid.get(uid);
      if (node && node.parentElement === hand) hand.appendChild(node);
    });
    const finalNodes = handCardNodes(doc);
    finalNodes.forEach((node, index) => node.style.setProperty('--slot', String(index - (finalNodes.length - 1) / 2)));
    applyingOrder = false;
    target.__handTriggerLayout?.();
  };

  const scheduleOrder = () => {
    if (orderFrame || !mpIsActive(doc)) return;
    orderFrame = target.requestAnimationFrame?.(applyOrder) || target.setTimeout?.(applyOrder, 0);
  };

  const hand = handElement(doc);
  if (hand) {
    new MutationObserver(() => {
      if (!applyingOrder) scheduleOrder();
    }).observe(hand, { childList: true });
  }

  new MutationObserver(() => {
    if (!mpIsActive(doc)) {
      order = [];
      drag = null;
      target.__tlrMpReturnedDragClick = null;
    } else {
      scheduleOrder();
    }
  }).observe(doc.body, { attributes: true, attributeFilter: ['class'] });

  doc.addEventListener('pointerdown', event => {
    if (!mpIsActive(doc)) return;
    const card = event.target?.closest?.('#hand .card[data-uid]');
    if (!card) return;
    applyOrder();
    const uid = cardUid(card);
    if (uid == null) return;
    const selected = doc.querySelector('#hand .card.sel[data-uid]');
    drag = {
      pointerId: event.pointerId,
      uid,
      originalIndex: Math.max(0, order.indexOf(uid)),
      selectedUid: cardUid(selected),
    };
  }, true);

  target.addEventListener('pointerup', event => {
    if (!mpIsActive(doc) || !drag || event.pointerId !== drag.pointerId) return;
    const draggedCard = doc.querySelector(`.hand-card-dragging[data-uid="${drag.uid}"]`);
    if (!draggedCard) {
      drag = null;
      return;
    }

    // A valid spread placement is already handled correctly by the shared
    // single-player gesture controller through the multiplayer placeCardUid
    // override. Only hand returns, hand reorders, detail pulls, and invalid
    // spread drops need a multiplayer commit path.
    if (validSpreadDrop(doc, draggedCard)) {
      const previousSelection = drag.selectedUid;
      const draggedUid = drag.uid;
      drag = null;
      if (previousSelection != null && previousSelection !== draggedUid) {
        target.setTimeout?.(() => clearSelection(previousSelection), 0);
      }
      return;
    }

    const context = drag;
    drag = null;
    const wantsDetail = draggedCard.classList.contains('hand-card-detail-pull');
    const targetIndex = hoverIndexForPointer(target, event.clientX, Math.max(1, order.length));
    target.__tlrArmMpReturnedDragClick?.(context.uid);

    if (!target.tlrCancelHandDrag?.()) {
      target.__tlrMpReturnedDragClick = null;
      return;
    }

    // The shared controller set an 800ms blanket timer at drag start. This
    // bridge replaces it with the one synthetic-click guard above, so a real
    // follow-up tap remains responsive.
    target.__handGestureSuppressClickUntil = 0;

    if (context.selectedUid != null && context.selectedUid !== context.uid) {
      clearSelection(context.selectedUid);
    }

    if (wantsDetail) {
      const card = mpCardForUid(target, context.uid);
      if (card) target.expandCard?.(card, target);
    } else {
      const fromIndex = order.indexOf(context.uid);
      if (fromIndex >= 0) order.splice(fromIndex, 1);
      order.splice(Math.max(0, Math.min(targetIndex, order.length)), 0, context.uid);
      applyOrder();
      clearSelection(context.uid);
    }

    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }, true);

  target.addEventListener('pointercancel', event => {
    if (!mpIsActive(doc) || !drag || event.pointerId !== drag.pointerId) return;
    const uid = drag.uid;
    drag = null;
    target.__tlrArmMpReturnedDragClick?.(uid);
    if (target.tlrCancelHandDrag?.()) {
      target.__handGestureSuppressClickUntil = 0;
      applyOrder();
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    }
  }, true);
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
  installMpSinglePlayerHandBridge(target, doc);
  installDuelReferenceSurfaceStyle(doc);
}
