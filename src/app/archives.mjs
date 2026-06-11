// Archives desk UI (Step 3e, Phase 16.4). Moved verbatim from index.html.
// Owns the draggable invTab, the desk item rendering/drag/naming flow, and
// the item detail overlay. toggleInventory/renderInventory are exported and
// installed on window by main.mjs (checkResonationTriggers and the attic
// module call them as globals). invOpen/invPos stay in the classic script:
// the inline closeArchives patch writes invOpen and checkResonationTriggers
// reads both through the global declarative environment.
/* global state, invOpen, invPos, INV_ITEMS, INV_FRAGMENTS,
   getUnlockedFragments, playSound, applyResonationGlows, _resStateKey */

let _saveInvTimer=null;function _saveInvPos(){clearTimeout(_saveInvTimer);_saveInvTimer=setTimeout(()=>{try{localStorage.setItem('tlr_inv_pos',JSON.stringify(invPos))}catch(e){}},300);}

export function toggleInventory(e){
  if(e)e.stopPropagation();
  invOpen=!invOpen;
  document.getElementById('invWrap').classList.toggle('open',invOpen);
  document.getElementById('invTab').innerHTML=invOpen?'&#9650; Archives':'&#9660; Archives';
  if(invOpen&&!localStorage.getItem('tlr_tut_inv_open')){
    localStorage.setItem('tlr_tut_inv_open','1');
    setTimeout(()=>showInvTut('Tap an item to reveal its name. Tap a named item to examine it closely.'),400);
  }
}

function showInvTut(text){
  const desk=document.getElementById('invDesk');if(!desk)return;
  document.querySelectorAll('.inv-tut').forEach(e=>e.remove());
  const el=document.createElement('div');el.className='inv-tut';el.textContent=text;
  desk.appendChild(el);setTimeout(()=>el.remove(),5000);
}

function initTabDrag(){
  const tab=document.getElementById('invTab');
  if(!tab)return;
  // Default: anchor right of the Abilities button; restore saved drag position if set
  function _defaultTabLeft(){
    const btn=document.getElementById('abilitiesBtn');
    if(btn){const r=btn.getBoundingClientRect();return Math.min(window.innerWidth-80,r.right+10);}
    return window.innerWidth/2-40;
  }
  const savedX=localStorage.getItem('tlr_tab_x');
  if(savedX!==null){
    tab.style.left=Math.max(0,Math.min(window.innerWidth-80,parseFloat(savedX)))+'px';
  }else{
    requestAnimationFrame(()=>{tab.style.left=_defaultTabLeft()+'px';});
  }
  let psx,tabStartX,moved=false,active=false;
  tab.addEventListener('pointerdown',e=>{
    e.stopPropagation();
    tab.setPointerCapture(e.pointerId);
    psx=e.clientX;
    tabStartX=parseFloat(tab.style.left)||tab.getBoundingClientRect().left;
    moved=false;active=true;
  });
  tab.addEventListener('pointermove',e=>{
    if(!active)return;
    const dx=e.clientX-psx;
    if(Math.abs(dx)>5)moved=true;
    if(!moved)return;
    const nx=Math.max(0,Math.min(window.innerWidth-80,tabStartX+dx));
    tab.style.left=nx+'px';
  });
  tab.addEventListener('pointerup',e=>{
    if(!active)return;
    active=false;
    if(moved){
      const nx=parseFloat(tab.style.left)||0;
      try{localStorage.setItem('tlr_tab_x',nx)}catch(e){}
    } else {
      toggleInventory(e);
    }
    moved=false;
  });
  // Keep tab in bounds on resize
  window.addEventListener('resize',()=>{
    const cur=parseFloat(tab.style.left)||0;
    const clamped=Math.max(0,Math.min(window.innerWidth-80,cur));
    if(clamped!==cur)tab.style.left=clamped+'px';
  });
}
setTimeout(initTabDrag,0);

export function renderInventory(){
  const desk=document.getElementById('invDesk');
  if(!desk)return;
  desk.innerHTML='';
  const foundAtticItems=(()=>{try{return JSON.parse(localStorage.getItem('tlr_attic_found_items')||'[]')}catch(e){return []}})();const allItems=[...INV_ITEMS.filter(item=>foundAtticItems.includes(item.id)),...getUnlockedFragments().map(id=>INV_FRAGMENTS[id]).filter(Boolean)];
  allItems.forEach((item,idx)=>{
    let pos=invPos[item.id];
    if(!pos){
      const rot=(Math.random()*32-16);
      const dw=desk.clientWidth||320;
      const cx=Math.max(20,dw/2-40);
      pos={x:cx+(Math.random()*40-20),y:20+(Math.random()*24-12),rot,named:false};
      invPos[item.id]=pos;
      _saveInvPos();
    }
    const el=document.createElement('div');
    el.className='inv-item'+(pos.named?' named':'');
    el.dataset.invId=item.id;
    el.style.cssText='left:'+pos.x+'px;top:'+pos.y+'px;transform:rotate('+pos.rot+'deg)';
    const iconHtml=item.image?'<img class="inv-item-img" src="'+item.image+'" alt="">':`<span class="inv-item-emoji">${item.emoji}</span>`;
    el.innerHTML='<div class="inv-item-paper">'+iconHtml+'<span class="inv-item-type">'+item.type+'</span><span class="inv-item-name">'+item.title+'</span></div>';
    let psx,psy,esx,esy,dw,dh,iw,ih,moved=false,active=false;
    el.addEventListener('pointerdown',e=>{
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      psx=e.clientX;psy=e.clientY;
      esx=parseFloat(el.style.left)||0;esy=parseFloat(el.style.top)||0;
      const desk=document.getElementById('invDesk');
      dw=desk?desk.clientWidth:window.innerWidth;
      dh=desk?desk.clientHeight:300;
      iw=el.offsetWidth||84;ih=el.offsetHeight||100;
      moved=false;active=true;el.style.zIndex=50;
    });
    el.addEventListener('pointermove',e=>{
      if(!active)return;
      const dx=e.clientX-psx,dy=e.clientY-psy;
      if(Math.hypot(dx,dy)>12)moved=true;
      if(!moved)return;
      const margin=24;
      el.style.left=Math.max(-iw+margin,Math.min(dw-margin,esx+dx))+'px';
      el.style.top=Math.max(0,Math.min(dh-margin,esy+dy))+'px';
    });
    el.addEventListener('pointerup',e=>{
      if(!active)return;
      active=false;el.style.zIndex='';
      const nx=parseFloat(el.style.left)||0,ny=parseFloat(el.style.top)||0;
      invPos[item.id]={...invPos[item.id],x:nx,y:ny};
      _saveInvPos();
      if(!moved){
        e.stopPropagation();
        if(el.classList.contains('named')){
          openInvDetail(item);
        } else {
          playSound('scratch');
          el.classList.add('named');
          invPos[item.id].named=true;
          _saveInvPos();
          _resStateKey=null;applyResonationGlows(state.spread);
          if(!localStorage.getItem('tlr_tut_inv_name')){
            localStorage.setItem('tlr_tut_inv_name','1');
            setTimeout(()=>showInvTut('Item identified. Tap it again to examine it closely.'),300);
          }
        }
      }
      moved=false;
    });
    desk.appendChild(el);
  });
}

function openInvDetail(item){
  document.querySelectorAll('.inv-detail-bg').forEach(e=>e.remove());
  const bg=document.createElement('div');
  bg.className='inv-detail-bg';
  if(item.imageFull){
    const wrap=document.createElement('div');
    wrap.className='inv-detail-fullart-wrap';
    wrap.innerHTML='<img class="inv-detail-fullart" src="'+item.imageFull+'" alt="'+item.title+'">'
      +(item.content?'<div class="inv-detail-text-overlay"><div class="inv-detail-text-overlay-inner">'+item.content+'</div></div>':'');
    bg.appendChild(wrap);
    if(item.content){
      wrap.addEventListener('click',e=>{
        e.stopPropagation();
        const ov=wrap.querySelector('.inv-detail-text-overlay');
        if(ov)ov.classList.toggle('visible');
      });
    }
  }else{
    bg.innerHTML='<div class="inv-detail-box"><button class="inv-detail-close" onclick="this.closest(\'.inv-detail-bg\').remove()">&#x2715;</button><div class="inv-detail-type">'+item.type+'</div><h2 class="inv-detail-title">'+item.title+'</h2><div class="inv-detail-content">'+item.content+'</div></div>';
  }
  if(item.imageFull&&item.content&&!localStorage.getItem('tlr_tut_inv_detail')){
    localStorage.setItem('tlr_tut_inv_detail','1');
    const tb=document.createElement('div');
    tb.style.cssText='position:absolute;bottom:22px;left:50%;transform:translateX(-50%);background:rgba(22,14,6,.97);border:1px solid #856536;border-radius:8px;padding:9px 16px;font-size:11px;color:#d0bc8c;text-align:center;white-space:nowrap;pointer-events:none;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,.7)';
    tb.textContent='Tap the image to read the notes. Tap outside to close.';
    bg.appendChild(tb);setTimeout(()=>tb.remove(),5500);
  }
  const openedAt=Date.now();
  bg.addEventListener('click',e=>{if(Date.now()-openedAt<350)return;if(e.target===bg)bg.remove()});
  document.body.appendChild(bg);
}

// Initial desk render once dataGlobals.mjs has installed INV_ITEMS on window.
// The event is dispatched on window (not document), so listen there.
window.addEventListener('tlr-architecture-bridge-ready',()=>renderInventory(),{once:true});
