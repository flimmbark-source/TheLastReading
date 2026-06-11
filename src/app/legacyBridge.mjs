// Store/live-state bridge extracted as module utilities.
// This module is intentionally conservative: while index.html still defines the
// live bridge functions, we expose module-owned copies under target.tlrLegacyBridge
// and only install global fallbacks when no legacy function exists.
import { constellationThreshold } from '../systems/constellations.mjs';

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
  return{
    phase,
    reading:state.reading,
    threshold:baseThreshold==null?null:constellationThreshold(baseThreshold,state),
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

export function bindSelectionToStore(target = window){
  const state=stateOf(target);
  if(!state||!target.tlrStore||!target.tlrActions)return;
  const desc=Object.getOwnPropertyDescriptor(state,'selected');
  if(desc&&desc.get)return;
  const seed=desc&&('value'in desc)?desc.value:null;
  target.tlrStore.dispatch(seed==null?{type:target.tlrActions.CLEAR_SELECTION}:{type:target.tlrActions.SELECT_CARD,cardId:seed});
  Object.defineProperty(state,'selected',{
    configurable:true,
    enumerable:true,
    get(){return target.tlrStore.getState().run.selectedCardId;},
    set(v){target.tlrStore.dispatch(v==null?{type:target.tlrActions.CLEAR_SELECTION}:{type:target.tlrActions.SELECT_CARD,cardId:v});},
  });
}

export function syncRunToStore(target = window){
  if(!storeReady(target))return;
  const state=stateOf(target);
  const persist=persistOf(target);
  target.tlrStore.dispatch({type:target.tlrActions.SYNC_LEGACY_RUN,run:{
    deck:state.deck,hand:state.hand,discard:state.discard,spread:state.spread,
    selectedCardId:state.selected,
    discards:state.discards,discardedCards:state.discardedCards||[],
    freeDiscardUsed:!!state.freeDiscardUsed,sightChargesUsed:state.sightChargesUsed||0,
    thresholdIndex:state.th,thresholdBonus:state.thBonus||0,thresholdBonusPending:state.thBonusPending||0,reading:state.reading,
    pendingReserve:state.pendingPool||0,worldCarry:state.worldCarry||0,
    abilityTakenCardIds:state.abilityTakenUids?[...state.abilityTakenUids]:[],
    resonationBonus:state.resonationBonus||null,
    setIndex:state.setIndex||0,setsPerRound:state.setsPerRound||2,roundScore:state.roundScore||0,
    setScores:state.setScores||[],roundDiscardCount:state.roundDiscardCount||0,roundPatternCount:state.roundPatternCount||0,
    constellationId:state.constellationId||null,untargetableCardIds:state.untargetableCardUids||[],
    awaitingNextSet:!!state.awaitingNextSet,lastOutcome:state.lastOutcome||null,
  }});
  target.tlrStore.dispatch({type:target.tlrActions.SYNC_LEGACY_PERSIST,persist:{
    reserve:persist.pool,totalScore:persist.totalScore||0,
    upgrades:persist.up,relics:persist.relics,relicUsed:persist.relicUsed,
  }});
}

export function resolveAbilityThroughStore(result,target = window){
  if(!storeReady(target))return false;
  const state=stateOf(target);
  syncRunToStore(target);
  target.tlrStore.dispatch({type:target.tlrActions.RESOLVE_ABILITY,result});
  const run=target.tlrStore.getState().run;
  state.deck=run.deck.slice();
  state.hand=run.hand.slice();
  state.discard=run.discard.slice();
  state.abilityTakenUids=new Set(run.abilityTakenCardIds||[]);
  if(run.resonationBonus)state.resonationBonus=Object.assign({},run.resonationBonus);
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
  }});
  target.tlrStore.dispatch({type:target.tlrActions.BUY_MARKET_ITEM,purchase});
  const st=target.tlrStore.getState();
  if(!st.run.lastPurchase||!st.run.lastPurchase.purchased)return 'rejected';
  persist.pool=st.persist.reserve;
  persist.up=Object.assign({},st.persist.upgrades);
  persist.relics=st.persist.relics.slice();
  return true;
}

export function shopPacks(target = window){
  return target.tlrShop.buildPackOffer(Object.keys(target.PACKS||{}));
}

export function installLegacyBridge(target = window){
  if(!target || target.__tlrLegacyBridgeInstalled)return;
  target.__tlrLegacyBridgeInstalled=true;
  const api={readLiveSnapshot,architectureSync,storeReady,bindSelectionToStore,syncRunToStore,resolveAbilityThroughStore,abilityDraw,marketPurchase,shopPacks};
  target.tlrLegacyBridge=api;

  if(typeof target.tlrReadLiveSnapshot!=='function')target.tlrReadLiveSnapshot=()=>readLiveSnapshot(target);
  if(typeof target.tlrArchitectureSync!=='function')target.tlrArchitectureSync=()=>architectureSync(target);
  if(typeof target.tlrStoreReady!=='function')target.tlrStoreReady=()=>storeReady(target);
  if(typeof target.tlrBindSelectionToStore!=='function')target.tlrBindSelectionToStore=()=>bindSelectionToStore(target);
  if(typeof target.tlrSyncRunToStore!=='function')target.tlrSyncRunToStore=()=>syncRunToStore(target);
  if(typeof target.tlrResolveAbilityThroughStore!=='function')target.tlrResolveAbilityThroughStore=result=>resolveAbilityThroughStore(result,target);
  if(typeof target.tlrAbilityDraw!=='function')target.tlrAbilityDraw=count=>abilityDraw(count,target);
  if(typeof target.tlrMarketPurchase!=='function')target.tlrMarketPurchase=purchase=>marketPurchase(purchase,target);
  if(typeof target.tlrShopPacks!=='function')target.tlrShopPacks=()=>shopPacks(target);
}
