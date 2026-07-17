import { ALL_CARD_DEFINITIONS, MAJOR_ARCANA, ROMAN, SUIT_GLYPHS } from '../data/cards.mjs';

const MAJOR_SUITS_BY_ID = Object.fromEntries(
  MAJOR_ARCANA.filter(c => c.suits).map(c => [c.id, c.suits])
);
const MAJOR_RANK_BY_ID = Object.fromEntries(
  MAJOR_ARCANA.filter(c => c.rank).map(c => [c.id, c.rank])
);

export function buildDeck() {
  return ALL_CARD_DEFINITIONS.map((card, uid) => ({ ...card, uid }));
}

export function buildLegacyDeck({ majors, courts, suits, roman } = {}) {
  const majorRows = majors || [];
  const courtRows = courts || [];
  const suitRows = suits || [];
  const numerals = roman || ROMAN;
  let uid = 0;
  const deck = [];
  for (const [num, name, points, trull, ability] of majorRows) {
    const id = 'major_' + num;
    const card = {
      uid: uid++,
      type: 'major',
      id,
      num,
      number: num,
      name: numerals[num] + ' ' + name,
      points,
      trull,
      ability,
    };
    if (MAJOR_SUITS_BY_ID[id]) card.suits = MAJOR_SUITS_BY_ID[id];
    if (MAJOR_RANK_BY_ID[id]) card.rank = MAJOR_RANK_BY_ID[id];
    deck.push(card);
  }
  for (const suit of suitRows) {
    for (const [rank, points, ability] of courtRows) {
      deck.push({
        uid: uid++,
        type: 'court',
        id: 'court_' + suit + '_' + rank,
        suit,
        rank,
        name: rank + ' of ' + suit,
        points,
        ability,
      });
    }
  }
  return deck;
}

export function maxHandSize(persist) {
  const upgrades = persist?.up || {};
  const relics = persist?.relics || [];
  return 5 + (upgrades.hand || 0) - (relics.includes('fool_reversed') ? 1 : 0);
}

export function maxDiscardCount(persist) {
  return 3 + ((persist?.up || {}).discards || 0);
}

export function hasMulligan(persist) {
  return ((persist?.up || {}).mulligan || 0) > 0;
}

export function maxMulliganCount(persist) {
  return (persist?.up || {}).mulligan || 0;
}

export function drawNIntoRun(run, count, { shuffle = shuffleDeck, onDraw } = {}) {
  if (!run || !Array.isArray(run.deck) || !Array.isArray(run.discard) || !Array.isArray(run.hand)) return 0;
  let drew = 0;
  for (let i = 0; i < count; i += 1) {
    if (!run.deck.length && run.discard.length) run.deck = shuffle(run.discard.splice(0));
    if (!run.deck.length) break;
    run.hand.push(run.deck.shift());
    drew += 1;
  }
  if (drew && typeof onDraw === 'function') onDraw(drew);
  return drew;
}

export function drawToHandSize(run, handSize, { onDraw } = {}) {
  if (!run || !Array.isArray(run.deck) || !Array.isArray(run.hand)) return 0;
  let drew = 0;
  while (run.hand.length < handSize && run.deck.length) {
    run.hand.push(run.deck.shift());
    drew += 1;
  }
  if (drew && typeof onDraw === 'function') onDraw(drew);
  return drew;
}

export function shuffleDeck(cards, rng = Math.random) {
  const next = cards.map(card => ({ ...card }));
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function drawCards(deck, count) {
  return {
    drawn: deck.slice(0, count),
    deck: deck.slice(count),
  }
}

export function displayTitle(card) {
  if (card.type === 'major') {
    return `${ROMAN[card.number]} · ${card.name}`;
  }
  if (card.type === 'court') {
    return `${card.rank} of ${SUIT_GLYPHS[card.suit]}`;
  }
  return card.name;
}

export function cardCleanName(card) {
  if (card.type === 'major') return card.name;
  return `${card.rank} of ${card.suit}`;
}

export function uniqueCards(cards) {
  const seen = new Set();
  const out = [];
  for (const card of cards) {
    if (!card || seen.has(card.uid)) continue;
    seen.add(card.uid);
    out.push(card);
  }
  return out;
}
