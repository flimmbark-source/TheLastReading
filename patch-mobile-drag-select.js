const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function upsertStyle(label, markerStart, markerEnd, css) {
  const block = `${markerStart}\n${css}\n${markerEnd}`;
  const re = new RegExp(markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

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
  const re = new RegExp(markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

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

upsertStyle(
  'mobile drag-select touch handling CSS',
  '/* mobile drag-select touch patch */',
  '/* end mobile drag-select touch patch */',
  `#hand .card,#spread .card[data-uid]{touch-action:none;-webkit-user-select:none;user-select:none}
body.mobile-drag-selecting #hand .card,body.mobile-drag-selecting #spread .card[data-uid]{animation:none!important;transition:none!important;translate:0 0!important}
body.mobile-drag-selecting #hand .card,body.mobile-drag-selecting #hand .card:hover,body.mobile-drag-selecting #hand .card:active,body.mobile-drag-selecting #hand .card.sel,body.mobile-drag-selecting #hand .card.ability-picked,body.mobile-drag-selecting #hand .card.press-highlight,body.mobile-drag-selecting #hand .card.purge-picked{transform:translate3d(0,0,0) rotate(var(--a))!important}
body.mobile-drag-selecting .hand{transform:none!important;translate:0 0!important;rotate:0deg!important;transition:none!important}
body.mobile-drag-selecting #hand .card.press-highlight,body.mobile-drag-selecting #hand .card:active{box-shadow:0 5px 14px rgba(0,0,0,.45)}
body.mobile-drag-selecting #hand .card.hint-card.press-highlight,body.mobile-drag-selecting #hand .card.hint-card:active{box-shadow:0 0 0 0.75px rgba(var(--hint-rgb,232,196,96),.95),0 0 28px rgba(var(--hint-rgb,232,196,96),.78),0 0 54px rgba(var(--hint-rgb,232,196,96),.36),0 5px 14px rgba(0,0,0,.45)}
body.mobile-drag-selecting #hand .card.hint-complete.press-highlight,body.mobile-drag-selecting #hand .card.hint-complete:active{box-shadow:0 0 0 1px rgba(var(--hint-rgb,255,217,120),1),0 0 36px rgba(var(--hint-rgb,255,217,120),.9),0 0 68px rgba(var(--hint-rgb,255,217,120),.48),0 5px 14px rgba(0,0,0,.45)}
body.mobile-drag-selecting #hand .card.hint-multi.press-highlight,body.mobile-drag-selecting #hand .card.hint-multi:active{box-shadow:var(--hint-shadow)!important}
body.mobile-drag-selecting .card.drag-select-preview{box-shadow:0 0 0 2px #d4af6a,0 10px 28px rgba(0,0,0,.75)!important;z-index:999!important}
body.mobile-drag-selecting .card.hint-card.drag-select-preview{box-shadow:0 0 0 2px #d4af6a,0 0 0 .75px rgba(var(--hint-rgb,232,196,96),.98),0 0 32px rgba(var(--hint-rgb,232,196,96),.86),0 0 58px rgba(var(--hint-rgb,232,196,96),.42),0 10px 28px rgba(0,0,0,.75)!important}
body.mobile-drag-selecting .card.hint-complete.drag-select-preview{box-shadow:0 0 0 2px #d4af6a,0 0 0 1px rgba(var(--hint-rgb,255,217,120),1),0 0 42px rgba(var(--hint-rgb,255,217,120),.95),0 0 76px rgba(var(--hint-rgb,255,217,120),.55),0 10px 28px rgba(0,0,0,.75)!important}
body.mobile-drag-selecting .card.hint-multi.drag-select-preview{box-shadow:0 0 0 2px #d4af6a,var(--hint-shadow)!important}
body.mobile-drag-selecting .card.drag-select-preview[data-hint]::after,body.mobile-drag-selecting .card.press-highlight[data-hint]::after{opacity:1}`
);

upsertScript(
  'mobile drag-select pointer handler',
  '/* mobile drag-select pointer handler patch */',
  '/* end mobile drag-select pointer handler patch */',
  `(function(){
  if(window.__mobileDragCardSelectInstalled)return;
  window.__mobileDragCardSelectInstalled=true;
  const DRAG_THRESHOLD=10;
  let drag=null;
  let suppressClickUntil=0;
  const isMobilePointer=ev=>ev.pointerType==='touch'||ev.pointerType==='pen';
  const clearPressHighlight=()=>document.querySelectorAll('.card.press-highlight').forEach(card=>card.classList.remove('press-highlight'));
  const enterDragSelectMode=()=>{document.body.classList.add('mobile-drag-selecting');};
  const leaveDragSelectMode=()=>{
    document.body.classList.remove('mobile-drag-selecting');
    document.querySelectorAll('.card.drag-select-preview').forEach(card=>card.classList.remove('drag-select-preview'));
  };
  const cardsAtPoint=(x,y)=>{
    const els=(document.elementsFromPoint?document.elementsFromPoint(x,y):[document.elementFromPoint(x,y)]).filter(Boolean);
    const cards=[];
    for(const el of els){
      const card=el instanceof Element?el.closest('#hand .card[data-uid],#spread .card[data-uid]'):null;
      if(card&&!cards.includes(card))cards.push(card);
    }
    return cards;
  };
  const cardByUid=uid=>[...state.hand,...state.spread.filter(Boolean)].find(c=>c.uid===uid)||null;
  const markPreview=cardEl=>{
    document.querySelectorAll('.card.drag-select-preview').forEach(card=>{if(card!==cardEl)card.classList.remove('drag-select-preview')});
    if(cardEl)cardEl.classList.add('drag-select-preview');
  };
  const queueUid=(arr,uid,max)=>{
    const next=arr.filter(id=>id!==uid);
    next.push(uid);
    while(next.length>max)next.shift();
    return next;
  };
  const queueCardFromDrag=cardEl=>{
    if(!drag||!cardEl)return false;
    const uid=Number(cardEl.dataset.uid);
    if(!Number.isFinite(uid)||uid===drag.lastUid)return false;
    const card=cardByUid(uid);
    if(!card)return false;
    const inHand=!!cardEl.closest('#hand');
    const inSpread=!!cardEl.closest('#spread');
    if(state.abilitySelect){
      const a=state.abilitySelect;
      if(!a.validIds.has(uid))return false;
      drag.pendingAbility=queueUid(drag.pendingAbility,uid,a.count);
      drag.lastUid=uid;
      markPreview(cardEl);
      return true;
    }
    if(state.purgeSelect!==null){
      if(!inHand)return false;
      drag.pendingPurge=queueUid(drag.pendingPurge,uid,3);
      drag.lastUid=uid;
      markPreview(cardEl);
      return true;
    }
    if(!inHand||inSpread||state.busy)return false;
    drag.pendingSelected=uid;
    drag.lastUid=uid;
    markPreview(cardEl);
    return true;
  };
  const commitDrag=()=>{
    if(!drag||!drag.didSelect)return;
    if(state.abilitySelect&&drag.pendingAbility.length){
      state.abilitySelect.picked=drag.pendingAbility.slice(-state.abilitySelect.count);
      refreshHandState();
    }else if(state.purgeSelect!==null&&drag.pendingPurge.length){
      state.purgeSelect=drag.pendingPurge.slice(0,3);
      render();
    }else if(drag.pendingSelected!==null&&drag.pendingSelected!==undefined){
      state.selected=drag.pendingSelected;
      refreshHandState();
    }
  };
  document.addEventListener('pointerdown',ev=>{
    if(!isMobilePointer(ev))return;
    const target=ev.target instanceof Element?ev.target:null;
    if(!target||!target.closest('#hand,#spread'))return;
    drag={pointerId:ev.pointerId,startX:ev.clientX,startY:ev.clientY,lastUid:null,active:false,didSelect:false,pendingSelected:null,pendingAbility:state.abilitySelect?[...state.abilitySelect.picked]:[],pendingPurge:state.purgeSelect!==null?[...state.purgeSelect]:[]};
    enterDragSelectMode();
  },true);
  document.addEventListener('pointermove',ev=>{
    if(!drag||ev.pointerId!==drag.pointerId)return;
    const dx=ev.clientX-drag.startX,dy=ev.clientY-drag.startY;
    if(!drag.active){
      if(Math.hypot(dx,dy)<DRAG_THRESHOLD)return;
      drag.active=true;
      clearPressHighlight();
    }
    ev.preventDefault();
    for(const cardEl of cardsAtPoint(ev.clientX,ev.clientY)){
      if(queueCardFromDrag(cardEl)){drag.didSelect=true;break;}
    }
  },{capture:true,passive:false});
  const finishDrag=()=>{
    const hadDrag=!!drag;
    commitDrag();
    if(drag&&drag.didSelect)suppressClickUntil=performance.now()+550;
    drag=null;
    if(hadDrag)leaveDragSelectMode();
  };
  document.addEventListener('pointerup',finishDrag,true);
  document.addEventListener('pointercancel',finishDrag,true);
  document.addEventListener('click',ev=>{
    if(performance.now()>suppressClickUntil)return;
    const target=ev.target instanceof Element?ev.target:null;
    if(target&&target.closest('#hand .card[data-uid],#spread .card[data-uid]')){
      ev.preventDefault();
      ev.stopPropagation();
    }
  },true);
})();`
);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched mobile finger drag selection to preview without re-render jitter and commit once on release.');
} else {
  console.log('No mobile drag-select patch changes needed.');
}
