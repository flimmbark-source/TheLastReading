// Direct discard runtime.
// Discarding is what triggers card abilities. After the shell cutover, relying
// on the store DISCARD_SELECTED action can fail if store selection is stale, so
// this owns the selected-card discard and then delegates to the existing ability resolver.
import { installPurgeRuntime } from './purgeRuntime.mjs';

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}
function persistOf(target){return runtime(target).persist || target.persist;}

function call(target,name,...args){
  const fn=target[name];
  if(typeof fn==='function')return fn(...args);
  return undefined;
}

export function canDiscardCard(cardUid,target = window){
  const state=stateOf(target),persist=persistOf(target);
  const run=target.tlrStore?.getState?.()?.run;
  if(!state||!persist||(run?.busy??state.busy))return false;
  if((run?.ability?.targeting||state.abilitySelect)||(run?.purge??state.purgeSelect)!==null)return false;
  const hand=run?.hand||state.hand||[];
  if(!hand.some(card=>card.uid===cardUid))return false;
  const free=(persist.relics||[]).includes('gilded_discard')&&!(run?.freeDiscardUsed??state.freeDiscardUsed);
  return free||((run?.discards??state.discards)>0);
}

export function discardSelected(target = window){
  const state=stateOf(target),persist=persistOf(target);
  const _run=target.tlrStore?.getState?.()?.run;
  if(!state||!persist||(_run?.busy??state.busy)||state.selected===null)return false;
  const free=(persist.relics||[]).includes('gilded_discard')&&!(_run?.freeDiscardUsed??state.freeDiscardUsed);
  if(!free&&((_run?.discards??state.discards)<=0))return false;
  const selectedId=state.selected;
  const handArr=_run?.hand||state.hand;
  const card=handArr.find(c=>c.uid===selectedId);
  if(!card)return false;

  const storeReady=target.tlrStore&&target.tlrActions&&typeof target.tlrStore.getState==='function';
  if(storeReady){
    call(target,'tlrSyncPersistToStore');
    target.tlrStore.dispatch({type:target.tlrActions.DISCARD_SELECTED});
    const newRun=target.tlrStore.getState().run;
    if(newRun.selectedCardId===selectedId)return false; // guard: dispatch had no effect
    state.hand=newRun.hand.slice();
    state.selected=newRun.selectedCardId;
    state.discard=newRun.discard.slice();
    state.discardedCards=newRun.discardedCards.slice();
    state.discards=newRun.discards;
    state.freeDiscardUsed=newRun.freeDiscardUsed;
  } else {
    const idx=state.hand.findIndex(c=>c.uid===selectedId);
    if(idx<0)return false;
    state.hand.splice(idx,1);
    state.selected=null;
    state.discard.push(card);
    state.discardedCards=state.discardedCards||[];
    state.discardedCards.push(card);
    if(free)state.freeDiscardUsed=true;
    else state.discards-=1;
    call(target,'tlrSyncRunToStore');
  }

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

export function discardCardByUid(cardUid,target = window){
  if(!canDiscardCard(cardUid,target))return false;
  const state=stateOf(target);
  const storeReady=target.tlrStore&&target.tlrActions&&typeof target.tlrStore.getState==='function';
  if(storeReady){
    call(target,'tlrSyncRunToStore');
    target.tlrStore.dispatch({type:target.tlrActions.SELECT_CARD,cardId:cardUid});
    state.selected=target.tlrStore.getState().run.selectedCardId;
  }else{
    state.selected=cardUid;
  }
  return discardSelected(target);
}

export function installDiscardRuntime(target = window){
  if(!target || target.__tlrDiscardRuntimeInstalled)return;
  target.__tlrDiscardRuntimeInstalled=true;
  target.tlrDiscardRuntime={discardSelected,discardCardByUid,canDiscardCard};
  target.discardSelected=()=>discardSelected(target);
  target.discardCardUid=cardUid=>discardCardByUid(cardUid,target);
  target.canDiscardCardUid=cardUid=>canDiscardCard(cardUid,target);
  installPurgeRuntime(target);
}
