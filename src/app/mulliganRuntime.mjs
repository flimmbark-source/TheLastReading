// Mulligan runtime restored after the index-shell cutover.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}

export function mulligan(target = window){
  const state=stateOf(target);
  if(!state || state.busy || state.abilitySelect || state.purgeSelect!==null)return false;
  if(!(state.mullCharges>0))return false;
  if(!state.spread.every(slot=>!slot))return false;
  if(typeof target.maxHand==='function' && state.hand.length!==target.maxHand())return false;

  state.deck=target.shuffle([...state.deck,...state.hand]);
  state.hand=[];
  state.selected=null;
  state.mullCharges-=1;
  if(typeof target.drawTo==='function')target.drawTo(target.maxHand());
  if(typeof target.tlrStoreReady==='function'&&target.tlrStoreReady()){
    target.tlrStore.dispatch({type:target.tlrActions.SYNC_LEGACY_RUN,run:{
      deck:state.deck,hand:state.hand,discard:state.discard,spread:state.spread,
      selectedCardId:state.selected,mulliganCharges:state.mullCharges,
      discards:state.discards,thresholdIndex:state.th,thresholdBonus:state.thBonus||0,
      thresholdBonusPending:state.thBonusPending||0,reading:state.reading,
    }});
  }
  if(typeof target.playSound==='function')target.playSound('shuffle');
  if(typeof target.haptic==='function')target.haptic(12);
  if(typeof target.render==='function')target.render();
  return true;
}

export function installMulliganRuntime(target = window){
  if(!target || target.__tlrMulliganRuntimeInstalled)return;
  target.__tlrMulliganRuntimeInstalled=true;
  target.tlrMulliganRuntime={mulligan};
  target.mulligan=()=>mulligan(target);
}
