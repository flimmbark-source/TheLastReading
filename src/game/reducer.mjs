import { ACTIONS } from './actions.mjs';
import { createGameState, GAME_PHASES } from './state.mjs';
import { buildDeck, drawCards, shuffleDeck } from '../systems/deck.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { buyShopItem, maxRelicSlots } from '../systems/shop.mjs';
import { firstDiscardIsFree, hasRelic, startingHandBonusFromRelics, thresholdClearBonusFromRelics, worldCarryFromRelics } from '../systems/relics.mjs';
import { applyAbilityTake, applySearchTake, applyWorldReset, drawWithReshuffle, isSightAbility } from '../systems/abilities.mjs';
import { currentThreshold } from '../data/thresholds.mjs';

function maxHand(persist) {
  return 5 + (persist.upgrades.hand || 0) - (hasRelic(persist.relics, 'fool_reversed') ? 1 : 0);
}

function startingDiscards(persist) {
  return 3 + (persist.upgrades.discards || 0);
}

function replaceRun(state, patch) {
  return { ...state, run: { ...state.run, ...patch } };
}

function replacePersist(state, patch) {
  return { ...state, persist: { ...state.persist, ...patch } };
}

function placeCard(state, slotIndex) {
  const { run } = state;
  if (run.selectedCardId == null || run.spread[slotIndex]) return state;

  const cardIndex = run.hand.findIndex(card => card.uid === run.selectedCardId);
  if (cardIndex < 0) return state;

  const hand = [...run.hand];
  const [card] = hand.splice(cardIndex, 1);
  const spread = [...run.spread];
  spread[slotIndex] = card;

  return replaceRun(state, {
    hand,
    spread,
    selectedCardId: null,
  });
}

// Discarding a card removes it from hand, banks it, and spends a discard
// charge unless the Gilded Discard relic (first discard free) or a sight_cost
// upgrade charge (peek/search/mirror abilities) covers it. The discarded
// card's ability then fires — that resolution is still legacy-owned and the
// card is exposed as run.lastDiscardedCard until Phase 11 moves it here.
function discardSelected(state) {
  const { run, persist } = state;
  if (run.selectedCardId == null) return state;

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
    lastDiscardedCard: card,
  });
}

function scoreReading(state) {
  const { run, persist } = state;
  const cards = run.spread.filter(Boolean);
  const score = computeScore(cards, {
    upgrades: persist.upgrades,
    relics: persist.relics,
    context: {
      handCount: run.hand.length,
      discardedCount: run.discardedCards.length,
      discardedCards: run.discardedCards,
      abilityTakenCardIds: run.abilityTakenCardIds,
      resonationBonus: run.resonationBonus,
      worldCarry: run.worldCarry,
    },
  });

  const threshold = currentThreshold(run.thresholdIndex, run.thresholdBonus);
  const passed = score.finalScore >= threshold;

  if (!passed) {
    return replaceRun(state, {
      phase: GAME_PHASES.SESSION_END,
      lastScore: score,
      lastThreshold: threshold,
      lastPassed: false,
    });
  }

  const miserBonus = thresholdClearBonusFromRelics(persist.relics);

  return replacePersist(
    replaceRun(state, {
      phase: GAME_PHASES.MARKET,
      thresholdIndex: run.thresholdIndex + 1,
      lastScore: score,
      lastThreshold: threshold,
      lastPassed: true,
      pendingReserve: (run.pendingReserve || 0) + score.finalScore + miserBonus,
      worldCarry: worldCarryFromRelics(persist.relics, score.finalScore, threshold),
      relicEarned: score.finalScore >= threshold * 2,
    }),
    {
      totalScore: persist.totalScore + score.finalScore,
    }
  );
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

// Live pack-market purchases. kind is one of:
//   pack    — spend reserve on a pack or a shop refresh
//   upgrade — free pick from an opened pack (+1 level, plus paired key)
//   relic   — add a relic (or replace one when slots are full)
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

// Abilities resolve atomically at their commit point. The modal flow (which
// cards are shown) is still legacy-driven; the result of the ability — cards
// moving between deck/hand/discard, taken-card tracking, Thread Bond chips —
// is owned here. result.kind is one of: draw, take, search, world.
function resolveAbilityAction(state, action) {
  const { run, persist } = state;
  const result = action.result || {};
  const base = { ability: null, busy: false };

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

// Transition-period check-in: while the legacy app still mutates parts of the
// run outside the reducer, it pushes the affected fields here before
// dispatching a store-owned action, and reads the result back afterwards.
const LEGACY_RUN_FIELDS = [
  'deck', 'hand', 'discard', 'spread', 'discards', 'discardedCards',
  'freeDiscardUsed', 'sightChargesUsed', 'thresholdIndex', 'thresholdBonus',
  'thresholdBonusPending', 'reading', 'pendingReserve', 'worldCarry',
  'abilityTakenCardIds', 'resonationBonus',
];

function syncLegacyRun(state, run = {}) {
  const patch = {};
  for (const key of LEGACY_RUN_FIELDS) {
    if (!(key in run)) continue;
    patch[key] = Array.isArray(run[key]) ? [...run[key]] : run[key];
  }
  return replaceRun(state, patch);
}

const LEGACY_PERSIST_FIELDS = [
  'reserve', 'totalScore', 'upgrades', 'relics', 'relicUsed', 'obals',
  'unlockedFragments', 'discoveredArchiveItems', 'seenTutorials',
];

function syncLegacyPersist(state, persist = {}) {
  const patch = {};
  for (const key of LEGACY_PERSIST_FIELDS) {
    if (!(key in persist)) continue;
    const value = persist[key];
    if (Array.isArray(value)) patch[key] = [...value];
    else if (value && typeof value === 'object') patch[key] = { ...value };
    else patch[key] = value;
  }
  return replacePersist(state, patch);
}

export function reducer(state = createGameState(), action = {}) {
  switch (action.type) {
    case ACTIONS.START_READING: {
      // The deck may be supplied by the legacy app (its card objects and RNG)
      // during the transition; otherwise it is built from the data layer.
      const { persist } = state;
      const baseDeck = action.deck ? [...action.deck] : shuffleDeck(buildDeck(), action.rng);
      const extraDraws = startingHandBonusFromRelics(persist.relics) + (persist.upgrades.deep_current || 0);
      const { drawn, deck: remainingDeck } = drawCards(baseDeck, maxHand(persist) + extraDraws);
      const offering = (persist.upgrades.offering || 0) * 5;
      const next = replaceRun(state, {
        phase: GAME_PHASES.TABLE,
        deck: remainingDeck,
        hand: drawn,
        discard: [],
        spread: Array(5).fill(null),
        selectedCardId: null,
        discards: startingDiscards(persist),
        mulliganCharges: persist.upgrades.mulligan || 0,
        freeDiscardUsed: false,
        sightChargesUsed: 0,
        lastDiscardedCard: null,
        discardedCards: [],
        abilityTakenCardIds: [],
        resonationBonus: { chips: 0, mult: 0 },
        thresholdBonus: (state.run.thresholdBonus || 0) + (state.run.thresholdBonusPending || 0),
        thresholdBonusPending: 0,
        ability: null,
        purge: null,
        busy: false,
        lastScore: null,
        lastThreshold: null,
        lastPassed: null,
      });
      return offering ? replacePersist(next, { reserve: next.persist.reserve + offering }) : next;
    }

    case ACTIONS.SELECT_CARD:
      return replaceRun(state, { selectedCardId: action.cardId });

    case ACTIONS.CLEAR_SELECTION:
      return replaceRun(state, { selectedCardId: null });

    case ACTIONS.PLACE_CARD:
      return placeCard(state, action.slotIndex);

    case ACTIONS.DISCARD_SELECTED:
      return discardSelected(state);

    case ACTIONS.START_ABILITY:
      return replaceRun(state, {
        ability: { id: action.abilityId, sourceCardId: action.sourceCardId ?? null },
        busy: true,
      });

    case ACTIONS.RESOLVE_ABILITY:
      return resolveAbilityAction(state, action);

    case ACTIONS.CANCEL_ABILITY:
      return replaceRun(state, { ability: null, busy: false });

    case ACTIONS.SCORE_READING:
      return scoreReading(state);

    case ACTIONS.OPEN_MARKET:
      return replaceRun(state, { phase: GAME_PHASES.MARKET });

    case ACTIONS.BUY_MARKET_ITEM:
      if (action.purchase) return buyMarketPurchase(state, action.purchase);
      return buyMarketItem(state, action.itemId);

    case ACTIONS.LEAVE_MARKET:
      return replaceRun(state, { phase: GAME_PHASES.TABLE, reading: state.run.reading + 1 });

    case ACTIONS.ENTER_ATTIC: {
      const next = replaceRun(state, { phase: GAME_PHASES.ATTIC });
      if (action.obals == null) return next;
      return replacePersist(next, { obals: action.obals });
    }

    case ACTIONS.LEAVE_ATTIC:
      return replaceRun(state, { phase: GAME_PHASES.TABLE });

    case ACTIONS.UNLOCK_FRAGMENT: {
      if (!action.fragmentId || state.persist.unlockedFragments.includes(action.fragmentId)) return state;
      return replacePersist(state, {
        unlockedFragments: [...state.persist.unlockedFragments, action.fragmentId],
      });
    }

    case ACTIONS.DISCOVER_ARCHIVE_ITEM: {
      if (!action.itemId || state.persist.discoveredArchiveItems.includes(action.itemId)) return state;
      return replacePersist(state, {
        discoveredArchiveItems: [...state.persist.discoveredArchiveItems, action.itemId],
      });
    }

    case ACTIONS.SET_OBALS:
      return replacePersist(state, { obals: Math.max(0, action.obals || 0) });

    case ACTIONS.END_SESSION:
      return replaceRun(state, {
        phase: GAME_PHASES.SESSION_END,
        lastSessionScore: action.totalScore ?? state.persist.totalScore,
        lastSessionObals: action.obals ?? null,
      });

    case ACTIONS.RESET_SESSION:
      // Session-scoped persist resets (reserve, score, relics, relic slots);
      // permanent progress (upgrades, obals, fragments, archives) survives.
      return createGameState({
        persist: {
          ...state.persist,
          reserve: 0,
          totalScore: 0,
          relics: [],
          relicUsed: {},
          upgrades: { ...state.persist.upgrades, relicSlot: 0 },
        },
      });

    case ACTIONS.SYNC_LEGACY_SNAPSHOT:
      return syncLegacySnapshot(state, action.snapshot);

    case ACTIONS.SYNC_LEGACY_RUN:
      return syncLegacyRun(state, action.run);

    case ACTIONS.SYNC_LEGACY_PERSIST:
      return syncLegacyPersist(state, action.persist);

    default:
      return state;
  }
}
