// Ability/choice modal renderer (Phase 15.5). Moved verbatim from index.html.
// Selection logic (selectFromHand, confirmAbilitySelection) and ability
// resolution stay with the game flow; this module owns the modal DOM.
/* global $, state, uniqueCards, applyHint, cardHTML, applyCardPhoto, playSound, tlrArchitectureSync */
import { abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';
import { getPendingPreviewFn } from '../app/abilityTargetBridge.mjs';

let activeChoiceCancel=null;

function ensureChoiceLayoutStyles(){
  if(document.getElementById('ability-choice-layout-style'))return;
  const style=document.createElement('style');
  style.id='ability-choice-layout-style';
  style.textContent=`
    .modal:not(.collapsed) #choices.choices{
      display:grid!important;
      grid-auto-flow:column!important;
      grid-auto-columns:130px!important;
      grid-template-columns:none!important;
      justify-content:safe center!important;
      align-items:start!important;
      gap:12px!important;
      width:100%!important;
      max-width:100%!important;
      overflow-x:auto!important;
      overflow-y:visible!important;
      padding:4px 2px 12px!important;
      box-sizing:border-box!important;
      overscroll-behavior-x:contain;
      scroll-snap-type:x proximity;
    }
    #choices.choices>.choice-card{
      position:relative!important;
      inset:auto!important;
      width:130px!important;
      min-width:130px!important;
      max-width:130px!important;
      height:195px!important;
      margin:0!important;
      transform:none!important;
      scroll-snap-align:center;
    }
  `;
  document.head.appendChild(style);
}

function applyChoiceLayout(container){
  container.style.setProperty('display','grid','important');
  container.style.setProperty('grid-auto-flow','column','important');
  container.style.setProperty('grid-auto-columns','130px','important');
  container.style.setProperty('grid-template-columns','none','important');
  container.style.setProperty('justify-content','safe center','important');
  container.style.setProperty('align-items','start','important');
  container.style.setProperty('gap','12px','important');
  container.style.setProperty('width','100%','important');
  container.style.setProperty('max-width','100%','important');
  container.style.setProperty('overflow-x','auto','important');
  container.style.setProperty('overflow-y','visible','important');
}

function applyChoiceCardLayout(card){
  card.style.setProperty('position','relative','important');
  card.style.setProperty('inset','auto','important');
  card.style.setProperty('width','130px','important');
  card.style.setProperty('min-width','130px','important');
  card.style.setProperty('max-width','130px','important');
  card.style.setProperty('height','195px','important');
  card.style.setProperty('margin','0','important');
  card.style.setProperty('transform','none','important');
}

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
    $('#modal').classList.remove('show','collapsed','ability-reveal','card-browse');
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
  ensureChoiceLayoutStyles();
  $('#modalTitle').textContent=title;$('#modalPrompt').textContent=prompt;$('#modalToggle').textContent='Hide';
  window.tlrApplyGameTerms?.($('#modalPrompt'), { auto: true });
  const ch=$('#choices');ch.innerHTML='';applyChoiceLayout(ch);
  cards.forEach(c=>{
    const e=document.createElement('div');
    e.className='card choice-card '+(c.type==='major'?'major':'');
    applyChoiceCardLayout(e);
    applyHint(e,c,uniqueCards([...state.spread.filter(Boolean),...state.hand,c]));
    e.innerHTML=cardHTML(c);applyCardPhoto(e,c);
    e.onclick=()=>{activeChoiceCancel=null;$('#modal').classList.remove('show','collapsed','ability-reveal','card-browse');cb(c)};
    ch.appendChild(e);
  });
  // Reaching this modal always means an ability is actively resolving, so
  // Cancel is unconditionally available — it never touches the discard,
  // just resolves with no card taken so resolveAbility's retry loop can
  // re-show targeting from the start.
  const cancelBtn=ensureModalCancelButton();
  if(cancelBtn)cancelBtn.hidden=false;
  activeChoiceCancel=()=>cb(null);
  $('#modal').classList.remove('collapsed','card-browse');
  $('#modal').classList.add('show','ability-reveal');
  playSound('flip');tlrArchitectureSync()
}

export function choiceAsync(title,prompt,cards){return new Promise(resolve=>choice(title,prompt,cards,resolve))}

// Read-only card browser (attic deck). Reuses the choice modal shell, but
// clicking a card opens its detail view instead of taking it; only the
// header Cancel button closes the window. The card-browse class marks the
// modal as browse-owned so the attic flow can close it when leaving.
export function browseCards(title,prompt,cards){
  ensureChoiceLayoutStyles();
  $('#modalTitle').textContent=title;$('#modalPrompt').textContent=prompt;$('#modalToggle').textContent='Hide';
  window.tlrApplyGameTerms?.($('#modalPrompt'), { auto: true });
  const ch=$('#choices');ch.innerHTML='';applyChoiceLayout(ch);
  cards.forEach(c=>{
    const e=document.createElement('div');
    e.className='card choice-card '+(c.type==='major'?'major':'');
    applyChoiceCardLayout(e);
    e.innerHTML=cardHTML(c);applyCardPhoto(e,c);
    e.onclick=()=>{window.expandCard?.(c)};
    ch.appendChild(e);
  });
  const cancelBtn=ensureModalCancelButton();
  if(cancelBtn)cancelBtn.hidden=false;
  activeChoiceCancel=null;
  $('#modal').classList.remove('collapsed','ability-reveal');
  $('#modal').classList.add('show','card-browse');
  playSound('flip');tlrArchitectureSync()
}

export function toggleModalCollapse(){const m=$('#modal');if(!m.classList.contains('show'))return;m.classList.toggle('collapsed');$('#modalToggle').textContent=m.classList.contains('collapsed')?'Show':'Hide'}

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
  window.tlrApplyGameTerms?.($('#abilityPromptText'), { auto: true });
  $('#abilityConfirm').disabled=a.picked.length<a.count;
  if(cancel)cancel.hidden=!(typeof window.tlrCanCancelAbilitySelection==='function'&&window.tlrCanCancelAbilitySelection());
  el.classList.add('show');
}

export function renderPurgePrompt(){const el=$('#purgePrompt');if(!el)return;const active=state.purgeSelect!==null;el.classList.toggle('show',active);if(active){const count=state.purgeSelect.length;const sc=$('#purgeCount');if(sc)sc.textContent=count;const btn=$('#purgeConfirm');if(btn)btn.disabled=count!==3}}
