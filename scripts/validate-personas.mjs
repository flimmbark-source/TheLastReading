import { MP_ACTIONS } from '../src/multiplayer/mpActions.mjs';
import { MP_PHASES, SCORE_TARGETS, MP_HAND_SIZE, MP_STARTING_DISCARDS, createMatchState } from '../src/multiplayer/mpState.mjs';
import { mpReducer } from '../src/multiplayer/mpReducerFixed.mjs';
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
  const p = s.players[0];
  assert(countBanishEverywhere(p) === 3, 'Cleaner: exactly 3 Banish cards exist across zones');
  assert(p.deck.some(c => c.id === 'mp_banish') || p.hand.some(c => c.id === 'mp_banish'), 'Cleaner: Banish cards are available in deck/hand');
}

// -----------------------------------------------------------------------
// The Archivist — +1 discard when purging
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['archivist', null] });
  const p = s.players[0];
  const cards = p.hand.slice(0, 3).map(c => c.uid);
  s = mpReducer(s, { type: MP_ACTIONS.MP_PURGE_CARDS, playerIndex: 0, cardUids: cards });
  assert(s.players[0].discards === p.discards + 2, 'Archivist: purge grants +2 discards total');
}

// -----------------------------------------------------------------------
// The Cleaner Banish card works
// -----------------------------------------------------------------------
{
  let s = initMatch({ personas: ['cleaner', null] });
  s = mpReducer(s, { type: MP_ACTIONS.MP_PLACE_CARD, playerIndex: 1, cardUid: s.players[1].hand[0].uid, slotIndex: 0 });
  const setup = putBanishInHandFromDeck(s, 0);
  s = setup.state;
  const banish = setup.banishCard;
  if (banish) {
    s = mpReducer(s, { type: MP_ACTIONS.MP_DISCARD_CARD, playerIndex: 0, cardUid: banish.uid });
    assert(s.players[1].spread[0] === null, 'Cleaner: Banish removes opponent last played card');
  }
}

if (failed > 0) {
  console.error(`Persona validation failed: ${failed} failed, ${passed} passed`);
  process.exit(1);
}

console.log(`Persona validation passed: ${passed} checks`);
