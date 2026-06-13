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
    target.requestAnimationFrame?.(syncUi);
  }, true);

  const MutationObserverCtor = target.MutationObserver || globalThis.MutationObserver;
  if (MutationObserverCtor) {
    const observer = new MutationObserverCtor(syncUi);
    observer.observe(doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  syncUi();
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
    body.mp-game-active .mp-pills-actions {
      justify-content: center !important;
    }

    body.mp-game-active .mp-pills-actions .sbtn {
      width: auto !important;
      min-width: 80px !important;
      height: auto !important;
      min-height: 0 !important;
      padding: 5px 12px !important;
      overflow: visible !important;
      border-radius: 6px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #ead9b5 !important;
      border: 1px solid #7a5a2d !important;
      box-shadow: none !important;
      color: #20130b !important;
      font: 700 12px/1 system-ui, Segoe UI, sans-serif !important;
      letter-spacing: normal !important;
      text-transform: none !important;
    }

    body.mp-game-active .mp-pills-actions .sbtn:not(:disabled),
    body.mp-game-active .mp-pills-actions .sbtn.mp-active-action {
      color: #20130b !important;
      border-color: #7a5a2d !important;
      background: #ead9b5 !important;
      cursor: pointer !important;
    }

    body.mp-game-active .mp-pills-actions .sbtn:disabled {
      opacity: .35 !important;
      cursor: not-allowed !important;
    }

    body.mp-game-active .mp-pills-actions .sbtn:hover {
      filter: brightness(1.08) !important;
    }

    #mpAbilityBtn {
      display: none !important;
    }

    #mpDiscardBtn::before { content: 'Discard' !important; }
    #mpPurgeBtn::before { content: 'Purge' !important; }

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

    body.mp-game-active .hand-swipe-hint {
      display: none !important;
    }

    @media (max-width: 640px) {
      body.mp-game-active #mpAbilityBtn.mp-visible {
        display: inline-flex !important;
      }

      body.mp-game-active .mp-pills-actions {
        width: 100% !important;
        gap: 8px !important;
      }

      body.mp-game-active .mp-pills-actions .sbtn {
        min-width: 78px !important;
        padding: 6px 9px !important;
        font-size: 12px !important;
      }

      body.mp-game-active .mp-action-panel.mp-hide-mobile-ability-panel {
        display: none !important;
      }
    }
  `;
  doc.head.appendChild(style);
}
