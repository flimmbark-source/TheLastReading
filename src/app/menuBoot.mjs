// Lightweight first-paint boot.
// Keeps the main menu responsive before loading the full game module graph.
import { installMarketAudioRotation } from './marketAudioRotation.mjs';
import { installActionDropGestures } from '../ui/gestureActionDrops.mjs';
import { installCardDetailGestures } from '../ui/cardDetailGestures.mjs?v=double-tap-1';
import { installPremiumStore } from './premiumStore.mjs';
import { installAudioControls } from './audio.mjs';

const CURTAIN_FADE_MS = 300;

let gamePromise = null;
let deferredAssetsPromise = null;
let bootAction = null;

installMarketAudioRotation(window);
installActionDropGestures(window);
installCardDetailGestures(window);
installAudioControls(window);
installPremiumStore(window);

const CANDLELIGHT_KEY = 'tlr_candlelight_lighting';

function candlelightEnabled(storage = window.localStorage) {
  try {
    return storage?.getItem(CANDLELIGHT_KEY) !== '0';
  } catch {
    return true;
  }
}

function applyCandlelightLighting(enabled) {
  document.body.classList.toggle('candlelight-off', !enabled);
  const toggles = [
    document.getElementById('candlelightLighting'),
    document.getElementById('mainMenuCandlelight'),
  ];
  for (const toggle of toggles) {
    if (toggle) toggle.checked = enabled;
  }
}

function syncCandlelightToggle() {
  applyCandlelightLighting(candlelightEnabled(window.localStorage));
}

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
  } catch {
    return false;
  }
}

function menuEl() {
  return document.getElementById('mainMenu');
}

function curtainEl() {
  let el = document.getElementById('tlrBootCurtain');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tlrBootCurtain';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="tlr-boot-spinner"></div>';
    document.body.appendChild(el);
  }
  return el;
}

function showCurtain() {
  document.body.classList.add('main-menu-mode-booting', 'main-menu-blackout');
  curtainEl().classList.add('show');
  return new Promise(resolve => window.setTimeout(resolve, CURTAIN_FADE_MS));
}

function hideCurtain() {
  document.getElementById('tlrBootCurtain')?.classList.remove('show');
  document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
}

function afterPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function installMultiplayerFadeTransition() {
  const current = window.tlrMainMenuMultiplayer;
  if (typeof current !== 'function' || current.__tlrDuelFadeWrapped) return;

  async function multiplayerWithFade() {
    await showCurtain();
    try {
      const result = await current.apply(this, arguments);
      await afterPaint();
      return result;
    } finally {
      hideCurtain();
    }
  }

  multiplayerWithFade.__tlrDuelFadeWrapped = true;
  window.tlrMainMenuMultiplayer = multiplayerWithFade;
}

function buttons() {
  return Array.from(document.querySelectorAll('#mainMenu .main-menu-btn'));
}

function continueButton() {
  return document.getElementById('mainMenuContinue');
}

function syncContinueButton() {
  const btn = continueButton();
  if (!btn) return;
  const available = hasSavedProgress(window.localStorage);
  btn.disabled = !available;
  btn.classList.toggle('main-menu-continue-unavailable', !available);
}

function setBusy(actionName) {
  const menu = menuEl();
  if (menu) menu.classList.add('main-menu-busy');
  for (const btn of buttons()) {
    btn.dataset.bootLabel = btn.textContent;
    btn.disabled = true;
    if (btn.onclick && String(btn.onclick).includes(actionName)) btn.textContent = 'Loading...';
  }
}

function clearBusy() {
  const menu = menuEl();
  if (menu) menu.classList.remove('main-menu-busy');
  for (const btn of buttons()) {
    btn.disabled = false;
    if (btn.dataset.bootLabel) {
      btn.textContent = btn.dataset.bootLabel;
      delete btn.dataset.bootLabel;
    }
  }
  syncContinueButton();
  syncCandlelightToggle();
}

function scheduleDeferredAssets() {
  if (deferredAssetsPromise) return;
  const start = () => {
    deferredAssetsPromise = import('./deferredAssets.mjs?v=lazy-boot-1').catch(err => {
      console.warn('The Last Reading deferred asset load did not complete.', err);
      deferredAssetsPromise = null;
    });
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 4000 });
  } else {
    window.setTimeout(start, 1200);
  }
}

function loadGame() {
  if (!gamePromise) {
    gamePromise = import('./main.mjs?v=deselect-raf-1').then(mod => {
      scheduleDeferredAssets();
      return mod;
    });
  }
  return gamePromise;
}

async function launch(actionName) {
  if (bootAction) return;
  bootAction = actionName;
  document.body.classList.add('main-menu-mode-booting');
  setBusy(actionName);
  try {
    await loadGame();
    if (actionName === 'tlrMainMenuAdventure' && typeof window.__tlrInstallAdventureModules === 'function') {
      await window.__tlrInstallAdventureModules();
    }
    if (actionName === 'tlrMainMenuMultiplayer') installMultiplayerFadeTransition();
    const action = window[actionName];
    if (typeof action === 'function') {
      await action();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.classList.remove('main-menu-mode-booting');
        });
      });
      // Reset the boot state and re-enable the menu buttons. The full game took
      // over the menu (and usually hid it) but if the user ever returns here the
      // buttons must not be left disabled from setBusy().
      bootAction = null;
      clearBusy();
      return;
    }
    throw new Error(`${actionName} was not installed by the game boot.`);
  } catch (err) {
    console.error('The Last Reading could not load the full game.', err);
    bootAction = null;
    gamePromise = null;
    hideCurtain();
    document.body.classList.remove('main-menu-mode-booting');
    clearBusy();
  }
}

function warmGame() {
  loadGame().catch(err => {
    console.warn('The Last Reading game preload did not complete.', err);
    gamePromise = null;
  });
}

window.tlrShowMainMenu = function () {
  const el = menuEl();
  if (!el) return;
  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  el.classList.remove('mm-hidden');
  document.body.classList.add('main-menu-active');
  document.body.classList.remove('main-menu-mode-booting', 'main-menu-blackout');
  document.getElementById('tlrBootCurtain')?.classList.remove('show');
  syncContinueButton();
};

window.tlrMainMenuNewGame = function () {
  launch('tlrMainMenuNewGame');
};

window.tlrMainMenuContinue = function () {
  launch('tlrMainMenuContinue');
};

window.tlrMainMenuMultiplayer = function () {
  launch('tlrMainMenuMultiplayer');
};

window.tlrMainMenuAdventure = function () {
  launch('tlrMainMenuAdventure');
};

// Tab switching and the settings gear are pure menu UI, not game state, so
// they don't need the full module at all -- give them a real implementation
// here rather than a load-then-call stub. installMainMenu() overwrites
// tlrMainMenuSelectTab with a fuller version once loaded (it additionally
// syncs the status pill to live reading/threshold state, which doesn't
// exist yet at this point); keep the dock-switching half of that logic in
// sync between the two files.
window.tlrMainMenuSelectTab = function (tab) {
  const hub = document.querySelector('#mainMenu .main-menu-hub');
  if (hub) hub.dataset.activeTab = tab;
  document.querySelectorAll('#mainMenu .main-menu-dock-tab').forEach(btn => {
    const isActive = btn.dataset.mode === tab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
};

window.tlrMainMenuToggleSettings = function () {
  document.getElementById('settingsPanel')?.classList.toggle('hidden');
};

window.tlrSetCandlelightLighting = function (enabled) {
  const next = !!enabled;
  try {
    window.localStorage.setItem(CANDLELIGHT_KEY, next ? '1' : '0');
  } catch {}
  applyCandlelightLighting(next);
};

window.tlrReturnToMenu = window.tlrShowMainMenu;

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.remove('tlr-loading');
    syncCandlelightToggle();
    window.tlrShowMainMenu();
  });
});

for (const btn of buttons()) {
  btn.addEventListener('pointerenter', warmGame, { once: true, passive: true });
  btn.addEventListener('focus', warmGame, { once: true });
}

syncContinueButton();
syncCandlelightToggle();
