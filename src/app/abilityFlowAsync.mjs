import { ABILITY_TYPES } from '../data/abilities.mjs';
import { abilityHeldCards } from '../systems/abilities.mjs';

function targetingWasCancelled(selection) {
  return Array.isArray(selection) && selection.length === 1 && selection[0] === null;
}

function revealPreview(cleanName, anchor, total, count) {
  const shown = Math.min(total, count);
  if (total <= count) return `${cleanName(anchor)}: ${total} card${total === 1 ? '' : 's'} found`;
  return `${cleanName(anchor)}: ${shown} of ${total} matching cards will be revealed`;
}

/**
 * Builds the player's interactive ability choice asynchronously.
 * Shared by singleplayer and multiplayer; callers inject their own state and UI.
 *
 * Handles: SEARCH, NEIGHBOR, KIN, MIRROR, BETWEEN.
 * DRAW, PEEK, and WORLD are handled by each caller directly (SP/MP differ there).
 *
 * @param {object} ability   From getAbility(ab). For SP, adjust count for upgrades before calling.
 * @param {object} stateCtx  { deck, hand, spread (pre-filtered), sourceCardUid }
 * @param {object} uiCtx     {
 *   showChoice(title, prompt, cards): Promise<card | null>,
 *   selectTargets(title, prompt, cards, count, previewFn): Promise<card[] | null>,
 *   sortCards(cards): card[],
 *   cleanName(card): string,
 *   shuffleDeck(cards): card[],
 *   isTargetable(card): boolean,
 * }
 * @returns {object | null}  choice descriptor, or null if a reveal modal backs out
 *
 *   { kind: 'search', takenCardUid, deckOrderUids }
 *   { kind: 'take',   takenCardUid, heldCardUids, anchorUids, threadBond? }
 *   { kind: 'fallback', count }
 *   {}  (cancelled targeting or unrecognised ability — no-op)
 */
export async function buildAbilityChoiceAsync(ability, stateCtx, uiCtx) {
  const { type, count = 1, title = '' } = ability;
  const { deck, hand, spread, sourceCardUid } = stateCtx;
  const { showChoice, selectTargets, sortCards, cleanName, shuffleDeck, isTargetable } = uiCtx;

  if (type === ABILITY_TYPES.SEARCH) {
    if (!deck.length) return { kind: 'fallback', count: 1 };
    const picked = await showChoice('Search deck', 'Pick any card. The deck reshuffles.', sortCards([...deck]));
    if (picked === null) return null;
    const deckOrderUids = shuffleDeck(deck.filter(c => c.uid !== picked.uid)).map(c => c.uid);
    return { kind: 'search', takenCardUid: picked.uid, deckOrderUids };
  }

  if (type === ABILITY_TYPES.NEIGHBOR || type === ABILITY_TYPES.KIN || type === ABILITY_TYPES.MIRROR) {
    const anchorPrompt =
      type === ABILITY_TYPES.NEIGHBOR ? `Choose an anchor card. Neighbor reveals up to ${count} adjacent cards: nearby Major numbers or court ranks in the same suit.`
      : type === ABILITY_TYPES.KIN    ? `Choose an anchor card. Kin reveals up to ${count} cards of the same Arcana.`
      :                                  `Choose an anchor card. Mirror reveals up to ${count} opposite cards: Major Arcana mirror across the centerline; Court cards mirror by rank across all suits.`;
    const inPlay = [...hand.filter(c => c.uid !== sourceCardUid), ...spread].filter(isTargetable);

    // Only cards that can currently produce a legal result are selectable.
    // The renderer greys every other in-play card from this candidate list.
    const candidates = inPlay.filter(card => abilityHeldCards(deck, ability, [card]).length > 0);
    if (!candidates.length) return { kind: 'fallback', count: 1 };

    const previewFn = anchor => {
      const total = abilityHeldCards(deck, ability, [anchor]).length;
      return revealPreview(cleanName, anchor, total, count);
    };
    const anchors = await selectTargets(title, anchorPrompt, candidates, 1, previewFn);
    if (targetingWasCancelled(anchors)) return {};
    if (!anchors?.length || !anchors[0]) return null;
    const [anchor] = anchors;
    // The cap applies to the live deck order. Sorting only changes how those
    // already-revealed cards are presented, not which matching cards were drawn.
    const found = sortCards(abilityHeldCards(deck, ability, [anchor]).slice(0, count));
    if (!found.length) return { kind: 'fallback', count: 1 };
    const pickedCard = await showChoice(
      `${title} — ${cleanName(anchor)}`,
      `Revealed from ${cleanName(anchor)}. Take 1. Unchosen revealed cards go to the bottom.`,
      found,
    );
    if (pickedCard === null) return null;
    const threadBond = type === ABILITY_TYPES.KIN || type === ABILITY_TYPES.NEIGHBOR;
    return { kind: 'take', takenCardUid: pickedCard.uid, heldCardUids: found.map(c => c.uid), anchorUids: [anchor.uid], threadBond };
  }

  if (type === ABILITY_TYPES.BETWEEN) {
    const betweenDef = { type: ABILITY_TYPES.BETWEEN };
    const inPlay = sortCards([...hand.filter(c => c.uid !== sourceCardUid), ...spread].filter(isTargetable));
    const resultCards = (a, b) => abilityHeldCards(deck, betweenDef, [a, b]);

    // The first anchor is legal only when at least one currently playable
    // partner produces a card from the live deck.
    const validAnchors = inPlay.filter(first => inPlay.some(second => second.uid !== first.uid && resultCards(first, second).length > 0));
    if (!validAnchors.length) return { kind: 'fallback', count: 1 };

    const firstPick = await selectTargets(
      'Between',
      `Choose the first card. Between reveals up to ${count} cards whose values fall between the two selected cards.`,
      validAnchors,
      1,
      first => {
        if (!first) return '';
        const n = inPlay.filter(second => second.uid !== first.uid && resultCards(first, second).length > 0).length;
        return `${cleanName(first)}: ${n} valid second card${n === 1 ? '' : 's'}`;
      },
    );
    if (targetingWasCancelled(firstPick)) return {};
    if (!firstPick?.length || !firstPick[0]) return null;
    const [first] = firstPick;
    const validSeconds = inPlay.filter(second => second.uid !== first.uid && resultCards(first, second).length > 0);
    if (!validSeconds.length) return { kind: 'fallback', count: 1 };

    const secondPick = await selectTargets(
      `Between — ${cleanName(first)}`,
      'Choose the second card. Only cards with a current result can be selected.',
      validSeconds,
      1,
      second => {
        if (!second) return '';
        const total = resultCards(first, second).length;
        const shown = Math.min(count, total);
        return total <= count
          ? `Between these anchors: ${total} card${total === 1 ? '' : 's'}`
          : `Between these anchors: ${shown} of ${total} cards will be revealed`;
      },
    );
    if (targetingWasCancelled(secondPick)) return {};
    if (!secondPick?.length || !secondPick[0]) return null;
    const [second] = secondPick;
    const found = sortCards(resultCards(first, second).slice(0, count));
    if (!found.length) return { kind: 'fallback', count: 1 };
    const pickedCard = await showChoice(
      `Between — ${cleanName(first)} / ${cleanName(second)}`,
      'Cards found between them. Take 1. Unchosen revealed cards go to the bottom.',
      found,
    );
    if (pickedCard === null) return null;
    return { kind: 'take', takenCardUid: pickedCard.uid, heldCardUids: found.map(c => c.uid), anchorUids: [first.uid, second.uid], threadBond: true };
  }

  return {};
}
