import { MP_ACTIONS } from '../src/multiplayer/mpActions.mjs';
import { MP_PHASES, SCORE_TARGETS, MP_HAND_SIZE, MP_STARTING_DISCARDS, createMatchState } from '../src/multiplayer/mpState.mjs';
import { mpReducer } from '../src/multiplayer/mpReducer.mjs';
import * as sel from '../src/multiplayer/mpSelectors.mjs';
import { PERSONAS } from '../src/multiplayer/personas.mjs';
import { makeInteractionCard } from '../src/multiplayer/interactionCards.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function initMatch(opts = {}) {
  const state = createMatchState(opts);
  return mpReducer(state, { type: MP_ACTIONS.MP_INIT, scoreTarget: opts.scoreTarget ?? SCORE_TARGETS.QUICK, personas: opts.personas ?? [null, null] });
}

// The real game (src/app/mpGame.mjs) never dispatches MP_PLACE_CARD/
// MP_INVOKE_ABILITY/MP_SWAP_SPREAD directly — every action goes through
// MP_SUBMIT_ACTION, which queues per-player and only resolves once both
// players have locked in. Surgeon's free swap only works if a player can
// submit a second (real) action before the opponent acts, so tests that
// exercise it must dispatch this way too.
function submit(state, playerIndex, action) {
  return mpReducer(state, { type: MP_ACTIONS.MP_SUBMIT_ACTION, playerIndex, action: { ...action, playerIndex } });
}

function updatePlayerForTest(state, index, patch) {
  const players = state.players.map((p, i) => i === index ? { ...p, ...patch } : p);
  return { ...state, players };
}

function countBanishEverywhere(player) {
  return [...player.hand, ...player.deck, ...player.discard, ...player.spread.filter(Boolean)]
    .filter(c => c.id === 'mp_banish').length;
}

function putBanishInHandFromDeck(state, playerIndex) {
  const player = state.players[playerIndex];
  let banishCard = player.hand.find(c => c.id === 'mp_banish');
  if (banishCard) return { state, banishCard };

  banishCard = player.deck.find(c => c.id === 'mp_banish');
  assert(!!banishCard, `test setup: player ${playerIndex} has Banish in deck`);
  if (!banishCard) return { state, banishCard: null };

  const deck = player.deck.filter(c => c.uid !== banishCard.uid);
  const hand = [banishCard, ...player.hand];
  return {
    state: updatePlayerForTest(state, playerIndex, { deck, hand, discards: Math.max(player.discards, 1) }),
    banishCard,
  };
}

// -----------------------------------------------------------------------
// Persona catalogue smoke test
// -----------------------------------------------------------------------
{
  assert(Object.keys(PERSONAS).length >= 5, 'at least 5 personas defined');
  for (const p of Object.values(PERSONAS)) {
    assert(typeof p.name === 'string' && p.name.length > 0, `persona ${p.id} has a name`);
    assert(typeof p.tagline === 'string', `persona ${p.id} has a tagline`);
    assert(typeof p.ability?.name === 'string' && p.ability.name.length > 0, `persona ${p.id} has an ability name`);
    assert(typeof p.ability?.tag === 'string' && p.ability.tag.length > 0, `persona ${p.id} has ability tag`);
    assert(typeof p.ability?.rules === 'string' && p.ability.rules.length > 0, `persona ${p.id} has ability rules text`);
    assert(typeof p.passives === 'object', `persona ${p.id} has passives`);
  }
}

// -----------------------------------------------------------------------
// The Hoarder — hand size +1, discards -1
// -----------------------------------------------------------------------
{
  const s = initMatch({ personas: ['hoarder', null] });
  assert(s.players[0].hand.length === MP_HAND_SIZE + 1, 'Hoarder: hand size +1');
  assert(s.players[0].discards === MP_STARTING_DISCARDS - 1, 'Hoarder: starting discards -1');
  assert(s.players[1].hand.length === MP_HAND_SIZE, 'non-Hoarder: normal hand size');
  assert(s.players[1].discards === MP_STARTING_DISCARDS, 'non-Hoarder: normal discards');
}

// -----------------------------------------------------------------------
// The Cleaner — 3 Banish added to deck once at game start
// -----------------------------------------------------------------------
{
  const s = initMatch({ personas: ['cleaner', null] });
  const banishCards = s.players[0].deck.filter(c => c.id === 'mp_banish');
  assert(banishCards.length === 3, 'Cleaner: starts with 3 Banish cards in deck');
  assert(banishCards.every(c => c.type === 'interaction'), 'Banish cards have type interaction');
  assert(banishCards.every(c => c.playerOwner === 0), 'Banish cards owned by player 0');
  assert(countBanishEverywhere(s.players[0]) === 3, 'Cleaner: exactly 3 Banish cards exist at match start');
}

// -----------------------------------------------------------------------
// The Gambit — Discard a card, Draw cards equal to its Value (points),
// dispatched the way the real game does (MP_SUBMIT_ACTION), via a
// dedicated MP_DISCARD_DRAW action. Once per round; behaves like a normal
// turn-ending action (unlike Surgeon's free swap).
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['gambit', null] });
  assert(s.players[0].discardDrawAvailable === true, 'Gambit: discardDrawAvailable starts true');
  assert(sel.canDiscardDraw(s, 0), 'selector: canDiscardDraw is true at match start');

  const startingHandSize = s.players[0].hand.length;
  const card = s.players[0].hand[0];
  s = submit(s, 0, { type: MP_ACTIONS.MP_DISCARD_DRAW, cardUid: card.uid });
  assert(s.error === null, 'Gambit: Discard-Draw submits without error');
  assert(!sel.isPlayerTurn(s, 0), 'Gambit: Discard-Draw locks the exchange like a normal action');

  // Nothing has actually landed yet — the opponent hasn't acted this exchange.
  assert(s.players[0].hand.some(c => c.uid === card.uid), 'Gambit: discarded card stays in hand until the opponent also acts');
  assert(s.players[0].hand.length === startingHandSize, 'Gambit: hand size unchanged until resolution');
  assert(s.players[0].discardDrawAvailable === true, 'Gambit: discardDrawAvailable canonically unchanged until resolution');

  // A second submission this exchange (already locked) is rejected.
  const otherCard = s.players[0].hand.find(c => c.uid !== card.uid);
  const secondAttempt = submit(s, 0, { type: MP_ACTIONS.MP_DISCARD_DRAW, cardUid: otherCard.uid });
  assert(secondAttempt.error !== null, 'Gambit: a second submission in the same exchange is rejected');

  // Opponent acts — NOW the exchange resolves.
  const oppSlot = sel.emptySlots(s, 1)[0];
  s = submit(s, 1, { type: MP_ACTIONS.MP_PLACE_CARD, cardUid: s.players[1].hand[0].uid, slotIndex: oppSlot });
  assert(s.error === null, 'Gambit: opponent action resolves the exchange without error');
  assert(!s.players[0].hand.some(c => c.uid === card.uid), 'Gambit: discarded card left the hand once resolved');
  assert(s.players[0].discard.some(c => c.uid === card.uid), 'Gambit: discarded card landed in the discard pile');
  assert(s.players[0].hand.length === startingHandSize - 1 + card.points, `Gambit: hand grew by its Value (${card.points}) net of the discard`);
  assert(s.players[0].discardDrawAvailable === false, 'Gambit: Discard-Draw consumed once resolved');
  assert(!sel.canDiscardDraw(s, 0), 'selector: canDiscardDraw is false once consumed');

  // A new exchange, same round: a second Discard-Draw attempt should fail.
  const s2 = submit(s, 0, { type: MP_ACTIONS.MP_DISCARD_DRAW, cardUid: s.players[0].hand[0].uid });
  assert(s2.error !== null, 'Gambit: Discard-Draw is rejected once already used this round');
}

// -----------------------------------------------------------------------
// The Surgeon — free spread/hand swap once per round, dispatched the way
// the real game does (MP_SUBMIT_ACTION). Regression coverage for the same
// bug class as Gambit above: the swap must not lock the player out of also
// submitting their real action (Place/Discard/Purge) in the same exchange.
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['surgeon', null] });
  assert(s.players[0].swapAvailable === true, 'Surgeon: swapAvailable starts true');

  // Round 1: both players place normally so P0 has a spread card to swap out.
  s = submit(s, 0, { type: MP_ACTIONS.MP_PLACE_CARD, cardUid: s.players[0].hand[0].uid, slotIndex: 0 });
  s = submit(s, 1, { type: MP_ACTIONS.MP_PLACE_CARD, cardUid: s.players[1].hand[0].uid, slotIndex: 0 });
  assert(s.players[0].spread[0] !== null, 'test setup: P0 has a spread card to swap');

  // New exchange: P0 submits the free swap first.
  const spreadCard = s.players[0].spread[0];
  const handCard = s.players[0].hand[0];
  s = submit(s, 0, { type: MP_ACTIONS.MP_SWAP_SPREAD, slotIndex: 0, cardUid: handCard.uid });
  assert(s.error === null, 'Surgeon: swap submits without error');
  assert(sel.isPlayerTurn(s, 0), 'Surgeon: still my turn after swap (free action, not locked)');
  assert(s.players[0].swapAvailable === true, 'Surgeon: swapAvailable canonically unchanged until resolution');
  assert(!sel.canSwapSpread(s, 0), 'Surgeon: canSwapSpread accounts for the swap already queued this exchange');

  // The swap alone doesn't end the turn — P0 still submits their real action.
  const emptySlot = sel.emptySlots(s, 0)[0];
  const cardToPlace = s.players[0].hand.find(c => c.uid !== handCard.uid);
  assert(cardToPlace && emptySlot !== undefined, 'test setup: a card and empty slot are available for the real action');
  s = submit(s, 0, { type: MP_ACTIONS.MP_PLACE_CARD, cardUid: cardToPlace.uid, slotIndex: emptySlot });
  assert(s.error === null, 'Surgeon: real action after the swap submits without error');
  assert(!sel.isPlayerTurn(s, 0), 'Surgeon: turn locks once the real action is submitted');

  // Nothing has actually landed yet — the opponent hasn't acted this exchange.
  assert(s.players[0].spread[0]?.uid === spreadCard.uid, 'Surgeon: swap stays queued until the opponent also acts');
  assert(s.players[0].spread[emptySlot] === null, 'Surgeon: real action stays queued until the opponent also acts');

  // Opponent acts — NOW the whole exchange (swap + real action) resolves.
  const oppSlot = sel.emptySlots(s, 1)[0];
  s = submit(s, 1, { type: MP_ACTIONS.MP_PLACE_CARD, cardUid: s.players[1].hand[0].uid, slotIndex: oppSlot });
  assert(s.error === null, 'Surgeon: opponent action resolves the exchange without error');
  assert(s.players[0].spread[0]?.uid === handCard.uid, 'Surgeon: spread slot now has former hand card once resolved');
  assert(s.players[0].hand.some(c => c.uid === spreadCard.uid), 'Surgeon: hand now contains former spread card once resolved');
  assert(!s.players[0].hand.some(c => c.uid === handCard.uid), 'Surgeon: hand no longer contains swapped-in hand card');
  assert(s.players[0].spread[emptySlot]?.uid === cardToPlace.uid, 'Surgeon: the real action also landed once resolved');
  assert(s.players[0].swapAvailable === false, 'Surgeon: swap consumed once resolved');

  // A new exchange, same round: a second swap attempt should fail.
  const nextHandCard = s.players[0].hand[0];
  const s2 = submit(s, 0, { type: MP_ACTIONS.MP_SWAP_SPREAD, slotIndex: 0, cardUid: nextHandCard.uid });
  assert(s2.error !== null, 'Surgeon: second swap this round is rejected');
}

// -----------------------------------------------------------------------
// The Anchor — first placed card is protected
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: [null, 'anchor'] });
  // P0 goes first; let P1 place their first card
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand[0].uid, slotIndex: 2 });
  // P1 places at slot 3 — this should become anchored
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 3 });
  assert(s.players[1].anchoredSlotIndex === 3, 'Anchor: first placed card slot is anchored');

  // P0 places a second card, giving P1's turn back
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand[0].uid, slotIndex: 1 });
  // P1 places a second card at slot 0 — NOT anchored
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 0 });
  assert(s.players[1].anchoredSlotIndex === 3, 'Anchor: second placed card does not change anchored slot');
  assert(sel.isSlotAnchored(s, 1, 3), 'selector: isSlotAnchored is true for slot 3');
  assert(!sel.isSlotAnchored(s, 1, 0), 'selector: isSlotAnchored is false for slot 0');
}

// -----------------------------------------------------------------------
// Banish — remove opponent's last played card
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['cleaner', null] });
  const setup = putBanishInHandFromDeck(s, 0);
  s = setup.state;
  const banishCard = setup.banishCard;
  assert(banishCard !== undefined, 'Banish card available to Cleaner');

  // Place a card for P1 first (alternate turns properly)
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand.find(c => c.id !== 'mp_banish').uid, slotIndex: 0 });
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 2 });

  const cardInP1Slot2 = s.players[1].spread[2];
  assert(cardInP1Slot2 !== null, 'P1 has a card in slot 2');

  // P0 invokes Banish with no target — it removes P1's last played card.
  const freshBanish = s.players[0].hand.find(c => c.id === 'mp_banish');
  s = mpReducer(s, { type: MP_ACTIONS.MP_INVOKE_ABILITY, playerIndex: 0, cardUid: freshBanish.uid });
  assert(s.error === null, 'Banish: no error');
  assert(s.players[1].spread[2] === null, 'Banish: last played slot 2 is now empty');
  assert(s.players[1].discard.some(c => c.uid === cardInP1Slot2.uid), 'Banish: removed card in P1 discard');
  assert(sel.isPlayerTurn(s, 1), 'Banish: turn passes after invoke');
}

// -----------------------------------------------------------------------
// Banish blocked by Anchor
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['cleaner', 'anchor'] });
  const setup = putBanishInHandFromDeck(s, 0);
  s = setup.state;

  // P0 places first
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand.find(c => c.id !== 'mp_banish').uid, slotIndex: 0 });
  // P1 places first card — becomes anchored
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 1 });
  const anchoredSlot = s.players[1].anchoredSlotIndex;
  assert(anchoredSlot === 1, 'Anchor setup: P1 slot 1 is anchored');

  // P0 tries to Banish the opponent's last played card, which is anchored.
  const freshBanish = s.players[0].hand.find(c => c.id === 'mp_banish');
  const s2 = mpReducer(s, { type: MP_ACTIONS.MP_INVOKE_ABILITY, playerIndex: 0, cardUid: freshBanish.uid });
  assert(s2.error !== null, 'Banish blocked by Anchor');
  assert(s2.players[1].spread[anchoredSlot] !== null, 'Anchored card not removed');
}

// -----------------------------------------------------------------------
// Seal — silences a card (excluded from scoring)
// -----------------------------------------------------------------------
{
  // Build a state with a Seal card in P0's hand by manually constructing it
  let s = initMatch();
  // Force a seal card into P0's hand for test purposes
  const sealCard = makeInteractionCard('mp_seal', 8999, 0);
  s = updatePlayerForTest(s, 0, { hand: [sealCard, ...s.players[0].hand], discards: 3 });

  // P1 places a card at slot 0
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand.find(c => c.id !== 'mp_seal').uid, slotIndex: 0 });
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 0 });

  const sealedCard = s.players[1].spread[0];
  assert(sealedCard !== null, 'P1 has card in slot 0 to seal');

  s = mpReducer(s, { type: MP_ACTIONS.MP_INVOKE_ABILITY, playerIndex: 0, cardUid: sealCard.uid, target: { playerIndex: 1, slotIndex: 0 } });
  assert(s.error === null, 'Seal: no error');
  assert(s.players[1].silencedCardUids.includes(sealedCard.uid), 'Seal: card UID is silenced');
  assert(sel.isCardSilenced(s, 1, sealedCard.uid), 'selector: isCardSilenced is true');

  // Score the round — silenced card should not contribute
  // Force into scoring phase
  s = { ...s, phase: MP_PHASES.SCORING };
  const scored = mpReducer(s, { type: MP_ACTIONS.MP_SCORE_ROUND });
  const roundScoreWithSeal = scored.roundHistory[0].scores[1];
  // Score without seal for comparison
  let sNoSeal = initMatch();
  sNoSeal = updatePlayerForTest(sNoSeal, 1, {
    spread: [sealedCard, null, null, null, null],
    silencedCardUids: [],
  });
  sNoSeal = { ...sNoSeal, phase: MP_PHASES.SCORING };
  const scoredNoSeal = mpReducer(sNoSeal, { type: MP_ACTIONS.MP_SCORE_ROUND });
  const roundScoreWithout = scoredNoSeal.roundHistory[0].scores[1];
  assert(roundScoreWithSeal < roundScoreWithout || sealedCard.points === 0,
    `Seal: silenced card reduces P1 score (${roundScoreWithSeal} < ${roundScoreWithout})`);
}

// -----------------------------------------------------------------------
// Cleaner does not create new Banish cards at new round
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['cleaner', null] });
  assert(countBanishEverywhere(s.players[0]) === 3, 'Cleaner: 3 Banish before round 2');
  // Force BETWEEN_ROUNDS
  s = { ...s, phase: MP_PHASES.BETWEEN_ROUNDS };
  s = mpReducer(s, { type: MP_ACTIONS.MP_NEW_ROUND });
  assert(countBanishEverywhere(s.players[0]) === 3, 'Cleaner: still only 3 Banish after round 2 start');
}

// -----------------------------------------------------------------------
// Surgeon: swap does not disturb opponent anchored slot
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['surgeon', 'anchor'] });
  // P0 goes first
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand[0].uid, slotIndex: 0 });
  // P1 places first card at slot 2 (anchored)
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 2 });
  assert(s.players[1].anchoredSlotIndex === 2, 'Anchor check: P1 slot 2 anchored');
  // P0 places second card
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand[0].uid, slotIndex: 1 });
  // P1 places at slot 4
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 4 });

  // Now P0's turn — P0 uses Surgeon swap between spread slot 0 and hand
  const handCard = s.players[0].hand[0];
  s = mpReducer(s, { type: MP_ACTIONS.MP_SWAP_SPREAD, playerIndex: 0, slotIndex: 0, cardUid: handCard.uid });
  assert(s.error === null, 'Surgeon + Anchor setup swap: no error');

  // P1 is still Anchor — try Banish on a non-anchored slot (slot 4)
  // First P1 needs a turn — P0 places
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 0, cardUid: s.players[0].hand[0].uid, slotIndex: 2 });
  // But we need P0 to have a Banish — this is just checking Anchor didn't break
  assert(s.players[1].anchoredSlotIndex === 2, 'Anchor: anchored slot index unchanged by opponent swap');
}

if (failed > 0) {
  console.error(`Persona validation: ${failed} case(s) failed.`);
  process.exit(1);
} else {
  console.log(`Persona validation cases passed (${passed} assertions).`);
}
