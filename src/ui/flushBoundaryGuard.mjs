// Guard the legacy flush/shuffle gesture with the actual viewport boundary.
// gestureHand.mjs still contains an old drag-distance threshold; while a touch
// drag is active, hide flushHand from that threshold until the rendered hand
// has genuinely moved below the bottom edge of the screen.

(function installFlushBoundaryGuard(target = window){
  if(!target || target.__tlrFlushBoundaryGuardInstalled)return;
  target.__tlrFlushBoundaryGuardInstalled=true;

  let realFlushHand=null;
  let activeDrag=null;
  let boundaryRaf=null;
  let boundaryCheckQueued=false;

  const handEl=()=>document.querySelector('.hand');
  const isBelowViewport=()=>{
    const hand=handEl();
    if(!hand)return false;
    return hand.getBoundingClientRect().top>=target.innerHeight;
  };

  const guardedFlushHand=(...args)=>{
    if(typeof realFlushHand!=='function')return;
    if(activeDrag)activeDrag.triggered=true;
    return realFlushHand.apply(target,args);
  };

  // readingFlow installs flushHand later during application boot. Keep its real
  // implementation, but expose it to gestureHand only when the boundary allows.
  Object.defineProperty(target,'flushHand',{
    configurable:true,
    enumerable:true,
    get(){
      if(typeof realFlushHand!=='function')return realFlushHand;
      if(activeDrag&&!activeDrag.belowViewport)return undefined;
      return guardedFlushHand;
    },
    set(value){realFlushHand=value;},
  });

  const updateBoundary=()=>{
    boundaryRaf=null;
    boundaryCheckQueued=false;
    if(!activeDrag)return;
    activeDrag.belowViewport=isBelowViewport();
  };

  // Registering this module before gestureHand means its pointer listener runs
  // first. Queue the rAF from a microtask so gestureHand's own rAF applies the
  // new hand position first, then measure the rendered result.
  const scheduleBoundaryCheck=()=>{
    if(boundaryCheckQueued)return;
    boundaryCheckQueued=true;
    queueMicrotask(()=>{
      if(!activeDrag){boundaryCheckQueued=false;return;}
      if(boundaryRaf!==null)target.cancelAnimationFrame(boundaryRaf);
      boundaryRaf=target.requestAnimationFrame(updateBoundary);
    });
  };

  document.addEventListener('pointerdown',event=>{
    const el=event.target instanceof Element?event.target:null;
    if(event.pointerType==='mouse'||!el?.closest('#handSwipeZone'))return;
    activeDrag={
      pointerId:event.pointerId,
      belowViewport:isBelowViewport(),
      triggered:false,
    };
  },true);

  document.addEventListener('pointermove',event=>{
    if(!activeDrag||event.pointerId!==activeDrag.pointerId)return;
    scheduleBoundaryCheck();
  },{capture:true,passive:true});

  const finishDrag=(event,cancelled)=>{
    if(!activeDrag||event.pointerId!==activeDrag.pointerId)return;
    const finished=activeDrag;
    finished.belowViewport=isBelowViewport();
    activeDrag=null;

    if(boundaryRaf!==null){
      target.cancelAnimationFrame(boundaryRaf);
      boundaryRaf=null;
    }
    boundaryCheckQueued=false;

    // If the pointer was released after the hand crossed the screen edge but
    // no additional move event gave gestureHand a chance to call flushHand,
    // complete it here after the gesture's own pointerup handler has finished.
    if(!cancelled&&finished.belowViewport&&!finished.triggered&&typeof realFlushHand==='function'){
      queueMicrotask(()=>realFlushHand.apply(target));
    }
  };

  document.addEventListener('pointerup',event=>finishDrag(event,false),true);
  document.addEventListener('pointercancel',event=>finishDrag(event,true),true);
})(window);
