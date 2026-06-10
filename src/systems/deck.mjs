import { ALL_CARD_DEFINITIONS, ROMAN, SUIT_GLYPHS } from '../data/cards.mjs';

export function buildDeck() {
  return ALL_CARD_DEFINITIONS.map((card, uid) => ({ ...card, uid }));
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
  };
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
