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
  // Second way to activate: hold the card against a screen edge and release. A
  // slow carry to the edge counts even without a throw. Side strips are kept thin
  // so they clear the fanned hand's edge cards / reorder targets.
  const EDGE_BOTTOM_PX=84;          // card center within this of the bottom edge
  const EDGE_SIDE_PX=30;            // ...or this of the left/right edge

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
    // Cached once: whether this card can flick its ability. It cannot change mid
    // drag, so we avoid querying the store on every animation frame.
    g.flickEligible=abilityFlickAllowed(g.uid);
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
      updateFlickArming(x,y,inSpread);
    });
  };

  const abilityFlickAllowed=uid=>typeof target.canDiscardCardUid==='function'&&target.canDiscardCardUid(uid);

  // Held against a screen edge: the bottom edge (below / on the hand), or the
  // thin left / right strips beside the hand. Measured at the finger, not the
  // card centre -- the card is wide, so its centre can't reach the edge, but the
  // finger dragging it there is the natural "hold it to the edge" gesture.
  const inEdgeZone=(x,y)=>
    y>=target.innerHeight-EDGE_BOTTOM_PX||x<=EDGE_SIDE_PX||x>=target.innerWidth-EDGE_SIDE_PX;

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

  // Activation on release: either a fast throw (measured over the release
  // window) OR the card held against a screen edge. Neither counts when the card
  // is being placed into the spread. `inSpread` (from calcDropTarget) means "over
  // a slot or up in the spread zone" -- a play, not an activation. flickEligible
  // is cached at drag start so we don't hit the store every frame.
  const detectAbilityFlick=ev=>{
    if(!g||g.mode!=='drag'||!g.flickEligible)return false;
    const drop=calcDropTarget(ev.clientX,ev.clientY);
    if(drop.inSpread&&drop.hit)return false;               // over an actual slot: placement wins
    // Held against a screen edge -- unambiguous even in the spread-zone band,
    // since the edge strips never sit over a centre slot.
    if(inEdgeZone(ev.clientX,ev.clientY)){
      g.flickVec={x:0,y:1,speed:FLICK_ACTIVATE_SPEED};
      return true;
    }
    // A fast throw, as long as it is not aimed up into the spread zone.
    if(!drop.inSpread&&performance.now()-g.dragStartTime>=FLICK_MIN_DRAG_MS){
      const m=flickWindowMetrics(ev.clientX,ev.clientY,performance.now());
      if(m&&m.ms>=FLICK_MIN_WINDOW_MS&&m.speed>=FLICK_ACTIVATE_SPEED){
        g.flickVec={x:m.dx,y:m.dy,speed:m.speed};
        return true;
      }
    }
    return false;
  };

  // Glow the card the instant it crosses the arm speed OR reaches a screen edge,
  // so activation reads as reactive before release. Feedback lives on the card,
  // nowhere else. Reuses the inSpread already computed by stepDrag.
  const updateFlickArming=(nowX,nowY,inSpread)=>{
    if(!g)return;
    let armed=false;
    if(g.flickEligible&&!g.dropSlot){
      // Edge hold arms regardless of the spread zone (the edge is never a slot);
      // the velocity throw only counts when not aimed up into the spread.
      if(inEdgeZone(nowX,nowY))armed=true;
      else if(!inSpread){
        const m=flickWindowMetrics(nowX,nowY,performance.now());
        // Hysteresis: a little easier to stay armed than to arm in the first place.
        const gate=g.flickArmed?FLICK_ARM_SPEED*0.72:FLICK_ARM_SPEED;
        armed=!!m&&m.ms>=FLICK_MIN_WINDOW_MS&&m.speed>=gate;
      }
    }
    if(armed!==g.flickArmed){
      g.flickArmed=armed;
      g.cardEl.classList.toggle('ability-flick-arming',armed);
      // Inline the glow too, so the on-card "armed" feedback shows even if the
      // gesture stylesheet is not served/loaded in the host environment.
      if(armed){
        // Light-weight while the card is moving fast: one GPU drop-shadow for the
        // glow and a blur-less ring, instead of stacked blurred box-shadows.
        g.cardEl.style.setProperty('filter','brightness(1.34) saturate(1.12) drop-shadow(0 0 16px rgba(255,162,68,.95))','important');
        g.cardEl.style.setProperty('box-shadow','0 0 0 2px rgba(255,232,168,.95)','important');
      }else{
        g.cardEl.style.removeProperty('filter');
        g.cardEl.style.removeProperty('box-shadow');
      }
      if(armed&&!g.flickHapticDone){g.flickHapticDone=true;if(typeof target.haptic==='function')target.haptic(8);}
      if(!armed)g.flickHapticDone=false;
    }
  };

  // A bright expanding flare + shockwave ring at the anchor point. All styling
  // is inlined (not reliant on any stylesheet being served/fresh), screen-blended
  // over the dark table so the activation is unmistakable.
  const spawnFlickBurst=(cx,cy)=>{
    const burst=document.createElement('div');
    burst.className='ability-flick-burst';
    Object.assign(burst.style,{
      position:'fixed',left:cx+'px',top:cy+'px',width:'220px',height:'220px',
      borderRadius:'50%',zIndex:'100000',pointerEvents:'none',mixBlendMode:'screen',
      transform:'translate(-50%,-50%) scale(0.25)',willChange:'transform,opacity',
      background:'radial-gradient(circle,rgba(255,244,206,.98) 0%,rgba(255,168,74,.72) 26%,rgba(255,96,32,.34) 52%,rgba(255,96,32,0) 70%)',
    });
    const ring=document.createElement('div');
    Object.assign(ring.style,{
      position:'absolute',inset:'24%',borderRadius:'50%',
      border:'3px solid rgba(255,230,166,.95)',
      boxShadow:'0 0 22px rgba(255,170,74,.9),inset 0 0 18px rgba(255,190,100,.7)',
    });
    burst.appendChild(ring);
    document.body.appendChild(burst);
    const anim=burst.animate?.([
      {transform:'translate(-50%,-50%) scale(0.25)',opacity:0,offset:0},
      {transform:'translate(-50%,-50%) scale(1.05)',opacity:1,offset:0.22},
      {transform:'translate(-50%,-50%) scale(2.7)',opacity:0,offset:1},
    ],{duration:340,easing:'cubic-bezier(.15,.7,.25,1)',fill:'forwards'});
    const done=()=>burst.remove();
    if(anim&&anim.finished&&typeof anim.finished.finally==='function')anim.finished.finally(done);
    else setTimeout(done,380);
  };

  const commitAbilityFlick=ev=>{
    const uid=g.uid;
    const cardEl=g.cardEl;
    const rect=cardEl.getBoundingClientRect();
    // Where the pop + burst play. A downward flick releases near the bottom edge
    // (over the busy table rim), so instead of flying further down and off-screen
    // the card rises a little in the throw direction into the visible play area,
    // over the dark starfield where the screen-blended burst reads brightest.
    const vec=g.flickVec||{x:0,y:1,speed:FLICK_ACTIVATE_SPEED};
    const mag=Math.hypot(vec.x,vec.y)||1;
    const ux=vec.x/mag,uy=vec.y/mag;
    const spinDeg=(ux>=0?1:-1)*Math.min(18,vec.speed*0.01);
    const startCX=rect.left+rect.width/2,startCY=rect.top+rect.height/2;
    const vw=target.innerWidth,vh=target.innerHeight;
    const drift=Math.max(24,Math.min(72,vec.speed*0.035));
    const anchorX=Math.max(vw*0.14,Math.min(vw*0.86,startCX+ux*drift));
    const anchorY=Math.max(vh*0.28,Math.min(vh*0.60,startCY+uy*drift));
    const dx=anchorX-startCX,dy=anchorY-startCY;
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
    ['transform','left','top','right','bottom','width','height','margin','position','z-index','filter','box-shadow'].forEach(p=>ghost.style.removeProperty(p));
    ghost.style.setProperty('position','fixed','important');
    ghost.style.setProperty('left',rect.left+'px','important');
    ghost.style.setProperty('top',rect.top+'px','important');
    ghost.style.setProperty('width',rect.width+'px','important');
    ghost.style.setProperty('height',rect.height+'px','important');
    ghost.style.setProperty('margin','0','important');
    ghost.style.setProperty('z-index','100001','important');
    ghost.style.setProperty('pointer-events','none','important');
    // Static glow set once (animating filter/drop-shadow every frame is the
    // expensive path); the pop then animates only transform + opacity, which the
    // compositor can run on the GPU without per-frame re-rasterization.
    ghost.style.setProperty('filter','brightness(1.6) saturate(1.1) drop-shadow(0 0 22px rgba(255,182,92,.95))','important');
    ghost.style.setProperty('will-change','transform,opacity','important');
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

    // The unmistakable part: a bright burst radiating from the anchor point.
    spawnFlickBurst(anchorX,anchorY);

    // The card rises into the play area along the throw, swells, then dissolves.
    // Transform + opacity only, so it stays smooth on the compositor.
    const anim=ghost.animate?.([
      {transform:'translate(0,0) scale(1) rotate(0deg)',opacity:1,offset:0},
      {transform:`translate(${(dx*0.6).toFixed(1)}px,${(dy*0.6).toFixed(1)}px) scale(1.2) rotate(${(spinDeg*0.5).toFixed(1)}deg)`,opacity:1,offset:0.45},
      {transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(1.55) rotate(${spinDeg.toFixed(1)}deg)`,opacity:0,offset:1},
    ],{duration:260,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
    const cleanup=()=>ghost.remove();
    if(anim&&anim.finished&&typeof anim.finished.finally==='function')anim.finished.finally(cleanup);
    else setTimeout(cleanup,310);

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

  // If a drag ends without placing, reordering or removing the card, the card is
  // still parented to <body> from startDrag. Left there with its fixed position
  // stripped it would fall into normal flow at the page's top-left for a frame.
  // Put it back where it came from in the hand so it never flashes in the corner.
  const restoreOrphanCard=(cardEl,originalParent,originalNextSibling)=>{
    if(!cardEl||!cardEl.isConnected||cardEl.parentNode!==document.body)return;
    if(!originalParent||!originalParent.isConnected)return;
    if(originalNextSibling&&originalNextSibling.parentNode===originalParent)originalParent.insertBefore(cardEl,originalNextSibling);
    else originalParent.appendChild(cardEl);
    applyNaturalSlots();
  };

  const endDrag=committed=>{
    if(!g)return;
    cancelHold();
    const{uid,cardEl,origIndex,hoverIndex,mode,pendingUids=[],originalParent,originalNextSibling}=g;
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
    cardEl.style.removeProperty('filter');
    cardEl.style.removeProperty('box-shadow');
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
      restoreOrphanCard(cardEl,originalParent,originalNextSibling);
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

    restoreOrphanCard(cardEl,originalParent,originalNextSibling);
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
