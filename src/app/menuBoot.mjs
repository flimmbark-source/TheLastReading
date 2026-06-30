// Lightweight first-paint boot.
// Keeps the main menu responsive before loading the full game module graph.
import { installMarketAudioRotation } from './marketAudioRotation.mjs';
import { installActionDropGestures } from '../ui/gestureActionDrops.mjs';
import { installCardDetailGestures } from '../ui/cardDetailGestures.mjs?v=double-tap-1';

const GAME_MODULE = './main.mjs?v=major-title-fix-1';
const DEFERRED_ASSETS_MODULE = './deferredAssets.mjs?v=lazy-boot-1';

let gamePromise = null;
let deferredAssetsPromise = null;
let bootAction = null;

installMarketAudioRotation(window);
installActionDropGestures(window);
installCardDetailGestures(window);

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

function buttons() {
  return Array.from(document.querySelectorAll('#mainMenu .main-menu-btn'));
}

function continueButton() {
  return document.getElementById('mainMenuContinue');
}

function syncContinueButton() {
  const btn = continueButton();
  if (btn) btn.disabled = !hasSavedProgress(window.localStorage);
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
    deferredAssetsPromise = import(DEFERRED_ASSETS_MODULE).catch(err => {
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
    gamePromise = import(GAME_MODULE).then(mod => {
      scheduleDeferredAssets();
      return mod;
    });
  }
  return gamePromise;
}

async function launch(actionName) {
  if (bootAction) return;
  bootAction = actionName;
  setBusy(actionName);
  try {
    await loadGame();
    if (actionName === 'tlrMainMenuAdventure' && typeof window.__tlrInstallAdventureModules === 'function') {
      await window.__tlrInstallAdventureModules();
    }
    const action = window[actionName];
    if (typeof action === 'function') {
      action();
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
