// Card zoom interactions extracted from the remaining legacy inline script.

export function installCardZoom(target = window){
  if(!target || target.__tlrCardZoomInstalled)return;

  // While the inline expandCard block remains in index.html, do not bind a
  // second set of wheel/touch/hold listeners. Once the block is deleted, this
  // module owns the behavior.
  if(typeof target.expandCard==='function' && !target.expandCard.__tlrCardZoomOwned){
    target.__tlrLegacyInlineCardZoomDetected=true;
    return;
  }

  target.__tlrCardZoomInstalled=true;

  function expandCard(card){
    document.querySelectorAll('.card-zoom-bg').forEach(e=>e.remove());
    const bg=document.createElement('div');
    bg.className='card-zoom-bg';
    const el=document.createElement('div');
    el.className='card card-zoom-inner'+(card.type==='major'?' major':'');
    el.innerHTML=target.cardHTML(card);
    target.applyCardPhoto(el,card);
    bg.appendChild(el);
    bg.addEventListener('click',()=>bg.remove());
    document.body.appendChild(bg);
  }
  expandCard.__tlrCardZoomOwned=true;

  function cardFromTarget(t){
    if(!(t instanceof Element))return null;
    const el=t.closest('.card[data-uid]');
    if(!el)return null;
    const uid=Number(el.dataset.uid);
    const hand=target.state&&Array.isArray(target.state.hand)?target.state.hand:[];
    const spread=target.state&&Array.isArray(target.state.spread)?target.state.spread.filter(Boolean):[];
    return[...hand,...spread].find(c=>c.uid===uid)||null;
  }

  target.expandCard=expandCard;
  target.tlrCardFromTarget=cardFromTarget;

  document.addEventListener('wheel',e=>{
    if(e.deltaY>=0)return;
    const c=cardFromTarget(e.target);
    if(!c)return;
    e.preventDefault();
    expandCard(c);
  },{passive:false});

  let pinch=null;
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==2)return;
    const t=e.target instanceof Element?e.target:null;
    if(t&&t.closest('#hand,.handDock,#handSwipeZone'))return;
    const c=cardFromTarget(e.target);
    if(!c)return;
    pinch={dist:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),card:c};
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!pinch||e.touches.length!==2)return;
    const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    if(d>pinch.dist+28){expandCard(pinch.card);pinch=null;}
  },{passive:true});
  document.addEventListener('touchend',()=>{pinch=null;});

  let spreadHold=null;
  document.addEventListener('pointerdown',ev=>{
    const t=ev.target instanceof Element?ev.target:null;
    if(!t)return;
    const cardEl=t.closest('#spread .card[data-uid]');
    if(!cardEl)return;
    const uid=Number(cardEl.dataset.uid);
    spreadHold={pointerId:ev.pointerId,uid,startX:ev.clientX,startY:ev.clientY,
      timer:setTimeout(()=>{
        spreadHold=null;
        const card=target.state&&Array.isArray(target.state.spread)?target.state.spread.find(c=>c&&c.uid===uid):null;
        if(card)expandCard(card);
      },400)};
  },true);
  const cancelSpreadHold=ev=>{
    if(!spreadHold||ev.pointerId!==spreadHold.pointerId)return;
    clearTimeout(spreadHold.timer);spreadHold=null;
  };
  document.addEventListener('pointermove',ev=>{
    if(!spreadHold||ev.pointerId!==spreadHold.pointerId)return;
    if(Math.hypot(ev.clientX-spreadHold.startX,ev.clientY-spreadHold.startY)>8){clearTimeout(spreadHold.timer);spreadHold=null;}
  },true);
  document.addEventListener('pointerup',cancelSpreadHold,true);
  document.addEventListener('pointercancel',cancelSpreadHold,true);
}
