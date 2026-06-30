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

function discardSnapshot(run,state){
  const source=run||state||{};
  return {
    hand:[...(source.hand||[])],
    deck:[...(source.deck||[])],
    discard:[...(source.discard||[])],
    discardedCards:[...(source.discardedCards||[])],
    selectedCardId:run?run.selectedCardId:(state?.selected??null),
    discards:Number(source.discards||0),
    freeDiscardUsed:!!source.freeDiscardUsed,
    sightChargesUsed:Number(source.sightChargesUsed||0),
    roundDiscardCount:Number(source.roundDiscardCount||0),
    lastDiscardedCard:source.lastDiscardedCard??null,
  };
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

function clearPendingRefund(target,sourceCardUid=null){
  const pending=target.__tlrPendingDiscardAbilityRefund;
  if(!pending)return;
  if(sourceCardUid!==null&&pending.sourceCardUid!==sourceCardUid)return;
  target.__tlrPendingDiscardAbilityRefund=null;
}

export function claimPendingDiscardAbilityCancel(target = window){
  const pending=target.__tlrPendingDiscardAbilityRefund;
  if(!pending||pending.targetingClaimed)return false;
  const run=target.tlrStore?.getState?.()?.run;
  if(run?.sourceCardId!=null&&run.sourceCardId!==pending.sourceCardUid)return false;
  pending.targetingClaimed=true;
  return true;
}

export function canCancelPendingDiscardAbility(target = window){
  const pending=target.__tlrPendingDiscardAbilityRefund;
  if(!pending||!pending.targetingClaimed)return false;
  const state=stateOf(target);
  const run=target.tlrStore?.getState?.()?.run;
  // run.ability stays populated ({id, sourceCardId}, optionally + targeting)
  // for the whole resolution — targeting, then the reveal/"take" step — and is
  // only cleared by CANCEL_ABILITY/RESOLVE_ABILITY. Checking ability rather
  // than ability.targeting keeps Cancel available through the reveal modal,
  // not just the anchor-pick phase.
  const abilityActive=run?.ability||state?.abilitySelect;
  const sourceCardUid=run?.sourceCardId??pending.sourceCardUid;
  return !!abilityActive&&sourceCardUid===pending.sourceCardUid;
}

export function cancelPendingDiscardAbility(target = window){
  if(!canCancelPendingDiscardAbility(target))return false;
  const pending=target.__tlrPendingDiscardAbilityRefund;
  const snapshot=pending.snapshot;
  const state=stateOf(target);

  if(storeReady(target)){
    target.tlrStore.dispatch({type:target.tlrActions.CANCEL_ABILITY});
    target.tlrStore.dispatch({type:target.tlrActions.SYNC_LEGACY_RUN,run:snapshot});
    syncLegacyFromRun(state,target.tlrStore.getState().run);
    state.lastDiscardedCard=snapshot.lastDiscardedCard;
  }else{
    state.hand=[...snapshot.hand];
    state.deck=[...snapshot.deck];
    state.selected=snapshot.selectedCardId;
    state.discard=[...snapshot.discard];
    state.discardedCards=[...snapshot.discardedCards];
    state.discards=snapshot.discards;
    state.freeDiscardUsed=snapshot.freeDiscardUsed;
    state.sightChargesUsed=snapshot.sightChargesUsed;
    state.roundDiscardCount=snapshot.roundDiscardCount;
    state.lastDiscardedCard=snapshot.lastDiscardedCard;
    state.busy=false;
  }

  state.abilitySelect=null;
  state.busy=false;
  clearPendingRefund(target);
  call(target,'render');
  return true;
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
  const snapshot=discardSnapshot(_run,state);

  const isStoreReady=storeReady(target);
  if(isStoreReady){
    call(target,'tlrSyncPersistToStore');
    target.tlrStore.dispatch({type:target.tlrActions.DISCARD_SELECTED});
    const newRun=target.tlrStore.getState().run;
    if(newRun.selectedCardId===selectedId)return false; // guard: dispatch had no effect
    syncLegacyFromRun(state,newRun);
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
    state.roundDiscardCount=(state.roundDiscardCount||0)+1;
    state.lastDiscardedCard=card;
    call(target,'tlrSyncRunToStore');
  }

  call(target,'playSound','discard');
  call(target,'haptic',16);

  if(card.ability){
    target.__tlrPendingDiscardAbilityRefund={sourceCardUid:card.uid,snapshot,targetingClaimed:false};
  }

  const finish=()=>{
    clearPendingRefund(target,card.uid);
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
  target.tlrDiscardRuntime={discardSelected,discardCardByUid,canDiscardCard,cancelPendingDiscardAbility,canCancelPendingDiscardAbility,claimPendingDiscardAbilityCancel};
  target.discardSelected=()=>discardSelected(target);
  target.discardCardUid=cardUid=>discardCardByUid(cardUid,target);
  target.canDiscardCardUid=cardUid=>canDiscardCard(cardUid,target);
  target.cancelPendingDiscardAbility=()=>cancelPendingDiscardAbility(target);
  target.canCancelPendingDiscardAbility=()=>canCancelPendingDiscardAbility(target);
  target.claimPendingDiscardAbilityCancel=()=>claimPendingDiscardAbilityCancel(target);
  installPurgeRuntime(target);
}
