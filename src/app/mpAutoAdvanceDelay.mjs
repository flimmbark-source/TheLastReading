import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_PHASES } from '../multiplayer/mpState.mjs';

const NEXT_SET_DELAY_MS = 3350;

export function installMpAutoAdvanceDelay(target = window) {
  if (!target || target.__tlrMpAutoAdvanceDelayInstalled) return;
  target.__tlrMpAutoAdvanceDelayInstalled = true;

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
