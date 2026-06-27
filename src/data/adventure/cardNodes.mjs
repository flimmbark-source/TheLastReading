import { ACTION_NODES } from './nodes.mjs';

// Every current card has exactly one Adventure action node. Potency is never
// stored here: it always comes from the card's existing printed points value.
export const CARD_ACTION_NODES = Object.freeze({
  major_0: ACTION_NODES.FORTUNE,
  major_1: ACTION_NODES.CREATION,
  major_2: ACTION_NODES.MYSTERY,
  major_3: ACTION_NODES.CREATION,
  major_4: ACTION_NODES.AUTHORITY,
  major_5: ACTION_NODES.AUTHORITY,
  major_6: ACTION_NODES.COMPASSION,
  major_7: ACTION_NODES.PHYSICAL,
  major_8: ACTION_NODES.PHYSICAL,
  major_9: ACTION_NODES.INVESTIGATION,
  major_10: ACTION_NODES.FORTUNE,
  major_11: ACTION_NODES.AUTHORITY,
  major_12: ACTION_NODES.ENDURANCE,
  major_13: ACTION_NODES.TRANSFORMATION,
  major_14: ACTION_NODES.PROTECTION,
  major_15: ACTION_NODES.DECEPTION,
  major_16: ACTION_NODES.AGGRESSION,
  major_17: ACTION_NODES.COMPASSION,
  major_18: ACTION_NODES.MYSTERY,
  major_19: ACTION_NODES.CREATION,
  major_20: ACTION_NODES.TRANSFORMATION,
  major_21: ACTION_NODES.FORTUNE,

  court_Cups_Page: ACTION_NODES.MYSTERY,
  court_Cups_Knight: ACTION_NODES.COMPASSION,
  court_Cups_Queen: ACTION_NODES.COMPASSION,
  court_Cups_King: ACTION_NODES.AUTHORITY,

  court_Wands_Page: ACTION_NODES.CREATION,
  court_Wands_Knight: ACTION_NODES.PHYSICAL,
  court_Wands_Queen: ACTION_NODES.CREATION,
  court_Wands_King: ACTION_NODES.AUTHORITY,

  court_Swords_Page: ACTION_NODES.INVESTIGATION,
  court_Swords_Knight: ACTION_NODES.AGGRESSION,
  court_Swords_Queen: ACTION_NODES.INVESTIGATION,
  court_Swords_King: ACTION_NODES.AUTHORITY,

  court_Pentacles_Page: ACTION_NODES.CREATION,
  court_Pentacles_Knight: ACTION_NODES.ENDURANCE,
  court_Pentacles_Queen: ACTION_NODES.PROTECTION,
  court_Pentacles_King: ACTION_NODES.AUTHORITY,
});

const SUIT_FALLBACKS = Object.freeze({
  Cups: ACTION_NODES.COMPASSION,
  Wands: ACTION_NODES.CREATION,
  Swords: ACTION_NODES.AGGRESSION,
  Pentacles: ACTION_NODES.ENDURANCE,
});

export function cardAdventureProfile(card) {
  if (!card) return null;
  const node = CARD_ACTION_NODES[card.id] || SUIT_FALLBACKS[card.suit] || ACTION_NODES.FORTUNE;
  const potency = Number(card.points || 0);
  return { node, potency: Number.isFinite(potency) ? potency : 0 };
}

export function missingCardNodeIds(cards = []) {
  return cards.filter(card => !CARD_ACTION_NODES[card.id]).map(card => card.id);
}
