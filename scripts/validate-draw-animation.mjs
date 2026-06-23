import assert from 'node:assert/strict';

import {
  queueDrawAnimation,
  consumeDrawAnimation,
  clearDrawAnimations,
  installDrawAnimation,
} from '../src/ui/drawAnimation.mjs';
import { drawN } from '../src/app/deckRuntime.mjs';

const card = uid => ({ uid, id: `major_${uid}`, type: 'major' });

// Queued cards retain draw order and receive a staggered delay.
{
  const target = {};
  queueDrawAnimation([card(1), card(2), card(3)], target, { staggerMs: 80 });
  assert.equal(consumeDrawAnimation(1, target).delayMs, 0, 'first dealt card starts immediately');
  assert.equal(consumeDrawAnimation(2, target).delayMs, 80, 'second dealt card is staggered');
  assert.equal(consumeDrawAnimation(3, target).delayMs, 160, 'third dealt card is staggered again');
  assert.equal(consumeDrawAnimation(3, target), null, 'a queued animation is consumed once');
}

// Direct deck draws queue only the cards actually added to the hand.
{
  const first = card(10);
  const drawnA = card(11);
  const drawnB = card(12);
  const target = {
    tlrRuntime: {
      state: { hand: [first], deck: [drawnA, drawnB], discard: [] },
      persist: { up: {}, relics: [] },
    },
    shuffle: cards => cards,
    playSound() {},
  };
  assert.equal(drawN(2, target), 2, 'draw runtime adds both available cards');
  assert.equal(consumeDrawAnimation(first.uid, target), null, 'existing hand card is not animated as drawn');
  assert.equal(consumeDrawAnimation(drawnA.uid, target).index, 0, 'first new card is queued first');
  assert.equal(consumeDrawAnimation(drawnB.uid, target).index, 1, 'second new card is queued second');
}

// Full-hand actions mark the next hand render, but rejected actions clear it.
{
  const target = {
    startReading() { return true; },
    mulligan() { return false; },
  };
  installDrawAnimation(target);
  target.startReading();
  assert.equal(target.__tlrAnimateFullHandOnNextRender, true, 'new reading marks the next hand as a full deal');
  clearDrawAnimations(target);
  target.mulligan();
  assert.equal(target.__tlrAnimateFullHandOnNextRender, false, 'failed mulligan does not leave a stale deal marker');
}

console.log('Draw animation checks passed.');
