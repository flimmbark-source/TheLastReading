// Event/control binding adapter for the final index.html cleanup.
// While inline onclick/oninput attributes remain, this module skips those nodes
// to avoid double-firing. Once attributes are removed, these bindings become active.

function bindClick(id,handler,target){
  const el=document.getElementById(id);
  if(!el || el.__tlrControlBound)return;
  if(el.hasAttribute('onclick'))return;
  el.__tlrControlBound=true;
  el.addEventListener('click',event=>handler(event,target));
}

function bindInput(id,handler,target){
  const el=document.getElementById(id);
  if(!el || el.__tlrControlBound)return;
  if(el.hasAttribute('oninput')||el.hasAttribute('onchange'))return;
  el.__tlrControlBound=true;
  el.addEventListener('input',event=>handler(event,target));
}

export function bindControls(target = window){
  bindClick('menuBtn',(_,t)=>{if(typeof t.toggleMenu==='function')t.toggleMenu();},target);
  bindClick('scoringBtn',(event,t)=>{if(typeof t.toggleRef==='function')t.toggleRef(event);},target);
  bindClick('abilitiesBtn',(event,t)=>{if(typeof t.toggleAbilityRef==='function')t.toggleAbilityRef(event);},target);
  bindClick('mullBtn',(_,t)=>{if(typeof t.mulligan==='function')t.mulligan();},target);
  bindClick('discardBtn',(_,t)=>{if(typeof t.discardSelected==='function')t.discardSelected();},target);
  bindClick('purgeBtn',(_,t)=>{if(typeof t.startPurge==='function')t.startPurge();},target);
  bindClick('abilityConfirm',(_,t)=>{if(typeof t.confirmAbilitySelection==='function')t.confirmAbilitySelection();},target);
  bindClick('purgeConfirm',(_,t)=>{if(typeof t.confirmPurge==='function')t.confirmPurge();},target);
  bindClick('tutSkipBtn',(event,t)=>{if(typeof t.tutSkip==='function')t.tutSkip();event.stopPropagation();},target);
  bindClick('modalToggle',(_,t)=>{if(typeof t.toggleModalCollapse==='function')t.toggleModalCollapse();},target);
  bindInput('musicVol',(event,t)=>{if(typeof t.setMusicVol==='function')t.setMusicVol(+event.target.value);},target);
  bindInput('sfxVol',(event,t)=>{if(typeof t.setSfxVol==='function')t.setSfxVol(+event.target.value);},target);
}

export function installControlBindings(target = window){
  if(!target || target.__tlrControlBindingsInstalled)return;
  target.__tlrControlBindingsInstalled=true;
  target.tlrControlBindings={bindControls};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>bindControls(target),{once:true});
  else bindControls(target);
}
