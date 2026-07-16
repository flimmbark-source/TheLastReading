// Card-detail access: selected hand cards expose a dedicated help trigger;
// placed spread cards retain their double-tap shortcut.
/* global state, expandCard */

const TRIGGER_HIT_SIZE=44;
const TRIGGER_VISUAL_SIZE=24;
const TRIGGER_GAP=7;
const VIEWPORT_MARGIN=8;
const MOTION_TRACK_MS=420;
const MOTION_TRACK_MAX_FRAMES=40;
// Hard ceiling so a stuck transition can never pin the tracker on forever. The
// whole-hand idle reposition (ambientEffects handAnim) runs up to ~1.4s, so the
// base window is extended to cover any running transition up to this cap.
const MOTION_TRACK_MAX_MS=2600;

// Drag-to-place: the player can drag the medallion off the card and drop it
// anywhere; that viewport spot is remembered for every selected card. Dropping
// it back near the card's natural spot re-attaches it.
const DETAIL_POS_KEY='tlr_card_detail_pos';
const DRAG_THRESHOLD=6;   // px of movement before a press becomes a drag
const REATTACH_DIST=48;   // drop within this of the natural spot to re-attach

function clampVal(v,min,max){return Math.max(min,Math.min(v,max));}

function loadCustomPos(target){
  try{
    const raw=target.localStorage?.getItem(DETAIL_POS_KEY);
    if(!raw)return null;
    const p=JSON.parse(raw);
    if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top))return {left:p.left,top:p.top};
  }catch{}
  return null;
}
function saveCustomPos(target,pos){
  try{target.localStorage?.setItem(DETAIL_POS_KEY,JSON.stringify(pos));}catch{}
}
function clearCustomPos(target){
  try{target.localStorage?.removeItem(DETAIL_POS_KEY);}catch{}
}

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
  let motionHardStop=0;
  let observer=null;
  let customPos=loadCustomPos(target);
  let dragged=false;

  const cancelScheduledPosition=()=>{
    if(positionRaf&&typeof target.cancelAnimationFrame==='function')target.cancelAnimationFrame(positionRaf);
    positionRaf=0;
  };

  const cancelMotionTracking=()=>{
    if(motionRaf&&typeof target.cancelAnimationFrame==='function')target.cancelAnimationFrame(motionRaf);
    motionRaf=0;
    motionDeadline=0;
    motionFramesRemaining=0;
    motionHardStop=0;
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
    trigger.removeEventListener('pointermove',onTriggerPointerMove);
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
    dragged=false;
    const rect=trigger.getBoundingClientRect();
    triggerPress={
      pointerId:event.pointerId,
      startX:event.clientX,startY:event.clientY,
      grabX:event.clientX-rect.left,grabY:event.clientY-rect.top,
      lastLeft:rect.left,lastTop:rect.top,
      dragging:false,
    };
    cancelScheduledPosition();
    cancelMotionTracking();
    setIdleMirrorPaused(trigger,true);
    try{trigger?.setPointerCapture?.(event.pointerId);}catch{}
  }

  function onTriggerPointerMove(event){
    if(!triggerPress||event.pointerId!==triggerPress.pointerId||!trigger)return;
    const dx=event.clientX-triggerPress.startX;
    const dy=event.clientY-triggerPress.startY;
    if(!triggerPress.dragging){
      if(Math.hypot(dx,dy)<DRAG_THRESHOLD)return;
      triggerPress.dragging=true;
      trigger.classList.add('is-dragging');
      clearTriggerMirror(trigger); // stop riding the card's animation mid-drag
    }
    const vw=viewportWidth(target);
    const vh=viewportHeight(target);
    const left=clampVal(event.clientX-triggerPress.grabX,VIEWPORT_MARGIN,Math.max(VIEWPORT_MARGIN,vw-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN));
    const top=clampVal(event.clientY-triggerPress.grabY,VIEWPORT_MARGIN,Math.max(VIEWPORT_MARGIN,vh-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN));
    triggerPress.lastLeft=left;
    triggerPress.lastTop=top;
    trigger.style.right='auto';
    trigger.style.left=`${left}px`;
    trigger.style.top=`${top}px`;
    if(event.cancelable)event.preventDefault();
  }

  function onTriggerPointerEnd(event){
    if(!triggerPress||event.pointerId!==triggerPress.pointerId)return;
    const {dragging,lastLeft,lastTop}=triggerPress;
    try{trigger?.releasePointerCapture?.(event.pointerId);}catch{}
    triggerPress=null;
    setIdleMirrorPaused(trigger,false);
    if(dragging){
      trigger?.classList.remove('is-dragging');
      dragged=true; // the click synthesised after a drag must not open the detail
      // Suppress the trailing click so it can't deselect the card or open detail.
      target.__handGestureSuppressClickUntil=now(target)+800;
      const cardEl=selectedHandCard(target);
      const nat=cardEl&&cardEl.isConnected?naturalPosition(cardEl):null;
      if(nat&&Math.hypot(lastLeft-nat.left,lastTop-nat.top)<=REATTACH_DIST){
        // Dropped back on the card -- re-attach so it follows the card again.
        customPos=null;
        clearCustomPos(target);
      }else{
        customPos={left:lastLeft,top:lastTop};
        saveCustomPos(target,customPos);
      }
      schedulePosition();
      return;
    }
    // Native click is dispatched after pointerup. Queue alignment for the next
    // frame so the hit target stays fixed through the complete click sequence.
    if(typeof target.requestAnimationFrame==='function')target.requestAnimationFrame(()=>schedulePosition());
    else schedulePosition();
  }

  function onTriggerClick(event){
    event.preventDefault();
    event.stopPropagation();
    if(dragged){dragged=false;return;} // a drag just ended -- don't open the detail
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
    trigger.innerHTML='<span class="card-detail-trigger-glyph" aria-hidden="true"></span>';
    trigger.setAttribute('aria-label','View selected card details');
    trigger.setAttribute('aria-haspopup','dialog');
    trigger.title='View card details';
    trigger.addEventListener('pointerdown',onTriggerPointerDown);
    trigger.addEventListener('pointermove',onTriggerPointerMove);
    trigger.addEventListener('pointerup',onTriggerPointerEnd);
    trigger.addEventListener('pointercancel',onTriggerPointerEnd);
    trigger.addEventListener('click',onTriggerClick);
    doc.body.appendChild(trigger);
    return trigger;
  };

  // Write-avoidance: the tracking loop repositions per frame, but most tracked
  // frames follow a card that isn't actually moving (class toggles start the
  // loop too). Skipping identical writes keeps layout clean, so the next
  // frame's getBoundingClientRect doesn't force a re-layout.
  const setTriggerPos=(el,left,top)=>{
    const l=`${left}px`;
    const t=`${top}px`;
    if(el.style.right!=='auto')el.style.right='auto';
    if(el.style.left!==l)el.style.left=l;
    if(el.style.top!==t)el.style.top=t;
  };

  const clearTriggerMirror=el=>{
    if(Array.isArray(el.__idleMirrors))for(const anim of el.__idleMirrors){try{anim.cancel();}catch{}}
    el.__idleMirrors=[];
    el.__idleMirrorUid=undefined;
    el.__idleMirrorSig=undefined;
  };

  // The card-following spot: the medallion tucks under the card at its outer
  // corner -- flush inside the card's outer side edge, hanging just below the
  // bottom edge, at the card's resting position (rect minus the live idle bob).
  const naturalPosition=cardEl=>{
    const rect=cardEl.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return null;
    const vw=viewportWidth(target);
    const vh=viewportHeight(target);
    const visualInset=(TRIGGER_HIT_SIZE-TRIGGER_VISUAL_SIZE)/2;
    const idle=readIdleOffset(cardEl,target);
    const restRight=rect.right-idle.tx;
    const restLeft=rect.left-idle.tx;
    const restBottom=rect.bottom-idle.ty;
    const rightBoxLeft=restRight-TRIGGER_VISUAL_SIZE-visualInset;
    const leftBoxLeft=restLeft-visualInset;
    const rightFits=rightBoxLeft+TRIGGER_HIT_SIZE<=vw-VIEWPORT_MARGIN;
    const leftFits=leftBoxLeft>=VIEWPORT_MARGIN;
    const side=rightFits||!leftFits?'right':'left';
    const maxLeft=Math.max(VIEWPORT_MARGIN,vw-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN);
    const left=clampVal(side==='right'?rightBoxLeft:leftBoxLeft,VIEWPORT_MARGIN,maxLeft);
    const maxTop=Math.max(VIEWPORT_MARGIN,vh-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN);
    const top=clampVal(restBottom+TRIGGER_GAP-visualInset,VIEWPORT_MARGIN,maxTop);
    return {left,top,side};
  };

  const positionTrigger=()=>{
    // A moving target can lose the browser-generated click between pointerdown
    // and pointerup. Hold the viewport portal still for the active press/drag.
    if(triggerPress&&trigger?.isConnected)return true;

    const cardEl=selectedHandCard(target);
    if(!cardEl||!cardEl.isConnected){removeTrigger();return false;}

    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid)){removeTrigger();return false;}

    const detailTrigger=ensureTrigger();
    const uidValue=String(uid);
    if(detailTrigger.dataset.uid!==uidValue)detailTrigger.dataset.uid=uidValue;

    if(customPos){
      // Detached: the medallion sits where the player dropped it -- the same
      // spot for every selected card -- clamped into the current viewport. No
      // card-animation mirror while it is off the card.
      const vw=viewportWidth(target);
      const vh=viewportHeight(target);
      const left=clampVal(customPos.left,VIEWPORT_MARGIN,Math.max(VIEWPORT_MARGIN,vw-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN));
      const top=clampVal(customPos.top,VIEWPORT_MARGIN,Math.max(VIEWPORT_MARGIN,vh-TRIGGER_HIT_SIZE-VIEWPORT_MARGIN));
      detailTrigger.dataset.side='free';
      setTriggerPos(detailTrigger,left,top);
      clearTriggerMirror(detailTrigger);
      return true;
    }

    const nat=naturalPosition(cardEl);
    if(!nat){removeTrigger();return false;}
    if(detailTrigger.dataset.side!==nat.side)detailTrigger.dataset.side=nat.side;
    setTriggerPos(detailTrigger,nat.left,nat.top);

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

  // True while a transition (the lift, or the whole-hand idle reposition) is
  // still running on the followed card or the hand. Those transitions can last
  // ~1.4s -- far past the base window -- so the tracker follows until they end.
  // The infinite card-wave bob is a CSSAnimation ridden by the compositor mirror
  // and is deliberately excluded, or it would pin this loop on forever.
  const transitionRunning=el=>{
    if(!el||typeof el.getAnimations!=='function')return false;
    let anims;
    try{anims=el.getAnimations();}catch{return false;}
    return anims.some(a=>a.playState==='running'&&typeof a.transitionProperty==='string');
  };
  const motionActive=()=>transitionRunning(selectedHandCard(target))||transitionRunning(doc.getElementById('hand'));

  const startMotionTracking=(duration=MOTION_TRACK_MS)=>{
    motionDeadline=Math.max(motionDeadline,now(target)+duration);
    motionFramesRemaining=Math.max(motionFramesRemaining,MOTION_TRACK_MAX_FRAMES);
    motionHardStop=Math.max(motionHardStop,now(target)+MOTION_TRACK_MAX_MS);
    if(motionRaf||typeof target.requestAnimationFrame!=='function'){
      if(!motionRaf)positionTrigger();
      return;
    }
    const step=()=>{
      motionRaf=0;
      cancelScheduledPosition();
      const visible=positionTrigger();
      motionFramesRemaining-=1;
      const t=now(target);
      const withinBaseWindow=t<motionDeadline&&motionFramesRemaining>0;
      // Extend past the base window while a transition is still moving the hand.
      // motionActive() costs getAnimations + querySelector, so only ask once the
      // base window alone no longer keeps the loop alive.
      const stillTransitioning=!withinBaseWindow&&t<motionHardStop&&motionActive();
      if(visible&&(withinBaseWindow||stillTransitioning))motionRaf=target.requestAnimationFrame(step);
      else{motionDeadline=0;motionFramesRemaining=0;motionHardStop=0;}
    };
    motionRaf=target.requestAnimationFrame(step);
  };

  target.__tlrSyncCardDetailTrigger=positionTrigger;
  // Reset the medallion back under the card, discarding any dragged placement.
  target.tlrResetInfoButton=()=>{
    customPos=null;
    clearCustomPos(target);
    schedulePosition();
  };

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
    delete target.tlrResetInfoButton;
    delete target.__tlrCardDetailGesturesCleanup;
    target.__cardDetailGesturesInstalled=false;
  };

  target.__tlrCardDetailGesturesCleanup=cleanup;
  schedulePosition();
  return cleanup;
}

if(typeof window!=='undefined')installCardDetailGestures(window);
