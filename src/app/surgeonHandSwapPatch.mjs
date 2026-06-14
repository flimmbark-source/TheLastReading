import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { getPersona } from '../multiplayer/personas.mjs';

export function installSurgeonHandSwapPatch(target = window) {
  if (!target || target.__tlrSurgeonHandSwapPatchInstalled) return;
  target.__tlrSurgeonHandSwapPatchInstalled = true;

  const doc = target.document;
  if (!doc) return;

  patchMatchmakingBack(target, doc);
  installStyle(doc);
  installOpponentPopTuning(target, doc);

  const copiedButtonArt = new Set();
  let syncQueued = false;

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

  function playerCanAct(state, playerIndex) {
    return state?.phase === MP_PHASES.PLACEMENT && !state.pendingActions?.[playerIndex];
  }

  function canDispatchSwap(playerIndex, slotIndex, cardUid) {
    const state = target.tlrMpGetState?.();
    const player = state?.players?.[playerIndex];
    if (!state || !player) return false;
    if (!playerCanAct(state, playerIndex)) return false;
    if (!player.swapAvailable) return false;
    if (slotIndex < 0 || !player.spread?.[slotIndex]) return false;
    return player.hand?.some(card => card.uid === cardUid);
  }

  function currentPersonaAbilityAction() {
    const state = target.tlrMpGetState?.();
    const playerIndex = playerIndexFromRole();
    const player = state?.players?.[playerIndex];
    if (!state || !player) return null;
    if (!playerCanAct(state, playerIndex)) return null;

    const persona = getPersona(player.persona);
    if (player.swapAvailable && persona?.passives?.freeSpreadSwap) {
      return {
        type: 'persona-swap',
        label: 'Ability',
        title: `${persona.ability?.name || 'Persona Ability'}: ${stripMarkup(persona.ability?.rules || 'Swap a card in your Spread with a card in your Hand.')}`,
      };
    }

    return null;
  }

  function ensureAbilityButton() {
    const actions = doc.querySelector('body.mp-game-active .mp-pills-actions');
    if (!actions) return null;

    let btn = doc.getElementById('mpAbilityBtn');
    if (!btn) {
      btn = doc.createElement('button');
      btn.id = 'mpAbilityBtn';
      btn.className = 'sbtn sbtn-ability mp-action-copy';
      btn.type = 'button';
      btn.textContent = 'Ability';
      btn.setAttribute('aria-label', 'Ability');
      btn.title = 'Ability';
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (btn.disabled) return;
        if (btn.dataset.mpAbilityAction === 'persona-swap') target.tlrMpStartSwap?.();
      });
    }

    if (btn.parentElement !== actions) actions.appendChild(btn);
    return btn;
  }

  function copySingleplayerButtonArt() {
    copyButtonArt('discardBtn', 'mpDiscardBtn', 'sbtn sbtn-discard mp-action-copy');
    copyButtonArt('purgeBtn', 'mpPurgeBtn', 'sbtn sbtn-purge mp-action-copy');
    styleAbilityButton(doc.getElementById('mpAbilityBtn'));
  }

  function copyButtonArt(sourceId, targetId, className) {
    const source = doc.getElementById(sourceId);
    const button = doc.getElementById(targetId);
    const computed = source && target.getComputedStyle?.(source);
    if (!source || !button || !computed) return;

    // Mirror the singleplayer visual treatment without stealing the wrong label identity.
    button.className = className;
    if (copiedButtonArt.has(targetId)) return;

    const props = [
      'width', 'height', 'minWidth', 'minHeight', 'padding',
      'border', 'borderRadius', 'boxShadow',
      'background', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
      'color', 'font', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform',
    ];

    props.forEach(prop => {
      const value = computed[prop];
      if (value) button.style.setProperty(cssName(prop), value, 'important');
    });
    copiedButtonArt.add(targetId);
  }

  function styleAbilityButton(button) {
    if (!button) return;
    button.className = 'sbtn sbtn-ability mp-action-copy';
    button.textContent = 'Ability';
    button.style.setProperty('background', 'linear-gradient(#ead9b5, #b98948)', 'important');
    button.style.setProperty('background-image', 'linear-gradient(#ead9b5, #b98948)', 'important');
    button.style.setProperty('background-color', '#d2ae73', 'important');
    button.style.setProperty('background-size', 'auto', 'important');
    button.style.setProperty('background-position', 'center', 'important');
    button.style.setProperty('background-repeat', 'repeat', 'important');
    button.style.setProperty('border', '1px solid #7a5a2d', 'important');
    button.style.setProperty('border-radius', '6px', 'important');
    button.style.setProperty('box-shadow', '0 2px 0 rgba(53, 31, 13, .75), inset 0 1px rgba(255,255,255,.22)', 'important');
    button.style.setProperty('color', '#20130b', 'important');
    button.style.setProperty('font', '700 12px/1 system-ui, Segoe UI, sans-serif', 'important');
    button.style.setProperty('letter-spacing', 'normal', 'important');
    button.style.setProperty('text-transform', 'none', 'important');
  }

  function moveMultPillsOutside() {
    if (!doc.body.classList.contains('mp-game-active')) return;
    doc.querySelectorAll('.mp-pill-score').forEach(pill => {
      const parent = pill.parentElement;
      if (!parent) return;
      const embedded = pill.querySelector(':scope > .mp-mult-inline');
      const previous = pill.previousElementSibling?.classList?.contains('mp-mult-inline')
        ? pill.previousElementSibling
        : null;
      let mult = previous || embedded;
      if (!mult) return;
      if (embedded && embedded !== mult) embedded.remove();
      if (mult.parentElement !== parent || mult.nextElementSibling !== pill) parent.insertBefore(mult, pill);
      mult.classList.add('mp-mult-left');
      const cleanText = mult.textContent.replace(/[()]/g, '').trim();
      if (mult.textContent !== cleanText) mult.textContent = cleanText;
      parent.classList.add('mp-has-left-mult');
      pill.style.setProperty('width', '118px', 'important');
      pill.style.setProperty('gap', '5px', 'important');
    });
  }

  function suppressTransientScoringOverlay() {
    if (!doc.body.classList.contains('mp-game-active')) return;
    const overlay = doc.getElementById('mpOverlay');
    const box = doc.getElementById('mpOvBox');
    if (!overlay || !box || overlay.classList.contains('mp-ov-hidden')) return;

    const title = box.querySelector('.mp-ov-title')?.textContent?.trim() || '';
    const state = target.tlrMpGetState?.();
    const isTransientSetScore = title.startsWith('Round ') && state && state.phase !== MP_PHASES.COMPLETE;
    if (!isTransientSetScore) return;

    overlay.classList.add('mp-ov-hidden');
    box.innerHTML = '';
  }

  function hideSwipeTutorialInMultiplayer() {
    if (!doc.body.classList.contains('mp-game-active')) return;
    doc.querySelectorAll('.hand-swipe-hint').forEach(el => {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('opacity', '0', 'important');
    });
  }

  function syncUi() {
    syncQueued = false;
    hideSwipeTutorialInMultiplayer();
    suppressTransientScoringOverlay();

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
    copySingleplayerButtonArt();
    moveMultPillsOutside();

    const personaAction = currentPersonaAbilityAction();
    if (abilityBtn) {
      const isVisible = !!personaAction;
      abilityBtn.disabled = !isVisible;
      abilityBtn.textContent = 'Ability';
      abilityBtn.title = personaAction?.title || 'Ability unavailable';
      abilityBtn.setAttribute('aria-label', personaAction?.title || 'Ability unavailable');
      abilityBtn.dataset.mpAbilityAction = personaAction?.type || '';
      abilityBtn.classList.toggle('mp-visible', isVisible);
      abilityBtn.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    }
    panel?.classList.toggle('mp-hide-mobile-ability-panel', !!personaAction);

    const hasSelectedSlot = !!selectedSwapSlot();
    doc.querySelectorAll('#hand .card[data-uid]').forEach(cardEl => {
      cardEl.classList.toggle('mp-surgeon-swap-target', hasSelectedSlot);
    });

    doc.querySelectorAll('body.mp-game-active #spread .slot.mp-swap-pick').forEach(slotEl => {
      slotEl.classList.toggle('mp-surgeon-swap-blocked', hasSelectedSlot);
    });
  }

  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
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
      type: MP_ACTIONS.MP_SUBMIT_ACTION,
      playerIndex,
      action: {
        type: MP_ACTIONS.MP_SWAP_SPREAD,
        playerIndex,
        slotIndex,
        cardUid,
      },
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
      attributeFilter: ['class', 'disabled', 'data-uid', 'hidden'],
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

function installOpponentPopTuning(target, doc) {
  if (target.__tlrMpOpponentPopTuned) return;
  const proto = target.Element?.prototype;
  if (!proto || typeof proto.animate !== 'function') return;
  target.__tlrMpOpponentPopTuned = true;
  const original = proto.animate;
  proto.animate = function (keyframes, options) {
    const isOpponentCard = doc.body.classList.contains('mp-game-active')
      && this?.classList?.contains('card')
      && this.closest?.('#mpOppSpread');
    const firstTransform = Array.isArray(keyframes) ? String(keyframes[0]?.transform || '') : '';
    if (isOpponentCard && firstTransform.includes('scale(.78)')) {
      return original.call(this, [
        { transform: 'translateY(-18px) scale(.28)', opacity: 0, filter: 'brightness(1.6)' },
        { transform: 'translateY(3px) scale(1.12)', opacity: 1, filter: 'brightness(1.22)' },
        { transform: 'translateY(0) scale(1)', opacity: 1, filter: 'brightness(1)' },
      ], { ...(options || {}), duration: 380, easing: 'cubic-bezier(.16,.9,.22,1)' });
    }
    return original.call(this, keyframes, options);
  };
}

function cssName(prop) {
  return prop.replace(/[A-Z]/g, ch => '-' + ch.toLowerCase());
}

function stripMarkup(value) {
  return String(value ?? '').replace(/\*\*/g, '');
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
    body.mp-game-active #mpAbilityBtn::before,
    body.mp-game-active #mpAbilityBtn::after {
      content: none !important;
      display: none !important;
    }
    body.mp-game-active .mp-pills-opp.mp-has-left-mult,
    body.mp-game-active .mp-pills-self.mp-has-left-mult {
      transform: translateX(-14px) !important;
    }
    body.mp-game-active .mp-mult-inline.mp-mult-left {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: flex-end !important;
      min-width: 0 !important;
      margin-left: 0 !important;
      margin-right: 2px !important;
      flex: 0 0 auto !important;
      color: #ff5a4f !important;
    }
  `;
  doc.head.appendChild(style);
}
