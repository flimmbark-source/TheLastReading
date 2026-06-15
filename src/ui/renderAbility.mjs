// Ability/choice modal renderer (Phase 15.5). Moved verbatim from index.html.
// Selection logic (selectFromHand, confirmAbilitySelection) and ability
// resolution stay with the game flow; this module owns the modal DOM.
/* global $, state, uniqueCards, applyHint, cardHTML, applyCardPhoto, playSound, tlrArchitectureSync */
import { abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';
import { getPendingPreviewFn } from '../app/abilityTargetBridge.mjs';

export function choice(title,prompt,cards,cb){$('#modalTitle').textContent=title;$('#modalPrompt').textContent=prompt;$('#modalToggle').textContent='Hide';let ch=$('#choices');ch.innerHTML='';cards.forEach(c=>{let e=document.createElement('div');e.className='card '+(c.type==='major'?'major':'');applyHint(e,c,uniqueCards([...state.spread.filter(Boolean),...state.hand,c]));e.innerHTML=cardHTML(c);applyCardPhoto(e,c);e.onclick=()=>{$('#modal').classList.remove('show','collapsed');cb(c)};ch.appendChild(e)});$('#modal').classList.remove('collapsed');$('#modal').classList.add('show');playSound('flip');tlrArchitectureSync()}

export function toggleModalCollapse(){let m=$('#modal');if(!m.classList.contains('show'))return;m.classList.toggle('collapsed');$('#modalToggle').textContent=m.classList.contains('collapsed')?'Show':'Hide'}

export function renderAbilityPrompt(){
  const el=$('#abilityPrompt');
  if(!el)return;
  const storeState=window.tlrStore?.getState?.()??null;
  const a=storeState?selectAbilityTargetView(storeState):state.abilitySelect;
  if(!a){el.classList.remove('show');return}
  $('#abilityPromptTitle').textContent=a.title;
  let preview='';
  const previewFn=storeState?getPendingPreviewFn():a.previewFn;
  if(previewFn&&a.picked.length){
    const allCards=[...state.hand,...state.spread.filter(Boolean)];
    const picked=a.picked.map(id=>allCards.find(c=>c.uid===id)).filter(Boolean);
    preview=previewFn(...picked)||'';
  }
  $('#abilityPromptText').innerHTML=preview?a.prompt+'<br><b>'+preview+'</b>':a.prompt;
  $('#abilityConfirm').disabled=a.picked.length<a.count;
  el.classList.add('show');
}

export function renderPurgePrompt(){const el=$('#purgePrompt');if(!el)return;const active=state.purgeSelect!==null;el.classList.toggle('show',active);if(active){const count=state.purgeSelect.length;const sc=$('#purgeCount');if(sc)sc.textContent=count;const btn=$('#purgeConfirm');if(btn)btn.disabled=count!==3}}
