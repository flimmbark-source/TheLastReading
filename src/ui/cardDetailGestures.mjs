// Double-tap card detail support for both hand and spread cards.
/* global state, expandCard, refreshHandState */

function legacyState(target=window){
  if(target?.tlrRuntime?.state)return target.tlrRuntime.state;
  if(target?.state)return target.state;
  if(typeof state!=='undefined')return state;
  return null;
}

function runState(target=window){
  return target?.tlrStore?.getState?.()?.run||null;
}

function cardByUid(uid,target=window){
  const run=runState(target);
  const legacy=legacyState(target);
  const hand=run?.hand||legacy?.hand||[];
  const spread=run?.spread||legacy?.spread||[];
  return [...hand,...spread.filter(Boolean)].find(card=>card.uid===uid)||null;
}

function inSelectionMode(cardEl,target=window){
  const run=runState(target);
  const legacy=legacyState(target);
  const purgeActive=run
    ? run.purge!==null
    : legacy?.purgeSelect!==null&&legacy?.purgeSelect!==undefined;
  return !!(
    (run?.busy??legacy?.busy)||
    run?.ability||legacy?.abilitySelect||
    purgeActive||
    cardEl?.matches?.('.ability-target,.ability-picked,.ability-disabled,.purge-target,.purge-picked')
  );
}

function selectHandCard(uid,target=window){
  const store=target?.tlrStore;
  const actions=target?.tlrActions;
  const legacy=legacyState(target);
  const run=store?.getState?.()?.run;

  if(store&&actions&&run?.selectedCardId!==uid){
    store.dispatch({type:actions.SELECT_CARD,cardId:uid});
    if(legacy)legacy.selected=store.getState?.()?.run?.selectedCardId??uid;
  }else if(legacy){
    legacy.selected=uid;
  }

  if(typeof target?.refreshHandState==='function')target.refreshHandState();
  else if(typeof refreshHandState==='function')refreshHandState();
}

export function installCardDetailGestures(target=window){
  if(!target||target.__cardDetailGesturesInstalled)return;
  target.__cardDetailGesturesInstalled=true;

  const DOUBLE_TAP_MS=380;
  let lastTap=null;
  const now=()=>target.performance?.now?.()??performance.now();

  target.document.addEventListener('click',ev=>{
    if(target.__handPinchSynthetic||target.__handPinchActive){lastTap=null;return;}

    const time=now();
    // Drag/reorder gestures already mark their generated click for suppression.
    // Never let that click become one half of a double tap.
    if(time<=(target.__handGestureSuppressClickUntil||0)){lastTap=null;return;}
    if(ev.button!==undefined&&ev.button!==0){lastTap=null;return;}

    const source=target.Element&&ev.target instanceof target.Element?ev.target:null;
    const cardEl=source?.closest?.('#spread .card[data-uid]');
    if(!cardEl||inSelectionMode(cardEl,target)){lastTap=null;return;}

    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid)){lastTap=null;return;}

    const isDoubleTap=!!(
      lastTap&&
      lastTap.uid===uid&&
      time-lastTap.time<=DOUBLE_TAP_MS
    );

    if(!isDoubleTap){
      // Let the first tap continue through the normal card click path. It still
      // selects/deselects and does not wait for the double-tap window to expire.
      lastTap={uid,time};
      return;
    }

    lastTap=null;
    const card=cardByUid(uid,target);
    const showDetail=typeof target.expandCard==='function'
      ? target.expandCard
      : (typeof expandCard==='function'?expandCard:null);
    if(!card||!showDetail)return;

    // Consume only the second tap so it cannot also deselect/place/target the
    // card beneath the detail view. The first tap retained normal behavior.
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    target.__handGestureSuppressClickUntil=time+800;
    if(cardEl.closest('#hand'))selectHandCard(uid,target);
    showDetail(card,target);
  },true);

  // Prevent native desktop double-click behavior after the second click has
  // opened the detail view. Touch devices normally do not emit this event.
  target.document.addEventListener('dblclick',ev=>{
    const source=target.Element&&ev.target instanceof target.Element?ev.target:null;
    if(!source?.closest?.('#spread .card[data-uid]'))return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
  },true);
}

if(typeof window!=='undefined')installCardDetailGestures(window);
