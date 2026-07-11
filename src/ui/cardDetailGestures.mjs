// Card-detail access: selected hand cards expose a dedicated help trigger;
// placed spread cards retain their double-tap shortcut.
/* global state, expandCard */

const TRIGGER_HIT_SIZE=44;
const TRIGGER_VISUAL_SIZE=24;
const TRIGGER_GAP=7;
const VIEWPORT_MARGIN=8;
const MOTION_TRACK_MS=420;
const MOTION_TRACK_MAX_FRAMES=40;

function legacyState(target=window){
  if(target?.tlrRuntime?.state)return target.tlrRuntime.state;
  if(target?.state)return target.state;
  if(typeof state!=='undefined')return state;
  return null;
}

function runState(target=window){
  return target?.tlrStore?.getState?.()?.run||null;
}

function handAdapter(target=window){
  const adapter=target?.tlrHandGestureAdapter;
  if(!adapter)return null;
  return typeof adapter.isActive!=='function'||adapter.isActive()?adapter:null;
}

function selectedUid(target=window){
  const adapter=handAdapter(target);
  if(adapter?.getSelected)return adapter.getSelected();
  const run=runState(target);
  const legacy=legacyState(target);
  return run?.selectedCardId??legacy?.selected??null;
}

function cardByUid(uid,target=window){
  const adapter=handAdapter(target);
  const adapted=adapter?.getCard?.(uid);
  if(adapted)return adapted;
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

// The hand fan bobs each card with a looping CSS keyframe animation (card-wave /
// handCardIdleCycle) driven off the `translate`/`rotate` properties. Read the
// card's current animated offset so the body-level trigger can be parked at the
// card's resting position -- the mirrored animation below re-adds the bob.
function readIdleOffset(cardEl,target){
  const compute=target?.getComputedStyle;
  if(typeof compute!=='function')return {tx:0,ty:0};
  let cs;
  try{cs=compute.call(target,cardEl);}catch{return {tx:0,ty:0};}
  const raw=cs?.translate;
  if(!raw||raw==='none')return {tx:0,ty:0};
  const parts=String(raw).trim().split(/\s+/);
  const tx=parseFloat(parts[0]);
  const ty=parseFloat(parts[1]??'0');
  return {tx:Number.isFinite(tx)?tx:0,ty:Number.isFinite(ty)?ty:0};
}

// Signature of the card's looping animations (names), so the trigger can detect
// when they appear/change -- a freshly selected card registers its CSS animation
// a frame or two after the .sel class lands, so the first mirror attempt is empty.
function idleAnimSignature(cardEl){
  if(typeof cardEl.getAnimations!=='function')return '';
  let names;
  try{names=cardEl.getAnimations().filter(a=>typeof a.animationName==='string').map(a=>a.animationName);}
  catch{return '';}
  return names.sort().join(',');
}

// Replay the card's looping idle animation on the trigger via the Web Animations
// API, sharing the card's phase so the medallion bobs in lockstep. The compositor
// runs this with no per-frame JS, so following the fan costs nothing on the main
// thread. Transitions (lift/reorder) are skipped -- those are tracked in JS.
function mirrorIdleMotion(cardEl,trigger,target){
  if(!trigger)return;
  if(Array.isArray(trigger.__idleMirrors)){
    for(const anim of trigger.__idleMirrors){try{anim.cancel();}catch{}}
  }
  trigger.__idleMirrors=[];
  if(typeof cardEl.getAnimations!=='function'||typeof trigger.animate!=='function')return;
  let sourceAnims;
  try{sourceAnims=cardEl.getAnimations();}catch{return;}
  for(const source of sourceAnims){
    if(!source||typeof source.animationName!=='string')continue;
    const effect=source.effect;
    if(!effect||typeof effect.getKeyframes!=='function')continue;
    let keyframes,timing,mirror;
    try{keyframes=effect.getKeyframes();timing=effect.getTiming();}catch{continue;}
    try{mirror=trigger.animate(keyframes,timing);}catch{continue;}
    try{
      if(source.startTime!=null)mirror.startTime=source.startTime;
      else if(source.currentTime!=null)mirror.currentTime=source.currentTime;
    }catch{}
    trigger.__idleMirrors.push(mirror);
  }
}

// Freeze the bob while the trigger is pressed so the click target stays put
// through the whole pointer sequence (native click can be lost if it moves).
function setIdleMirrorPaused(trigger,paused){
  if(!trigger||!Array.isArray(trigger.__idleMirrors))return;
  for(const anim of trigger.__idleMirrors){
    try{paused?anim.pause():anim.play();}catch{}
  }
}

function showCardDetail(card,target=window){
  if(!card)return false;
  const adapter=handAdapter(target);
  if(adapter&&typeof adapter.showDetail==='function'){
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

function selectedHandCard(target=window){
  const uid=Number(selectedUid(target));
  if(Number.isFinite(uid)){
    const selected=target.document?.querySelector?.(`#hand > .card.sel[data-uid="${uid}"]`);
    if(selected)return selected;
  }
  return target.document?.querySelector?.('#hand > .card.sel[data-uid]')||null;
}

function viewportWidth(target=window){
  return target.visualViewport?.width||target.innerWidth||target.document?.documentElement?.clientWidth||0;
}

function viewportHeight(target=window){
  return target.visualViewport?.height||target.innerHeight||target.document?.documentElement?.clientHeight||0;
}

export function syncCardDetailTrigger(target=window){
  return target?.__tlrSyncCardDetailTrigger?.()??false;
}

export function installCardDetailGestures(target=window){
  if(!target||target.__cardDetailGesturesInstalled)return target?.__tlrCardDetailGesturesCleanup||null;
  target.__cardDetailGesturesInstalled=true;

  const doc=target.document;
  if(!doc)return null;

  const DOUBLE_TAP_MS=380;
  let lastTap=null;
  let trigger=null;
  let triggerPress=null;
  let positionRaf=0;
  let motionRaf=0;
  let motionDeadline=0;
  let motionFramesRemaining=0;
  let observer=null;

  const cancelScheduledPosition=()=>{
    if(positionRaf&&typeof target.cancelAnimationFrame==='function')target.cancelAnimationFrame(positionRaf);
    positionRaf=0;
  };

  const cancelMotionTracking=()=>{
    if(motionRaf&&typeof target.cancelAnimationFrame==='function')target.cancelAnimationFrame(motionRaf);
    motionRaf=0;
    motionDeadline=0;
    motionFramesRemaining=0;
  };

  const restoreHandFocus=()=>{
    const hand=doc.getElementById('hand');
    if(!hand)return;
    const hadTabIndex=hand.hasAttribute('tabindex');
    if(!hadTabIndex)hand.tabIndex=-1;
    try{hand.focus({preventScroll:true});}catch{hand.focus();}
    if(!hadTabIndex){
      const clearTemporaryTabIndex=()=>{
        if(hand.getAttribute('tabindex')==='-1')hand.removeAttribute('tabindex');
      };
      hand.addEventListener('blur',clearTemporaryTabIndex,{once:true});
      target.setTimeout?.(()=>{
        if(doc.activeElement!==hand)clearTemporaryTabIndex();
      },0);
    }
  };

  const removeTrigger=(restoreFocus=true)=>{
    if(!trigger)return;
    if(restoreFocus&&doc.activeElement===trigger)restoreHandFocus();
    trigger.removeEventListener('pointerdown',onTriggerPointerDown);
    trigger.removeEventListener('pointerup',onTriggerPointerEnd);
    trigger.removeEventListener('pointercancel',onTriggerPointerEnd);
    trigger.removeEventListener('click',onTriggerClick);
    trigger.remove();
    trigger=null;
    triggerPress=null;
    cancelScheduledPosition();
    cancelMotionTracking();
  };

  function onTriggerPointerDown(event){
    if(event.pointerType==='mouse'&&event.button!==0)return;
    triggerPress={pointerId:event.pointerId};
    cancelScheduledPosition();
    cancelMotionTracking();
    setIdleMirrorPaused(trigger,true);
    try{trigger?.setPointerCapture?.(event.pointerId);}catch{}
  }

  function onTriggerPointerEnd(event){
    if(!triggerPress||event.pointerId!==triggerPress.pointerId)return;
    try{trigger?.releasePointerCapture?.(event.pointerId);}catch{}
    triggerPress=null;
    setIdleMirrorPaused(trigger,false);
    // Native click is dispatched after pointerup. Queue alignment for the next
    // frame so the hit target stays fixed through the complete click sequence.
    if(typeof target.requestAnimationFrame==='function')target.requestAnimationFrame(()=>schedulePosition());
    else schedulePosition();
  }

  function onTriggerClick(event){
    event.preventDefault();
    event.stopPropagation();
    const uid=Number(trigger?.dataset?.uid);
    const card=Number.isFinite(uid)?cardByUid(uid,target):null;
    if(!card)return;
    lastTap=null;
    showCardDetail(card,target);
  }

  const ensureTrigger=()=>{
    if(trigger)return trigger;
    trigger=doc.createElement('button');
    trigger.type='button';
    trigger.className='card-detail-trigger';
    trigger.innerHTML='<span class="card-detail-trigger-glyph" aria-hidden="true">?</span>';
    trigger.setAttribute('aria-label','View selected card details');
    trigger.setAttribute('aria-haspopup','dialog');
    trigger.title='View card details';
    trigger.addEventListener('pointerdown',onTriggerPointerDown);
    trigger.addEventListener('pointerup',onTriggerPointerEnd);
    trigger.addEventListener('pointercancel',onTriggerPointerEnd);
    trigger.addEventListener('click',onTriggerClick);
    doc.body.appendChild(trigger);
    return trigger;
  };

  const positionTrigger=()=>{
    // A moving target can lose the browser-generated click between pointerdown
    // and pointerup. Hold the viewport portal still for the active press.
    if(triggerPress&&trigger?.isConnected)return true;

    const cardEl=selectedHandCard(target);
    if(!cardEl||!cardEl.isConnected){removeTrigger();return false;}

    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid)){removeTrigger();return false;}

    const rect=cardEl.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0){removeTrigger();return false;}

    const detailTrigger=ensureTrigger();
    const vw=viewportWidth(target);
    const vh=viewportHeight(target);
    const visualInset=(TRIGGER_HIT_SIZE-TRIGGER_VISUAL_SIZE)/2;
    // Park the trigger at the card's resting spot (rect minus the live idle-bob
    // offset). The mirrored animation re-adds that bob on the compositor, so the
    // medallion rides the fan's wave without the trigger snapping every cycle.
    const idle=readIdleOffset(cardEl,target);
    const restRight=rect.right-idle.tx;
    const restLeft=rect.left-idle.tx;
    const restTop=rect.top-idle.ty;
    // The medallion (visible circle) hugs the card edge with TRIGGER_GAP. The
    // 44px hit box is centred on that medallion, so it extends visualInset past
    // the circle on every side -- pressing anywhere on the circle registers.
    const rightGlyphLeft=restRight+TRIGGER_GAP;
    const leftGlyphLeft=restLeft-TRIGGER_GAP-TRIGGER_VISUAL_SIZE;
    const rightBoxLeft=rightGlyphLeft-visualInset;
    const leftBoxLeft=leftGlyphLeft-visualInset;
    const rightFits=rightBoxLeft+TRIGGER_HIT_SIZE<=vw-VIEWPORT_MARGIN;
    const leftFits=leftBoxLeft>=VIEWPORT_MARGIN;
    const side=rightFits||!leftFits?'right':'left';
    const desiredLeft=side==='right'?rightBoxLeft:leftBoxLeft;
    const maxLeft=Math.max(VIEWPORT_MARGIN,vw-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN);
    const left=Math.max(VIEWPORT_MARGIN,Math.min(desiredLeft,maxLeft));
    const desiredTop=restTop-visualInset;
    const maxTop=Math.max(VIEWPORT_MARGIN,vh-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN);
    const top=Math.max(VIEWPORT_MARGIN,Math.min(desiredTop,maxTop));

    detailTrigger.dataset.uid=String(uid);
    detailTrigger.dataset.side=side;
    detailTrigger.style.top=`${top}px`;
    detailTrigger.style.right='auto';
    detailTrigger.style.left=`${left}px`;

    // Re-mirror when the followed card changes or when its set of looping
    // animations changes (e.g. card-wave registering a frame after selection).
    // Otherwise leave the compositor-driven mirror untouched -- re-creating it
    // every frame would fight the compositor. positionTrigger runs repeatedly
    // during the post-select lift window, so an initially-empty mirror is
    // upgraded once the animation appears, then stays put.
    const sig=idleAnimSignature(cardEl);
    if(detailTrigger.__idleMirrorUid!==uid||detailTrigger.__idleMirrorSig!==sig){
      detailTrigger.__idleMirrorUid=uid;
      detailTrigger.__idleMirrorSig=sig;
      mirrorIdleMotion(cardEl,detailTrigger,target);
    }
    return true;
  };

  const schedulePosition=()=>{
    if(positionRaf)return;
    if(typeof target.requestAnimationFrame==='function'){
      positionRaf=target.requestAnimationFrame(()=>{
        positionRaf=0;
        positionTrigger();
      });
    }else{
      positionTrigger();
    }
  };

  const startMotionTracking=(duration=MOTION_TRACK_MS)=>{
    motionDeadline=Math.max(motionDeadline,now(target)+duration);
    motionFramesRemaining=Math.max(motionFramesRemaining,MOTION_TRACK_MAX_FRAMES);
    if(motionRaf||typeof target.requestAnimationFrame!=='function'){
      if(!motionRaf)positionTrigger();
      return;
    }
    const step=()=>{
      motionRaf=0;
      cancelScheduledPosition();
      const visible=positionTrigger();
      motionFramesRemaining-=1;
      if(visible&&now(target)<motionDeadline&&motionFramesRemaining>0)motionRaf=target.requestAnimationFrame(step);
      else{motionDeadline=0;motionFramesRemaining=0;}
    };
    motionRaf=target.requestAnimationFrame(step);
  };

  target.__tlrSyncCardDetailTrigger=positionTrigger;

  const hand=doc.getElementById('hand');
  if(hand&&typeof target.MutationObserver==='function'){
    observer=new target.MutationObserver(mutations=>{
      const structuralMotion=mutations.some(mutation=>
        mutation.type==='childList'||
        mutation.attributeName==='class'||
        mutation.attributeName==='data-uid'
      );
      if(structuralMotion)startMotionTracking();
      else schedulePosition();
    });
    observer.observe(hand,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','data-uid','style'],
    });
  }

  const onResize=()=>schedulePosition();
  const onViewportChange=()=>schedulePosition();
  const onMotionStart=event=>{
    const source=target.Element&&event.target instanceof target.Element?event.target:null;
    if(source?.matches?.('#hand,#hand > .card.sel[data-uid]'))startMotionTracking();
  };
  const onMotionEnd=event=>{
    const source=target.Element&&event.target instanceof target.Element?event.target:null;
    if(source?.matches?.('#hand,#hand > .card.sel[data-uid]'))schedulePosition();
  };

  target.addEventListener?.('resize',onResize,{passive:true});
  target.addEventListener?.('scroll',onViewportChange,{passive:true,capture:true});
  target.visualViewport?.addEventListener?.('resize',onViewportChange,{passive:true});
  target.visualViewport?.addEventListener?.('scroll',onViewportChange,{passive:true});
  doc.addEventListener('transitionrun',onMotionStart,true);
  doc.addEventListener('transitionend',onMotionEnd,true);
  doc.addEventListener('transitioncancel',onMotionEnd,true);

  const onDocumentClick=event=>{
    if(target.__handPinchSynthetic||target.__handPinchActive){lastTap=null;return;}

    const time=now(target);
    const source=target.Element&&event.target instanceof target.Element?event.target:null;
    if(source?.closest?.('.card-detail-trigger')){lastTap=null;return;}

    // Drag/reorder gestures already mark their generated click for suppression.
    // Never let that click become one half of a double tap.
    if(time<=(target.__handGestureSuppressClickUntil||0)){lastTap=null;return;}
    if(event.button!==undefined&&event.button!==0){lastTap=null;return;}

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

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    target.__handGestureSuppressClickUntil=time+800;
    showCardDetail(card,target);
  };

  const onDocumentDoubleClick=event=>{
    const source=target.Element&&event.target instanceof target.Element?event.target:null;
    if(!source?.closest?.('#spread .card[data-uid]'))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  doc.addEventListener('click',onDocumentClick,true);
  doc.addEventListener('dblclick',onDocumentDoubleClick,true);

  const cleanup=()=>{
    removeTrigger(false);
    observer?.disconnect();
    target.removeEventListener?.('resize',onResize);
    target.removeEventListener?.('scroll',onViewportChange,true);
    target.visualViewport?.removeEventListener?.('resize',onViewportChange);
    target.visualViewport?.removeEventListener?.('scroll',onViewportChange);
    doc.removeEventListener('transitionrun',onMotionStart,true);
    doc.removeEventListener('transitionend',onMotionEnd,true);
    doc.removeEventListener('transitioncancel',onMotionEnd,true);
    doc.removeEventListener('click',onDocumentClick,true);
    doc.removeEventListener('dblclick',onDocumentDoubleClick,true);
    delete target.__tlrSyncCardDetailTrigger;
    delete target.__tlrCardDetailGesturesCleanup;
    target.__cardDetailGesturesInstalled=false;
  };

  target.__tlrCardDetailGesturesCleanup=cleanup;
  schedulePosition();
  return cleanup;
}

if(typeof window!=='undefined')installCardDetailGestures(window);
