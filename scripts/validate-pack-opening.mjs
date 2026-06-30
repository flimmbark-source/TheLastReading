import assert from 'node:assert/strict';
import { installPackOpeningSafety } from '../src/app/packOpeningSafety.mjs';

const overlays = [];
const errors = [];
const target = {
  tlrRuntime: { persist: { pool: 100 } },
  _packBuys: {},
  tlrShopOverlayFlow: {
    buildUpgradePicker(packId) {
      return `<div class="pack-picker-header"><h3>${packId}</h3></div>`;
    },
  },
  showOverlay(html) {
    overlays.push(html);
  },
  console: {
    error(...args) {
      errors.push(args);
    },
  },
};

installPackOpeningSafety(target);
target.buyPack = function brokenAnimation(packId, cost) {
  target.tlrRuntime.persist.pool -= cost;
  target._packBuys[packId] = 1;
  throw new Error('animation DOM failed');
};

assert.equal(target.buyPack('foundation', 14), true);
assert.equal(target.tlrRuntime.persist.pool, 86, 'the purchase should remain committed');
assert.equal(overlays.length, 1, 'the purchased pack should open despite the animation error');
assert.match(overlays[0], /foundation/);
assert.equal(errors.length, 1, 'the animation failure should still be reported');

console.log('Pack opening validation cases passed.');
