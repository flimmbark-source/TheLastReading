import { buildDeck, shuffleDeck } from '../systems/deck.mjs';
import { getPersona } from './personas.mjs';
import { makeInteractionCard } from './interactionCards.mjs';

export const MP_PHASES = Object.freeze({
  IDLE: 'idle',
  PLACEMENT: 'placement',
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
export const MP_HAND_SIZE = 5;
export const MP_STARTING_DISCARDS = 3;

// UIDs for player 0 are 0–77, player 1 are 1000–1077.
// Injected interaction cards use 9000+ (via nextInjectedUid counter in match state).
const UID_OFFSETS = [0, 1000];

export function buildPlayerDeck(playerIndex, rng = Math.random) {
  const offset = UID_OFFSETS[playerIndex] ?? playerIndex * 1000;
  const deck = buildDeck().map(card => ({ ...card, uid: card.uid + offset, playerOwner: playerIndex }));
  return shuffleDeck(deck, rng);
}

function drawHand(deck, handSize) {
  return { hand: deck.slice(0, handSize), deck: deck.slice(handSize) };
}

// Compute the hand size and starting discards for a player given their persona.
export function handSizeForPersona(personaId) {
  const persona = getPersona(personaId);
  return MP_HAND_SIZE + (persona?.passives?.handSizeBonus ?? 0);
}

export function startingDiscardsForPersona(personaId) {
  const persona = getPersona(personaId);
  return Math.max(0, MP_STARTING_DISCARDS + (persona?.passives?.startingDiscardsBonus ?? 0));
}

export function createPlayerState(playerIndex, personaId = null, rng = Math.random) {
  const handSize = handSizeForPersona(personaId);
  const shuffled = buildPlayerDeck(playerIndex, rng);
  const { hand, deck } = drawHand(shuffled, handSize);
  return {
    index: playerIndex,
    persona: personaId,
    deck,
    hand,
    discard: [],
    spread: Array(MP_SPREAD_SIZE).fill(null),
    discards: startingDiscardsForPersona(personaId),
    totalScore: 0,
    roundScore: 0,
    // --- Persona state (reset each round) ---
    anchoredSlotIndex: null, // Anchor: index of the first-placed card's slot
    playedSlotHistory: [],   // most recent spread placements, used by Banish
    silencedCardUids: [],    // Seal: UIDs excluded from scoring this round
    discardDrawAvailable: false, // Gambit: Discard-a-card-Draw-its-Value available this round
    swapAvailable: false,    // Surgeon: spread/hand swap available this round
  };
}

export function createMatchState(options = {}) {
  const rng = options.rng || Math.random;
  const personas = options.personas ?? [null, null];
  return {
    phase: MP_PHASES.IDLE,
    scoreTarget: options.scoreTarget ?? SCORE_TARGETS.STANDARD,
    round: 0,
    activePlayerIndex: 0,
    players: [
      createPlayerState(0, personas[0], rng),
      createPlayerState(1, personas[1], rng),
    ],
    // Each player's queue of chosen actions for the current exchange. Normally
    // holds at most one action once submitted, but Surgeon's free swap can
    // add a second (non-locking) action before their real one. Actions are
    // hidden/resolved only once both players have locked in (see
    // mpReducer.mjs's exchangeStatus/resolvePendingActions).
    pendingActions: [[], []],
    winner: null,
    roundHistory: [],
    nextInjectedUid: 9000, // counter for injected interaction card UIDs
    error: null,
  };
}

// Apply game-start persona passives to a player's deck, returning updated player
// state and the next injected UID counter. These cards are added once per match.
export function applyGameStartPassives(player, nextUid, rng = Math.random) {
  let deck = [...player.deck];
  let uid = nextUid;

  const persona = getPersona(player.persona);
  if (persona?.passives?.gameStartDeckCards) {
    const injected = [];
    for (const { defId, count } of persona.passives.gameStartDeckCards) {
      for (let i = 0; i < count; i++) {
        injected.push(makeInteractionCard(defId, uid, player.index));
        uid++;
      }
    }
    if (injected.length) deck = shuffleDeck([...deck, ...injected], rng);
  }

  return {
    player: { ...player, deck },
    nextUid: uid,
  };
}

// Apply round-start persona passives to a player, returning updated player state
// and the next injected UID counter.
export function applyRoundStartPassives(player, nextUid) {
  let hand = [...player.hand];
  let uid = nextUid;

  const persona = getPersona(player.persona);
  if (persona?.passives?.roundStartCards) {
    for (const { defId, count } of persona.passives.roundStartCards) {
      for (let i = 0; i < count; i++) {
        hand = [makeInteractionCard(defId, uid, player.index), ...hand];
        uid++;
      }
    }
  }

  const swapAvailable = !!(persona?.passives?.freeSpreadSwap);
  const discardDrawAvailable = !!(persona?.passives?.discardDrawByValue);

  return {
    player: {
      ...player,
      hand,
      swapAvailable,
      discardDrawAvailable,
    },
    nextUid: uid,
  };
}
