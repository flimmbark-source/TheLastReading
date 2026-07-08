export const MARKET_BUNDLE_TRACK_IDS = Object.freeze({
  RESTLESS: 'restless',
  STILLNESS: 'stillness',
  SEQUENCE: 'sequence',
  ECHO: 'echo',
  COURT: 'court',
});

export const MARKET_BUNDLE_AXES = Object.freeze({
  intervention: {
    id: 'intervention',
    label: 'Intervention',
    mode: 'dominant',
    tracks: ['restless', 'stillness'],
  },

  pattern: {
    id: 'pattern',
    label: 'Pattern',
    mode: 'dominant',
    tracks: ['sequence', 'echo'],
  },
});

export const MARKET_BUNDLE_TRACKS = Object.freeze({
  restless: {
    id: 'restless',
    label: 'Restless',
    axisId: 'intervention',
    thresholds: [3, 7, 12, 18, 25],
    bundleId: 'restless_bundle',
    capPerReading: 4,
  },

  stillness: {
    id: 'stillness',
    label: 'Stillness',
    axisId: 'intervention',
    thresholds: [3, 7, 12, 18, 25],
    bundleId: 'stillness_bundle',
    capPerReading: 4,
  },

  sequence: {
    id: 'sequence',
    label: 'Sequence',
    axisId: 'pattern',
    thresholds: [2, 5, 10, 18, 30],
    bundleId: 'sequence_bundle',
    capPerReading: 3,
  },

  echo: {
    id: 'echo',
    label: 'Echo',
    axisId: 'pattern',
    thresholds: [2, 5, 10, 18, 30],
    bundleId: 'echo_bundle',
    capPerReading: 3,
  },

  court: {
    id: 'court',
    label: 'Court',
    axisId: null,
    thresholds: [4, 9, 15, 24],
    bundleId: 'court_bundle',
    capPerReading: 5,
  },
});

export const MARKET_BUNDLE_TRACK_ORDER = Object.freeze(['restless', 'stillness', 'sequence', 'echo', 'court']);
export const MARKET_BUNDLE_AXIS_ORDER = Object.freeze(['intervention', 'pattern']);
export const MARKET_BUNDLE_MAX_BUNDLES_PER_READING = 2;

export const MARKET_BUNDLES = Object.freeze({
  restless_bundle: {
    id: 'restless_bundle',
    trackId: 'restless',
    name: 'Restless Bundle',
    description: 'Choose a reward for changing the reading.',
    categoryLabel: 'Bundle',
    icon: 'isp-restless',
    accentClass: 'store-card--bundle-restless',
    sourcePackId: 'restless',
  },

  stillness_bundle: {
    id: 'stillness_bundle',
    trackId: 'stillness',
    name: 'Stillness Bundle',
    description: 'Choose a reward for preserving the reading.',
    categoryLabel: 'Bundle',
    icon: 'isp-scoring',
    accentClass: 'store-card--bundle-stillness',
  },

  sequence_bundle: {
    id: 'sequence_bundle',
    trackId: 'sequence',
    name: 'Sequence Bundle',
    description: 'Choose a reward for ordered patterns.',
    categoryLabel: 'Bundle',
    icon: 'isp-pattern',
    accentClass: 'store-card--bundle-sequence',
  },

  echo_bundle: {
    id: 'echo_bundle',
    trackId: 'echo',
    name: 'Echo Bundle',
    description: 'Choose a reward for repeated ranks.',
    categoryLabel: 'Bundle',
    icon: 'isp-scoring',
    accentClass: 'store-card--bundle-echo',
  },

  court_bundle: {
    id: 'court_bundle',
    trackId: 'court',
    name: 'Court Bundle',
    description: 'Choose a reward for Court cards.',
    categoryLabel: 'Bundle',
    icon: 'isp-kin',
    accentClass: 'store-card--bundle-court',
  },
});

export const MARKET_BUNDLE_REWARD_POOLS = Object.freeze({
  restless_bundle: {
    tier1: {
      core: ['quick_release'],
      tool: ['discards', 'mulligan'],
      bridge: ['nimble_fingers', 'ritual_depth'],
    },
    tier2: {
      core: ['quick_release'],
      tool: ['discards', 'mulligan', 'nimble_fingers'],
      bridge: ['ritual_depth'],
    },
  },

  stillness_bundle: {
    tier1: {
      core: ['patient_reading'],
      tool: ['blessed_start', 'first_answer'],
      bridge: ['first_light'],
    },
    tier2: {
      core: ['patient_reading'],
      tool: ['blessed_start', 'first_answer'],
      bridge: ['first_light'],
    },
  },

  sequence_bundle: {
    tier1: {
      core: ['sequence'],
      tool: ['five_stamp', 'first_light'],
      bridge: ['path_chips'],
    },
    tier2: {
      core: ['sequence', 'path_chips'],
      tool: ['five_stamp', 'first_light'],
      bridge: ['rank'],
    },
  },

  echo_bundle: {
    tier1: {
      core: ['rank'],
      tool: ['familiar_face'],
      bridge: ['court_favor'],
    },
    tier2: {
      core: ['rank'],
      tool: ['familiar_face'],
      bridge: ['court_favor', 'sequence'],
    },
  },

  court_bundle: {
    tier1: {
      core: ['court_chips'],
      tool: ['suit_stamp', 'court_favor'],
      bridge: ['royal_court_chips'],
    },
    tier2: {
      core: ['court_chips', 'royal_court_chips'],
      tool: ['suit_stamp', 'court_favor'],
      bridge: ['rank'],
    },
  },
});

export function trackForId(trackId) {
  return MARKET_BUNDLE_TRACKS[trackId] || null;
}

export function bundleForId(bundleId) {
  return MARKET_BUNDLES[bundleId] || null;
}

export function initialBundleProgressForTrack(track) {
  return {
    total: 0,
    claimedTier: 0,
    nextThreshold: track?.thresholds?.[0] ?? null,
  };
}
