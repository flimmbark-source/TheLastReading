// Adventure Events within a set use one continuing hand and spread.
// The V3 controller currently calls the normal Score-Mode startReading()
// after changing Events. Guard those calls so a new hand is dealt only when
// Adventure starts or when the completed five-card set advances.

import { EVENTS_PER_SET } from '../systems/adventure/singleCardRun.mjs';

export function installAdventureSetHandFlow(target = window) {
  if (!target || target.__tlrAdventureSetHandFlowInstalled) return;
  target.__tlrAdventureSetHandFlowInstalled = true;

  const attach = () => {
    const original = target.startReading;
    if (typeof original !== 'function' || target.__tlrAdventureStartReadingGuarded) return false;

    target.__tlrAdventureStartReadingGuarded = true;
    target.__tlrAdventureStartReadingOriginal = original;

    target.startReading = function guardedAdventureStartReading(...args) {
      if (target.__tlrAdventureActive) {
        const state = target.tlrRuntime?.state || target.state || {};
        const handCount = Array.isArray(state.hand) ? state.hand.length : 0;
        const placedCount = Array.isArray(state.spread)
          ? state.spread.filter(Boolean).length
          : 0;

        // Empty hand + empty spread means the run has not dealt its opening
        // hand yet. A full spread means the five-Event set has finished and the
        // next set should receive a fresh hand. Everything between those states
        // must preserve the current hand and spread.
        const setInProgress = placedCount < EVENTS_PER_SET
          && (placedCount > 0 || handCount > 0);

        if (setInProgress) return false;
      }

      return original.apply(this, args);
    };

    return true;
  };

  if (!attach()) {
    const timer = target.setInterval(() => {
      if (attach()) target.clearInterval(timer);
    }, 50);
  }
}

