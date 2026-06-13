import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';

export function installSurgeonHandSwapPatch(target = window) {
  if (!target || target.__tlrSurgeonHandSwapPatchInstalled) return;
  target.__tlrSurgeonHandSwapPatchInstalled = true;

  const doc = target.document;
  if (!doc) return;

  patchMatchmakingBack(target, doc);
  installStyle(doc);

  function playerIndexFromRole() {
    return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
  }

  function selectedSwapSlot() {
    return doc.querySelector('body.mp-game-active #spread .slot.mp-swap-a');
  }

  function selectedSwapSlotIndex() {
    const selectedSlot = selectedSwapSlot();
    if (!selectedSlot) return -1;
    const slots = Array.from(doc.querySelectorAll('body.mp-game-active #spread .slot'));
    return slots.indexOf(selectedSlot);
  }

  function canDispatchSwap(playerIndex, slotIndex, cardUid) {
    const state = target.tlrMpGetState?.();
    const player = state?.players?.[playerIndex];
    if (!state || !player) return false;
    if (state.activePlayerIndex !== playerIndex) return false;
    if (!player.swapAvailable) return false;
    if (slotIndex < 0 || !player.spread?.[slotIndex]) return false;
    return player.hand?.some(card => card.uid === cardUid);
  }

  function selectedCardCanUseAbility() {
    const state = target.tlrMpGetState?.();
    const playerIndex = playerIndexFromRole();
    const player = state?.players?.[playerIndex];
    const selectedUid = target.state?.selected ?? null;
    if (!state || !player || selectedUid === null) return false;
    if (state.activePlayerIndex !== playerIndex) return false;
    if ((player.discards ?? 0) <= 0) return false;
    return player.hand?.some(card => card.uid === selectedUid && (card.ability || card.abilityType));
  }

  function ensureAbilityButton() {
    const actions = doc.querySelector('body.mp-game-active .mp-pills-actions');
    if (!actions) return null;

    let btn = doc.getElementById('mpAbilityBtn');
    if (!btn) {
      btn = doc.createElement('button');
      btn.id = 'mpAbilityBtn';
      btn.className = 'sbtn sbtn-ability';
      btn.type = 'button';
      btn.textContent = 'Ability';
      btn.setAttribute('aria-label', 'Ability');
      btn.title = 'Ability';
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (!btn.disabled) target.tlrMpInvoke?.();
      });
    }

    if (btn.parentElement !== actions) actions.appendChild(btn);
    return btn;
  }

  function syncUi() {
    const panel = doc.getElementById('mpActionPanel');
    if (panel) {
      const swapBtn = Array.from(panel.querySelectorAll('button'))
        .find(btn => btn.textContent.trim() === 'Swap Spread');
      if (swapBtn) swapBtn.textContent = 'Swap Card';

      const hint = panel.querySelector('.mp-action-hint');
      if (hint) {
        const text = hint.textContent.trim();
        if (text === 'Tap a card to swap.') hint.textContent = 'Tap a card in your Spread.';
        else if (text === 'Tap the second card.') hint.textContent = 'Tap a card in your Hand.';
      }
    }

    const abilityBtn = ensureAbilityButton();
    const canUseAbility = selectedCardCanUseAbility();
    if (abilityBtn) {
      abilityBtn.disabled = !canUseAbility;
      abilityBtn.classList.toggle('mp-visible', canUseAbility);
      abilityBtn.setAttribute('aria-hidden', canUseAbility ? 'false' : 'true');
    }
    panel?.classList.toggle('mp-hide-mobile-ability-panel', canUseAbility);

    const hasSelectedSlot = !!selectedSwapSlot();
    doc.querySelectorAll('#hand .card[data-uid]').forEach(cardEl => {
      cardEl.classList.toggle('mp-surgeon-swap-target', hasSelectedSlot);
    });

    doc.querySelectorAll('body.mp-game-active #spread .slot.mp-swap-pick').forEach(slotEl => {
      slotEl.classList.toggle('mp-surgeon-swap-blocked', hasSelectedSlot);
    });
  }

  function scheduleSync() {
    target.requestAnimationFrame?.(syncUi) ?? syncUi();
  }

  wrapRefreshHandState(target, scheduleSync);

  doc.addEventListener('click', event => {
    const handCard = event.target.closest?.('body.mp-game-active #hand .card[data-uid]');
    if (!handCard) return;

    const slotIndex = selectedSwapSlotIndex();
    if (slotIndex < 0) return;

    const cardUid = Number(handCard.dataset.uid);
    const playerIndex = playerIndexFromRole();
    if (!Number.isFinite(cardUid) || !canDispatchSwap(playerIndex, slotIndex, cardUid)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_SWAP_SPREAD,
      playerIndex,
      slotIndex,
      cardUid,
    });

    if (target.state) target.state.selected = null;
    target.refreshHandState?.();
    scheduleSync();
  }, true);

  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (MutationObserverCtor) {
    const observer = new MutationObserverCtor(scheduleSync);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled', 'data-uid'],
    });
  }

  syncUi();
}

function wrapRefreshHandState(target, afterRefresh) {
  if (target.__tlrMpAbilityRefreshWrapped) return;
  const original = target.refreshHandState;
  if (typeof original !== 'function') return;
  target.__tlrMpAbilityRefreshWrapped = true;
  target.refreshHandState = function (...args) {
    const result = original.apply(this, args);
    afterRefresh();
    return result;
  };
}

function patchMatchmakingBack(target, doc) {
  if (target.__tlrMatchmakingBackToChoicesPatchInstalled) return;
  target.__tlrMatchmakingBackToChoicesPatchInstalled = true;

  const originalBack = target.tlrMmBack;
  target.tlrMmBack = function (...args) {
    const screen = doc.getElementById('matchmakingScreen');
    const isOnMatchmakingScreen = !!screen && !screen.classList.contains('mm-screen-hidden');
    const isPreMatchHostOrJoin = !!target.tlrMpGetRole?.() && !target.tlrMpGetState?.();

    if (isOnMatchmakingScreen && isPreMatchHostOrJoin && typeof target.tlrMmReset === 'function') {
      target.tlrMmReset();
      return;
    }

    return originalBack?.apply(this, args);
  };
}

function installStyle(doc) {
  if (doc.getElementById('tlr-surgeon-hand-swap-style')) return;

  const style = doc.createElement('style');
  style.id = 'tlr-surgeon-hand-swap-style';
  style.textContent = `
    body.mp-game-active #hand .card.mp-surgeon-swap-target {
      cursor: pointer !important;
      border-color: rgba(120,200,120,.68) !important;
      box-shadow: 0 0 14px rgba(100,180,100,.38) !important;
    }
    body.mp-game-active #spread .slot.mp-surgeon-swap-blocked {
      pointer-events: none !important;
      opacity: .72;
      cursor: default !important;
    }
  `;
  doc.head.appendChild(style);
}
