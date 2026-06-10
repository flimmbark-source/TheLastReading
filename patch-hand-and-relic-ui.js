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
  `.relic-rack{flex-direction:column!important;top:12px;right:12px;gap:6px;align-items:flex-end}
@media(max-width:640px){
  .relic-rack{top:54px;right:4px;gap:5px}
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
.hand{position:relative;display:block;max-width:none;width:100%;height:235px;--track-offset:0deg;--track-spacing:5deg;--track-radius:780px}
@media(max-width:640px){.hand{height:185px;--track-radius:560px}}
.hand .card{
  position:absolute!important;
  left:50%;
  top:0;
  margin:0!important;
  --slot:0;
  --lag:0deg;
  --drift-x:0px;
  --drift-y:0px;
  --total-a:calc(var(--slot) * var(--track-spacing) + var(--track-offset) + var(--lag));
  --arc-x:calc(var(--track-radius) * sin(var(--total-a)));
  --arc-y:calc(var(--track-radius) * (1 - cos(var(--total-a))));
  --lift-y:0px;
  --total-rot:calc(var(--total-a) + var(--lag) * 1.5);
  transform:translate(calc(-50% + var(--arc-x) + var(--drift-x)),calc(var(--arc-y) + var(--lift-y) + var(--drift-y))) rotate(var(--total-rot))!important;
  transform-origin:50% 50%!important;
  transition:transform .32s cubic-bezier(.2,.85,.25,1);
}
.hand.hand-scroll-dragging .card,.hand.hand-undulating .card{transition:none}
.hand .card.sel,.hand .card.ability-picked,.hand .card.purge-picked{
  --lift-y:-92px;
  --total-rot:0deg;
  --lag:0deg!important;
  --drift-x:0px!important;
  --drift-y:0px!important;
  z-index:999!important;
}
@media(hover:hover){
  .hand:not(.has-selected-card) .card:hover{
    --lift-y:-92px;
    --total-rot:0deg;
    --lag:0deg!important;
    --drift-x:0px!important;
    --drift-y:0px!important;
    z-index:999!important;
  }
}
@media(max-width:640px){
  .hand .card.sel,.hand .card.ability-picked,.hand .card.purge-picked{--lift-y:-86px}
  @media(hover:hover){.hand:not(.has-selected-card) .card:hover{--lift-y:-86px}}
}
/* Stop the old swipe handler from also nudging the whole hand sideways. */
.hand{--hand-slide-x:0px;--hand-card-margin:0px}
.hand-swipe-zone{position:fixed;left:0;right:0;bottom:197px;height:88px;z-index:19;pointer-events:auto;touch-action:none;cursor:grab;background:transparent}
.hand-swipe-zone.dragging{cursor:grabbing}
.hand-swipe-zone.pinching{cursor:ew-resize}
@media(max-width:640px){.hand-swipe-zone{bottom:152px;height:74px}}
.hand-swipe-hint{position:absolute;left:50%;top:50%;pointer-events:none;opacity:0;transition:opacity .4s}
.hand-swipe-zone.has-overflow .hand-swipe-hint{opacity:1}
.hand-swipe-zone.dragging .hand-swipe-hint,.hand-swipe-zone.pinching .hand-swipe-hint{opacity:0}
.hand-swipe-zone.has-swiped .hand-swipe-hint{display:none!important}
.swipe-hint-line{position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:flex;align-items:center;gap:14px;font:600 10px system-ui,Segoe UI,sans-serif;color:rgba(232,196,96,.55);letter-spacing:.18em;text-transform:uppercase;white-space:nowrap;opacity:0;animation:hint-cycle 9s ease-in-out infinite}
.swipe-hint-line-2{animation-delay:3s}.swipe-hint-line-3{animation-delay:6s}
@keyframes hint-cycle{0%{opacity:0}5%{opacity:1}28%{opacity:1}33%{opacity:0}100%{opacity:0}}
.hand-swipe-hint span{display:inline-block;width:30px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,196,96,.6),transparent)}`
);

// Insert the swipe zone in the DOM, above #handDock.
const handDockOrig = `<div class="handDock">`;
const handDockPatched = `<div id="handSwipeZone" class="hand-swipe-zone"><div class="hand-swipe-hint"><div class="swipe-hint-line swipe-hint-line-1"><span></span>&#x2724; swipe to drift &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-2"><span></span>&#x2724; pinch to constrict &#x2724;<span></span></div><div class="swipe-hint-line swipe-hint-line-3"><span></span>&#x2724; pull open to expand &#x2724;<span></span></div></div></div>
<div class="handDock">`;
// Use id presence as idempotency guard — downstream patches may modify zone contents
if (html.includes('id="handSwipeZone"')) {
  console.log('hand swipe zone element already applied.');
} else {
  replaceOne('hand swipe zone element', handDockOrig, handDockPatched);
}

// Per-card arc track: swipe = slide each card along the curve, pinch = adjust spacing.
upsertBlock(
  'hand swipe-scroll handler',
  '/* hand swipe-scroll handler patch */',
  '/* end hand swipe-scroll handler patch */',
  `(function(){
  if(window.__handSwipeScrollInstalled)return;
  window.__handSwipeScrollInstalled=true;
  let zone=null,hand=null;
  let offset=0,startOffset=0,startX=0;               // track offset (degrees)
  let samples=[];                                    // {t,deg} ring for swipe velocity
  let pointers=new Map();                            // active pointer id -> {x,y}
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
  let momentumRaf=null;
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
  let springRaf=null,springLastT=0,springState=new WeakMap();
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
    if(!h||window.__handReorderActive){clearUndulation();return;}
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
      if(Math.abs(lag)<LAG_EPS&&Math.abs(st.v)<VEL_EPS){
        st.p=offset;st.v=0;
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
    if(active||mode==='slide'||momentumRaf!=null)springRaf=requestAnimationFrame(undulationStep);
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
  try{if(localStorage.getItem('tlr_hand_swiped'))window.__handHasBeenSwiped=true;}catch(e){}
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
    cachedView=h&&h.parentElement?h.parentElement.clientWidth:window.innerWidth;
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
    const cardW=window.innerWidth<640?100:130;
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
    if(!window.__handHasBeenSwiped)updateOverflowHint();
  };
  const applySpacing=d=>{const h=handEl();if(!h)return;h.style.setProperty('--track-spacing',d.toFixed(3)+'deg');};
  const applySlots=()=>{
    const h=handEl();if(!h)return;
    const cards=h.querySelectorAll('.card');
    const n=cards.length;
    cards.forEach((c,i)=>{c.style.setProperty('--slot',(i-(n-1)/2).toString());});
  };
  const updateOverflowHint=()=>{const z=zoneEl();if(!z)return;if(window.__handHasBeenSwiped){z.classList.remove('has-overflow');return;}z.classList.toggle('has-overflow',slideCap()>1);};
  const cancelMomentum=()=>{if(momentumRaf){cancelAnimationFrame(momentumRaf);momentumRaf=null;}};
  const inHandArea=el=>el instanceof Element&&!!el.closest('#hand,.handDock,#handSwipeZone');
  const inSwipeZone=el=>{const z=zoneEl();return!!z&&el instanceof Element&&(el===z||z.contains(el));};
  // ── Auto-fit: choose a per-card spacing (in deg) so that all cards fit in the dock. ──
  const calcAutoSpacing=()=>{
    const h=handEl();if(!h||!h.parentElement)return null;
    const n=cardCount();
    if(n<=1)return null;
    const R=trackRadius();
    if(cachedCardW==null)cachedCardW=h.querySelector('.card')?.offsetWidth||(window.innerWidth<640?100:130);
    const cardW=cachedCardW;
    const view=dockW();
    const halfWidth=(view-cardW-16)/2;
    if(halfWidth<=0)return SPACING_MAX;
    const maxAngleRad=Math.asin(Math.min(.95,halfWidth/R));
    const maxAngleDeg=maxAngleRad*180/Math.PI;
    const spacing=(maxAngleDeg*2)/(n-1);
    return Math.max(SPACING_MIN,Math.min(SPACING_MAX,spacing));
  };
  const refreshLayout=()=>{
    const h=handEl();if(!h)return;
    invalidateCache();
    const n=cardCount();
    const handChanged=(n!==lastHandLen);
    lastHandLen=n;
    if(handChanged)manualSpacing=null;
    // Skip slot reassignment while a card is being dragged in-hand — the
    // gesture handler is driving --slot per card and we'd stomp it.
    if(!window.__handReorderActive)applySlots();
    const auto=calcAutoSpacing();
    if(auto!=null)autoSpacing=auto;
    const s=manualSpacing!=null?manualSpacing:(autoSpacing!=null?autoSpacing:5);
    applySpacing(s);
    cachedCap=null;
    applyOffset(clampOffset(offset));
  };
  // ── Swipe velocity sampling (sample stream is in offset-degrees) ──
  const pushSample=(t,d)=>{samples.push({t,d});while(samples.length&&samples[0].t<t-SAMPLE_WINDOW)samples.shift();};
  const releaseVel=()=>{
    const cutoff=performance.now()-SAMPLE_WINDOW;
    let i=0;while(i<samples.length&&samples[i].t<cutoff)i++;
    if(samples.length-i<2)return 0;
    const first=samples[i],last=samples[samples.length-1];
    const dt=last.t-first.t;
    if(dt<8)return 0;
    return (last.d-first.d)/dt;  // deg / ms
  };
  const springBack=()=>{
    const target=clampOffset(offset);
    if(Math.abs(target-offset)<.05){applyOffset(target);return;}
    const t0=performance.now(),from=offset,dur=340;
    const step=t=>{
      const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);
      applyOffset(from+(target-from)*e);
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
  // ── Pinch helpers ──
  const distOf=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y;return Math.hypot(dx,dy);};
  // Kick the other pointer listeners (press-highlight, drag-select) out of their
  // in-flight gesture so they don't try to treat the pinch as a card press/drag.
  const cancelExternalGestures=()=>{
    document.querySelectorAll('.card.press-highlight,.card.drag-select-preview').forEach(el=>{
      el.classList.remove('press-highlight');el.classList.remove('drag-select-preview');
    });
    document.body.classList.remove('mobile-drag-selecting');
    window.__handPinchSynthetic=true;
    try{
      for(const[id,p]of pointers){
        try{
          const ev=new PointerEvent('pointercancel',{pointerId:id,pointerType:'touch',bubbles:true,cancelable:true,composed:true,clientX:p.x,clientY:p.y});
          document.dispatchEvent(ev);
        }catch(e){}
      }
    }finally{window.__handPinchSynthetic=false;}
  };
  const startPinch=()=>{
    cancelMomentum();
    const ids=[...pointers.keys()];
    const a=pointers.get(ids[0]),b=pointers.get(ids[1]);
    if(!a||!b)return;
    cancelExternalGestures();
    mode='pinch';
    window.__handPinchActive=true;
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
    next=Math.max(SPACING_MIN,Math.min(SPACING_MAX,next));
    if(next===manualSpacing)return;
    manualSpacing=next;
    cachedCap=null;
    applySpacing(next);
    applyOffset(clampOffset(offset));
  };
  // ── Slide helpers (single-pointer, swipe zone only) ──
  const startSlideMode=ev=>{
    cancelMomentum();
    mode='slide';
    startX=ev.clientX;startOffset=offset;
    samples.length=0;pushSample(performance.now(),offset);
    const z=zoneEl();if(z){z.classList.add('dragging');z.classList.remove('pinching');}
    handEl()?.classList.add('hand-scroll-dragging');
    if(!window.__handHasBeenSwiped){
      window.__handHasBeenSwiped=true;
      try{localStorage.setItem('tlr_hand_swiped','1');}catch(e){}
      const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}
    }
  };
  const stepSlide=ev=>{
    const dx=ev.clientX-startX;
    const target=softClamp(startOffset+dx*DEG_PER_PX_SWIPE);
    applyOffset(target);
    pushSample(performance.now(),target);
  };
  const endGesture=()=>{
    const wasSlide=(mode==='slide'),wasPinch=(mode==='pinch');
    if(moveRaf!=null){cancelAnimationFrame(moveRaf);moveRaf=null;pendingMoveEv=null;}
    const z=zoneEl();if(z){z.classList.remove('dragging','pinching');}
    handEl()?.classList.remove('hand-scroll-dragging');
    if(wasPinch)window.__handPinchActive=false;
    mode=null;pinchStart=null;
    if(wasSlide){runMomentum(releaseVel());springBack();}
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
    if(window.__handPinchSynthetic)return;
    if(!inHandArea(ev.target))return;
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(pointers.size>=2){
      if(mode!=='pinch')startPinch();
      return;
    }
    // Single-finger slide only kicks in inside the swipe strip; on the cards
    // themselves we leave the existing card-press / drag-select handler alone.
    if(inSwipeZone(ev.target)&&mode==null){
      try{zoneEl()?.setPointerCapture(ev.pointerId);}catch(e){}
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
    if(window.__handPinchSynthetic)return;
    if(!pointers.has(ev.pointerId))return;
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(mode!=='pinch'&&mode!=='slide')return;
    ev.preventDefault();
    pendingMoveEv=ev;
    if(moveRaf==null)moveRaf=requestAnimationFrame(flushMove);
  },{capture:true,passive:false});
  const onPointerEnd=ev=>{
    if(window.__handPinchSynthetic)return;
    if(!pointers.has(ev.pointerId))return;
    pointers.delete(ev.pointerId);
    if(pointers.size===0){endGesture();}
    else if(mode==='pinch'&&pointers.size<2){
      pinchStart=null;
      window.__handPinchActive=false;
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
          startSlideMode({clientX:rp.x});
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
    if(window.__handRenderActive||window.__handReorderActive)return;
    if(recheckRaf!=null){cancelAnimationFrame(recheckRaf);recheckRaf=null;}
    refreshLayout();
  };
  let ro=null;
  const attachObserver=()=>{
    const h=handEl();
    if(!h){requestAnimationFrame(attachObserver);return;}
    if(ro)return;
    if('ResizeObserver' in window){ro=new ResizeObserver(scheduleRecheck);ro.observe(h);ro.observe(h.parentElement);}
    new MutationObserver(onHandMutation).observe(h,{childList:true});
    refreshLayout();
    if(window.__handHasBeenSwiped){const z2=zoneEl();if(z2){z2.classList.add('has-swiped');z2.classList.remove('has-overflow');}}
  };
  // Expose a direct layout trigger so render() can call it after the loop.
  window.__handTriggerLayout=()=>{
    if(recheckRaf!=null){cancelAnimationFrame(recheckRaf);recheckRaf=null;}
    refreshLayout();
  };
  // Expose the current arc track parameters so the gesture handler can
  // map pointer X -> a fractional slot along the arc.
  window.__handGetTrackState=()=>{
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
  attachObserver();
  window.addEventListener('resize',scheduleRecheck);
})();`,
  '</script>'
);

// ── Suppress the legacy two-finger pinch-out-to-zoom handler for hand cards.
//    Our arc-track pinch handles spacing; the old handler was firing expandCard
//    on the same gesture, opening the detail view right after a pinch.
const legacyPinchOrig = `document.addEventListener('touchstart',e=>{
  if(e.touches.length!==2)return;
  const c=_cardFromTarget(e.target);
  if(!c)return;
  _pinch={dist:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),card:c};
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!_pinch||e.touches.length!==2)return;
  const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  if(d>_pinch.dist+28){expandCard(_pinch.card);_pinch=null;}
},{passive:true});`;
const legacyPinchPatched = `document.addEventListener('touchstart',e=>{
  if(e.touches.length!==2)return;
  const t=e.target instanceof Element?e.target:null;
  if(t&&t.closest('#hand,.handDock,#handSwipeZone'))return;
  const c=_cardFromTarget(e.target);
  if(!c)return;
  _pinch={dist:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),card:c};
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!_pinch||e.touches.length!==2)return;
  const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
  if(d>_pinch.dist+28){expandCard(_pinch.card);_pinch=null;}
},{passive:true});`;
replaceOne('legacy pinch-zoom skip on hand cards', legacyPinchOrig, legacyPinchPatched);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Applied mystical relic transition, mobile relic rack, and hand swipe-scroll.');
} else {
  console.log('No hand/relic UI changes needed.');
}
