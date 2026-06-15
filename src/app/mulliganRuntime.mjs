// Mulligan runtime restored after the index-shell cutover.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}

export function mulligan(target = window){
  const state=stateOf(target);
  const _run=target.tlrStore?.getState?.()?.run;
  if(!state || (_run?.busy??state.busy) || (_run?.ability?.targeting||state.abilitySelect) || (_run?.purge??state.purgeSelect)!==null)return false;
  const mullCharges=_run?.mulliganCharges??state.mullCharges;
  if(!(mullCharges>0))return false;
  const spread=_run?.spread||state.spread;
  if(!spread.every(slot=>!slot))return false;
  const handLen=(_run?.hand||state.hand).length;
  if(typeof target.maxHand==='function' && handLen!==target.maxHand())return false;

  const storeReady=typeof target.tlrStoreReady==='function'&&target.tlrStoreReady();
  if(storeReady){
    if(typeof target.tlrSyncRunToStore==='function')target.tlrSyncRunToStore();
    target.tlrStore.dispatch({type:target.tlrActions.MULLIGAN});
    const newRun=target.tlrStore.getState().run;
    state.deck=newRun.deck.slice();
    state.hand=newRun.hand.slice();
    state.selected=newRun.selectedCardId;
    state.mullCharges=newRun.mulliganCharges;
  } else {
    state.deck=target.shuffle([...state.deck,...state.hand]);
    state.hand=[];
    state.selected=null;
    state.mullCharges-=1;
    if(typeof target.drawTo==='function')target.drawTo(target.maxHand());
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
