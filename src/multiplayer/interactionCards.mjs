// Multiplayer-only interaction cards. These are never part of the main 78-card
// deck — they are injected into a player's deck by persona passives or future
// card-package loadout items.

export const MP_ABILITY_TYPES = Object.freeze({
  MP_BANISH: 'mp_banish', // hard: remove the opponent's last played spread card
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
    prompt: '[[banish]] the last card your opponent [[play|Played]].',
    // Requires no target. The reducer finds the opponent's most recent live placement.
  },
  mp_seal: {
    id: 'mp_seal',
    type: 'interaction',
    name: 'Seal',
    points: 2,
    ability: 'MP_SEAL',
    abilityType: MP_ABILITY_TYPES.MP_SEAL,
    tier: INTERACTION_TIER.SOFT,
    prompt: 'Silence 1 card in the opponent’s [[spread]]. It adds no [[chips]] or [[mult]] this round.',
    // Requires action.target = { playerIndex, slotIndex }
  },
});

// Create an instance of an interaction card with a unique UID.
export function makeInteractionCard(defId, uid, ownerPlayerIndex) {
  const def = INTERACTION_CARD_DEFS[defId];
  if (!def) throw new Error(`Unknown interaction card: ${defId}`);
  return { ...def, uid, playerOwner: ownerPlayerIndex };
}
