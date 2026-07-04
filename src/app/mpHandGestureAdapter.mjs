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
  const selectedNode = () => doc.querySelector('#hand > .card.sel[data-uid], body > .card.sel[data-uid]');
  const selectedUid = () => cardUid(selectedNode());

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

  const setSelected = uid => {
    const current = selectedUid();
    if (current === uid) return;
    if (uid == null) {
      selectedNode()?.onclick?.();
      return;
    }
    const card = doc.querySelector(`#hand > .card[data-uid="${uid}"]`);
    card?.onclick?.();
  };

  const reorderHand = (uid, toIndex, context = {}) => {
    reconcileOrder(player()?.hand || []);
    const currentIndex = handOrder.indexOf(uid);
    if (currentIndex < 0) return;
    handOrder.splice(currentIndex, 1);
    handOrder.splice(Math.max(0, Math.min(toIndex, handOrder.length)), 0, uid);
    insertCardAt(context.cardEl, toIndex);
    applyDomOrder();
    if (selectedUid() === uid) setSelected(null);
  };

  const returnCard = (uid, originalIndex, context = {}) => {
    reconcileOrder(player()?.hand || []);
    insertCardAt(context.cardEl, originalIndex);
    applyDomOrder();
    if (selectedUid() === uid) setSelected(null);
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
    returnCard,
  };
}
