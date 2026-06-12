function installEndSessionFailPatch(target = window) {
  if (!target || target.__tlrEndSessionFailPatchInstalled) return;
  target.__tlrEndSessionFailPatchInstalled = true;

  const originalEndSession = target.endSession;
  if (typeof originalEndSession !== 'function') return;

  function summaryIsFailedReading() {
    const summary = target.document?.getElementById('summary');
    if (!summary || !summary.classList.contains('show')) return false;
    return !!summary.querySelector('.result-panel.fail');
  }

  function endFailedReadingWithoutSummary() {
    const total = target.persist?.totalScore || 0;
    const obals = typeof target.tlrScoreToObals === 'function'
      ? target.tlrScoreToObals(total)
      : 1;

    if (typeof target.tlrSyncRunToStore === 'function') target.tlrSyncRunToStore();
    if (target.tlrStore && target.tlrActions) {
      target.tlrStore.dispatch({
        type: target.tlrActions.END_SESSION,
        totalScore: total,
        obals,
      });
    }

    if (typeof target.clearOverlay === 'function') target.clearOverlay();
    else {
      const summary = target.document?.getElementById('summary');
      if (summary) {
        summary.className = '';
        summary.innerHTML = '';
      }
      if (typeof target.tlrArchitectureSync === 'function') target.tlrArchitectureSync();
    }

    if (typeof target.tlrDebugEnterAttic === 'function') {
      target.tlrDebugEnterAttic(obals, true);
    }
  }

  target.endSession = function patchedEndSession(...args) {
    if (summaryIsFailedReading()) {
      endFailedReadingWithoutSummary();
      return;
    }
    return originalEndSession.apply(this, args);
  };
}

installEndSessionFailPatch(window);
