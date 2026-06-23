const QUEUE_KEY = '__tlrDrawAnimationQueue';
const FULL_HAND_ACTIONS = ['startReading', 'continueSet', 'flushHand', 'mulligan'];

function queueState(target) {
  if (!target[QUEUE_KEY]) target[QUEUE_KEY] = { batchId: 0, entries: new Map(), flushQueued: false };
  return target[QUEUE_KEY];
}

function cardUid(card) {
  const uid = Number(card?.uid ?? card);
  return Number.isFinite(uid) ? uid : null;
}

function animateCard(element, entry, target) {
  if (!element?.isConnected) return;
  element.classList.remove('card-draw-dealt');
  element.style.setProperty('--draw-delay', `${entry.delayMs}ms`);
  void element.offsetWidth;
  element.classList.add('card-draw-dealt');
  element.addEventListener('animationend', () => {
    element.classList.remove('card-draw-dealt');
    element.style.removeProperty('--draw-delay');
  }, { once: true });
}

function flushQueuedHandAnimations(target) {
  const state = queueState(target);
  state.flushQueued = false;
  const hand = target.document?.getElementById('hand');
  if (!hand) return;
  const cards = [...hand.querySelectorAll(':scope > .card[data-uid]')];
  if (target.__tlrAnimateFullHandOnNextRender) {
    target.__tlrAnimateFullHandOnNextRender = false;
    queueDrawAnimation(cards.map(element => Number(element.dataset.uid)), target, { staggerMs: 78 });
  }
  cards.forEach(element => {
    const entry = consumeDrawAnimation(Number(element.dataset.uid), target);
    if (entry) animateCard(element, entry, target);
  });
}

function scheduleHandAnimationFlush(target) {
  const state = queueState(target);
  if (state.flushQueued) return;
  state.flushQueued = true;
  target.requestAnimationFrame(() => flushQueuedHandAnimations(target));
}

function wrapFullHandDeal(target, name) {
  const original = target[name];
  if (typeof original !== 'function' || original.__tlrDrawAnimationWrapped) return;
  const wrapped = function (...args) {
    target.__tlrAnimateFullHandOnNextRender = true;
    const result = original.apply(this, args);
    if (result === false) target.__tlrAnimateFullHandOnNextRender = false;
    else scheduleHandAnimationFlush(target);
    return result;
  };
  wrapped.__tlrDrawAnimationWrapped = true;
  target[name] = wrapped;
}

export function queueDrawAnimation(cards, target = window, { staggerMs = 72 } = {}) {
  const list = (Array.isArray(cards) ? cards : [cards]).map(cardUid).filter(uid => uid !== null);
  if (!list.length) return [];
  const state = queueState(target);
  const batchId = ++state.batchId;
  list.forEach((uid, index) => state.entries.set(uid, {
    uid,
    batchId,
    index,
    delayMs: Math.max(0, Number(staggerMs) || 0) * index,
  }));
  scheduleHandAnimationFlush(target);
  return list;
}

export function consumeDrawAnimation(cardOrUid, target = window) {
  const uid = cardUid(cardOrUid);
  if (uid === null) return null;
  const state = queueState(target);
  const entry = state.entries.get(uid) || null;
  if (entry) state.entries.delete(uid);
  return entry;
}

export function clearDrawAnimations(target = window) {
  queueState(target).entries.clear();
  target.__tlrAnimateFullHandOnNextRender = false;
}

export function installDrawAnimation(target = window) {
  if (!target || target.__tlrDrawAnimationInstalled) return;
  target.__tlrDrawAnimationInstalled = true;
  const doc = target.document;
  if (doc && !doc.getElementById('draw-animation-styles')) {
    const link = doc.createElement('link');
    link.id = 'draw-animation-styles';
    link.rel = 'stylesheet';
    link.href = 'src/styles/drawAnimation.css?v=1';
    doc.head.appendChild(link);
  }
  FULL_HAND_ACTIONS.forEach(name => wrapFullHandDeal(target, name));
  const hand = doc?.getElementById('hand');
  if (hand && target.MutationObserver) {
    new target.MutationObserver(() => scheduleHandAnimationFlush(target))
      .observe(hand, { childList: true, attributes: true, attributeFilter: ['class', 'data-uid'] });
  }
  target.tlrDrawAnimation = {
    queue: cards => queueDrawAnimation(cards, target),
    consume: uid => consumeDrawAnimation(uid, target),
    clear: () => clearDrawAnimations(target),
  };
  target.tlrQueueDrawAnimation = cards => queueDrawAnimation(cards, target);
}
