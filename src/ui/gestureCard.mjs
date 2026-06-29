// Hand card gesture controller (Step 4). Verbatim port target from the
// legacy inline hand card gestures handler patch.
/* global state, refreshHandState, expandCard, render, placeCard */
import { abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';

export function installHandCardGestures(target = window){
  if(!target || target.__handCardGesturesInstalled)return;
  target.__handCardGesturesInstalled=true;

  const HOLD_MS=400;
  const DRAG_THRESHOLD=10;
  // Tilt: card leans in the direction it's moving (positive = clockwise = right-lean when moving right).
  // Scale is per-pointermove-pixel; values 0.25–0.4 feel natural.
  const TILT_SCALE=0.32;
  const TILT_MAX=14;
  const TILT_LERP=0.22;
  // How far below the spread's bottom edge the card centre can be and still
  // trigger slot hit-testing (gives some slack when approaching from below).
  const SPREAD_ZONE_SLACK=72;
  // Padding applied around each slot rect for hit detection.
  const SLOT_HIT_PAD=28;
  // How far down from drag-start (in px) before the card enters detail-view zone.
  const DETAIL_DRAG_DOWN_PX=80;

  let g=null;
  const handEl=()=>document.querySelector('.hand');
  const handCards=()=>{const h=handEl();return h?[...h.querySelectorAll(':scope > .card[data-uid]')]:[]};
  const storeState=()=>target.tlrStore?.getState?.()??null;
  const gestureTargeting=()=>{const s=storeState();return s?selectAbilityTargetView(s):state.abilitySelect;};
  const inSelectionMode=()=>!!(gestureTargeting()||(storeState()?.run?.purge??state.purgeSelect)!==null||(storeState()?.run?.busy??state.busy));
  const cancelHold=()=>{if(g&&g.holdTimer){clearTimeout(g.holdTimer);g.holdTimer=null;}};
  // Add uid to end of arr (no duplicates), trim to last max items.
  const queueUid=(arr,uid,max)=>{if(arr.includes(uid))return arr;const a=[...arr,uid];return a.length>max?a.slice(-max):a;};

  // ── Arc slot math: pointer X → fractional slot index along the arc ──
  const xToFracSlot=cx=>{
    const ts=typeof target.__handGetTrackState==='function'?target.__handGetTrackState():null;
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
      // Occupied check: `state.spread` is authoritative in singleplayer, but in
      // multiplayer the piles live in match state, so also treat any slot whose
      // DOM already holds a card as occupied (never a valid drop target).
      if(state.spread[idx]||el.querySelector('.card'))continue;
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
    // When the dragged card has been moved to document.body it is no longer
    // in the hand DOM, so handCards() returns n-1 cards. We must account for
    // that missing slot when computing centre offsets and recovering each
    // remaining card's original hand position.
    const inHand=cards.includes(g.cardEl);
    const total=inHand?n:n+1;
    cards.forEach((el,i)=>{
      let ni;
      if(el===g.cardEl){
        ni=hoverIndex;
      }else{
        // Recover the card's original hand index. When the dragged card is on
        // body, every card after origIndex shifted down by one in the DOM.
        const orig=inHand?i:(i<g.origIndex?i:i+1);
        if(orig<g.origIndex){
          ni=orig>=hoverIndex?orig+1:orig;
        }else{
          ni=orig<=hoverIndex?orig-1:orig;
        }
      }
      el.style.setProperty('--slot',(ni-(total-1)/2).toString());
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

  const restoreCardToHand=()=>{
    if(!g||!g.cardEl||!g.originalParent)return;
    const cardEl=g.cardEl;
    if(cardEl.parentNode===g.originalParent)return;
    cardEl.style.removeProperty('position');
    cardEl.style.removeProperty('left');
    cardEl.style.removeProperty('top');
    cardEl.style.removeProperty('width');
    cardEl.style.removeProperty('height');
    cardEl.style.removeProperty('margin');
    cardEl.style.removeProperty('z-index');
    if(g.originalNextSibling&&g.originalNextSibling.parentNode===g.originalParent){
      g.originalParent.insertBefore(cardEl,g.originalNextSibling);
    }else{
      g.originalParent.appendChild(cardEl);
    }
  };

  // ── Transition pending → select-drag (ability/purge multi-target sweep) ──
  const startSelectDrag=ev=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    g.mode='select-drag';
    g.pendingUids=[];
    try{g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    target.__handGestureSuppressClickUntil=performance.now()+800;
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
      const _t=gestureTargeting();
      if(_t){
        if(!_t.validIds.has(uid))break;
        g.pendingUids=queueUid(g.pendingUids,uid,_t.count);
      }else if((storeState()?.run?.purge??state.purgeSelect)!==null){
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
    // Capture card offset from pointer to card top-left at grab time.
    const rect=g.cardEl.getBoundingClientRect();
    g.grabOffsetX=ev.clientX-rect.left;
    g.grabOffsetY=ev.clientY-rect.top;
    const h=handEl();
    const hRect=h?h.getBoundingClientRect():{left:0,top:0,width:target.innerWidth,height:200};
    g.handCenterX=hRect.left+hRect.width/2;
    g.handTop=hRect.top;
    g.cardHalfW=rect.width/2;
    g.cardHalfH=rect.height/2;
    g.prevX=ev.clientX;
    g.tiltDeg=0;
    g.inDetailZone=false;
    g.mode='drag';
    // Cache spread geometry so hit-tests during drag don't force layout recalc.
    const spEl=document.querySelector('#spread');
    g.spreadRect=spEl?spEl.getBoundingClientRect():null;
    g.slotRects=[...document.querySelectorAll('#spread .slot')].map((el,i)=>({el,idx:i,r:el.getBoundingClientRect()}));
    target.__handReorderActive=true;
    if(h)h.classList.add('hand-parting');
    const spEl2=document.querySelector('#spread');if(spEl2)spEl2.classList.add('drag-active');
    g.cardEl.classList.add('hand-card-dragging');
    g.cardRect = rect;
    g.dragOriginLeft = rect.left;
    g.dragOriginTop = rect.top;
    if (g.cardEl.parentNode !== document.body) document.body.appendChild(g.cardEl);
    g.cardEl.style.setProperty('position','fixed','important');
    g.cardEl.style.setProperty('left', `${rect.left}px`, 'important');
    g.cardEl.style.setProperty('top', `${rect.top}px`, 'important');
    g.cardEl.style.setProperty('width', `${rect.width}px`, 'important');
    g.cardEl.style.setProperty('height', `${rect.height}px`, 'important');
    g.cardEl.style.setProperty('margin', '0', 'important');
    g.cardEl.style.setProperty('z-index', '100000', 'important');
    try{g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    target.__handGestureSuppressClickUntil=performance.now()+800;
    stepDrag(ev);
  };

  // ── Slot highlight geometry — pure math, no DOM writes.
  //    Returns {inSpread, hit, hover} for the rAF to apply.
  const calcDropTarget=(x,y)=>{
    const cardLeft=x-g.grabOffsetX;
    const cardTop=y-g.grabOffsetY;
    const cardCX=cardLeft+g.cardHalfW;
    const cardCY=cardTop+g.cardHalfH;
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
      const cardLeft = x - g.grabOffsetX;
      const cardTop = y - g.grabOffsetY;
      const moveX = cardLeft - g.dragOriginLeft;
      const moveY = cardTop - g.dragOriginTop;
      g.cardEl.style.setProperty('transform','translate('+moveX.toFixed(1)+'px,'+moveY.toFixed(1)+'px) rotate('+g.tiltDeg.toFixed(2)+'deg)','important');

      // Drag-down-to-detail: highlight when card is pulled below its start point.
      const cardCY=cardTop+g.cardHalfH;
      const nowDetail=(y-g.startY)>DETAIL_DRAG_DOWN_PX&&!isInSpreadZone(cardCY);
      if(nowDetail!==g.inDetailZone){g.inDetailZone=nowDetail;g.cardEl.classList.toggle('hand-card-detail-pull',nowDetail);}
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
    const{uid,cardEl,origIndex,hoverIndex,mode,pendingUids=[],inDetailZone=false,originalParent,originalNextSibling}=g;
    let dropSlot=g.dropSlot;
    const wasDrag=mode==='drag';
    const wasSelectDrag=mode==='select-drag';
    // Capture visual drag position before removing drag state (used for FLIP slide).
    const firstRect=wasDrag?cardEl.getBoundingClientRect():null;
    // If pointerup lands before the queued drag rAF runs, the cached drop target
    // can be stale. Recompute synchronously from the last pointer position before
    // cancelling that frame so quick releases over a spread slot still place.
    if(wasDrag&&committed&&g.lastDragEv){
      const last=calcDropTarget(g.lastDragEv.clientX,g.lastDragEv.clientY);
      if(last.inSpread)dropSlot=last.hit||null;
    }
    // Cancel any queued rAF frame so it doesn't fire after cleanup.
    if(g.dragRafId){cancelAnimationFrame(g.dragRafId);g.dragRafId=null;}
    try{cardEl.releasePointerCapture(g.pointerId);}catch(e){}
    cardEl.classList.remove('hand-card-dragging');
    cardEl.classList.remove('hand-card-detail-pull');
    cardEl.style.removeProperty('transform');
    cardEl.style.removeProperty('position');
    cardEl.style.removeProperty('left');
    cardEl.style.removeProperty('top');
    cardEl.style.removeProperty('width');
    cardEl.style.removeProperty('height');
    cardEl.style.removeProperty('margin');
    cardEl.style.removeProperty('z-index');
    if(g.dropSlot)g.dropSlot.slotEl.classList.remove('drop-target');
    const h=handEl();if(h)h.classList.remove('hand-parting');
    const spEl3=document.querySelector('#spread');if(spEl3)spEl3.classList.remove('drag-active');
    target.__handReorderActive=false;
    g=null;

    // ── Drag-down → open card detail view ──
    if(wasDrag&&committed&&inDetailZone){
      // Return card to its original hand slot immediately (before the modal opens).
      if(cardEl.parentNode!==originalParent){
        if(originalNextSibling&&originalNextSibling.parentNode===originalParent){
          originalParent.insertBefore(cardEl,originalNextSibling);
        }else{
          originalParent.appendChild(cardEl);
        }
      }
      applyNaturalSlots();
      slideLanding(cardEl,firstRect);
      const s=storeState();
      const hand=[...((s?.run?.hand)||state?.hand||[])];
      const card=hand.find(c=>c.uid===uid)||null;
      if(card){
        const showDetail=typeof target.expandCard==='function'?target.expandCard:(typeof expandCard==='function'?expandCard:null);
        if(showDetail)showDetail(card,target);
      }
      target.__handGestureSuppressClickUntil=performance.now()+800;
      return;
    }

    // ── Commit ability/purge selection from sweep ──
    if(wasSelectDrag){
      if(!committed)return;
      const _t=gestureTargeting();
      if(_t&&pendingUids.length){
        const s=storeState();
        if(s&&target.tlrStore){
          target.tlrStore.dispatch({type:'SET_ABILITY_PICKS',cardIds:pendingUids});
        }else if(state.abilitySelect){
          state.abilitySelect.picked=pendingUids.slice(-_t.count);
        }
        if(typeof refreshHandState==='function')refreshHandState();
      }else if((storeState()?.run?.purge??state.purgeSelect)!==null&&pendingUids.length){
        const s=storeState();
        if(s&&target.tlrStore){
          target.tlrStore.dispatch({type:'SET_PURGE_PICKS',cardIds:pendingUids});
          state.purgeSelect=target.tlrStore.getState().run.purge?.slice()??null;
        }else{
          state.purgeSelect=pendingUids.slice(0,3);
        }
        if(typeof render==='function')render();
      }
      return;
    }

    if(!wasDrag){
      // Tap (pointerdown + pointerup without crossing drag threshold):
      // let the card's onclick fire normally.
      if(typeof target.__handTriggerLayout==='function')target.__handTriggerLayout();
      return;
    }

    if(!committed){
      // pointercancel (e.g. pinch started) — let CSS transition settle naturally.
      if(typeof target.__handTriggerLayout==='function')target.__handTriggerLayout();
      return;
    }

    // ── Drop onto spread slot ──
    if(dropSlot){
      if(typeof target.placeCardUid==='function')target.placeCardUid(uid,dropSlot.idx);
      return;
    }

    // ── Reorder within hand ──
    if(hoverIndex!==origIndex){
      const s=storeState();
      if(s&&target.tlrStore){
        target.tlrStore.dispatch({type:'REORDER_HAND',uid,toIndex:hoverIndex});
        // Sync legacy hand from store so syncStoreBeforeView in render() doesn't overwrite.
        state.hand=target.tlrStore.getState().run.hand.slice();
        if(state.selected===uid)state.selected=null;
        if(typeof render==='function')render();
        return;
      }
      const idx=state.hand.findIndex(c=>c.uid===uid);
      if(idx>=0){
        const card=state.hand.splice(idx,1)[0];
        state.hand.splice(hoverIndex,0,card);
        if(state.selected===uid){state.selected=null;}
        if(typeof render==='function')render();
        return;
      }
    }

    // Dropped back to original position — let CSS transition settle naturally.
    if(state.selected===uid){state.selected=null;if(typeof refreshHandState==='function')refreshHandState();}
    if(typeof target.__handTriggerLayout==='function')target.__handTriggerLayout();
  };

  // ── Pointer event handlers ──────────────────────────────────────

  document.addEventListener('pointerdown',ev=>{
    if(target.__handPinchSynthetic||target.__handPinchActive)return;
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
      originalParent:cardEl.parentNode,
      originalNextSibling:cardEl.nextSibling,
    };
  },true);

  document.addEventListener('pointermove',ev=>{
    if(!g||ev.pointerId!==g.pointerId)return;
    if(g.mode==='pending'){
      const dx=ev.clientX-g.startX,dy=ev.clientY-g.startY;
      if(Math.hypot(dx,dy)<DRAG_THRESHOLD)return;
      // busy: drop pointer tracking entirely.
      if(storeState()?.run?.busy??state.busy){cancelHold();g=null;return;}
      // ability/purge: sweep-to-select mode.
      if(gestureTargeting()||(storeState()?.run?.purge??state.purgeSelect)!==null){startSelectDrag(ev);return;}
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
    const until=target.__handGestureSuppressClickUntil||0;
    if(performance.now()>until)return;
    const t=ev.target instanceof Element?ev.target:null;
    if(t&&t.closest('#hand .card[data-uid]')){
      ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    }
  },true);

  // Cancel an in-progress card drag and return the card to its original hand
  // slot with a FLIP slide animation. No-ops when no drag is active.
  target.tlrCancelHandDrag=function(){
    if(!g||g.mode!=='drag')return false;
    const{cardEl,originalParent,originalNextSibling}=g;
    const firstRect=cardEl.getBoundingClientRect();
    endDrag(false);
    if(originalParent&&cardEl.parentNode!==originalParent){
      if(originalNextSibling&&originalNextSibling.parentNode===originalParent){
        originalParent.insertBefore(cardEl,originalNextSibling);
      }else{
        originalParent.appendChild(cardEl);
      }
    }
    applyNaturalSlots();
    slideLanding(cardEl,firstRect);
    return true;
  };
}
