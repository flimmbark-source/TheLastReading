import { ACTIONS } from './actions.mjs';
import { createGameState, GAME_PHASES } from './state.mjs';
import { buildDeck, drawCards, shuffleDeck } from '../systems/deck.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { buyShopItem, maxRelicSlots } from '../systems/shop.mjs';
import { firstDiscardIsFree, hasRelic, startingHandBonusFromRelics, thresholdClearBonusFromRelics, worldCarryFromRelics } from '../systems/relics.mjs';
import { applyAbilityTake, applySearchTake, applyWorldReset, drawWithReshuffle, isSightAbility } from '../systems/abilities.mjs';
import { currentThreshold } from '../data/thresholds.mjs';
import { SETS_PER_ROUND, constellationForRound, activeConstellation, blocksDiscard, constellationThreshold, gateSatisfied, setHasScoringPattern } from '../systems/constellations.mjs';

function maxHand(persist) {
  return 5 + (persist.upgrades.hand || 0) - (hasRelic(persist.relics, 'fool_reversed') ? 1 : 0);
}

function startingDiscards(persist) {
  return 3 + (persist.upgrades.discards || 0);
}

function handSizeForSet(persist) {
  return maxHand(persist) + startingHandBonusFromRelics(persist.relics) + (persist.upgrades.deep_current || 0);
}

function replaceRun(state, patch) {
  return { ...state, run: { ...state.run, ...patch } };
}

function replacePersist(state, patch) {
  return { ...state, persist: { ...state.persist, ...patch } };
}

function drawFreshSetHand(run, persist, rng = Math.random, sourceDeck = null) {
  let deck = sourceDeck ? [...sourceDeck] : [...(run.deck || [])];
  let discard = [...(run.discard || []), ...(run.hand || []), ...(run.spread || []).filter(Boolean)];
  const hand = [];
  const target = handSizeForSet(persist);

  while (hand.length < target) {
    if (!deck.length) {
      if (!discard.length) break;
      deck = shuffleDeck(discard, rng || Math.random);
      discard = [];
    }
    hand.push(deck.shift());
  }

  return { hand, deck, discard };
}

function placeCard(state, slotIndex) {
  const { run } = state;
  if (run.selectedCardId == null || run.spread[slotIndex]) return state;

  const cardIndex = run.hand.findIndex(card => card.uid === run.selectedCardId);
  if (cardIndex < 0) return state;

  const hand = [...run.hand];
  const [card] = hand.splice(cardIndex, 1);
  const spread = [...run.spread];
  const firstCardInSet = spread.every(slot => !slot);
  spread[slotIndex] = card;

  const patch = {
    hand,
    spread,
    selectedCardId: null,
  };

  if (firstCardInSet && activeConstellation(run).id === 'unasked_question') {
    patch.untargetableCardIds = [...new Set([...(run.untargetableCardIds || []), card.uid])];
  }

  return replaceRun(state, patch);
}

function discardSelected(state) {
  const { run, persist } = state;
  if (run.selectedCardId == null) return state;
  if (blocksDiscard(run)) return state;

  const free = firstDiscardIsFree(persist.relics) && !run.freeDiscardUsed;
  if (!free && run.discards <= 0) return state;

  const hand = [...run.hand];
  const cardIndex = hand.findIndex(card => card.uid === run.selectedCardId);
  if (cardIndex < 0) return state;

  const [card] = hand.splice(cardIndex, 1);
  const tracksDiscarded = hasRelic(persist.relics, 'hanged_coin') || (persist.upgrades.quick_release || 0) > 0;
  const sightFree = !free && Boolean(card.ability) && isSightAbility(card.ability)
    && (run.sightChargesUsed || 0) < (persist.upgrades.sight_cost || 0);

  return replaceRun(state, {
    hand,
    discard: [...run.discard, card],
    discardedCards: tracksDiscarded ? [...run.discardedCards, card] : run.discardedCards,
    selectedCardId: null,
    freeDiscardUsed: run.freeDiscardUsed || free,
    sightChargesUsed: (run.sightChargesUsed || 0) + (sightFree ? 1 : 0),
    discards: free || sightFree ? run.discards : run.discards - 1,
    roundDiscardCount: (run.roundDiscardCount || 0) + 1,
    lastDiscardedCard: card,
  });
}

function scoringContext(run) {
  return {
    handCount: run.hand.length,
    discardedCount: run.discardedCards.length,
    discardedCards: run.discardedCards,
    abilityTakenCardIds: run.abilityTakenCardIds,
    resonationBonus: run.resonationBonus,
    worldCarry: run.worldCarry,
    constellationId: run.constellationId,
  };
}

function scoreReading(state) {
  const { run, persist } = state;
  const cards = run.spread.filter(Boolean);
  const score = computeScore(cards, {
    upgrades: persist.upgrades,
    relics: persist.relics,
    context: scoringContext(run),
  });

  const threshold = constellationThreshold(currentThreshold(run.thresholdIndex, run.thresholdBonus), run);
  const roundScore = (run.roundScore || 0) + score.finalScore;
  const setScores = [...(run.setScores || []), score.finalScore];
  const roundPatternCount = (run.roundPatternCount || 0) + (setHasScoringPattern(score) ? 1 : 0);
  const passed = roundScore >= threshold && gateSatisfied(run, roundPatternCount);
  const setNumber = (run.setIndex || 0) + 1;
  const setsPerRound = run.setsPerRound || SETS_PER_ROUND;

  const common = {
    lastScore: score,
    lastSetScore: score,
    lastThreshold: threshold,
    roundScore,
    setScores,
    roundPatternCount,
  };

  if (passed) {
    const miserBonus = thresholdClearBonusFromRelics(persist.relics);
    return replacePersist(
      replaceRun(state, {
        ...common,
        phase: GAME_PHASES.MARKET,
        thresholdIndex: run.thresholdIndex + 1,
        lastPassed: true,
        lastOutcome: 'pass',
        awaitingNextSet: false,
        pendingReserve: (run.pendingReserve || 0) + roundScore + miserBonus,
        worldCarry: worldCarryFromRelics(persist.relics, roundScore, threshold),
        relicEarned: false,
      }),
      {
        totalScore: persist.totalScore + roundScore,
      }
    );
  }

  if (setNumber < setsPerRound) {
    return replaceRun(state, {
      ...common,
      phase: GAME_PHASES.SCORING,
      lastPassed: false,
      lastOutcome: 'nextSet',
      awaitingNextSet: true,
    });
  }

  return replaceRun(state, {
    ...common,
    phase: GAME_PHASES.SESSION_END,
    lastPassed: false,
    lastOutcome: 'fail',
    awaitingNextSet: false,
  });
}

function startNextSet(state, rng = Math.random) {
  const { run, persist } = state;
  if (!run.awaitingNextSet) return state;
  const next = drawFreshSetHand(run, persist, rng);
  return replaceRun(state, {
    phase: GAME_PHASES.TABLE,
    deck: next.deck,
    hand: next.hand,
    discard: next.discard,
    spread: Array(5).fill(null),
    selectedCardId: null,
    setIndex: (run.setIndex || 0) + 1,
    awaitingNextSet: false,
    lastOutcome: null,
    ability: null,
    sourceCardId: null,
    busy: false,
    purge: null,
    abilityTakenCardIds: [],
    resonationBonus: null,
    discards: startingDiscards(persist),
    freeDiscardUsed: false,
    sightChargesUsed: 0,
  });
}

function flushHand(state, rng = Math.random) {
  const { run, persist } = state;
  const allCards = [
    ...(run.deck || []),
    ...(run.discard || []),
    ...(run.hand || []),
    ...(run.spread || []).filter(Boolean),
  ];
  const shuffled = shuffleDeck(allCards, rng);
  const handSize = handSizeForSet(persist);
  const hand = shuffled.splice(0, handSize);
  return replaceRun(state, {
    hand,
    deck: shuffled,
    discard: [],
    spread: Array(5).fill(null),
    selectedCardId: null,
    thresholdBonus: (run.thresholdBonus || 0) + 10,
    ability: null,
    sourceCardId: null,
    busy: false,
    abilityTakenCardIds: [],
    resonationBonus: null,
  });
}

function buyMarketItem(state, itemId) {
  const purchase = buyShopItem(state.persist, itemId);
  if (!purchase.purchased) {
    return replaceRun(state, { lastPurchase: purchase });
  }

  return {
    ...state,
    persist: purchase.persist,
    run: {
      ...state.run,
      lastPurchase: purchase,
    },
  };
}

function buyMarketPurchase(state, purchase) {
  const { persist } = state;
  const reject = reason => replaceRun(state, { lastPurchase: { purchased: false, reason, purchase } });

  switch (purchase.kind) {
    case 'pack': {
      const cost = purchase.cost || 0;
      if ((persist.reserve || 0) < cost) return reject('too_expensive');
      return replaceRun(
        replacePersist(state, { reserve: persist.reserve - cost }),
        { lastPurchase: { purchased: true, kind: 'pack', packId: purchase.packId ?? null, cost } }
      );
    }

    case 'upgrade': {
      if (!purchase.upgradeKey) return reject('missing_upgrade');
      const upgrades = { ...persist.upgrades };
      upgrades[purchase.upgradeKey] = (upgrades[purchase.upgradeKey] || 0) + 1;
      if (purchase.pairedKey) upgrades[purchase.pairedKey] = (upgrades[purchase.pairedKey] || 0) + 1;
      return replaceRun(
        replacePersist(state, { upgrades }),
        { lastPurchase: { purchased: true, kind: 'upgrade', upgradeKey: purchase.upgradeKey, cost: 0 } }
      );
    }

    case 'relic': {
      if (persist.relics.includes(purchase.relicId)) return reject('duplicate_relic');
      let relics;
      if (purchase.replaceRelicId != null) {
        const index = persist.relics.indexOf(purchase.replaceRelicId);
        if (index < 0) return reject('missing_replaced_relic');
        relics = [...persist.relics];
        relics.splice(index, 1, purchase.relicId);
      } else {
        if (persist.relics.length >= maxRelicSlots(persist.upgrades)) return reject('relic_slots_full');
        relics = [...persist.relics, purchase.relicId];
      }
      return replaceRun(
        replacePersist(state, { relics }),
        { lastPurchase: { purchased: true, kind: 'relic', relicId: purchase.relicId, cost: 0 } }
      );
    }

    default:
      return reject('unknown_purchase');
  }
}

function startAbilityAction(state, action) {
  const rawAbility = action.ability ?? action.abilityId;
  const baseAbility = rawAbility && typeof rawAbility === 'object'
    ? { ...rawAbility }
    : { id: rawAbility };
  const abilityId = baseAbility.id ?? action.abilityId;
  if (!abilityId) return state;
  const sourceCardId = action.sourceCardId ?? baseAbility.sourceCardId ?? null;
  return replaceRun(state, {
    ability: { ...baseAbility, id: abilityId, sourceCardId },
    sourceCardId,
    busy: true,
  });
}

function resolveAbilityAction(state, action) {
  const { run, persist } = state;
  const result = action.result || {};
  const base = { ability: null, sourceCardId: null, busy: false };

  switch (result.kind) {
    case 'draw': {
      const next = drawWithReshuffle(run, result.count || 0, action.rng);
      return replaceRun(state, { ...base, deck: next.deck, discard: next.discard, hand: next.hand });
    }

    case 'take': {
      const applied = applyAbilityTake(run, result.heldCards || [], result.takenCardId);
      if (!applied) return replaceRun(state, base);
      const patch = {
        ...base,
        deck: applied.deck,
        hand: applied.hand,
        abilityTakenCardIds: [...(run.abilityTakenCardIds || []), applied.taken.uid],
      };
      if (result.threadBond && (persist.upgrades.relation_chips || 0)) {
        const bonus = run.resonationBonus || { chips: 0, mult: 0 };
        patch.resonationBonus = { ...bonus, chips: (bonus.chips || 0) + persist.upgrades.relation_chips, name: 'Thread Bond' };
      }
      return replaceRun(state, patch);
    }

    case 'search': {
      const applied = applySearchTake(run, result.takenCardId, action.rng);
      if (!applied) return replaceRun(state, base);
      return replaceRun(state, {
        ...base,
        deck: applied.deck,
        hand: applied.hand,
        abilityTakenCardIds: [...(run.abilityTakenCardIds || []), applied.taken.uid],
      });
    }

    case 'world': {
      const next = applyWorldReset(run, result.handSize || 0, action.rng);
      return replaceRun(state, { ...base, deck: next.deck, discard: next.discard, hand: next.hand });
    }

    default:
      return replaceRun(state, base);
  }
}

function syncLegacySnapshot(state, snapshot) {
  return replaceRun(state, {
    legacySnapshot: snapshot || {},
    legacySnapshotSyncedAt: Date.now(),
  });
}

function resetSession(state, fresh = false) {
  if (fresh) return createGameState();
  const keepUpgrades = { hand: state.persist.upgrades.hand || 0 };
  return createGameState({
    persist: {
      upgrades: keepUpgrades,
      obals: state.persist.obals,
      unlockedFragments: state.persist.unlockedFragments,
      discoveredArchiveItems: state.persist.discoveredArchiveItems,
      seenTutorials: state.persist.seenTutorials,
    },
  });
}

const LEGACY_RUN_FIELDS = [
  'deck', 'hand', 'discard', 'spread', 'selectedCardId', 'discards', 'discardedCards',
  'freeDiscardUsed', 'sightChargesUsed', 'thresholdIndex', 'thresholdBonus',
  'thresholdBonusPending', 'reading', 'pendingReserve', 'worldCarry',
  'abilityTakenCardIds', 'resonationBonus', 'setIndex', 'setsPerRound', 'roundScore',
  'setScores', 'roundDiscardCount', 'roundPatternCount', 'constellationId',
  'untargetableCardIds', 'awaitingNextSet', 'lastOutcome',
];

function syncLegacyRun(state, run = {}) {
  const patch = {};
  for (const field of LEGACY_RUN_FIELDS) {
    if (field in run) patch[field] = run[field];
  }
  if (run.lastScore) patch.lastScore = run.lastScore;
  if (run.lastSetScore) patch.lastSetScore = run.lastSetScore;
  if ('lastThreshold' in run) patch.lastThreshold = run.lastThreshold;
  if ('lastPassed' in run) patch.lastPassed = run.lastPassed;
  if ('relicEarned' in run) patch.relicEarned = run.relicEarned;
  return replaceRun(state, patch);
}

function syncLegacyPersist(state, persist = {}) {
  const next = {};
  if ('reserve' in persist) next.reserve = persist.reserve;
  if ('totalScore' in persist) next.totalScore = persist.totalScore;
  if ('upgrades' in persist) next.upgrades = { ...persist.upgrades };
  if ('relics' in persist) next.relics = [...persist.relics];
  if ('relicUsed' in persist) next.relicUsed = { ...persist.relicUsed };
  if ('obals' in persist) next.obals = persist.obals;
  if ('unlockedFragments' in persist) next.unlockedFragments = [...persist.unlockedFragments];
  if ('discoveredArchiveItems' in persist) next.discoveredArchiveItems = [...persist.discoveredArchiveItems];
  if ('seenTutorials' in persist) next.seenTutorials = { ...persist.seenTutorials };
  return replacePersist(state, next);
}

function startReading(state, deck, rng = Math.random) {
  const { persist, run } = state;
  const nextDeck = deck ? [...deck] : shuffleDeck(buildDeck(), rng);
  const handSize = handSizeForSet(persist);
  const { drawn: hand, deck: remainingDeck } = drawCards(nextDeck, handSize);
  const offeringReserve = (persist.upgrades.offering || 0) * 5;
  const constellation = constellationForRound(run.thresholdIndex || 0, rng);
  return replacePersist(
    replaceRun(state, {
      phase: GAME_PHASES.TABLE,
      deck: remainingDeck,
      hand,
      discard: [],
      spread: Array(5).fill(null),
      selectedCardId: null,
      setIndex: 0,
      setsPerRound: SETS_PER_ROUND,
      roundScore: 0,
      setScores: [],
      roundDiscardCount: 0,
      roundPatternCount: 0,
      constellationId: constellation.id,
      untargetableCardIds: [],
      awaitingNextSet: false,
      lastOutcome: null,
      discards: startingDiscards(persist),
      mulliganCharges: persist.upgrades.mulligan || 0,
      ability: null,
      sourceCardId: null,
      busy: false,
      freeDiscardUsed: false,
      sightChargesUsed: 0,
      discardedCards: [],
      abilityTakenCardIds: [],
      resonationBonus: null,
      thresholdBonus: (run.thresholdBonus || 0) + (run.thresholdBonusPending || 0),
      thresholdBonusPending: 0,
      worldCarry: run.worldCarry || 0,
      relicEarned: false,
    }),
    { reserve: (persist.reserve || 0) + offeringReserve }
  );
}

function leaveMarket(state) {
  return replaceRun(state, {
    phase: GAME_PHASES.TABLE,
    pendingReserve: 0,
    worldCarry: runWorldCarry(state.run),
    reading: state.run.reading + 1,
    relicEarned: false,
  });
}

function runWorldCarry(run) {
  return run.worldCarry || 0;
}

function unlockFragment(state, fragmentId) {
  if (!fragmentId || state.persist.unlockedFragments.includes(fragmentId)) return state;
  return replacePersist(state, { unlockedFragments: [...state.persist.unlockedFragments, fragmentId] });
}

function discoverArchiveItem(state, itemId) {
  if (!itemId || state.persist.discoveredArchiveItems.includes(itemId)) return state;
  return replacePersist(state, { discoveredArchiveItems: [...state.persist.discoveredArchiveItems, itemId] });
}

export function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.START_READING:
      return startReading(state, action.deck || null, action.rng || Math.random);
    case ACTIONS.START_NEXT_SET:
      return startNextSet(state, action.rng || Math.random);
    case ACTIONS.SELECT_CARD:
      return replaceRun(state, { selectedCardId: action.cardId });
    case ACTIONS.CLEAR_SELECTION:
      return replaceRun(state, { selectedCardId: null });
    case ACTIONS.PLACE_CARD:
      return placeCard(state, action.slotIndex);
    case ACTIONS.DISCARD_SELECTED:
      return discardSelected(state);
    case ACTIONS.RESOLVE_ABILITY:
      return resolveAbilityAction(state, action);
    case ACTIONS.START_ABILITY:
      return startAbilityAction(state, action);
    case ACTIONS.CANCEL_ABILITY:
      return replaceRun(state, { ability: null, sourceCardId: null, busy: false });
    case ACTIONS.SCORE_READING:
      return scoreReading(state);
    case ACTIONS.BUY_MARKET_ITEM:
      if (action.itemId) return buyMarketItem(state, action.itemId);
      return buyMarketPurchase(state, action.purchase || {});
    case ACTIONS.LEAVE_MARKET:
      return leaveMarket(state);
    case ACTIONS.ENTER_ATTIC:
      return replacePersist(replaceRun(state, { phase: GAME_PHASES.ATTIC }), { obals: action.obals ?? state.persist.obals });
    case ACTIONS.LEAVE_ATTIC:
      return replaceRun(state, { phase: GAME_PHASES.TABLE });
    case ACTIONS.UNLOCK_FRAGMENT:
      return unlockFragment(state, action.fragmentId);
    case ACTIONS.DISCOVER_ARCHIVE_ITEM:
      return discoverArchiveItem(state, action.itemId);
    case ACTIONS.SYNC_LEGACY_RUN:
      return syncLegacyRun(state, action.run);
    case ACTIONS.SYNC_LEGACY_PERSIST:
      return syncLegacyPersist(state, action.persist);
    case ACTIONS.SYNC_LEGACY_SNAPSHOT:
      return syncLegacySnapshot(state, action.snapshot);
    case ACTIONS.END_SESSION:
      return replacePersist(
        replaceRun(state, { phase: GAME_PHASES.SESSION_END, lastSessionScore: action.totalScore ?? state.persist.totalScore, lastSessionObals: action.obals ?? state.persist.obals }),
        { totalScore: action.totalScore ?? state.persist.totalScore, obals: action.obals ?? state.persist.obals }
      );
    case ACTIONS.FLUSH_HAND:
      return flushHand(state, action.rng || Math.random);
    case ACTIONS.RESET_SESSION:
      return resetSession(state, !!action.fresh);
    default:
      return state;
  }
}