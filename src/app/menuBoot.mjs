// Lightweight first-paint boot.
// Keeps the main menu responsive before loading the full game module graph.

const GAME_MODULE = './main.mjs?v=lazy-boot-1';

let gamePromise = null;
let bootAction = null;

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
    if (btn.dataset.bootLabel) {
      btn.textContent = btn.dataset.bootLabel;
      delete btn.dataset.bootLabel;
    }
  }
  syncContinueButton();
}

function loadGame() {
  if (!gamePromise) gamePromise = import(GAME_MODULE);
  return gamePromise;
}

async function launch(actionName) {
  if (bootAction) return;
  bootAction = actionName;
  setBusy(actionName);
  try {
    await loadGame();
    const action = window[actionName];
    if (typeof action === 'function') {
      action();
      return;
    }
    throw new Error(`${actionName} was not installed by the game boot.`);
  } catch (err) {
    console.error('The Last Reading failed to load the full game.', err);
    bootAction = null;
    gamePromise = null;
    clearBusy();
    window.alert?.('The game failed to load. Try refreshing the page.');
  }
}

function warmGame() {
  loadGame().catch(err => {
    console.warn('The Last Reading game preload failed.', err);
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

window.tlrReturnToMenu = window.tlrShowMainMenu;

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.remove('tlr-loading');
    window.tlrShowMainMenu();
  });
});

for (const btn of buttons()) {
  btn.addEventListener('pointerenter', warmGame, { once: true, passive: true });
  btn.addEventListener('focus', warmGame, { once: true });
}

syncContinueButton();
