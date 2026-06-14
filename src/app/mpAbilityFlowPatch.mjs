import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { MP_ABILITY_TYPES } from '../multiplayer/interactionCards.mjs';
import { isPlayerTurn, hasSubmittedAction, canInvokeAbility } from '../multiplayer/mpSelectors.mjs';
import { renderSpread as renderSingleplayerSpread } from '../ui/renderSpread.mjs';

export function installMpAbilityFlowPatch(target = window) {
  if (!target || target.__tlrMpAbilityFlowPatchInstalled) return;
  target.__tlrMpAbilityFlowPatchInstalled = true;

  const originalInvoke = target.tlrMpInvoke;
  const originalDiscard = target.tlrMpDiscard;

  function myIndex() {
    return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
  }

  function mpState() {
    return target.tlrMpGetState?.() || null;
  }

  function selectedStandardAbilityCard() {
    const state = mpState();
    const playerIndex = myIndex();
    const uid = target.state?.selected ?? null;
    if (!state || uid === null) return null;
    if (!isPlayerTurn(state, playerIndex)) return null;
    if (hasSubmittedAction(state, playerIndex)) return null;

    const player = state.players?.[playerIndex];
    if (!player || (player.discards ?? 0) <= 0) return null;
    const card = player.hand?.find(c => c.uid === uid) || null;
    if (!card) return null;
    if (!card.ability || card.abilityType) return null;
    if (!canInvokeAbility(state, playerIndex, uid)) return null;
    return { state, player, playerIndex, card };
  }

  function captureResultState() {
    const s = target.state;
    return {
      handUids: (s.hand || []).map(card => card.uid),
      deckUids: (s.deck || []).map(card => card.uid),
      discardUids: (s.discard || []).map(card => card.uid),
      spreadUids: (s.spread || []).map(card => card ? card.uid : null),
    };
  }

  function seedSingleplayerAbilityState(player, sourceCard) {
    const st = target.state;
    const hand = (player.hand || []).filter(card => card.uid !== sourceCard.uid);
    st.deck = (player.deck || []).slice();
    st.hand = hand;
    st.discard = [...(player.discard || []), sourceCard];
    st.spread = (player.spread || Array(5).fill(null)).slice();
    st.discards = Math.max(0, (player.discards ?? 0) - 1);
    st.selected = null;
    st.busy = false;
    st.abilitySelect = null;
    st.purgeSelect = null;
    st.discardedCards = [...(st.discardedCards || []), sourceCard];
  }

  async function resolveWithCurrentAbilityFlow(player, sourceCard) {
    if (typeof target.resolveAbility !== 'function') return null;

    const previousRenderSpread = target.renderSpread;
    const previousSlotEls = target._slotEls;
    target.__tlrMpUsingSingleAbilityFlow = true;
    target.renderSpread = renderSingleplayerSpread;
    target._slotEls = null;

    try {
      seedSingleplayerAbilityState(player, sourceCard);
      target.tlrSyncRunToStore?.();
      target.render?.();

      await new Promise(resolve => {
        target.resolveAbility(sourceCard.ability, resolve, sourceCard);
      });

      return { resultState: captureResultState() };
    } finally {
      target.__tlrMpUsingSingleAbilityFlow = false;
      target.renderSpread = previousRenderSpread;
      target._slotEls = previousSlotEls || null;
    }
  }

  async function invokeThroughCurrentFlow(fallback) {
    const ctx = selectedStandardAbilityCard();
    if (!ctx) {
      fallback?.call(target);
      return;
    }

    const { player, playerIndex, card } = ctx;
    let abilityChoice = null;
    try {
      abilityChoice = await resolveWithCurrentAbilityFlow(player, card);
    } catch (err) {
      console.error('The Last Reading: multiplayer card ability flow failed.', err);
      abilityChoice = null;
    }

    if (!abilityChoice) {
      target.__tlrMpUsingSingleAbilityFlow = false;
      target.render?.();
      return;
    }

    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_SUBMIT_ACTION,
      playerIndex,
      action: {
        type: MP_ACTIONS.MP_INVOKE_ABILITY,
        playerIndex,
        cardUid: card.uid,
        abilityChoice,
      },
    });
  }

  target.tlrMpInvoke = function () {
    const ctx = selectedStandardAbilityCard();
    if (!ctx || ctx.card.abilityType === MP_ABILITY_TYPES.MP_SEAL) return originalInvoke?.call(target);
    invokeThroughCurrentFlow(originalInvoke);
  };

  target.tlrMpDiscard = function () {
    const ctx = selectedStandardAbilityCard();
    if (!ctx) return originalDiscard?.call(target);
    invokeThroughCurrentFlow(originalDiscard);
  };
}
