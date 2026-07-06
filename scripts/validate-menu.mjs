// Headless check for the main-menu show path.
//
// Regression guard: the lightweight boot loader disables every menu button while
// it loads the game module (setBusy) and only restores them on failure. Once the
// game is running, returning to the menu from a singleplayer or multiplayer
// session must present an interactive menu, not buttons left disabled by the boot
// loader. Before the fix this produced a dead, greyed-out menu.

import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

import { installRuntimeState } from '../src/app/runtimeState.mjs';
import { installMainMenu } from '../src/app/mainMenu.mjs';

const html = readFileSync(new URL('../game.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.requestAnimationFrame = cb => setTimeout(cb, 0);

installRuntimeState(window);
installMainMenu(window);

const menu = window.document.getElementById('mainMenu');
const allButtons = () => [...menu.querySelectorAll('.main-menu-btn')];
const byId = id => window.document.getElementById(id);

// Simulate the boot loader having disabled every menu button (setBusy) and the
// menu then being hidden for a session (matchmaking enterMatchView style).
menu.classList.add('main-menu-busy');
allButtons().forEach(b => { b.disabled = true; b.classList.add('main-menu-btn-loading'); });
menu.classList.add('mm-hidden');
if ('inert' in menu) menu.inert = true;
menu.hidden = true;

// Return to the menu.
window.tlrShowMainMenu();

assert.equal(menu.hidden, false, 'menu is visible after returning');
assert.equal(menu.classList.contains('mm-hidden'), false, 'mm-hidden cleared on show');
assert.equal(menu.classList.contains('main-menu-busy'), false, 'main-menu-busy cleared on show');
if ('inert' in menu) assert.equal(menu.inert, false, 'menu is not inert after returning');
assert.equal(byId('mainMenuNewGame').disabled, false, 'New Reading is selectable after returning');
assert.equal(byId('mainMenuDuel').disabled, false, 'Duel is selectable after returning');
assert.equal(byId('mainMenuNewGame').classList.contains('main-menu-btn-loading'), false, 'New Reading\'s nested icon/title/subtitle markup is restored (not left showing "Loading…") after returning');
assert.equal(byId('mainMenuDuel').classList.contains('main-menu-btn-loading'), false, 'Duel\'s nested icon/title/subtitle markup is restored (not left showing "Loading…") after returning');
assert.ok(byId('mainMenuDuel').querySelector('.main-menu-mode-title'), 'Duel\'s nested mode-card markup survives the disable/re-enable cycle intact');

// Regression guard: tlrMainMenuMultiplayer() used to skip the curtain
// entirely (unlike startSingleplayer/tlrMainMenuAdventure), so switching to
// Duel mode after playing another mode showed that old mode's table fully
// rendered -- only thinly covered by the fading main menu and the loadout
// screen's own fade-in -- instead of a clean fade to black.
window.tlrShowLoadout = () => {
  window.document.getElementById('loadoutScreen')?.remove();
  const screen = window.document.createElement('div');
  screen.id = 'loadoutScreen';
  screen.className = 'loadout-hidden';
  window.document.body.appendChild(screen);
  screen.classList.remove('loadout-hidden');
};
const duelPromise = window.tlrMainMenuMultiplayer();
assert.ok(window.document.body.classList.contains('main-menu-blackout'), 'curtain forced opaque as soon as Duel starts loading');
assert.ok(window.document.getElementById('tlrBootCurtain').classList.contains('show'), 'curtain shown while Duel loads');
await duelPromise;
assert.equal(window.document.body.classList.contains('main-menu-blackout'), false, 'curtain classes cleared once the loadout screen is ready');
assert.equal(window.document.getElementById('tlrBootCurtain').classList.contains('show'), false, 'curtain hidden once the loadout screen is ready');
assert.equal(window.document.getElementById('loadoutScreen').classList.contains('loadout-hidden'), false, 'loadout screen is shown once the curtain lifts');

console.log('Main menu checks passed.');
