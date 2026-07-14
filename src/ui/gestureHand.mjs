// Hand swipe-scroll / arc controller (Step 4). Verbatim port target from the
// legacy inline hand swipe-scroll handler patch.

export function installHandSwipeScroll(target = window){
  if(!target || target.__handSwipeScrollInstalled)return;
  target.__handSwipeScrollInstalled=true;
  let zone=null,hand=null;
  let offset=0,startOffset=0,startX=0,startY=0,startLift=0,lift=0,startDockH=157;
  const samples=[];                                    // {t,deg} ring for horizontal swipe velocity
  const liftSamples=[];                                // {t,y} ring for vertical swipe velocity
  const pointers=new Map();                            // active pointer id -> {x,y}
  let mode=null;                                     // 'slide' | 'pinch' | null
  let pinchStart=null;                               // {dist,spacing,ids}
  let pinchSuppressClickUntil=0;
  let manualSpacing=null;                            // user-set per-card spacing (deg)
  let autoSpacing=null;                              // last computed auto value (deg)
  let lastHandLen=-1;
  const SAMPLE_WINDOW=90;
  const FRICTION=0.0030;
  const MIN_VEL=0.010;                               // deg/ms
  const RUBBER=0.42;
  const SPACING_MIN=1.2;                             // deg / slot (closest together)
  const SPACING_MAX=8;                               // deg / slot (most spread)
  const OFFSET_LIMIT=30;                             // hard cap on slide deg
  const DEG_PER_PX_SWIPE=0.11;                       // swipe pixels -> degrees of slide
  const DEG_PER_PX_PINCH=0.013;                      // pinch pixels -> degrees of spacing
  const HAND_LIFT_PX=38;
  const HAND_LIFT_PX_MOBILE=30;
  const DEG_PER_SIDE_SCROLL=0.08;
  let momentumRaf=null,liftMomentumRaf=null,driftLiftRaf=null;
  // ── Layout caches (busted by refreshLayout / stepPinch / resize) ──
  let cachedCap=null,cachedRadius=null,cachedView=null,cachedCount=-1;
  // Card pixel width: determined purely by CSS so survives render-cycle cache busts;
  // only cleared on resize (when the viewport breakpoint may change the card size).
  let cachedCardW=null;
  // ── rAF coalescing for pointermove + observer recheck ──
  let pendingMoveEv=null,moveRaf=null,recheckRaf=null;
  // cachedView and cachedCardW survive per-render busts — they only change on resize.
  let cachedCards=null;
  const invalidateCache=()=>{cachedCap=null;cachedRadius=null;cachedCount=-1;cachedCards=null;};
  const cardsList=()=>{if(cachedCards)return cachedCards;const h=handEl();cachedCards=h?[...h.querySelectorAll('.card')]:[];return cachedCards;};
  // Per-card underdamped spring engine. Each spring chases the master offset;
  // the deviation is --lag, which feeds arc angle so position AND rotation trail.
  // Center cards are stiff, edge cards soft and underdamped — center-out wave.
  let springRaf=null,springLastT=0;const springState=new WeakMap();
  const OMEGA_CENTER=0.030,OMEGA_EDGE=0.016;
  const ZETA_CENTER=0.88,ZETA_EDGE=0.70;
  const LAG_EPS=0.02,VEL_EPS=0.0005;
  const clearUndulation=()=>{
    if(springRaf){cancelAnimationFrame(springRaf);springRaf=null;}
    const h=handEl();if(!h)return;
    h.classList.remove('hand-undulating');
    cardsList().forEach(el=>{el.style.setProperty('--lag','0deg');el.style.setProperty('--drift-x','0px');el.style.setProperty('--drift-y','0px');});
  };
  const undulationStep=now=>{
    springRaf=null;
    const h=handEl();
    if(!h||target.__handReorderActive){clearUndulation();return;}
    const dt=Math.min(40,Math.max(1,now-springLastT));
    springLastT=now;
    const cards=cardsList();const n=cards.length;if(!n){clearUndulation();return;}
    const maxSlot=Math.max(1,(n-1)/2);
    const steps=Math.ceil(dt/12),sdt=dt/steps;
    let active=false;
    for(let i=0;i<n;i++){
      const el=cards[i];
      let st=springState.get(el);
      if(!st){st={p:offset,v:0};springState.set(el,st);}
      const edge=Math.abs(i-(n-1)/2)/maxSlot;
      const omega=OMEGA_CENTER+(OMEGA_EDGE-OMEGA_CENTER)*edge;
      const zeta=ZETA_CENTER+(ZETA_EDGE-ZETA_CENTER)*edge;
      const k=omega*omega,c=2*zeta*omega;
      for(let s=0;s<steps;s++){st.v+=(k*(offset-st.p)-c*st.v)*sdt;st.p+=st.v*sdt;}
      const lag=st.p-offset;
      const settled=Math.abs(lag)<LAG_EPS&&Math.abs(st.v)<VEL_EPS;
      if(settled){
        el.style.setProperty('--lag','0deg');
        el.style.setProperty('--drift-x','0px');
        el.style.setProperty('--drift-y','0px');
      }else{
        active=true;
        el.style.setProperty('--lag',lag.toFixed(3)+'deg');
        el.style.setProperty('--drift-x',((-st.v)*220*edge).toFixed(1)+'px');
        el.style.setProperty('--drift-y',((-Math.abs(st.v))*130*edge).toFixed(1)+'px');
      }
    }
    if(mode==='slide'||active)springRaf=requestAnimationFrame(undulationStep);
    else h.classList.remove('hand-undulating');
  };
  const kickUndulation=()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const h=handEl();if(!h)return;
    // Re-seed every spring at current offset so stale state cannot cause jumps.
    const cards=cardsList();
    for(let i=0;i<cards.length;i++){
      const st=springState.get(cards[i]);
      if(st){st.p=offset;st.v=0;}else springState.set(cards[i],{p:offset,v:0});
    }
    if(springRaf){cancelAnimationFrame(springRaf);springRaf=null;}
    h.classList.add('hand-undulating');
    springLastT=performance.now();
    springRaf=requestAnimationFrame(undulationStep);
  };
  try{target.__handHintStep=Number(localStorage.getItem('tlr_hand_hint_step')||'1');if(target.__handHintStep>=4)target.__handHasBeenSwiped=true;}catch(e){target.__handHintStep=1;}
  const handEl=()=>{if(hand&&hand.isConnected)return hand;hand=document.querySelector('.hand');return hand;};
  const zoneEl=()=>{if(zone&&zone.isConnected)return zone;zone=document.getElementById('handSwipeZone');return zone;};
  const trackRadius=()=>{
    if(cachedRadius!=null)return cachedRadius;
    const h=handEl();
    cachedRadius=h?parseFloat(getComputedStyle(h).getPropertyValue('--track-radius'))||720:720;
    return cachedRadius;
  };
  const cardCount=()=>{
    if(cachedCount>=0)return cachedCount;
    const h=handEl();
    cachedCount=h?h.querySelectorAll('.card').length:0;
    return cachedCount;
  };
  const dockW=()=>{
    if(cachedView!=null)return cachedView;
    const h=handEl();
    cachedView=h&&h.parentElement?h.parentElement.clientWidth:target.innerWidth;
    return cachedView;
  };
  // ── Slide bounds: cap by configured limit AND by how far cards extend off-screen. ──
  // Memoized; busted whenever spacing, hand size, or viewport changes.
  const slideCap=()=>{
    if(cachedCap!=null)return cachedCap;
    const n=cardCount();
    if(n<=1){cachedCap=0;return 0;}
    const spacing=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
    const halfSpan=(n-1)/2*spacing;
    const R=trackRadius();
    const view=dockW();
    const cardW=target.innerWidth<640?100:130;
    const halfFit=Math.max(0,(view-cardW)/2);
    const fitAngleRad=Math.asin(Math.min(.95,halfFit/R));
    const fitAngleDeg=fitAngleRad*180/Math.PI;
    const overhang=Math.max(0,halfSpan-fitAngleDeg);
    cachedCap=Math.min(OFFSET_LIMIT,overhang+4);
    return cachedCap;
  };
  const clampOffset=d=>{const c=slideCap();return Math.max(-c,Math.min(c,d));};
  const softClamp=d=>{const c=slideCap();if(c===0)return 0;const ad=Math.abs(d);if(ad<=c)return d;return Math.sign(d)*(c+(ad-c)*RUBBER);};
  // applyOffset is called every animation frame during slide/momentum, so
  // keep it cheap: skip the overflow-hint work once the hint is permanently
  // hidden (after the first swipe).
  const applyOffset=d=>{
    const h=handEl();if(!h)return;
    offset=d;
    h.style.setProperty('--track-offset',d.toFixed(3)+'deg');
    if(!target.__handHasBeenSwiped)updateOverflowHint();
  };
  const applySpacing=d=>{
    const h=handEl();if(!h)return;
    // Some late visual-pass styles define --track-spacing with !important;
    // match that priority so the gesture/autofit controller remains authoritative.
    h.style.setProperty('--track-spacing',d.toFixed(3)+'deg','important');
  };
  const liftCap=()=>target.innerWidth<640?HAND_LIFT_PX_MOBILE:HAND_LIFT_PX;
  const clampLift=y=>Math.max(-liftCap(),Math.min(liftCap(),y));
  const softClampLift=y=>{const c=liftCap();if(y>c)return c+(y-c)*RUBBER;if(y<-c)return -c+(y+c)*RUBBER;return y;};
  const applyLift=y=>{const h=handEl();if(!h)return;lift=y;h.style.setProperty('--hand-lift-y',y.toFixed(1)+'px');};
  const applySlots=()=>{
    const h=handEl();if(!h)return;
    const cards=h.querySelectorAll('.card');
    const n=cards.length;
    cards.forEach((c,i)=>{c.style.setProperty('--slot',(i-(n-1)/2).toString());});
  };
  const updateOverflowHint=()=>{const z=zoneEl();if(!z)return;const step=target.__handHintStep||1;z.dataset.hintStep=String(Math.max(1,Math.min(3,step)));if(target.__handHasBeenSwiped||step>=4){z.classList.add('hints-complete');z.classList.remove('has-overflow');return;}z.classList.remove('hints-complete','has-swiped');z.classList.toggle('has-overflow',slideCap()>1);};
  const cancelMomentum=()=>{if(momentumRaf){cancelAnimationFrame(momentumRaf);momentumRaf=null;}};
  const cancelLiftMomentum=()=>{if(liftMomentumRaf){cancelAnimationFrame(liftMomentumRaf);liftMomentumRaf=null;}};
  const cancelDriftLift=()=>{if(driftLiftRaf){cancelAnimationFrame(driftLiftRaf);driftLiftRaf=null;}};
  const inHandArea=el=>el instanceof Element&&!!el.closest('#hand,.handDock,#handSwipeZone');
  const inSwipeZone=el=>{const z=zoneEl();return!!z&&el instanceof Element&&(el===z||z.contains(el));};
  // ── Auto-fit: choose a per-card spacing (in deg) so that all cards fit in the dock. ──
  const calcAutoSpacing=()=>{
    const h=handEl();if(!h||!h.parentElement)return null;
    const n=cardCount();
    if(n<=1)return null;
    const R=trackRadius();
    if(cachedCardW==null)cachedCardW=h.querySelector('.card')?.offsetWidth||(target.innerWidth<640?100:130);
    const cardW=cachedCardW;
    const view=dockW();
    const halfWidth=(view-cardW-16)/2;
    if(halfWidth<=0)return SPACING_MAX;
    const maxAngleRad=Math.asin(Math.min(.95,halfWidth/R));
    const maxAngleDeg=maxAngleRad*180/Math.PI;
    const spacing=(maxAngleDeg*2)/(n-1);
    return Math.max(SPACING_MIN,Math.min(SPACING_MAX,spacing));
  };
  const spacingMaxForFit=()=>autoSpacing!=null?autoSpacing:SPACING_MAX;
  const clampSpacingForFit=d=>Math.max(SPACING_MIN,Math.min(spacingMaxForFit(),d));
  const refreshLayout=()=>{
    const h=handEl();if(!h)return;
    // Re-apply lift to the live element in case render() replaced the DOM node.
    if(lift!==0)h.style.setProperty('--hand-lift-y',lift.toFixed(1)+'px');
    invalidateCache();
    const n=cardCount();
    const handChanged=(n!==lastHandLen);
    lastHandLen=n;
    if(handChanged)manualSpacing=null;
    // Skip slot reassignment while a card is being dragged in-hand — the
    // gesture handler is driving --slot per card and we'd stomp it.
    if(!target.__handReorderActive)applySlots();
    const auto=calcAutoSpacing();
    if(auto!=null)autoSpacing=auto;
    if(manualSpacing!=null)manualSpacing=clampSpacingForFit(manualSpacing);
    const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
    applySpacing(s);
    cachedCap=null;
    applyOffset(clampOffset(offset));
  };
  // ── Swipe velocity sampling (sample stream is in offset-degrees) ──
  const pushSample=(t,d)=>{samples.push({t,d});while(samples.length&&samples[0].t<t-SAMPLE_WINDOW)samples.shift();};
  const pushLiftSample=(t,y)=>{liftSamples.push({t,y});while(liftSamples.length&&liftSamples[0].t<t-SAMPLE_WINDOW)liftSamples.shift();};
  const releaseVel=()=>{
    const cutoff=performance.now()-SAMPLE_WINDOW;
    let i=0;while(i<samples.length&&samples[i].t<cutoff)i++;
    if(samples.length-i<2)return 0;
    const first=samples[i],last=samples[samples.length-1];
    const dt=last.t-first.t;
    if(dt<8)return 0;
    return (last.d-first.d)/dt;  // deg / ms
  };
  const releaseLiftVel=()=>{
    const cutoff=performance.now()-SAMPLE_WINDOW;
    let i=0;while(i<liftSamples.length&&liftSamples[i].t<cutoff)i++;
    if(liftSamples.length-i<2)return 0;
    const first=liftSamples[i],last=liftSamples[liftSamples.length-1];
    const dt=last.t-first.t;
    if(dt<8)return 0;
    return (last.y-first.y)/dt;  // px / ms
  };
  const springBack=()=>{
    const targetOffset=clampOffset(offset);
    if(Math.abs(targetOffset-offset)<.05){applyOffset(targetOffset);return;}
    const t0=performance.now(),from=offset,dur=340;
    const step=t=>{
      const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      applyOffset(from+(targetOffset-from)*e);
      if(p<1)momentumRaf=requestAnimationFrame(step);else momentumRaf=null;
    };
    momentumRaf=requestAnimationFrame(step);
  };
  const runMomentum=v0=>{
    if(Math.abs(offset)>slideCap()+.05){springBack();return;}
    let v=v0;
    if(Math.abs(v)<MIN_VEL)return;
    let lastT=performance.now();
    const step=now=>{
      const dt=Math.min(48,now-lastT);
      lastT=now;
      v*=Math.exp(-FRICTION*dt);
      let next=offset+v*dt;
      const c=slideCap();
      if(next<-c){next=-c;v=0;}
      else if(next>c){next=c;v=0;}
      applyOffset(next);
      if(Math.abs(v)<MIN_VEL){applyOffset(clampOffset(offset));momentumRaf=null;return;}
      momentumRaf=requestAnimationFrame(step);
    };
    momentumRaf=requestAnimationFrame(step);
  };
  const runLiftMomentum=v0=>{
    cancelLiftMomentum();cancelDriftLift();
    // Leave the hand floating where the player released it.
    // Only correct back into bounds if the player let go while rubber-banding past the allowance.
    const targetLift=clampLift(lift);
    if(Math.abs(targetLift-lift)<.25){applyLift(targetLift);return;}
    const from=lift;
    const start=performance.now(),dur=180;
    const step=t=>{
      const p=Math.min(1,(t-start)/dur);
      const e=1-Math.pow(1-p,3);
      applyLift(from+(targetLift-from)*e);
      if(p<1)liftMomentumRaf=requestAnimationFrame(step);
      else{applyLift(targetLift);liftMomentumRaf=null;}
    };
    liftMomentumRaf=requestAnimationFrame(step);
  };
  // Smoothly return lift to 0 over `dur` ms using an easeInOut curve.
  // Called by the ambient idle animation so the hand drifts down naturally
  // as the animation cycle takes over, rather than snapping.
  const driftLiftToZero=dur=>{
    cancelLiftMomentum();cancelDriftLift();
    if(Math.abs(lift)<0.5){applyLift(0);return;}
    const from=lift,start=performance.now();
    const step=t=>{
      const p=Math.min(1,(t-start)/dur);
      // easeInOut quad: slow start, slow end
      const e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
      applyLift(from*(1-e));
      if(p<1)driftLiftRaf=requestAnimationFrame(step);
      else{applyLift(0);driftLiftRaf=null;}
    };
    driftLiftRaf=requestAnimationFrame(step);
  };
  target.__handDriftLiftToZero=driftLiftToZero;

  // ── Pinch helpers ──
  const distOf=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y;return Math.hypot(dx,dy);};
  // Kick the other pointer listeners (press-highlight, drag-select) out of their
  // in-flight gesture so they don't try to treat the pinch as a card press/drag.
  const cancelExternalGestures=()=>{
    document.querySelectorAll('.card.press-highlight,.card.drag-select-preview').forEach(el=>{
      el.classList.remove('press-highlight');el.classList.remove('drag-select-preview');
    });
    document.body.classList.remove('mobile-drag-selecting');
    target.__handPinchSynthetic=true;
    try{
      for(const[id,p]of pointers){
        try{
          const ev=new PointerEvent('pointercancel',{pointerId:id,pointerType:'touch',bubbles:true,cancelable:true,composed:true,clientX:p.x,clientY:p.y});
          document.dispatchEvent(ev);
        }catch(e){}
      }
    }finally{target.__handPinchSynthetic=false;}
  };
  const startPinch=()=>{
    cancelMomentum();
    const ids=[...pointers.keys()];
    const a=pointers.get(ids[0]),b=pointers.get(ids[1]);
    if(!a||!b)return;
    cancelExternalGestures();
    mode='pinch';
    target.__handPinchActive=true;
    const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
    pinchStart={dist:distOf(a,b),spacing:s,ids:[ids[0],ids[1]]};
    samples.length=0;
    const z=zoneEl();if(z){z.classList.add('pinching');z.classList.remove('dragging');}
    handEl()?.classList.add('hand-scroll-dragging');
  };
  const stepPinch=()=>{
    if(!pinchStart)return;
    const a=pointers.get(pinchStart.ids[0]),b=pointers.get(pinchStart.ids[1]);
    if(!a||!b)return;
    const delta=distOf(a,b)-pinchStart.dist;
    let next=pinchStart.spacing+delta*DEG_PER_PX_PINCH;
    next=clampSpacingForFit(next);
    if(next===manualSpacing)return;
    if(next<pinchStart.spacing-.15)completeHandHintStep(2);
    if(next>pinchStart.spacing+.15)completeHandHintStep(3);
    manualSpacing=next;
    cachedCap=null;
    applySpacing(next);
    applyOffset(clampOffset(offset));
  };
  // ── Slide helpers (single-pointer, swipe zone only) ──
  const startSlideMode=ev=>{
    cancelMomentum();cancelLiftMomentum();cancelDriftLift();
    kickUndulation();
    mode='slide';
    startX=ev.clientX;startY=ev.clientY||0;startOffset=offset;startLift=lift;
  startDockH=document.querySelector('.handDock')?.offsetHeight||157;
    samples.length=0;liftSamples.length=0;pushSample(performance.now(),offset);pushLiftSample(performance.now(),lift);
    const z=zoneEl();if(z){z.classList.add('dragging');z.classList.remove('pinching');}
    handEl()?.classList.add('hand-scroll-dragging');
  };
  const completeHandHintStep=expected=>{
    const cur=target.__handHintStep||1;
    if(cur!==expected||target.__handHasBeenSwiped)return;
    const next=expected+1;
    target.__handHintStep=next;
    try{localStorage.setItem('tlr_hand_hint_step',String(next));}catch(e){}
    const z2=zoneEl();
    if(next>=4){target.__handHasBeenSwiped=true;if(z2){z2.classList.add('has-swiped','hints-complete');z2.classList.remove('has-overflow');}}
    else if(z2){z2.dataset.hintStep=String(next);z2.classList.remove('has-swiped','hints-complete');updateOverflowHint();}
  };
  const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const dy=(ev.clientY||startY)-startY;
    // Flush gesture: drag 2/3 of the hand dock below the screen edge.
    if(dy>startDockH*2/3&&typeof target.flushHand==='function'){endGesture();target.flushHand();return;}
    const targetOffset=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    if(Math.abs(targetOffset-startOffset)>1.15){completeHandHintStep(1);if(typeof target.tutSignal==='function')target.tutSignal('handScrolled');}
    const y=softClampLift(startLift+dy);
    applyOffset(targetOffset);
    applyLift(y);
    const now=performance.now();
    pushSample(now,targetOffset);
    pushLiftSample(now,y);
  };
  const endGesture=()=>{
    const wasSlide=(mode==='slide'),wasPinch=(mode==='pinch');
    if(moveRaf!=null){cancelAnimationFrame(moveRaf);moveRaf=null;pendingMoveEv=null;}
    const z=zoneEl();if(z){z.classList.remove('dragging','pinching');}
    handEl()?.classList.remove('hand-scroll-dragging');
    if(wasPinch)target.__handPinchActive=false;
    mode=null;pinchStart=null;
    if(wasSlide){runMomentum(releaseVel());springBack();runLiftMomentum(releaseLiftVel());}
    else if(wasPinch){
      applyOffset(clampOffset(offset));
      pinchSuppressClickUntil=performance.now()+550;
    } else {
      applyOffset(clampOffset(offset));
    }
    samples.length=0;
  };
  // ── Pointer event routing ──
  document.addEventListener('pointerdown',ev=>{
    if(target.__handPinchSynthetic)return;
    if(ev.target instanceof Element&&ev.target.closest('.card-detail-trigger'))return;
    if(!inHandArea(ev.target))return;
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(pointers.size>=2){
      if(mode!=='pinch')startPinch();
      return;
    }
    // Single-finger slide: touch must start in the dedicated swipe strip.
    // Mouse can start anywhere in the hand dock that isn't a card itself,
    // so desktop users don't need to find the invisible 88px strip.
    const isMouse=ev.pointerType==='mouse';
    const isMiddleMouse=isMouse&&ev.button===1;
    const mouseInHand=isMiddleMouse&&ev.target instanceof Element&&ev.target.closest('.handDock,#handSwipeZone')&&!ev.target.closest('.card[data-uid]');
    if(((inSwipeZone(ev.target)&&!isMouse)||mouseInHand)&&mode==null){
      if(isMiddleMouse)ev.preventDefault();
      try{(isMouse?ev.target.closest('.handDock,#handSwipeZone'):zoneEl())?.setPointerCapture(ev.pointerId);}catch(e){}
      startSlideMode(ev);
    }
  },true);
  // Pointermove fires up to 240Hz on modern touch hardware. Coalesce into
  // one update per animation frame so we don't burn cycles on samples that
  // will never be displayed.
  const flushMove=()=>{
    moveRaf=null;
    const ev=pendingMoveEv;pendingMoveEv=null;
    if(!ev)return;
    if(mode==='pinch')stepPinch();
    else if(mode==='slide')stepSlide(ev);
  };
  document.addEventListener('pointermove',ev=>{
    if(target.__handPinchSynthetic)return;
    if(!pointers.has(ev.pointerId))return;
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(mode!=='pinch'&&mode!=='slide')return;
    ev.preventDefault();
    pendingMoveEv=ev;
    if(moveRaf==null)moveRaf=requestAnimationFrame(flushMove);
  },{capture:true,passive:false});
  const onPointerEnd=ev=>{
    if(target.__handPinchSynthetic)return;
    if(!pointers.has(ev.pointerId))return;
    pointers.delete(ev.pointerId);
    if(pointers.size===0){endGesture();}
    else if(mode==='pinch'&&pointers.size<2){
      pinchStart=null;
      target.__handPinchActive=false;
      const z=zoneEl();if(z)z.classList.remove('pinching');
      handEl()?.classList.remove('hand-scroll-dragging');
      pinchSuppressClickUntil=performance.now()+550;
      // If remaining pointer is already in the swipe zone, resume as a slide gesture.
      const remId=[...pointers.keys()][0];
      const rp=remId!=null?pointers.get(remId):null;
      const z2=zoneEl();
      let startedSlide=false;
      if(rp&&z2){
        const rect=z2.getBoundingClientRect();
        if(rp.x>=rect.left&&rp.x<=rect.right&&rp.y>=rect.top&&rp.y<=rect.bottom){
          try{z2.setPointerCapture(remId);}catch(e){}
          startSlideMode({clientX:rp.x,clientY:rp.y});
          startedSlide=true;
        }
      }
      if(!startedSlide)mode=null;
    }
  };
  document.addEventListener('pointerup',onPointerEnd,true);
  document.addEventListener('pointercancel',onPointerEnd,true);
  // Block card clicks during an active pinch and for 550ms after it ends.
  document.addEventListener('click',ev=>{
    const suppressed=mode==='pinch'||performance.now()<pinchSuppressClickUntil;
    if(!suppressed)return;
    const t=ev.target instanceof Element?ev.target:null;
    if(t&&t.closest('#hand .card[data-uid],#spread .card[data-uid]')){
      ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    }
  },true);
  // ── React to hand changes & viewport changes ──
  // Resize events can pile up; coalesce them to rAF.
  const scheduleRecheck=()=>{
    cachedCardW=null;cachedView=null;
    if(recheckRaf!=null)return;
    recheckRaf=requestAnimationFrame(()=>{recheckRaf=null;refreshLayout();});
  };
  // Mutation-driven refresh must be SYNC (so --slot is assigned before paint),
  // but suppressed while render() is mid-loop: each insertBefore fires the
  // observer with an intermediate card count, causing cascading bad-slot
  // animations. render() sets window.__handRenderActive=true for the
  // duration and calls window.__handTriggerLayout() at the end instead.
  const onHandMutation=()=>{
    if(target.__handRenderActive||target.__handReorderActive)return;
    if(recheckRaf!=null){cancelAnimationFrame(recheckRaf);recheckRaf=null;}
    refreshLayout();
  };
  let ro=null;
  const attachObserver=()=>{
    const h=handEl();
    if(!h){requestAnimationFrame(attachObserver);return;}
    if(ro)return;
    if('ResizeObserver' in target){ro=new ResizeObserver(scheduleRecheck);ro.observe(h);ro.observe(h.parentElement);}
    new MutationObserver(onHandMutation).observe(h,{childList:true});
    refreshLayout();
    if(target.__handHasBeenSwiped){const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}}
  };
  // Expose a direct layout trigger so render() can call it after the loop.
  target.__handTriggerLayout=()=>{
    if(recheckRaf!=null){cancelAnimationFrame(recheckRaf);recheckRaf=null;}
    refreshLayout();
  };
  // Expose the current arc track parameters so the gesture handler can
  // map pointer X -> a fractional slot along the arc.
  target.__handGetTrackState=()=>{
    const h=handEl();if(!h)return null;
    const r=h.getBoundingClientRect();
    const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
    return{
      hand:h,
      handRect:r,
      cardCount:cardCount(),
      offsetDeg:offset,
      spacingDeg:s,
      radius:trackRadius(),
    };
  };
  // ── Desktop scroll-wheel: scroll down = constrict, scroll up = expand ──
  (function(){
    // Fine-pointer devices get the wheel wording; touch devices keep the
    // pinch wording. A touchscreen laptop matches fine-pointer but pinch
    // still works there too — both inputs stay live regardless of the text.
    const isDesktop=()=>target.matchMedia?.('(hover: hover) and (pointer: fine)').matches??false;
    // Swap hint text for desktop on first opportunity
    const setHintText=()=>{
      const l2=document.getElementById('handHintLine2');
      const l3=document.getElementById('handHintLine3');
      if(!l2||!l3)return;
      if(isDesktop()){
        l2.innerHTML='<span></span>&#x2724; scroll down to constrict &#x2724;<span></span>';
        l3.innerHTML='<span></span>&#x2724; scroll up to expand &#x2724;<span></span>';
      } else {
        l2.innerHTML='<span></span>&#x2724; pinch to constrict &#x2724;<span></span>';
        l3.innerHTML='<span></span>&#x2724; pull open to expand &#x2724;<span></span>';
      }
    };
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',setHintText);}
    else{setHintText();}
    // The SPv2 shell rebuilds the hint DOM (restoreHandTutorial), so expose
    // the setter for it to re-apply the input-appropriate wording after.
    target.__handSetHintText=setHintText;

    // Scroll to adjust spacing; horizontal scroll drifts the hand side-to-side.
    const DEG_PER_SCROLL=0.012;  // degrees of spacing per pixel of vertical scroll delta
    let scrollRaf=null;
    let pendingSpacingDelta=0;
    let pendingSideDelta=0;
    const markHandScrolled=()=>{completeHandHintStep(1);};
    const applyScroll=()=>{
      scrollRaf=null;
      if(pendingSideDelta){
        const dx=pendingSideDelta;pendingSideDelta=0;
        markHandScrolled();
        applyOffset(softClamp(offset-dx*DEG_PER_SIDE_SCROLL));
      }
      if(pendingSpacingDelta){
        const delta=pendingSpacingDelta;pendingSpacingDelta=0;
        if(delta>0)completeHandHintStep(2);
        if(delta<0)completeHandHintStep(3);
        // deltaY > 0 = scroll down = constrict (reduce spacing)
        const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
        let next=s - delta*DEG_PER_SCROLL;
        next=clampSpacingForFit(next);
        if(next!==manualSpacing){
          manualSpacing=next;
          cachedCap=null;
          applySpacing(next);
          applyOffset(clampOffset(offset));
        }
      }
    };
    // A wheel event over the hand is unambiguous intent — no device gate.
    const onWheel=ev=>{
      const z=zoneEl();if(!z)return;
      // Only activate when hovering the swipe zone or the hand area
      if(!ev.target.closest('#handSwipeZone,.handDock'))return;
      ev.preventDefault();
      // Normalise delta across different wheel modes
      let dx=ev.deltaX,dy=ev.deltaY;
      if(ev.deltaMode===1){dx*=20;dy*=20;}   // line mode
      if(ev.deltaMode===2){dx*=400;dy*=400;} // page mode
      if(Math.abs(dx)>Math.abs(dy))pendingSideDelta+=dx;
      else pendingSpacingDelta+=dy;
      if(scrollRaf==null)scrollRaf=requestAnimationFrame(applyScroll);
    };
    target.addEventListener('wheel',onWheel,{passive:false});
  })();
  attachObserver();
  target.addEventListener('resize',scheduleRecheck);
}
