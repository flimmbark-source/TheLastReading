const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeBlock(label, markerStart, markerEnd) {
  const re = new RegExp(escapeRe(markerStart) + '[\\s\\S]*?' + escapeRe(markerEnd) + '\\n?');
  if (re.test(html)) {
    html = html.replace(re, '');
    changed = true;
    console.log(`Removed legacy ${label}.`);
  }
}

function upsertStyle(label, markerStart, markerEnd, css) {
  const block = `${markerStart}\n${css}\n${markerEnd}`;
  const re = new RegExp(escapeRe(markerStart) + '[\\s\\S]*?' + escapeRe(markerEnd));
  if (re.test(html)) {
    html = html.replace(re, block);
    changed = true;
    console.log(`Refreshed ${label}.`);
    return;
  }
  const styleEnd = html.indexOf('</style>');
  if (styleEnd < 0) throw new Error(`Could not insert ${label}; </style> not found.`);
  html = html.slice(0, styleEnd) + block + '\n' + html.slice(styleEnd);
  changed = true;
  console.log(`Inserted ${label}.`);
}

function upsertScript(label, markerStart, markerEnd, script) {
  const block = `${markerStart}\n${script}\n${markerEnd}`;
  const re = new RegExp(escapeRe(markerStart) + '[\\s\\S]*?' + escapeRe(markerEnd));
  if (re.test(html)) {
    html = html.replace(re, block);
    changed = true;
    console.log(`Refreshed ${label}.`);
    return;
  }
  const scriptEnd = html.lastIndexOf('</script>');
  if (scriptEnd < 0) throw new Error(`Could not insert ${label}; </script> not found.`);
  html = html.slice(0, scriptEnd) + block + '\n' + html.slice(scriptEnd);
  changed = true;
  console.log(`Inserted ${label}.`);
}

// Old drag-select behavior (multi-select highlight) is superseded by the new
// unified gesture system: tap to select, press+drag to reorder/place, hold to
// open detail. Clean out any leftover markers from prior builds.
removeBlock(
  'mobile drag-select touch handling CSS',
  '/* mobile drag-select touch patch */',
  '/* end mobile drag-select touch patch */'
);
removeBlock(
  'mobile drag-select pointer handler',
  '/* mobile drag-select pointer handler patch */',
  '/* end mobile drag-select pointer handler patch */'
);

upsertStyle(
  'hand card gestures CSS',
  '/* hand card gestures patch */',
  '/* end hand card gestures patch */',
  `#hand .card[data-uid],#spread .card[data-uid]{touch-action:none;-webkit-user-select:none;user-select:none}
.hand .card.hand-card-dragging{
  transform:translate(calc(-50% + var(--drag-x,0px)), var(--drag-y,0px)) rotate(var(--drag-rot,0deg))!important;
  transition:transform .07s linear, box-shadow .14s ease!important;
  z-index:9999!important;
  box-shadow:0 22px 52px rgba(0,0,0,.78),0 0 0 2px #d4af6a;
  cursor:grabbing;
}
.hand.hand-parting .card:not(.hand-card-dragging){
  transition:transform .22s cubic-bezier(.2,.85,.25,1)!important;
}
#spread .slot.drop-target{background:rgba(98,170,104,.28)!important;border-color:#79c778!important;box-shadow:0 0 0 2px rgba(121,199,120,.55),0 0 32px rgba(121,199,120,.45)!important}`
);

upsertScript(
  'hand card gestures handler',
  '/* hand card gestures handler patch */',
  '/* end hand card gestures handler patch */',
  `(function(){
  if(window.__handCardGesturesInstalled)return;
  window.__handCardGesturesInstalled=true;
  const HOLD_MS=400;
  const DRAG_THRESHOLD=10;
  const TILT_SCALE=-26;        // px/ms -> degrees of tilt
  const TILT_MAX=18;
  const TILT_LERP=0.28;
  let g=null;
  const handEl=()=>document.querySelector('.hand');
  const handCards=()=>{const h=handEl();return h?[...h.querySelectorAll(':scope > .card[data-uid]')]:[]};
  const inSelectionMode=()=>!!(state.abilitySelect||state.purgeSelect!==null||state.busy);
  const cancelHold=()=>{if(g&&g.holdTimer){clearTimeout(g.holdTimer);g.holdTimer=null;}};
  // Map clientX -> fractional slot index along the arc (0 = center).
  const xToFracSlot=cx=>{
    const ts=typeof window.__handGetTrackState==='function'?window.__handGetTrackState():null;
    if(!ts||!ts.spacingDeg)return 0;
    const centerX=ts.handRect.left+ts.handRect.width/2;
    const dx=cx-centerX;
    const ratio=Math.max(-.95,Math.min(.95,dx/Math.max(1,ts.radius)));
    const totalA=Math.asin(ratio)*180/Math.PI;
    return (totalA-ts.offsetDeg)/ts.spacingDeg;
  };
  const findSpreadDropAt=(x,y)=>{
    const els=document.elementsFromPoint?document.elementsFromPoint(x,y):[document.elementFromPoint(x,y)];
    for(const el of els){
      if(!(el instanceof Element))continue;
      const s=el.closest('#spread .slot');
      if(!s)continue;
      const slots=[...document.querySelectorAll('#spread .slot')];
      const idx=slots.indexOf(s);
      if(idx>=0&&!state.spread[idx])return{slotEl:s,idx};
      return null;
    }
    return null;
  };
  const applyReorderSlots=hoverIndex=>{
    if(!g)return;
    const cards=handCards();
    const n=cards.length;
    if(!n)return;
    cards.forEach((el,i)=>{
      let ni=i;
      if(el===g.cardEl){
        // Dragged card: park at hover index so neighbors stabilize there.
        ni=hoverIndex;
      }else if(i<g.origIndex){
        if(i>=hoverIndex)ni=i+1;
      }else if(i>g.origIndex){
        if(i<=hoverIndex)ni=i-1;
      }
      el.style.setProperty('--slot',(ni-(n-1)/2).toString());
    });
    g.hoverIndex=hoverIndex;
  };
  const startDrag=ev=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    const rect=g.cardEl.getBoundingClientRect();
    const cardCenterX=rect.left+rect.width/2;
    const cardCenterY=rect.top+rect.height/2;
    g.grabOffsetX=ev.clientX-cardCenterX;
    g.grabOffsetY=ev.clientY-cardCenterY;
    const h=handEl();
    const hRect=h?h.getBoundingClientRect():{left:0,top:0,width:window.innerWidth,height:200};
    g.handCenterX=hRect.left+hRect.width/2;
    g.handTop=hRect.top;
    g.cardHalfH=rect.height/2;
    g.lastFX=ev.clientX;g.lastFY=ev.clientY;g.lastT=performance.now();
    g.tiltDeg=0;
    g.mode='drag';
    window.__handReorderActive=true;
    if(h)h.classList.add('hand-parting');
    g.cardEl.classList.add('hand-card-dragging');
    try{g.cardEl.setPointerCapture&&g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    window.__handGestureSuppressClickUntil=performance.now()+800;
    stepDrag(ev);
  };
  const stepDrag=ev=>{
    if(!g||g.mode!=='drag')return;
    const x=ev.clientX,y=ev.clientY,now=performance.now();
    const dt=Math.max(8,now-g.lastT);
    const vx=(x-g.lastFX)/dt;
    const target=Math.max(-TILT_MAX,Math.min(TILT_MAX,vx*TILT_SCALE));
    g.tiltDeg+=(target-g.tiltDeg)*TILT_LERP;
    g.lastFX=x;g.lastFY=y;g.lastT=now;
    const dx=(x-g.grabOffsetX)-g.handCenterX;
    const dy=(y-g.grabOffsetY)-(g.handTop+g.cardHalfH);
    g.cardEl.style.setProperty('--drag-x',dx.toFixed(1)+'px');
    g.cardEl.style.setProperty('--drag-y',dy.toFixed(1)+'px');
    g.cardEl.style.setProperty('--drag-rot',g.tiltDeg.toFixed(2)+'deg');
    document.querySelectorAll('#spread .slot.drop-target').forEach(s=>s.classList.remove('drop-target'));
    g.dropSlot=null;
    if(!inSelectionMode()){
      const hit=findSpreadDropAt(x,y);
      if(hit){hit.slotEl.classList.add('drop-target');g.dropSlot=hit;}
    }
    if(!g.dropSlot){
      const cards=handCards();
      const n=cards.length;
      const frac=xToFracSlot(x);
      const hover=Math.max(0,Math.min(n-1,Math.round(frac+(n-1)/2)));
      if(hover!==g.hoverIndex)applyReorderSlots(hover);
    }
  };
  const endDrag=committed=>{
    if(!g)return;
    cancelHold();
    const cardEl=g.cardEl;
    const uid=g.uid;
    const origIndex=g.origIndex;
    const hoverIndex=g.hoverIndex;
    const dropSlot=g.dropSlot;
    const wasDrag=g.mode==='drag';
    try{cardEl.releasePointerCapture&&cardEl.releasePointerCapture(g.pointerId);}catch(e){}
    cardEl.classList.remove('hand-card-dragging');
    cardEl.style.removeProperty('--drag-x');
    cardEl.style.removeProperty('--drag-y');
    cardEl.style.removeProperty('--drag-rot');
    document.querySelectorAll('#spread .slot.drop-target').forEach(s=>s.classList.remove('drop-target'));
    const h=handEl();if(h)h.classList.remove('hand-parting');
    window.__handReorderActive=false;
    g=null;
    if(!wasDrag){
      if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
      return;
    }
    if(committed&&dropSlot&&!inSelectionMode()){
      state.selected=uid;
      if(typeof placeCard==='function')placeCard(dropSlot.idx);
      return;
    }
    if(committed&&hoverIndex!=null&&hoverIndex!==origIndex&&!inSelectionMode()){
      const idx=state.hand.findIndex(c=>c.uid===uid);
      if(idx>=0){
        const card=state.hand.splice(idx,1)[0];
        state.hand.splice(hoverIndex,0,card);
        if(typeof render==='function')render();
        return;
      }
    }
    if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
  };
  document.addEventListener('pointerdown',ev=>{
    if(window.__handPinchSynthetic)return;
    if(ev.pointerType!=='touch'&&ev.pointerType!=='pen'&&ev.pointerType!=='mouse')return;
    const t=ev.target instanceof Element?ev.target:null;
    if(!t)return;
    if(t.closest('#spread'))return;
    const cardEl=t.closest('#hand .card[data-uid]');
    if(!cardEl)return;
    if(g)endDrag(false);
    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid))return;
    const cards=handCards();
    const origIndex=cards.indexOf(cardEl);
    if(origIndex<0)return;
    g={
      pointerId:ev.pointerId,
      uid,cardEl,origIndex,
      mode:'pending',
      startX:ev.clientX,startY:ev.clientY,
      hoverIndex:origIndex,
      dropSlot:null,
      holdTimer:null,
    };
    // Hold-to-expand: only when not already in a selection-driven mode.
    if(!inSelectionMode()){
      g.holdTimer=setTimeout(()=>{
        if(!g||g.mode!=='pending')return;
        const card=state.hand.find(c=>c.uid===uid);
        g=null;
        if(card&&typeof expandCard==='function'){
          window.__handGestureSuppressClickUntil=performance.now()+800;
          expandCard(card);
        }
      },HOLD_MS);
    }
  },true);
  document.addEventListener('pointermove',ev=>{
    if(!g||ev.pointerId!==g.pointerId)return;
    if(g.mode==='pending'){
      const dx=ev.clientX-g.startX,dy=ev.clientY-g.startY;
      if(Math.hypot(dx,dy)<DRAG_THRESHOLD)return;
      if(inSelectionMode()){
        // No reorder in selection modes — convert to a no-op until release.
        cancelHold();
        g=null;
        return;
      }
      startDrag(ev);
      return;
    }
    if(g.mode==='drag'){
      ev.preventDefault();
      stepDrag(ev);
    }
  },{capture:true,passive:false});
  const onEnd=ev=>{
    if(!g||ev.pointerId!==g.pointerId)return;
    if(g.mode==='pending'){
      // Tap (no drag, no hold) — let the card's onclick run as usual.
      cancelHold();
      g=null;
      return;
    }
    endDrag(ev.type!=='pointercancel');
  };
  document.addEventListener('pointerup',onEnd,true);
  document.addEventListener('pointercancel',onEnd,true);
  // Suppress synthetic click after drag / long-press so it doesn't double-fire.
  document.addEventListener('click',ev=>{
    const until=window.__handGestureSuppressClickUntil||0;
    if(performance.now()>until)return;
    const t=ev.target instanceof Element?ev.target:null;
    if(t&&t.closest('#hand .card[data-uid]')){
      ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    }
  },true);
})();`
);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched hand cards with unified tap/hold/drag gesture system.');
} else {
  console.log('No hand card gesture patch changes needed.');
}
