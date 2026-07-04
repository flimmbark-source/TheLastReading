// Store/live-state bridge extracted as module utilities.
// This module owns the global bridge functions while the legacy script is still
// present. The globals are intentionally overwritten on install so stale inline
// helpers cannot push old state back into the reducer.
import { constellationThreshold } from '../systems/constellations.mjs';
import { queueDrawAnimation } from '../ui/drawAnimation.mjs';

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state;}
function persistOf(target){return runtime(target).persist;}

export function readLiveSnapshot(target = window){
  const state=stateOf(target);
  const persist=persistOf(target);
  let phase='table';
  const body=document.body;
  if(body.classList.contains('mode-attic')||body.classList.contains('mode-to-attic'))phase='attic';
  else{
    const summary=document.getElementById('summary');
    if(summary&&summary.classList.contains('show')&&summary.querySelector('.tarot-shop'))phase='market';
  }
  const baseThreshold=target.TH&&target.TH[state.th]!==undefined?target.TH[state.th]+(state.thBonus||0):null;
  const thresholdRun={...state,constellationId:liveConstellationId(state)};
  return{
    phase,
    reading:state.reading,
    threshold:baseThreshold==null?null:constellationThreshold(baseThreshold,thresholdRun),
    reserve:persist.pool,
    totalScore:persist.totalScore||0,
    handCount:state.hand.length,
    deckCount:state.deck.length,
    discardCount:state.discard.length,
    spreadCount:state.spread.filter(Boolean).length,
    discards:state.discards,
    selectedCardId:state.selected,
  };
}

export function architectureSync(target = window){
  if(typeof target.tlrSyncArchitectureToLiveSnapshot!=='function')return;
  try{target.tlrSyncArchitectureToLiveSnapshot({quiet:true});}catch(e){}
}

export function storeReady(target = window){return !!(target.tlrStore&&target.tlrActions);}

export function syncPersistToStore(target = window){
  if(!storeReady(target))return;
  const persist=persistOf(target);
  target.tlrStore.dispatch({type:target.tlrActions.SYNC_LEGACY_PERSIST,persist:{
    reserve:persist.pool,totalScore:persist.totalScore||0,
    upgrades:persist.up,relics:persist.relics,relicUsed:persist.relicUsed,
    stampedMajors:persist.stampedMajors||[],
  }});
}

export function resolveAbilityThroughStore(result,target = window){
  if(!storeReady(target))return false;
  const state=stateOf(target);
  const beforeHandIds=new Set((state.hand||[]).map(card=>card.uid));
  syncPersistToStore(target);
  target.tlrStore.dispatch({type:target.tlrActions.RESOLVE_ABILITY,result});
  const run=target.tlrStore.getState().run;
  state.deck=run.deck.slice();
  state.hand=run.hand.slice();
  state.discard=run.discard.slice();
  state.abilityTakenUids=new Set(run.abilityTakenCardIds||[]);
  if(run.resonationBonus)state.resonationBonus=Object.assign({},run.resonationBonus);
  if(result?.kind==='draw'){
    queueDrawAnimation(state.hand.filter(card=>!beforeHandIds.has(card.uid)),target);
  }else if(result?.kind==='world'){
    queueDrawAnimation(state.hand,target);
  }
  return true;
}

export function abilityDraw(count,target = window){
  const state=stateOf(target);
  const before=state.hand.length;
  resolveAbilityThroughStore({kind:'draw',count},target);
  if(state.hand.length>before&&typeof target.playSound==='function')target.playSound('draw');
}

export function marketPurchase(purchase,target = window){
  if(!storeReady(target))return false;
  const persist=persistOf(target);
  target.tlrStore.dispatch({type:target.tlrActions.SYNC_LEGACY_PERSIST,persist:{
    reserve:persist.pool,totalScore:persist.totalScore||0,
    upgrades:persist.up,relics:persist.relics,relicUsed:persist.relicUsed,
    stampedMajors:persist.stampedMajors||[],
  }});
  target.tlrStore.dispatch({type:target.tlrActions.BUY_MARKET_ITEM,purchase});
  const st=target.tlrStore.getState();
  if(!st.run.lastPurchase||!st.run.lastPurchase.purchased)return 'rejected';
  persist.pool=st.persist.reserve;
  persist.up=Object.assign({},st.persist.upgrades);
  persist.relics=st.persist.relics.slice();
  persist.stampedMajors=(st.persist.stampedMajors||[]).slice();
  if((purchase?.cost||0)>0&&typeof target.playSound==='function')target.playSound('purchase');
  if(typeof target.haptic==='function')target.haptic(14);
  return true;
}

export function shopPacks(target = window){
  return target.tlrShop.buildPackOffer(Object.keys(target.PACKS||{}));
}

export function installLegacyBridge(target = window){
  if(!target || target.__tlrLegacyBridgeInstalled)return;
  target.__tlrLegacyBridgeInstalled=true;
  const api={readLiveSnapshot,architectureSync,storeReady,syncPersistToStore,resolveAbilityThroughStore,abilityDraw,marketPurchase,shopPacks};
  target.tlrLegacyBridge=api;

  target.tlrReadLiveSnapshot=()=>readLiveSnapshot(target);
  target.tlrArchitectureSync=()=>architectureSync(target);
  target.tlrStoreReady=()=>storeReady(target);
  target.tlrSyncPersistToStore=()=>syncPersistToStore(target);
  target.tlrResolveAbilityThroughStore=result=>resolveAbilityThroughStore(result,target);
  target.tlrAbilityDraw=count=>abilityDraw(count,target);
  target.tlrMarketPurchase=purchase=>marketPurchase(purchase,target);
  target.tlrShopPacks=()=>shopPacks(target);
}
