// Multiplayer-only interaction cards. These are never part of the main 78-card
// deck — they are injected into a player's hand by persona passives or future
// card-package loadout items.

export const MP_ABILITY_TYPES = Object.freeze({
  MP_BANISH: 'mp_banish', // hard: remove a card from target slot in opponent spread
  MP_SEAL:   'mp_seal',   // soft: silence a card in opponent spread (excluded from scoring)
});

// Interaction tiers for reference / UI labelling.
export const INTERACTION_TIER = Object.freeze({
  SOFT: 'soft',   // annoying but not devastating
  HARD: 'hard',   // rare and dramatic
});

export const INTERACTION_CARD_DEFS = Object.freeze({
  mp_banish: {
    id: 'mp_banish',
    type: 'interaction',
    name: 'Banish',
    points: 3,
    ability: 'MP_BANISH',
    abilityType: MP_ABILITY_TYPES.MP_BANISH,
    tier: INTERACTION_TIER.HARD,
    prompt: 'Remove a card from a slot in the opponent\'s spread.',
    // Requires action.target = { playerIndex, slotIndex }
  },
  mp_seal: {
    id: 'mp_seal',
    type: 'interaction',
    name: 'Seal',
    points: 2,
    ability: 'MP_SEAL',
    abilityType: MP_ABILITY_TYPES.MP_SEAL,
    tier: INTERACTION_TIER.SOFT,
    prompt: 'Silence a card in the opponent\'s spread — it does not score this round.',
    // Requires action.target = { playerIndex, slotIndex }
  },
});

// Create an instance of an interaction card with a unique UID.
export function makeInteractionCard(defId, uid, ownerPlayerIndex) {
  const def = INTERACTION_CARD_DEFS[defId];
  if (!def) throw new Error(`Unknown interaction card: ${defId}`);
  return { ...def, uid, playerOwner: ownerPlayerIndex };
}
