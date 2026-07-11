import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync(new URL('../src/app/tutorialCore.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(source, /\bplacementCount\b/, 'tutorial placement must not depend on a dead counter');

const dom = new JSDOM('<div id="tutTip"><span id="tutText"></span><span class="tut-tap-prompt"></span></div>', { url: 'https://example.test/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.CustomEvent = window.CustomEvent;
globalThis.requestAnimationFrame = callback => callback();
window.requestAnimationFrame = globalThis.requestAnimationFrame;

const tutorial = await import('../src/app/tutorialCore.mjs?placement-regression=1');
assert.doesNotThrow(() => tutorial.tutSignal('cardPlaced'), 'placing a card must not throw in tutorial signaling');
assert.doesNotThrow(() => tutorial.replayTutorial(), 'replaying the tutorial must not reference removed placement state');

console.log('Tutorial placement runtime checks passed.');
