import { ACTIONS } from './actions.mjs';
import { createGameState, GAME_PHASES } from './state.mjs';
import { buildDeck, drawCards, shuffleDeck } from '../systems/deck.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { buyShopItem } from '../systems/shop.mjs';
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

function discardSelected(state) {
  const { run } = state;
  if (run.selectedCardId == null || run.discards <= 0) return state;

  const hand = [...run.hand];
  const cardIndex = hand.findIndex(card => card.uid === run.selectedCardId);
  if (cardIndex < 0) return state;

  const [card] = hand.splice(cardIndex, 1);
  const discard = [...run.discard, card];
  const { drawn, deck } = drawCards(run.deck, 1);

  return replaceRun(state, {
    deck,
    hand: [...hand, ...drawn],
    discard,
    discardedCards: [...run.discardedCards, card],
    selectedCardId: null,
    discards: run.discards - 1,
  });
}

function scoreReading(state) {
  const cards = state.run.spread.filter(Boolean);
  const score = computeScore(cards, {
    upgrades: state.persist.upgrades,
    relics: state.persist.relics,
    context: {
      handCount: state.run.hand.length,
      discardedCount: state.run.discardedCards.length,
    },
  });

  const threshold = currentThreshold(state.run.thresholdIndex, state.run.thresholdBonus);
  const passed = score.finalScore >= threshold;

  if (!passed) {
    return replaceRun(state, {
      phase: GAME_PHASES.SESSION_END,
      lastScore: score,
      lastThreshold: threshold,
      lastPassed: false,
    });
  }

  return replacePersist(
    replaceRun(state, {
      phase: GAME_PHASES.MARKET,
      thresholdIndex: state.run.thresholdIndex + 1,
      lastScore: score,
      lastThreshold: threshold,
      lastPassed: true,
      pendingReserve: (state.run.pendingReserve || 0) + score.finalScore,
    }),
    {
      totalScore: state.persist.totalScore + score.finalScore,
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

    default:
      return state;
  }
}
