import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { ALL_CARD_DEFINITIONS } from '../data/cards.mjs';
import { shuffleDeck } from './deck.mjs';

const RANK_ORDER = ['Page', 'Knight', 'Queen', 'King'];
const SUIT_ORDER = ['Cups', 'Wands', 'Swords', 'Pentacles'];
// Court ranks mapped onto the 0-21 major ladder for Between with major anchors.
const COURT_LADDER_POSITIONS = [0, 5, 10, 15];

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

export function mirrorCardIds(card) {
  if (!card) return [];
  if (card.type === 'major') {
    const mirrored = majorDefinition(21 - (card.number ?? card.num));
    return mirrored ? [mirrored.id] : [];
  }

  if (card.type === 'court') {
    // Court cards mirror by rank across the whole Court Arcana. A Queen can
    // therefore reach every Knight still in the deck, regardless of suit.
    const mirroredRank = { Page: 'King', King: 'Page', Knight: 'Queen', Queen: 'Knight' }[card.rank];
    if (!mirroredRank) return [];
    return SUIT_ORDER
      .map(suit => courtDefinition(suit, mirroredRank)?.id)
      .filter(Boolean);
  }

  return [];
}

// Kept for callers that require a genuinely singular mirror (Major Arcana).
// Court mirrors are plural by design and therefore return null here.
export function mirrorCardId(card) {
  const ids = mirrorCardIds(card);
  return ids.length === 1 ? ids[0] : null;
}

export function neighborCardIds(card, distance = 1) {
  if (!card) return [];
  if (card.type === 'major') {
    const cardNumber = card.number ?? card.num;
    return [cardNumber - distance, cardNumber + distance]
      .map(number => majorDefinition(number)?.id)
      .filter(Boolean);
  }

  if (card.type === 'court') {
    const index = RANK_ORDER.indexOf(card.rank);
    return [index - distance, index + distance]
      .map(nextIndex => RANK_ORDER[nextIndex])
      .filter(Boolean)
      .map(rank => courtDefinition(card.suit, rank)?.id)
      .filter(Boolean);
  }

  return [];
}

export function betweenCardIds(a, b) {
  if (!a || !b || a.type !== b.type) return [];
  if (a.uid != null && b.uid != null && a.uid === b.uid) return [];

  // Major anchors: majors numerically between, plus courts whose ladder
  // position falls strictly inside the window (any suit).
  if (a.type === 'major') {
    const aNum = a.number ?? a.num;
    const bNum = b.number ?? b.num;
    const low = Math.min(aNum, bNum);
    const high = Math.max(aNum, bNum);
    if (high - low <= 1) return [];
    const out = [];
    for (let number = low + 1; number < high; number += 1) {
      const card = majorDefinition(number);
      if (card) out.push(card.id);
    }
    RANK_ORDER.forEach((rank, index) => {
      const position = COURT_LADDER_POSITIONS[index];
      if (position <= low || position >= high) return;
      for (const suit of SUIT_ORDER) {
        const card = courtDefinition(suit, rank);
        if (card) out.push(card.id);
      }
    });
    return out;
  }

  // Court anchors: ranks strictly between on the rank ladder, any suit.
  if (a.type === 'court') {
    const ai = RANK_ORDER.indexOf(a.rank);
    const bi = RANK_ORDER.indexOf(b.rank);
    if (ai < 0 || bi < 0) return [];
    const low = Math.min(ai, bi);
    const high = Math.max(ai, bi);
    if (high - low <= 1) return [];
    const out = [];
    for (let index = low + 1; index < high; index += 1) {
      for (const suit of SUIT_ORDER) {
        const card = courtDefinition(suit, RANK_ORDER[index]);
        if (card) out.push(card.id);
      }
    }
    return out;
  }

  return [];
}

export function cardsInDeckByIds(deck, ids) {
  const idSet = new Set(ids);
  return deck.filter(card => idSet.has(card.id));
}

export function abilityWithRevealUpgrades(ability, upgrades = {}) {
  if (!ability) return null;
  const next = { ...ability };
  const lens = Math.max(0, Number(upgrades.lens_mastery) || 0);
  const relation = Math.max(0, Number(upgrades.relation_plus) || 0);

  if (next.type === ABILITY_TYPES.NEIGHBOR || next.type === ABILITY_TYPES.KIN) {
    next.count = (next.count ?? 2) + lens + relation;
  } else if (next.type === ABILITY_TYPES.BETWEEN) {
    next.count = (next.count ?? 2) + relation;
  }

  // Mirror reveals every legal opposite-rank Court card, so a numeric reveal
  // bonus cannot enlarge it. Major mirrors remain singular.
  return next;
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
      return hand.filter(card => cardsInDeckByIds(deck, mirrorCardIds(card)).length > 0);

    case ABILITY_TYPES.BETWEEN:
      return hand.filter((card, index) => hand.some((other, otherIndex) => otherIndex !== index && cardsInDeckByIds(deck, betweenCardIds(card, other)).length > 0));

    default:
      return hand;
  }
}

// Canonical reveal computation shared by both singleplayer and multiplayer.
// Given a deck, an ability definition, and the chosen anchor card(s), it returns
// the full set of eligible cards the ability would reveal/hold from the deck.
// Callers apply their own count limits (singleplayer factors in upgrades, the
// multiplayer reducer slices by ability.count) so this stays a single source of
// truth for *which* cards an ability can reach. Mirror is the exception: all
// legal Court mirrors are choices, while Major mirrors are naturally singular.
export function abilityHeldCards(deck = [], ability, anchors = []) {
  if (!ability) return [];
  const picked = (Array.isArray(anchors) ? anchors : [anchors]).filter(Boolean);

  switch (ability.type) {
    case ABILITY_TYPES.NEIGHBOR:
      return picked[0] ? cardsInDeckByIds(deck, neighborCardIds(picked[0])) : [];

    case ABILITY_TYPES.KIN:
      return picked[0] ? deck.filter(card => isSameArcana(card, picked[0])) : [];

    case ABILITY_TYPES.MIRROR:
      return picked[0] ? cardsInDeckByIds(deck, mirrorCardIds(picked[0])) : [];

    case ABILITY_TYPES.BETWEEN:
      return picked.length >= 2 ? cardsInDeckByIds(deck, betweenCardIds(picked[0], picked[1])) : [];

    case ABILITY_TYPES.PEEK:
      return deck.slice(0, ability.count ?? 1);

    case ABILITY_TYPES.SEARCH:
      return deck.slice();

    default:
      return [];
  }
}

// ── Pure ability resolution (Phase 11) ──
// These compute the run mutations that abilities commit. Each returns new
// arrays; the caller decides how to apply them.

// Draw one card at a time, reshuffling the discard pile into the deck when it
// runs dry (matches the live drawN behavior).
export function drawWithReshuffle(run, count, rng) {
  let deck = [...run.deck];
  let discard = [...run.discard];
  const drawn = [];
  for (let i = 0; i < count; i += 1) {
    if (!deck.length && discard.length) {
      deck = shuffleDeck(discard, rng);
      discard = [];
    }
    if (!deck.length) break;
    drawn.push(deck.shift());
  }
  return { deck, discard, hand: [...run.hand, ...drawn], drawnCount: drawn.length };
}

// Take one of a set of revealed/held cards into hand; the rest go to the
// bottom of the deck. Held cards may or may not still be in the deck (peek
// pulls them out before the modal, relation reveals leave them in).
export function applyAbilityTake(run, heldCards, takenCardId) {
  const taken = heldCards.find(card => card.uid === takenCardId);
  if (!taken) return null;
  const heldIds = new Set(heldCards.map(card => card.uid));
  const deck = run.deck.filter(card => !heldIds.has(card.uid));
  for (const card of heldCards) {
    if (card.uid !== takenCardId) deck.push(card);
  }
  return { deck, hand: [...run.hand, taken], taken };
}

// Take any card from the deck, then reshuffle the deck.
export function applySearchTake(run, takenCardId, rng) {
  const index = run.deck.findIndex(card => card.uid === takenCardId);
  if (index < 0) return null;
  const deck = [...run.deck];
  const [taken] = deck.splice(index, 1);
  return { deck: shuffleDeck(deck, rng), hand: [...run.hand, taken], taken };
}

// Full Reset (The World): shuffle the unplayed piles and redraw while leaving
// the spread intact. The reducer preserves run.spread when applying this result.
export function applyWorldReset(run, handSize, rng) {
  const deck = shuffleDeck([...run.deck, ...run.discard, ...run.hand], rng);
  return { deck: deck.slice(handSize), discard: [], hand: deck.slice(0, handSize) };
}
