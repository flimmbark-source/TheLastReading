// Direct discard runtime.
// Discarding is what triggers card abilities. After the shell cutover, relying
// on the store DISCARD_SELECTED action can fail if store selection is stale, so
// this owns the selected-card discard and then delegates to the existing ability resolver.
import { installPurgeRuntime } from './purgeRuntime.mjs';

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}
function persistOf(target){return runtime(target).persist || target.persist;}
function storeReady(target){return !!(target.tlrStore&&target.tlrActions&&typeof target.tlrStore.getState==='function');}

function call(target,name,...args){
  const fn=target[name];
  if(typeof fn==='function')return fn(...args);
  return undefined;
}

function notifyTrackGhosts(target, action, beforeRun, afterRun) {
  if (typeof target.tlrMaybeFireTrackGhosts === 'function') target.tlrMaybeFireTrackGhosts(action, beforeRun, afterRun);
}

function syncLegacyFromRun(state,run){
  state.hand=[...(run.hand||[])];
  state.deck=[...(run.deck||[])];
  state.selected=run.selectedCardId??null;
  state.discard=[...(run.discard||[])];
  state.discardedCards=[...(run.discardedCards||[])];
  state.discards=run.discards;
  state.freeDiscardUsed=!!run.freeDiscardUsed;
  state.sightChargesUsed=Number(run.sightChargesUsed||0);
  state.roundDiscardCount=Number(run.roundDiscardCount||0);
  state.lastDiscardedCard=run.lastDiscardedCard??state.lastDiscardedCard??null;
}

function captureAbilityDiscardRollback(state,run,card,handIndex){
  return {
    card,
    handIndex,
    discards:run?.discards??state.discards,
    freeDiscardUsed:!!(run?.freeDiscardUsed??state.freeDiscardUsed),
    sightChargesUsed:Number(run?.sightChargesUsed??state.sightChargesUsed??0),
    discardedCards:[...(run?.discardedCards??state.discardedCards??[])],
    roundDiscardCount:Number(run?.roundDiscardCount??state.roundDiscardCount??0),
    lastDiscardedCard:run?.lastDiscardedCard??state.lastDiscardedCard??null,
  };
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
  const handIndex=handArr.findIndex(c=>c.uid===selectedId);
  const card=handArr[handIndex];
  if(!card)return false;

  // Keep the exact pre-discard state while an ability is pending. The targeting
  // bridge consumes this only when the player completely cancels the ability,
  // restoring the card, its hand position, and the discard resources together.
  target.__tlrPendingAbilityDiscardRollback=captureAbilityDiscardRollback(state,_run,card,handIndex);

  const isStoreReady=storeReady(target);
  const beforeRun=isStoreReady?target.tlrStore.getState().run:null;
  if(isStoreReady){
    call(target,'tlrSyncPersistToStore');
    target.tlrStore.dispatch({type:target.tlrActions.DISCARD_SELECTED});
    const newRun=target.tlrStore.getState().run;
    if(newRun.selectedCardId===selectedId){target.__tlrPendingAbilityDiscardRollback=null;return false;}
    syncLegacyFromRun(state,newRun);
  } else {
    const idx=state.hand.findIndex(c=>c.uid===selectedId);
    if(idx<0){target.__tlrPendingAbilityDiscardRollback=null;return false;}
    state.hand.splice(idx,1);
    state.selected=null;
    state.discard.push(card);
    state.discardedCards=state.discardedCards||[];
    state.discardedCards.push(card);
    if(free)state.freeDiscardUsed=true;
    else state.discards-=1;
    state.roundDiscardCount=(state.roundDiscardCount||0)+1;
    state.lastDiscardedCard=card;
    call(target,'tlrSyncRunToStore');
  }

  call(target,'playSound','discard');
  call(target,'haptic',16);

  const finish=()=>{
    const currentRun=target.tlrStore?.getState?.()?.run;
    const currentHand=currentRun?.hand||state.hand||[];
    const wasReturned=currentHand.some(candidate=>candidate.uid===card.uid);
    target.__tlrPendingAbilityDiscardRollback=null;
    if(!wasReturned&&(persist.up||{}).nimble_fingers)call(target,'drawN',persist.up.nimble_fingers);
    notifyTrackGhosts(target,{type:target.tlrActions?.DISCARD_SELECTED||'DISCARD_SELECTED',cardUid:selectedId},beforeRun,currentRun||state);
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
  const isStoreReady=storeReady(target);
  if(isStoreReady){
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
