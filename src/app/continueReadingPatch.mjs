function resetMarketRuntime() {
  window._packBuys = {};
  window._shopPacks = null;
  window._shopRefreshCount = 0;
  window._storeFrontOffers = null;
}

function markTutorialProgress(firstShop) {
  try {
    if (firstShop) localStorage.setItem('tlr_tut_shop', '1');
  } catch (err) {}
}

function leaveMarketInStore() {
  if (typeof window.tlrSyncRunToStore === 'function') window.tlrSyncRunToStore();

  if (window.tlrStore && window.tlrActions && window.tlrActions.LEAVE_MARKET) {
    window.tlrStore.dispatch({ type: window.tlrActions.LEAVE_MARKET });
    const run = window.tlrStore.getState().run;
    if (window.state && run) {
      window.state.reading = run.reading;
      window.state.pendingPool = run.pendingReserve || 0;
      window.state.worldCarry = run.worldCarry || 0;
      window.state.relicEarned = false;
    }
    return true;
  }

  if (window.state) {
    window.state.reading = (window.state.reading || 1) + 1;
    window.state.pendingPool = 0;
    window.state.worldCarry = window.state.worldCarry || 0;
    window.state.relicEarned = false;
  }
  return false;
}

function forceStartNextReading() {
  if (typeof window.clearOverlay === 'function') window.clearOverlay();
  if (typeof window.startReading !== 'function') throw new Error('startReading is not available');
  window.startReading();
}

export function continueReading() {
  const firstShop = !localStorage.getItem('tlr_tut_shop');
  window._pendingRelicTut = false;
  resetMarketRuntime();
  try {
    leaveMarketInStore();
    forceStartNextReading();
    markTutorialProgress(firstShop);
    return true;
  } catch (err) {
    console.error('Next Reading failed during market handoff', err);
    try {
      forceStartNextReading();
      markTutorialProgress(firstShop);
      return true;
    } catch (fallbackErr) {
      console.error('Next Reading fallback failed', fallbackErr);
      return false;
    }
  }
}

window.continueReading = continueReading;
