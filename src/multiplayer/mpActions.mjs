export const MP_ACTIONS = Object.freeze({
  // Initialize a new match
  MP_INIT: 'MP_INIT',

  // A player places a card from their hand into a spread slot
  // { type, playerIndex, cardUid, slotIndex }
  MP_PLACE_CARD: 'MP_PLACE_CARD',

  // A player invokes a card's ability (spends 1 discard, discards the card)
  // { type, playerIndex, cardUid }
  // For DRAW abilities this is fully resolved. Others are stubbed for now.
  MP_INVOKE_ABILITY: 'MP_INVOKE_ABILITY',

  // Trigger scoring after the final turn completes
  // { type }
  MP_SCORE_ROUND: 'MP_SCORE_ROUND',

  // Begin the next round after scoring (clear spreads, redraw)
  // { type }
  MP_NEW_ROUND: 'MP_NEW_ROUND',
});
