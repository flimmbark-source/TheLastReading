import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { hasSubmittedAction, isPlayerTurn } from '../multiplayer/mpSelectors.mjs';

export function installMpSingleplayerAbilityBridge(target = window) {
  if (!target || target.__tlrMpSingleplayerAbilityBridgeInstalled) return;
  target.__tlrMpSingleplayerAbilityBridgeInstalled = true;

  const doc = target.document;
  if (!doc) return;

  const originalDiscard = target.tlrMpDiscard;
  const originalInvoke = target.tlrMpInvoke;

  target.tlrMpDiscard = async function (...args) {
    if (await invokeStandardAbilityThroughSingleplayerFlow()) return;
    return originalDiscard?.apply(this, args);
  };

  target.tlrMpInvoke = async function (...args) {
    if (await invokeStandardAbilityThroughSingleplayerFlow()) return;
    return originalInvoke?.apply(this, args);
  };

  function mpActive() {
    return doc.body.classList.contains('mp-game-active');
  }

  function myIndex() {
    return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
  }

  function selectedStandardAbilityCard(state, playerIndex) {
    const uid = target.state?.selected ?? null;
    if (uid == null) return null;
    const card = state?.players?.[playerIndex]?.hand?.find(c => c.uid === uid) || null;
    if (!card?.ability || card.abilityType) return null;
    return card;
  }

  async function invokeStandardAbilityThroughSingleplayerFlow() {
    const match = target.tlrMpGetState?.();
    if (!mpActive() || !match?.players) return false;

    const playerIndex = myIndex();
    if (!isPlayerTurn(match, playerIndex)) return false;
    if (hasSubmittedAction(match, playerIndex)) return false;

    const player = match.players[playerIndex];
    const card = selectedStandardAbilityCard(match, playerIndex);
    if (!card) return false;
    if ((player.discards ?? 0) <= 0) return false;
    if (typeof target.resolveAbility !== 'function') return false;

    const abilityChoice = await resolveWithSingleplayerAbilityFlow(player, card);
    if (!abilityChoice) return true;

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

    if (target.state) target.state.selected = null;
    target.refreshHandState?.();
    return true;
  }

  function snapshotLiveState() {
    const state = target.state;
    if (!state) return null;
    return {
      deck: state.deck?.slice?.() || [],
      hand: state.hand?.slice?.() || [],
      discard: state.discard?.slice?.() || [],
      spread: state.spread?.slice?.() || [],
      selected: state.selected ?? null,
      discards: state.discards ?? 0,
      busy: !!state.busy,
      abilitySelect: state.abilitySelect || null,
      purgeSelect: state.purgeSelect,
      abilityTakenUids: state.abilityTakenUids ? new Set(state.abilityTakenUids) : new Set(),
    };
  }

  function restoreLiveState(snapshot) {
    const state = target.state;
    if (!state || !snapshot) return;
    state.deck = snapshot.deck.slice();
    state.hand = snapshot.hand.slice();
    state.discard = snapshot.discard.slice();
    state.spread = snapshot.spread.slice();
    state.selected = snapshot.selected;
    state.discards = snapshot.discards;
    state.busy = snapshot.busy;
    state.abilitySelect = snapshot.abilitySelect;
    state.purgeSelect = snapshot.purgeSelect;
    state.abilityTakenUids = new Set(snapshot.abilityTakenUids || []);
  }

  function prepareAbilityRun(player, sourceCard) {
    const state = target.state;
    if (!state) return;
    state.deck = (player.deck || []).slice();
    state.hand = (player.hand || []).filter(card => card.uid !== sourceCard.uid);
    state.discard = [...(player.discard || []), sourceCard];
    state.spread = (player.spread || []).slice();
    state.selected = null;
    state.discards = Math.max(0, (player.discards ?? 0) - 1);
    state.busy = false;
    state.abilitySelect = null;
    state.purgeSelect = null;
    state.abilityTakenUids = new Set(player.abilityTakenUids || []);
    target.tlrSyncRunToStore?.();
  }

  function captureResolvedRun() {
    const state = target.state || {};
    return {
      resultState: {
        handUids: (state.hand || []).map(card => card?.uid).filter(uid => uid != null),
        deckUids: (state.deck || []).map(card => card?.uid).filter(uid => uid != null),
        discardUids: (state.discard || []).map(card => card?.uid).filter(uid => uid != null),
        spreadUids: (state.spread || []).map(card => card?.uid ?? null),
      },
    };
  }

  function resolveWithSingleplayerAbilityFlow(player, sourceCard) {
    return new Promise(resolve => {
      const snapshot = snapshotLiveState();
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        const result = captureResolvedRun();
        restoreLiveState(snapshot);
        resolve(result);
      };

      try {
        prepareAbilityRun(player, sourceCard);
        target.resolveAbility(sourceCard.ability, finish, sourceCard);
      } catch (err) {
        console.error('Multiplayer ability bridge failed', err);
        restoreLiveState(snapshot);
        resolve(null);
      }
    });
  }
}
