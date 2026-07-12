import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installPatternHintStack } from '../src/ui/patternHintStack.mjs';

// The pattern-hint panel mirrors the "active" card's hint. A committed selection
// (.sel / .ability-picked) must own the panel; a transient press-highlight only
// drives it when nothing is selected. Regression guard: querySelector returns
// the first match in DOM order, so before the committed/press split, pressing
// any card left of a selected card (always the case for a selected rightmost
// card) hijacked its hint.

const dom = new JSDOM(`<!doctype html><body>
  <div id="patternHintStack" class="pattern-hint-stack"></div>
  <div id="hand" class="hand">
    <div class="card" data-uid="1" data-hint-lines="LeftHint"></div>
    <div class="card" data-uid="2" data-hint-lines="MidHint"></div>
    <div class="card" data-uid="3" data-hint-lines="RightHint"></div>
  </div>
  <div id="spread" class="spread"></div>
  <div id="choices" class="choices"></div>
</body>`);

const w = dom.window;
w.requestAnimationFrame = cb => { setTimeout(cb, 0); return 1; };
installPatternHintStack(w);

const stack = w.document.getElementById('patternHintStack');
const cards = [...w.document.querySelectorAll('#hand .card')];
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

async function expect(desc, mutate, expected) {
  cards.forEach(c => c.classList.remove('sel', 'press-highlight'));
  mutate();
  w.__patternHintStackRefresh();
  await tick();
  assert.equal(stack.textContent, expected, desc);
}

// The reported bug: rightmost selected, press a card to its left.
await expect('selected rightmost keeps its hint when a left card is pressed',
  () => { cards[2].classList.add('sel'); cards[0].classList.add('press-highlight'); }, 'RightHint');
await expect('a selected card keeps its hint when a right card is pressed',
  () => { cards[1].classList.add('sel'); cards[2].classList.add('press-highlight'); }, 'MidHint');
await expect('a selected card keeps its hint when a left card is pressed',
  () => { cards[1].classList.add('sel'); cards[0].classList.add('press-highlight'); }, 'MidHint');
// Press-highlight still drives the panel when nothing is selected.
await expect('a press-highlight drives the panel with no selection',
  () => { cards[0].classList.add('press-highlight'); }, 'LeftHint');
await expect('a selection alone shows its own hint',
  () => { cards[2].classList.add('sel'); }, 'RightHint');

console.log('Pattern hint stack selection-priority checks passed.');
