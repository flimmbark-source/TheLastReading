/* global state, $, _slotEls, handleAbilityHandClick */
import { cardHTML, applyCardPhoto, CARD_SHEET } from './renderCard.mjs';
import { applyHint } from './renderHints.mjs';

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
  if (document.body.classList.contains('mp-game-active') && !window.__tlrMpUsingSingleAbilityFlow) return;
  const displaySpread = view && view.spread ? view.spread : state.spread;
  const displayHand = view ? (view.hand || []) : state.hand;
  const selected = view && Object.prototype.hasOwnProperty.call(view, 'selected') ? view.selected : state.selected;
  const hintState={spread:displaySpread||[],hand:displayHand||[]};
  const hintPool=[...hintState.spread.filter(Boolean),...hintState.hand];
  const sp = $('#spread');
  if (!_slotEls || _slotEls.length !== 5 || !sp.contains(_slotEls[0])) {
    _slotEls = [];
    sp.replaceChildren();
    for (let i = 0; i < 5; i += 1) {
      const s = document.createElement('div');
      s.style.setProperty('--a', ((i - 2) * 4) + 'deg');
      // Decorative frame layer. Kept as a separate child so the card can render
      // on a layer above every slot's frame (see spreadFrameLayer.css): the
      // frame carries the slot art, the card sits above it and never ducks
      // under a neighbouring slot's frame regardless of how it was placed.
      const frame = document.createElement('div');
      frame.className = 'slot-frame';
      frame.setAttribute('aria-hidden', 'true');
      s.appendChild(frame);
      sp.appendChild(s);
      _slotEls.push(s);
    }
  }
  for (let i = 0; i < 5; i += 1) {
    const card = displaySpread[i];
    const s = _slotEls[i];
    clearHintVisual(s);
    // The decorative frame layer must survive every re-render (it is a sibling
    // of the card, not part of it). Recreate it only if a slot was adopted from
    // a pre-frame-layer DOM.
    if (!s.querySelector(':scope > .slot-frame')) {
      const frame = document.createElement('div');
      frame.className = 'slot-frame';
      frame.setAttribute('aria-hidden', 'true');
      s.insertBefore(frame, s.firstChild);
    }
    let cls = 'slot ' + (card ? 'filled' : 'empty') + (selected !== null && !card ? ' target' : '');
    if (card) {
      const validSpread = ability && ability.validIds.has(card.uid);
      const pickedSpread = ability && validSpread && ability.picked.includes(card.uid);
      if (ability) cls += ' ' + (pickedSpread ? 'ability-picked-slot' : (validSpread ? 'ability-target-slot' : 'ability-disabled-slot'));
      s.className = cls;
      s.onclick = (ability && validSpread) ? (ev) => { ev.stopPropagation(); targetCard(card, view); } : null;
      s.querySelector(':scope > .num')?.remove();
      let e = s.querySelector(':scope > .card');
      const sameCard = e && Number(e.dataset.uid) === card.uid;
      if (!sameCard) {
        if (e) e.remove();
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
        // Mirror the hint onto the slot too so the slot-level halo can render
        // around the card.
        applyHint(s, card, hintPool, hintState);
      }
      e.onclick = (ability && validSpread) ? (ev) => { ev.stopPropagation(); targetCard(card, view); } : null;
    } else {
      if (ability) cls += ' ability-empty-slot';
      s.className = cls;
      s.querySelector(':scope > .card')?.remove();
      let nm = s.querySelector(':scope > .num');
      if (!nm) {
        nm = document.createElement('div');
        nm.className = 'num';
        s.appendChild(nm);
      }
      nm.textContent = String(i + 1);
      s.onclick = ability ? null : () => placeIntoSlot(i, view);
    }
  }
}