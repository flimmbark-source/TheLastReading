// Press-and-hold card detail support for both hand and spread cards.
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

  const HOLD_MS=400;
  const MOVE_CANCEL=10;
  let hold=null;

  const clear=()=>{
    if(hold&&hold.timer)target.clearTimeout(hold.timer);
    hold=null;
  };

  target.document.addEventListener('pointerdown',ev=>{
    if(target.__handPinchSynthetic||target.__handPinchActive)return;
    if(ev.button!==undefined&&ev.button!==0)return;
    const source=ev.target instanceof Element?ev.target:null;
    const cardEl=source?.closest?.('#hand .card[data-uid],#spread .card[data-uid]');
    if(!cardEl||inSelectionMode(cardEl,target))return;
    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid))return;
    clear();
    hold={
      pointerId:ev.pointerId,
      startX:ev.clientX,
      startY:ev.clientY,
      cardEl,
      isHand:!!cardEl.closest('#hand'),
      timer:null,
    };
    hold.timer=target.setTimeout(()=>{
      const current=hold;
      if(!current||current.pointerId!==ev.pointerId||!current.cardEl.isConnected)return;
      const card=cardByUid(uid,target);
      clear();
      const showDetail=typeof target.expandCard==='function'
        ? target.expandCard
        : (typeof expandCard==='function'?expandCard:null);
      if(!card||!showDetail)return;
      target.__handGestureSuppressClickUntil=performance.now()+800;
      if(current.isHand)selectHandCard(uid,target);
      showDetail(card,target);
    },HOLD_MS);
  },true);

  target.document.addEventListener('pointermove',ev=>{
    if(!hold||ev.pointerId!==hold.pointerId)return;
    if(Math.hypot(ev.clientX-hold.startX,ev.clientY-hold.startY)>MOVE_CANCEL)clear();
  },true);

  const end=ev=>{if(hold&&ev.pointerId===hold.pointerId)clear();};
  target.document.addEventListener('pointerup',end,true);
  target.document.addEventListener('pointercancel',end,true);

  // Prevent the click generated after a completed hold from also selecting,
  // placing, or targeting the card underneath the detail overlay.
  target.document.addEventListener('click',ev=>{
    const until=target.__handGestureSuppressClickUntil||0;
    if(performance.now()>until)return;
    const source=ev.target instanceof Element?ev.target:null;
    if(source?.closest?.('#hand .card[data-uid],#spread .card[data-uid]')){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }
  },true);
}
