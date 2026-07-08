export const MARKET_BUNDLE_TRACK_IDS = Object.freeze({
  SEQUENCE: 'sequence',
  COURT: 'court',
  DRAW_DISCARD: 'draw_discard',
});

export const MARKET_BUNDLE_TRACKS = Object.freeze({
  sequence: {
    id: 'sequence',
    label: 'Sequence',
    thresholds: [2, 5, 10, 18, 30],
    bundleId: 'sequence_bundle',
    progressMetric: 'sequenceMelds',
  },

  court: {
    id: 'court',
    label: 'Court',
    thresholds: [2, 5, 9, 14, 20],
    bundleId: 'court_bundle',
    progressMetric: 'courtMelds',
  },

  draw_discard: {
    id: 'draw_discard',
    label: 'Draw/Discard',
    thresholds: [3, 8, 15, 25],
    bundleId: 'draw_discard_bundle',
    progressMetric: 'discardsUsed',
  },
});

export const MARKET_BUNDLE_TRACK_ORDER = Object.freeze(['sequence', 'court', 'draw_discard']);

export const MARKET_BUNDLES = Object.freeze({
  sequence_bundle: {
    id: 'sequence_bundle',
    trackId: 'sequence',
    name: 'Sequence Bundle',
    description: 'Open to reveal a Sequence reward.',
    categoryLabel: 'Bundle',
    icon: 'isp-pattern',
    accentClass: 'store-card--bundle-sequence',
  },

  court_bundle: {
    id: 'court_bundle',
    trackId: 'court',
    name: 'Court Bundle',
    description: 'Open to reveal a Court reward.',
    categoryLabel: 'Bundle',
    icon: 'isp-kin',
    accentClass: 'store-card--bundle-court',
  },

  draw_discard_bundle: {
    id: 'draw_discard_bundle',
    trackId: 'draw_discard',
    name: 'Restless Bundle',
    description: 'Open to reveal a Restless reward.',
    categoryLabel: 'Bundle',
    icon: 'isp-restless',
    accentClass: 'store-card--bundle-restless',
    sourcePackId: 'restless',
  },
});

export const MARKET_BUNDLE_REWARD_POOLS = Object.freeze({
  sequence_bundle: {
    common: ['sequence', 'five_stamp', 'first_light'],
    later: ['sequence', 'five_stamp', 'first_light', 'path_chips'],
  },

  court_bundle: {
    common: ['court_chips', 'royal_court_chips', 'suit_stamp'],
    later: ['court_chips', 'royal_court_chips', 'suit_stamp', 'rank'],
  },

  draw_discard_bundle: {
    common: ['discards', 'mulligan', 'nimble_fingers'],
    later: ['discards', 'mulligan', 'ritual_depth', 'nimble_fingers', 'quick_release'],
  },
});

export function trackForId(trackId) {
  return MARKET_BUNDLE_TRACKS[trackId] || null;
}

export function bundleForId(bundleId) {
  return MARKET_BUNDLES[bundleId] || null;
}

export function initialBundleProgressForTrack(track) {
  const firstThreshold = Array.isArray(track?.thresholds) && track.thresholds.length ? track.thresholds[0] : null;
  return {
    total: 0,
    claimedTier: 0,
    nextThreshold: firstThreshold,
  };
}
