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

// Steps are addressed by stable id, never array position, so guard that ids are
// unique and that every semantic TUT_STEP name maps to a real step -- a stale
// (renamed/removed) id would otherwise silently route the flow nowhere.
const ids = [...source.matchAll(/\bid:\s*'([^']+)'/g)].map(m => m[1]);
assert.ok(ids.length >= 20, 'tutorial steps should carry id fields');
assert.equal(ids.length, new Set(ids).size, 'every tutorial step id must be unique');
const idSet = new Set(ids);
for (const [name, id] of Object.entries(tutorial.TUT_STEP)) {
  assert.ok(idSet.has(id), `TUT_STEP.${name} ('${id}') must reference an existing step id`);
}
assert.doesNotMatch(source, /indices remain unchanged|kept last so/, 'the array-position technical-debt note must be gone');
assert.doesNotMatch(source, /INTRO_LAST_STEP|ADVENTURE_FIRST_STEP|ADVENTURE_LAST_STEP/, 'hardcoded numeric step-index constants must be gone');

console.log('Tutorial placement runtime checks passed.');
