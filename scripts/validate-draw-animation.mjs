import assert from 'node:assert/strict';

import {
  queueDrawAnimation,
  consumeDrawAnimation,
  holdDrawAnimations,
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

// A loading/reveal hold keeps the hand out of the live queue until release.
// Multiple hidden re-queues collapse to the latest complete hand, so the store
// dispatch and the explicit post-boot replay cannot animate the same deal twice.
{
  const target = {};
  const release = holdDrawAnimations(target);
  queueDrawAnimation([card(4), card(5)], target, { staggerMs: 60 });
  queueDrawAnimation([card(6), card(7), card(8)], target, { staggerMs: 70 });
  assert.equal(consumeDrawAnimation(4, target), null, 'held deal is not consumable behind the loading surface');
  assert.equal(consumeDrawAnimation(6, target), null, 'latest held deal also stays out of the live queue');
  release({ play: true });
  assert.equal(consumeDrawAnimation(4, target), null, 'an older hidden replay is discarded');
  assert.equal(consumeDrawAnimation(6, target).delayMs, 0, 'latest held deal starts when the reveal releases');
  assert.equal(consumeDrawAnimation(7, target).delayMs, 70, 'released deal keeps its stagger');
  assert.equal(consumeDrawAnimation(8, target).delayMs, 140, 'released deal keeps full order');
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

// Opening and later set deals both queue the entire newly dealt hand.
{
  let run = { hand: [] };
  const openingHand = [card(20), card(21), card(22)];
  const nextSetHand = [card(30), card(31), card(32)];
  const store = {
    getState: () => ({ run }),
    dispatch(action) {
      if (action.type === 'START_READING') run = { hand: openingHand };
      if (action.type === 'START_NEXT_SET') run = { hand: nextSetHand };
      return action;
    },
  };
  const target = { tlrStore: store };
  installDrawAnimation(target);

  store.dispatch({ type: 'START_READING' });
  assert.equal(consumeDrawAnimation(openingHand[0].uid, target).delayMs, 0, 'opening set deals the first card immediately');
  assert.equal(consumeDrawAnimation(openingHand[1].uid, target).delayMs, 78, 'opening set staggers the second card');
  assert.equal(consumeDrawAnimation(openingHand[2].uid, target).delayMs, 156, 'opening set staggers the third card');

  store.dispatch({ type: 'START_NEXT_SET' });
  assert.equal(consumeDrawAnimation(nextSetHand[0].uid, target).delayMs, 0, 'next set deals the first card immediately');
  assert.equal(consumeDrawAnimation(nextSetHand[1].uid, target).delayMs, 78, 'next set staggers the second card');
  assert.equal(consumeDrawAnimation(nextSetHand[2].uid, target).delayMs, 156, 'next set staggers the third card');
}

// Other full-hand actions still mark the next hand render, but rejected actions clear it.
{
  const target = {
    flushHand() { return true; },
    mulligan() { return false; },
  };
  installDrawAnimation(target);
  target.flushHand();
  assert.equal(target.__tlrAnimateFullHandOnNextRender, true, 'flush marks the next hand as a full deal');
  clearDrawAnimations(target);
  target.mulligan();
  assert.equal(target.__tlrAnimateFullHandOnNextRender, false, 'failed mulligan does not leave a stale deal marker');
}

console.log('Draw animation checks passed.');
