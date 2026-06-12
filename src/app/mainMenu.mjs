// Main menu overlay. Shown on first load and via "Return to Menu" in-game.

function hasSavedProgress(storage) {
  try {
    const raw = storage?.getItem('tlr_save');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.persist) return false;
    const p = parsed.persist;
    return (p.pool > 0) || (p.relics?.length > 0) || Object.values(p.up || {}).some(v => v > 0);
  } catch (_) {
    return false;
  }
}

export function installMainMenu(target = window) {
  if (!target || target.__tlrMainMenuInstalled) return;
  target.__tlrMainMenuInstalled = true;

  let gameStarted = false;

  function hide() {
    const el = target.document.getElementById('mainMenu');
    if (el) el.classList.add('mm-hidden');
  }

  function show() {
    const el = target.document.getElementById('mainMenu');
    if (!el) return;
    el.classList.remove('mm-hidden');
    syncContinueBtn();
  }

  function syncContinueBtn() {
    const btn = target.document.getElementById('mainMenuContinue');
    if (!btn) return;
    const available = gameStarted || hasSavedProgress(target.localStorage);
    btn.disabled = !available;
  }

  function startFresh() {
    // Reset persist and clear save
    try { target.localStorage.removeItem('tlr_save'); } catch (_) {}
    const initial = typeof target.createInitialPersist === 'function'
      ? target.createInitialPersist()
      : { pool: 0, up: {}, relics: [], relicUsed: {} };
    target.persist = initial;
    if (target.tlrStore) {
      target.tlrStore.dispatch({
        type: target.tlrActions.SYNC_LEGACY_PERSIST,
        persist: { reserve: 0, totalScore: 0, upgrades: initial.up, relics: [], relicUsed: {} },
      });
      target.tlrStore.dispatch({ type: target.tlrActions.RESET_SESSION });
      const _p = target.tlrStore.getState().persist;
      target.persist.relics = _p.relics.slice();
      target.persist.relicUsed = Object.assign({}, _p.relicUsed);
      target.persist.up = Object.assign({}, _p.upgrades);
      target.persist.pool = _p.reserve;
    }
    gameStarted = false;
  }

  target.tlrShowMainMenu = show;

  target.tlrMainMenuNewGame = function () {
    hide();
    startFresh();
    if (typeof target.startReading === 'function') {
      target.startReading();
      if (!target.localStorage.getItem('tlr_tut_done') && typeof target.tutShow === 'function') {
        target.setTimeout(() => target.tutShow(0), 400);
      }
    }
    gameStarted = true;
  };

  target.tlrMainMenuContinue = function () {
    hide();
    if (!gameStarted) {
      if (typeof target.startReading === 'function') {
        target.startReading();
        if (!target.localStorage.getItem('tlr_tut_done') && typeof target.tutShow === 'function') {
          target.setTimeout(() => target.tutShow(0), 400);
        }
        gameStarted = true;
      }
    }
    // If gameStarted, we're just returning to the game already in progress — no action needed.
  };

  target.tlrMainMenuMultiplayer = function () {
    const note = target.document.getElementById('mainMenuMpNote');
    if (note) {
      note.style.opacity = '1';
      target.clearTimeout(note._fadeTimer);
      note._fadeTimer = target.setTimeout(() => { note.style.opacity = ''; }, 2400);
    }
  };

  target.tlrReturnToMenu = function () {
    // Close any open sub-panels before showing the menu
    const panel = target.document.getElementById('settingsPanel');
    if (panel) panel.classList.add('hidden');
    const mw = target.document.getElementById('menuPullWrap');
    if (mw && mw.classList.contains('open')) {
      mw.classList.remove('open');
      const mt = target.document.getElementById('menuPullTab');
      if (mt) mt.innerHTML = '&#9660; Menu';
    }
    syncContinueBtn();
    show();
  };
}
