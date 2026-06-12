function removeBlockingMarketOverlay() {
  document.querySelectorAll('.relic-callout,.store-relic-callout,.store-pack-callout').forEach(el => el.remove());
  const summary = document.getElementById('summary');
  if (summary) {
    summary.className = '';
    summary.innerHTML = '';
    summary.style.pointerEvents = '';
    summary.style.display = '';
  }
  document.body.classList.remove('tlr-loading');
}

function resetMarketState() {
  window._packBuys = {};
  window._shopPacks = null;
  window._shopRefreshCount = 0;
  window._storeFrontOffers = null;
  window._pendingRelicTut = false;
}

function leaveMarketStoreSafely() {
  if (typeof window.tlrSyncRunToStore === 'function') window.tlrSyncRunToStore();
  if (!(window.tlrStore && window.tlrActions && window.tlrActions.LEAVE_MARKET)) return;
  window.tlrStore.dispatch({ type: window.tlrActions.LEAVE_MARKET });
  const run = window.tlrStore.getState().run;
  if (!window.state || !run) return;
  window.state.reading = run.reading;
  window.state.pendingPool = run.pendingReserve || 0;
  window.state.worldCarry = run.worldCarry || 0;
  window.state.relicEarned = false;
}

function beginNextReading() {
  resetMarketState();
  removeBlockingMarketOverlay();
  leaveMarketStoreSafely();
  removeBlockingMarketOverlay();
  if (typeof window.startReading !== 'function') throw new Error('startReading is not available');
  window.startReading();
  removeBlockingMarketOverlay();
}

window.storeExitToNextReading = function storeExitToNextReadingPatched() {
  if (window.__tlrLeavingMarket) return true;
  window.__tlrLeavingMarket = true;

  const shell = document.querySelector('.store-front-shell');
  if (shell) {
    shell.classList.add('store-exiting');
    shell.style.pointerEvents = 'none';
  }

  setTimeout(() => {
    try {
      beginNextReading();
    } catch (err) {
      console.error('Market exit failed to start the next reading', err);
      removeBlockingMarketOverlay();
    } finally {
      window.__tlrLeavingMarket = false;
    }
  }, 0);

  return true;
};
