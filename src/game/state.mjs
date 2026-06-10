import { DEFAULT_UPGRADES } from '../data/scoringPatterns.mjs';

export const GAME_PHASES = Object.freeze({
  TABLE: 'table',
  ABILITY: 'ability',
  SCORING: 'scoring',
  MARKET: 'market',
  ATTIC: 'attic',
  SESSION_END: 'sessionEnd',
});

export function createInitialPersistState(overrides = {}) {
  return {
    reserve: 0,
    totalScore: 0,
    upgrades: { ...DEFAULT_UPGRADES, ...(overrides.upgrades || {}) },
    relics: [...(overrides.relics || [])],
    relicUsed: { ...(overrides.relicUsed || {}) },
    discoveredArchiveItems: [...(overrides.discoveredArchiveItems || [])],
    unlockedFragments: [...(overrides.unlockedFragments || [])],
    seenTutorials: { ...(overrides.seenTutorials || {}) },
    obals: overrides.obals || 0,
  };
}

export function createInitialRunState(overrides = {}) {
  return {
    phase: GAME_PHASES.TABLE,
    deck: [],
    hand: [],
    discard: [],
    spread: Array(5).fill(null),
    selectedCardId: null,
    reading: 1,
    thresholdIndex: 0,
    thresholdBonus: 0,
    thresholdBonusPending: 0,
    discards: 3,
    mulliganCharges: 0,
    busy: false,
    ability: null,
    purge: null,
    pendingReserve: 0,
    freeDiscardUsed: false,
    discardedCards: [],
    worldCarry: 0,
    abilityTakenCardIds: [],
    resonationBonus: null,
    ...overrides,
  };
}

export function createGameState(overrides = {}) {
  return {
    run: createInitialRunState(overrides.run),
    persist: createInitialPersistState(overrides.persist),
  };
}
