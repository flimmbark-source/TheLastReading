import { MP_ACTIONS } from './mpActions.mjs';
import { MP_PHASES, MP_HAND_SIZE, MP_SPREAD_SIZE, createMatchState } from './mpState.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { shuffleDeck } from '../systems/deck.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';

// --- Helpers ---

function err(state, message) {
  return { ...state, error: message };
}

function clearError(state) {
  return state.error ? { ...state, error: null } : state;
}

function updatePlayer(state, index, patch) {
  const players = state.players.map((p, i) => i === index ? { ...p, ...patch } : p);
  return { ...state, players };
}

function otherPlayerIndex(index) {
  return index === 0 ? 1 : 0;
}

function spreadFull(spread) {
  return spread.every(slot => slot !== null);
}

// Draw up to `count` cards from a player's deck, reshuffling discard if needed.
function drawCards(player, count) {
  let deck = [...player.deck];
  let discard = [...player.discard];
  const hand = [...player.hand];

  for (let i = 0; i < count; i++) {
    if (!deck.length) {
      if (!discard.length) break;
      deck = shuffleDeck(discard);
      discard = [];
    }
    hand.push(deck.shift());
  }

  return { ...player, deck, discard, hand };
}

// Draw hand back up to MP_HAND_SIZE.
function drawToHandSize(player) {
  const needed = MP_HAND_SIZE - player.hand.length;
  return needed > 0 ? drawCards(player, needed) : player;
}

// Apply an Invoke: remove the card from hand, spend a discard, apply ability effect.
// Returns updated player or null on validation failure.
function applyInvoke(player, cardUid) {
  const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIndex < 0) return null;
  if (player.discards <= 0) return null;

  const card = player.hand[cardIndex];
  const hand = player.hand.filter((_, i) => i !== cardIndex);
  const discard = [...player.discard, card];
  let updated = { ...player, hand, discard, discards: player.discards - 1 };

  const ability = card.ability ? getAbility(card.ability) : null;
  if (ability?.type === ABILITY_TYPES.DRAW) {
    updated = drawCards(updated, ability.count ?? 1);
  }
  // PEEK, SEARCH, NEIGHBOR, KIN, MIRROR, BETWEEN, WORLD — these need targeting
  // and will be handled by a future MP_RESOLVE_ABILITY action. For now the discard
  // is spent and the card is discarded; no secondary effect fires.

  return updated;
}

// Score a player's spread using the base scoring system (no singleplayer upgrades).
function scoreSpread(spread) {
  const cards = spread.filter(Boolean);
  if (!cards.length) return 0;
  return computeScore(cards, { skipFlatBonuses: true, skipRelics: true }).finalScore;
}

// After scoring, determine the winner (or null if match continues).
function resolveVictory(state) {
  const [p0, p1] = state.players;
  if (p0.totalScore < state.scoreTarget && p1.totalScore < state.scoreTarget) return null;
  if (p0.totalScore === p1.totalScore) return 'draw';
  return p0.totalScore > p1.totalScore ? 0 : 1;
}

// --- Turn advance ---

// After a player's action, advance the turn or phase.
// `playerIndex` = who just acted, `filledSpread` = whether their spread is now full.
function advanceTurn(state, playerIndex, filledSpread) {
  if (state.phase === MP_PHASES.FINAL_TURN) {
    // Final turn taken — move to scoring.
    return { ...state, phase: MP_PHASES.SCORING };
  }

  if (filledSpread) {
    // This player filled their spread. The other player gets one final turn.
    const other = otherPlayerIndex(playerIndex);
    // If the other player's spread is also full, go straight to scoring.
    if (spreadFull(state.players[other].spread)) {
      return { ...state, phase: MP_PHASES.SCORING };
    }
    return { ...state, phase: MP_PHASES.FINAL_TURN, finalTurnForIndex: other, activePlayerIndex: other };
  }

  // Normal turn pass.
  return { ...state, activePlayerIndex: otherPlayerIndex(playerIndex) };
}

// --- Reducer ---

export function mpReducer(state, action) {
  if (!state) state = createMatchState();
  state = clearError(state);

  switch (action.type) {

    case MP_ACTIONS.MP_INIT: {
      const rng = action.rng || Math.random;
      return {
        ...createMatchState({ scoreTarget: action.scoreTarget ?? state.scoreTarget, rng }),
        phase: MP_PHASES.PLACEMENT,
        round: 1,
      };
    }

    case MP_ACTIONS.MP_PLACE_CARD: {
      const { playerIndex, cardUid, slotIndex } = action;
      if (state.phase !== MP_PHASES.PLACEMENT && state.phase !== MP_PHASES.FINAL_TURN) {
        return err(state, 'Cannot place a card in phase: ' + state.phase);
      }
      if (playerIndex !== state.activePlayerIndex) {
        return err(state, 'Not your turn.');
      }
      const player = state.players[playerIndex];
      if (slotIndex < 0 || slotIndex >= MP_SPREAD_SIZE) {
        return err(state, 'Invalid slot index: ' + slotIndex);
      }
      if (player.spread[slotIndex] !== null) {
        return err(state, 'Slot already occupied.');
      }
      const cardIdx = player.hand.findIndex(c => c.uid === cardUid);
      if (cardIdx < 0) {
        return err(state, 'Card not in hand.');
      }

      const card = player.hand[cardIdx];
      const hand = player.hand.filter((_, i) => i !== cardIdx);
      const spread = player.spread.map((s, i) => i === slotIndex ? card : s);
      let next = updatePlayer(state, playerIndex, { hand, spread });

      return advanceTurn(next, playerIndex, spreadFull(spread));
    }

    case MP_ACTIONS.MP_INVOKE_ABILITY: {
      const { playerIndex, cardUid } = action;
      if (state.phase !== MP_PHASES.PLACEMENT && state.phase !== MP_PHASES.FINAL_TURN) {
        return err(state, 'Cannot invoke in phase: ' + state.phase);
      }
      if (playerIndex !== state.activePlayerIndex) {
        return err(state, 'Not your turn.');
      }
      const player = state.players[playerIndex];
      const updated = applyInvoke(player, cardUid);
      if (!updated) {
        return err(state, 'Cannot invoke: card not in hand or no discards remaining.');
      }
      let next = updatePlayer(state, playerIndex, updated);
      return advanceTurn(next, playerIndex, false);
    }

    case MP_ACTIONS.MP_SCORE_ROUND: {
      if (state.phase !== MP_PHASES.SCORING) {
        return err(state, 'Cannot score in phase: ' + state.phase);
      }

      const p0Score = scoreSpread(state.players[0].spread);
      const p1Score = scoreSpread(state.players[1].spread);

      let next = updatePlayer(state, 0, {
        roundScore: p0Score,
        totalScore: state.players[0].totalScore + p0Score,
      });
      next = updatePlayer(next, 1, {
        roundScore: p1Score,
        totalScore: state.players[1].totalScore + p1Score,
      });

      const history = [
        ...state.roundHistory,
        {
          scores: [p0Score, p1Score],
          totals: [next.players[0].totalScore, next.players[1].totalScore],
        },
      ];
      next = { ...next, roundHistory: history };

      const winner = resolveVictory(next);
      if (winner !== null) {
        return { ...next, phase: MP_PHASES.COMPLETE, winner };
      }
      return { ...next, phase: MP_PHASES.BETWEEN_ROUNDS };
    }

    case MP_ACTIONS.MP_NEW_ROUND: {
      if (state.phase !== MP_PHASES.BETWEEN_ROUNDS) {
        return err(state, 'Cannot start a new round in phase: ' + state.phase);
      }

      // Clear spreads; return spread cards to discard, then draw back up.
      let next = state;
      for (let i = 0; i < 2; i++) {
        const p = next.players[i];
        const discard = [...p.discard, ...p.spread.filter(Boolean)];
        const resetPlayer = {
          ...p,
          spread: Array(MP_SPREAD_SIZE).fill(null),
          discard,
          discards: 3,
          roundScore: 0,
        };
        next = updatePlayer(next, i, drawToHandSize(resetPlayer));
      }

      // Alternate who goes first each round.
      const firstPlayer = (state.round % 2 === 0) ? 0 : 1;

      return {
        ...next,
        phase: MP_PHASES.PLACEMENT,
        round: state.round + 1,
        activePlayerIndex: firstPlayer,
        finalTurnForIndex: null,
      };
    }

    default:
      return state;
  }
}
