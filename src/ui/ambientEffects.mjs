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
  let userLift=0;
  const activeHandPointers=new Set();
  const observedHands=new WeakSet();

  const handEl=()=>document.querySelector('.hand');
  const liftCap=()=>target.innerWidth<640?30:38;
  const clampUserLift=value=>Math.max(-liftCap(),Math.min(0,Number.isFinite(value)?value:0));
  const readLift=hand=>{
    if(!hand)return userLift;
    const raw=hand.style.getPropertyValue('--hand-lift-y')||getComputedStyle(hand).getPropertyValue('--hand-lift-y');
    const value=parseFloat(raw);
    return Number.isFinite(value)?value:userLift;
  };
  const motionTransition=(idleDur,dragging=false)=>
    `transform ${dragging?0:220}ms cubic-bezier(.2,.85,.25,1),rotate ${idleDur}ms ease-in-out,translate ${idleDur}ms ease-in-out`;
  const setIdlePose=(hand,{x=0,y=0,rot=0,dur=300,dragging=false}={})=>{
    if(!hand)return;
    hand.style.transition=motionTransition(dur,dragging);
    hand.style.rotate=rot+'deg';
    hand.style.translate=`${x}px ${y}px`;
  };
  const ensureAnchor=hand=>{
    if(!hand||activeHandPointers.size)return;
    const current=readLift(hand);
    if(Math.abs(current-userLift)>.1)hand.style.setProperty('--hand-lift-y',userLift.toFixed(1)+'px');
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
  const clearIdleTimer=()=>{
    if(idleTimer!==null){target.clearTimeout(idleTimer);idleTimer=null;}
  };
  const scheduleIdle=delay=>{
    clearIdleTimer();
    idleTimer=target.setTimeout(handAnim,delay);
  };

  // Keep the legacy hook name, but neutralize only the temporary idle pose.
  // The released --hand-lift-y is the user's persistent anchor.
  const settleIdleToAnchor=(dur=240)=>{
    const hand=currentHand();
    if(!hand)return;
    ensureAnchor(hand);
    setIdlePose(hand,{x:0,y:0,rot:0,dur,dragging:activeHandPointers.size>0});
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
    // Drift equally above and below the user-selected anchor.
    const ty=(Math.random()*5-2.5).toFixed(1);
    const dur=900+Math.random()*500;
    setIdlePose(hand,{x:tx,y:ty,rot,dur});
    const pause=2000+Math.random()*10000;
    scheduleIdle(dur+pause);
  }

  document.addEventListener('pointerdown',event=>{
    const el=event.target instanceof Element?event.target:null;
    if(!el?.closest('#hand,.handDock,#handSwipeZone'))return;
    const hand=currentHand();
    userLift=clampUserLift(readLift(hand));
    activeHandPointers.add(event.pointerId);
    clearIdleTimer();
    settleIdleToAnchor(140);
  },true);

  // gestureHand's pointermove listener was installed first, so this reads the
  // updated lift after each drag frame without competing with the gesture.
  document.addEventListener('pointermove',event=>{
    if(!activeHandPointers.has(event.pointerId))return;
    const hand=currentHand();
    userLift=clampUserLift(readLift(hand));
  },true);

  const endHandGesture=event=>{
    if(!activeHandPointers.delete(event.pointerId))return;
    const hand=currentHand();
    userLift=clampUserLift(readLift(hand));
    if(activeHandPointers.size)return;

    // Reassert after the other release handlers and again on the next frame.
    // This prevents a stale reset animation from replacing the user anchor.
    hand?.style.setProperty('--hand-lift-y',userLift.toFixed(1)+'px');
    target.requestAnimationFrame(()=>{
      const liveHand=currentHand();
      if(liveHand)liveHand.style.setProperty('--hand-lift-y',userLift.toFixed(1)+'px');
    });
    if(hand)hand.style.transition=motionTransition(220,false);

    // Let the released anchor become stable before resuming subtle motion.
    scheduleIdle(420);
  };
  document.addEventListener('pointerup',endHandGesture,true);
  document.addEventListener('pointercancel',endHandGesture,true);

  observeHand(handEl());
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
