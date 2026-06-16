import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { abilityHeldCards } from '../systems/abilities.mjs';

const NEXT_SET_DELAY_MS = 3350;
const DETAIL_HOLD_MS = 400;
const DETAIL_MOVE_CANCEL = 10;

export function installMpAutoAdvanceDelay(target = window) {
  if (!target || target.__tlrMpAutoAdvanceDelayInstalled) return;
  target.__tlrMpAutoAdvanceDelayInstalled = true;

  installAutoNextRoundDelay(target);
  installMpAbilityHeldChoiceUids(target);
  installMpModalHide(target, target.document);
  installMpCardDetail(target, target.document);
}

function installAutoNextRoundDelay(target) {
  const originalDispatch = target.tlrMpDispatch;
  if (typeof originalDispatch !== 'function') return;

  let timer = null;
  let queuedAction = null;

  target.tlrMpDispatch = function delayedMpDispatch(action) {
    const currentState = target.tlrMpGetState?.();

    if (action?.type === MP_ACTIONS.MP_NEW_ROUND && currentState?.phase === MP_PHASES.BETWEEN_ROUNDS) {
      queuedAction = action;
      if (!timer) {
        timer = target.setTimeout(() => {
          timer = null;
          const nextAction = queuedAction;
          queuedAction = null;
          if (nextAction && target.tlrMpGetState?.()?.phase === MP_PHASES.BETWEEN_ROUNDS) {
            originalDispatch(nextAction);
          }
        }, NEXT_SET_DELAY_MS);
      }
      return currentState;
    }

    return originalDispatch(action);
  };
}

function installMpAbilityHeldChoiceUids(target) {
  const originalDispatch = target.tlrMpDispatch;
  if (typeof originalDispatch !== 'function') return;

  target.tlrMpDispatch = function mpDispatchWithHeldChoiceUids(action) {
    return originalDispatch(enrichHeldAbilityChoice(target, action));
  };
}

function enrichHeldAbilityChoice(target, action) {
  if (action?.type !== MP_ACTIONS.MP_SUBMIT_ACTION) return action;
  const submitted = action.action;
  if (submitted?.type !== MP_ACTIONS.MP_INVOKE_ABILITY) return action;

  const choice = submitted.abilityChoice;
  if (!choice || Array.isArray(choice.heldCardUids) || !Array.isArray(choice.anchorUids)) return action;

  const state = target.tlrMpGetState?.();
  const playerIndex = Number.isInteger(action.playerIndex) ? action.playerIndex : submitted.playerIndex;
  const player = state?.players?.[playerIndex];
  if (!player) return action;

  const sourceCard = (player.hand || []).find(card => card.uid === submitted.cardUid);
  const ability = sourceCard?.ability ? getAbility(sourceCard.ability) : null;
  if (!isHeldChoiceAbility(ability)) return action;

  const inPlay = [
    ...(player.hand || []).filter(card => card.uid !== sourceCard.uid),
    ...(player.spread || []).filter(Boolean),
  ];
  const anchors = choice.anchorUids.map(uid => inPlay.find(card => card.uid === uid)).filter(Boolean);
  if (!anchors[0]) return action;
  if (ability.type === ABILITY_TYPES.BETWEEN && !anchors[1]) return action;

  let held = abilityHeldCards(player.deck || [], ability, anchors);
  if (typeof target.sortCards === 'function') held = target.sortCards(held.slice());
  else held = held.slice().sort((a, b) => String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || '')));

  const heldCardUids = held.slice(0, ability.count ?? 1).map(card => card.uid);
  if (!heldCardUids.length) return action;

  return {
    ...action,
    action: {
      ...submitted,
      abilityChoice: {
        ...choice,
        heldCardUids,
      },
    },
  };
}

function isHeldChoiceAbility(ability) {
  return !!ability && (
    ability.type === ABILITY_TYPES.NEIGHBOR
    || ability.type === ABILITY_TYPES.KIN
    || ability.type === ABILITY_TYPES.MIRROR
    || ability.type === ABILITY_TYPES.BETWEEN
  );
}

function installMpModalHide(target, doc) {
  if (!doc || target.__tlrMpModalHideFixed) return;
  target.__tlrMpModalHideFixed = true;

  const style = doc.createElement('style');
  style.id = 'mp-modal-hide-fix-style';
  style.textContent = `
    body.mp-game-active.mp-modal-forced-collapsed #modal.show {
      background: transparent !important;
      align-items: flex-start !important;
      justify-content: center !important;
      pointer-events: none !important;
    }
    body.mp-game-active.mp-modal-forced-collapsed #modal.show .box {
      pointer-events: auto !important;
      width: auto !important;
      max-width: 420px !important;
      padding: 10px 12px !important;
    }
    body.mp-game-active.mp-modal-forced-collapsed #modalPrompt,
    body.mp-game-active.mp-modal-forced-collapsed #choices {
      display: none !important;
    }
    body.mp-game-active.mp-modal-forced-collapsed #modal .box h2 {
      margin: 0 !important;
      font-size: 14px !important;
    }
    body.mp-game-active.mp-modal-forced-collapsed #modalToggle {
      font-size: 12px !important;
      padding: 4px 9px !important;
    }
  `;
  doc.head.appendChild(style);

  const modal = () => doc.getElementById('modal');
  const toggle = () => doc.getElementById('modalToggle');
  const isMpModalOpen = () => doc.body.classList.contains('mp-game-active') && modal()?.classList.contains('show');

  const syncLabel = () => {
    if (!isMpModalOpen()) doc.body.classList.remove('mp-modal-forced-collapsed');
    const btn = toggle();
    if (btn && isMpModalOpen()) {
      const label = doc.body.classList.contains('mp-modal-forced-collapsed') ? 'Show' : 'Hide';
      if (btn.textContent !== label) btn.textContent = label;
    }
  };

  doc.addEventListener('click', event => {
    const btn = event.target?.closest?.('#modalToggle');
    if (!btn || !isMpModalOpen()) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    doc.body.classList.toggle('mp-modal-forced-collapsed');
    syncLabel();
    target.requestAnimationFrame?.(syncLabel);
  }, true);

  const Observer = target.MutationObserver || globalThis.MutationObserver;
  if (Observer && doc.body) {
    const observer = new Observer(() => target.requestAnimationFrame?.(syncLabel));
    observer.observe(doc.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  }
}

function installMpCardDetail(target, doc) {
  if (!doc || target.__tlrMpCardDetailFixed) return;
  target.__tlrMpCardDetailFixed = true;

  let hold = null;

  const now = () => target.performance?.now?.() ?? Date.now();
  const clear = () => {
    if (hold?.timer) target.clearTimeout(hold.timer);
    hold = null;
  };

  const visibleMpCard = source => {
    if (!doc.body.classList.contains('mp-game-active')) return null;
    return source?.closest?.('#hand .card[data-uid], #spread .card[data-uid], #mpOppSpread .card[data-uid]') || null;
  };

  doc.addEventListener('pointerdown', event => {
    if (target.__handPinchSynthetic || target.__handPinchActive) return;
    const source = event.target instanceof Element ? event.target : null;
    const cardEl = visibleMpCard(source);
    if (!cardEl) return;

    const uid = cardEl.dataset.uid;
    clear();
    hold = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      timer: target.setTimeout(() => {
        const card = findMpCardByUid(target, uid);
        clear();
        if (!card || typeof target.expandCard !== 'function') return;
        target.__handGestureSuppressClickUntil = now() + 800;
        target.expandCard(card);
      }, DETAIL_HOLD_MS),
    };
  }, true);

  doc.addEventListener('pointermove', event => {
    if (!hold || event.pointerId !== hold.pointerId) return;
    if (Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY) > DETAIL_MOVE_CANCEL) clear();
  }, true);

  const end = event => {
    if (hold && event.pointerId === hold.pointerId) clear();
  };
  doc.addEventListener('pointerup', end, true);
  doc.addEventListener('pointercancel', end, true);

  doc.addEventListener('click', event => {
    if (now() > (target.__handGestureSuppressClickUntil || 0)) return;
    const source = event.target instanceof Element ? event.target : null;
    if (!visibleMpCard(source)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
}

function findMpCardByUid(target, uid) {
  const state = target.tlrMpGetState?.();
  const id = String(uid);
  for (const player of state?.players || []) {
    const piles = [player.hand, player.spread, player.discard];
    for (const pile of piles) {
      for (const card of pile || []) {
        if (card && String(card.uid) === id) return card;
      }
    }
  }
  return null;
}
