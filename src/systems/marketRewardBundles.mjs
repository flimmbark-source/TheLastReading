import { SHOP } from '../data/legacyMarket.mjs';
import {
  MARKET_BUNDLE_REWARD_POOLS,
  MARKET_BUNDLES,
} from '../data/marketBundleTracks.mjs';

function cloneBundles(persist) {
  return (persist.pendingRewardBundles || []).map(bundle => ({
    ...bundle,
    rewardKeys: Array.isArray(bundle.rewardKeys) ? [...bundle.rewardKeys] : bundle.rewardKeys,
    source: bundle.source ? { ...bundle.source } : bundle.source,
  }));
}

function shuffled(values, rng = Math.random) {
  return [...values]
    .map(value => ({ value, sort: rng() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function rewardPoolForBundle(bundle) {
  const pools = MARKET_BUNDLE_REWARD_POOLS[bundle?.bundleId];
  if (!pools) return [];
  return bundle.tier > 1 ? pools.later || pools.common || [] : pools.common || [];
}

export function pendingBundleViews(persist) {
  return (persist.pendingRewardBundles || [])
    .filter(bundle => bundle.state !== 'claimed')
    .map(bundle => ({
      ...bundle,
      display: MARKET_BUNDLES[bundle.bundleId] || null,
    }));
}

export function openedBundleView(persist, bundleId) {
  const bundle = (persist.pendingRewardBundles || []).find(item => item.id === bundleId);
  if (!bundle || bundle.state === 'claimed') return null;
  return {
    ...bundle,
    display: MARKET_BUNDLES[bundle.bundleId] || null,
    rewards: (bundle.rewardKeys || []).map(key => ({ key, row: SHOP[key] })).filter(reward => reward.row),
  };
}

export function legalRewardKeysForBundle(persist, bundle, options = {}) {
  const shop = options.shop || SHOP;
  const exclude = new Set(options.excludeRewardKeys || []);
  const pool = rewardPoolForBundle(bundle);
  // `excludeRewardKeys` carries rewards that have no valid target right now —
  // chiefly stamp rewards when no eligible card exists. Every pool also holds
  // non-stamp rewards, so excluding stamps never empties a bundle.
  return pool.filter(key => Boolean(shop[key]) && !exclude.has(key));
}

export function openRewardBundle(persist, bundleInstanceId, options = {}) {
  const bundles = cloneBundles(persist);
  const index = bundles.findIndex(bundle => bundle.id === bundleInstanceId);
  if (index < 0) return persist;

  const bundle = bundles[index];
  if (bundle.state !== 'unopened') return persist;

  const choices = shuffled(legalRewardKeysForBundle(persist, bundle, options), options.rng || Math.random).slice(0, 3);
  bundles[index] = {
    ...bundle,
    state: 'opened',
    rewardKeys: choices,
  };

  return {
    ...persist,
    pendingRewardBundles: bundles,
  };
}

export function applyFreeShopReward(persist, rewardKey, options = {}) {
  const shop = options.shop || SHOP;
  const row = shop[rewardKey];
  if (!row) return { persist, applied: false, reason: 'missing_shop_key' };

  if (rewardKey === 'five_stamp') {
    return {
      persist: {
        ...persist,
        pendingCardChoice: { kind: 'five_stamp', rewardKey },
      },
      applied: true,
      rewardKey,
      requiresPicker: true,
    };
  }

  if (rewardKey === 'suit_stamp') {
    return {
      persist: {
        ...persist,
        pendingCardChoice: { kind: 'suit_stamp', rewardKey },
      },
      applied: true,
      rewardKey,
      requiresPicker: true,
    };
  }

  const pairedKey = row[6] || null;
  const upgrades = { ...(persist.upgrades || {}) };
  upgrades[rewardKey] = (upgrades[rewardKey] || 0) + 1;
  if (pairedKey) upgrades[pairedKey] = (upgrades[pairedKey] || 0) + 1;

  return {
    persist: { ...persist, upgrades },
    applied: true,
    rewardKey,
    pairedKey,
  };
}

export function claimRewardFromBundle(persist, bundleInstanceId, rewardKey, options = {}) {
  const bundles = cloneBundles(persist);
  const index = bundles.findIndex(bundle => bundle.id === bundleInstanceId);
  if (index < 0) return { persist, claimed: false, reason: 'missing_bundle' };

  const bundle = bundles[index];
  if (bundle.state !== 'opened') return { persist, claimed: false, reason: 'bundle_not_opened' };
  if (!Array.isArray(bundle.rewardKeys) || !bundle.rewardKeys.includes(rewardKey)) {
    return { persist, claimed: false, reason: 'missing_reward_choice' };
  }

  const applied = applyFreeShopReward(persist, rewardKey, options);
  if (!applied.applied) return { persist, claimed: false, reason: applied.reason || 'apply_failed' };

  bundles[index] = {
    ...bundle,
    state: 'claimed',
    claimedRewardKey: rewardKey,
  };

  const claimedRewardBundleIds = [...new Set([...(applied.persist.claimedRewardBundleIds || []), bundleInstanceId])];

  return {
    persist: {
      ...applied.persist,
      pendingRewardBundles: bundles,
      claimedRewardBundleIds,
    },
    claimed: true,
    rewardKey,
    pairedKey: applied.pairedKey || null,
    requiresPicker: !!applied.requiresPicker,
  };
}
