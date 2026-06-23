const QUEUE_KEY = '__tlrDrawAnimationQueue';

function queueState(target) {
  if (!target[QUEUE_KEY]) {
    target[QUEUE_KEY] = {
      batchId: 0,
      entries: new Map(),
    };
  }
  return target[QUEUE_KEY];
}

function cardUid(card) {
  const uid = Number(card?.uid ?? card);
  return Number.isFinite(uid) ? uid : null;
}

export function queueDrawAnimation(cards, target = window, { staggerMs = 72 } = {}) {
  const list = (Array.isArray(cards) ? cards : [cards])
    .map(cardUid)
    .filter(uid => uid !== null);
  if (!list.length) return [];

  const state = queueState(target);
  const batchId = ++state.batchId;
  list.forEach((uid, index) => {
    state.entries.set(uid, {
      uid,
      batchId,
      index,
      delayMs: Math.max(0, Number(staggerMs) || 0) * index,
    });
  });
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

  target.tlrDrawAnimation = {
    queue: cards => queueDrawAnimation(cards, target),
    consume: uid => consumeDrawAnimation(uid, target),
    clear: () => clearDrawAnimations(target),
  };
  target.tlrQueueDrawAnimation = cards => queueDrawAnimation(cards, target);
}
