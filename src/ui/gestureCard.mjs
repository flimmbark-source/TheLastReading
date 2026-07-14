// Hand card gesture controller (Step 4). Verbatim port target from the
// legacy inline hand card gestures handler patch.
/* global state, refreshHandState, render */
import { abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';

export function installHandCardGestures(target = window){
  if(!target || target.__handCardGesturesInstalled)return;
  target.__handCardGesturesInstalled=true;

  const DRAG_THRESHOLD=10;
  const TILT_SCALE=0.32;
  const TILT_MAX=14;
  const TILT_LERP=0.22;
  const SPREAD_ZONE_SLACK=72;
  const SLOT_HIT_PAD=28;

  // Ability flick. Recognition looks only at the final burst of motion before
  // release (velocity over the last ~100ms), so the player can carry the card
  // slowly and still flick it with a quick throw. All feedback lives on the card
  // itself: it glows the instant the throw crosses the arm threshold, then on
  // release flies off along the throw and dissolves as the ability resolves.
  const FLICK_WINDOW_MS=110;        // velocity sample window before release (80-120ms)
  const FLICK_RETAIN_MS=170;        // keep slightly more than the window
  const FLICK_MIN_DRAG_MS=70;       // minimum gesture duration to count as a flick
  const FLICK_MIN_WINDOW_MS=45;     // need this much sampled motion in the window
  const FLICK_ARM_SPEED=640;        // px/s over the window: card lights up (armed)
  const FLICK_ACTIVATE_SPEED=940;   // px/s over the window: release activates
  const FLICK_ABILITY_DELAY_MS=200; // ability begins resolving this long after release (180-250ms)

  let g=null;
  const handEl=()=>document.querySelector('.hand');
  const handCards=()=>{const h=handEl();return h?[...h.querySelectorAll(':scope > .card[data-uid]')]:[]};
  const storeState=()=>target.tlrStore?.getState?.()??null;
  const handAdapter=()=>{
    const adapter=target.tlrHandGestureAdapter;
    if(!adapter)return null;
    return typeof adapter.isActive!=='function'||adapter.isActive()?adapter:null;
  };
  const gestureTargeting=()=>{
    const adapter=handAdapter();
    if(adapter)return adapter.getTargeting?.()??null;
    const s=storeState();
    return s?selectAbilityTargetView(s):state.abilitySelect;
  };
  const purgeSelecting=()=>{
    const adapter=handAdapter();
    if(adapter)return !!adapter.isPurgeSelecting?.();
    return (storeState()?.run?.purge??state.purgeSelect)!==null;
  };
  const gestureBusy=()=>{
    const adapter=handAdapter();
    if(adapter)return !!adapter.isBusy?.();
    return !!(storeState()?.run?.busy??state.busy);
  };
  const selectedUid=()=>{
    const adapter=handAdapter();
    return adapter?.getSelected?adapter.getSelected():state.selected;
  };
  const setSelected=uid=>{
    const adapter=handAdapter();
    if(adapter?.setSelected)return adapter.setSelected(uid);
    state.selected=uid;
  };
  const refreshActiveHand=()=>{
    const adapter=handAdapter();
    if(adapter?.refreshHand)return adapter.refreshHand();
    if(typeof refreshHandState==='function')return refreshHandState();
  };
  const isSpreadSlotOccupied=idx=>{
    const adapter=handAdapter();
    if(adapter?.isSpreadSlotOccupied)return !!adapter.isSpreadSlotOccupied(idx);
    return !!state.spread[idx];
  };
  const cancelHold=()=>{if(g&&g.holdTimer){clearTimeout(g.holdTimer);g.holdTimer=null;}};
  const queueUid=(arr,uid,max)=>{if(arr.includes(uid))return arr;const a=[...arr,uid];return a.length>max?a.slice(-max):a;};

  const xToFracSlot=cx=>{
    const ts=typeof target.__handGetTrackState==='function'?target.__handGetTrackState():null;
    if(!ts||!ts.spacingDeg)return 0;
    const centerX=ts.handRect.left+ts.handRect.width/2;
    const dx=cx-centerX;
    const ratio=Math.max(-.95,Math.min(.95,dx/Math.max(1,ts.radius)));
    const totalA=Math.asin(ratio)*180/Math.PI;
    return (totalA-ts.offsetDeg)/ts.spacingDeg;
  };

  const hitTestSpreadSlots=(cardCX,cardCY)=>{
    const rects=g&&g.slotRects?g.slotRects:
      [...document.querySelectorAll('#spread .slot')].map((el,i)=>({el,idx:i,r:el.getBoundingClientRect()}));
    for(const{el,idx,r}of rects){
      if(isSpreadSlotOccupied(idx)||el.querySelector('.card'))continue;
      if(cardCX>=r.left-SLOT_HIT_PAD&&cardCX<=r.right+SLOT_HIT_PAD&&
         cardCY>=r.top-SLOT_HIT_PAD&&cardCY<=r.bottom+SLOT_HIT_PAD){
        return{slotEl:el,idx};
      }
    }
    return null;
  };

  const isInSpreadZone=cardCY=>{
    if(g&&g.spreadRect)return cardCY<g.spreadRect.bottom+SPREAD_ZONE_SLACK;
    const sp=document.querySelector('#spread');
    if(!sp)return false;
    return cardCY<sp.getBoundingClientRect().bottom+SPREAD_ZONE_SLACK;
  };

  const applyReorderSlots=hoverIndex=>{
    if(!g)return;
    const cards=handCards();
    const n=cards.length;
    if(!n)return;
    const inHand=cards.includes(g.cardEl);
    const total=inHand?n:n+1;
    cards.forEach((el,i)=>{
      let ni;
      if(el===g.cardEl){
        ni=hoverIndex;
      }else{
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

  const applyNaturalSlots=()=>{
    const cards=handCards();
    const n=cards.length;
    cards.forEach((el,i)=>el.style.setProperty('--slot',(i-(n-1)/2).toString()));
    if(g)g.hoverIndex=g.origIndex;
  };

  const startSelectDrag=ev=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    g.mode='select-drag';
    g.pendingUids=[];
    try{g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    target.__handGestureSuppressClickUntil=performance.now()+800;
    stepSelectDrag(ev);
  };

  const stepSelectDrag=ev=>{
    if(!g||g.mode!=='select-drag')return;
    const els=document.elementsFromPoint(ev.clientX,ev.clientY);
    for(const el of els){
      if(!(el instanceof Element))continue;
      const cardEl=el.closest('#hand .card[data-uid]');
      if(!cardEl)continue;
      const uid=Number(cardEl.dataset.uid);
      if(!Number.isFinite(uid))break;
      const adapter=handAdapter();
      const _t=gestureTargeting();
      if(_t){
        if(!_t.validIds.has(uid))break;
        g.pendingUids=queueUid(g.pendingUids,uid,_t.count);
      }else if(adapter?.getPurgeLimit&&purgeSelecting()){
        g.pendingUids=queueUid(g.pendingUids,uid,adapter.getPurgeLimit());
      }else if(!adapter&&purgeSelecting()){
        g.pendingUids=queueUid(g.pendingUids,uid,3);
      }
      break;
    }
  };

  const startDrag=ev=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    const selected=selectedUid();
    if(selected!=null&&selected!==g.uid){
      setSelected(null);
      refreshActiveHand();
    }
    const rect=g.cardEl.getBoundingClientRect();
    const naturalW=g.cardEl.offsetWidth;
    const naturalH=g.cardEl.offsetHeight;
    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    const fixedLeft=centerX-naturalW/2;
    const fixedTop=centerY-naturalH/2;
    g.grabOffsetX=ev.clientX-fixedLeft;
    g.grabOffsetY=ev.clientY-fixedTop;
    const h=handEl();
    const hRect=h?h.getBoundingClientRect():{left:0,top:0,width:target.innerWidth,height:200};
    g.handCenterX=hRect.left+hRect.width/2;
    g.handTop=hRect.top;
    g.cardHalfW=naturalW/2;
    g.cardHalfH=naturalH/2;
    g.prevX=ev.clientX;
    g.tiltDeg=0;
    g.dragStartTime=performance.now();
    g.mode='drag';
    const spEl=document.querySelector('#spread');
    g.spreadRect=spEl?spEl.getBoundingClientRect():null;
    g.slotRects=[...document.querySelectorAll('#spread .slot')].map((el,i)=>({el,idx:i,r:el.getBoundingClientRect()}));
    target.__handReorderActive=true;
    if(h)h.classList.add('hand-parting');
    const spEl2=document.querySelector('#spread');if(spEl2)spEl2.classList.add('drag-active');
    g.cardEl.classList.add('hand-card-dragging');
    g.dragOriginLeft=fixedLeft;
    g.dragOriginTop=fixedTop;
    if(g.cardEl.parentNode!==document.body)document.body.appendChild(g.cardEl);
    g.cardEl.style.setProperty('position','fixed','important');
    g.cardEl.style.setProperty('left',`${fixedLeft}px`,'important');
    g.cardEl.style.setProperty('top',`${fixedTop}px`,'important');
    g.cardEl.style.setProperty('width',`${naturalW}px`,'important');
    g.cardEl.style.setProperty('height',`${naturalH}px`,'important');
    g.cardEl.style.setProperty('margin','0','important');
    g.cardEl.style.setProperty('z-index','100000','important');
    try{g.cardEl.setPointerCapture(g.pointerId);}catch(e){}
    target.__handGestureSuppressClickUntil=performance.now()+800;
    stepDrag(ev);
  };

  const calcDropTarget=(x,y)=>{
    const cardLeft=x-g.grabOffsetX;
    const cardTop=y-g.grabOffsetY;
    const cardCX=cardLeft+g.cardHalfW;
    const cardCY=cardTop+g.cardHalfH;
    if(isInSpreadZone(cardCY)){
      return{inSpread:true,hit:hitTestSpreadSlots(cardCX,cardCY)};
    }
    const cards=handCards();
    const n=cards.length;
    const inHand=cards.includes(g.cardEl);
    const total=inHand?n:n+1;
    const frac=xToFracSlot(x);
    const hover=Math.max(0,Math.min(total-1,Math.round(frac+(total-1)/2)));
    return{inSpread:false,hover};
  };

  const stepDrag=ev=>{
    if(!g||g.mode!=='drag')return;
    g.lastDragEv=ev;
    if(g.dragRafId)return;
    g.dragRafId=requestAnimationFrame(()=>{
      g.dragRafId=null;
      if(!g||g.mode!=='drag')return;
      const ev2=g.lastDragEv;
      const x=ev2.clientX,y=ev2.clientY;
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
      const deltaX=x-g.prevX;
      const targetTilt=Math.max(-TILT_MAX,Math.min(TILT_MAX,deltaX*TILT_SCALE));
      g.tiltDeg+=(targetTilt-g.tiltDeg)*TILT_LERP;
      g.prevX=x;
      const cardLeft=x-g.grabOffsetX;
      const cardTop=y-g.grabOffsetY;
      const moveX=cardLeft-g.dragOriginLeft;
      const moveY=cardTop-g.dragOriginTop;
      g.cardEl.style.setProperty('transform','translate('+moveX.toFixed(1)+'px,'+moveY.toFixed(1)+'px) rotate('+g.tiltDeg.toFixed(2)+'deg)','important');
      updateFlickArming(x,y);
    });
  };

  const abilityFlickAllowed=uid=>typeof target.canDiscardCardUid==='function'&&target.canDiscardCardUid(uid);

  // Card center (screen coords) for the current pointer position, matching the
  // geometry calcDropTarget uses for its own hit-testing.
  const cardCenterFromPointer=(x,y)=>({cx:x-g.grabOffsetX+g.cardHalfW,cy:y-g.grabOffsetY+g.cardHalfH});

  // Record pointer samples so recognition can measure only the final burst of
  // motion, not the whole (possibly slow) carry.
  const recordSample=(x,y,t)=>{
    if(!g)return;
    if(!g.samples)g.samples=[];
    g.samples.push({x,y,t});
    const cutoff=t-FLICK_RETAIN_MS;
    while(g.samples.length>2&&g.samples[0].t<cutoff)g.samples.shift();
  };

  // Velocity of the last ~110ms of motion: {dx,dy,dist,ms,speed} or null.
  const flickWindowMetrics=(nowX,nowY,nowT)=>{
    if(!g||!g.samples||!g.samples.length)return null;
    const windowStart=nowT-FLICK_WINDOW_MS;
    const start=g.samples.find(s=>s.t>=windowStart)||g.samples[0];
    const ms=nowT-start.t;
    if(ms<=0)return null;
    const dx=nowX-start.x,dy=nowY-start.y;
    const dist=Math.hypot(dx,dy);
    return{dx,dy,dist,ms,speed:dist/(ms/1000)};
  };

  // A release that should place into the spread rather than flick: over a valid
  // slot, or up in the spread zone (a play, not a throw).
  const releaseIsPlacement=(x,y)=>{
    const drop=calcDropTarget(x,y);
    if(drop.inSpread&&drop.hit)return true;
    return isInSpreadZone(cardCenterFromPointer(x,y).cy);
  };

  // A flick: a fast throw (measured over the release window) that is not a
  // placement into the spread. Direction is free -- the card flies where thrown.
  const detectAbilityFlick=ev=>{
    if(!g||g.mode!=='drag')return false;
    if(!abilityFlickAllowed(g.uid))return false;
    const now=performance.now();
    if(now-g.dragStartTime<FLICK_MIN_DRAG_MS)return false;
    if(releaseIsPlacement(ev.clientX,ev.clientY))return false;
    const m=flickWindowMetrics(ev.clientX,ev.clientY,now);
    if(!m||m.ms<FLICK_MIN_WINDOW_MS||m.speed<FLICK_ACTIVATE_SPEED)return false;
    g.flickVec={x:m.dx,y:m.dy,speed:m.speed};
    return true;
  };

  // Glow the card the instant the throw crosses the arm speed, so the flick
  // reads as reactive before release. Feedback lives on the card, nowhere else.
  const updateFlickArming=(nowX,nowY)=>{
    if(!g)return;
    let armed=false;
    if(abilityFlickAllowed(g.uid)&&!g.dropSlot&&!releaseIsPlacement(nowX,nowY)){
      const m=flickWindowMetrics(nowX,nowY,performance.now());
      // Hysteresis: a little easier to stay armed than to arm in the first place.
      const gate=g.flickArmed?FLICK_ARM_SPEED*0.72:FLICK_ARM_SPEED;
      armed=!!m&&m.ms>=FLICK_MIN_WINDOW_MS&&m.speed>=gate;
    }
    if(armed!==g.flickArmed){
      g.flickArmed=armed;
      g.cardEl.classList.toggle('ability-flick-arming',armed);
      if(armed&&!g.flickHapticDone){g.flickHapticDone=true;if(typeof target.haptic==='function')target.haptic(8);}
      if(!armed)g.flickHapticDone=false;
    }
  };

  const commitAbilityFlick=ev=>{
    const uid=g.uid;
    const cardEl=g.cardEl;
    const rect=cardEl.getBoundingClientRect();
    // Fly the card off along the throw. Momentum distance scales with the throw
    // speed (clamped), so a harder flick sends the card further.
    const vec=g.flickVec||{x:0,y:1,speed:FLICK_ACTIVATE_SPEED};
    const mag=Math.hypot(vec.x,vec.y)||1;
    const ux=vec.x/mag,uy=vec.y/mag;
    const flyDist=Math.max(90,Math.min(280,vec.speed*0.17));
    const spinDeg=(ux>=0?1:-1)*Math.min(22,vec.speed*0.012);
    if(ev){try{ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation?.();}catch(e){}}

    // Clone the card because the game-state render() may immediately remove the
    // real one; the clone lets the flick-and-pop play without delaying the ability.
    const ghost=cardEl.cloneNode(true);
    ghost.classList.add('ability-flick-ghost');
    ghost.classList.remove('hand-card-dragging','ability-flick-arming');
    // discardCardUid() renders immediately, and renderSpread() sweeps every
    // `body > .card[data-uid]` orphan whose uid is no longer in hand -- which
    // would delete this clone the instant it is added, cancelling the flick FX.
    // Strip the uid so the ghost is not seen as a stray card to reclaim.
    ghost.removeAttribute('data-uid');
    ghost.querySelectorAll('[data-uid]').forEach(el=>el.removeAttribute('data-uid'));
    // The clone inherits the dragged card's !important inline transform/left/top
    // (set by startDrag/stepDrag). In the CSS cascade important author styles beat
    // WAAPI animations, so leaving them on the clone would silently cancel the
    // pop animation's transform -- the card would activate with no visible flick.
    // Strip them, then pin the ghost at the card's on-screen position so the
    // animation's transform is the only one in play.
    ['transform','left','top','right','bottom','width','height','margin','position','z-index'].forEach(p=>ghost.style.removeProperty(p));
    ghost.style.setProperty('position','fixed','important');
    ghost.style.setProperty('left',rect.left+'px','important');
    ghost.style.setProperty('top',rect.top+'px','important');
    ghost.style.setProperty('width',rect.width+'px','important');
    ghost.style.setProperty('height',rect.height+'px','important');
    ghost.style.setProperty('margin','0','important');
    ghost.style.setProperty('z-index','100001','important');
    ghost.style.setProperty('pointer-events','none','important');
    document.body.appendChild(ghost);

    // Remove the real card from the DOM now. It was reparented to <body> when
    // the drag began; endDrag() below strips its fixed positioning, which would
    // otherwise drop it into normal document flow at the top-left of the page
    // for a frame (a visible flash + reflow flicker) until render() clears it.
    // The ghost is the only visible copy from here on. Removing rather than just
    // hiding also keeps the ability-cancel rollback correct: renderSpread()
    // re-parents a surviving `body > .card` back into the hand on rollback, so a
    // hidden-but-present node would return invisible; a fresh node is built
    // instead once the card is restored to hand state.
    cardEl.remove();

    // End the ordinary drag without placing or reordering the card.
    endDrag(false);

    // Ghost flight (momentum) then pop/dissolve. Two phases in one timeline:
    //  - fly: ~150ms carrying on along the throw (the "card keeps flying").
    //  - pop: last ~130ms brightening, scaling up and dissolving away.
    const anim=ghost.animate?.([
      {transform:'translate(0,0) scale(1) rotate(0deg)',filter:'brightness(1.05)',opacity:1,offset:0},
      {transform:`translate(${(ux*flyDist*0.72).toFixed(1)}px,${(uy*flyDist*0.72).toFixed(1)}px) scale(1.03) rotate(${(spinDeg*0.6).toFixed(1)}deg)`,filter:'brightness(1.5)',opacity:1,offset:0.52},
      {transform:`translate(${(ux*flyDist).toFixed(1)}px,${(uy*flyDist).toFixed(1)}px) scale(1.22) rotate(${spinDeg.toFixed(1)}deg)`,filter:'brightness(2.9)',opacity:0,offset:1},
    ],{duration:290,easing:'cubic-bezier(.17,.72,.24,1)',fill:'forwards'});
    const cleanup=()=>ghost.remove();
    if(anim&&anim.finished&&typeof anim.finished.finally==='function')anim.finished.finally(cleanup);
    else setTimeout(cleanup,320);

    // The ability begins resolving a beat after release (once the card has flown),
    // not instantly. Selection, resource spend, hand removal, ability resolution
    // and rollback all stay owned by the existing discard runtime.
    setTimeout(()=>{if(typeof target.discardCardUid==='function')target.discardCardUid(uid);},FLICK_ABILITY_DELAY_MS);
  };

  const slideLanding=(cardEl,firstRect)=>{
    if(!firstRect)return;
    const finalRect=cardEl.getBoundingClientRect();
    const dx=firstRect.left-finalRect.left;
    const dy=firstRect.top-finalRect.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
    cardEl.style.setProperty('transition','none','important');
    cardEl.style.setProperty('transform','translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)','important');
    void cardEl.offsetWidth;
    requestAnimationFrame(()=>{
      cardEl.classList.add('hand-card-landing');
      cardEl.style.removeProperty('transition');
      cardEl.style.removeProperty('transform');
      setTimeout(()=>cardEl.classList.remove('hand-card-landing'),320);
    });
  };

  const endDrag=committed=>{
    if(!g)return;
    cancelHold();
    const{uid,cardEl,origIndex,hoverIndex,mode,pendingUids=[]}=g;
    let dropSlot=g.dropSlot;
    const wasDrag=mode==='drag';
    const wasSelectDrag=mode==='select-drag';
    if(wasDrag&&committed&&g.lastDragEv){
      const last=calcDropTarget(g.lastDragEv.clientX,g.lastDragEv.clientY);
      if(last.inSpread)dropSlot=last.hit||null;
    }
    if(g.dragRafId){cancelAnimationFrame(g.dragRafId);g.dragRafId=null;}
    try{cardEl.releasePointerCapture(g.pointerId);}catch(e){}
    cardEl.classList.remove('hand-card-dragging','ability-flick-arming');
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

    if(wasSelectDrag){
      if(!committed)return;
      const adapter=handAdapter();
      const _t=gestureTargeting();
      if(adapter?.commitSelectionSweep){
        adapter.commitSelectionSweep(pendingUids);
      }else if(_t&&pendingUids.length){
        const s=storeState();
        if(s&&target.tlrStore){
          target.tlrStore.dispatch({type:'SET_ABILITY_PICKS',cardIds:pendingUids});
        }else if(state.abilitySelect){
          state.abilitySelect.picked=pendingUids.slice(-_t.count);
        }
        if(typeof refreshHandState==='function')refreshHandState();
      }else if(purgeSelecting()&&pendingUids.length){
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
      if(typeof target.__handTriggerLayout==='function')target.__handTriggerLayout();
      return;
    }

    if(!committed){
      if(typeof target.__handTriggerLayout==='function')target.__handTriggerLayout();
      return;
    }

    const adapter=handAdapter();
    if(dropSlot){
      if(adapter?.placeCard)adapter.placeCard(uid,dropSlot.idx);
      else if(typeof target.placeCardUid==='function')target.placeCardUid(uid,dropSlot.idx);
      return;
    }

    if(hoverIndex!==origIndex){
      if(adapter?.reorderHand){
        adapter.reorderHand(uid,hoverIndex);
        return;
      }
      const s=storeState();
      if(s&&target.tlrStore){
        target.tlrStore.dispatch({type:'REORDER_HAND',uid,toIndex:hoverIndex});
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

    if(selectedUid()===uid){setSelected(null);refreshActiveHand();}
    if(typeof target.__handTriggerLayout==='function')target.__handTriggerLayout();
  };

  document.addEventListener('pointerdown',ev=>{
    if(!g||g.mode!=='drag')return;
    const t=ev.target instanceof Element?ev.target:null;
    if(t&&t.closest('button'))target.tlrCancelHandDrag();
  },true);

  document.addEventListener('pointerdown',ev=>{
    if(target.__handPinchSynthetic||target.__handPinchActive)return;
    const t=ev.target instanceof Element?ev.target:null;
    if(!t||t.closest('#spread,.card-detail-trigger'))return;
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
      samples:[{x:ev.clientX,y:ev.clientY,t:performance.now()}],
      flickArmed:false,
      flickHapticDone:false,
      originalParent:cardEl.parentNode,
      originalNextSibling:cardEl.nextSibling,
    };
  },true);

  document.addEventListener('pointermove',ev=>{
    if(!g||ev.pointerId!==g.pointerId)return;
    recordSample(ev.clientX,ev.clientY,performance.now());
    if(g.mode==='pending'){
      const dx=ev.clientX-g.startX,dy=ev.clientY-g.startY;
      if(Math.hypot(dx,dy)<DRAG_THRESHOLD)return;
      if(gestureBusy()){cancelHold();g=null;return;}
      if(gestureTargeting()||purgeSelecting()){startSelectDrag(ev);return;}
      startDrag(ev);
      return;
    }
    if(g.mode==='drag'){ev.preventDefault();stepDrag(ev);return;}
    if(g.mode==='select-drag'){stepSelectDrag(ev);}
  },{capture:true,passive:false});

  const onEnd=ev=>{
    if(!g||ev.pointerId!==g.pointerId)return;
    if(g.mode==='pending'){cancelHold();g=null;return;}
    // Release priority: valid spread slot (handled in endDrag) is checked first
    // inside detectAbilityFlick; a recognized downward flick activates the
    // ability; otherwise endDrag reorders or returns the card.
    if(ev.type==='pointerup'&&g.mode==='drag'&&detectAbilityFlick(ev)){
      commitAbilityFlick(ev);
      return;
    }
    endDrag(ev.type!=='pointercancel');
  };
  document.addEventListener('pointerup',onEnd,true);
  document.addEventListener('pointercancel',onEnd,true);

  document.addEventListener('click',ev=>{
    const until=target.__handGestureSuppressClickUntil||0;
    if(performance.now()>until)return;
    const t=ev.target instanceof Element?ev.target:null;
    if(t&&t.closest('#hand .card[data-uid]')){
      ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    }
  },true);

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
