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
  `#hand .card,#spread .card[data-uid]{touch-action:none;-webkit-user-select:none;user-select:none}`
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
  const selectCardFromDrag=cardEl=>{
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
      if(a.picked.includes(uid)){drag.lastUid=uid;return false;}
      if(a.picked.length>=a.count)a.picked.shift();
      a.picked.push(uid);
      drag.lastUid=uid;
      refreshHandState();
      return true;
    }
    if(state.purgeSelect!==null){
      if(!inHand)return false;
      if(state.purgeSelect.includes(uid)||state.purgeSelect.length>=3){drag.lastUid=uid;return false;}
      togglePurgeCard(uid);
      drag.lastUid=uid;
      return true;
    }
    if(!inHand||inSpread||state.busy)return false;
    if(state.selected!==uid){
      state.selected=uid;
      drag.lastUid=uid;
      refreshHandState();
      return true;
    }
    drag.lastUid=uid;
    return false;
  };
  document.addEventListener('pointerdown',ev=>{
    if(!isMobilePointer(ev))return;
    const target=ev.target instanceof Element?ev.target:null;
    if(!target||!target.closest('#hand,#spread'))return;
    drag={pointerId:ev.pointerId,startX:ev.clientX,startY:ev.clientY,lastUid:null,active:false,didSelect:false};
  },true);
  document.addEventListener('pointermove',ev=>{
    if(!drag||ev.pointerId!==drag.pointerId)return;
    const dx=ev.clientX-drag.startX,dy=ev.clientY-drag.startY;
    if(!drag.active){
      if(Math.hypot(dx,dy)<DRAG_THRESHOLD)return;
      drag.active=true;
    }
    ev.preventDefault();
    for(const cardEl of cardsAtPoint(ev.clientX,ev.clientY)){
      if(selectCardFromDrag(cardEl)){drag.didSelect=true;break;}
    }
  },{capture:true,passive:false});
  const finishDrag=()=>{
    if(drag&&drag.didSelect)suppressClickUntil=performance.now()+550;
    drag=null;
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
  console.log('Patched mobile finger drag across cards to select cards under the touch point.');
} else {
  console.log('No mobile drag-select patch changes needed.');
}
