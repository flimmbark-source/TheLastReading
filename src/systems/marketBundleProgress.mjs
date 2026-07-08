import {
  MARKET_BUNDLE_TRACK_ORDER,
  MARKET_BUNDLE_TRACKS,
  initialBundleProgressForTrack,
} from '../data/marketBundleTracks.mjs';

function cloneProgress(progress = {}) {
  const out = {};
  for (const trackId of MARKET_BUNDLE_TRACK_ORDER) {
    const track = MARKET_BUNDLE_TRACKS[trackId];
    const existing = progress?.[trackId] || {};
    const initial = initialBundleProgressForTrack(track);
    const claimedTier = Number.isFinite(existing.claimedTier) ? Math.max(0, Math.floor(existing.claimedTier)) : initial.claimedTier;
    out[trackId] = {
      total: Number.isFinite(existing.total) ? Math.max(0, Math.floor(existing.total)) : initial.total,
      claimedTier,
      nextThreshold: Number.isFinite(existing.nextThreshold)
        ? existing.nextThreshold
        : nextThreshold(track, claimedTier),
    };
  }
  return out;
}

export function normalizeMarketBundleProgress(overrides = {}) {
  return cloneProgress(overrides);
}

export function nextThreshold(trackConfig, claimedTier = 0) {
  if (!trackConfig || !Array.isArray(trackConfig.thresholds) || !trackConfig.thresholds.length) return null;
  const index = Math.max(0, Math.floor(Number(claimedTier) || 0));
  if (index < trackConfig.thresholds.length) return trackConfig.thresholds[index];
  const last = trackConfig.thresholds[trackConfig.thresholds.length - 1];
  const prev = trackConfig.thresholds[trackConfig.thresholds.length - 2] || Math.max(1, Math.floor(last / 2));
  const step = Math.max(1, last - prev);
  return last + step * (index - trackConfig.thresholds.length + 1);
}

export function completedTierForTotal(trackConfig, total = 0) {
  if (!trackConfig || !Array.isArray(trackConfig.thresholds)) return 0;
  let tier = 0;
  trackConfig.thresholds.forEach((threshold, index) => {
    if (total >= threshold) tier = index + 1;
  });

  if (trackConfig.thresholds.length && total >= trackConfig.thresholds[trackConfig.thresholds.length - 1]) {
    while (nextThreshold(trackConfig, tier) != null && total >= nextThreshold(trackConfig, tier)) tier += 1;
  }

  return tier;
}

function progressFromLedger(trackId, ledger) {
  switch (trackId) {
    case 'sequence':
      return ledger?.patterns?.sequenceMelds || 0;
    case 'court':
      return ledger?.patterns?.courtMelds || 0;
    case 'draw_discard':
      return ledger?.actions?.discardsUsed || 0;
    default:
      return 0;
  }
}

function existingBundleIds(persist) {
  return new Set([
    ...(persist.pendingRewardBundles || []).map(bundle => bundle.id),
    ...(persist.claimedRewardBundleIds || []),
  ]);
}

function uniqueBundleId(baseId, usedIds) {
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }
  let index = 2;
  while (usedIds.has(`${baseId}_${index}`)) index += 1;
  const id = `${baseId}_${index}`;
  usedIds.add(id);
  return id;
}

function createBundleFromTrack(trackConfig, tier, ledger, usedIds) {
  const baseId = `bundle_r${ledger?.reading || 1}_${trackConfig.id}_t${tier}`;
  return {
    id: uniqueBundleId(baseId, usedIds),
    bundleId: trackConfig.bundleId,
    trackId: trackConfig.id,
    tier,
    state: 'unopened',
    rewardKeys: null,
    claimedRewardKey: null,
    source: {
      ledgerId: ledger?.id || null,
      reading: ledger?.reading || 1,
      thresholdIndex: ledger?.thresholdIndex || 0,
      reason: `${trackConfig.label} Complete`,
    },
  };
}

export function advanceMarketBundleProgress(persist, ledger) {
  const progress = normalizeMarketBundleProgress(persist.marketBundleProgress);
  const pendingRewardBundles = [...(persist.pendingRewardBundles || [])];
  const usedIds = existingBundleIds(persist);
  const deltas = [];
  const generatedBundles = [];

  for (const trackId of MARKET_BUNDLE_TRACK_ORDER) {
    const trackConfig = MARKET_BUNDLE_TRACKS[trackId];
    const track = progress[trackId];
    const before = track.total || 0;
    const gained = Math.max(0, Math.floor(progressFromLedger(trackId, ledger)));
    const after = before + gained;
    const threshold = track.nextThreshold;
    const completedTier = completedTierForTotal(trackConfig, after);
    const completed = gained > 0 && completedTier > (track.claimedTier || 0);
    let bundle = null;

    track.total = after;

    if (completed) {
      bundle = createBundleFromTrack(trackConfig, completedTier, ledger, usedIds);
      track.claimedTier = completedTier;
      track.nextThreshold = nextThreshold(trackConfig, completedTier);
      pendingRewardBundles.push(bundle);
      generatedBundles.push(bundle);
    } else {
      track.nextThreshold = nextThreshold(trackConfig, track.claimedTier || 0);
    }

    if (gained > 0 || completed) {
      deltas.push({
        trackId,
        label: trackConfig.label,
        before,
        gained,
        after,
        threshold,
        nextThreshold: track.nextThreshold,
        completed,
        completedTier: completed ? completedTier : null,
        bundleId: bundle?.id || null,
      });
    }
  }

  return {
    persist: {
      ...persist,
      marketBundleProgress: progress,
      pendingRewardBundles,
    },
    deltas,
    generatedBundles,
  };
}
