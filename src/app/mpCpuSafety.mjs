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

function scheduleCpuSafety(target) {
  target.clearTimeout?.(target.__tlrMpCpuSafetyTimer);
  target.__tlrMpCpuSafetyTimer = target.setTimeout?.(() => {
    if (!isCpuMatch(target)) return;
    const state = target.tlrMpGetState?.();
    const cpuIndex = cpuIndexForRole(target);
    if (!state || state.phase !== MP_PHASES.PLACEMENT) return;
    if (hasSubmittedAction(state, cpuIndex)) return;

    const action = safeCpuAction(state, cpuIndex);
    if (!action) return;
    target.tlrMpDispatch?.({ type: MP_ACTIONS.MP_SUBMIT_ACTION, playerIndex: cpuIndex, action });
  }, 1400);
}

export function installMpCpuSafety(target = window) {
  if (!target || target.__tlrMpCpuSafetyInstalled) return;
  target.__tlrMpCpuSafetyInstalled = true;

  const wrapDispatch = () => {
    const current = target.tlrMpDispatch;
    if (typeof current !== 'function' || current.__tlrCpuSafetyWrapped) return false;

    function wrapped(action) {
      const stateBefore = target.tlrMpGetState?.();
      const cpuIndex = cpuIndexForRole(target);
      const result = current.apply(this, arguments);
      if (
        isCpuMatch(target)
        && action?.type === MP_ACTIONS.MP_SUBMIT_ACTION
        && action.playerIndex !== cpuIndex
        && stateBefore?.phase === MP_PHASES.PLACEMENT
      ) {
        scheduleCpuSafety(target);
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
