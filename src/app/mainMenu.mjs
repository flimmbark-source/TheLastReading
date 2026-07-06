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
    target.document.body.classList.remove('main-menu-active');
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
    target.document.body.classList.add('main-menu-active');
    target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
    hideCurtain();
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

  // Same saved-progress criteria as menuBoot.mjs's hasSavedProgress — keep
  // the two in sync or the button will flicker between boot and game-module
  // ownership of the menu.
  function hasSavedProgress() {
    try {
      const raw = target.localStorage.getItem('tlr_save');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed?.persist) return false;
      const p = parsed.persist;
      const reserve = Number(p.reserve ?? p.pool ?? 0);
      const upgrades = p.upgrades || p.up || {};
      return (reserve > 0) || (p.relics?.length > 0) || Object.values(upgrades).some(v => v > 0);
    } catch {
      return false;
    }
  }

  function syncContinueBtn() {
    const btn = target.document.getElementById('mainMenuContinue');
    if (!btn) return;
    // A run started this session is always resumable, even before it has
    // earned anything save-worthy. Otherwise fall back to the saved-progress
    // check — and clear the unavailable class menuBoot may have set at cold
    // boot (it is display:none via mainMenu.css, so leaving it latched hides
    // Continue forever even once progress exists).
    const available = gameStarted || hasSavedProgress();
    btn.disabled = !available;
    btn.classList.toggle('main-menu-continue-unavailable', !available);
  }


  // Full-screen black curtain for the New Game/Continue transition. The
  // per-element opacity veil (see mainMenu.css) only fades individual table
  // elements in over whatever's already visible behind them (the body's
  // background art, not black) — it doesn't give the "fade to black, then
  // fade in" cinematic cut the player actually asked for. This does: cover
  // the screen in solid black first, do all the state/DOM setup safely
  // hidden behind it, then lift it once the table is fully ready.
  const CURTAIN_FADE_MS = 300;

  function curtainEl() {
    const doc = target.document;
    let el = doc.getElementById('tlrBootCurtain');
    if (!el) {
      el = doc.createElement('div');
      el.id = 'tlrBootCurtain';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<div class="tlr-boot-spinner"></div>';
      doc.body.appendChild(el);
    }
    return el;
  }

  function showCurtain() {
    curtainEl().classList.add('show');
    return new Promise(resolve => target.setTimeout(resolve, CURTAIN_FADE_MS));
  }

  function hideCurtain() {
    curtainEl().classList.remove('show');
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
    resetModeTransitionUi();
    target.document.body.classList.add('main-menu-mode-booting', 'main-menu-blackout');
    hide();
    await showCurtain();
    try {
      if (fresh) startFresh();
      forceSingleplayerTable();
      if (typeof target.startReading === 'function') {
        if (!gameStarted || fresh) target.startReading();
        gameStarted = true;
        forceSingleplayerTable();
        closeModeChrome();
        hide();
        await waitForSinglePlayerSkin();
        clearSingleplayerBootVeil();
        hideCurtain();
        target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
        // The initial deal already ran (and its draw animation already played
        // out and was consumed) while it was hidden behind the curtain/veil —
        // requestAnimationFrame keeps ticking regardless of visibility, so by
        // the time the curtain lifts the animation is over and was never
        // seen. Re-queue it for the dealt hand now that the table is visible
        // so the player actually sees the cards get dealt.
        if (typeof target.tlrQueueDrawAnimation === 'function') {
          const dealtHand = target.tlrStore?.getState?.()?.run?.hand;
          if (Array.isArray(dealtHand) && dealtHand.length) target.tlrQueueDrawAnimation(dealtHand);
        }
        if (!target.localStorage.getItem('tlr_tut_done') && typeof target.tutShow === 'function') {
          target.setTimeout(() => target.tutShow(0), 400);
        }
      } else {
        console.error('The Last Reading: startReading is not available from the main menu.');
        target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
        hideCurtain();
        show();
      }
    } catch (err) {
      console.error('The Last Reading: failed to start singleplayer from the main menu.', err);
      target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
      hideCurtain();
      show();
    }
  }

  target.tlrShowMainMenu = show;
  target.tlrHideMainMenu = hide;

  function resetTutorialTransientState() {
    if (typeof target.tutResetTransient === 'function') target.tutResetTransient();
    else if (typeof target.tutHide === 'function') target.tutHide();
  }

  function closeSettingsPanel() {
    const panel = target.document.getElementById('settingsPanel');
    if (panel) panel.classList.add('hidden');
  }

  function closePullTab(name) {
    const wrap = target.document.getElementById(`${name}PullWrap`);
    if (wrap) wrap.classList.remove('open');
    const tab = target.document.getElementById(`${name}PullTab`);
    if (tab) {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      tab.innerHTML = `&#9660; ${label}`;
    }
  }

  function closeModeChrome() {
    closeSettingsPanel();
    closePullTab('menu');
    closePullTab('scoring');
    closePullTab('abilities');
    if (typeof target.closeRefs === 'function') target.closeRefs();
  }

  function resetModeTransitionUi() {
    resetTutorialTransientState();
    closeModeChrome();
  }

  target.tlrMainMenuNewGame = function () {
    return startSingleplayer({ fresh: true });
  };

  target.tlrMainMenuContinue = function () {
    return startSingleplayer({ fresh: false });
  };

  target.tlrMainMenuAdventure = async function () {
    resetModeTransitionUi();
    // Hand off to the self-contained Adventure Mode overlay. It restores the
    // main menu itself (via tlrReturnToMenu) when the player leaves.
    target.document.body.classList.add('main-menu-mode-booting', 'main-menu-blackout');
    hide();
    await showCurtain();
    try {
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
        closeModeChrome();
        hideCurtain();
        target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
        target.setTimeout(() => {
          if (target.__tlrAdventureActive && typeof target.maybeShowAdventureTutorial === 'function') {
            target.maybeShowAdventureTutorial();
          }
        }, 500);
      } else {
        console.error('The Last Reading: Adventure Mode is not available.');
        hideCurtain();
        target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
        show();
      }
    } catch (err) {
      console.error('The Last Reading: Adventure Mode failed to start.', err);
      hideCurtain();
      target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
      show();
    }
  };

  target.tlrMainMenuMultiplayer = async function () {
    resetModeTransitionUi();
    // Hide main menu, show loadout screen. Same self-sufficiency concern as
    // tlrMainMenuAdventure above: main.mjs's bulk install overwrites this
    // function directly after the first game load via any path, so this
    // can't rely on menuBoot.mjs's boot-time await ever having run.
    //
    // This needs the same curtain treatment as startSingleplayer/
    // tlrMainMenuAdventure: without it, whatever table was left behind by the
    // previous mode (still fully rendered, only covered by the menu's own
    // z-index) shows through while the menu fades out and the loadout screen
    // fades in on top of it, instead of a clean fade to black.
    target.document.body.classList.add('main-menu-mode-booting', 'main-menu-blackout');
    hide();
    await showCurtain();
    try {
      if (typeof target.tlrShowLoadout !== 'function' && typeof target.__tlrInstallMultiplayerModules === 'function') {
        try {
          await target.__tlrInstallMultiplayerModules();
        } catch (err) {
          console.error('The Last Reading: Duel mode failed to load.', err);
        }
      }
      if (typeof target.tlrShowLoadout === 'function') {
        target.tlrShowLoadout();
        closeModeChrome();
        // #loadoutScreen fades in over the same .3s as the curtain (see
        // loadout.css). Let that finish while still safely hidden behind the
        // forced-opaque curtain (main-menu-blackout), instead of lifting the
        // curtain at the same instant the loadout screen starts fading in —
        // otherwise the two transitions overlap and whatever table was left
        // behind ghosts through the loadout screen's own transparency.
        await new Promise(resolve => target.setTimeout(resolve, CURTAIN_FADE_MS));
        hideCurtain();
        target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
      } else {
        console.error('The Last Reading: Duel mode is not available.');
        hideCurtain();
        target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
        show();
      }
    } catch (err) {
      console.error('The Last Reading: Duel mode failed to start.', err);
      hideCurtain();
      target.document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
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
    if (typeof target.tlrMpLeave === 'function' && target.document.body.classList.contains('mp-game-active')) {
      return target.tlrMpLeave();
    }
    // Close any open sub-panels before showing the menu or starting another mode.
    resetModeTransitionUi();
    closeAllOverlays();
    syncContinueBtn();
    show();
  };
}
