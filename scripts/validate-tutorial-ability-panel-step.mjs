import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Full mandatory-onboarding walk-through covering the reordered chain:
// reading-goal -> ability-flick -> ability-panel-intro -> patterns-intro ->
// pattern-hints -> complete. ability-panel-intro must behave like
// patterns-intro: wait for the Abilities panel to actually open, hide while
// it's open, then wait for it to close before advancing.

const dom = new JSDOM(`
  <div id="tutTip"><span id="tutText"></span><span class="tut-tap-prompt"></span></div>
  <div id="hand"><div class="card" data-uid="1"></div></div>
  <div id="spread"><div class="slot empty"></div></div>
  <button id="abilitiesBtn"></button>
  <button id="scoringBtn"></button>
  <div id="hintLevelBar"></div>
  <div id="menuPullWrap"></div>
  <div id="settingsPanel" class="hidden"></div>
`, { url: 'https://example.test/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.localStorage = window.localStorage;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.CustomEvent = window.CustomEvent;
globalThis.requestAnimationFrame = callback => callback();
window.requestAnimationFrame = globalThis.requestAnimationFrame;

const rect = { left: 0, top: 0, right: 120, bottom: 40, width: 120, height: 40, x: 0, y: 0, toJSON(){return this;} };
for (const sel of ['#hand .card', '#spread', '#spread .slot', '#abilitiesBtn', '#scoringBtn', '#hintLevelBar', '#tutTip']) {
  document.querySelector(sel).getBoundingClientRect = () => rect;
}

const tutorial = await import('../src/app/tutorialCore.mjs?ability-panel-step=1');
const { TUT_STEP } = tutorial;

const steps = [];
window.addEventListener('tlr:tutorial-step', e => steps.push(e.detail.step));
let completed = false;
window.addEventListener('tlr:tutorial-complete', () => { completed = true; });

const tip = document.getElementById('tutTip');
const isShowing = () => tip.classList.contains('show');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

tutorial.tutShow(TUT_STEP.INTRO, { force: true });
tutorial.tutNext();
assert.equal(steps.at(-1), TUT_STEP.SELECT_CARD);

tutorial.tutSignal('cardSelected');
assert.equal(steps.at(-1), TUT_STEP.PLACE_CARD);

tutorial.tutSignal('cardPlaced');
assert.equal(steps.at(-1), TUT_STEP.READING_GOAL);

tutorial.tutNext();
assert.equal(steps.at(-1), TUT_STEP.ABILITY_FLICK, 'reading-goal must advance into ability-flick, not straight to patterns-intro');

tutorial.tutNext();
assert.equal(steps.at(-1), TUT_STEP.ABILITY_PANEL_INTRO, 'dismissing ability-flick must open the new ability-panel-intro step');
assert.match(document.getElementById('tutText').innerHTML, /Open the Abilities panel to see how they work\./);

tutorial.tutNext();
assert.equal(steps.at(-1), TUT_STEP.ABILITY_PANEL_INTRO, 'ability-panel-intro must not advance on a plain tap, only on the panel actually opening');
assert.ok(isShowing(), 'the tip should still be visible before the panel opens');

tutorial.tutSignal('abilitiesOpened');
assert.ok(!isShowing(), 'opening Abilities should hide the tip so the panel is readable, exactly like patterns-intro/Scoring');

tutorial.tutSignal('abilitiesClosed');
await wait(30);
assert.equal(steps.at(-1), TUT_STEP.PATTERNS_INTRO, 'closing Abilities must advance straight into the existing patterns-intro (scoring) step');

tutorial.tutSignal('scoringOpened');
assert.ok(!isShowing(), 'opening Scoring still hides the tip as before');

tutorial.tutSignal('scoringClosed');
await wait(520);
assert.equal(steps.at(-1), TUT_STEP.HINT_SETTING, 'closing Scoring must still advance to Pattern Hints exactly as before the reorder');

assert.equal(completed, false);
tutorial.tutNext();
assert.equal(completed, true, 'tapping through Pattern Hints must still complete the mandatory intro');

console.log('Ability-panel tutorial step ordering and handshake checks passed.');
