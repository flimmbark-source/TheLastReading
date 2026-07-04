// Hand card gesture controller (Step 4). Verbatim port target from the
// legacy inline hand card gestures handler patch.
/* global state, refreshHandState, expandCard, render, placeCard */
import { abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';

export function installHandCardGestures(target = window){
  if(!target || target.__handCardGesturesInstalled)return;
  target.__handCardGesturesInstalled=true;

  const HOLD_MS=400;
  const DRAG_THRESHOLD=10;
  const TILT_SCALE=0.32;
  const TILT_MAX=14;
  const TILT_LERP=0.22;
  const SPREAD_ZONE_SLACK=72;
  const SLOT_HIT_PAD=28;
  const DETAIL_DRAG_DOWN_PX=80;

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
  const activeHand=()=>{
    const adapter=handAdapter();
    if(adapter?.getHand)return adapter.getHand()||[];
    const s=storeState();
    return [...((s?.run?.hand)||state?.hand||[])];
  };
  const isSpreadSlotOccupied=idx=>{
    const adapter=handAdapter();
    if(adapter?.isSpreadSlotOccupied)return !!adapter.isSpreadSlotOccupied(idx);
    return !!state.spread[idx];
  };
  const inSelectionMode=()=>!!(gestureTargeting()||purgeSelecting()||gestureBusy());
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
    g.inDetailZone=false;
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
      const cardCY=cardTop+g.cardHalfH;
      const nowDetail=(y-g.startY)>DETAIL_DRAG_DOWN_PX&&!isInSpreadZone(cardCY);
      if(nowDetail!==g.inDetailZone){g.inDetailZone=nowDetail;g.cardEl.classList.toggle('hand-card-detail-pull',nowDetail);}
    });
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
    const{uid,cardEl,origIndex,hoverIndex,mode,pendingUids=[],inDetailZone=false,originalParent,originalNextSibling}=g;
    let dropSlot=g.dropSlot;
    const wasDrag=mode==='drag';
    const wasSelectDrag=mode==='select-drag';
    const firstRect=wasDrag?cardEl.getBoundingClientRect():null;
    if(wasDrag&&committed&&g.lastDragEv){
      const last=calcDropTarget(g.lastDragEv.clientX,g.lastDragEv.clientY);
      if(last.inSpread)dropSlot=last.hit||null;
    }
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

    if(wasDrag&&committed&&inDetailZone){
      if(cardEl.parentNode!==originalParent){
        if(originalNextSibling&&originalNextSibling.parentNode===originalParent){
          originalParent.insertBefore(cardEl,originalNextSibling);
        }else{
          originalParent.appendChild(cardEl);
        }
      }
      applyNaturalSlots();
      slideLanding(cardEl,firstRect);
      const card=activeHand().find(c=>c.uid===uid)||null;
      if(card){
        const adapter=handAdapter();
        if(adapter?.showDetail)adapter.showDetail(card);
        else{
          const showDetail=typeof target.expandCard==='function'?target.expandCard:(typeof expandCard==='function'?expandCard:null);
          if(showDetail)showDetail(card,target);
        }
      }
      target.__handGestureSuppressClickUntil=performance.now()+800;
      return;
    }

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
