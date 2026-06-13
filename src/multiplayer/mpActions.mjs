export const MP_ACTIONS = Object.freeze({
  // Initialize a new match
  // { type, scoreTarget, personas?: [p0personaId, p1personaId] }
  MP_INIT: 'MP_INIT',

  // A player chooses an action for the current simultaneous action cycle.
  // The reducer stores it in pendingActions[playerIndex]. When both players have
  // submitted, both actions commit in player-index order and the next cycle opens.
  // { type, playerIndex, action }
  MP_SUBMIT_ACTION: 'MP_SUBMIT_ACTION',

  // A player places a card from their hand into a spread slot
  // { type, playerIndex, cardUid, slotIndex }
  MP_PLACE_CARD: 'MP_PLACE_CARD',

  // A player discards a selected card and invokes its ability (spends 1 discard)
  // { type, playerIndex, cardUid, target?: { playerIndex, slotIndex } }
  // DRAW abilities: fully resolved. MP_BANISH: no target; removes the opponent's last played card.
  // MP_SEAL: requires target. Others are stubbed (discard spent, no secondary effect).
  MP_INVOKE_ABILITY: 'MP_INVOKE_ABILITY',

  // A player discards a card without invoking its ability (spends 1 discard)
  // { type, playerIndex, cardUid }
  MP_DISCARD_CARD: 'MP_DISCARD_CARD',

  // A player purges 3 cards from hand to gain 1 discard. Counts as the player's action.
  // { type, playerIndex, cardUids: [uid, uid, uid] }
  MP_PURGE_CARDS: 'MP_PURGE_CARDS',

  // Surgeon persona: swap a card in own spread with a card in hand
  // { type, playerIndex, slotIndex, cardUid }
  MP_SWAP_SPREAD: 'MP_SWAP_SPREAD',

  // Trigger scoring after the simultaneous action cycle completes
  // { type }
  MP_SCORE_ROUND: 'MP_SCORE_ROUND',

  // Begin the next round after scoring (clear spreads, redraw, reset persona state)
  // { type }
  MP_NEW_ROUND: 'MP_NEW_ROUND',
});
