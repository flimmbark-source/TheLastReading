import { ACTIONS } from './actions.mjs';
import { createGameState, GAME_PHASES } from './state.mjs';
import { buildDeck, drawCards, shuffleDeck } from '../systems/deck.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { buyShopItem } from '../systems/shop.mjs';
import { firstDiscardIsFree, hasRelic, thresholdClearBonusFromRelics, worldCarryFromRelics } from '../systems/relics.mjs';
import { isSightAbility } from '../systems/abilities.mjs';
import { currentThreshold } from '../data/thresholds.mjs';

function maxHand(persist) {
  return 5 + (persist.upgrades.hand || 0);
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
  'reading', 'pendingReserve', 'worldCarry', 'abilityTakenCardIds', 'resonationBonus',
];

function syncLegacyRun(state, run = {}) {
  const patch = {};
  for (const key of LEGACY_RUN_FIELDS) {
    if (!(key in run)) continue;
    patch[key] = Array.isArray(run[key]) ? [...run[key]] : run[key];
  }
  return replaceRun(state, patch);
}

const LEGACY_PERSIST_FIELDS = ['reserve', 'totalScore', 'upgrades', 'relics', 'relicUsed', 'obals'];

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
      const deck = shuffleDeck(buildDeck(), action.rng);
      const { drawn, deck: remainingDeck } = drawCards(deck, maxHand(state.persist));
      return replaceRun(state, {
        phase: GAME_PHASES.TABLE,
        deck: remainingDeck,
        hand: drawn,
        discard: [],
        spread: Array(5).fill(null),
        selectedCardId: null,
        discards: startingDiscards(state.persist),
        discardedCards: [],
        ability: null,
        purge: null,
        lastScore: null,
        lastThreshold: null,
        lastPassed: null,
      });
    }

    case ACTIONS.SELECT_CARD:
      return replaceRun(state, { selectedCardId: action.cardId });

    case ACTIONS.CLEAR_SELECTION:
      return replaceRun(state, { selectedCardId: null });

    case ACTIONS.PLACE_CARD:
      return placeCard(state, action.slotIndex);

    case ACTIONS.DISCARD_SELECTED:
      return discardSelected(state);

    case ACTIONS.SCORE_READING:
      return scoreReading(state);

    case ACTIONS.OPEN_MARKET:
      return replaceRun(state, { phase: GAME_PHASES.MARKET });

    case ACTIONS.BUY_MARKET_ITEM:
      return buyMarketItem(state, action.itemId);

    case ACTIONS.LEAVE_MARKET:
      return replaceRun(state, { phase: GAME_PHASES.TABLE, reading: state.run.reading + 1 });

    case ACTIONS.ENTER_ATTIC:
      return replaceRun(state, { phase: GAME_PHASES.ATTIC });

    case ACTIONS.LEAVE_ATTIC:
      return replaceRun(state, { phase: GAME_PHASES.TABLE });

    case ACTIONS.RESET_SESSION:
      return createGameState({ persist: state.persist });

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
