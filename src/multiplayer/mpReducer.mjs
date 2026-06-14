import { MP_ACTIONS } from './mpActions.mjs';
import { MP_PHASES, MP_SPREAD_SIZE, createMatchState, startingDiscardsForPersona, applyGameStartPassives, applyRoundStartPassives, handSizeForPersona } from './mpState.mjs';
import { computeScore } from '../systems/scoring.mjs';
import { shuffleDeck } from '../systems/deck.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { MP_ABILITY_TYPES } from './interactionCards.mjs';
import { getPersona } from './personas.mjs';
import { mulberry32 } from './mpRng.mjs';
import { abilityHeldCards, applyAbilityTake } from '../systems/abilities.mjs';

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
  return state.phase === MP_PHASES.PLACEMENT;
}

function canSubmit(state, playerIndex) {
  if (!isActionPhase(state)) return 'Cannot act in phase: ' + state.phase;
  if (playerIndex !== 0 && playerIndex !== 1) return 'Invalid player.';
  if (state.pendingActions?.[playerIndex]) return 'Action already submitted.';
  return null;
}

function sanitizeSubmittedAction(playerIndex, action) {
  if (!action || typeof action !== 'object') return null;
  const allowed = new Set([
    MP_ACTIONS.MP_PLACE_CARD,
    MP_ACTIONS.MP_INVOKE_ABILITY,
    MP_ACTIONS.MP_DISCARD_CARD,
    MP_ACTIONS.MP_PURGE_CARDS,
    MP_ACTIONS.MP_SWAP_SPREAD,
  ]);
  if (!allowed.has(action.type)) return null;
  return { ...action, playerIndex };
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
    if (!deck.length) break;
    hand.push(deck.shift());
  }

  return { ...player, deck, discard, hand };
}

function orderedCardsFromUids(cards, uidOrder) {
  const pool = new Map(cards.map(card => [card.uid, card]));
  const out = [];
  for (const uid of Array.isArray(uidOrder) ? uidOrder : []) {
    const card = pool.get(uid);
    if (!card) continue;
    out.push(card);
    pool.delete(uid);
  }
  return { ordered: out, remaining: [...pool.values()] };
}

function takeFromHeld(player, heldCards, takenCardUid) {
  const applied = applyAbilityTake(player, (heldCards || []).filter(Boolean), takenCardUid);
  return applied ? { ...player, deck: applied.deck, hand: applied.hand } : player;
}

function inPlayCards(player) {
  return [...(player.hand || []), ...(player.spread || []).filter(Boolean)];
}

function anchorByUid(player, uid) {
  return inPlayCards(player).find(card => card.uid === uid) || null;
}

function relationHeldCards(player, ability, choice) {
  const anchorIds = Array.isArray(choice?.anchorUids) ? choice.anchorUids : [];
  const anchors = anchorIds.map(uid => anchorByUid(player, uid));
  if (!anchors[0]) return [];
  if (ability.type === ABILITY_TYPES.BETWEEN && !anchors[1]) return [];
  const held = abilityHeldCards(player.deck, ability, anchors);
  // Between reveals every card in the window; relation abilities cap by count.
  return ability.type === ABILITY_TYPES.BETWEEN ? held : held.slice(0, ability.count ?? 2);
}

// Apply a standard (non-interaction) card ability to a multiplayer player.
// The acting client computes its anchor/take selections in mpGame and passes
// them as plain `choice` fields; both peers replay this pure resolution so the
// match state stays in sync. Reveal computation is shared with singleplayer via
// abilityHeldCards; ordering-sensitive abilities (search/world) carry an explicit
// uid order in `choice` because the multiplayer reducer has no shared RNG.
function applyStandardAbility(player, ability, choice = {}) {
  if (!ability) return player;

  if (choice?.fallbackDraw) {
    return drawCards(player, Number(choice.fallbackDraw) || 1);
  }

  if (ability.type === ABILITY_TYPES.DRAW) {
    return drawCards(player, ability.count ?? 1);
  }

  if (ability.type === ABILITY_TYPES.PEEK) {
    const held = player.deck.slice(0, ability.count ?? 1);
    return takeFromHeld(player, held, choice?.takenCardUid);
  }

  if (ability.type === ABILITY_TYPES.SEARCH) {
    const taken = player.deck.find(card => card.uid === choice?.takenCardUid);
    if (!taken) return player;
    const withoutTaken = player.deck.filter(card => card.uid !== taken.uid);
    const ordered = orderedCardsFromUids(withoutTaken, choice?.deckOrderUids);
    return { ...player, hand: [...player.hand, taken], deck: [...ordered.ordered, ...ordered.remaining] };
  }

  if (ability.type === ABILITY_TYPES.NEIGHBOR || ability.type === ABILITY_TYPES.KIN || ability.type === ABILITY_TYPES.MIRROR || ability.type === ABILITY_TYPES.BETWEEN) {
    return takeFromHeld(player, relationHeldCards(player, ability, choice), choice?.takenCardUid);
  }

  if (ability.type === ABILITY_TYPES.WORLD) {
    const pool = [...player.deck, ...player.discard, ...player.hand, ...player.spread.filter(Boolean)];
    const handResult = orderedCardsFromUids(pool, choice?.handUids);
    const deckResult = orderedCardsFromUids(handResult.remaining, choice?.deckUids);
    if (!handResult.ordered.length && !deckResult.ordered.length) return player;
    return {
      ...player,
      hand: handResult.ordered,
      deck: [...deckResult.ordered, ...deckResult.remaining],
      discard: [],
      spread: Array(MP_SPREAD_SIZE).fill(null),
      playedSlotHistory: [],
      anchoredSlotIndex: null,
      silencedCardUids: [],
    };
  }

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

    if (targetPlayer.anchoredSlotIndex === targetSlot) {
      return { error: 'That card is anchored and cannot be removed.' };
    }

    const removedCard = targetPlayer.spread[targetSlot];
    const newSpread = targetPlayer.spread.map((c, i) => i === targetSlot ? null : c);
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

    if (targetPlayer.anchoredSlotIndex === targetSlot) {
      return { error: 'That card is anchored and cannot be silenced.' };
    }

    const silenced = [...targetPlayer.silencedCardUids, targetCard.uid];
    const nextState = updatePlayer(state, targetPlayerIdx, { silencedCardUids: silenced });
    return { nextState };
  }

  return { error: 'Unknown interaction ability: ' + abilityType };
}

function applyInvoke(state, playerIndex, cardUid, target, abilityChoice) {
  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
  if (cardIndex < 0) return { error: 'Card not in hand.' };
  if (player.discards <= 0) return { error: 'No discards remaining.' };

  const card = player.hand[cardIndex];
  const hand = player.hand.filter((_, i) => i !== cardIndex);
  const discard = [...player.discard, card];
  let updatedPlayer = { ...player, hand, discard, discards: player.discards - 1 };

  if (card.abilityType) {
    const result = applyInteractionAbility(updatePlayer(state, playerIndex, updatedPlayer), playerIndex, card, target);
    if (result.error) return { error: result.error };
    return { state: result.nextState };
  }

  const ability = card.ability ? getAbility(card.ability) : null;
  updatedPlayer = applyStandardAbility(updatedPlayer, ability, abilityChoice);
  return { player: updatedPlayer };
}

function scoreSpread(player) {
  const cards = player.spread.filter(c => c !== null && !player.silencedCardUids.includes(c.uid));
  if (!cards.length) return 0;
  return computeScore(cards, { skipFlatBonuses: true, skipRelics: true }).finalScore;
}

function resolveVictory(state) {
  const [p0, p1] = state.players;
  if (p0.totalScore < state.scoreTarget && p1.totalScore < state.scoreTarget) return null;
  if (p0.totalScore === p1.totalScore) return 'draw';
  return p0.totalScore > p1.totalScore ? 0 : 1;
}

function applyImmediateAction(state, action) {
  switch (action.type) {
    case MP_ACTIONS.MP_PLACE_CARD: {
      const { playerIndex, cardUid, slotIndex } = action;
      if (!isActionPhase(state)) return err(state, 'Cannot act in phase: ' + state.phase);

      const player = state.players[playerIndex];
      if (slotIndex < 0 || slotIndex >= MP_SPREAD_SIZE) return err(state, 'Invalid slot index: ' + slotIndex);
      if (player.spread[slotIndex] !== null) return err(state, 'Slot already occupied.');
      const cardIdx = player.hand.findIndex(c => c.uid === cardUid);
      if (cardIdx < 0) return err(state, 'Card not in hand.');

      const card = player.hand[cardIdx];
      const hand = player.hand.filter((_, i) => i !== cardIdx);
      const spread = player.spread.map((s, i) => i === slotIndex ? card : s);
      const playedSlotHistory = [...(player.playedSlotHistory || []), slotIndex];

      const wasEmpty = player.spread.every(s => s === null);
      const anchoredSlotIndex = wasEmpty && getPersona(player.persona)?.passives?.anchoredFirstCard
        ? slotIndex
        : player.anchoredSlotIndex;

      return updatePlayer(state, playerIndex, { hand, spread, anchoredSlotIndex, playedSlotHistory });
    }

    case MP_ACTIONS.MP_INVOKE_ABILITY: {
      const { playerIndex, cardUid, target, abilityChoice } = action;
      if (!isActionPhase(state)) return err(state, 'Cannot act in phase: ' + state.phase);

      const result = applyInvoke(state, playerIndex, cardUid, target, abilityChoice);
      if (result.error) return err(state, result.error);

      let next = result.state ?? updatePlayer(state, playerIndex, result.player);
      const actingPlayer = next.players[playerIndex];
      if (actingPlayer.bonusActionAvailable) next = updatePlayer(next, playerIndex, { bonusActionAvailable: false });
      return next;
    }

    case MP_ACTIONS.MP_DISCARD_CARD: {
      const { playerIndex, cardUid } = action;
      if (!isActionPhase(state)) return err(state, 'Cannot act in phase: ' + state.phase);

      const player = state.players[playerIndex];
      if (player.discards <= 0) return err(state, 'No discards remaining.');
      const cardIndex = player.hand.findIndex(c => c.uid === cardUid);
      if (cardIndex < 0) return err(state, 'Card not in hand.');

      const card = player.hand[cardIndex];
      const hand = player.hand.filter((_, i) => i !== cardIndex);
      const discard = [...player.discard, card];
      return updatePlayer(state, playerIndex, { hand, discard, discards: player.discards - 1 });
    }

    case MP_ACTIONS.MP_PURGE_CARDS: {
      const { playerIndex, cardUids } = action;
      if (!isActionPhase(state)) return err(state, 'Cannot act in phase: ' + state.phase);

      const ids = Array.isArray(cardUids) ? cardUids : [];
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length !== 3) return err(state, 'Choose exactly 3 cards to purge.');

      const player = state.players[playerIndex];
      const selected = uniqueIds.map(uid => player.hand.find(c => c.uid === uid));
      if (selected.some(c => !c)) return err(state, 'One or more purge cards are not in hand.');

      const hand = player.hand.filter(c => !uniqueIds.includes(c.uid));
      const discard = [...player.discard, ...selected];
      return updatePlayer(state, playerIndex, { hand, discard, discards: player.discards + 1 });
    }

    case MP_ACTIONS.MP_SWAP_SPREAD: {
      const { playerIndex, slotIndex, cardUid } = action;
      if (!isActionPhase(state)) return err(state, 'Cannot act in phase: ' + state.phase);

      const player = state.players[playerIndex];
      if (!player.swapAvailable) return err(state, 'No swap available. Surgeon persona required once per round.');
      if (slotIndex < 0 || slotIndex >= MP_SPREAD_SIZE) return err(state, 'Invalid spread slot for swap.');

      const spreadCard = player.spread[slotIndex];
      if (!spreadCard) return err(state, 'Choose a card in your Spread to swap.');
      const handIndex = player.hand.findIndex(c => c.uid === cardUid);
      if (handIndex < 0) return err(state, 'Choose a card in your Hand to swap.');

      const handCard = player.hand[handIndex];
      const spread = player.spread.map((card, i) => i === slotIndex ? handCard : card);
      const hand = player.hand.map((card, i) => i === handIndex ? spreadCard : card);
      return updatePlayer(state, playerIndex, { hand, spread, swapAvailable: false });
    }

    default:
      return state;
  }
}

function resolvePendingActions(state) {
  const actions = state.pendingActions ?? [null, null];
  let next = { ...state, pendingActions: [null, null] };
  for (const action of actions) {
    if (action) next = applyImmediateAction(next, action);
  }
  if (next.error) return next;
  if (next.players.every(p => spreadFull(p.spread))) return { ...next, phase: MP_PHASES.SCORING };
  return { ...next, phase: MP_PHASES.PLACEMENT };
}

export function mpReducer(state, action) {
  if (!state) state = createMatchState();
  state = clearError(state);

  switch (action.type) {
    case MP_ACTIONS.MP_INIT: {
      const rng = action.seed != null ? mulberry32(action.seed) : (action.rng || Math.random);
      const personas = action.personas ?? [null, null];
      let next = {
        ...createMatchState({ scoreTarget: action.scoreTarget ?? state.scoreTarget, rng, personas }),
        phase: MP_PHASES.PLACEMENT,
        round: 1,
        pendingActions: [null, null],
      };
      let uid = next.nextInjectedUid;
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

    case MP_ACTIONS.MP_SUBMIT_ACTION: {
      const playerIndex = action.playerIndex;
      const submitError = canSubmit(state, playerIndex);
      if (submitError) return err(state, submitError);

      const submitted = sanitizeSubmittedAction(playerIndex, action.action);
      if (!submitted) return err(state, 'Invalid submitted action.');

      const pendingActions = [...(state.pendingActions ?? [null, null])];
      pendingActions[playerIndex] = submitted;
      const next = { ...state, pendingActions };
      return pendingActions.every(Boolean) ? resolvePendingActions(next) : next;
    }

    case MP_ACTIONS.MP_PLACE_CARD:
    case MP_ACTIONS.MP_INVOKE_ABILITY:
    case MP_ACTIONS.MP_DISCARD_CARD:
    case MP_ACTIONS.MP_PURGE_CARDS:
    case MP_ACTIONS.MP_SWAP_SPREAD: {
      const next = applyImmediateAction(state, action);
      if (next.error) return next;
      if (next.players.every(p => spreadFull(p.spread))) return { ...next, phase: MP_PHASES.SCORING };
      return next;
    }

    case MP_ACTIONS.MP_SCORE_ROUND: {
      if (state.phase !== MP_PHASES.SCORING) return err(state, 'Cannot score in phase: ' + state.phase);

      const p0Score = scoreSpread(state.players[0]);
      const p1Score = scoreSpread(state.players[1]);
      let next = updatePlayer(state, 0, { roundScore: p0Score, totalScore: state.players[0].totalScore + p0Score });
      next = updatePlayer(next, 1, { roundScore: p1Score, totalScore: state.players[1].totalScore + p1Score });

      const history = [
        ...state.roundHistory,
        { scores: [p0Score, p1Score], totals: [next.players[0].totalScore, next.players[1].totalScore] },
      ];
      next = { ...next, roundHistory: history, pendingActions: [null, null] };

      const winner = resolveVictory(next);
      if (winner !== null) return { ...next, phase: MP_PHASES.COMPLETE, winner };
      return { ...next, phase: MP_PHASES.BETWEEN_ROUNDS };
    }

    case MP_ACTIONS.MP_NEW_ROUND: {
      if (state.phase !== MP_PHASES.BETWEEN_ROUNDS) return err(state, 'Cannot start a new round in phase: ' + state.phase);

      let next = state;
      let uid = state.nextInjectedUid;
      for (let i = 0; i < 2; i++) {
        const p = next.players[i];
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
        const targetHandSize = handSizeForPersona(p.persona);
        const needed = targetHandSize - resetPlayer.hand.length;
        const filled = needed > 0 ? drawCards(resetPlayer, needed) : resetPlayer;
        const passiveResult = applyRoundStartPassives(filled, uid);
        next = updatePlayer(next, i, passiveResult.player);
        uid = passiveResult.nextUid;
      }

      return {
        ...next,
        phase: MP_PHASES.PLACEMENT,
        round: state.round + 1,
        activePlayerIndex: 0,
        pendingActions: [null, null],
        nextInjectedUid: uid,
      };
    }

    default:
      return state;
  }
}
