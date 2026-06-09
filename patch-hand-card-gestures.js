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
.hand .card.hand-card-landing{
  transition:transform .3s cubic-bezier(.15,.85,.25,1)!important;
}
.hand.hand-parting .card:not(.hand-card-dragging){
  transition:transform .22s cubic-bezier(.2,.85,.25,1)!important;
}
#spread .slot.drop-target{background:rgba(98,170,104,.28)!important;border-color:#79c778!important;box-shadow:0 0 0 2px rgba(121,199,120,.55),0 0 32px rgba(121,199,120,.45)!important}
#spread.drag-active .slot{transition:none!important;will-change:transform}`
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

  // ── Spread slot hit-test using cached bounding rects (cached at drag start
  //    to avoid forced layout on every pointermove). ──
  const hitTestSpreadSlots=(cardCX,cardCY)=>{
    const rects=g&&g.slotRects?g.slotRects:
      [...document.querySelectorAll('#spread .slot')].map((el,i)=>({el,idx:i,r:el.getBoundingClientRect()}));
    for(const{el,idx,r}of rects){
      if(state.spread[idx])continue;           // occupied
      if(cardCX>=r.left-SLOT_HIT_PAD&&cardCX<=r.right+SLOT_HIT_PAD&&
         cardCY>=r.top-SLOT_HIT_PAD&&cardCY<=r.bottom+SLOT_HIT_PAD){
        return{slotEl:el,idx};
      }
    }
    return null;
  };

  // ── Whether the card's centre is in the "spread zone" (near/above spread). ──
  const isInSpreadZone=cardCY=>{
    if(g&&g.spreadRect)return cardCY<g.spreadRect.bottom+SPREAD_ZONE_SLACK;
    const sp=document.querySelector('#spread');
    if(!sp)return false;
    return cardCY<sp.getBoundingClientRect().bottom+SPREAD_ZONE_SLACK;
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
    // If another card was selected, deselect it so it drops back into the hand.
    if(state.selected&&state.selected!==g.uid){
      state.selected=null;
      if(typeof refreshHandState==='function')refreshHandState();
    }
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
    // Cache spread geometry so hit-tests during drag don't force layout recalc.
    const spEl=document.querySelector('#spread');
    g.spreadRect=spEl?spEl.getBoundingClientRect():null;
    g.slotRects=[...document.querySelectorAll('#spread .slot')].map((el,i)=>({el,idx:i,r:el.getBoundingClientRect()}));
    window.__handReorderActive=true;
    if(h)h.classList.add('hand-parting');
    const spEl2=document.querySelector('#spread');if(spEl2)spEl2.classList.add('drag-active');
    g.cardEl.classList.add('hand-card-dragging');
    try{g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    window.__handGestureSuppressClickUntil=performance.now()+800;
    stepDrag(ev);
  };

  // ── Slot highlight geometry — pure math, no DOM writes.
  //    Returns {inSpread, hit, hover} for the rAF to apply.
  const calcDropTarget=(x,y)=>{
    const dx=(x-g.grabOffsetX)-g.handCenterX;
    const dy=(y-g.grabOffsetY)-(g.handTop+g.cardHalfH);
    const cardCX=g.handCenterX+dx;
    const cardCY=g.handTop+dy+g.cardHalfH;
    if(isInSpreadZone(cardCY)){
      return{inSpread:true,hit:hitTestSpreadSlots(cardCX,cardCY)};
    }else{
      const cards=handCards();
      const n=cards.length;
      const frac=xToFracSlot(x);
      const hover=Math.max(0,Math.min(n-1,Math.round(frac+(n-1)/2)));
      return{inSpread:false,hover};
    }
  };

  // ── Card transform + slot highlight — all DOM writes batched in one rAF ──
  const stepDrag=ev=>{
    if(!g||g.mode!=='drag')return;
    g.lastDragEv=ev;
    if(g.dragRafId)return;
    g.dragRafId=requestAnimationFrame(()=>{
      g.dragRafId=null;
      if(!g||g.mode!=='drag')return;
      const ev2=g.lastDragEv;
      const x=ev2.clientX,y=ev2.clientY;

      // Apply slot highlight (DOM writes batched here, not in pointermove).
      const{inSpread,hit,hover}=calcDropTarget(x,y);
      if(inSpread){
        const newIdx=hit?hit.idx:-1;
        const oldIdx=g.dropSlot?g.dropSlot.idx:-1;
        if(newIdx!==oldIdx){
          if(g.dropSlot)g.dropSlot.slotEl.classList.remove('drop-target');
          if(hit)hit.slotEl.classList.add('drop-target');
          g.dropSlot=hit||null;
        }
        if(g.hoverIndex!==g.origIndex)applyNaturalSlots();
      }else{
        if(g.dropSlot){g.dropSlot.slotEl.classList.remove('drop-target');g.dropSlot=null;}
        if(hover!==g.hoverIndex)applyReorderSlots(hover);
      }

      // Card position / tilt.
      const deltaX=x-g.prevX;
      const targetTilt=Math.max(-TILT_MAX,Math.min(TILT_MAX,deltaX*TILT_SCALE));
      g.tiltDeg+=(targetTilt-g.tiltDeg)*TILT_LERP;
      g.prevX=x;
      const dx=(x-g.grabOffsetX)-g.handCenterX;
      const dy=(y-g.grabOffsetY)-(g.handTop+g.cardHalfH);
      g.cardEl.style.setProperty('transform','translate(calc(-50% + '+dx.toFixed(1)+'px),'+dy.toFixed(1)+'px) rotate('+g.tiltDeg.toFixed(2)+'deg)','important');
    });
  };

  // ── FLIP slide: pin card at its drag position then animate it home ──
  // The inversion (setting the offset transform) happens synchronously in the
  // same event-handler tick as endDrag, BEFORE the browser paints, so the user
  // never sees the one-frame snap.  Only the "play" step (releasing the pin)
  // goes into requestAnimationFrame so the browser transition fires cleanly.
  const slideLanding=(cardEl,firstRect)=>{
    if(!firstRect)return;
    // Measure final resting position (forces synchronous layout).
    const finalRect=cardEl.getBoundingClientRect();
    const dx=firstRect.left-finalRect.left;
    const dy=firstRect.top-finalRect.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
    // Invert: pin card at drag position with no transition.
    // .hand .card uses transform:…!important so we must match priority.
    cardEl.style.setProperty('transition','none','important');
    cardEl.style.setProperty('transform','translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)','important');
    // Commit this as the CSS "from" value before the next style change.
    void cardEl.offsetWidth;
    // Play: next rAF fires before the first paint — release the pin so the
    // landing transition pulls the card to its natural resting position.
    requestAnimationFrame(()=>{
      cardEl.classList.add('hand-card-landing');
      cardEl.style.removeProperty('transition');
      cardEl.style.removeProperty('transform');
      setTimeout(()=>cardEl.classList.remove('hand-card-landing'),320);
    });
  };

  // ── Commit or cancel a drag ──
  const endDrag=committed=>{
    if(!g)return;
    cancelHold();
    const{uid,cardEl,origIndex,hoverIndex,dropSlot,mode,pendingUids=[]}=g;
    const wasDrag=mode==='drag';
    const wasSelectDrag=mode==='select-drag';
    // Capture visual drag position before removing drag state (used for FLIP slide).
    const firstRect=wasDrag?cardEl.getBoundingClientRect():null;
    // Cancel any queued rAF frame so it doesn't fire after cleanup.
    if(g.dragRafId){cancelAnimationFrame(g.dragRafId);g.dragRafId=null;}
    try{cardEl.releasePointerCapture(g.pointerId);}catch(e){}
    cardEl.classList.remove('hand-card-dragging');
    cardEl.style.removeProperty('transform');
    if(dropSlot)dropSlot.slotEl.classList.remove('drop-target');
    const h=handEl();if(h)h.classList.remove('hand-parting');
    const spEl3=document.querySelector('#spread');if(spEl3)spEl3.classList.remove('drag-active');
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
      // pointercancel (e.g. pinch started) — slide back to original position.
      if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
      slideLanding(cardEl,firstRect);
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
        if(state.selected===uid){state.selected=null;}
        if(typeof render==='function')render();
        slideLanding(cardEl,firstRect);
        return;
      }
    }

    // Dropped back to original position — slide home. Clear selection so slots don't stay green.
    if(state.selected===uid){state.selected=null;if(typeof refreshHandState==='function')refreshHandState();}
    if(typeof window.__handTriggerLayout==='function')window.__handTriggerLayout();
    slideLanding(cardEl,firstRect);
  };

  // ── Pointer event handlers ──────────────────────────────────────

  document.addEventListener('pointerdown',ev=>{
    if(window.__handPinchSynthetic||window.__handPinchActive)return;
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
      dragRafId:null,
      lastDragEv:null,
    };
    // Hold-to-expand: 400ms press selects the card and opens detail view (normal mode only).
    if(!inSelectionMode()){
      g.holdTimer=setTimeout(()=>{
        if(!g||g.mode!=='pending')return;
        const card=state.hand.find(c=>c.uid===uid);
        g=null;
        if(card&&typeof expandCard==='function'){
          window.__handGestureSuppressClickUntil=performance.now()+800;
          state.selected=uid;
          if(typeof refreshHandState==='function')refreshHandState();
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
    if(g.mode==='drag'){ev.preventDefault();stepDrag(ev);return;}
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
