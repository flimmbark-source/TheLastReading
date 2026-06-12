import { MP_ACTIONS } from './mpActions.mjs';
import { MP_PHASES, MP_SPREAD_SIZE, createMatchState, startingDiscardsForPersona, applyGameStartPassives, applyRoundStartPassives, handSizeForPersona } from './mpState.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { shuffleDeck } from '../systems/deck.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { MP_ABILITY_TYPES } from './interactionCards.mjs';
import { getPersona } from './personas.mjs';
import { mulberry32 } from './mpRng.mjs';

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

function lastPlayedLiveSlot(player) {
  const history = Array.isArray(player?.playedSlotHistory) ? player.playedSlotHistory : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const slotIndex = history[i];
    if (slotIndex >= 0 && slotIndex < MP_SPREAD_SIZE && player.spread[slotIndex] !== null) return slotIndex;
  }
  return -1;
}

function removeSlotFromHistory(history, slotIndex) {
  return (Array.isArray(history) ? history : []).filter(i => i !== slotIndex);
}

function isActionPhase(state) {
  return state.phase === MP_PHASES.PLACEMENT || state.phase === MP_PHASES.FINAL_TURN;
}

function requireActivePlayer(state, playerIndex) {
  if (!isActionPhase(state)) return 'Cannot act in phase: ' + state.phase;
  if (playerIndex !== state.activePlayerIndex) return 'Not your turn.';
  return null;
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

// Draw hand back up to the player's persona-adjusted hand size.
function drawToHandSize(player) {
  const target = handSizeForPersona(player.persona);
  const needed = target - player.hand.length;
  return needed > 0 ? drawCards(player, needed) : player;
}

// Apply a standard singleplayer-style ability (DRAW etc.).
// Returns updated player state.
function applyStandardAbility(player, ability) {
  if (ability?.type === ABILITY_TYPES.DRAW) {
    return drawCards(player, ability.count ?? 1);
  }
  // All other standard ability types need targeting/selection and are stubbed for now.
  return player;
}

// Apply an MP interaction ability. Returns { nextState } or null on validation failure.
function applyInteractionAbility(state, playerIndex, card, target) {
  const { abilityType } = card;

  if (abilityType === MP_ABILITY_TYPES.MP_BANISH) {
    const targetPlayerIdx = otherPlayerIndex(playerIndex);
    const targetPlayer = state.players[targetPlayerIdx];
    if (!targetPlayer) return { error: 'Invalid target player.' };

    const targetSlot = lastPlayedLiveSlot(targetPlayer);
    if (targetSlot < 0) return { error: 'Opponent has no played card to Banish.' };
    if (targetPlayer.spread[targetSlot] === null) return { error: 'Target slot is empty.' };

    // Anchor: protect the first-placed slot
    if (targetPlayer.anchoredSlotIndex === targetSlot) {
      return { error: 'That card is anchored and cannot be removed.' };
    }

    const removedCard = targetPlayer.spread[targetSlot];
    const newSpread = targetPlayer.spread.map((c, i) => i === targetSlot ? null : c);
    // Removed card goes to the target player's discard
    const newDiscard = [...targetPlayer.discard, removedCard];
    const playedSlotHistory = removeSlotFromHistory(targetPlayer.playedSlotHistory, targetSlot);
    const nextState = updatePlayer(state, targetPlayerIdx, { spread: newSpread, discard: newDiscard, playedSlotHistory });
    return { nextState };
  }

  if (abilityType === MP_ABILITY_TYPES.MP_SEAL) {
    if (!target) return { error: 'Seal requires a target.' };
    const { playerIndex: targetPlayerIdx, slotIndex: targetSlot } = target;

    if (targetPlayerIdx === playerIndex) return { error: 'Cannot Seal your own spread.' };
    const targetPlayer = state.players[targetPlayerIdx];
    if (!targetPlayer) return { error: 'Invalid target player.' };
    if (targetSlot < 0 || targetSlot >= MP_SPREAD_SIZE) return { error: 'Invalid target slot.' };

    const targetCard = targetPlayer.spread[targetSlot];
    if (!targetCard) return { error: 'Target slot is empty.' };

    // Anchor: protect the first-placed slot
    if (targetPlayer.anchoredSlotIndex === targetSlot) {
      return { error: 'That card is anchored and cannot be silenced.' };
    }

    const silenced = [...targetPlayer.silencedCardUids, targetCard.uid];
    const nextState = updatePlayer(state, targetPlayerIdx, { silencedCardUids: silenced });
    return { nextState };
  }

  return { error: 'Unknown interaction ability: ' + abilityType };
}

// Apply an Invoke: remove card from hand, spend a discard, apply ability.
// Returns { player, interactionResult } or { error }.
function applyInvoke(state, playerIndex, cardUid, target) {
  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIndex < 0) return { error: 'Card not in hand.' };
  if (player.discards <= 0) return { error: 'No discards remaining.' };

  const card = player.hand[cardIndex];
  const hand = player.hand.filter((_, i) => i !== cardIndex);
  const discard = [...player.discard, card];
  let updatedPlayer = { ...player, hand, discard, discards: player.discards - 1 };

  // Interaction card (Banish, Seal)?
  if (card.abilityType) {
    const result = applyInteractionAbility(
      updatePlayer(state, playerIndex, updatedPlayer),
      playerIndex,
      card,
      target,
    );
    if (result.error) return { error: result.error };
    return { state: result.nextState };
  }

  // Standard singleplayer-style ability
  const ability = card.ability ? getAbility(card.ability) : null;
  updatedPlayer = applyStandardAbility(updatedPlayer, ability);
  return { player: updatedPlayer };
}

// Score a player's spread, excluding silenced cards.
function scoreSpread(player) {
  const cards = player.spread.filter(
    c => c !== null && !player.silencedCardUids.includes(c.uid)
  );
  if (!cards.length) return 0;
  return computeScore(cards, { skipFlatBonuses: true, skipRelics: true }).finalScore;
}

// After scoring, determine the winner (or null if the match continues).
function resolveVictory(state) {
  const [p0, p1] = state.players;
  if (p0.totalScore < state.scoreTarget && p1.totalScore < state.scoreTarget) return null;
  if (p0.totalScore === p1.totalScore) return 'draw';
  return p0.totalScore > p1.totalScore ? 0 : 1;
}

// --- Turn advance ---

// After a player's action, advance the turn or phase.
// `playerIndex` = who just acted.
// `filledSpread` = whether their spread is now full.
// `isBonusConsumed` = whether a Gambit bonus action was just consumed (so don't check again).
function advanceTurn(state, playerIndex, filledSpread, isBonusConsumed = false) {
  if (state.phase === MP_PHASES.FINAL_TURN) {
    return { ...state, phase: MP_PHASES.SCORING };
  }

  if (filledSpread) {
    const other = otherPlayerIndex(playerIndex);
    if (spreadFull(state.players[other].spread)) {
      return { ...state, phase: MP_PHASES.SCORING };
    }
    return { ...state, phase: MP_PHASES.FINAL_TURN, finalTurnForIndex: other, activePlayerIndex: other };
  }

  return { ...state, activePlayerIndex: otherPlayerIndex(playerIndex) };
}

// --- Reducer ---

export function mpReducer(state, action) {
  if (!state) state = createMatchState();
  state = clearError(state);

  switch (action.type) {

    case MP_ACTIONS.MP_INIT: {
      // Prefer a seeded RNG derived from action.seed so both peers produce
      // identical shuffles. Fall back to action.rng or Math.random for tests.
      const rng = action.seed != null ? mulberry32(action.seed) : (action.rng || Math.random);
      const personas = action.personas ?? [null, null];
      let next = {
        ...createMatchState({ scoreTarget: action.scoreTarget ?? state.scoreTarget, rng, personas }),
        phase: MP_PHASES.PLACEMENT,
        round: 1,
      };
      let uid = next.nextInjectedUid;
      // Apply game-start deck passives first, then round-start passives for round 1.
      for (let i = 0; i < 2; i++) {
        const gameStart = applyGameStartPassives(next.players[i], uid, rng);
        next = updatePlayer(next, i, gameStart.player);
        uid = gameStart.nextUid;
      }
      for (let i = 0; i < 2; i++) {
        const roundStart = applyRoundStartPassives(next.players[i], uid);
        next = updatePlayer(next, i, roundStart.player);
        uid = roundStart.nextUid;
      }
      return { ...next, nextInjectedUid: uid };
    }

    case MP_ACTIONS.MP_PLACE_CARD: {
      const { playerIndex, cardUid, slotIndex } = action;
      const activeError = requireActivePlayer(state, playerIndex);
      if (activeError) return err(state, activeError);

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
      const playedSlotHistory = [...(player.playedSlotHistory || []), slotIndex];

      // Anchor: record the first placed card's slot
      const wasEmpty = player.spread.every(s => s === null);
      const anchoredSlotIndex =
        wasEmpty && getPersona(player.persona)?.passives?.anchoredFirstCard
          ? slotIndex
          : player.anchoredSlotIndex;

      let next = updatePlayer(state, playerIndex, { hand, spread, anchoredSlotIndex, playedSlotHistory });
      return advanceTurn(next, playerIndex, spreadFull(spread));
    }

    case MP_ACTIONS.MP_INVOKE_ABILITY: {
      const { playerIndex, cardUid, target } = action;
      const activeError = requireActivePlayer(state, playerIndex);
      if (activeError) return err(state, activeError);

      const result = applyInvoke(state, playerIndex, cardUid, target);
      if (result.error) return err(state, result.error);

      // result.state is set when an interaction ability ran (it already has all player updates)
      // result.player is set when a standard ability ran (only the acting player changed)
      let next = result.state ?? updatePlayer(state, playerIndex, result.player);

      // Gambit: if bonus action is available, spend it and keep the turn.
      const actingPlayer = next.players[playerIndex];
      if (actingPlayer.bonusActionAvailable) {
        next = updatePlayer(next, playerIndex, { bonusActionAvailable: false });
        // Stay on this player's turn (don't call advanceTurn).
        return next;
      }

      return advanceTurn(next, playerIndex, false);
    }

    case MP_ACTIONS.MP_DISCARD_CARD: {
      const { playerIndex, cardUid } = action;
      const activeError = requireActivePlayer(state, playerIndex);
      if (activeError) return err(state, activeError);

      const player = state.players[playerIndex];
      if (player.discards <= 0) return err(state, 'No discards remaining.');

      const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
      if (cardIndex < 0) return err(state, 'Card not in hand.');

      const card = player.hand[cardIndex];
      const hand = player.hand.filter((_, i) => i !== cardIndex);
      const discard = [...player.discard, card];
      const next = updatePlayer(state, playerIndex, {
        hand,
        discard,
        discards: player.discards - 1,
      });
      return advanceTurn(next, playerIndex, false);
    }

    case MP_ACTIONS.MP_PURGE_CARDS: {
      const { playerIndex, cardUids } = action;
      const activeError = requireActivePlayer(state, playerIndex);
      if (activeError) return err(state, activeError);

      const ids = Array.isArray(cardUids) ? cardUids : [];
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length !== 3) return err(state, 'Choose exactly 3 cards to purge.');

      const player = state.players[playerIndex];
      const selected = uniqueIds.map(uid => player.hand.find(c => c.uid === uid));
      if (selected.some(c => !c)) return err(state, 'One or more purge cards are not in hand.');

      const hand = player.hand.filter(c => !uniqueIds.includes(c.uid));
      const discard = [...player.discard, ...selected];
      const next = updatePlayer(state, playerIndex, {
        hand,
        discard,
        discards: player.discards + 1,
      });
      return advanceTurn(next, playerIndex, false);
    }

    case MP_ACTIONS.MP_SWAP_SPREAD: {
      const { playerIndex, slotA, slotB } = action;
      const activeError = requireActivePlayer(state, playerIndex);
      if (activeError) return err(state, activeError);

      const player = state.players[playerIndex];
      if (!player.swapAvailable) {
        return err(state, 'No swap available. Surgeon persona required once per round.');
      }
      if (slotA < 0 || slotA >= MP_SPREAD_SIZE || slotB < 0 || slotB >= MP_SPREAD_SIZE) {
        return err(state, 'Invalid slot index for swap.');
      }
      if (slotA === slotB) {
        return err(state, 'Cannot swap a slot with itself.');
      }

      const spread = [...player.spread];
      [spread[slotA], spread[slotB]] = [spread[slotB], spread[slotA]];

      // If the anchored slot was swapped, update its index
      let { anchoredSlotIndex } = player;
      if (anchoredSlotIndex === slotA) anchoredSlotIndex = slotB;
      else if (anchoredSlotIndex === slotB) anchoredSlotIndex = slotA;

      // Free action: does NOT advance the turn
      return updatePlayer(state, playerIndex, { spread, anchoredSlotIndex, swapAvailable: false });
    }

    case MP_ACTIONS.MP_SCORE_ROUND: {
      if (state.phase !== MP_PHASES.SCORING) {
        return err(state, 'Cannot score in phase: ' + state.phase);
      }

      const p0Score = scoreSpread(state.players[0]);
      const p1Score = scoreSpread(state.players[1]);

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

      let next = state;
      let uid = state.nextInjectedUid;

      for (let i = 0; i < 2; i++) {
        const p = next.players[i];
        // Interaction cards persist in the player's deck cycle, but they do not stay on the table between rounds.
        const spreadCards = p.spread.filter(Boolean);
        const handInteraction = p.hand.filter(c => c.type === 'interaction');
        const handNormal = p.hand.filter(c => c.type !== 'interaction');
        const discard = [...p.discard, ...spreadCards, ...handInteraction];

        const resetPlayer = {
          ...p,
          hand: handNormal,
          spread: Array(MP_SPREAD_SIZE).fill(null),
          discard,
          discards: startingDiscardsForPersona(p.persona),
          roundScore: 0,
          anchoredSlotIndex: null,
          playedSlotHistory: [],
          silencedCardUids: [],
          bonusActionAvailable: false,
          swapAvailable: false,
        };
        // Draw back up to persona hand size, then apply round-start passives.
        const target = handSizeForPersona(p.persona);
        const needed = target - resetPlayer.hand.length;
        const filled = needed > 0 ? drawCards(resetPlayer, needed) : resetPlayer;
        const passiveResult = applyRoundStartPassives(filled, uid);
        next = updatePlayer(next, i, passiveResult.player);
        uid = passiveResult.nextUid;
      }

      const firstPlayer = (state.round % 2 === 0) ? 0 : 1;

      return {
        ...next,
        phase: MP_PHASES.PLACEMENT,
        round: state.round + 1,
        activePlayerIndex: firstPlayer,
        finalTurnForIndex: null,
        nextInjectedUid: uid,
      };
    }

    default:
      return state;
  }
}