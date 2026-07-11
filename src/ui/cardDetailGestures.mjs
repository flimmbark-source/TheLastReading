// Card-detail access: selected hand cards expose a dedicated help trigger;
// placed spread cards retain their double-tap shortcut.
/* global state, expandCard */

const DETAIL_PULL_CANCEL_PX=80;
const TRIGGER_SIZE=24;
const TRIGGER_GAP=7;
const VIEWPORT_MARGIN=8;

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

function now(target=window){
  return target.performance?.now?.()??performance.now();
}

function showCardDetail(card,target=window){
  if(!card)return false;
  const adapter=target.tlrHandGestureAdapter;
  const adapterActive=adapter&&(typeof adapter.isActive!=='function'||adapter.isActive());
  if(adapterActive&&typeof adapter.showDetail==='function'){
    adapter.showDetail(card);
    return true;
  }
  const showDetail=typeof target.expandCard==='function'
    ? target.expandCard
    : (typeof expandCard==='function'?expandCard:null);
  if(!showDetail)return false;
  showDetail(card,target);
  return true;
}

function ensureTriggerStyles(target=window){
  const doc=target.document;
  if(!doc||doc.getElementById('card-detail-trigger-style'))return;
  const style=doc.createElement('style');
  style.id='card-detail-trigger-style';
  style.textContent=`
    .card-detail-trigger{
      position:absolute;
      top:0;
      width:${TRIGGER_SIZE}px;
      height:${TRIGGER_SIZE}px;
      margin:0;
      padding:0;
      display:grid;
      place-items:center;
      border:1px solid rgba(232,195,126,.68);
      border-radius:50%;
      background:
        radial-gradient(circle at 38% 30%,rgba(255,241,201,.18),transparent 36%),
        linear-gradient(160deg,rgba(54,39,27,.98),rgba(20,15,13,.98));
      color:#f0d69c;
      box-shadow:0 7px 18px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,245,213,.12);
      font:800 20px/1 Georgia,serif;
      text-align:center;
      cursor:pointer;
      touch-action:manipulation;
      -webkit-tap-highlight-color:transparent;
      z-index:10010;
      transition:transform 110ms ease,filter 110ms ease,box-shadow 110ms ease;
    }
    .card-detail-trigger:hover{filter:brightness(1.12)}
    .card-detail-trigger:active{transform:scale(.94)}
    .card-detail-trigger:focus-visible{outline:2px solid rgba(247,214,151,.9);outline-offset:3px}
  `;
  doc.head.appendChild(style);
}

function selectedHandCard(target=window){
  return target.document?.querySelector?.('#hand > .card.sel[data-uid]')||null;
}

function viewportWidth(target=window){
  return target.visualViewport?.width||target.innerWidth||target.document?.documentElement?.clientWidth||0;
}

export function syncCardDetailTrigger(target=window){
  return target?.__tlrSyncCardDetailTrigger?.()??false;
}

export function installCardDetailGestures(target=window){
  if(!target||target.__cardDetailGesturesInstalled)return;
  target.__cardDetailGesturesInstalled=true;

  const doc=target.document;
  if(!doc)return;
  ensureTriggerStyles(target);

  const DOUBLE_TAP_MS=380;
  let lastTap=null;
  let trigger=null;
  let settleRaf=0;
  let settleUntil=0;
  let pull=null;

  const removeTrigger=()=>{
    trigger?.remove();
    trigger=null;
  };

  const positionTrigger=()=>{
    const cardEl=selectedHandCard(target);
    if(!cardEl){removeTrigger();return false;}

    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid)){removeTrigger();return false;}

    if(!trigger){
      trigger=doc.createElement('button');
      trigger.type='button';
      trigger.className='card-detail-trigger';
      trigger.textContent='?';
      trigger.setAttribute('aria-label','View selected card details');
      trigger.title='View card details';
    }
    if(trigger.parentElement!==cardEl)cardEl.appendChild(trigger);

    const uidText=String(uid);
    if(trigger.dataset.uid!==uidText)trigger.dataset.uid=uidText;
    const rect=cardEl.getBoundingClientRect();
    const vw=viewportWidth(target);
    const rightLeft=rect.right+TRIGGER_GAP;
    const leftLeft=rect.left-TRIGGER_GAP-TRIGGER_SIZE;
    const rightFits=rightLeft+TRIGGER_SIZE<=vw-VIEWPORT_MARGIN;
    const leftFits=leftLeft>=VIEWPORT_MARGIN;
    const side=rightFits||!leftFits?'right':'left';

    trigger.dataset.side=side;
    trigger.style.top='0px';
    if(side==='right'){
      trigger.style.left=`calc(100% + ${TRIGGER_GAP}px)`;
      trigger.style.right='auto';
    }else{
      trigger.style.left='auto';
      trigger.style.right=`calc(100% + ${TRIGGER_GAP}px)`;
    }
    return true;
  };

  const trackPosition=time=>{
    settleRaf=0;
    const visible=positionTrigger();
    if(visible&&time<settleUntil)settleRaf=target.requestAnimationFrame(trackPosition);
  };

  const scheduleTriggerSync=(duration=360)=>{
    settleUntil=Math.max(settleUntil,now(target)+duration);
    if(settleRaf)return;
    if(typeof target.requestAnimationFrame==='function'){
      settleRaf=target.requestAnimationFrame(trackPosition);
    }else{
      positionTrigger();
    }
  };

  target.__tlrSyncCardDetailTrigger=positionTrigger;

  const hand=doc.getElementById('hand');
  const observer=new target.MutationObserver(()=>scheduleTriggerSync());
  observer.observe(hand||doc.body,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['class','data-uid'],
  });
  target.__tlrCardDetailTriggerObserver=observer;

  target.addEventListener?.('resize',()=>scheduleTriggerSync(120),{passive:true});
  target.visualViewport?.addEventListener?.('resize',()=>scheduleTriggerSync(120),{passive:true});
  target.visualViewport?.addEventListener?.('scroll',()=>scheduleTriggerSync(120),{passive:true});
  doc.addEventListener('transitionrun',ev=>{
    const source=target.Element&&ev.target instanceof target.Element?ev.target:null;
    if(source?.matches?.('#hand > .card.sel[data-uid]'))scheduleTriggerSync(420);
  },true);

  const cancelOldDetailPull=()=>{
    if(!pull||pull.currentY-pull.startY<=DETAIL_PULL_CANCEL_PX)return false;
    const cancelled=typeof target.tlrCancelHandDrag==='function'&&target.tlrCancelHandDrag();
    if(cancelled){pull=null;scheduleTriggerSync();}
    return !!cancelled;
  };

  doc.addEventListener('pointerdown',ev=>{
    const source=target.Element&&ev.target instanceof target.Element?ev.target:null;
    if(source?.closest?.('.card-detail-trigger')){
      // Let the real button receive pointerdown so browsers can synthesize
      // its click. The hand gesture controllers explicitly ignore it.
      pull=null;
      return;
    }
    const cardEl=source?.closest?.('#hand .card[data-uid]');
    pull=cardEl?{
      pointerId:ev.pointerId,
      startY:ev.clientY,
      currentY:ev.clientY,
      cancelScheduled:false,
    }:null;
  },true);

  doc.addEventListener('pointermove',ev=>{
    if(!pull||ev.pointerId!==pull.pointerId)return;
    pull.currentY=ev.clientY;
    if(pull.currentY-pull.startY<=DETAIL_PULL_CANCEL_PX||pull.cancelScheduled)return;
    pull.cancelScheduled=true;
    const run=()=>{
      if(!pull||ev.pointerId!==pull.pointerId)return;
      pull.cancelScheduled=false;
      cancelOldDetailPull();
    };
    if(typeof target.requestAnimationFrame==='function')target.requestAnimationFrame(run);
    else target.setTimeout(run,0);
  },{capture:true,passive:true});

  const finishPull=ev=>{
    if(!pull||ev.pointerId!==pull.pointerId)return;
    pull.currentY=ev.clientY;
    cancelOldDetailPull();
    pull=null;
  };
  doc.addEventListener('pointerup',finishPull,true);
  doc.addEventListener('pointercancel',()=>{pull=null;},true);

  doc.addEventListener('click',ev=>{
    if(target.__handPinchSynthetic||target.__handPinchActive){lastTap=null;return;}

    const time=now(target);
    const source=target.Element&&ev.target instanceof target.Element?ev.target:null;
    const detailTrigger=source?.closest?.('.card-detail-trigger');
    if(detailTrigger){
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      const uid=Number(detailTrigger.dataset.uid);
      const card=Number.isFinite(uid)?cardByUid(uid,target):null;
      if(card){
        target.__handGestureSuppressClickUntil=time+800;
        showCardDetail(card,target);
      }
      lastTap=null;
      return;
    }

    // Drag/reorder gestures already mark their generated click for suppression.
    // Never let that click become one half of a double tap.
    if(time<=(target.__handGestureSuppressClickUntil||0)){lastTap=null;return;}
    if(ev.button!==undefined&&ev.button!==0){lastTap=null;return;}

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
      lastTap={uid,time};
      return;
    }

    lastTap=null;
    const card=cardByUid(uid,target);
    if(!card)return;

    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    target.__handGestureSuppressClickUntil=time+800;
    showCardDetail(card,target);
  },true);

  // Prevent native desktop double-click behavior after the second click has
  // opened a spread card's detail view. Touch devices normally do not emit it.
  doc.addEventListener('dblclick',ev=>{
    const source=target.Element&&ev.target instanceof target.Element?ev.target:null;
    if(!source?.closest?.('#spread .card[data-uid]'))return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
  },true);

  scheduleTriggerSync(0);
}

if(typeof window!=='undefined')installCardDetailGestures(window);
