import { buildDeck, shuffleDeck } from '../systems/deck.mjs';
import { getPersona } from './personas.mjs';
import { makeInteractionCard } from './interactionCards.mjs';

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
    bonusActionAvailable: false, // Gambit: can place immediately after next invoke
    swapAvailable: false,    // Surgeon: free spread swap available this round
  };
}

export function createMatchState({ seed = null, scoreTarget = SCORE_TARGETS.STANDARD, personas = [null, null] } = {}) {
  const rng = seed ? seededRng(seed) : Math.random;
  return {
    phase: MP_PHASES.IDLE,
    round: 0,
    scoreTarget,
    activePlayerIndex: 0,
    firstPlayerIndex: 0,
    finalTurnForIndex: null,
    players: [
      createPlayerState(0, personas[0] ?? null, rng),
      createPlayerState(1, personas[1] ?? null, rng),
    ],
    log: [],
    error: null,
    seed,
    nextInjectedUid: 9000,
  };
}

function seededRng(seed) {
  // Mulberry32-ish deterministic RNG from numeric/string seed.
  let h = 2166136261 >>> 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function rng() {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function injectInteractionCards(player, interactionId, count, state) {
  let nextUid = state.nextInjectedUid ?? 9000;
  const injected = [];
  for (let i = 0; i < count; i++) {
    injected.push(makeInteractionCard(interactionId, nextUid++, player.index));
  }
  return {
    player: { ...player, deck: shuffleDeck([...player.deck, ...injected]) },
    nextInjectedUid: nextUid,
  };
}
