import assert from 'node:assert/strict';

import { ACTIONS } from '../src/game/actions.mjs';
import { createGameState } from '../src/game/state.mjs';
import { reducer } from '../src/game/reducer.mjs';
import { RELICS, relicsForEvent, RELIC_EVENT_TYPES } from '../src/data/relics.mjs';
import { getShopItem } from '../src/data/shopItems.mjs';
import { buildShopOffer, buyShopItem, shopItemCost } from '../src/systems/shop.mjs';
import { firstDiscardIsFree, marketCostAfterRelics, startingHandBonusFromRelics } from '../src/systems/relics.mjs';

assert.equal(RELICS.gilded_fool.name, 'The Gilded Fool');
assert.ok(relicsForEvent(RELIC_EVENT_TYPES.SCORING).some(relic => relic.id === 'gilded_fool'));
assert.equal(firstDiscardIsFree(['gilded_discard']), true, 'Gilded Discard should make first discard free');
assert.equal(firstDiscardIsFree([]), false, 'No relic should mean no free discard');
assert.equal(startingHandBonusFromRelics(['threadbare_tarot']), 1, 'Threadbare Tarot should add one starting card');
assert.equal(startingHandBonusFromRelics([]), 0, 'No relic should mean no starting hand bonus');
assert.equal(marketCostAfterRelics(30, ['merchant_scale']), 27, "Merchant's Scale should discount by 3");
assert.equal(marketCostAfterRelics(2, ['merchant_scale']), 0, 'Market costs should not go below zero');

const rankItem = getShopItem('upgrade_rank');
assert.equal(rankItem.upgradeKey, 'rank');
assert.equal(shopItemCost(rankItem, { relics: [] }), 18);
assert.equal(shopItemCost(rankItem, { relics: ['merchant_scale'] }), 15);

let persist = createGameState({ persist: { reserve: 20 } }).persist;
let purchase = buyShopItem(persist, 'upgrade_rank');
assert.equal(purchase.purchased, true, 'purchase should succeed when affordable');
assert.equal(purchase.persist.reserve, 2, 'purchase should deduct cost');
assert.equal(purchase.persist.upgrades.rank, 1, 'purchase should increment upgrade level');

persist = createGameState({ persist: { reserve: 10 } }).persist;
purchase = buyShopItem(persist, 'upgrade_rank');
assert.equal(purchase.purchased, false, 'purchase should fail when too expensive');
assert.equal(purchase.reason, 'too_expensive');

persist = createGameState({ persist: { reserve: 30 } }).persist;
purchase = buyShopItem(persist, 'relic_gilded_fool');
assert.equal(purchase.purchased, true, 'relic purchase should succeed when affordable');
assert.deepEqual(purchase.persist.relics, ['gilded_fool'], 'relic purchase should add relic id');

persist = createGameState({ persist: { reserve: 99, relics: ['gilded_fool'] } }).persist;
purchase = buyShopItem(persist, 'relic_gilded_fool');
assert.equal(purchase.purchased, false, 'duplicate relic purchase should fail');
assert.equal(purchase.reason, 'unavailable');

persist = createGameState({ persist: { reserve: 99, upgrades: { rank: 5 } } }).persist;
purchase = buyShopItem(persist, 'upgrade_rank');
assert.equal(purchase.purchased, false, 'maxed upgrade purchase should fail');
assert.equal(purchase.reason, 'unavailable');

persist = createGameState({ persist: { reserve: 99 } }).persist;
const offer = buildShopOffer(persist, { count: 3, rng: () => 0.5 });
assert.equal(offer.length, 3, 'shop offer should respect requested count');
assert.ok(offer.every(item => Number.isFinite(item.currentCost)), 'shop offers should expose current cost');

let state = createGameState({ persist: { reserve: 20 } });
state = reducer(state, { type: ACTIONS.BUY_MARKET_ITEM, itemId: 'upgrade_rank' });
assert.equal(state.persist.reserve, 2, 'reducer shop purchase should deduct reserve');
assert.equal(state.persist.upgrades.rank, 1, 'reducer shop purchase should apply upgrade');
assert.equal(state.run.lastPurchase.purchased, true, 'reducer should store purchase result');

console.log('Economy validation cases passed.');
