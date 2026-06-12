export const MP_ACTIONS = Object.freeze({
  // Initialize a new match
  // { type, scoreTarget, personas?: [p0personaId, p1personaId] }
  MP_INIT: 'MP_INIT',

  // A player places a card from their hand into a spread slot
  // { type, playerIndex, cardUid, slotIndex }
  MP_PLACE_CARD: 'MP_PLACE_CARD',

  // A player invokes a card's ability (spends 1 discard, discards the card)
  // { type, playerIndex, cardUid, target?: { playerIndex, slotIndex } }
  // DRAW abilities: fully resolved. MP_BANISH: no target; removes the opponent's last played card.
  // MP_SEAL: requires target. Others are stubbed (discard spent, no secondary effect).
  MP_INVOKE_ABILITY: 'MP_INVOKE_ABILITY',

  // Surgeon persona: swap two cards in own spread (free action, once per round)
  // { type, playerIndex, slotA, slotB }
  MP_SWAP_SPREAD: 'MP_SWAP_SPREAD',

  // Trigger scoring after the final turn completes
  // { type }
  MP_SCORE_ROUND: 'MP_SCORE_ROUND',

  // Begin the next round after scoring (clear spreads, redraw, reset persona state)
  // { type }
  MP_NEW_ROUND: 'MP_NEW_ROUND',
});