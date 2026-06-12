import { buildDeck, shuffleDeck } from '../systems/deck.mjs';

export const MP_PHASES = Object.freeze({
  IDLE: 'idle',
  PLACEMENT: 'placement',
  FINAL_TURN: 'final_turn', // one player filled their spread; opponent gets one last action
  SCORING: 'scoring',
  BETWEEN_ROUNDS: 'between_rounds',
  COMPLETE: 'complete',
});

export const SCORE_TARGETS = Object.freeze({
  QUICK: 100,
  STANDARD: 200,
  LONG: 300,
});

export const MP_SPREAD_SIZE = 5;
export const MP_HAND_SIZE = 7;
export const MP_STARTING_DISCARDS = 3;

// UIDs for player 0 are 0–77, player 1 are 1000–1077.
// This keeps cards distinguishable across both spreads/hands.
const UID_OFFSETS = [0, 1000];

export function buildPlayerDeck(playerIndex, rng = Math.random) {
  const offset = UID_OFFSETS[playerIndex] ?? playerIndex * 1000;
  const deck = buildDeck().map(card => ({ ...card, uid: card.uid + offset, playerOwner: playerIndex }));
  return shuffleDeck(deck, rng);
}

function drawHand(deck, handSize) {
  return { hand: deck.slice(0, handSize), deck: deck.slice(handSize) };
}

export function createPlayerState(playerIndex, rng = Math.random) {
  const shuffled = buildPlayerDeck(playerIndex, rng);
  const { hand, deck } = drawHand(shuffled, MP_HAND_SIZE);
  return {
    index: playerIndex,
    deck,
    hand,
    discard: [],
    spread: Array(MP_SPREAD_SIZE).fill(null),
    discards: MP_STARTING_DISCARDS,
    totalScore: 0,
    roundScore: 0,
  };
}

export function createMatchState(options = {}) {
  const rng = options.rng || Math.random;
  return {
    phase: MP_PHASES.IDLE,
    scoreTarget: options.scoreTarget ?? SCORE_TARGETS.STANDARD,
    round: 0,
    activePlayerIndex: 0,
    finalTurnForIndex: null,
    players: [
      createPlayerState(0, rng),
      createPlayerState(1, rng),
    ],
    winner: null,        // null | 0 | 1 | 'draw'
    roundHistory: [],    // [{ scores: [p0score, p1score], totals: [p0total, p1total] }]
    error: null,
  };
}
