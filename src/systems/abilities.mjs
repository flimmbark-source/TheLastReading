import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';

function majorDefinition(number) {
  return ALL_CARD_DEFINITIONS.find(card => card.type === 'major' && card.number === number) || null;
}

function courtDefinition(suit, rank) {
  return ALL_CARD_DEFINITIONS.find(card => card.type === 'court' && card.suit === suit && card.rank === rank) || null;
}

export function isSameArcana(a, b) {
  if (!a || !b) return false;
  return a.type === b.type;
}

// "Sight" abilities can discount discards via the sight_cost upgrade.
const SIGHT_ABILITY_TYPES = new Set([ABILITY_TYPES.PEEK, ABILITY_TYPES.SEARCH, ABILITY_TYPES.MIRROR]);

export function isSightAbility(abilityId) {
  const ability = getAbility(abilityId);
  return Boolean(ability) && SIGHT_ABILITY_TYPES.has(ability.type);
}

export function mirrorCardId(card) {
  if (!card) return null;
  if (card.type === 'major') {
    const mirrored = majorDefinition(21 - card.number);
    return mirrored?.id || null;
  }

  if (card.type === 'court') {
    const rankOrder = ['Page', 'Knight', 'Queen', 'King'];
    const suitOrder = ['Cups', 'Wands', 'Swords', 'Pentacles'];
    const mirroredRank = rankOrder[rankOrder.length - 1 - rankOrder.indexOf(card.rank)];
    const mirroredSuit = suitOrder[suitOrder.length - 1 - suitOrder.indexOf(card.suit)];
    return courtDefinition(mirroredSuit, mirroredRank)?.id || null;
  }

  return null;
}

export function neighborCardIds(card, distance = 1) {
  if (!card) return [];
  if (card.type === 'major') {
    return [card.number - distance, card.number + distance]
      .map(number => majorDefinition(number)?.id)
      .filter(Boolean);
  }

  if (card.type === 'court') {
    const rankOrder = ['Page', 'Knight', 'Queen', 'King'];
    const index = rankOrder.indexOf(card.rank);
    return [index - distance, index + distance]
      .map(nextIndex => rankOrder[nextIndex])
      .filter(Boolean)
      .map(rank => courtDefinition(card.suit, rank)?.id)
      .filter(Boolean);
  }

  return [];
}

export function betweenCardIds(a, b) {
  if (!a || !b || a.type !== b.type) return [];

  if (a.type === 'major') {
    const low = Math.min(a.number, b.number);
    const high = Math.max(a.number, b.number);
    if (high - low <= 1) return [];
    const out = [];
    for (let number = low + 1; number < high; number += 1) {
      const card = majorDefinition(number);
      if (card) out.push(card.id);
    }
    return out;
  }

  if (a.type === 'court' && a.suit === b.suit) {
    const rankOrder = ['Page', 'Knight', 'Queen', 'King'];
    const ai = rankOrder.indexOf(a.rank);
    const bi = rankOrder.indexOf(b.rank);
    const low = Math.min(ai, bi);
    const high = Math.max(ai, bi);
    if (high - low <= 1) return [];
    const out = [];
    for (let index = low + 1; index < high; index += 1) {
      const card = courtDefinition(a.suit, rankOrder[index]);
      if (card) out.push(card.id);
    }
    return out;
  }

  return [];
}

export function cardsInDeckByIds(deck, ids) {
  const idSet = new Set(ids);
  return deck.filter(card => idSet.has(card.id));
}

export function validHandTargetsForAbility(abilityId, state) {
  const ability = getAbility(abilityId);
  if (!ability) return [];
  const hand = state.hand || [];
  const deck = state.deck || [];

  switch (ability.type) {
    case ABILITY_TYPES.NEIGHBOR:
      return hand.filter(card => cardsInDeckByIds(deck, neighborCardIds(card)).length > 0);

    case ABILITY_TYPES.KIN:
      return hand.filter(card => deck.some(deckCard => isSameArcana(deckCard, card)));

    case ABILITY_TYPES.MIRROR:
      return hand.filter(card => deck.some(deckCard => deckCard.id === mirrorCardId(card)));

    case ABILITY_TYPES.BETWEEN:
      return hand.filter((card, index) => hand.some((other, otherIndex) => otherIndex !== index && cardsInDeckByIds(deck, betweenCardIds(card, other)).length > 0));

    default:
      return hand;
  }
}

export function resolveAbilityRevealIds(abilityId, pickedCards, state) {
  const ability = getAbility(abilityId);
  if (!ability) return [];
  const deck = state.deck || [];
  const picked = pickedCards.filter(Boolean);

  switch (ability.type) {
    case ABILITY_TYPES.NEIGHBOR:
      return picked[0] ? neighborCardIds(picked[0]) : [];

    case ABILITY_TYPES.KIN:
      return picked[0] ? deck.filter(card => isSameArcana(card, picked[0])).slice(0, ability.count).map(card => card.id) : [];

    case ABILITY_TYPES.MIRROR:
      return picked[0] ? [mirrorCardId(picked[0])].filter(Boolean) : [];

    case ABILITY_TYPES.BETWEEN:
      return picked.length >= 2 ? betweenCardIds(picked[0], picked[1]) : [];

    case ABILITY_TYPES.PEEK:
      return deck.slice(0, ability.count).map(card => card.id);

    case ABILITY_TYPES.SEARCH:
      return deck.map(card => card.id);

    default:
      return [];
  }
}

export function resolveAbilityReveals(abilityId, pickedCards, state) {
  return cardsInDeckByIds(state.deck || [], resolveAbilityRevealIds(abilityId, pickedCards, state));
}
