/* global state, $, _slotEls, handleAbilityHandClick */
import { cardHTML, applyCardPhoto, CARD_SHEET } from './renderCard.mjs';
import { applyHint } from './renderHints.mjs';
import { installCardDetailGestures } from './cardDetailGestures.mjs';

function installSelectedHintLayerFix(target = window) {
  const doc = target.document;
  if (!doc || doc.getElementById('selected-hint-layer-fix')) return;
  const style = doc.createElement('style');
  style.id = 'selected-hint-layer-fix';
  style.textContent = `
    @media(max-width:640px){
      html body.single-player-v2.generated-sheet-ready:has(#hand .card.sel[data-hint]) .handDock,
      html body.single-player-v2.generated-sheet-ready:has(#hand .card.ability-picked[data-hint]) .handDock,
      html body.single-player-v2.generated-sheet-ready:has(#hand .card.purge-picked[data-hint]) .handDock,
      html body.single-player-v2.generated-sheet-ready:has(#hand .card.press-highlight[data-hint]) .handDock{
        z-index:64!important;
      }
      html body.single-player-v2.generated-sheet-ready #hand .card.sel[data-hint],
      html body.single-player-v2.generated-sheet-ready #hand .card.ability-picked[data-hint],
      html body.single-player-v2.generated-sheet-ready #hand .card.purge-picked[data-hint],
      html body.single-player-v2.generated-sheet-ready #hand .card.press-highlight[data-hint]{
        overflow:visible!important;
        z-index:1001!important;
      }
      html body.single-player-v2.generated-sheet-ready #hand .card.sel[data-hint]::after,
      html body.single-player-v2.generated-sheet-ready #hand .card.ability-picked[data-hint]::after,
      html body.single-player-v2.generated-sheet-ready #hand .card.purge-picked[data-hint]::after,
      html body.single-player-v2.generated-sheet-ready #hand .card.press-highlight[data-hint]::after{
        z-index:1002!important;
      }
    }
  `;
  doc.head.appendChild(style);
}

function cleanupDetachedHandCards(target = window) {
  const doc = target.document;
  const hand = doc?.getElementById('hand');
  if (!doc || !hand || typeof state === 'undefined') return;

  const handState = state.hand || [];
  const handIds = new Set(handState.map(card => card.uid));
  let restored = false;

  doc.querySelectorAll('body > .card[data-uid]').forEach(cardEl => {
    if (cardEl.classList.contains('hand-card-dragging')) return;

    const uid = Number(cardEl.dataset.uid);
    cardEl.style.removeProperty('transform');
    cardEl.style.removeProperty('position');
    cardEl.style.removeProperty('left');
    cardEl.style.removeProperty('top');
    cardEl.style.removeProperty('width');
    cardEl.style.removeProperty('height');
    cardEl.style.removeProperty('margin');
    cardEl.style.removeProperty('z-index');

    if (!handIds.has(uid)) {
      cardEl.remove();
      return;
    }

    const desiredIndex = handState.findIndex(card => card.uid === uid);
    const currentCards = [...hand.querySelectorAll(':scope > .card[data-uid]')];
    hand.insertBefore(cardEl, currentCards[desiredIndex] || null);
    restored = true;
  });

  if (restored && typeof target.__handTriggerLayout === 'function') target.__handTriggerLayout();
}

function installDetachedHandCardCleanup(target = window) {
  if (!target?.document || target.__tlrDetachedHandCardCleanupInstalled) return;
  target.__tlrDetachedHandCardCleanupInstalled = true;
  const scheduleCleanup = () => target.setTimeout(() => cleanupDetachedHandCards(target), 0);
  target.document.addEventListener('pointerup', scheduleCleanup, true);
  target.document.addEventListener('pointercancel', scheduleCleanup, true);
  target.addEventListener('blur', scheduleCleanup);
}

if (typeof window !== 'undefined') {
  installCardDetailGestures(window);
  installSelectedHintLayerFix(window);
  installDetachedHandCardCleanup(window);
}

function placeIntoSlot(index, view) {
  if (view && view.onPlaceCard) view.onPlaceCard(index);
  else if (typeof window.placeCard === 'function') window.placeCard(index);
}

function targetCard(card, view) {
  if (view && view.onAbilityTarget) view.onAbilityTarget(card);
  else handleAbilityHandClick(card);
}

function clearHintVisual(element) {
  if (!element) return;
  element.style.removeProperty('--hint-rgb');
  element.style.removeProperty('--hint-shadow');
  delete element.dataset.hint;
}

export function renderSpread(ability, inPurge, view = null) {
  cleanupDetachedHandCards(window);
  if (document.body.classList.contains('mp-game-active') && !window.__tlrMpUsingSingleAbilityFlow) return;
  const displaySpread = view && view.spread ? view.spread : state.spread;
  const displayHand = view ? (view.hand || []) : state.hand;
  const selected = view && Object.prototype.hasOwnProperty.call(view, 'selected') ? view.selected : state.selected;
  const dragActive = typeof window !== 'undefined' && window.__handReorderActive;
  const hintState = { spread: displaySpread || [], hand: displayHand || [] };
  const hintPool=[...hintState.spread.filter(Boolean),...hintState.hand];
  const sp = $('#spread');
  if (!_slotEls || _slotEls.length !== 5 || !sp.contains(_slotEls[0])) {
    _slotEls = [];
    sp.replaceChildren();
    for (let i = 0; i < 5; i += 1) {
      const s = document.createElement('div');
      s.style.setProperty('--a', ((i - 2) * 4) + 'deg');
      sp.appendChild(s);
      _slotEls.push(s);
    }
  }
  for (let i = 0; i < 5; i += 1) {
    const card = displaySpread[i];
    const s = _slotEls[i];
    clearHintVisual(s);
    let cls = 'slot ' + (card ? 'filled' : 'empty') + ((selected !== null && !card && !dragActive) ? ' target' : '');
    if (card) {
      const validSpread = ability && ability.validIds.has(card.uid);
      const pickedSpread = ability && validSpread && ability.picked.includes(card.uid);
      if (ability) cls += ' ' + (pickedSpread ? 'ability-picked-slot' : (validSpread ? 'ability-target-slot' : 'ability-disabled-slot'));
      s.className = cls;
      s.onclick = (ability && validSpread) ? (ev) => { ev.stopPropagation(); targetCard(card, view); } : null;
      let e = s.firstElementChild;
      const sameCard = e && e.classList && e.classList.contains('card') && Number(e.dataset.uid) === card.uid;
      if (!sameCard) {
        s.replaceChildren();
        e = document.createElement('div');
        e.dataset.uid = card.uid;
        e.innerHTML = cardHTML(card);
        applyCardPhoto(e, card);
        s.appendChild(e);
      } else {
        clearHintVisual(e);
      }
      e.className = 'card ' + (card.type === 'major' ? 'major ' : '') + (CARD_SHEET[card.id] ? 'photo ' : '') + (validSpread && !pickedSpread ? 'ability-target ' : '') + (pickedSpread ? 'ability-picked ' : '') + (ability && !validSpread ? 'ability-disabled ' : '');
      if (!inPurge) {
        applyHint(e, card, hintPool, hintState);
        // The placed card sits inside a layered, shadowed slot. Mirror the hint
        // state onto the slot so its halo remains visible outside that stacking
        // context instead of disappearing behind the fan.
        applyHint(s, card, hintPool, hintState);
      }
      e.onclick = (ability && validSpread) ? (ev) => { ev.stopPropagation(); targetCard(card, view); } : null;
    } else {
      if (ability) cls += ' ability-empty-slot';
      s.className = cls;
      let nm = s.firstElementChild;
      const sameEmpty = nm && nm.classList && nm.classList.contains('num');
      if (!sameEmpty) {
        s.replaceChildren();
        nm = document.createElement('div');
        nm.className = 'num';
        s.appendChild(nm);
      }
      nm.textContent = String(i + 1);
      s.onclick = ability ? null : () => placeIntoSlot(i, view);
    }
  }
}
