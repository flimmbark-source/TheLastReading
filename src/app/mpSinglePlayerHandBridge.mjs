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

export function installMpSinglePlayerHandBridge(target = window) {
  if (!target || target.__tlrMpSinglePlayerHandBridgeInstalled) return;
  target.__tlrMpSinglePlayerHandBridgeInstalled = true;
  const doc = target.document;
  if (!doc) return;

  let order = [];
  let drag = null;
  let applyingOrder = false;
  let orderFrame = null;
  let pendingSyntheticClick = null;

  const clearSelection = uid => {
    if (uid == null) return;
    const selected = doc.querySelector(`#hand .card.sel[data-uid="${uid}"]`);
    selected?.onclick?.();
  };

  const armSyntheticClickGuard = uid => {
    const token = {};
    pendingSyntheticClick = { uid: String(uid), token };
    target.setTimeout?.(() => {
      if (pendingSyntheticClick?.token === token) pendingSyntheticClick = null;
    }, 0);
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
    order.forEach((uid, index) => {
      const node = byUid.get(uid);
      const current = hand.children[index];
      if (node && node.parentElement === hand && current !== node) hand.insertBefore(node, current || null);
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
      pendingSyntheticClick = null;
    } else {
      scheduleOrder();
    }
  }).observe(doc.body, { attributes: true, attributeFilter: ['class'] });

  target.addEventListener('click', event => {
    if (!pendingSyntheticClick) return;
    const card = event.target?.closest?.('#hand .card[data-uid]');
    if (!card || String(card.dataset.uid) !== pendingSyntheticClick.uid) return;
    pendingSyntheticClick = null;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  }, true);

  doc.addEventListener('pointerdown', event => {
    if (!mpIsActive(doc)) return;
    const card = event.target?.closest?.('#hand .card[data-uid]');
    if (!card) return;
    applyOrder();
    const uid = cardUid(card);
    if (uid == null) return;
    drag = {
      pointerId: event.pointerId,
      uid,
      selectedUid: cardUid(doc.querySelector('#hand .card.sel[data-uid]')),
    };
  }, true);

  target.addEventListener('pointerup', event => {
    if (!mpIsActive(doc) || !drag || event.pointerId !== drag.pointerId) return;
    const draggedCard = doc.querySelector(`.hand-card-dragging[data-uid="${drag.uid}"]`);
    if (!draggedCard) {
      drag = null;
      return;
    }

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
    armSyntheticClickGuard(context.uid);

    if (!target.tlrCancelHandDrag?.()) {
      pendingSyntheticClick = null;
      return;
    }

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
    armSyntheticClickGuard(uid);
    if (target.tlrCancelHandDrag?.()) {
      target.__handGestureSuppressClickUntil = 0;
      applyOrder();
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    }
  }, true);
}
