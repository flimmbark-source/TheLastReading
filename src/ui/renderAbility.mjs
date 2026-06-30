// Ability/choice modal renderer (Phase 15.5). Moved verbatim from index.html.
// Selection logic (selectFromHand, confirmAbilitySelection) and ability
// resolution stay with the game flow; this module owns the modal DOM.
/* global $, state, uniqueCards, applyHint, cardHTML, applyCardPhoto, playSound, tlrArchitectureSync */
import { abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';
import { getPendingPreviewFn } from '../app/abilityTargetBridge.mjs';

let activeChoiceCancel=null;

function ensureModalCancelButton(){
  let cancel=$('#modalCancel');
  if(cancel)return cancel;
  const toggle=$('#modalToggle');
  if(!toggle)return null;
  let actions=toggle.closest('.modal-head-actions');
  if(!actions){
    actions=document.createElement('div');
    actions.className='modal-head-actions';
    toggle.parentNode.insertBefore(actions,toggle);
    actions.appendChild(toggle);
  }
  cancel=document.createElement('button');
  cancel.id='modalCancel';
  cancel.type='button';
  cancel.className='modal-cancel';
  cancel.textContent='Cancel';
  cancel.hidden=true;
  cancel.addEventListener('click',()=>{
    $('#modal').classList.remove('show','collapsed','ability-reveal');
    const fn=activeChoiceCancel;
    activeChoiceCancel=null;
    fn?.();
  });
  actions.insertBefore(cancel,toggle);
  return cancel;
}

function ensureAbilityCancelButton(){
  let cancel=$('#abilityCancel');
  if(cancel)return cancel;
  const confirm=$('#abilityConfirm');
  if(!confirm)return null;
  let actions=confirm.closest('.ability-prompt-actions');
  if(!actions){
    actions=document.createElement('div');
    actions.className='ability-prompt-actions';
    confirm.parentNode.insertBefore(actions,confirm);
    actions.appendChild(confirm);
  }
  cancel=document.createElement('button');
  cancel.id='abilityCancel';
  cancel.type='button';
  cancel.textContent='Cancel';
  cancel.hidden=true;
  cancel.addEventListener('click',()=>window.cancelAbilitySelection?.());
  actions.appendChild(cancel);
  return cancel;
}

export function choice(title,prompt,cards,cb){
  // A single candidate isn't a choice — hand it over without popping the modal.
  if(cards.length===1){activeChoiceCancel=null;playSound('flip');cb(cards[0]);return}
  $('#modalTitle').textContent=title;$('#modalPrompt').textContent=prompt;$('#modalToggle').textContent='Hide';
  let ch=$('#choices');ch.innerHTML='';
  cards.forEach(c=>{
    let e=document.createElement('div');
    e.className='card choice-card '+(c.type==='major'?'major':'');
    applyHint(e,c,uniqueCards([...state.spread.filter(Boolean),...state.hand,c]));
    e.innerHTML=cardHTML(c);applyCardPhoto(e,c);
    e.onclick=()=>{activeChoiceCancel=null;$('#modal').classList.remove('show','collapsed','ability-reveal');cb(c)};
    ch.appendChild(e);
  });
  const cancelBtn=ensureModalCancelButton();
  const canCancel=typeof window.canCancelPendingDiscardAbility==='function'&&window.canCancelPendingDiscardAbility();
  if(cancelBtn)cancelBtn.hidden=!canCancel;
  activeChoiceCancel=canCancel?()=>{window.cancelPendingDiscardAbility?.();cb(null)}:null;
  $('#modal').classList.remove('collapsed');
  $('#modal').classList.add('show','ability-reveal');
  playSound('flip');tlrArchitectureSync()
}

export function choiceAsync(title,prompt,cards){return new Promise(resolve=>choice(title,prompt,cards,resolve))}

export function toggleModalCollapse(){let m=$('#modal');if(!m.classList.contains('show'))return;m.classList.toggle('collapsed');$('#modalToggle').textContent=m.classList.contains('collapsed')?'Show':'Hide'}

export function renderAbilityPrompt(){
  const el=$('#abilityPrompt');
  if(!el)return;
  const cancel=ensureAbilityCancelButton();
  const storeState=window.tlrStore?.getState?.()??null;
  const a=storeState?selectAbilityTargetView(storeState):null;
  if(!a){el.classList.remove('show');if(cancel)cancel.hidden=true;return}
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
  if(cancel)cancel.hidden=!(typeof window.tlrCanCancelAbilitySelection==='function'&&window.tlrCanCancelAbilitySelection());
  el.classList.add('show');
}

export function renderPurgePrompt(){const el=$('#purgePrompt');if(!el)return;const active=state.purgeSelect!==null;el.classList.toggle('show',active);if(active){const count=state.purgeSelect.length;const sc=$('#purgeCount');if(sc)sc.textContent=count;const btn=$('#purgeConfirm');if(btn)btn.disabled=count!==3}}
