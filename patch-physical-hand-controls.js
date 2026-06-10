const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* physical hand controls patch */';
if (html.includes(marker)) {
  console.log('Physical hand controls patch already present, skipping.');
  process.exit(0);
}

let changed = 0;
function rep(oldText, newText, label) {
  if (html.includes(oldText)) {
    html = html.replace(oldText, newText);
    console.log('  ✓', label);
    changed++;
  } else {
    console.warn('  WARN: not found —', label);
  }
}

console.log('Physical hand controls patch:');

// Give the whole hand a vertical offset driven by the swipe handler.
rep(
  `.hand{position:relative;display:block;max-width:none;width:100%;height:235px;--track-offset:0deg;--track-spacing:5deg;--track-radius:780px}`,
  `.hand{position:relative;display:block;max-width:none;width:100%;height:235px;--track-offset:0deg;--track-spacing:5deg;--track-radius:780px;--hand-lift-y:0px;transform:translateY(var(--hand-lift-y));transition:transform .22s cubic-bezier(.2,.85,.25,1)}`,
  'Hand container supports vertical physical offset'
);

rep(
  `.hand.hand-scroll-dragging .card{transition:none}`,
  `.hand.hand-scroll-dragging{transition:none}.hand.hand-scroll-dragging .card{transition:none}`,
  'Disable hand transition while actively controlling it'
);

// State variables for vertical hand motion.
rep(
  `let offset=0,startOffset=0,startX=0;               // track offset (degrees)`,
  `let offset=0,startOffset=0,startX=0,startY=0,startLift=0,lift=0; // track offset (degrees), plus vertical lift`,
  'Add vertical lift gesture state'
);

rep(
  `let samples=[];                                    // {t,deg} ring for swipe velocity`,
  `let samples=[];                                    // {t,deg} ring for horizontal swipe velocity
  let liftSamples=[];                                // {t,y} ring for vertical swipe velocity`,
  'Add vertical velocity samples'
);

rep(
  `let momentumRaf=null;`,
  `let momentumRaf=null,liftMomentumRaf=null;`,
  'Add vertical release animation raf'
);

rep(
  `const DEG_PER_PX_PINCH=0.013;                      // pinch pixels -> degrees of spacing`,
  `const DEG_PER_PX_PINCH=0.013;                      // pinch pixels -> degrees of spacing
  const HAND_LIFT_PX=38;
  const HAND_LIFT_PX_MOBILE=30;
  const DEG_PER_SIDE_SCROLL=0.08;`,
  'Add vertical lift and horizontal scroll constants'
);

rep(
  `const applySpacing=d=>{const h=handEl();if(!h)return;h.style.setProperty('--track-spacing',d.toFixed(3)+'deg');};`,
  `const applySpacing=d=>{const h=handEl();if(!h)return;h.style.setProperty('--track-spacing',d.toFixed(3)+'deg');};
  const liftCap=()=>window.innerWidth<640?HAND_LIFT_PX_MOBILE:HAND_LIFT_PX;
  const clampLift=y=>Math.max(-liftCap(),Math.min(0,y));
  const softClampLift=y=>{const c=liftCap();if(y>0)return y*RUBBER;if(y<-c)return -c+(y+c)*RUBBER;return y;};
  const applyLift=y=>{const h=handEl();if(!h)return;lift=y;h.style.setProperty('--hand-lift-y',y.toFixed(1)+'px');};`,
  'Add vertical lift helpers'
);

rep(
  `const cancelMomentum=()=>{if(momentumRaf){cancelAnimationFrame(momentumRaf);momentumRaf=null;}};`,
  `const cancelMomentum=()=>{if(momentumRaf){cancelAnimationFrame(momentumRaf);momentumRaf=null;}};
  const cancelLiftMomentum=()=>{if(liftMomentumRaf){cancelAnimationFrame(liftMomentumRaf);liftMomentumRaf=null;}};`,
  'Add vertical animation cancellation'
);

rep(
  `const pushSample=(t,d)=>{samples.push({t,d});while(samples.length&&samples[0].t<t-SAMPLE_WINDOW)samples.shift();};`,
  `const pushSample=(t,d)=>{samples.push({t,d});while(samples.length&&samples[0].t<t-SAMPLE_WINDOW)samples.shift();};
  const pushLiftSample=(t,y)=>{liftSamples.push({t,y});while(liftSamples.length&&liftSamples[0].t<t-SAMPLE_WINDOW)liftSamples.shift();};`,
  'Add vertical velocity sampling'
);

rep(
  `const releaseVel=()=>{
    const cutoff=performance.now()-SAMPLE_WINDOW;
    let i=0;while(i<samples.length&&samples[i].t<cutoff)i++;
    if(samples.length-i<2)return 0;
    const first=samples[i],last=samples[samples.length-1];
    const dt=last.t-first.t;
    if(dt<8)return 0;
    return (last.d-first.d)/dt;  // deg / ms
  };`,
  `const releaseVel=()=>{
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
  };`,
  'Add vertical release velocity'
);

// Release now preserves the current floating position, with a little momentum and sway.
// It no longer chooses between snapping to the top or snapping to the bottom.
rep(
  `const runMomentum=v0=>{
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
  };`,
  `const runMomentum=v0=>{
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
    cancelLiftMomentum();
    const from=lift;
    const target=clampLift(lift+v0*210);
    const sway=Math.max(-7,Math.min(7,v0*80));
    const start=performance.now(),dur=420;
    const step=t=>{
      const p=Math.min(1,(t-start)/dur);
      const e=1-Math.pow(1-p,3);
      const wobble=Math.sin(p*Math.PI*2.35)*sway*(1-p);
      applyLift(clampLift(from+(target-from)*e+wobble));
      if(p<1)liftMomentumRaf=requestAnimationFrame(step);
      else{applyLift(target);liftMomentumRaf=null;}
    };
    liftMomentumRaf=requestAnimationFrame(step);
  };`,
  'Add floating vertical release with damped sway'
);

rep(
  `const startSlideMode=ev=>{
    cancelMomentum();
    mode='slide';
    startX=ev.clientX;startOffset=offset;
    samples.length=0;pushSample(performance.now(),offset);`,
  `const startSlideMode=ev=>{
    cancelMomentum();cancelLiftMomentum();
    kickUndulation();
    mode='slide';
    startX=ev.clientX;startY=ev.clientY||0;startOffset=offset;startLift=lift;
    samples.length=0;liftSamples.length=0;pushSample(performance.now(),offset);pushLiftSample(performance.now(),lift);`,
  'Start slide tracks vertical lift origin'
);

// Move both axes at once. This removes the jerky horizontal/vertical axis switch and makes
// diagonal drag feel like guiding an object through space.
rep(
  `const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    applyOffset(target);
    pushSample(performance.now(),target);
  };`,
  `const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const dy=(ev.clientY||startY)-startY;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    const y=softClampLift(startLift+dy);
    applyOffset(target);
    applyLift(y);
    const now=performance.now();
    pushSample(now,target);
    pushLiftSample(now,y);
  };`,
  'Swipe handler follows x/y drag continuously'
);

rep(
  `if(wasSlide){runMomentum(releaseVel());springBack();}`, 
  `if(wasSlide){runMomentum(releaseVel());springBack();runLiftMomentum(releaseLiftVel());}`,
  'Release applies vertical momentum and float settle'
);

rep(
  `startSlideMode({clientX:rp.x});`,
  `startSlideMode({clientX:rp.x,clientY:rp.y});`,
  'Preserve Y coordinate when resuming slide after pinch'
);

// Desktop convention: side-to-side dragging starts from middle mouse hold only, while touch still uses the swipe strip.
rep(
  `const isMouse=ev.pointerType==='mouse';
    const mouseInHand=isMouse&&ev.target instanceof Element&&ev.target.closest('.handDock,#handSwipeZone')&&!ev.target.closest('.card[data-uid]');
    if((inSwipeZone(ev.target)||mouseInHand)&&mode==null){
      try{(isMouse?ev.target.closest('.handDock,#handSwipeZone'):zoneEl())?.setPointerCapture(ev.pointerId);}catch(e){}
      startSlideMode(ev);
    }`,
  `const isMouse=ev.pointerType==='mouse';
    const isMiddleMouse=isMouse&&ev.button===1;
    const mouseInHand=isMiddleMouse&&ev.target instanceof Element&&ev.target.closest('.handDock,#handSwipeZone')&&!ev.target.closest('.card[data-uid]');
    if(((inSwipeZone(ev.target)&&!isMouse)||mouseInHand)&&mode==null){
      if(isMiddleMouse)ev.preventDefault();
      try{(isMouse?ev.target.closest('.handDock,#handSwipeZone'):zoneEl())?.setPointerCapture(ev.pointerId);}catch(e){}
      startSlideMode(ev);
    }`,
  'Desktop hand drag uses middle mouse hold only'
);

// Horizontal wheel/trackpad movement drifts the hand side-to-side. Vertical wheel remains spacing.
rep(
  `// Scroll to adjust spacing — desktop only
    const DEG_PER_SCROLL=0.012;  // degrees of spacing per pixel of scroll delta
    let scrollRaf=null;
    let pendingDelta=0;
    const applyScroll=()=>{
      scrollRaf=null;
      if(!pendingDelta)return;
      const delta=pendingDelta;pendingDelta=0;
      // deltaY > 0 = scroll down = constrict (reduce spacing)
      const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
      let next=s - delta*DEG_PER_SCROLL;
      next=Math.max(SPACING_MIN,Math.min(SPACING_MAX,next));
      if(next===manualSpacing)return;
      manualSpacing=next;
      cachedCap=null;
      applySpacing(next);
      applyOffset(clampOffset(offset));
    };
    const onWheel=ev=>{
      if(!isDesktop())return;
      const z=zoneEl();if(!z)return;
      // Only activate when hovering the swipe zone or the hand area
      if(!ev.target.closest('#handSwipeZone,.handDock'))return;
      ev.preventDefault();
      // Normalise delta across different wheel modes
      let dy=ev.deltaY;
      if(ev.deltaMode===1)dy*=20;   // line mode
      if(ev.deltaMode===2)dy*=400;  // page mode
      pendingDelta+=dy;
      if(scrollRaf==null)scrollRaf=requestAnimationFrame(applyScroll);
    };
    window.addEventListener('wheel',onWheel,{passive:false});`,
  `// Scroll to adjust spacing; horizontal scroll drifts the hand side-to-side.
    const DEG_PER_SCROLL=0.012;  // degrees of spacing per pixel of vertical scroll delta
    let scrollRaf=null;
    let pendingSpacingDelta=0;
    let pendingSideDelta=0;
    const markHandScrolled=()=>{
      if(window.__handHasBeenSwiped)return;
      window.__handHasBeenSwiped=true;
      try{localStorage.setItem('tlr_hand_swiped','1');}catch(e){}
      const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}
    };
    const applyScroll=()=>{
      scrollRaf=null;
      if(pendingSideDelta){
        const dx=pendingSideDelta;pendingSideDelta=0;
        markHandScrolled();
        applyOffset(softClamp(offset+dx*DEG_PER_SIDE_SCROLL));
      }
      if(pendingSpacingDelta){
        const delta=pendingSpacingDelta;pendingSpacingDelta=0;
        // deltaY > 0 = scroll down = constrict (reduce spacing)
        const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
        let next=s - delta*DEG_PER_SCROLL;
        next=Math.max(SPACING_MIN,Math.min(SPACING_MAX,next));
        if(next!==manualSpacing){
          manualSpacing=next;
          cachedCap=null;
          applySpacing(next);
          applyOffset(clampOffset(offset));
        }
      }
    };
    const onWheel=ev=>{
      if(!isDesktop())return;
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
    window.addEventListener('wheel',onWheel,{passive:false});`,
  'Horizontal wheel/trackpad scroll drifts hand side-to-side'
);

html = html.replace('</style>', `${marker}\n</style>`);
fs.writeFileSync(file, html);
console.log(`Done — ${changed} physical hand control replacements applied.`);
