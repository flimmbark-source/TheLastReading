// Hand selected-card visual lock extracted from the legacy inline tail.

import { installPresentationDirector } from '../app/presentationDirector.mjs';
import { installAdventurePresentationA11y } from './adventurePresentationA11y.mjs';

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
    if(!state || state.selected===null || (target.tlrStore?.getState?.()?.run?.busy??state.busy) || (target.tlrStore?.getState?.()?.run?.ability?.targeting||state.abilitySelect) || (target.tlrStore?.getState?.()?.run?.purge??state.purgeSelect)!==null)return;
    const eventTarget=ev.target instanceof Element?ev.target:null;
    if(isInteractiveOrCardSpace(eventTarget))return;
    // Deferred a frame: unlike tapping the card itself (whose own onclick
    // runs the same clear synchronously, directly off that element's own
    // input event), this listener changes the card's class as a bubble-phase
    // side effect of a click that landed on a completely different element.
    // Some mobile engines don't reliably prime a CSS transition for a style
    // change made that way -- it needs to land at the start of a fresh
    // animation frame (a clean "before" state to diff against) rather than
    // synchronously mid-bubble, or it snaps instead of animating.
    const selectedAtClick=target.tlrStore?.getState?.()?.run?.selectedCardId ?? state.selected;
    target.requestAnimationFrame(()=>{
      const stillSelected=target.tlrStore?.getState?.()?.run?.selectedCardId ?? state.selected;
      if(stillSelected!==selectedAtClick)return;
      if(target.tlrStore&&target.tlrActions){
        target.tlrStore.dispatch({type:target.tlrActions.CLEAR_SELECTION});
        state.selected=target.tlrStore.getState?.()?.run?.selectedCardId ?? null;
      }else{
        state.selected=null;
      }
      if(typeof target.refreshHandState==='function')target.refreshHandState();
    });
  });
}

export function installHandSelectionVisuals(target = window){
  if(!target || target.__handHoverSelectedLockInstalled)return;
  target.__handHoverSelectedLockInstalled=true;
  const presentation=installPresentationDirector(target);
  installAdventurePresentationA11y(target);
  let rafPending=false;
  const flush=()=>{
    rafPending=false;
    const hasSelection=!!document.querySelector('.card.sel,.card.ability-picked');
    document.querySelectorAll('.hand').forEach(hand=>hand.classList.toggle('has-selected-card',hasSelection));
    presentation?.setFlag('card-selected',hasSelection);
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
