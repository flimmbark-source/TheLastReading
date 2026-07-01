// Main menu overlay. Shown on first load and via "Return to Menu" in-game.
import { createInitialPersist, createInitialState } from './runtimeState.mjs';

function hasSavedProgress(storage) {
  try {
    const raw = storage?.getItem('tlr_save');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.persist) return false;
    const p = parsed.persist;
    const reserve = Number(p.reserve ?? p.pool ?? 0);
    const upgrades = p.upgrades || p.up || {};
    return (reserve > 0) || (p.relics?.length > 0) || Object.values(upgrades).some(v => v > 0);
  } catch (_) {
    return false;
  }
}

function syncInitialRunToStore(target, initialState) {
  if (!target.tlrStore || !target.tlrActions) return;
  target.tlrStore.dispatch({
    type: target.tlrActions.SYNC_LEGACY_RUN,
    run: {
      deck: initialState.deck,
      hand: initialState.hand,
      discard: initialState.discard,
      spread: initialState.spread,
      selectedCardId: initialState.selected,
      discards: initialState.discards,
      discardedCards: initialState.discardedCards,
      freeDiscardUsed: initialState.freeDiscardUsed,
      sightChargesUsed: 0,
      thresholdIndex: initialState.th,
      thresholdBonus: initialState.thBonus,
      thresholdBonusPending: initialState.thBonusPending,
      reading: initialState.reading,
      pendingReserve: initialState.pendingPool,
      worldCarry: initialState.worldCarry,
      abilityTakenCardIds: [],
      resonationBonus: null,
      setIndex: initialState.setIndex,
      setsPerRound: initialState.setsPerRound,
      roundScore: initialState.roundScore,
      setScores: initialState.setScores,
      roundDiscardCount: initialState.roundDiscardCount,
      roundPatternCount: initialState.roundPatternCount,
      constellationId: null,
      untargetableCardIds: [],
      awaitingNextSet: false,
      lastOutcome: null,
    },
  });
}

function syncInitialPersistToStore(target, initialPersist) {
  if (!target.tlrStore || !target.tlrActions) return;
  target.tlrStore.dispatch({
    type: target.tlrActions.SYNC_LEGACY_PERSIST,
    persist: {
      reserve: initialPersist.pool,
      totalScore: 0,
      upgrades: initialPersist.up,
      relics: initialPersist.relics,
      relicUsed: initialPersist.relicUsed,
      obals: 0,
      unlockedFragments: [],
      discoveredArchiveItems: [],
      seenTutorials: {},
    },
  });
}

function clearRuntimeCaches(target) {
  target._cachedPlacedScore = null;
  target._hintsCacheKey = null;
  target._spreadScoreForHints = null;
  target._unlockedFragmentsCache = null;
  target._resStateKey = null;
  target._shopPacks = null;
  target._shopRefreshCount = 0;
  target._packBuys = {};
  target._openRelicKey = null;
  target._replaceSelectedKey = null;
  if (target._hintsCache && typeof target._hintsCache.clear === 'function') target._hintsCache.clear();
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
    // Delay display:none until after the 0.35s opacity fade-out finishes,
    // so the game never shows through while the overlay is still fading.
    setTimeout(() => { if (el.classList.contains('mm-hidden')) el.hidden = true; }, 400);
  }

  function show() {
    const el = menuEl();
    if (!el) return;
    el.hidden = false;
    if ('inert' in el) el.inert = false;
    el.setAttribute('aria-hidden', 'false');
    el.classList.remove('mm-hidden', 'main-menu-busy');
    // The lightweight boot loader disables every menu button while it loads the
    // game module and only restores them on failure, so a button left disabled
    // there would make this menu dead when we return to it. Once the game is
    // running we own the menu: re-enable the buttons (and restore any "Loading…"
    // label) on every show, then let syncContinueBtn re-disable Continue if there
    // is no saved progress.
    el.querySelectorAll('.main-menu-btn').forEach(btn => {
      btn.disabled = false;
      if (btn.dataset.bootLabel) { btn.textContent = btn.dataset.bootLabel; delete btn.dataset.bootLabel; }
    });
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
    btn.disabled = false;
  }


  function waitForSinglePlayerSkin() {
    const ready = target.__tlrSinglePlayerV2Ready;
    if (!ready || typeof ready.then !== 'function') return Promise.resolve();
    return Promise.race([
      ready.catch(() => false),
      new Promise(resolve => target.setTimeout(resolve, 2500)),
    ]);
  }

  function clearSingleplayerBootVeil() {
    target.requestAnimationFrame(() => {
      target.requestAnimationFrame(() => {
        target.document.body.classList.remove('main-menu-mode-booting');
      });
    });
  }

  function startFresh() {
    try { target.localStorage.removeItem('tlr_save'); } catch (_) {}

    const initialPersist = createInitialPersist();
    const initialState = createInitialState();

    target.persist = initialPersist;
    target.state = initialState;
    if (target.tlrRuntime) {
      target.tlrRuntime.persist = initialPersist;
      target.tlrRuntime.state = initialState;
    }

    clearRuntimeCaches(target);

    if (target.tlrStore && target.tlrActions) {
      target.tlrStore.dispatch({ type: target.tlrActions.RESET_SESSION, fresh: true });
      syncInitialPersistToStore(target, initialPersist);
      syncInitialRunToStore(target, initialState);
    }

    gameStarted = false;
  }

  async function startSingleplayer({ fresh = false } = {}) {
    target.document.body.classList.add('main-menu-mode-booting');
    try {
      if (fresh) startFresh();
      forceSingleplayerTable();
      if (typeof target.startReading === 'function') {
        if (!gameStarted || fresh) target.startReading();
        gameStarted = true;
        forceSingleplayerTable();
        hide();
        await waitForSinglePlayerSkin();
        clearSingleplayerBootVeil();
        if (!target.localStorage.getItem('tlr_tut_done') && typeof target.tutShow === 'function') {
          target.setTimeout(() => target.tutShow(0), 400);
        }
      } else {
        console.error('The Last Reading: startReading is not available from the main menu.');
        target.document.body.classList.remove('main-menu-mode-booting');
        show();
      }
    } catch (err) {
      console.error('The Last Reading: failed to start singleplayer from the main menu.', err);
      target.document.body.classList.remove('main-menu-mode-booting');
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

  target.tlrMainMenuAdventure = async function () {
    // Hand off to the self-contained Adventure Mode overlay. It restores the
    // main menu itself (via tlrReturnToMenu) when the player leaves.
    hide();
    // menuBoot.mjs's boot-time stub awaits __tlrInstallAdventureModules()
    // before ever calling this function, but that stub only wraps the very
    // first click through the cold-boot path — main.mjs's bulk install
    // overwrites window.tlrMainMenuAdventure with this function directly, so
    // any later click (e.g. after tlrReturnToMenu()) reaches here without
    // that await ever having happened. Load the adventure modules here too
    // so this function is self-sufficient regardless of how it was reached.
    if (typeof target.tlrStartAdventure !== 'function' && typeof target.__tlrInstallAdventureModules === 'function') {
      try {
        await target.__tlrInstallAdventureModules();
      } catch (err) {
        console.error('The Last Reading: Adventure Mode failed to load.', err);
      }
    }
    if (typeof target.tlrStartAdventure === 'function') {
      target.tlrStartAdventure();
      target.setTimeout(() => {
        if (target.__tlrAdventureActive && typeof target.maybeShowAdventureTutorial === 'function') {
          target.maybeShowAdventureTutorial();
        }
      }, 500);
    } else {
      console.error('The Last Reading: Adventure Mode is not available.');
      show();
    }
  };

  target.tlrMainMenuMultiplayer = async function () {
    // Hide main menu, show loadout screen. Same self-sufficiency concern as
    // tlrMainMenuAdventure above: main.mjs's bulk install overwrites this
    // function directly after the first game load via any path, so this
    // can't rely on menuBoot.mjs's boot-time await ever having run.
    hide();
    if (typeof target.tlrShowLoadout !== 'function' && typeof target.__tlrInstallMultiplayerModules === 'function') {
      try {
        await target.__tlrInstallMultiplayerModules();
      } catch (err) {
        console.error('The Last Reading: Duel mode failed to load.', err);
      }
    }
    if (typeof target.tlrShowLoadout === 'function') {
      target.tlrShowLoadout();
    } else {
      console.error('The Last Reading: Duel mode is not available.');
      show();
    }
  };

  function closeAllOverlays() {
    const doc = target.document;
    if (!doc) return;

    // Ability targeting: a hard abandon, not Cancel — it must not resolve the
    // pending callback (that would re-trigger resolveAbility's retry loop and
    // re-prompt targeting underneath the menu) and must clear run.ability
    // itself so a resumed session ("Continue") never finds a stale half-active
    // ability still sitting in the store.
    if (typeof target.tlrForceCloseAbilityTargeting === 'function') target.tlrForceCloseAbilityTargeting();
    doc.getElementById('abilityPrompt')?.classList.remove('show');

    // The reveal/take modal — shared by Search/Peek/Neighbor/Kin/Mirror/Between,
    // the Watcher relic, and the shop's relic-vision reveal.
    doc.getElementById('modal')?.classList.remove('show', 'collapsed', 'ability-reveal');

    if (typeof target.cancelPurge === 'function') target.cancelPurge();
    doc.getElementById('purgePrompt')?.classList.remove('show');

    // Reading results / shop / session-end overlay.
    if (typeof target.clearOverlay === 'function') target.clearOverlay();

    if (typeof target.closeCardDetail === 'function') target.closeCardDetail();
    if (typeof target.tlrCloseArchives === 'function') target.tlrCloseArchives();

    const packAnim = doc.getElementById('packAnim');
    if (packAnim) packAnim.setAttribute('aria-hidden', 'true');
  }

  target.tlrReturnToMenu = function () {
    if (typeof target.tutHide === 'function') target.tutHide();
    // Close any open sub-panels before showing the menu
    const panel = target.document.getElementById('settingsPanel');
    if (panel) panel.classList.add('hidden');
    const mw = target.document.getElementById('menuPullWrap');
    if (mw && mw.classList.contains('open')) {
      mw.classList.remove('open');
      const mt = target.document.getElementById('menuPullTab');
      if (mt) mt.innerHTML = '&#9660; Menu';
    }
    closeAllOverlays();
    syncContinueBtn();
    show();
  };
}
