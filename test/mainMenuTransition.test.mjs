import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
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


test('mode transitions reset queued tutorial state and close settings panel', async () => {
  const { target, document } = createHarness();
  const panel = document.createElement('div');
  panel.id = 'settingsPanel';
  document.body.appendChild(panel);
  const menuWrap = document.createElement('div');
  menuWrap.id = 'menuPullWrap';
  menuWrap.className = 'open';
  document.body.appendChild(menuWrap);
  const scoringWrap = document.createElement('div');
  scoringWrap.id = 'scoringPullWrap';
  scoringWrap.className = 'open';
  document.body.appendChild(scoringWrap);
  const scoringTab = document.createElement('button');
  scoringTab.id = 'scoringPullTab';
  scoringTab.innerHTML = '&#9650; Scoring';
  document.body.appendChild(scoringTab);

  let resetCount = 0;
  let refsClosed = 0;
  target.tutResetTransient = () => { resetCount += 1; };
  target.closeRefs = () => { refsClosed += 1; };
  target.tlrStartAdventure = () => {};

  await target.tlrMainMenuAdventure();

  assert.equal(resetCount, 1, 'adventure entry clears stale tutorial queues from the previous mode');
  assert.equal(panel.classList.contains('hidden'), true, 'open settings panel is closed before entering the next mode');
  assert.equal(menuWrap.classList.contains('open'), false, 'open menu pull tab is closed before entering the next mode');
  assert.equal(scoringWrap.classList.contains('open'), false, 'open scoring pull tab is closed before entering the next mode');
  assert.equal(scoringTab.innerHTML, '▼ Scoring', 'closed scoring tab label is restored');
  assert.equal(refsClosed >= 1, true, 'open reference overlays are closed before entering the next mode');
});

test('return to menu routes through multiplayer leave when mp is active', () => {
  const { target, document } = createHarness();
  document.body.classList.add('mp-game-active');
  let left = false;
  target.tlrMpLeave = () => { left = true; };

  target.tlrReturnToMenu();
  assert.equal(left, true, 'tlrReturnToMenu should route through tlrMpLeave when multiplayer is active');
});


test('closed drawer contents are hidden even if drawer content overflows', () => {
  const css = readFileSync(new URL('../src/styles/drawers.css', import.meta.url), 'utf8');

  assert.match(css, /\.tlr-pull-wrap:not\(\.open\) \.tlr-pull-desk>\*\{visibility:hidden!important\}/, 'closed drawer contents should not bleed into other modes');
  assert.match(css, /\.tlr-pull-wrap\.open \.tlr-pull-desk>\*\{visibility:visible!important\}/, 'open drawer contents should remain visible');
});
