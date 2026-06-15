// Hand selected-card visual lock extracted from the legacy inline tail.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}

function isInteractiveOrCardSpace(el){
  if(!el)return false;
  return !!el.closest([
    '#hand .card[data-uid]',
    '#spread .slot',
    'button',
    'input',
    'select',
    'textarea',
    'a',
    '#tutTip',
    '#modal',
    '#summary',
    '.ref',
    '.tlr-pull-wrap',
    '#invWrap',
    '#settingsPanel',
    '#abilityPrompt',
    '#purgePrompt',
    '#relicRack',
  ].join(','));
}

function installEmptySpaceDeselect(target = window){
  if(!target || target.__emptySpaceDeselectInstalled)return;
  target.__emptySpaceDeselectInstalled=true;
  document.addEventListener('click',ev=>{
    if((target.performance?.now?.() || 0) < (target.__handGestureSuppressClickUntil || 0))return;
    const state=stateOf(target);
    if(!state || state.selected===null || state.busy || (target.tlrStore?.getState?.()?.run?.ability?.targeting||state.abilitySelect) || state.purgeSelect!==null)return;
    const eventTarget=ev.target instanceof Element?ev.target:null;
    if(isInteractiveOrCardSpace(eventTarget))return;
    state.selected=null;
    if(typeof target.refreshHandState==='function')target.refreshHandState();
  });
}

export function installHandSelectionVisuals(target = window){
  if(!target || target.__handHoverSelectedLockInstalled)return;
  target.__handHoverSelectedLockInstalled=true;
  let rafPending=false;
  const flush=()=>{
    rafPending=false;
    const hasSelection=!!document.querySelector('.card.sel,.card.ability-picked');
    document.querySelectorAll('.hand').forEach(hand=>hand.classList.toggle('has-selected-card',hasSelection));
  };
  // Only schedule work if the class change happened inside #hand — sel and
  // ability-picked are exclusively set on hand cards, so spread/slot class
  // changes (e.g. drop-target) never need to trigger this.
  const update=mutations=>{
    if(rafPending)return;
    if(mutations&&mutations.length&&!mutations.some(m=>m.target instanceof Element&&!!m.target.closest('#hand')))return;
    rafPending=true;requestAnimationFrame(flush);
  };
  flush();
  installEmptySpaceDeselect(target);
  // Observe only #hand — sel/ability-picked are exclusively set on hand cards.
  // Watching document.body would fire the callback for every drop-target and
  // spread slot class change, adding unnecessary overhead during card drag.
  const attachHandObserver=()=>{
    const h=document.getElementById('hand')||document.querySelector('.hand');
    if(!h){requestAnimationFrame(attachHandObserver);return;}
    new MutationObserver(update).observe(h,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  };
  attachHandObserver();
}