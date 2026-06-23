import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { ACTIONS } from '../src/game/actions.mjs';
import { installMarketRebalance } from '../src/app/marketRebalance.mjs';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
const persist = {
  pool: 100,
  up: { relicSlot: 0 },
  relicUsed: { watcher: true },
};

let run = {
  selectedCardId: 1,
  hand: [{ uid: 1, id: 'major_3', points: 1 }],
  discard: [],
  discardedCards: [],
  worldCarry: 7,
};

const store = {
  getState: () => ({ run, persist: {} }),
  dispatch(action) {
    if (action.type === ACTIONS.DISCARD_SELECTED) {
      const card = run.hand.find(entry => entry.uid === run.selectedCardId);
      run = {
        ...run,
        selectedCardId: null,
        hand: run.hand.filter(entry => entry.uid !== card?.uid),
        discard: card ? [...run.discard, card] : run.discard,
      };
    } else if (action.type === ACTIONS.START_NEXT_SET) {
      run = { ...run, discardedCards: [...run.discardedCards], worldCarry: run.worldCarry };
    } else if (action.type === ACTIONS.SYNC_LEGACY_RUN) {
      run = { ...run, ...(action.run || {}) };
    }
    return action;
  },
};

let openCount = 0;
let startSawWatcherUsed = null;
const target = {
  document: dom.window.document,
  tlrRuntime: { persist },
  tlrStore: store,
  PACKS: {
    foundation: {},
    innate: {},
    restless: {},
    second_sight: {},
    thread: {},
  },
  _storeFrontOffers: {
    scoring: ['sequence'],
    pack: ['thread'],
    relics: ['gilded_fool'],
  },
  relicSlots: () => 3,
  shopCost: () => 35,
  openShopMain() {
    openCount += 1;
    this.document.body.innerHTML = `
      <div class="store-offer-row">
        <div class="store-card"><div class="store-card-desc">old scoring copy</div></div>
        <div class="store-card"><div class="store-card-desc">pack</div></div>
        <div class="store-card"><div class="store-card-desc">relic</div></div>
      </div>`;
    return true;
  },
  confirmStoreVessel() {
    this.openShopMain();
    return true;
  },
  continueReading() {
    return true;
  },
  startReading() {
    startSawWatcherUsed = this.tlrRuntime.persist.relicUsed.watcher;
    return true;
  },
  showStorePackCallout() {
    this.document.body.insertAdjacentHTML('beforeend', '<div class="store-pack-callout"><ul class="store-pack-callout-list"><li>old</li></ul></div>');
    return true;
  },
};

const originalRandom = Math.random;
Math.random = () => 0;
try {
  installMarketRebalance(target);

  target.startReading();
  assert.equal(startSawWatcherUsed, false, 'Watcher should reset before each reading starts');

  target.tlrStore.dispatch({ type: ACTIONS.DISCARD_SELECTED });
  assert.equal(run.discardedCards.length, 1, 'all successful discards should be tracked for scoring relics');
  assert.equal(run.discardedCards[0].uid, 1);

  target.tlrStore.dispatch({ type: ACTIONS.START_NEXT_SET });
  assert.deepEqual(run.discardedCards, [], 'discard tracking should reset between sets');
  assert.equal(run.worldCarry, 0, 'World carry should be consumed by the first set');

  target.openShopMain();
  assert.equal(target._storeFrontOffers.pack[0], 'foundation', 'dormant Thread offers should be replaced with an active pack');
  assert.ok(openCount >= 2, 'sanitizing a dormant pack should rerender the storefront');
  assert.equal(
    target.document.querySelector('.store-offer-row .store-card:nth-child(1) .store-card-desc').textContent,
    'Each completed Sequence tier: +5 Chips / +0.25 Mult',
    'tiered scoring offers should explain their cumulative scaling',
  );
  assert.match(
    target.document.querySelector('.store-offer-row .store-card:nth-child(3)').textContent,
    /Relic Vessel/,
    'a successful 30% roll should replace the relic offer with a Vessel',
  );

  target.confirmStoreVessel();
  assert.equal(target._storeVesselBought, true, 'buying a Vessel should block another Vessel in the same market');
  assert.match(
    target.document.querySelector('.store-offer-row .store-card:nth-child(3)').textContent,
    /Purchased/,
    'the Vessel should consume the relic slot until the market is rerolled',
  );

  target.showStorePackCallout('foundation');
  const calloutText = target.document.querySelector('.store-pack-callout-list').textContent;
  assert.match(calloutText, /Omen/);
  assert.doesNotMatch(calloutText, /Suit bonuses/);

  target.continueReading();
  assert.equal(target._storeVesselBought, false, 'Vessel eligibility should reset for the next market');
} finally {
  Math.random = originalRandom;
}

console.log('Market rebalance validation cases passed.');
