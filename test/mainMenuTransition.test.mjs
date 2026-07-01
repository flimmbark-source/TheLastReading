import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installMainMenu } from '../src/app/mainMenu.mjs';

function createHarness() {
  const dom = new JSDOM(`<!doctype html><html><body><div id="mainMenu"><button id="mainMenuContinue" class="main-menu-btn"></button><button id="mainMenuNewGame" class="main-menu-btn"></button></div></body></html>`, { url: 'http://localhost/' });
  const { document } = dom.window;

  const storage = new Map();
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };

  const target = {
    document,
    localStorage,
    requestAnimationFrame: cb => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: id => clearTimeout(id),
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false }),
    startReading() {},
    tlrStore: null,
    tlrActions: null,
    persist: null,
    state: null,
    tlrRuntime: null,
  };

  installMainMenu(target);

  return { target, document, localStorage };
}

test('starting singleplayer hides the main menu before the curtain fades in', async () => {
  const { target, document } = createHarness();
  const menu = document.getElementById('mainMenu');

  const promise = target.tlrMainMenuNewGame();

  assert.equal(menu.classList.contains('mm-hidden'), true, 'main menu should begin hiding immediately');
  assert.equal(document.body.classList.contains('main-menu-blackout'), true, 'menu should enter a blackout transition state');
  assert.equal(document.body.classList.contains('main-menu-mode-booting'), true, 'booting state should be active');

  await promise;
});

test('starting adventure uses the same blackout transition', async () => {
  const { target, document } = createHarness();
  const menu = document.getElementById('mainMenu');
  target.tlrStartAdventure = () => {};

  const promise = target.tlrMainMenuAdventure();

  assert.equal(menu.classList.contains('mm-hidden'), true, 'adventure transition should hide the main menu immediately');
  assert.equal(document.body.classList.contains('main-menu-blackout'), true, 'adventure transition should enter blackout state');

  await promise;
  assert.equal(document.body.classList.contains('main-menu-blackout'), false, 'blackout state should clear after adventure starts');
});

test('return to menu routes through multiplayer leave when mp is active', () => {
  const { target, document } = createHarness();
  document.body.classList.add('mp-game-active');
  let left = false;
  target.tlrMpLeave = () => { left = true; };

  target.tlrReturnToMenu();
  assert.equal(left, true, 'tlrReturnToMenu should route through tlrMpLeave when multiplayer is active');
});
