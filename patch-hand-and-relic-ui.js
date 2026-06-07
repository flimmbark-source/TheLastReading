const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function replaceOne(label, candidate, replacement) {
  if (html.includes(replacement)) {
    console.log(`${label} already applied.`);
    return false;
  }
  if (!html.includes(candidate)) {
    throw new Error(`${label}: could not find candidate to replace.`);
  }
  html = html.replace(candidate, replacement);
  changed = true;
  console.log(`Patched ${label}.`);
  return true;
}

function upsertBlock(label, markerStart, markerEnd, body, anchor = '</style>') {
  const block = `${markerStart}\n${body}\n${markerEnd}`;
  const re = new RegExp(
    markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  if (re.test(html)) {
    html = html.replace(re, block);
    changed = true;
    console.log(`Refreshed ${label}.`);
    return;
  }
  const idx = html.lastIndexOf(anchor);
  if (idx < 0) throw new Error(`Could not insert ${label}; anchor ${anchor} not found.`);
  html = html.slice(0, idx) + block + '\n' + html.slice(idx);
  changed = true;
  console.log(`Inserted ${label}.`);
}

// ───────────────────────────────────────────────────────────────
// 1. Mystical "vision" transition for the bonus-relic screen.
// ───────────────────────────────────────────────────────────────
upsertBlock(
  'relic vision transition CSS',
  '/* relic vision transition patch */',
  '/* end relic vision transition patch */',
  `.relic-vision-veil{position:fixed;inset:0;z-index:9997;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 45%,rgba(255,217,120,.55) 0%,rgba(146,90,28,.78) 28%,rgba(20,8,4,.96) 72%);animation:relic-vision-rise 1.65s cubic-bezier(.42,0,.28,1) forwards;mix-blend-mode:screen}
.relic-vision-rays{position:fixed;inset:0;z-index:9998;pointer-events:none;opacity:0;background:conic-gradient(from 90deg at 50% 45%,transparent 0deg,rgba(255,217,120,.42) 14deg,transparent 28deg,rgba(255,217,120,.32) 60deg,transparent 80deg,rgba(255,217,120,.45) 130deg,transparent 152deg,rgba(255,217,120,.35) 200deg,transparent 224deg,rgba(255,217,120,.5) 268deg,transparent 296deg,rgba(255,217,120,.38) 332deg,transparent 360deg);animation:relic-vision-rays 1.7s linear forwards}
.relic-vision-mote{position:fixed;left:50%;top:46%;z-index:9998;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle,#ffe79a 0%,rgba(255,180,60,.6) 50%,transparent 70%);pointer-events:none;opacity:0;animation:relic-vision-mote 1.6s ease-out forwards}
@keyframes relic-vision-rise{
  0%   {opacity:0;transform:scale(.55);filter:blur(22px) brightness(1.4)}
  20%  {opacity:.45}
  44%  {opacity:.95;filter:blur(0) brightness(1.1)}
  72%  {opacity:.85;transform:scale(1)}
  100% {opacity:0;transform:scale(1.18);filter:blur(8px)}
}
@keyframes relic-vision-rays{
  0%   {opacity:0;transform:rotate(0deg) scale(.6)}
  30%  {opacity:.85}
  70%  {opacity:.55;transform:rotate(34deg) scale(1.05)}
  100% {opacity:0;transform:rotate(54deg) scale(1.3)}
}
@keyframes relic-vision-mote{
  0%   {opacity:0;transform:translate(-50%,-50%) scale(.4)}
  20%  {opacity:.9}
  100% {opacity:0;transform:translate(calc(-50% + var(--mx,0px)),calc(-50% + var(--my,-180px))) scale(.2)}
}
.relic-vision-enter{animation:relic-vision-enter 1.05s cubic-bezier(.2,.85,.25,1) forwards}
@keyframes relic-vision-enter{
  0%   {opacity:0;transform:translateY(36px) scale(.92);filter:blur(8px)}
  55%  {opacity:1;transform:translateY(-6px) scale(1.015);filter:blur(0)}
  80%  {transform:translateY(2px) scale(1)}
  100% {opacity:1;transform:translateY(0) scale(1);filter:blur(0)}
}
@media(prefers-reduced-motion:reduce){.relic-vision-veil,.relic-vision-rays,.relic-vision-mote{animation:none;opacity:0;display:none}.relic-vision-enter{animation:none}}`
);

// Wrap the bonus-relic openShop path with the vision sequence.
const openShopOrig = `function openShop(){
  if(!state.relicEarned){openShopMain();return;}
  if(state.pendingPool){persist.pool+=state.pendingPool;state.pendingPool=0;render();}
  const options=relicPool(4);
  if(!options.length){openShopMain();return;}
  const p=PACKS['relic'];
  let html='<div class="summary tarot-shop">';
  html+=\`<div class="pack-picker-header"><h3>A Vision Stirs</h3><p>A relic calls to you — choose one to carry, or pass it by</p></div>\`;
  html+='<div class="shop-items-row relic-picker-row">';
  for(const k of options){`;
const openShopPatched = `function openShop(){
  if(!state.relicEarned){openShopMain();return;}
  if(state.pendingPool){persist.pool+=state.pendingPool;state.pendingPool=0;render();}
  const options=relicPool(4);
  if(!options.length){openShopMain();return;}
  playRelicVision();
  setTimeout(()=>_openRelicVisionShop(options),520);
}
function playRelicVision(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  try{playSound('resonation');}catch(e){}
  try{haptic([0,40,30,60,40,80]);}catch(e){}
  const veil=document.createElement('div');veil.className='relic-vision-veil';document.body.appendChild(veil);
  const rays=document.createElement('div');rays.className='relic-vision-rays';document.body.appendChild(rays);
  for(let i=0;i<14;i++){
    const m=document.createElement('div');m.className='relic-vision-mote';
    const ang=Math.random()*Math.PI*2,r=140+Math.random()*180;
    m.style.setProperty('--mx',Math.cos(ang)*r+'px');
    m.style.setProperty('--my',(Math.sin(ang)*r-140)+'px');
    m.style.animationDelay=(Math.random()*.35)+'s';
    m.style.width=m.style.height=(6+Math.random()*8).toFixed(1)+'px';
    document.body.appendChild(m);
    setTimeout(()=>m.remove(),2100);
  }
  setTimeout(()=>{veil.remove();rays.remove();},1800);
}
function _openRelicVisionShop(options){
  const p=PACKS['relic'];
  let html='<div class="summary tarot-shop relic-vision-enter">';
  html+=\`<div class="pack-picker-header"><h3>A Vision Stirs</h3><p>A relic calls to you — choose one to carry, or pass it by</p></div>\`;
  html+='<div class="shop-items-row relic-picker-row">';
  for(const k of options){`;
replaceOne('openShop vision wrapper', openShopOrig, openShopPatched);

// ───────────────────────────────────────────────────────────────
// 2. Relic rack: push to right edge on mobile, stack vertically.
// ───────────────────────────────────────────────────────────────
upsertBlock(
  'relic rack mobile CSS',
  '/* relic rack mobile right-side patch */',
  '/* end relic rack mobile right-side patch */',
  `@media(max-width:640px){
  .relic-rack{flex-direction:column;top:54px;right:4px;gap:5px;align-items:flex-end}
  .relic-rack .relic-btn{width:34px;height:34px}
  .relic-rack .relic-slot-empty{width:34px;height:34px}
}`
);

// ───────────────────────────────────────────────────────────────
// 3. Hand swipe-scroll: drag a strip above the hand to slide the
//    whole row of cards instead of cramming them on-screen.
// ───────────────────────────────────────────────────────────────
upsertBlock(
  'hand swipe-scroll CSS',
  '/* hand swipe-scroll patch */',
  '/* end hand swipe-scroll patch */',
  `.handDock{overflow-x:clip;overflow-y:visible}
.hand{max-width:none;width:max-content;transform:translate3d(var(--hand-slide-x,0px),0,0);transition:transform .45s cubic-bezier(.2,.85,.25,1)}
.hand.hand-scroll-dragging{transition:none}
.hand .card{margin-left:var(--hand-card-margin,-50px)!important}
.hand .card:first-child{margin-left:0!important}
@media(max-width:640px){.hand .card{margin-left:var(--hand-card-margin,-42px)!important}}
.hand-swipe-zone{position:fixed;left:0;right:0;bottom:197px;height:88px;z-index:19;pointer-events:auto;touch-action:none;cursor:grab;background:transparent}
.hand-swipe-zone.dragging{cursor:grabbing}
.hand-swipe-zone.pinching{cursor:ew-resize}
@media(max-width:640px){.hand-swipe-zone{bottom:152px;height:74px}}
.hand-swipe-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:14px;pointer-events:none;opacity:.0;transition:opacity .4s;font:600 10px system-ui,Segoe UI,sans-serif;color:rgba(232,196,96,.55);letter-spacing:.18em;text-transform:uppercase}
.hand-swipe-zone.has-overflow .hand-swipe-hint{opacity:.5}
.hand-swipe-zone.dragging .hand-swipe-hint,.hand-swipe-zone.pinching .hand-swipe-hint{opacity:0}
.hand-swipe-hint span{display:inline-block;width:30px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,196,96,.6),transparent)}`
);

// Insert the swipe zone in the DOM, above #handDock.
const handDockOrig = `<div class="handDock">`;
const handDockPatched = `<div id="handSwipeZone" class="hand-swipe-zone"><div class="hand-swipe-hint"><span></span>&#x2724; swipe to drift &#x2724;<span></span></div></div>
<div class="handDock">`;
replaceOne('hand swipe zone element', handDockOrig, handDockPatched);

// Slide along the track + pinch-to-spread + auto-fit card spacing.
upsertBlock(
  'hand swipe-scroll handler',
  '/* hand swipe-scroll handler patch */',
  '/* end hand swipe-scroll handler patch */',
  `(function(){
  if(window.__handSwipeScrollInstalled)return;
  window.__handSwipeScrollInstalled=true;
  let zone=null,hand=null;
  let slide=0,startSlide=0,startX=0;                 // slide bookkeeping (px)
  let samples=[];                                    // {t,x} ring for swipe velocity
  let pointers=new Map();                            // active pointer id -> {x,y}
  let mode=null;                                     // 'slide' | 'pinch' | null
  let pinchStart=null;                               // {dist,margin}
  let manualMargin=null;                             // user-set override (px)
  let autoMargin=null;                               // last computed auto value (px)
  let lastHandLen=-1;                                // re-fits when this changes
  const SAMPLE_WINDOW=90;
  const FRICTION=0.0028;
  const MIN_VEL=0.012;
  const RUBBER=0.42;
  const MARGIN_MIN=-96;                              // most overlap allowed
  const MARGIN_MAX=-6;                               // least overlap allowed
  let momentumRaf=null;
  const handEl=()=>{if(hand&&hand.isConnected)return hand;hand=document.querySelector('.hand');return hand;};
  const zoneEl=()=>{if(zone&&zone.isConnected)return zone;zone=document.getElementById('handSwipeZone');return zone;};
  const dockW=()=>{const h=handEl();return h&&h.parentElement?h.parentElement.clientWidth:window.innerWidth;};
  const handW=()=>{const h=handEl();return h?h.scrollWidth:0;};
  const maxOffset=()=>{const o=(handW()-dockW())/2;return o>0?o:0;};
  const clampSlide=x=>{const o=maxOffset();return Math.max(-o,Math.min(o,x));};
  const softClamp=x=>{const o=maxOffset();if(o===0)return 0;const ax=Math.abs(x);if(ax<=o)return x;return Math.sign(x)*(o+(ax-o)*RUBBER);};
  const applySlide=x=>{const h=handEl();if(!h)return;slide=x;h.style.setProperty('--hand-slide-x',x.toFixed(2)+'px');updateOverflowHint();};
  const applyMargin=m=>{const h=handEl();if(!h)return;h.style.setProperty('--hand-card-margin',m.toFixed(1)+'px');};
  const updateOverflowHint=()=>{const z=zoneEl();if(!z)return;z.classList.toggle('has-overflow',maxOffset()>4);};
  const cancelMomentum=()=>{if(momentumRaf){cancelAnimationFrame(momentumRaf);momentumRaf=null;}};
  // ── Auto-fit: pick a margin that keeps every card visible in the dock. ──
  const calcAutoMargin=()=>{
    const h=handEl();if(!h||!h.parentElement)return null;
    const cards=h.querySelectorAll('.card');
    const n=cards.length;
    if(n<=1)return null;
    const cardW=cards[0].offsetWidth||(window.innerWidth<640?100:130);
    const view=h.parentElement.clientWidth;
    // Leave ~24px of breathing room on the sides.
    const desired=Math.max(cardW,view-24);
    const ideal=(desired-n*cardW)/(n-1);
    return Math.max(MARGIN_MIN,Math.min(MARGIN_MAX,ideal));
  };
  const refreshAutoFit=()=>{
    const h=handEl();if(!h)return;
    const n=h.querySelectorAll('.card').length;
    const handChanged=(n!==lastHandLen);
    lastHandLen=n;
    if(handChanged)manualMargin=null;                // new deal -> drop manual override
    const auto=calcAutoMargin();
    if(auto!=null)autoMargin=auto;
    const m=manualMargin!=null?manualMargin:(autoMargin!=null?autoMargin:-50);
    applyMargin(m);
  };
  // ── Swipe velocity sampling ──
  const pushSample=(t,x)=>{samples.push({t,x});while(samples.length&&samples[0].t<t-SAMPLE_WINDOW)samples.shift();};
  const releaseVel=()=>{
    const cutoff=performance.now()-SAMPLE_WINDOW;
    let i=0;while(i<samples.length&&samples[i].t<cutoff)i++;
    if(samples.length-i<2)return 0;
    const first=samples[i],last=samples[samples.length-1];
    const dt=last.t-first.t;
    if(dt<8)return 0;
    return (last.x-first.x)/dt; // px/ms
  };
  const springBack=()=>{
    const target=clampSlide(slide);
    if(Math.abs(target-slide)<.5){applySlide(target);return;}
    const t0=performance.now(),from=slide,dur=340;
    const step=t=>{
      const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      applySlide(from+(target-from)*e);
      if(p<1)momentumRaf=requestAnimationFrame(step);else momentumRaf=null;
    };
    momentumRaf=requestAnimationFrame(step);
  };
  const runMomentum=v0=>{
    if(Math.abs(slide)>maxOffset()+.5){springBack();return;}
    let v=v0;
    if(Math.abs(v)<MIN_VEL)return;
    let lastT=performance.now();
    const step=now=>{
      const dt=Math.min(48,now-lastT);
      lastT=now;
      v*=Math.exp(-FRICTION*dt);
      let next=slide+v*dt;
      const o=maxOffset();
      if(next<-o){next=-o;v=0;}
      else if(next>o){next=o;v=0;}
      applySlide(next);
      if(Math.abs(v)<MIN_VEL){applySlide(clampSlide(slide));momentumRaf=null;return;}
      momentumRaf=requestAnimationFrame(step);
    };
    momentumRaf=requestAnimationFrame(step);
  };
  // ── Pinch helpers ──
  const pointerDist=()=>{
    const a=[...pointers.values()];
    if(a.length<2)return 0;
    const dx=a[0].x-a[1].x,dy=a[0].y-a[1].y;
    return Math.hypot(dx,dy);
  };
  const startPinch=()=>{
    cancelMomentum();
    mode='pinch';
    const m=manualMargin!=null?manualMargin:(autoMargin!=null?autoMargin:-50);
    pinchStart={dist:pointerDist(),margin:m};
    samples.length=0;
    const z=zoneEl();if(z){z.classList.add('pinching');z.classList.remove('dragging');}
    handEl()?.classList.add('hand-scroll-dragging');
  };
  const stepPinch=()=>{
    if(!pinchStart)return;
    const h=handEl();if(!h)return;
    const n=h.querySelectorAll('.card').length;
    if(n<2)return;
    const delta=pointerDist()-pinchStart.dist;
    // Each px of finger spread maps to dispersing the hand by that many px total,
    // distributed across (n-1) gaps. So per-card margin shifts by delta/(n-1).
    let next=pinchStart.margin+delta/(n-1);
    next=Math.max(MARGIN_MIN,Math.min(MARGIN_MAX,next));
    manualMargin=next;
    applyMargin(next);
    applySlide(clampSlide(slide));
  };
  // ── Slide helpers (single-pointer) ──
  const startSlideMode=ev=>{
    cancelMomentum();
    mode='slide';
    startX=ev.clientX;startSlide=slide;
    samples.length=0;pushSample(performance.now(),ev.clientX);
    const z=zoneEl();if(z){z.classList.add('dragging');z.classList.remove('pinching');}
    handEl()?.classList.add('hand-scroll-dragging');
  };
  const stepSlide=ev=>{
    pushSample(performance.now(),ev.clientX);
    const dx=ev.clientX-startX;
    applySlide(softClamp(startSlide+dx));
  };
  const finishGesture=()=>{
    const wasSlide=(mode==='slide');
    const z=zoneEl();if(z){z.classList.remove('dragging','pinching');}
    handEl()?.classList.remove('hand-scroll-dragging');
    mode=null;pinchStart=null;
    if(wasSlide){runMomentum(releaseVel());springBack();}
    else{applySlide(clampSlide(slide));}
    samples.length=0;
  };
  // ── Pointer event routing ──
  document.addEventListener('pointerdown',ev=>{
    const z=zoneEl();if(!z||(ev.target!==z&&!z.contains(ev.target)))return;
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    try{z.setPointerCapture(ev.pointerId);}catch(e){}
    if(pointers.size>=2){startPinch();}
    else if(pointers.size===1){startSlideMode(ev);}
  },true);
  document.addEventListener('pointermove',ev=>{
    if(!pointers.has(ev.pointerId))return;
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    ev.preventDefault();
    if(mode==='pinch'){stepPinch();}
    else if(mode==='slide'){stepSlide(ev);}
  },{capture:true,passive:false});
  const onPointerEnd=ev=>{
    if(!pointers.has(ev.pointerId))return;
    pointers.delete(ev.pointerId);
    if(pointers.size===0){
      finishGesture();
    } else if(mode==='pinch'&&pointers.size<2){
      // Drop pinch when one finger lifts; don't transition into a slide mid-gesture.
      mode=null;pinchStart=null;
      const z=zoneEl();if(z)z.classList.remove('pinching');
    }
  };
  document.addEventListener('pointerup',onPointerEnd,true);
  document.addEventListener('pointercancel',onPointerEnd,true);
  // ── React to hand changes & viewport changes ──
  const recheck=()=>{refreshAutoFit();applySlide(clampSlide(slide));};
  let ro=null;
  const attachObserver=()=>{
    const h=handEl();
    if(!h){requestAnimationFrame(attachObserver);return;}
    if(ro)return;
    if('ResizeObserver' in window){ro=new ResizeObserver(recheck);ro.observe(h);ro.observe(h.parentElement);}
    new MutationObserver(recheck).observe(h,{childList:true});
    refreshAutoFit();
  };
  attachObserver();
  window.addEventListener('resize',recheck);
})();`,
  '</script>'
);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Applied mystical relic transition, mobile relic rack, and hand swipe-scroll.');
} else {
  console.log('No hand/relic UI changes needed.');
}
