import { hasSubmittedAction } from '../multiplayer/mpSelectors.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';

function cardUid(node) {
  const uid = Number(node?.dataset?.uid);
  return Number.isFinite(uid) ? uid : null;
}

export function installMpHandGestureAdapter(target = window) {
  if (!target || target.__tlrMpHandGestureAdapterInstalled) return;
  target.__tlrMpHandGestureAdapterInstalled = true;
  const doc = target.document;
  if (!doc) return;

  let handOrder = [];
  const isActive = () => doc.body.classList.contains('mp-game-active') && !!target.tlrMpGetState?.();
  const myIndex = () => target.tlrMpGetRole?.() === 'host' ? 0 : 1;
  const player = () => target.tlrMpGetState?.()?.players?.[myIndex()] || null;

  const reconcileOrder = cards => {
    if (!isActive()) {
      handOrder = [];
      return cards.slice();
    }
    const available = new Set(cards.map(card => card.uid));
    handOrder = handOrder.filter(uid => available.has(uid));
    for (const card of cards) if (!handOrder.includes(card.uid)) handOrder.push(card.uid);
    const byUid = new Map(cards.map(card => [card.uid, card]));
    return handOrder.map(uid => byUid.get(uid)).filter(Boolean);
  };

  const handNode = () => doc.getElementById('hand') || doc.querySelector('.hand');
  const directCards = () => {
    const hand = handNode();
    return hand ? [...hand.querySelectorAll(':scope > .card[data-uid]')] : [];
  };
  const actualSelectedNode = () => doc.querySelector('#hand > .card.sel[data-uid], body > .card.sel[data-uid]');
  const orphanCard = uid => {
    const selector = uid == null
      ? 'body > .card[data-uid]'
      : `body > .card[data-uid="${uid}"]`;
    return doc.querySelector(selector);
  };
  const selectedUid = () => cardUid(orphanCard() || actualSelectedNode());

  const insertCardAt = (card, index) => {
    const hand = handNode();
    if (!hand || !card) return;
    const cards = directCards().filter(node => node !== card);
    const before = cards[Math.max(0, Math.min(index, cards.length))] || null;
    hand.insertBefore(card, before);
  };

  const applyDomOrder = () => {
    const hand = handNode();
    if (!hand) return;
    const allCards = [...doc.querySelectorAll('#hand > .card[data-uid], body > .card[data-uid]')];
    const byUid = new Map(allCards.map(node => [cardUid(node), node]));
    handOrder.forEach((uid, index) => {
      const node = byUid.get(uid);
      if (!node) return;
      const current = hand.children[index];
      if (current !== node) hand.insertBefore(node, current || null);
    });
    target.__handTriggerLayout?.();
  };

  const restoreOrphan = card => {
    if (!card) return;
    reconcileOrder(player()?.hand || []);
    const index = Math.max(0, handOrder.indexOf(cardUid(card)));
    insertCardAt(card, index);
    applyDomOrder();
  };

  const setSelected = uid => {
    if (uid == null) {
      restoreOrphan(orphanCard());
      actualSelectedNode()?.onclick?.();
      return;
    }
    if (cardUid(actualSelectedNode()) === uid) return;
    doc.querySelector(`#hand > .card[data-uid="${uid}"]`)?.onclick?.();
  };

  const reorderHand = (uid, toIndex) => {
    reconcileOrder(player()?.hand || []);
    const currentIndex = handOrder.indexOf(uid);
    if (currentIndex < 0) return;
    handOrder.splice(currentIndex, 1);
    handOrder.splice(Math.max(0, Math.min(toIndex, handOrder.length)), 0, uid);
    insertCardAt(orphanCard(uid) || doc.querySelector(`#hand > .card[data-uid="${uid}"]`), toIndex);
    applyDomOrder();
    if (cardUid(actualSelectedNode()) === uid) setSelected(null);
  };

  const wrapRenderHand = () => {
    if (target.__tlrMpHandOrderRenderWrapped || typeof target.renderHand !== 'function') return;
    target.__tlrMpHandOrderRenderWrapped = true;
    const original = target.renderHand;
    target.renderHand = function (ability, inPurge, view) {
      if (isActive() && view?.hand) view = { ...view, hand: reconcileOrder(view.hand) };
      else if (!isActive()) handOrder = [];
      return original.call(this, ability, inPurge, view);
    };
  };

  wrapRenderHand();
  new MutationObserver(() => {
    if (!isActive()) handOrder = [];
  }).observe(doc.body, { attributes: true, attributeFilter: ['class'] });

  target.tlrHandGestureAdapter = {
    isActive,
    getHand: () => reconcileOrder(player()?.hand || []),
    getSelected: selectedUid,
    setSelected,
    refreshHand: () => target.__handTriggerLayout?.(),
    getTargeting: () => null,
    isPurgeSelecting: () => false,
    isBusy: () => {
      const state = target.tlrMpGetState?.();
      const abilityFlow = doc.body.classList.contains('mp-ability-flow-active')
        || doc.body.classList.contains('mp-persona-ability-active')
        || doc.body.classList.contains('mp-purge-flow-active');
      return abilityFlow || !state || state.phase !== MP_PHASES.PLACEMENT || hasSubmittedAction(state, myIndex());
    },
    isSpreadSlotOccupied: index => !!player()?.spread?.[index],
    getCard: uid => (player()?.hand || []).find(card => card.uid === uid) || null,
    showDetail: card => target.expandCard?.(card, target),
    placeCard: (uid, index) => target.placeCardUid?.(uid, index),
    reorderHand,
  };
}
