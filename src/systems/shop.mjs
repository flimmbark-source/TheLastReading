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
