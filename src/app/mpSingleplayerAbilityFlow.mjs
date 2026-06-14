import { MP_ACTIONS } from '../multiplayer/mpActions.mjs';
import { canInvokeAbility } from '../multiplayer/mpSelectors.mjs';
import { ABILITY_TYPES, getAbility } from '../data/abilities.mjs';
import { shuffleDeck } from '../systems/deck.mjs';
import { abilityHeldCards } from '../systems/abilities.mjs';
import { applyCardPhoto, title as cardTitle } from '../ui/renderCard.mjs';
import { applyHint } from '../ui/renderHints.mjs';

export function installMpSingleplayerAbilityFlow(target = window) {
  if (!target || target.__tlrMpSingleplayerAbilityFlowInstalled) return;
  target.__tlrMpSingleplayerAbilityFlowInstalled = true;

  const doc = target.document;
  if (!doc) return;

  installStyle(doc);

  const originalInvoke = target.tlrMpInvoke;
  const originalDiscard = target.tlrMpDiscard;
  const originalCancel = target.tlrMpCancelAction;
  const originalLeave = target.tlrMpLeave;
  const confirmBtn = doc.getElementById('abilityConfirm');
  const originalConfirmAttr = confirmBtn?.getAttribute('onclick') || '';

  let abilitySelect = null;
  let resolving = false;
  let activeResolve = null;

  function myIndex() {
    return target.tlrMpGetRole?.() === 'guest' ? 1 : 0;
  }

  function currentState() {
    return target.tlrMpGetState?.() || null;
  }

  function currentPlayer() {
    return currentState()?.players?.[myIndex()] || null;
  }

  function selectedCard() {
    const uid = Number(doc.querySelector('body.mp-game-active #hand .card.sel[data-uid]')?.dataset.uid);
    if (!Number.isFinite(uid)) return null;
    return currentPlayer()?.hand?.find(card => card.uid === uid) || null;
  }

  function canActOnSelected(card) {
    const state = currentState();
    const player = currentPlayer();
    if (!state || !player || !card || resolving) return false;
    if (state.pendingActions?.[myIndex()]) return false;
    if ((player.discards ?? 0) <= 0) return false;
    if (card.ability && !canInvokeAbility(state, myIndex(), card.uid)) return false;
    return true;
  }

  function submitAction(action) {
    clearAbilitySelection();
    resolving = false;
    target.tlrMpDispatch?.({
      type: MP_ACTIONS.MP_SUBMIT_ACTION,
      playerIndex: myIndex(),
      action: { ...action, playerIndex: myIndex() },
    });
  }

  async function invokeUsingSingleplayerFlow() {
    const card = selectedCard();
    if (!card || !canActOnSelected(card)) return;

    // Multiplayer-only interaction cards still use their special opponent-target
    // behavior from mpGame.mjs. This extension only replaces standard tarot
    // ability selection so it matches singleplayer.
    if (card.abilityType) {
      if (typeof originalInvoke === 'function') originalInvoke();
      return;
    }

    if (!card.ability) {
      submitAction({ type: MP_ACTIONS.MP_DISCARD_CARD, cardUid: card.uid });
      return;
    }

    resolving = true;
    setAbilityFlowActive(true);
    try {
      const abilityChoice = await buildAbilityChoice(card);
      if (abilityChoice === null) return;
      submitAction({ type: MP_ACTIONS.MP_INVOKE_ABILITY, cardUid: card.uid, abilityChoice });
    } finally {
      resolving = false;
      setAbilityFlowActive(false);
      clearAbilitySelection();
    }
  }

  async function buildAbilityChoice(sourceCard) {
    const player = currentPlayer();
    const ability = sourceCard?.ability ? getAbility(sourceCard.ability) : null;
    if (!player || !ability) return {};

    if (ability.type === ABILITY_TYPES.DRAW) return {};

    if (ability.type === ABILITY_TYPES.WORLD) {
      const afterHand = player.hand.filter(card => card.uid !== sourceCard.uid);
      const pool = [...player.deck, ...player.discard, ...player.spread.filter(Boolean), ...afterHand, sourceCard];
      const shuffled = shuffleDeck(pool);
      const handSize = typeof target.maxHand === 'function' ? target.maxHand() : (player.hand?.length || 5);
      return {
        handUids: shuffled.slice(0, handSize).map(card => card.uid),
        deckUids: shuffled.slice(handSize).map(card => card.uid),
      };
    }

    if (ability.type === ABILITY_TYPES.PEEK) {
      const held = player.deck.slice(0, ability.count ?? 1);
      if (!held.length) return fallbackChoice(`${ability.title || 'Peek'} — no cards`);
      const picked = await showCardChoice(`Peek ${held.length}`, 'Pick one. The rest go to the bottom.', held);
      return picked ? { takenCardUid: picked.uid } : null;
    }

    if (ability.type === ABILITY_TYPES.SEARCH) {
      if (!player.deck.length) return fallbackChoice('Search — empty deck');
      const picked = await showCardChoice('Search deck', 'Pick any card. The deck reshuffles.', sortCards(player.deck));
      if (!picked) return null;
      const remaining = shuffleDeck(player.deck.filter(card => card.uid !== picked.uid));
      return { takenCardUid: picked.uid, deckOrderUids: remaining.map(card => card.uid) };
    }

    if (ability.type === ABILITY_TYPES.NEIGHBOR || ability.type === ABILITY_TYPES.KIN || ability.type === ABILITY_TYPES.MIRROR) {
      return relationChoice(player, sourceCard, ability);
    }

    if (ability.type === ABILITY_TYPES.BETWEEN) {
      return betweenChoice(player, sourceCard, ability);
    }

    return {};
  }

  async function relationChoice(player, sourceCard, ability) {
    const candidates = inPlayCards(player, sourceCard.uid).filter(card => heldCardsForAnchor(player, ability, card).length > 0);
    if (!candidates.length) return fallbackChoice(`${ability.title} — no matching cards`);

    const anchors = await selectTargets(
      ability.title,
      ability.prompt || singleplayerPromptFor(ability),
      candidates,
      1,
      targetCard => {
        const total = heldCardsForAnchor(player, ability, targetCard).length;
        return total ? `${cleanCardName(targetCard)}: ${total} card${total === 1 ? '' : 's'} found` : 'No matching cards.';
      },
    );
    if (!anchors) return null;

    const [anchor] = anchors;
    const found = sortCards(heldCardsForAnchor(player, ability, anchor));
    if (!found.length) return fallbackChoice(`${ability.title} — no matching cards`);

    const picked = await showCardChoice(
      `${ability.title} — ${cleanCardName(anchor)}`,
      `Cards found from ${cleanCardName(anchor)}. Take 1. Unchosen revealed cards go to the bottom.`,
      found,
    );
    return picked ? { anchorUids: [anchor.uid], takenCardUid: picked.uid } : null;
  }

  async function betweenChoice(player, sourceCard, ability) {
    const anchors = sortCards(inPlayCards(player, sourceCard.uid));
    const validAnchors = anchors.filter(a => anchors.some(b => b.uid !== a.uid && heldCardsBetween(player, a, b).length > 0));
    if (!validAnchors.length) return fallbackChoice('Between — no cards between');

    const pickedAnchors = await selectTargets(
      'Between',
      'Choose 2 cards. Between finds cards whose values fall between them in sequence.',
      validAnchors,
      2,
      (a, b) => {
        if (!a || !b) return '';
        const total = heldCardsBetween(player, a, b).length;
        return total ? `Between these anchors: ${total} card${total === 1 ? '' : 's'}` : 'No cards between these anchors.';
      },
    );
    if (!pickedAnchors) return null;

    const [first, second] = pickedAnchors;
    const found = sortCards(heldCardsBetween(player, first, second));
    if (!found.length) return fallbackChoice('Between — no cards between');

    const picked = await showCardChoice(
      `Between — ${cleanCardName(first)} / ${cleanCardName(second)}`,
      'Cards found between them. Take 1. Unchosen revealed cards go to the bottom.',
      found,
    );
    return picked ? { anchorUids: [first.uid, second.uid], takenCardUid: picked.uid } : null;
  }

  function selectTargets(title, prompt, cards, count, previewFn = null) {
    return new Promise(resolve => {
      abilitySelect = {
        title,
        prompt,
        validIds: new Set(cards.map(card => card.uid)),
        picked: [],
        count,
        previewFn,
        resolve,
      };
      activeResolve = resolve;
      renderAbilityPrompt();
      refreshAbilityTargets();
    });
  }

  function handleTargetCard(card) {
    if (!abilitySelect || !abilitySelect.validIds.has(card.uid)) return;
    const picked = abilitySelect.picked;
    const index = picked.indexOf(card.uid);
    if (index >= 0) picked.splice(index, 1);
    else {
      if (picked.length >= abilitySelect.count) picked.shift();
      picked.push(card.uid);
    }
    renderAbilityPrompt();
    refreshAbilityTargets();
  }

  function confirmAbilitySelection() {
    if (!abilitySelect || abilitySelect.picked.length < abilitySelect.count) return;
    const player = currentPlayer();
    const allCards = [...(player?.hand || []), ...(player?.spread || []).filter(Boolean)];
    const pickedCards = abilitySelect.picked.map(uid => allCards.find(card => card.uid === uid)).filter(Boolean);
    const resolve = abilitySelect.resolve;
    clearAbilitySelection();
    resolve(pickedCards);
  }

  function cancelAbilitySelection() {
    const resolve = activeResolve;
    clearAbilitySelection();
    if (resolve) resolve(null);
  }

  function clearAbilitySelection() {
    abilitySelect = null;
    activeResolve = null;
    renderAbilityPrompt();
    clearAbilityTargetClasses();
  }

  function renderAbilityPrompt() {
    const promptBox = doc.getElementById('abilityPrompt');
    if (!promptBox) return;
    doc.body.classList.toggle('mp-ability-flow-active', !!abilitySelect || resolving);

    if (!abilitySelect) {
      promptBox.classList.remove('show');
      return;
    }

    const title = doc.getElementById('abilityPromptTitle');
    const text = doc.getElementById('abilityPromptText');
    const button = doc.getElementById('abilityConfirm');
    if (title) title.textContent = abilitySelect.title;

    let preview = '';
    if (abilitySelect.previewFn && abilitySelect.picked.length) {
      const player = currentPlayer();
      const allCards = [...(player?.hand || []), ...(player?.spread || []).filter(Boolean)];
      const picked = abilitySelect.picked.map(uid => allCards.find(card => card.uid === uid)).filter(Boolean);
      preview = abilitySelect.previewFn(...picked) || '';
    }

    if (text) text.innerHTML = preview ? `${esc(abilitySelect.prompt)}<br><b>${esc(preview)}</b>` : esc(abilitySelect.prompt);
    if (button) {
      button.disabled = abilitySelect.picked.length < abilitySelect.count;
      button.onclick = confirmAbilitySelection;
    }
    promptBox.classList.add('show');
  }

  function refreshAbilityTargets() {
    clearAbilityTargetClasses();
    if (!abilitySelect) return;
    const player = currentPlayer();
    const picked = new Set(abilitySelect.picked);

    doc.querySelectorAll('body.mp-game-active #hand .card[data-uid]').forEach(cardEl => {
      const uid = Number(cardEl.dataset.uid);
      const valid = abilitySelect.validIds.has(uid);
      const isPicked = valid && picked.has(uid);
      cardEl.classList.toggle('ability-target', valid && !isPicked);
      cardEl.classList.toggle('ability-picked', isPicked);
      cardEl.classList.toggle('ability-disabled', !valid);
    });

    doc.querySelectorAll('body.mp-game-active #spread .slot').forEach((slot, index) => {
      const card = player?.spread?.[index] || null;
      const cardEl = slot.querySelector('.card[data-uid]');
      if (!card || !cardEl) {
        slot.classList.add('ability-empty-slot');
        return;
      }
      const valid = abilitySelect.validIds.has(card.uid);
      const isPicked = valid && picked.has(card.uid);
      slot.classList.toggle('ability-target-slot', valid && !isPicked);
      slot.classList.toggle('ability-picked-slot', isPicked);
      slot.classList.toggle('ability-disabled-slot', !valid);
      cardEl.classList.toggle('ability-target', valid && !isPicked);
      cardEl.classList.toggle('ability-picked', isPicked);
      cardEl.classList.toggle('ability-disabled', !valid);
    });
  }

  function clearAbilityTargetClasses() {
    doc.querySelectorAll('body.mp-game-active #hand .card, body.mp-game-active #spread .card').forEach(cardEl => {
      cardEl.classList.remove('ability-target', 'ability-picked', 'ability-disabled');
    });
    doc.querySelectorAll('body.mp-game-active #spread .slot').forEach(slot => {
      slot.classList.remove('ability-target-slot', 'ability-picked-slot', 'ability-disabled-slot', 'ability-empty-slot');
    });
    doc.body.classList.toggle('mp-ability-flow-active', !!abilitySelect || resolving);
  }

  function setAbilityFlowActive(active) {
    doc.body.classList.toggle('mp-ability-flow-active', active || !!abilitySelect);
  }

  function showCardChoice(title, prompt, cards) {
    return new Promise(resolve => {
      const modal = doc.getElementById('modal');
      const titleEl = doc.getElementById('modalTitle');
      const promptEl = doc.getElementById('modalPrompt');
      const choices = doc.getElementById('choices');
      const toggle = doc.getElementById('modalToggle');
      if (!modal || !titleEl || !promptEl || !choices) { resolve(null); return; }

      titleEl.textContent = title;
      promptEl.textContent = prompt;
      if (toggle) toggle.textContent = 'Hide';
      choices.innerHTML = '';

      const player = currentPlayer();
      const hintPool = uniqueCards([...(player?.spread || []).filter(Boolean), ...(player?.hand || []), ...(cards || [])]);
      for (const card of cards || []) {
        const cardEl = doc.createElement('div');
        cardEl.className = `card ${card.type === 'major' ? 'major' : ''}`;
        cardEl.innerHTML = target.cardHTML ? target.cardHTML(card) : `<div class="title">${cardTitle(card)}</div>`;
        try { applyHint(cardEl, card, hintPool); } catch (_) {}
        applyCardPhoto(cardEl, card);
        cardEl.onclick = () => {
          modal.classList.remove('show', 'collapsed');
          resolve(card);
        };
        choices.appendChild(cardEl);
      }

      modal.classList.remove('collapsed');
      modal.classList.add('show');
      target.playSound?.('flip');
    });
  }

  async function fallbackChoice(title = 'No valid ability result') {
    await showNotice(title, 'No valid target was available. Draw 1 instead.');
    return { fallbackDraw: 1 };
  }

  function showNotice(title, prompt) {
    return new Promise(resolve => {
      const modal = doc.getElementById('modal');
      const titleEl = doc.getElementById('modalTitle');
      const promptEl = doc.getElementById('modalPrompt');
      const choices = doc.getElementById('choices');
      const toggle = doc.getElementById('modalToggle');
      if (!modal || !titleEl || !promptEl || !choices) { resolve(); return; }

      titleEl.textContent = title;
      promptEl.textContent = prompt;
      if (toggle) toggle.textContent = 'Hide';
      choices.innerHTML = '';
      const button = doc.createElement('button');
      button.className = 'mp-action-btn invoke';
      button.type = 'button';
      button.textContent = 'Continue';
      button.onclick = () => {
        modal.classList.remove('show', 'collapsed');
        resolve();
      };
      choices.appendChild(button);
      modal.classList.remove('collapsed');
      modal.classList.add('show');
      target.playSound?.('flip');
    });
  }

  function inPlayCards(player, sourceUid) {
    return [...(player.hand || []).filter(card => card.uid !== sourceUid), ...(player.spread || []).filter(Boolean)]
      .filter(card => card.type === 'major' || card.type === 'court');
  }

  function heldCardsForAnchor(player, ability, anchor) {
    return abilityHeldCards(player.deck, ability, [anchor]).slice(0, ability.count ?? 2);
  }

  function heldCardsBetween(player, first, second) {
    return uniqueCards(abilityHeldCards(player.deck, { type: ABILITY_TYPES.BETWEEN }, [first, second]));
  }

  function sortCards(cards) {
    if (typeof target.sortCards === 'function') return target.sortCards((cards || []).slice());
    return (cards || []).slice().sort((a, b) => cleanCardName(a).localeCompare(cleanCardName(b)));
  }

  function cleanCardName(card) {
    if (typeof target.cleanName === 'function') return target.cleanName(card);
    try { return cardTitle(card).replace(/<[^>]+>/g, ''); }
    catch (_) { return card?.name || card?.id || 'Card'; }
  }

  function singleplayerPromptFor(ability) {
    if (ability.type === ABILITY_TYPES.NEIGHBOR) return 'Choose an anchor card. Neighbor finds adjacent cards: nearby Major numbers or court ranks in the same suit.';
    if (ability.type === ABILITY_TYPES.KIN) return 'Choose an anchor card. Kin finds cards of the same Arcana.';
    if (ability.type === ABILITY_TYPES.MIRROR) return 'Choose a card. Take the card opposite it across the centerline of its Arcana. (Knight/Queen, 10/11)';
    return ability.prompt || 'Choose an anchor card.';
  }

  function uniqueCards(cards) {
    const seen = new Set();
    return (cards || []).filter(card => {
      if (!card || seen.has(card.uid)) return false;
      seen.add(card.uid);
      return true;
    });
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  doc.addEventListener('click', event => {
    if (!abilitySelect || !doc.body.classList.contains('mp-game-active')) return;
    const cardEl = event.target.closest?.('body.mp-game-active #hand .card[data-uid], body.mp-game-active #spread .card[data-uid]');
    if (!cardEl) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    const uid = Number(cardEl.dataset.uid);
    const player = currentPlayer();
    const card = [...(player?.hand || []), ...(player?.spread || []).filter(Boolean)].find(item => item.uid === uid);
    if (card) handleTargetCard(card);
  }, true);

  target.tlrMpInvoke = invokeUsingSingleplayerFlow;
  target.tlrMpDiscard = invokeUsingSingleplayerFlow;
  target.tlrMpConfirmAbilitySelection = confirmAbilitySelection;
  target.tlrMpCancelAction = function (...args) {
    cancelAbilitySelection();
    return originalCancel?.apply(this, args);
  };
  target.tlrMpLeave = function (...args) {
    cancelAbilitySelection();
    if (confirmBtn) {
      confirmBtn.onclick = null;
      if (originalConfirmAttr) confirmBtn.setAttribute('onclick', originalConfirmAttr);
    }
    return originalLeave?.apply(this, args);
  };

  // Preserve direct access for interaction cards if this module decides to defer.
  target.__tlrMpOriginalInvoke = originalInvoke;
  target.__tlrMpOriginalDiscard = originalDiscard;
}

function installStyle(doc) {
  if (doc.getElementById('mp-singleplayer-ability-flow-style')) return;
  const style = doc.createElement('style');
  style.id = 'mp-singleplayer-ability-flow-style';
  style.textContent = `
    body.mp-game-active.mp-ability-flow-active #abilityPrompt {
      display: flex !important;
      z-index: 2147482600 !important;
    }
    body.mp-game-active.mp-ability-flow-active .mp-pills-actions button {
      pointer-events: none;
    }
  `;
  doc.head.appendChild(style);
}
