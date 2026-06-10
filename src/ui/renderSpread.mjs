// Spread renderer (Phase 15.3). Moved verbatim from index.html's render().
// Reuses the 5 stable slot elements via the global _slotEls cache.
/* global state, $, _slotEls, handleAbilityHandClick, placeCard */
import { cardHTML, applyCardPhoto, CARD_SHEET } from './renderCard.mjs';
import { applyHint } from './renderHints.mjs';

export function renderSpread(ability, inPurge) {
  const sp=$('#spread');
  // Lazily create the 5 stable slot elements; reuse them across renders so
  // CSS transitions on slot tilt / card transforms stay continuous and no
  // DOM allocation happens on every state change.
  if(!_slotEls||_slotEls.length!==5||!sp.contains(_slotEls[0])){
    _slotEls=[];
    sp.replaceChildren();
    for(let i=0;i<5;i++){
      const s=document.createElement('div');
      s.style.setProperty('--a',((i-2)*4)+'deg');
      sp.appendChild(s);
      _slotEls.push(s);
    }
  }
  for(let i=0;i<5;i++){
    const card=state.spread[i];
    const s=_slotEls[i];
    let cls='slot '+(card?'filled':'empty')+(state.selected!==null&&!card?' target':'');
    if(card){
      const validSpread=ability&&ability.validIds.has(card.uid);
      const pickedSpread=ability&&validSpread&&ability.picked.includes(card.uid);
      if(ability)cls+=' '+(pickedSpread?'ability-picked-slot':(validSpread?'ability-target-slot':'ability-disabled-slot'));
      s.className=cls;
      s.onclick=(ability&&validSpread)?(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);}:null;
      // Diff the card child by uid: reuse if same uid, otherwise replace.
      let e=s.firstElementChild;
      const sameCard=e&&e.classList&&e.classList.contains('card')&&Number(e.dataset.uid)===card.uid;
      if(!sameCard){
        s.replaceChildren();
        e=document.createElement('div');
        e.dataset.uid=card.uid;
        e.innerHTML=cardHTML(card);
        applyCardPhoto(e,card);
        s.appendChild(e);
      }else{
        e.style.removeProperty('--hint-rgb');
        e.style.removeProperty('--hint-shadow');
        delete e.dataset.hint;
      }
      e.className='card '+(card.type==='major'?'major ':'')+(CARD_SHEET[card.id]?'photo ':'')+(validSpread&&!pickedSpread?'ability-target ':'')+(pickedSpread?'ability-picked ':'')+(ability&&!validSpread?'ability-disabled ':'');
      if(!inPurge)applyHint(e,card);
      e.onclick=(ability&&validSpread)?(ev)=>{ev.stopPropagation();handleAbilityHandClick(card);}:null;
    }else{
      if(ability)cls+=' ability-empty-slot';
      s.className=cls;
      // Reuse the .num child if it's already there.
      let nm=s.firstElementChild;
      const sameEmpty=nm&&nm.classList&&nm.classList.contains('num');
      if(!sameEmpty){
        s.replaceChildren();
        nm=document.createElement('div');
        nm.className='num';
        s.appendChild(nm);
      }
      nm.textContent=String(i+1);
      s.onclick=ability?null:()=>placeCard(i);
    }
  }
}
