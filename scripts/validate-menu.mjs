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

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
window.requestAnimationFrame = cb => setTimeout(cb, 0);

installRuntimeState(window);
installMainMenu(window);

const menu = window.document.getElementById('mainMenu');
const allButtons = () => [...menu.querySelectorAll('.main-menu-btn')];
const byText = label => allButtons().find(b => b.textContent.trim() === label);

// Simulate the boot loader having disabled every menu button (setBusy) and the
// menu then being hidden for a session (matchmaking enterMatchView style).
menu.classList.add('main-menu-busy');
allButtons().forEach(b => { b.disabled = true; });
menu.classList.add('mm-hidden');
if ('inert' in menu) menu.inert = true;
menu.hidden = true;

// Return to the menu.
window.tlrShowMainMenu();

assert.equal(menu.hidden, false, 'menu is visible after returning');
assert.equal(menu.classList.contains('mm-hidden'), false, 'mm-hidden cleared on show');
assert.equal(menu.classList.contains('main-menu-busy'), false, 'main-menu-busy cleared on show');
if ('inert' in menu) assert.equal(menu.inert, false, 'menu is not inert after returning');
assert.equal(byText('New Game').disabled, false, 'New Game is selectable after returning');
assert.equal(byText('Duel').disabled, false, 'Duel is selectable after returning');

console.log('Main menu checks passed.');
