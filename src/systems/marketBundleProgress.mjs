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

function capped(trackId, value) {
  const cap = MARKET_BUNDLE_TRACKS[trackId]?.capPerReading;
  const clean = Math.max(0, Math.floor(value || 0));
  return Number.isFinite(cap) ? Math.min(cap, clean) : clean;
}

function unusedDiscards(actions = {}) {
  const initial = Number.isFinite(actions.initialDiscards) ? actions.initialDiscards : 0;
  const used = Number.isFinite(actions.discardsUsed) ? actions.discardsUsed : 0;
  return Math.max(0, initial - used);
}

function trackScore(trackId, ledger) {
  const reasons = [];
  let raw = 0;

  switch (trackId) {
    case 'restless': {
      const discards = ledger?.actions?.discardsUsed || 0;
      const abilityTaken = ledger?.actions?.abilityTakenCards || 0;
      const mulligans = ledger?.actions?.mulligansUsed || 0;
      const totalInterventions = discards + abilityTaken + mulligans;
      if (discards >= 2) {
        raw += 1;
        reasons.push(`${discards} Discards used`);
      }
      if (abilityTaken >= 2) {
        raw += 1;
        reasons.push(`${abilityTaken} cards taken by abilities`);
      }
      if (ledger?.actions?.allDiscardsUsed) {
        raw += 1;
        reasons.push('All Discards used');
      }
      if (totalInterventions >= 4) {
        raw += 1;
        reasons.push(`${totalInterventions} total interventions`);
      }
      break;
    }

    case 'stillness': {
      const discards = ledger?.actions?.discardsUsed || 0;
      const abilityTaken = ledger?.actions?.abilityTakenCards || 0;
      const openingInSpread = ledger?.cards?.openingHandCardsInSpread || 0;
      const remaining = unusedDiscards(ledger?.actions || {});
      if (abilityTaken === 0 && discards <= 1) {
        raw += 1;
        reasons.push(discards === 0 ? 'No Discards used' : 'Only 1 Discard used');
      }
      if (abilityTaken === 0) {
        raw += 1;
        reasons.push('No ability-taken cards');
      }
      if (openingInSpread >= 3) {
        raw += 1;
        reasons.push(`${openingInSpread} cards from opening hand`);
      }
      if (abilityTaken === 0 && remaining >= 2) {
        raw += 1;
        reasons.push(`${remaining} unused Discards`);
      }
      break;
    }

    case 'sequence': {
      const best = ledger?.patterns?.sequenceBestLength || 0;
      if (best >= 5) {
        raw += 3;
        reasons.push('5-card Sequence scored');
      } else if (best >= 4) {
        raw += 2;
        reasons.push('4-card Sequence scored');
      } else if (best >= 3) {
        raw += 1;
        reasons.push('3-card Sequence scored');
      }
      break;
    }

    case 'echo': {
      const best = ledger?.patterns?.echoBestKind || 0;
      if (best >= 4 || ledger?.patterns?.hasFourOfKind) {
        raw += 3;
        reasons.push('Four of a Kind scored');
      } else if (best >= 3 || ledger?.patterns?.hasThreeOfKind) {
        raw += 2;
        reasons.push('Three of a Kind scored');
      } else if (best >= 2 || ledger?.patterns?.hasPair) {
        raw += 1;
        reasons.push('Pair formed');
      }
      break;
    }

    case 'court': {
      const courts = ledger?.cards?.courtsInSpread ?? ledger?.cards?.courtsPlaced ?? 0;
      const full = ledger?.patterns?.fullCourtMelds || 0;
      const royal = ledger?.patterns?.royalCourtMelds || 0;
      if (courts > 0) {
        raw += courts;
        reasons.push(`${courts} Court card${courts === 1 ? '' : 's'} placed`);
      }
      if (full > 0) {
        raw += 2;
        reasons.push('Full Court scored');
      }
      if (royal > 0) {
        raw += 3;
        reasons.push('Royal Court scored');
      }
      break;
    }

    default:
      break;
  }

  return {
    raw,
    gained: capped(trackId, raw),
    reasons,
  };
}

export function evaluateMarketBundleTracks(ledger) {
  const raw = {};
  const awarded = {};
  for (const trackId of MARKET_BUNDLE_TRACK_ORDER) {
    const score = trackScore(trackId, ledger);
    raw[trackId] = score;
    if (score.gained > 0) awarded[trackId] = score;
  }
  return { raw, awarded };
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

function createBundleFromTrack(trackConfig, tier, ledger, usedIds, reasons = []) {
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
      reasons: [...reasons],
    },
  };
}

export function advanceMarketBundleProgress(persist, ledger) {
  const progress = normalizeMarketBundleProgress(persist.marketBundleProgress);
  const pendingRewardBundles = [...(persist.pendingRewardBundles || [])];
  const usedIds = existingBundleIds(persist);
  const deltas = [];
  const generatedBundles = [];
  const { awarded } = evaluateMarketBundleTracks(ledger);

  for (const trackId of MARKET_BUNDLE_TRACK_ORDER) {
    const score = awarded[trackId];
    if (!score || score.gained <= 0) continue;

    const trackConfig = MARKET_BUNDLE_TRACKS[trackId];
    const track = progress[trackId];
    const before = track.total || 0;
    const gained = Math.max(0, Math.floor(score.gained));
    const after = before + gained;
    const threshold = track.nextThreshold;
    const completedTier = completedTierForTotal(trackConfig, after);
    const previousTier = track.claimedTier || 0;
    const completed = completedTier > previousTier;

    track.total = after;

    const delta = {
      trackId,
      label: trackConfig.label,
      before,
      gained,
      raw: score.raw || gained,
      reasons: [...(score.reasons || [])],
      after,
      threshold,
      nextThreshold: nextThreshold(trackConfig, previousTier),
      completed: false,
      completedTier: completed ? completedTier : null,
      bundleId: null,
      bundleIds: [],
      deferred: false,
    };

    if (completed) {
      for (let tier = previousTier + 1; tier <= completedTier; tier += 1) {
        const bundle = createBundleFromTrack(trackConfig, tier, ledger, usedIds, score.reasons || []);
        pendingRewardBundles.push(bundle);
        generatedBundles.push(bundle);
        delta.bundleIds.push(bundle.id);
        if (!delta.bundleId) delta.bundleId = bundle.id;
      }
      track.claimedTier = completedTier;
      track.nextThreshold = nextThreshold(trackConfig, completedTier);
      delta.completed = true;
      delta.nextThreshold = track.nextThreshold;
    } else {
      track.nextThreshold = nextThreshold(trackConfig, previousTier);
      delta.nextThreshold = track.nextThreshold;
    }

    deltas.push(delta);
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
