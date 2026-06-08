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

// Remove legacy mobile drag-select markers if they survived a previous partial build.
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
  // touch-action:none so browsers don't pan/zoom on card touch.
  // pointer-events:none on the dragging card so bounding-rect hit-tests
  // for spread slots work without the card intercepting them.
  `#hand .card[data-uid],#spread .card[data-uid]{touch-action:none;-webkit-user-select:none;user-select:none}
.hand .card.hand-card-dragging{
  transform:translate(calc(-50% + var(--drag-x,0px)), var(--drag-y,0px)) rotate(var(--drag-rot,0deg))!important;
  transition:transform .07s cubic-bezier(.2,.85,.25,1), box-shadow .14s ease!important;
  z-index:9999!important;
  box-shadow:0 22px 52px rgba(0,0,0,.78),0 0 0 2px #d4af6a;
  pointer-events:none;
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
  // Tilt: card leans in the direction it's moving (positive = clockwise = right-lean when moving right).
  // Scale is per-pointermove-pixel; values 0.25–0.4 feel natural.
  const TILT_SCALE=0.32;
  const TILT_MAX=14;
  const TILT_LERP=0.22;
  // How far below the spread's bottom edge the card centre can be and still
  // trigger slot hit-testing (gives some slack when approaching from below).
  const SPREAD_ZONE_SLACK=48;
  // Padding applied around each slot rect for hit detection.
  const SLOT_HIT_PAD=20;

  let g=null;
  const handEl=()=>document.querySelector('.hand');
  const handCards=()=>{const h=handEl();return h?[...h.querySelectorAll(':scope > .card[data-uid]')]:[]};
  const inSelectionMode=()=>!!(state.abilitySelect||state.purgeSelect!==null||state.busy);
  const cancelHold=()=>{if(g&&g.holdTimer){clearTimeout(g.holdTimer);g.holdTimer=null;}};
  // Add uid to end of arr (no duplicates), trim to last max items.
  const queueUid=(arr,uid,max)=>{if(arr.includes(uid))return arr;const a=[...arr,uid];return a.length>max?a.slice(-max):a;};

  // ── Arc slot math: pointer X → fractional slot index along the arc ──
  const xToFracSlot=cx=>{
    const ts=typeof window.__handGetTrackState==='function'?window.__handGetTrackState():null;
    if(!ts||!ts.spacingDeg)return 0;
    const centerX=ts.handRect.left+ts.handRect.width/2;
    const dx=cx-centerX;
    const ratio=Math.max(-.95,Math.min(.95,dx/Math.max(1,ts.radius)));
    const totalA=Math.asin(ratio)*180/Math.PI;
    return (totalA-ts.offsetDeg)/ts.spacingDeg;
  };

  // ── Spread slot hit-test using bounding rects (not elementsFromPoint,
  //    which is unreliable because the dragging card is on top). ──
  const hitTestSpreadSlots=(cardCX,cardCY)=>{
    const slots=[...document.querySelectorAll('#spread .slot')];
    for(let i=0;i<slots.length;i++){
      if(state.spread[i])continue;             // occupied
      const r=slots[i].getBoundingClientRect();
      if(cardCX>=r.left-SLOT_HIT_PAD&&cardCX<=r.right+SLOT_HIT_PAD&&
         cardCY>=r.top-SLOT_HIT_PAD&&cardCY<=r.bottom+SLOT_HIT_PAD){
        return{slotEl:slots[i],idx:i};
      }
    }
    return null;
  };

  // ── Whether the card's centre is in the "spread zone" (near/above spread). ──
  const isInSpreadZone=cardCY=>{
    const sp=document.querySelector('#spread');
    if(!sp)return false;
    const r=sp.getBoundingClientRect();
    return cardCY<r.bottom+SPREAD_ZONE_SLACK;
  };

  // ── Reorder hand card slots with a "parting" gap at hoverIndex. ──
  const applyReorderSlots=hoverIndex=>{
    if(!g)return;
    const cards=handCards();
    const n=cards.length;
    if(!n)return;
    cards.forEach((el,i)=>{
      let ni=i;
      if(el===g.cardEl){
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

  // ── Restore hand cards to their natural positions (no parting). ──
  const applyNaturalSlots=()=>{
    const cards=handCards();
    const n=cards.length;
    cards.forEach((el,i)=>el.style.setProperty('--slot',(i-(n-1)/2).toString()));
    if(g)g.hoverIndex=g.origIndex;
  };

  // ── Transition pending → select-drag (ability/purge multi-target sweep) ──
  const startSelectDrag=ev=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    g.mode='select-drag';
    g.pendingUids=[];
    try{g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    window.__handGestureSuppressClickUntil=performance.now()+800;
    stepSelectDrag(ev);
  };

  // ── Track cards swept over during ability/purge drag ──
  const stepSelectDrag=ev=>{
    if(!g||g.mode!=='select-drag')return;
    const els=document.elementsFromPoint(ev.clientX,ev.clientY);
    for(const el of els){
      if(!(el instanceof Element))continue;
      const cardEl=el.closest('#hand .card[data-uid]');
      if(!cardEl)continue;
      const uid=Number(cardEl.dataset.uid);
      if(!Number.isFinite(uid))break;
      if(state.abilitySelect){
        if(!state.abilitySelect.validIds.has(uid))break;
        g.pendingUids=queueUid(g.pendingUids,uid,state.abilitySelect.count);
      }else if(state.purgeSelect!==null){
        g.pendingUids=queueUid(g.pendingUids,uid,3);
      }
      break;
    }
  };

  // ── Transition pending → drag ──
  const startDrag=ev=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    // Capture card centre and finger-to-centre offset at grab time.
    const rect=g.cardEl.getBoundingClientRect();
    g.grabOffsetX=ev.clientX-(rect.left+rect.width/2);
    g.grabOffsetY=ev.clientY-(rect.top+rect.height/2);
    const h=handEl();
    const hRect=h?h.getBoundingClientRect():{left:0,top:0,width:window.innerWidth,height:200};
    g.handCenterX=hRect.left+hRect.width/2;
    g.handTop=hRect.top;
    g.cardHalfH=rect.height/2;
    g.prevX=ev.clientX;
    g.tiltDeg=0;
    g.mode='drag';
    window.__handReorderActive=true;
    if(h)h.classList.add('hand-parting');
    g.cardEl.classList.add('hand-card-dragging');
    try{g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    window.__handGestureSuppressClickUntil=performance.now()+800;
    stepDrag(ev);
  };

  // ── Core drag update — called on every pointermove while in drag mode ──
  const stepDrag=ev=>{
    if(!g||g.mode!=='drag')return;
    const x=ev.clientX,y=ev.clientY;

    // Tilt: card leans in the direction of movement.
    const deltaX=x-g.prevX;
    const targetTilt=Math.max(-TILT_MAX,Math.min(TILT_MAX,deltaX*TILT_SCALE));
    g.tiltDeg+=(targetTilt-g.tiltDeg)*TILT_LERP;
    g.prevX=x;

    // Compute drag-to-hand-relative offsets.
    // dx: how far the card centre should sit from the hand's horizontal centre.
    // dy: how far the card top should be from the hand div's top edge.
    const dx=(x-g.grabOffsetX)-g.handCenterX;
    const dy=(y-g.grabOffsetY)-(g.handTop+g.cardHalfH);

    g.cardEl.style.setProperty('--drag-x',dx.toFixed(1)+'px');
    g.cardEl.style.setProperty('--drag-y',dy.toFixed(1)+'px');
    g.cardEl.style.setProperty('--drag-rot',g.tiltDeg.toFixed(2)+'deg');

    // Card centre in viewport (needed for spread zone and slot hit-test).
    const cardCX=g.handCenterX+dx;
    const cardCY=g.handTop+dy+g.cardHalfH;

    // ── Drop-target logic ──────────────────────────────────────────
    if(isInSpreadZone(cardCY)){
      // Near or above spread: hit-test empty slots by expanded bounding rect.
      // Also: restore hand to natural order so it doesn't thrash while aimed up.
      const hit=hitTestSpreadSlots(cardCX,cardCY);
      document.querySelectorAll('#spread .slot.drop-target').forEach(s=>s.classList.remove('drop-target'));
      if(hit){hit.slotEl.classList.add('drop-target');}
      g.dropSlot=hit||null;
      // Stop parting when aimed at spread.
      if(g.hoverIndex!==g.origIndex)applyNaturalSlots();
    }else{
      // In the hand zone: apply parting around the landing position.
      document.querySelectorAll('#spread .slot.drop-target').forEach(s=>s.classList.remove('drop-target'));
      g.dropSlot=null;
      const cards=handCards();
      const n=cards.length;
      const frac=xToFracSlot(x);
      const hover=Math.max(0,Math.min(n-1,Math.round(frac+(n-1)/2)));
      if(hover!==g.hoverIndex)applyReorderSlots(hover);
    }
  };

  // ── Commit or cancel a drag ──
  const endDrag=committed=>{
    if(!g)return;
    cancelHold();
    const{uid,cardEl,origIndex,hoverIndex,dropSlot,mode,pendingUids=[]}=g;
    const wasDrag=mode==='drag';
    const wasSelectDrag=mode==='select-drag';
    try{cardEl.releasePointerCapture(g.pointerId);}catch(e){}
    cardEl.classList.remove('hand-card-dragging');
    cardEl.style.removeProperty('--drag-x');
    cardEl.style.removeProperty('--drag-y');
    cardEl.style.removeProperty('--drag-rot');
    document.querySelectorAll('#spread .slot.drop-target').forEach(s=>s.classList.remove('drop-target'));
    const h=handEl();if(h)h.classList.remove('hand-parting');
    window.__handReorderActive=false;
    g=null;

    // ── Commit ability/purge selection from sweep ──
    if(wasSelectDrag){
      if(!committed)return;
      if(state.abilitySelect&&pendingUids.length){
        state.abilitySelect.picked=pendingUids.slice(-state.abilitySelect.count);
        if(typeof refreshHandState==='function')refreshHandState();
      }else if(state.purgeSelect!==null&&pendingUids.length){
        state.purgeSelect=pendingUids.slice(0,3);
        if(typeof render==='function')render();
      }
      return;
    }

    if(!wasDrag){
      // Tap (pointerdown + pointerup without crossing drag threshold):
      // let the card's onclick fire normally.
      if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
      return;
    }

    if(!committed){
      // pointercancel (e.g. pinch started) — snap back to original positions.
      if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
      return;
    }

    // ── Drop onto spread slot ──
    if(dropSlot){
      state.selected=uid;
      if(typeof placeCard==='function')placeCard(dropSlot.idx);
      return;
    }

    // ── Reorder within hand ──
    if(hoverIndex!==origIndex){
      const idx=state.hand.findIndex(c=>c.uid===uid);
      if(idx>=0){
        const card=state.hand.splice(idx,1)[0];
        state.hand.splice(hoverIndex,0,card);
        if(typeof render==='function')render();
        return;
      }
    }

    // Dropped back to original position — just re-layout.
    if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
  };

  // ── Pointer event handlers ──────────────────────────────────────

  document.addEventListener('pointerdown',ev=>{
    if(window.__handPinchSynthetic)return;
    const t=ev.target instanceof Element?ev.target:null;
    if(!t||t.closest('#spread'))return;
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
      prevX:ev.clientX,
      tiltDeg:0,
    };
    // Hold-to-expand: 400ms press opens detail view (normal mode only).
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
      // busy: drop pointer tracking entirely.
      if(state.busy){cancelHold();g=null;return;}
      // ability/purge: sweep-to-select mode.
      if(state.abilitySelect||state.purgeSelect!==null){startSelectDrag(ev);return;}
      // normal: card drag-to-reorder / drag-to-place.
      startDrag(ev);
      return;
    }
    if(g.mode==='drag'){ev.preventDefault();stepDrag(ev);}
    if(g.mode==='select-drag'){stepSelectDrag(ev);}
  },{capture:true,passive:false});

  const onEnd=ev=>{
    if(!g||ev.pointerId!==g.pointerId)return;
    if(g.mode==='pending'){cancelHold();g=null;return;}
    endDrag(ev.type!=='pointercancel');
  };
  document.addEventListener('pointerup',onEnd,true);
  document.addEventListener('pointercancel',onEnd,true);

  // Suppress the synthetic click that fires after drag or hold-to-expand.
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
