import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';
import { emptySlots, hasSubmittedAction } from '../multiplayer/mpSelectors.mjs';

function cpuIndexForRole(target) {
  return target.tlrMpGetRole?.() === 'host' ? 1 : 0;
}

function isCpuMatch(target) {
  return target.document?.body?.classList?.contains('mp-game-active')
    && target.tlrMpGetPeer?.() == null
    && (target.tlrMpGetRole?.() === 'host' || target.tlrMpGetRole?.() === 'guest');
}

function safeCpuAction(state, cpuIndex) {
  const player = state?.players?.[cpuIndex];
  if (!player) return null;

  const slots = emptySlots(state, cpuIndex);
  const placeable = (player.hand || [])
    .filter(card => card && card.type !== 'interaction')
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  if (slots.length && placeable.length) {
    return { type: MP_ACTIONS.MP_PLACE_CARD, cardUid: placeable[0].uid, slotIndex: slots[0] };
  }

  if ((player.discards || 0) > 0 && (player.hand || []).length) {
    const lowest = [...player.hand].sort((a, b) => (a.points || 0) - (b.points || 0))[0];
    return { type: MP_ACTIONS.MP_DISCARD_CARD, cardUid: lowest.uid };
  }

  if ((player.hand || []).length >= 3) {
    const cards = [...player.hand].sort((a, b) => (a.points || 0) - (b.points || 0)).slice(0, 3);
    return { type: MP_ACTIONS.MP_PURGE_CARDS, cardUids: cards.map(card => card.uid) };
  }

  return null;
}

function actionStillPossible(state, cpuIndex, action) {
  const player = state?.players?.[cpuIndex];
  if (!player || !action) return false;

  if (action.type === MP_ACTIONS.MP_PLACE_CARD) {
    return Number.isInteger(action.slotIndex)
      && action.slotIndex >= 0
      && action.slotIndex < player.spread.length
      && !player.spread[action.slotIndex]
      && player.hand.some(card => card.uid === action.cardUid);
  }

  if (action.type === MP_ACTIONS.MP_DISCARD_CARD || action.type === MP_ACTIONS.MP_INVOKE_ABILITY) {
    return (player.discards || 0) > 0 && player.hand.some(card => card.uid === action.cardUid);
  }

  if (action.type === MP_ACTIONS.MP_PURGE_CARDS) {
    const ids = Array.isArray(action.cardUids) ? action.cardUids : [];
    return ids.length === 3 && ids.every(uid => player.hand.some(card => card.uid === uid));
  }

  return false;
}

function queueCpuSafety(target, sourceState) {
  if (!isCpuMatch(target)) return;
  const cpuIndex = cpuIndexForRole(target);
  const state = sourceState || target.tlrMpGetState?.();
  if (!state || state.phase !== MP_PHASES.PLACEMENT) return;
  if (hasSubmittedAction(state, cpuIndex)) return;

  // Do not erase an already-planned CPU response. The player can click quickly,
  // but the CPU's pending response should still resolve instead of being canceled.
  if (!target.__tlrMpCpuQueuedAction) {
    target.__tlrMpCpuQueuedAction = safeCpuAction(state, cpuIndex);
  }

  if (target.__tlrMpCpuSafetyTimer) return;
  target.__tlrMpCpuSafetyTimer = target.setTimeout?.(() => {
    target.__tlrMpCpuSafetyTimer = null;
    if (!isCpuMatch(target)) {
      target.__tlrMpCpuQueuedAction = null;
      return;
    }

    const current = target.tlrMpGetState?.();
    const currentCpuIndex = cpuIndexForRole(target);
    if (!current || current.phase !== MP_PHASES.PLACEMENT || hasSubmittedAction(current, currentCpuIndex)) {
      target.__tlrMpCpuQueuedAction = null;
      return;
    }

    let action = target.__tlrMpCpuQueuedAction;
    if (!actionStillPossible(current, currentCpuIndex, action)) action = safeCpuAction(current, currentCpuIndex);
    target.__tlrMpCpuQueuedAction = null;
    if (!action) return;

    target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SUBMIT_ACTION, playerIndex: currentCpuIndex, action });
  }, 700);
}

export function installMpCpuSafety(target = window) {
  if (!target || target.__tlrMpCpuSafetyInstalled) return;
  target.__tlrMpCpuSafetyInstalled = true;

  const wrapDispatch = () => {
    const current = target.tlrMpDispatch;
    if (typeof current !== 'function' || current.__tlrCpuSafetyWrapped) return false;

    function wrapped(action) {
      const cpuIndex = cpuIndexForRole(target);
      const result = current.apply(this, arguments);
      const stateAfter = target.tlrMpGetState?.();
      if (
        isCpuMatch(target)
        && action?.type === MP_ACTIONS.MP_SUBMIT_ACTION
        && action.playerIndex !== cpuIndex
        && stateAfter?.phase === MP_PHASES.PLACEMENT
      ) {
        queueCpuSafety(target, stateAfter);
      }
      return result;
    }
    wrapped.__tlrCpuSafetyWrapped = true;
    target.tlrMpDispatch = wrapped;
    return true;
  };

  if (!wrapDispatch()) {
    target.setTimeout?.(wrapDispatch, 0);
    target.setTimeout?.(wrapDispatch, 500);
  }
}
