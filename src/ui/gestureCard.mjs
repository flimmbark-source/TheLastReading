// Hand card gesture controller. Owns pointer intent (select sweep, reorder,
// placement, ability flick) while card-activation presentation/gameplay timing is
// delegated to cardActivationFx.mjs.
/* global state, refreshHandState, render */
import { abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';
import { installCardActivationFx } from './cardActivationFx.mjs';

export function installHandCardGestures(target=window){
  if(!target||target.__handCardGesturesInstalled)return;
  target.__handCardGesturesInstalled=true;
  installCardActivationFx(target);

  const doc=target.document||document;
  const TAP_SLOP_MOUSE=2;
  const TAP_SLOP_PEN=3;
  const TAP_SLOP_TOUCH=4;
  // Release window for the immediate-drag model: the card is dragging from the
  // moment it's touched, and a release whose whole travel stayed inside this
  // radius commits as a select/unselect toggle instead of a drop.
  const TAP_TOGGLE_MOUSE=4;
  const TAP_TOGGLE_PEN=6;
  const TAP_TOGGLE_TOUCH=9;
  const TILT_SCALE=.32;
  const TILT_MAX=14;
  const TILT_LERP=.22;
  const SPREAD_ZONE_SLACK=72;
  const SLOT_HIT_PAD=28;
  const FAILED_FLICK_RETURN_MS=950;

  const FLICK_WINDOW_MS=110;
  const FLICK_RETAIN_MS=170;
  const FLICK_MIN_DRAG_MS=70;
  const FLICK_MIN_WINDOW_MS=45;
  const FLICK_ARM_SPEED=640;
  const FLICK_ACTIVATE_SPEED=940;
  const EDGE_BOTTOM_PX=84;
  const EDGE_SIDE_PX=30;

  const requestFrame=callback=>(target.requestAnimationFrame||requestAnimationFrame)(callback);
  const cancelFrame=id=>(target.cancelAnimationFrame||cancelAnimationFrame)(id);
  const now=()=>target.performance?.now?.()??performance.now();
  const tapSlopFor=pointerType=>pointerType==='mouse'?TAP_SLOP_MOUSE:pointerType==='pen'?TAP_SLOP_PEN:TAP_SLOP_TOUCH;
  const tapToggleFor=pointerType=>pointerType==='mouse'?TAP_TOGGLE_MOUSE:pointerType==='pen'?TAP_TOGGLE_PEN:TAP_TOGGLE_TOUCH;

  let g=null;
  const handEl=()=>doc.querySelector('.hand');
  const handCards=()=>{const hand=handEl();return hand?[...hand.querySelectorAll(':scope > .card[data-uid]')]:[];};
  const storeState=()=>target.tlrStore?.getState?.()??null;
  const handAdapter=()=>{
    const adapter=target.tlrHandGestureAdapter;
    if(!adapter)return null;
    return typeof adapter.isActive!=='function'||adapter.isActive()?adapter:null;
  };
  const gestureTargeting=()=>{
    const adapter=handAdapter();
    if(adapter)return adapter.getTargeting?.()??null;
    const current=storeState();
    return current?selectAbilityTargetView(current):state.abilitySelect;
  };
  const purgeSelecting=()=>{
    const adapter=handAdapter();
    if(adapter)return !!adapter.isPurgeSelecting?.();
    return (storeState()?.run?.purge??state.purgeSelect)!==null;
  };
  const gestureBusy=()=>{
    if(target.__tlrCardActivationPending)return true;
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
  const isSpreadSlotOccupied=index=>{
    const adapter=handAdapter();
    if(adapter?.isSpreadSlotOccupied)return !!adapter.isSpreadSlotOccupied(index);
    return !!state.spread[index];
  };
  const cardByUid=uid=>{
    const adapter=handAdapter();
    const adapterCard=adapter?.getCardByUid?.(uid);
    if(adapterCard)return adapterCard;
    const run=storeState()?.run;
    return (run?.hand||state.hand||[]).find(card=>card.uid===uid)||null;
  };
  const cancelHold=()=>{if(g?.holdTimer){clearTimeout(g.holdTimer);g.holdTimer=null;}};
  const queueUid=(items,uid,max)=>items.includes(uid)?items:[...items,uid].slice(-max);
  const suppressTrailingClick=(uid,{allHand=false}={})=>{
    target.__handGestureSuppressCardUid=uid;
    target.__handGestureSuppressAllHandClicks=allHand;
    target.__handGestureSuppressClickUntil=now()+800;
  };

  const xToFracSlot=centerX=>{
    if(!g||!g.trackSpacingDeg)return 0;
    const dx=centerX-g.trackCenterX;
    const ratio=Math.max(-.95,Math.min(.95,dx/Math.max(1,g.trackRadius)));
    return (Math.asin(ratio)*180/Math.PI-g.trackOffsetDeg)/g.trackSpacingDeg;
  };

  const hitTestSpreadSlots=(cardCenterX,cardCenterY)=>{
    const rects=g?.slotRects||[...doc.querySelectorAll('#spread .slot')].map((element,index)=>({
      element,index,rect:element.getBoundingClientRect(),blocked:isSpreadSlotOccupied(index)||!!element.querySelector('.card'),
    }));
    for(const item of rects){
      if(item.blocked)continue;
      const rect=item.rect;
      if(cardCenterX>=rect.left-SLOT_HIT_PAD&&cardCenterX<=rect.right+SLOT_HIT_PAD&&
         cardCenterY>=rect.top-SLOT_HIT_PAD&&cardCenterY<=rect.bottom+SLOT_HIT_PAD){
        return{slotEl:item.element,idx:item.index};
      }
    }
    return null;
  };

  const isInSpreadZone=cardCenterY=>{
    if(g?.spreadRect)return cardCenterY<g.spreadRect.bottom+SPREAD_ZONE_SLACK;
    const spread=doc.querySelector('#spread');
    return !!spread&&cardCenterY<spread.getBoundingClientRect().bottom+SPREAD_ZONE_SLACK;
  };

  const applyReorderSlots=hoverIndex=>{
    if(!g)return;
    const cards=handCards();
    if(!cards.length)return;
    const inHand=cards.includes(g.cardEl);
    const total=inHand?cards.length:cards.length+1;
    cards.forEach((element,index)=>{
      let nextIndex;
      if(element===g.cardEl){
        nextIndex=hoverIndex;
      }else{
        const original=inHand?index:(index<g.origIndex?index:index+1);
        if(original<g.origIndex)nextIndex=original>=hoverIndex?original+1:original;
        else nextIndex=original<=hoverIndex?original-1:original;
      }
      element.style.setProperty('--slot',String(nextIndex-(total-1)/2));
    });
    g.hoverIndex=hoverIndex;
  };

  const applyNaturalSlots=()=>{
    const cards=handCards();
    cards.forEach((element,index)=>element.style.setProperty('--slot',String(index-(cards.length-1)/2)));
    if(g)g.hoverIndex=g.origIndex;
  };

  const startSelectDrag=event=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    g.mode='select-drag';
    g.pendingUids=[];
    try{g.cardEl.setPointerCapture(g.pointerId);}catch{}
    suppressTrailingClick(g.uid,{allHand:true});
    stepSelectDrag(event);
  };

  const stepSelectDrag=event=>{
    if(!g||g.mode!=='select-drag')return;
    for(const element of doc.elementsFromPoint(event.clientX,event.clientY)){
      if(!(element instanceof Element))continue;
      const cardEl=element.closest('#hand .card[data-uid]');
      if(!cardEl)continue;
      const uid=Number(cardEl.dataset.uid);
      if(!Number.isFinite(uid))break;
      const adapter=handAdapter();
      const targeting=gestureTargeting();
      if(targeting){
        if(!targeting.validIds.has(uid))break;
        g.pendingUids=queueUid(g.pendingUids,uid,targeting.count);
      }else if(adapter?.getPurgeLimit&&purgeSelecting()){
        g.pendingUids=queueUid(g.pendingUids,uid,adapter.getPurgeLimit());
      }else if(!adapter&&purgeSelecting()){
        g.pendingUids=queueUid(g.pendingUids,uid,3);
      }
      break;
    }
  };

  const abilityFlickAllowed=uid=>typeof target.canDiscardCardUid==='function'&&target.canDiscardCardUid(uid);

  const startDrag=event=>{
    if(!g||g.mode!=='pending')return;
    cancelHold();
    const selected=selectedUid();
    if(selected!=null&&selected!==g.uid){
      setSelected(null);
      refreshActiveHand();
    }

    const naturalWidth=g.naturalWidth;
    const naturalHeight=g.naturalHeight;
    const fixedLeft=g.fixedLeft;
    const fixedTop=g.fixedTop;

    const hand=handEl();
    const handRect=hand?hand.getBoundingClientRect():{left:0,top:0,width:target.innerWidth,height:200};
    const trackState=typeof target.__handGetTrackState==='function'?target.__handGetTrackState():null;
    g.handCenterX=handRect.left+handRect.width/2;
    g.handTop=handRect.top;
    g.trackCenterX=trackState?trackState.handRect.left+trackState.handRect.width/2:g.handCenterX;
    g.trackRadius=trackState?.radius||720;
    g.trackOffsetDeg=trackState?.offsetDeg||0;
    g.trackSpacingDeg=trackState?.spacingDeg||5;
    g.dragHandCount=handCards().length;
    g.cardHalfW=naturalWidth/2;
    g.cardHalfH=naturalHeight/2;
    g.prevX=g.startX;
    g.tiltDeg=0;
    g.dragStartTime=g.startTime;
    g.flickEligible=abilityFlickAllowed(g.uid);
    g.mode='drag';

    const spread=doc.querySelector('#spread');
    g.spreadRect=spread?spread.getBoundingClientRect():null;
    g.slotRects=[...doc.querySelectorAll('#spread .slot')].map((element,index)=>({
      element,index,rect:element.getBoundingClientRect(),blocked:isSpreadSlotOccupied(index)||!!element.querySelector('.card'),
    }));
    target.__handReorderActive=true;
    hand?.classList.add('hand-parting');
    spread?.classList.add('drag-active');
    g.cardEl.classList.add('hand-card-dragging');
    g.dragOriginLeft=fixedLeft;
    g.dragOriginTop=fixedTop;
    if(g.cardEl.parentNode!==doc.body)doc.body.appendChild(g.cardEl);
    g.cardEl.style.setProperty('position','fixed','important');
    g.cardEl.style.setProperty('left',fixedLeft+'px','important');
    g.cardEl.style.setProperty('top',fixedTop+'px','important');
    g.cardEl.style.setProperty('width',naturalWidth+'px','important');
    g.cardEl.style.setProperty('height',naturalHeight+'px','important');
    g.cardEl.style.setProperty('margin','0','important');
    g.cardEl.style.setProperty('z-index','100000','important');
    g.cardEl.style.setProperty('will-change','transform','important');
    g.cardEl.style.setProperty('backface-visibility','hidden','important');
    try{g.cardEl.setPointerCapture(g.pointerId);}catch{}
    suppressTrailingClick(g.uid,{allHand:true});

    if(g.flickEligible)target.tlrPrepareCardActivation?.(cardByUid(g.uid));
    g.lastDragEv=event;
    // Snap the card under the pointer immediately, then let the first rAF settle
    // drop targets so the initial frame isn't blocked on hit-testing.
    applyDragPose(event);
    updateDragTargets(event);
  };

  const calcDropTarget=(x,y)=>{
    const cardLeft=x-g.grabOffsetX;
    const cardTop=y-g.grabOffsetY;
    const cardCenterX=cardLeft+g.cardHalfW;
    const cardCenterY=cardTop+g.cardHalfH;
    if(isInSpreadZone(cardCenterY))return{inSpread:true,hit:hitTestSpreadSlots(cardCenterX,cardCenterY)};
    const total=Math.max(1,g.dragHandCount||1);
    const hover=Math.max(0,Math.min(total-1,Math.round(xToFracSlot(x)+(total-1)/2)));
    return{inSpread:false,hover};
  };

  // Position-only update. Kept deliberately cheap (no layout reads, no
  // hit-testing) so it can run on every raw pointermove and the card sticks to
  // the pointer with zero rAF latency.
  const applyDragPose=latest=>{
    if(!g||g.mode!=='drag'||!latest)return null;
    const x=latest.clientX;
    const y=latest.clientY;
    const deltaX=x-g.prevX;
    const targetTilt=Math.max(-TILT_MAX,Math.min(TILT_MAX,deltaX*TILT_SCALE));
    g.tiltDeg+=(targetTilt-g.tiltDeg)*TILT_LERP;
    g.prevX=x;
    const left=x-g.grabOffsetX;
    const top=y-g.grabOffsetY;
    const moveX=left-g.dragOriginLeft;
    const moveY=top-g.dragOriginTop;
    g.cardEl.style.setProperty('transform',`translate3d(${moveX.toFixed(1)}px,${moveY.toFixed(1)}px,0) rotate(${g.tiltDeg.toFixed(2)}deg)`,'important');
    return{
      left,
      top,
      width:g.cardHalfW*2,
      height:g.cardHalfH*2,
      rotationDeg:g.tiltDeg,
    };
  };

  // Drop-target detection, hand parting and flick arming. This is the heavier
  // half (spread hit-testing + per-card slot reassignment), so it stays
  // throttled to one pass per animation frame.
  const updateDragTargets=latest=>{
    if(!g||g.mode!=='drag'||!latest)return;
    const x=latest.clientX;
    const y=latest.clientY;
    const {inSpread,hit,hover}=calcDropTarget(x,y);
    if(inSpread){
      const nextIndex=hit?.idx??-1;
      const previousIndex=g.dropSlot?.idx??-1;
      if(nextIndex!==previousIndex){
        g.dropSlot?.slotEl.classList.remove('drop-target');
        hit?.slotEl.classList.add('drop-target');
        g.dropSlot=hit||null;
      }
      if(g.hoverIndex!==g.origIndex)applyNaturalSlots();
    }else{
      if(g.dropSlot){g.dropSlot.slotEl.classList.remove('drop-target');g.dropSlot=null;}
      if(hover!==g.hoverIndex)applyReorderSlots(hover);
    }
    updateFlickArming(x,y,inSpread);
  };

  const stepDrag=event=>{
    if(!g||g.mode!=='drag')return;
    g.lastDragEv=event;
    // Move the card now — the pointer position is already known, so there is no
    // reason to wait a frame to show it following the finger.
    applyDragPose(event);
    // Coalesce the expensive target/flick work to rAF using the latest sample.
    if(g.dragRafId)return;
    g.dragRafId=requestFrame(()=>{
      if(!g||g.mode!=='drag')return;
      g.dragRafId=null;
      updateDragTargets(g.lastDragEv);
    });
  };

  const flushDragPose=event=>{
    if(!g||g.mode!=='drag')return null;
    if(g.dragRafId){cancelFrame(g.dragRafId);g.dragRafId=null;}
    g.lastDragEv=event;
    return applyDragPose(event);
  };

  const inEdgeZone=(x,y)=>y>=target.innerHeight-EDGE_BOTTOM_PX||x<=EDGE_SIDE_PX||x>=target.innerWidth-EDGE_SIDE_PX;

  const recordSample=(x,y,time)=>{
    if(!g)return;
    const travel=Math.hypot(x-g.startX,y-g.startY);
    if(travel>g.maxMove)g.maxMove=travel;
    g.samples||=[];
    g.samples.push({x,y,t:time});
    const cutoff=time-FLICK_RETAIN_MS;
    while(g.samples.length>2&&g.samples[0].t<cutoff)g.samples.shift();
  };

  const flickWindowMetrics=(x,y,time)=>{
    if(!g?.samples?.length)return null;
    const start=g.samples.find(sample=>sample.t>=time-FLICK_WINDOW_MS)||g.samples[0];
    const ms=time-start.t;
    if(ms<=0)return null;
    const dx=x-start.x;
    const dy=y-start.y;
    return{dx,dy,dist:Math.hypot(dx,dy),ms,speed:Math.hypot(dx,dy)/(ms/1000)};
  };

  const detectAbilityFlick=event=>{
    if(!g||g.mode!=='drag'||!g.flickEligible)return false;
    const drop=calcDropTarget(event.clientX,event.clientY);
    if(drop.inSpread&&drop.hit)return false;
    if(inEdgeZone(event.clientX,event.clientY)){
      g.flickVec={x:0,y:1,speed:FLICK_ACTIVATE_SPEED};
      return true;
    }
    const currentTime=now();
    if(!drop.inSpread&&currentTime-g.dragStartTime>=FLICK_MIN_DRAG_MS){
      const metrics=flickWindowMetrics(event.clientX,event.clientY,currentTime);
      if(metrics&&metrics.ms>=FLICK_MIN_WINDOW_MS&&metrics.speed>=FLICK_ACTIVATE_SPEED){
        g.flickVec={x:metrics.dx,y:metrics.dy,speed:metrics.speed};
        return true;
      }
    }
    return false;
  };

  const updateFlickArming=(x,y,inSpread)=>{
    if(!g)return;
    let armed=false;
    if(g.flickEligible&&!g.dropSlot){
      if(inEdgeZone(x,y))armed=true;
      else if(!inSpread){
        const metrics=flickWindowMetrics(x,y,now());
        const gate=g.flickArmed?FLICK_ARM_SPEED*.72:FLICK_ARM_SPEED;
        armed=!!metrics&&metrics.ms>=FLICK_MIN_WINDOW_MS&&metrics.speed>=gate;
      }
    }
    if(armed===g.flickArmed)return;
    g.flickArmed=armed;
    g.cardEl.classList.toggle('tlr-ability-flick-armed',armed);
    if(armed)g.cardEl.style.setProperty('box-shadow','0 0 0 2px rgba(255,232,168,.95)','important');
    else g.cardEl.style.removeProperty('box-shadow');
    if(armed&&!g.flickHapticDone){g.flickHapticDone=true;target.haptic?.(8);}
    if(!armed)g.flickHapticDone=false;
  };

  const releaseDragChrome=({removeCard=false,cancelPrepared=true}={})=>{
    if(!g)return null;
    cancelHold();
    const snapshot=g;
    if(snapshot.dragRafId){cancelFrame(snapshot.dragRafId);snapshot.dragRafId=null;}
    try{snapshot.cardEl.releasePointerCapture(snapshot.pointerId);}catch{}
    snapshot.cardEl.classList.remove('hand-card-dragging','tlr-ability-flick-armed');
    for(const property of ['filter','box-shadow','transform','position','left','top','width','height','margin','z-index','will-change','backface-visibility']){
      snapshot.cardEl.style.removeProperty(property);
    }
    snapshot.dropSlot?.slotEl.classList.remove('drop-target');
    handEl()?.classList.remove('hand-parting');
    doc.querySelector('#spread')?.classList.remove('drag-active');
    target.__handReorderActive=false;
    if(cancelPrepared)target.tlrCancelPreparedCardActivation?.(snapshot.uid);
    if(removeCard)snapshot.cardEl.remove();
    g=null;
    return snapshot;
  };

  const clearActivationSelection=uid=>{
    if(state.selected===uid)state.selected=null;
    const store=target.tlrStore;
    const actions=target.tlrActions;
    const run=store?.getState?.()?.run;
    if(store&&actions&&run?.selectedCardId===uid&&actions.CLEAR_SELECTION){
      store.dispatch({type:actions.CLEAR_SELECTION});
    }
  };

  const schedulePostActivationHandLayout=()=>{
    requestFrame(()=>requestFrame(()=>{
      applyNaturalSlots();
      target.__handTriggerLayout?.();
    }));
  };

  const commitAbilityFlick=event=>{
    if(!g)return;
    const card=cardByUid(g.uid);
    if(!card){endDrag(false);return;}
    const startPose=flushDragPose(event);
    if(!startPose){endDrag(false);return;}
    const transaction={
      cardUid:g.uid,
      card,
      startPose,
      vector:g.flickVec||{x:0,y:1,speed:FLICK_ACTIVATE_SPEED},
    };
    // Stage the permanent proxy over the real card before removing the dragged
    // element. Because startPose uses the unrotated natural box plus one explicit
    // rotation, the replacement does not resize or rotate twice at handoff.
    target.tlrStageCardActivation?.(transaction);
    try{event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();}catch{}
    const snapshot=releaseDragChrome({removeCard:true,cancelPrepared:false});
    if(!snapshot)return;
    clearActivationSelection(snapshot.uid);

    const activate=target.tlrActivateCardFromGesture;
    if(typeof activate==='function'){
      void Promise.resolve(activate(transaction)).catch(error=>{
        console.error('Ability flick activation failed',error);
        target.__tlrCardActivationPending=false;
        target.render?.();
      });
    }else{
      const committed=target.discardCardUid?.(snapshot.uid);
      if(!committed)target.render?.();
    }
    // Let the proxy paint and begin its WAAPI animation before recalculating the
    // remaining hand. This keeps synchronous hand geometry out of the handoff.
    schedulePostActivationHandLayout();
  };

  const slideLanding=(cardEl,firstRect,duration=320)=>{
    if(!firstRect||!cardEl?.isConnected)return;
    const finalRect=cardEl.getBoundingClientRect();
    const dx=firstRect.left-finalRect.left;
    const dy=firstRect.top-finalRect.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
    const milliseconds=target.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:duration;
    const cleanup=()=>{
      const isDragging=cardEl.classList.contains('hand-card-dragging');
      cardEl.classList.remove('hand-card-landing');
      cardEl.style.removeProperty('transition');
      if(!isDragging){
        cardEl.style.removeProperty('will-change');
        cardEl.style.removeProperty('backface-visibility');
      }
    };
    cardEl.classList.add('hand-card-landing');
    cardEl.style.setProperty('transition','none','important');
    cardEl.style.setProperty('will-change','transform','important');
    cardEl.style.setProperty('backface-visibility','hidden','important');
    cardEl.style.setProperty('transform',`translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0)`,'important');
    void cardEl.offsetWidth;
    requestFrame(()=>{
      if(!cardEl.isConnected){cleanup();return;}
      if(milliseconds<=0){cardEl.style.removeProperty('transform');cleanup();return;}
      cardEl.style.setProperty('transition',`transform ${milliseconds}ms cubic-bezier(.16,.76,.2,1)`,'important');
      cardEl.style.removeProperty('transform');
      setTimeout(cleanup,milliseconds+80);
    });
  };

  const restoreOrphanCard=(cardEl,originalParent,originalNextSibling)=>{
    if(!cardEl||!cardEl.isConnected||cardEl.parentNode!==doc.body)return;
    if(!originalParent?.isConnected)return;
    if(originalNextSibling&&originalNextSibling.parentNode===originalParent)originalParent.insertBefore(cardEl,originalNextSibling);
    else originalParent.appendChild(cardEl);
    applyNaturalSlots();
  };

  const endDrag=committed=>{
    if(!g)return;
    const snapshot=g;
    let dropSlot=snapshot.dropSlot;
    const wasDrag=snapshot.mode==='drag';
    const wasSelectDrag=snapshot.mode==='select-drag';
    if(wasDrag&&committed&&snapshot.lastDragEv){
      const last=calcDropTarget(snapshot.lastDragEv.clientX,snapshot.lastDragEv.clientY);
      if(last.inSpread)dropSlot=last.hit||null;
    }
    const releaseRect=wasDrag&&snapshot.cardEl.isConnected?snapshot.cardEl.getBoundingClientRect():null;
    releaseDragChrome();

    if(wasSelectDrag){
      if(!committed)return;
      const adapter=handAdapter();
      const targeting=gestureTargeting();
      const pendingUids=snapshot.pendingUids||[];
      if(adapter?.commitSelectionSweep){
        adapter.commitSelectionSweep(pendingUids);
      }else if(targeting&&pendingUids.length){
        const current=storeState();
        if(current&&target.tlrStore)target.tlrStore.dispatch({type:'SET_ABILITY_PICKS',cardIds:pendingUids});
        else if(state.abilitySelect)state.abilitySelect.picked=pendingUids.slice(-targeting.count);
        if(typeof refreshHandState==='function')refreshHandState();
      }else if(purgeSelecting()&&pendingUids.length){
        const current=storeState();
        if(current&&target.tlrStore){
          target.tlrStore.dispatch({type:'SET_PURGE_PICKS',cardIds:pendingUids});
          state.purgeSelect=target.tlrStore.getState().run.purge?.slice()??null;
        }else state.purgeSelect=pendingUids.slice(0,3);
        if(typeof render==='function')render();
      }
      return;
    }

    if(!wasDrag){target.__handTriggerLayout?.();return;}
    if(!committed){
      restoreOrphanCard(snapshot.cardEl,snapshot.originalParent,snapshot.originalNextSibling);
      target.__handTriggerLayout?.();
      return;
    }

    const adapter=handAdapter();
    if(dropSlot){
      if(adapter?.placeCard)adapter.placeCard(snapshot.uid,dropSlot.idx);
      else target.placeCardUid?.(snapshot.uid,dropSlot.idx);
      return;
    }

    if(snapshot.hoverIndex!==snapshot.origIndex){
      if(adapter?.reorderHand){adapter.reorderHand(snapshot.uid,snapshot.hoverIndex);return;}
      const current=storeState();
      if(current&&target.tlrStore){
        target.tlrStore.dispatch({type:'REORDER_HAND',uid:snapshot.uid,toIndex:snapshot.hoverIndex});
        state.hand=target.tlrStore.getState().run.hand.slice();
        if(state.selected===snapshot.uid)state.selected=null;
        if(typeof render==='function')render();
        return;
      }
      const index=state.hand.findIndex(card=>card.uid===snapshot.uid);
      if(index>=0){
        const [card]=state.hand.splice(index,1);
        state.hand.splice(snapshot.hoverIndex,0,card);
        if(state.selected===snapshot.uid)state.selected=null;
        if(typeof render==='function')render();
        return;
      }
    }

    restoreOrphanCard(snapshot.cardEl,snapshot.originalParent,snapshot.originalNextSibling);
    if(selectedUid()===snapshot.uid){setSelected(null);refreshActiveHand();}
    target.__handTriggerLayout?.();
    const returnedCard=snapshot.cardEl.isConnected?snapshot.cardEl:doc.querySelector(`#hand .card[data-uid="${snapshot.uid}"]`);
    slideLanding(returnedCard,releaseRect,FAILED_FLICK_RETURN_MS);
  };

  // True when a drag released with its entire travel inside the tap-toggle
  // radius — the "touched but never really moved" case of the immediate-drag
  // model. Checked with the release coords too: pointerup can land past the
  // last recorded move sample.
  const isTapRelease=event=>{
    if(!g)return false;
    const travel=Math.max(g.maxMove||0,Math.hypot(event.clientX-g.startX,event.clientY-g.startY));
    return travel<=g.tapToggle;
  };

  // The select/unselect pose change animates through the card's base
  // transform (--lift-y transitions over .32s), and its "before" style is
  // whatever the card last painted at — the hand slot, after a restore. Prime
  // --drift-x/--drift-y (already terms of that same transform calc) to the
  // release point with transitions suppressed, so that zeroing them after the
  // tap commits glides the card from where the finger let go straight to its
  // new pose instead of snapping to the slot first. Inline !important because
  // the .sel rule pins the drifts to 0 with !important.
  const primeTapGlide=(cardEl,releaseRect)=>{
    const restRect=cardEl.getBoundingClientRect();
    const dx=releaseRect.left-restRect.left;
    const dy=releaseRect.top-restRect.top;
    if(Math.abs(dx)<1&&Math.abs(dy)<1)return null;
    cardEl.style.setProperty('transition','none','important');
    cardEl.style.setProperty('--drift-x',dx.toFixed(1)+'px','important');
    cardEl.style.setProperty('--drift-y',dy.toFixed(1)+'px','important');
    void cardEl.offsetWidth;   // commit the release-point pose as the "before" style
    return()=>{
      cardEl.style.removeProperty('transition');
      cardEl.style.setProperty('--drift-x','0px','important');
      cardEl.style.setProperty('--drift-y','0px','important');
      target.setTimeout?.(()=>{
        cardEl.style.removeProperty('--drift-x');
        cardEl.style.removeProperty('--drift-y');
      },420);
    };
  };

  // A drag that never left the tap window commits as a selection toggle: put
  // the card back where it was grabbed and run the same current-render tap
  // action the pending path uses, so tap and click cannot drift apart.
  const commitTapFromDrag=event=>{
    if(!g||g.mode!=='drag')return;
    const snapshot=g;
    const releaseRect=snapshot.cardEl.isConnected?snapshot.cardEl.getBoundingClientRect():null;
    endDrag(false);
    if(gestureBusy())return;
    suppressTrailingClick(snapshot.uid,{allHand:true});
    if(event.cancelable)event.preventDefault();
    const cardEl=snapshot.cardEl?.isConnected?snapshot.cardEl:doc.querySelector(`#hand .card[data-uid="${snapshot.uid}"]`);
    const glide=releaseRect&&cardEl?.isConnected?primeTapGlide(cardEl,releaseRect):null;
    const commitTap=cardEl?.__tlrCommitTap;
    if(typeof commitTap==='function')commitTap();
    else if(typeof cardEl?.onclick==='function')cardEl.onclick.call(cardEl);
    glide?.();
  };

  const finishPendingGesture=event=>{
    if(!g||g.mode!=='pending')return;
    const snapshot=g;
    cancelHold();
    try{snapshot.cardEl.releasePointerCapture(snapshot.pointerId);}catch{}
    g=null;
    if(event.type!=='pointerup'||gestureBusy())return;
    suppressTrailingClick(snapshot.uid);
    if(event.cancelable)event.preventDefault();
    const cardEl=snapshot.cardEl?.isConnected?snapshot.cardEl:doc.querySelector(`#hand .card[data-uid="${snapshot.uid}"]`);
    const commitTap=cardEl?.__tlrCommitTap;
    if(typeof commitTap==='function')commitTap();
    else if(typeof cardEl?.onclick==='function')cardEl.onclick.call(cardEl);
  };

  doc.addEventListener('pointerdown',event=>{
    if(!g||g.mode!=='drag')return;
    const element=event.target instanceof Element?event.target:null;
    if(element?.closest('button'))target.tlrCancelHandDrag();
  },true);

  doc.addEventListener('pointerdown',event=>{
    if(target.__handPinchSynthetic||target.__handPinchActive||target.__tlrCardActivationPending)return;
    const element=event.target instanceof Element?event.target:null;
    if(!element||element.closest('#spread,.card-detail-trigger'))return;
    const cardEl=element.closest('#hand .card[data-uid]');
    if(!cardEl)return;
    if(g)endDrag(false);
    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid))return;
    const origIndex=handCards().indexOf(cardEl);
    if(origIndex<0)return;
    const rect=cardEl.getBoundingClientRect();
    const naturalWidth=cardEl.offsetWidth;
    const naturalHeight=cardEl.offsetHeight;
    const fixedLeft=rect.left+rect.width/2-naturalWidth/2;
    const fixedTop=rect.top+rect.height/2-naturalHeight/2;
    const pointerType=event.pointerType||'touch';
    g={
      pointerId:event.pointerId,
      pointerType,
      tapSlop:tapSlopFor(pointerType),
      tapToggle:tapToggleFor(pointerType),
      maxMove:0,
      uid,cardEl,origIndex,
      mode:'pending',
      startX:event.clientX,startY:event.clientY,startTime:now(),
      fixedLeft,fixedTop,naturalWidth,naturalHeight,
      grabOffsetX:event.clientX-fixedLeft,
      grabOffsetY:event.clientY-fixedTop,
      hoverIndex:origIndex,
      dropSlot:null,
      holdTimer:null,
      prevX:event.clientX,
      tiltDeg:0,
      dragRafId:null,
      lastDragEv:null,
      samples:[{x:event.clientX,y:event.clientY,t:now()}],
      flickArmed:false,
      flickHapticDone:false,
      originalParent:cardEl.parentNode,
      originalNextSibling:cardEl.nextSibling,
    };
    try{cardEl.setPointerCapture(event.pointerId);}catch{}
    // Immediate drag: the card is draggable from the moment it's touched. The
    // pending gate only remains for selection sweeps (ability targeting /
    // purge picks), busy states, and non-primary mouse buttons — there a
    // release inside the tap window still commits via finishPendingGesture,
    // while everywhere else it commits via commitTapFromDrag.
    const primaryPress=pointerType!=='mouse'||event.button===0;
    if(primaryPress&&!gestureBusy()&&!gestureTargeting()&&!purgeSelecting())startDrag(event);
  },true);

  doc.addEventListener('pointermove',event=>{
    if(!g||event.pointerId!==g.pointerId)return;
    const coalesced=typeof event.getCoalescedEvents==='function'?event.getCoalescedEvents():null;
    if(coalesced?.length){
      for(const point of coalesced)recordSample(point.clientX,point.clientY,point.timeStamp||now());
    }else recordSample(event.clientX,event.clientY,now());

    if(g.mode==='pending'){
      if(Math.hypot(event.clientX-g.startX,event.clientY-g.startY)<g.tapSlop)return;
      if(gestureBusy()){
        cancelHold();
        try{g.cardEl.releasePointerCapture(g.pointerId);}catch{}
        g=null;
        return;
      }
      if(event.cancelable)event.preventDefault();
      if(gestureTargeting()||purgeSelecting()){startSelectDrag(event);return;}
      startDrag(event);
      return;
    }
    if(g.mode==='drag'){event.preventDefault();stepDrag(event);return;}
    if(g.mode==='select-drag')stepSelectDrag(event);
  },{capture:true,passive:false});

  const onEnd=event=>{
    if(!g||event.pointerId!==g.pointerId)return;
    if(g.mode==='pending'){finishPendingGesture(event);return;}
    // Tap-toggle must be decided before flick detection: the hand dock sits
    // inside the bottom flick edge zone, so a plain tap on a flick-eligible
    // card would otherwise read as an edge-zone ability activation.
    if(event.type==='pointerup'&&g.mode==='drag'&&isTapRelease(event)){
      commitTapFromDrag(event);
      return;
    }
    if(event.type==='pointerup'&&g.mode==='drag'&&detectAbilityFlick(event)){
      commitAbilityFlick(event);
      return;
    }
    endDrag(event.type!=='pointercancel');
  };
  doc.addEventListener('pointerup',onEnd,true);
  doc.addEventListener('pointercancel',onEnd,true);

  doc.addEventListener('click',event=>{
    if(now()>(target.__handGestureSuppressClickUntil||0))return;
    const element=event.target instanceof Element?event.target:null;
    const cardEl=element?.closest('.card[data-uid]');
    const uid=Number(cardEl?.dataset.uid);
    if(cardEl&&(uid===target.__handGestureSuppressCardUid||(target.__handGestureSuppressAllHandClicks&&cardEl.closest('#hand')))){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  },true);

  target.tlrCancelHandDrag=()=>{
    if(!g||g.mode!=='drag')return false;
    const {cardEl,originalParent,originalNextSibling}=g;
    const firstRect=cardEl.getBoundingClientRect();
    endDrag(false);
    if(originalParent&&cardEl.parentNode!==originalParent){
      if(originalNextSibling&&originalNextSibling.parentNode===originalParent)originalParent.insertBefore(cardEl,originalNextSibling);
      else originalParent.appendChild(cardEl);
    }
    applyNaturalSlots();
    slideLanding(cardEl,firstRect);
    return true;
  };
}
