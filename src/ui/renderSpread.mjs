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

function markFreshSpreadCard(element) {
  if (!element || document.body.classList.contains('mp-game-active')) return;
  element.classList.add('card-just-placed');
  const clear = () => element.classList.remove('card-just-placed');
  element.addEventListener('animationend', clear, { once: true });
  window.setTimeout(clear, 500);
}

export function renderSpread(ability, inPurge, view = null) {
  if (document.body.classList.contains('mp-game-active') && !window.__tlrMpUsingSingleAbilityFlow) return;
  const displaySpread = view && view.spread ? view.spread : state.spread;
  const selected = view && Object.prototype.hasOwnProperty.call(view, 'selected') ? view.selected : state.selected;
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
    let cls = 'slot ' + (card ? 'filled' : 'empty') + (selected !== null && !card ? ' target' : '');
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
        markFreshSpreadCard(e);
      } else {
        e.style.removeProperty('--hint-rgb');
        e.style.removeProperty('--hint-shadow');
        delete e.dataset.hint;
      }
      const transient = e.classList.contains('card-just-placed') ? 'card-just-placed ' : '';
      e.className = 'card ' + transient + (card.type === 'major' ? 'major ' : '') + (CARD_SHEET[card.id] ? 'photo ' : '') + (validSpread && !pickedSpread ? 'ability-target ' : '') + (pickedSpread ? 'ability-picked ' : '') + (ability && !validSpread ? 'ability-disabled ' : '');
      if (!inPurge) applyHint(e, card);
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
