import { getShopItem, SHOP_ITEM_TYPES, SHOP_ITEMS } from '../data/shopItems.mjs';
import { marketCostAfterRelics } from './relics.mjs';

function isUpgradeMaxed(item, persist) {
  if (item.type !== SHOP_ITEM_TYPES.UPGRADE) return false;
  return (persist.upgrades[item.upgradeKey] || 0) >= item.maxLevel;
}

function alreadyOwnsRelic(item, persist) {
  if (item.type !== SHOP_ITEM_TYPES.RELIC) return false;
  return (persist.relics || []).includes(item.relicId);
}

export function isShopItemAvailable(item, persist) {
  if (!item) return false;
  if (isUpgradeMaxed(item, persist)) return false;
  if (alreadyOwnsRelic(item, persist)) return false;
  return true;
}

export function shopItemCost(item, persist) {
  return marketCostAfterRelics(item.cost, persist.relics || []);
}

export function availableShopItems(persist, items = SHOP_ITEMS) {
  return items.filter(item => isShopItemAvailable(item, persist));
}

export function buildShopOffer(persist, options = {}) {
  const count = options.count ?? 5;
  const rng = options.rng || Math.random;
  return availableShopItems(persist, options.items || SHOP_ITEMS)
    .map(item => ({ item, sort: rng() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, count)
    .map(({ item }) => ({
      ...item,
      currentCost: shopItemCost(item, persist),
    }));
}

export function canAffordShopItem(item, persist) {
  return (persist.reserve || 0) >= shopItemCost(item, persist);
}

// ── Live pack economy (Phase 12) ──
// The live market sells packs (pick-one-of-N contents), with rebuy price
// escalation, escalating refresh costs, and a rarity-weighted relic cache.

export const PACK_REBUY_INCREMENT = 8;
export const PACK_REFRESH_COSTS = Object.freeze([5, 8, 12, 17, 23]);

export function packCost(baseCost, timesBought = 0, relics = []) {
  return marketCostAfterRelics(baseCost + timesBought * PACK_REBUY_INCREMENT, relics);
}

export function packRefreshCost(refreshCount = 0) {
  return PACK_REFRESH_COSTS[Math.min(refreshCount, PACK_REFRESH_COSTS.length - 1)];
}

function shuffledByRng(values, rng) {
  return values.map(value => ({ value, sort: rng() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
}

export function buildPackOffer(packIds, options = {}) {
  const rng = options.rng || Math.random;
  const count = options.count ?? 3;
  return shuffledByRng([...packIds], rng).slice(0, count);
}

// One rare is guaranteed when available; the rest fill from commons, then
// rares, and the final order is shuffled.
export function buildRelicOffer(catalog, ownedRelicIds = [], options = {}) {
  const rng = options.rng || Math.random;
  const count = options.count ?? 4;
  const owned = new Set(ownedRelicIds);
  const available = catalog.filter(relic => !owned.has(relic.id));
  const common = shuffledByRng(available.filter(relic => relic.rarity !== 'rare').map(relic => relic.id), rng);
  const rare = shuffledByRng(available.filter(relic => relic.rarity === 'rare').map(relic => relic.id), rng);
  const picks = [];
  if (rare.length) picks.push(rare.shift());
  while (picks.length < count && common.length) picks.push(common.shift());
  while (picks.length < count && rare.length) picks.push(rare.shift());
  return shuffledByRng(picks, rng);
}

export function maxRelicSlots(upgrades = {}) {
  return 3 + Math.min(upgrades.relicSlot || 0, 2);
}

export function buyShopItem(persist, itemId) {
  const item = getShopItem(itemId);
  if (!item) return { persist, purchased: false, reason: 'missing_item' };
  if (!isShopItemAvailable(item, persist)) return { persist, purchased: false, reason: 'unavailable' };

  const cost = shopItemCost(item, persist);
  if ((persist.reserve || 0) < cost) return { persist, purchased: false, reason: 'too_expensive' };

  const nextPersist = {
    ...persist,
    reserve: (persist.reserve || 0) - cost,
    upgrades: { ...(persist.upgrades || {}) },
    relics: [...(persist.relics || [])],
  };

  if (item.type === SHOP_ITEM_TYPES.UPGRADE) {
    nextPersist.upgrades[item.upgradeKey] = (nextPersist.upgrades[item.upgradeKey] || 0) + 1;
  }

  if (item.type === SHOP_ITEM_TYPES.RELIC) {
    nextPersist.relics.push(item.relicId);
  }

  return {
    persist: nextPersist,
    purchased: true,
    item,
    cost,
  };
}
