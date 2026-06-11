// Press-and-hold card detail support outside the hand drag controller.
// Hand cards are handled by gestureCard.mjs; this covers placed spread cards.
/* global state, expandCard */

function cardByUid(uid){
  return [...((state&&state.hand)||[]),...(((state&&state.spread)||[]).filter(Boolean))]
    .find(card=>card.uid===uid)||null;
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
    const source=ev.target instanceof Element?ev.target:null;
    const cardEl=source?.closest?.('#spread .card[data-uid]');
    if(!cardEl)return;
    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid))return;
    clear();
    hold={pointerId:ev.pointerId,startX:ev.clientX,startY:ev.clientY,timer:null};
    hold.timer=target.setTimeout(()=>{
      const card=cardByUid(uid);
      clear();
      if(!card||typeof expandCard!=='function')return;
      target.__handGestureSuppressClickUntil=performance.now()+800;
      expandCard(card);
    },HOLD_MS);
  },true);

  target.document.addEventListener('pointermove',ev=>{
    if(!hold||ev.pointerId!==hold.pointerId)return;
    if(Math.hypot(ev.clientX-hold.startX,ev.clientY-hold.startY)>MOVE_CANCEL)clear();
  },true);

  const end=ev=>{if(hold&&ev.pointerId===hold.pointerId)clear();};
  target.document.addEventListener('pointerup',end,true);
  target.document.addEventListener('pointercancel',end,true);

  target.document.addEventListener('click',ev=>{
    const until=target.__handGestureSuppressClickUntil||0;
    if(performance.now()>until)return;
    const source=ev.target instanceof Element?ev.target:null;
    if(source?.closest?.('#spread .card[data-uid]')){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }
  },true);
}
