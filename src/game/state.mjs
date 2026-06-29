import { DEFAULT_UPGRADES } from '../data/scoringPatterns.mjs';
import { SETS_PER_ROUND } from '../data/constellations.mjs';

export const GAME_PHASES = Object.freeze({
  TABLE: 'table',
  ABILITY: 'ability',
  SCORING: 'scoring',
  MARKET: 'market',
  ATTIC: 'attic',
  SESSION_END: 'sessionEnd',
});

function numberOr(defaultValue, value) {
  return Number.isFinite(value) ? value : defaultValue;
}

export function createInitialPersistState(overrides = {}) {
  return {
    reserve: numberOr(0, overrides.reserve),
    totalScore: numberOr(0, overrides.totalScore),
    upgrades: { ...DEFAULT_UPGRADES, ...(overrides.upgrades || {}) },
    relics: [...(overrides.relics || [])],
    relicUsed: { ...(overrides.relicUsed || {}) },
    discoveredArchiveItems: [...(overrides.discoveredArchiveItems || [])],
    unlockedFragments: [...(overrides.unlockedFragments || [])],
    seenTutorials: { ...(overrides.seenTutorials || {}) },
    obals: numberOr(0, overrides.obals),
    stampedMajors: [...(overrides.stampedMajors || [])],
    stampedFive: [...(overrides.stampedFive || [])],
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
    setIndex: 0,
    setsPerRound: SETS_PER_ROUND,
    roundScore: 0,
    setScores: [],
    roundDiscardCount: 0,
    roundPatternCount: 0,
    constellationId: null,
    untargetableCardIds: [],
    awaitingNextSet: false,
    lastOutcome: null,
    discards: 3,
    mulliganCharges: 0,
    busy: false,
    ability: null,
    purge: null,
    pendingReserve: 0,
    freeDiscardUsed: false,
    sightChargesUsed: 0,
    lastDiscardedCard: null,
    discardedCards: [],
    worldCarry: 0,
    relicEarned: false,
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
