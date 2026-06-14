// Direct discard runtime.
// Discarding is what triggers card abilities. After the shell cutover, relying
// on the store DISCARD_SELECTED action can fail if store selection is stale, so
// this owns the selected-card discard and then delegates to the existing ability resolver.
import { installPurgeRuntime } from './purgeRuntime.mjs';
import { installBetweenAbilityLimitPatch } from './betweenAbilityLimitPatch.mjs';

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}
function persistOf(target){return runtime(target).persist || target.persist;}

function call(target,name,...args){
  const fn=target[name];
  if(typeof fn==='function')return fn(...args);
  return undefined;
}

export function discardSelected(target = window){
  const state=stateOf(target),persist=persistOf(target);
  if(!state||!persist||state.busy||state.selected===null)return false;
  const free=(persist.relics||[]).includes('gilded_discard')&&!state.freeDiscardUsed;
  if(!free&&state.discards<=0)return false;
  const idx=state.hand.findIndex(card=>card.uid===state.selected);
  if(idx<0)return false;

  const card=state.hand.splice(idx,1)[0];
  state.selected=null;
  state.discard.push(card);
  state.discardedCards=state.discardedCards||[];
  state.discardedCards.push(card);
  if(free)state.freeDiscardUsed=true;
  else state.discards-=1;

  call(target,'tlrSyncRunToStore');
  call(target,'playSound','discard');
  call(target,'haptic',16);

  const finish=()=>{
    if((persist.up||{}).nimble_fingers)call(target,'drawN',persist.up.nimble_fingers);
    call(target,'render');
    call(target,'checkEnd');
  };

  if(typeof target.resolveAbility==='function')target.resolveAbility(card.ability,finish,card);
  else finish();
  return true;
}

export function installDiscardRuntime(target = window){
  if(!target || target.__tlrDiscardRuntimeInstalled)return;
  target.__tlrDiscardRuntimeInstalled=true;
  installBetweenAbilityLimitPatch(target);
  target.tlrDiscardRuntime={discardSelected};
  target.discardSelected=()=>discardSelected(target);
  installPurgeRuntime(target);
}
