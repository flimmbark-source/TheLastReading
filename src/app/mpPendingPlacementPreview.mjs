import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';

export function installMpPendingPlacementPreview(target = window) {
  if (!target || target.__tlrMpPendingPlacementPreviewInstalled) return;
  target.__tlrMpPendingPlacementPreviewInstalled = true;

  const doc = target.document;
  if (!doc) return;

  installStyle(doc);
  wrapMatchCallbacks(target, () => queueApply(target));
  installMutationSync(target, doc, () => queueApply(target));
  target.requestAnimationFrame?.(() => applyPendingPlacementPreview(target));
}

function myIndex(target) {
  return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
}

function localPendingPlace(target) {
  const state = target.tlrMpGetState?.();
  const my = myIndex(target);
  const action = state?.pendingActions?.[my];
  if (!state || action?.type !== MP_ACTIONS.MP_PLACE_CARD) return null;
  const player = state.players?.[my];
  const slotIndex = Number(action.slotIndex);
  if (!player || !Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= (player.spread?.length || 0)) return null;
  if (player.spread?.[slotIndex]) return null;
  const card = player.hand?.find(item => item.uid === action.cardUid);
  if (!card) return null;
  return { state, my, player, card, cardUid: action.cardUid, slotIndex };
}

function clearPendingPlacementPreview(doc) {
  doc.querySelectorAll('.mp-local-pending-card').forEach(node => node.remove());
  doc.querySelectorAll('.mp-local-pending-slot').forEach(slot => {
    slot.classList.remove('mp-local-pending-slot', 'filled');
    if (!slot.querySelector('.card')) slot.classList.add('empty');
  });
  doc.querySelectorAll('.mp-local-pending-hidden').forEach(card => card.classList.remove('mp-local-pending-hidden'));
}

function applyPendingPlacementPreview(target = window) {
  const doc = target.document;
  if (!doc?.body?.classList?.contains('mp-game-active')) return;

  const pending = localPendingPlace(target);
  clearPendingPlacementPreview(doc);
  if (!pending) return;

  const handCard = doc.querySelector(`body.mp-game-active #hand .card[data-uid="${pending.cardUid}"]`);
  const slot = doc.querySelectorAll('body.mp-game-active #spread .slot')[pending.slotIndex];
  if (!handCard || !slot) return;

  handCard.classList.add('mp-local-pending-hidden');

  const clone = handCard.cloneNode(true);
  clone.classList.remove('sel', 'hand-card-dragging', 'hand-card-landing', 'mp-local-pending-hidden');
  clone.classList.add('mp-local-pending-card');
  clone.removeAttribute('style');
  clone.onclick = null;

  slot.replaceChildren(clone);
  slot.classList.remove('empty', 'target');
  slot.classList.add('filled', 'mp-local-pending-slot');
}

function wrapMatchCallbacks(target, afterRender) {
  const wrap = name => {
    const original = target[name];
    if (typeof original !== 'function') return;
    target[name] = function (...args) {
      const result = original.apply(this, args);
      afterRender(target);
      return result;
    };
  };
  wrap('tlrMpOnMatchStart');
  wrap('tlrMpOnLocalAction');
  wrap('tlrMpOnPeerAction');
}

function installMutationSync(target, doc, apply) {
  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (!MutationObserverCtor) return;
  const observer = new MutationObserverCtor(records => {
    if (!doc.body.classList.contains('mp-game-active')) return;
    if (!records.some(record => {
      const node = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
      return node?.closest?.('#hand,#spread');
    })) return;
    apply(target);
  });
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-uid'] });
}

let applyQueued = false;
function queueApply(target) {
  if (applyQueued) return;
  applyQueued = true;
  target.requestAnimationFrame?.(() => {
    applyQueued = false;
    applyPendingPlacementPreview(target);
  }) ?? applyPendingPlacementPreview(target);
}

function installStyle(doc) {
  if (doc.getElementById('mp-pending-placement-preview-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-pending-placement-preview-style';
  style.textContent = `
    body.mp-game-active #hand .card.mp-local-pending-hidden {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    body.mp-game-active #spread .slot.mp-local-pending-slot {
      opacity: .92 !important;
      box-shadow: 0 0 0 1px rgba(255, 214, 132, .32), 0 0 18px rgba(255, 214, 132, .22) !important;
    }
    body.mp-game-active #spread .slot .card.mp-local-pending-card {
      pointer-events: none !important;
    }
  `;
  doc.head.appendChild(style);
}
