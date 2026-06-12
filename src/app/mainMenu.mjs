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

  function menuEl() {
    return target.document.getElementById('mainMenu');
  }

  function hide() {
    const el = menuEl();
    if (!el) return;
    el.classList.add('mm-hidden');
    el.setAttribute('aria-hidden', 'true');
    if ('inert' in el) el.inert = true;
    el.hidden = true;
  }

  function show() {
    const el = menuEl();
    if (!el) return;
    el.hidden = false;
    if ('inert' in el) el.inert = false;
    el.setAttribute('aria-hidden', 'false');
    el.classList.remove('mm-hidden');
    syncContinueBtn();
  }

  function forceSingleplayerTable() {
    const doc = target.document;
    if (!doc) return;

    doc.body.classList.remove(
      'mp-game-active',
      'mode-attic',
      'mode-to-attic',
      'mode-to-table',
      'mode-table-return',
      'mode-return-hard-hide'
    );
    doc.body.classList.add('mode-reading');

    const mp = doc.getElementById('mpGame');
    if (mp) mp.classList.add('mp-hidden');

    const loadout = doc.getElementById('loadoutScreen');
    if (loadout) loadout.classList.add('loadout-hidden');

    const matchmaking = doc.getElementById('matchmakingScreen');
    if (matchmaking) matchmaking.classList.add('mm-screen-hidden');

    const attic = doc.getElementById('atticScene');
    if (attic) attic.setAttribute('aria-hidden', 'true');
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

  function startSingleplayer({ fresh = false } = {}) {
    try {
      if (fresh) startFresh();
      forceSingleplayerTable();
      if (typeof target.startReading === 'function') {
        if (!gameStarted || fresh) target.startReading();
        gameStarted = true;
        forceSingleplayerTable();
        hide();
        if (!target.localStorage.getItem('tlr_tut_done') && typeof target.tutShow === 'function') {
          target.setTimeout(() => target.tutShow(0), 400);
        }
      } else {
        console.error('The Last Reading: startReading is not available from the main menu.');
        show();
      }
    } catch (err) {
      console.error('The Last Reading: failed to start singleplayer from the main menu.', err);
      show();
    }
  }

  target.tlrShowMainMenu = show;

  target.tlrMainMenuNewGame = function () {
    startSingleplayer({ fresh: true });
  };

  target.tlrMainMenuContinue = function () {
    startSingleplayer({ fresh: false });
  };

  target.tlrMainMenuMultiplayer = function () {
    // Hide main menu, show loadout screen
    hide();
    if (typeof target.tlrShowLoadout === 'function') {
      target.tlrShowLoadout();
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