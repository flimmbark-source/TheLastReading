import { getAbility } from '../data/abilities.mjs';
import { isCardUntargetable } from '../systems/constellations.mjs';

function runtime(target) { return target.tlrRuntime || {}; }
function stateOf(target) { return runtime(target).state || target.state; }

function cleanName(target, card) {
  if (typeof target.cleanName === 'function') return target.cleanName(card);
  return card?.name || card?.id || 'Card';
}

function sortCards(target, cards) {
  if (typeof target.sortCards === 'function') return target.sortCards((cards || []).slice());
  return (cards || []).slice().sort((a, b) => cleanName(target, a).localeCompare(cleanName(target, b)));
}

function uniqueCards(cards) {
  const seen = new Set();
  return (cards || []).filter(card => {
    if (!card || seen.has(card.uid)) return false;
    seen.add(card.uid);
    return true;
  });
}

function isTargetBlocked(state, card) {
  return isCardUntargetable({
    th: state.th,
    constellationId: state.constellationId,
    untargetableCardIds: state.untargetableCardUids,
  }, card);
}

function targetable(state, cards) {
  return (cards || []).filter(card => !isTargetBlocked(state, card));
}

function betweenPool(target, state, a, b) {
  const abilities = target.tlrAbilities;
  if (!abilities || !a || !b || a.uid === b.uid) return [];
  return abilities.cardsInDeckByIds(state.deck, abilities.betweenCardIds(a, b));
}

function revealLimit(abilityId) {
  const ability = getAbility(abilityId);
  return Math.max(1, Number(ability?.count || 2));
}

function fallbackAbility(target, done, title = 'Between — no cards between') {
  const state = stateOf(target);
  if (typeof target.tlrAbilityDraw === 'function') target.tlrAbilityDraw(1);
  const drawn = state?.hand?.slice(-1) || [];
  if (drawn.length && typeof target.choice === 'function') {
    target.choice(title, 'No valid target was available. Draw 1 instead.', drawn, () => {
      if (state) state.busy = false;
      done();
    });
    return;
  }
  if (state) state.busy = false;
  done();
}

function resolveBetween(target, abilityId, done, sourceCard = null) {
  const state = stateOf(target);
  if (!state) return false;

  const limit = revealLimit(abilityId);
  if (target.tlrStoreReady?.()) {
    target.tlrStore.dispatch({
      type: target.tlrActions.START_ABILITY,
      abilityId,
      sourceCardId: sourceCard ? sourceCard.uid : null,
    });
  }

  state.busy = true;
  const anchors = sortCards(target, targetable(state, [...(state.hand || []), ...((state.spread || []).filter(Boolean))]));
  const validAnchors = anchors.filter(a => anchors.some(b => b.uid !== a.uid && betweenPool(target, state, a, b).length > 0));
  if (!validAnchors.length) {
    fallbackAbility(target, done, 'Between — no cards between');
    return true;
  }

  const previewFn = (a, b) => {
    if (!a || !b) return '';
    const total = betweenPool(target, state, a, b).length;
    if (!total) return 'No cards between these anchors.';
    const shown = Math.min(limit, total);
    return `Between these anchors: ${shown} of ${total} card${total === 1 ? '' : 's'} will be revealed`;
  };

  target.selectFromHand?.(
    'Between',
    `Choose 2 cards. Between reveals up to ${limit} cards whose values fall between them in sequence.`,
    validAnchors,
    2,
    (a, b) => {
      const found = sortCards(target, uniqueCards(betweenPool(target, state, a, b))).slice(0, limit);
      if (!found.length) {
        state.busy = false;
        done();
        return;
      }
      target.choice(
        `Between — ${cleanName(target, a)} / ${cleanName(target, b)}`,
        'Cards found between them. Take 1. Unchosen revealed cards go to the bottom.',
        found,
        picked => {
          target.tlrResolveAbilityThroughStore?.({ kind: 'take', heldCards: found, takenCardId: picked.uid, threadBond: true });
          state.busy = false;
          done();
        },
      );
    },
    previewFn,
  );

  return true;
}

export function installBetweenAbilityLimitPatch(target = window) {
  if (!target || target.__tlrBetweenAbilityLimitPatchInstalled) return;
  target.__tlrBetweenAbilityLimitPatchInstalled = true;

  const originalResolveAbility = target.resolveAbility;
  if (typeof originalResolveAbility !== 'function') return;

  target.resolveAbility = function (abilityId, done, sourceCard = null) {
    if (abilityId === 'BETWEEN_2') return resolveBetween(target, abilityId, done, sourceCard);
    return originalResolveAbility.call(this, abilityId, done, sourceCard);
  };
}
