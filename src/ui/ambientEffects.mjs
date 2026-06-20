// Small ambient visual effects extracted from the legacy inline tail.

function inlineScriptStillContains(marker){
  return [...document.scripts].some(script=>script.textContent&&script.textContent.includes(marker));
}

export function installAmbientEffects(target = window){
  if(!target || target.__tlrAmbientEffectsInstalled)return;

  // While the legacy inline tail still exists, do not start duplicate timers.
  if(inlineScriptStillContains('function ambientMotes()')||inlineScriptStillContains('function handAnim()')){
    target.__tlrLegacyInlineAmbientEffectsDetected=true;
    return;
  }

  target.__tlrAmbientEffectsInstalled=true;
  installHandIdleAnimation(target);
  installAmbientMotes(target);
}

function installHandIdleAnimation(target){
  if(target.__tlrHandIdleAnimationInstalled)return;
  target.__tlrHandIdleAnimationInstalled=true;

  let idleTimer=null;
  let verticalGesture=null;
  let releaseGuardRaf=null;
  let userLift=0;
  const activeHandPointers=new Set();
  const observedHands=new WeakSet();

  const handEl=()=>document.querySelector('.hand');
  const zoneEl=()=>document.getElementById('handSwipeZone');
  const readLift=hand=>{
    if(!hand)return userLift;
    const raw=hand.style.getPropertyValue('--hand-lift-y')||getComputedStyle(hand).getPropertyValue('--hand-lift-y');
    const value=parseFloat(raw);
    return Number.isFinite(value)?value:userLift;
  };
  const maxUpwardLift=()=>{
    const dock=document.querySelector('.handDock');
    const dockTop=dock?.getBoundingClientRect().top??target.innerHeight;
    const safeTop=target.innerWidth<640?72:96;
    return Math.max(30,dockTop-safeTop);
  };
  const clampUserLift=value=>Math.max(-maxUpwardLift(),Math.min(0,Number.isFinite(value)?value:0));
  const applyLiftToHandAndZone=value=>{
    const px=value.toFixed(1)+'px';
    const hand=handEl();
    const zone=zoneEl();
    if(hand)hand.style.setProperty('--hand-lift-y',px);
    if(zone){
      zone.style.transition='translate .22s cubic-bezier(.2,.85,.25,1)';
      zone.style.translate=`0 ${px}`;
    }
  };
  const writeUserLift=value=>{
    userLift=clampUserLift(value);
    applyLiftToHandAndZone(userLift);
  };
  const setIdlePose=(hand,{x=0,y=0,rot=0,dur=300}={})=>{
    if(!hand)return;
    // Preserve the gesture controller's transform transition while also
    // animating the independent idle translate/rotate properties.
    hand.style.transition=`transform .22s cubic-bezier(.2,.85,.25,1),translate ${dur}ms ease-in-out,rotate ${dur}ms ease-in-out`;
    hand.style.translate=`${x}px ${y}px`;
    hand.style.rotate=rot+'deg';
  };
  const clearIdleTimer=()=>{
    if(idleTimer!==null){target.clearTimeout(idleTimer);idleTimer=null;}
  };
  const cancelReleaseGuard=()=>{
    if(releaseGuardRaf!==null){target.cancelAnimationFrame(releaseGuardRaf);releaseGuardRaf=null;}
  };
  const scheduleIdle=delay=>{
    clearIdleTimer();
    idleTimer=target.setTimeout(handAnim,delay);
  };
  const ensureAnchor=hand=>{
    if(!hand||verticalGesture)return;
    const current=readLift(hand);
    if(Math.abs(current-userLift)>.1)applyLiftToHandAndZone(userLift);
  };
  const observeHand=hand=>{
    if(!hand||observedHands.has(hand))return;
    observedHands.add(hand);
    new MutationObserver(()=>ensureAnchor(hand)).observe(hand,{attributes:true,attributeFilter:['style']});
  };
  const currentHand=()=>{
    const hand=handEl();
    observeHand(hand);
    return hand;
  };

  // Neutralize only the temporary idle pose. The user's lift remains the base.
  const settleIdleToAnchor=(dur=180)=>{
    const hand=currentHand();
    if(!hand)return;
    setIdlePose(hand,{x:0,y:0,rot:0,dur});
  };
  target.__handDriftLiftToZero=settleIdleToAnchor;

  function handAnim(){
    idleTimer=null;
    const hand=currentHand();
    if(!hand)return;
    ensureAnchor(hand);
    if(activeHandPointers.size){scheduleIdle(240);return;}
    const rot=(Math.random()*3.2-1.6).toFixed(2);
    const tx=(Math.random()*6-3).toFixed(1);
    const ty=(Math.random()*5-2.5).toFixed(1);
    const dur=900+Math.random()*500;
    setIdlePose(hand,{x:tx,y:ty,rot,dur});
    scheduleIdle(dur+2000+Math.random()*10000);
  }

  const updateVerticalGesture=clientY=>{
    if(!verticalGesture||!Number.isFinite(clientY))return;
    verticalGesture.lastY=clientY;
    const desired=verticalGesture.startLift+(clientY-verticalGesture.startY);
    // Downward travel is left to gestureHand so its flush gesture still works.
    // Upward travel becomes the persistent user-oriented anchor.
    if(desired<=0)writeUserLift(desired);
    else writeUserLift(0);
  };

  document.addEventListener('pointerdown',event=>{
    const el=event.target instanceof Element?event.target:null;
    if(!el?.closest('#hand,.handDock,#handSwipeZone'))return;

    activeHandPointers.add(event.pointerId);
    clearIdleTimer();
    cancelReleaseGuard();
    settleIdleToAnchor(120);

    const startsInSwipeZone=!!el.closest('#handSwipeZone');
    if(event.pointerType!=='mouse'&&startsInSwipeZone&&activeHandPointers.size===1){
      const hand=currentHand();
      userLift=clampUserLift(readLift(hand));
      verticalGesture={
        pointerId:event.pointerId,
        startY:event.clientY,
        lastY:event.clientY,
        startLift:userLift,
      };
    }else if(activeHandPointers.size>1){
      // A second finger means pinch; do not compete with pinch spacing.
      verticalGesture=null;
    }
  },true);

  document.addEventListener('pointermove',event=>{
    if(!verticalGesture||event.pointerId!==verticalGesture.pointerId)return;
    updateVerticalGesture(event.clientY);
  },{capture:true,passive:true});

  const guardReleasedAnchor=()=>{
    cancelReleaseGuard();
    const started=performance.now();
    const step=now=>{
      applyLiftToHandAndZone(userLift);
      // gestureHand's old 180ms correction can still be running. Outlast it.
      if(now-started<240)releaseGuardRaf=target.requestAnimationFrame(step);
      else releaseGuardRaf=null;
    };
    releaseGuardRaf=target.requestAnimationFrame(step);
  };

  const endHandGesture=event=>{
    const wasVertical=verticalGesture&&event.pointerId===verticalGesture.pointerId;
    if(wasVertical){
      updateVerticalGesture(Number.isFinite(event.clientY)?event.clientY:verticalGesture.lastY);
      verticalGesture=null;
      writeUserLift(userLift);
      guardReleasedAnchor();
    }

    activeHandPointers.delete(event.pointerId);
    if(activeHandPointers.size)return;
    scheduleIdle(420);
  };
  document.addEventListener('pointerup',endHandGesture,true);
  document.addEventListener('pointercancel',endHandGesture,true);

  target.addEventListener('resize',()=>writeUserLift(userLift));
  observeHand(handEl());
  userLift=clampUserLift(readLift(handEl()));
  applyLiftToHandAndZone(userLift);
  handAnim();
}

function installAmbientMotes(target){
  if(target.__tlrAmbientMotesInstalled)return;
  if(target.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;

  const layer=document.getElementById('ambientFX');
  if(!layer){
    target.setTimeout(()=>installAmbientMotes(target),250);
    return;
  }

  target.__tlrAmbientMotesInstalled=true;

  const isMobile=()=>target.innerWidth<=640;
  const maxMotes=()=>isMobile()?8:16;

  function makeMote(seed=false){
    if(layer.childElementCount>=maxMotes())return;
    const m=document.createElement('div');
    m.className='mote';
    m.style.setProperty('--s',(isMobile()?2.2+Math.random()*3.2:2.4+Math.random()*4.4).toFixed(1)+'px');
    m.style.left=(Math.random()*100).toFixed(1)+'vw';
    m.style.setProperty('--x',(Math.random()*72-36).toFixed(0)+'px');
    m.style.setProperty('--o',(isMobile()?0.22+Math.random()*0.26:0.20+Math.random()*0.34).toFixed(2));
    m.style.setProperty('--d',(12+Math.random()*8).toFixed(1)+'s');
    if(seed){
      m.style.animationDelay=(-Math.random()*9).toFixed(2)+'s';
      m.style.bottom=(Math.random()*76-10).toFixed(1)+'vh';
    }
    m.addEventListener('animationend',()=>m.remove());
    layer.appendChild(m);
  }

  function loop(){
    if(!document.hidden)makeMote(false);
    target.setTimeout(loop,(isMobile()?1300:850)+Math.random()*(isMobile()?1800:1500));
  }

  for(let i=0;i<(isMobile()?5:7);i++)target.setTimeout(()=>makeMote(true),i*160);
  loop();
}
