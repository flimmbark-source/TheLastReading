import { cardHTML, applyCardPhoto, CARD_SHEET } from './renderCard.mjs';

const STYLE_ID='tlr-card-activation-fx-style';
const LAYER_ID='tlrCardActivationLayer';
const CARD_DURATION_MS=300;
const BURST_DURATION_MS=280;

function nextFrame(target){
  return new Promise(resolve=>{
    const raf=target.requestAnimationFrame||globalThis.requestAnimationFrame;
    if(typeof raf==='function')raf.call(target,()=>resolve());
    else setTimeout(resolve,16);
  });
}

function reducedMotion(target){
  return !!target.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function rectSnapshot(rect){
  if(!rect)return null;
  return {
    left:Number(rect.left)||0,
    top:Number(rect.top)||0,
    width:Math.max(1,Number(rect.width)||1),
    height:Math.max(1,Number(rect.height)||1),
  };
}

export function calculateCardActivationMotion({startRect,vector,viewportWidth,viewportHeight}){
  const rect=rectSnapshot(startRect)||{left:0,top:0,width:1,height:1};
  const vx=Number(vector?.x)||0;
  const vy=Number(vector?.y)||1;
  const speed=Math.max(1,Number(vector?.speed)||940);
  const magnitude=Math.hypot(vx,vy)||1;
  const ux=vx/magnitude;
  const uy=vy/magnitude;
  const startCenterX=rect.left+rect.width/2;
  const startCenterY=rect.top+rect.height/2;
  const width=Math.max(1,Number(viewportWidth)||1);
  const height=Math.max(1,Number(viewportHeight)||1);
  const drift=Math.max(28,Math.min(76,speed*0.036));
  const anchorX=Math.max(width*0.14,Math.min(width*0.86,startCenterX+ux*drift));
  const anchorY=Math.max(height*0.27,Math.min(height*0.60,startCenterY+uy*drift));
  return {
    dx:anchorX-startCenterX,
    dy:anchorY-startCenterY,
    anchorX,
    anchorY,
    spinDeg:(ux>=0?1:-1)*Math.min(16,speed*0.009),
  };
}

function ensureStyle(doc){
  if(!doc||doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #${LAYER_ID}{
      position:fixed;
      inset:0;
      z-index:100001;
      pointer-events:none;
      overflow:hidden;
      contain:layout paint style;
      isolation:isolate;
    }
    body.card-activation-pending #${LAYER_ID}{pointer-events:auto}
    .card.hand-card-dragging.tlr-ability-flick-armed{
      box-shadow:0 0 0 2px rgba(255,232,168,.95)!important;
    }
    .card.hand-card-dragging.tlr-ability-flick-armed::after{
      content:'';
      position:absolute;
      inset:-5px;
      z-index:3;
      border:2px solid rgba(255,184,91,.72);
      border-radius:14px;
      background:radial-gradient(ellipse at center,rgba(255,176,70,.18),transparent 70%);
      pointer-events:none;
    }
    #${LAYER_ID} .tlr-card-activation-proxy{
      position:absolute;
      display:block;
      margin:0;
      opacity:0;
      pointer-events:none;
      transform-origin:50% 50%;
      backface-visibility:hidden;
      will-change:transform,opacity;
      contain:layout paint style;
      border-radius:10px;
    }
    #${LAYER_ID} .tlr-card-activation-proxy[hidden],
    #${LAYER_ID} .tlr-card-activation-burst[hidden]{display:none!important}
    #${LAYER_ID} .tlr-card-activation-proxy>.card{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      height:100%!important;
      margin:0!important;
      transform:none!important;
      transition:none!important;
      animation:none!important;
      pointer-events:none!important;
      backface-visibility:hidden!important;
    }
    #${LAYER_ID} .tlr-card-activation-glow{
      position:absolute;
      inset:-5px;
      border:2px solid rgba(255,225,151,.94);
      border-radius:inherit;
      background:radial-gradient(ellipse at center,rgba(255,180,72,.22),rgba(255,128,32,.08) 58%,transparent 72%);
      opacity:.96;
      pointer-events:none;
    }
    #${LAYER_ID} .tlr-card-activation-burst{
      position:absolute;
      width:150px;
      height:150px;
      margin:-75px 0 0 -75px;
      border-radius:50%;
      border:2px solid rgba(255,224,151,.94);
      background:radial-gradient(circle,rgba(255,242,199,.90) 0 8%,rgba(255,168,70,.58) 9% 28%,rgba(255,116,34,.20) 29% 52%,transparent 53%);
      opacity:0;
      pointer-events:none;
      transform-origin:50% 50%;
      backface-visibility:hidden;
      will-change:transform,opacity;
      contain:strict;
    }
    #${LAYER_ID} .tlr-card-activation-burst::after{
      content:'';
      position:absolute;
      inset:27%;
      border:2px solid rgba(255,241,202,.88);
      border-radius:50%;
    }
  `;
  doc.head?.appendChild(style);
}

function ensureLayer(target){
  const doc=target.document;
  if(!doc)return null;
  ensureStyle(doc);
  let layer=doc.getElementById(LAYER_ID);
  if(layer)return layer;
  layer=doc.createElement('div');
  layer.id=LAYER_ID;
  layer.setAttribute('aria-hidden','true');

  const proxy=doc.createElement('div');
  proxy.className='tlr-card-activation-proxy';
  proxy.hidden=true;
  const visual=doc.createElement('div');
  visual.className='card tlr-card-activation-card';
  const glow=doc.createElement('div');
  glow.className='tlr-card-activation-glow';
  proxy.append(visual,glow);

  const burst=doc.createElement('div');
  burst.className='tlr-card-activation-burst';
  burst.hidden=true;
  layer.append(proxy,burst);
  doc.body.appendChild(layer);
  return layer;
}

function nodes(target){
  const layer=ensureLayer(target);
  if(!layer)return{};
  return {
    layer,
    proxy:layer.querySelector('.tlr-card-activation-proxy'),
    visual:layer.querySelector('.tlr-card-activation-card'),
    burst:layer.querySelector('.tlr-card-activation-burst'),
  };
}

function renderPreparedCard(target,card){
  const {proxy,visual}=nodes(target);
  if(!proxy||!visual||!card)return false;
  visual.className='card tlr-card-activation-card '+(card.type==='major'?'major ':'')+(CARD_SHEET[card.id]?'photo ':'');
  visual.innerHTML=cardHTML(card);
  visual.style.removeProperty('background-image');
  visual.style.removeProperty('background-position');
  if(CARD_SHEET[card.id])applyCardPhoto(visual,card);
  proxy.dataset.cardUid=String(card.uid);
  return true;
}

function settleAnimation(animation,duration){
  if(animation?.finished&&typeof animation.finished.then==='function'){
    return animation.finished.catch(()=>undefined);
  }
  return new Promise(resolve=>setTimeout(resolve,duration));
}

async function playCardActivation(target,transaction){
  const {proxy,burst}=nodes(target);
  if(!proxy||!burst)return;
  const rect=rectSnapshot(transaction.startRect);
  if(!rect)return;
  if(proxy.dataset.cardUid!==String(transaction.card.uid))renderPreparedCard(target,transaction.card);

  const motion=calculateCardActivationMotion({
    startRect:rect,
    vector:transaction.vector,
    viewportWidth:target.innerWidth,
    viewportHeight:target.innerHeight,
  });
  proxy.style.left=rect.left+'px';
  proxy.style.top=rect.top+'px';
  proxy.style.width=rect.width+'px';
  proxy.style.height=rect.height+'px';
  proxy.style.opacity='1';
  proxy.style.transform='translate3d(0,0,0) scale(1) rotate('+(Number(transaction.startTiltDeg)||0).toFixed(2)+'deg)';
  proxy.hidden=false;

  burst.style.left=motion.anchorX+'px';
  burst.style.top=motion.anchorY+'px';
  burst.style.opacity='0';
  burst.style.transform='translate3d(0,0,0) scale(.35)';
  burst.hidden=false;

  await nextFrame(target);
  if(reducedMotion(target))return;

  const cardAnimation=proxy.animate?.([
    {transform:`translate3d(0,0,0) scale(1) rotate(${(Number(transaction.startTiltDeg)||0).toFixed(2)}deg)`,opacity:1,offset:0},
    {transform:`translate3d(${(motion.dx*.58).toFixed(1)}px,${(motion.dy*.58).toFixed(1)}px,0) scale(1.15) rotate(${(motion.spinDeg*.55).toFixed(1)}deg)`,opacity:1,offset:.54},
    {transform:`translate3d(${motion.dx.toFixed(1)}px,${motion.dy.toFixed(1)}px,0) scale(1.38) rotate(${motion.spinDeg.toFixed(1)}deg)`,opacity:0,offset:1},
  ],{duration:CARD_DURATION_MS,easing:'cubic-bezier(.18,.72,.24,1)',fill:'forwards'});
  const burstAnimation=burst.animate?.([
    {transform:'translate3d(0,0,0) scale(.35)',opacity:0,offset:0},
    {transform:'translate3d(0,0,0) scale(.92)',opacity:.94,offset:.28},
    {transform:'translate3d(0,0,0) scale(1.7)',opacity:0,offset:1},
  ],{duration:BURST_DURATION_MS,easing:'cubic-bezier(.15,.7,.25,1)',fill:'forwards'});

  await Promise.all([
    settleAnimation(cardAnimation,CARD_DURATION_MS),
    settleAnimation(burstAnimation,BURST_DURATION_MS),
  ]);
}

function resetVisual(target){
  const {proxy,burst}=nodes(target);
  if(proxy){
    proxy.getAnimations?.().forEach(animation=>animation.cancel());
    proxy.hidden=true;
    proxy.style.cssText='';
  }
  if(burst){
    burst.getAnimations?.().forEach(animation=>animation.cancel());
    burst.hidden=true;
    burst.style.cssText='';
  }
}

export function installCardActivationFx(target=window){
  if(!target||target.__tlrCardActivationFxInstalled)return target?.tlrCardActivationFx||null;
  target.__tlrCardActivationFxInstalled=true;
  ensureLayer(target);
  let pending=null;

  const prepare=card=>{
    if(!card||pending)return false;
    return renderPreparedCard(target,card);
  };
  const cancelPrepared=uid=>{
    if(pending)return false;
    const {proxy}=nodes(target);
    if(!proxy)return false;
    if(uid==null||proxy.dataset.cardUid===String(uid)){
      proxy.hidden=true;
      return true;
    }
    return false;
  };
  const activate=async transaction=>{
    if(pending||!transaction?.card||!transaction?.startRect)return false;
    const uid=transaction.cardUid??transaction.card.uid;
    if(typeof target.canDiscardCardUid==='function'&&!target.canDiscardCardUid(uid)){
      cancelPrepared(uid);
      if(typeof target.render==='function')target.render();
      return false;
    }
    pending={uid};
    target.__tlrCardActivationPending=true;
    target.__tlrCardActivationPendingUid=uid;
    target.document?.body?.classList.add('card-activation-pending');
    let committed=false;
    try{
      await playCardActivation(target,{...transaction,cardUid:uid});
      // Release the presentation lock immediately before the synchronous gameplay
      // commit. No user event can interleave within this task, while discard logic
      // can still pass its normal busy/eligibility checks.
      target.__tlrCardActivationPending=false;
      delete target.__tlrCardActivationPendingUid;
      committed=typeof target.discardCardUid==='function'&&!!target.discardCardUid(uid);
      if(!committed&&typeof target.render==='function')target.render();
      return committed;
    }catch(error){
      console.error('Card activation failed',error);
      if(typeof target.render==='function')target.render();
      return false;
    }finally{
      resetVisual(target);
      pending=null;
      target.__tlrCardActivationPending=false;
      delete target.__tlrCardActivationPendingUid;
      target.document?.body?.classList.remove('card-activation-pending');
    }
  };

  const api={prepare,cancelPrepared,activate,isPending:()=>!!pending};
  target.tlrCardActivationFx=api;
  target.tlrPrepareCardActivation=prepare;
  target.tlrCancelPreparedCardActivation=cancelPrepared;
  target.tlrActivateCardFromGesture=activate;
  return api;
}
