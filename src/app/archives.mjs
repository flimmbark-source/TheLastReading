// Archives desk UI. Owns the draggable invTab, the desk item rendering/drag/
// naming flow, and the item detail overlay. toggleInventory/renderInventory
// are exported and installed on window by main.mjs (checkResonationTriggers
// and the attic module call them as globals; startApp performs the initial
// desk render). invOpen/invPos are window globals seeded by runtimeState.mjs:
// atticFlow's closeArchives writes invOpen and checkResonationTriggers reads
// both through the global declarative environment.
/* global state, invOpen, invPos, INV_ITEMS, INV_FRAGMENTS,
   getUnlockedFragments, playSound, applyResonationGlows */

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

// ── Resonation vault ────────────────────────────────────────────────────────
// When a puzzle resonation completes for the first time, its archive items
// are moved out of the current drawer into a per-resonation record
// (tlr_resonation_vault). The vault screen (tlrOpenDrawerVault) lets the
// player point the drawer back at any completed resonation's items.

const VAULT_KEY='tlr_resonation_vault';
let _drawerView=null; // null = current drawer, otherwise a vaulted resonation id

export function tlrReadResonationVault(){
  try{
    const v=JSON.parse(localStorage.getItem(VAULT_KEY)||'{}');
    return v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  }catch(e){return {};}
}

export function tlrVaultResonationItems(resId,itemIds){
  if(!resId||!Array.isArray(itemIds)||!itemIds.length)return false;
  const vault=tlrReadResonationVault();
  if(vault[resId])return false; // only the first completion moves the items
  vault[resId]=itemIds.slice();
  try{localStorage.setItem(VAULT_KEY,JSON.stringify(vault))}catch(e){}
  try{
    const key='tlr_attic_found_items';
    let arr;try{arr=JSON.parse(localStorage.getItem(key)||'[]')}catch(e){arr=null}
    if(Array.isArray(arr))localStorage.setItem(key,JSON.stringify(arr.filter(id=>!itemIds.includes(id))));
  }catch(e){}
  renderInventory();
  return true;
}

// Placeholder gate for the first meta puzzle: the vault icon only appears
// once a resonation is vaulted AND this flag is set. Call
// tlrSolveMetaPuzzle() from the future meta-puzzle code when it is solved.
export function tlrMetaPuzzleSolved(id=1){
  try{return !!localStorage.getItem('tlr_meta_puzzle_'+id)}catch(e){return false}
}
export function tlrSolveMetaPuzzle(id=1){
  try{localStorage.setItem('tlr_meta_puzzle_'+id,'1')}catch(e){}
  renderInventory();
}

export function tlrGetDrawerView(){return _drawerView;}
export function tlrSetDrawerView(resId){_drawerView=resId||null;renderInventory();}
export function tlrResetDrawerView(){if(_drawerView!==null){_drawerView=null;renderInventory();}}

export function tlrOpenDrawerVault(){
  document.querySelectorAll('.res-vault-bg').forEach(e=>e.remove());
  const vault=tlrReadResonationVault();
  const bg=document.createElement('div');
  bg.className='res-vault-bg';
  const screen=document.createElement('div');
  screen.className='res-vault-screen';
  // Chain grows upward from the drawer node: first-solved sits closest to
  // the center, later ones stack above it.
  let chain='';
  Object.keys(vault).slice().reverse().forEach(id=>{
    const res=(window.RESONATIONS||[]).find(r=>r.id===id);
    chain+='<button type="button" class="res-vault-node'+(_drawerView===id?' active':'')+'" data-res-id="'+id+'"><span>'+(res?res.name:id)+'</span></button>'
      +'<span class="res-vault-link"></span>';
  });
  chain+='<button type="button" class="res-vault-node res-vault-node-center'+(_drawerView?'':' active')+'" data-res-id=""><span>Current Drawer</span></button>';
  screen.innerHTML='<button class="res-vault-close" type="button" aria-label="Close">&#x2715;</button>'
    +'<h3>Remembrance</h3>'
    +'<p class="res-vault-hint">Choose a memory to lay its pieces back on the desk. The drawer below returns you to the present.</p>'
    +'<div class="res-vault-chain">'+chain+'</div>';
  bg.appendChild(screen);
  bg.addEventListener('click',e=>{if(e.target===bg)bg.remove();});
  screen.querySelector('.res-vault-close').addEventListener('click',()=>bg.remove());
  screen.querySelectorAll('.res-vault-node').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      tlrSetDrawerView(btn.dataset.resId||null);
      bg.remove();
      const wrap=document.getElementById('invWrap');
      if(wrap&&!wrap.classList.contains('open'))wrap.classList.add('open');
    });
  });
  document.body.appendChild(bg);
}

export function renderInventory(){
  const desk=document.getElementById('invDesk');
  if(!desk)return;
  desk.innerHTML='';
  // Deck-of-cards button, top right of the desk: opens the read-only card
  // browser. The open drawer (z 10095) outranks the choice modal (z 10080),
  // so close the drawer before handing off to the browser.
  const deckBtn=document.createElement('button');
  deckBtn.type='button';
  deckBtn.className='inv-deck-btn';
  deckBtn.setAttribute('aria-label','Look through the deck of cards');
  deckBtn.innerHTML='<span class="inv-deck-btn-card"></span><span class="inv-deck-btn-card"></span>';
  deckBtn.addEventListener('pointerdown',e=>e.stopPropagation());
  deckBtn.addEventListener('click',e=>{
    e.stopPropagation();
    // tlrCloseArchives covers both open paths (classic invTab sets invOpen,
    // SPv2's archive button only toggles the class).
    if(window.tlrCloseArchives)window.tlrCloseArchives();
    else if(invOpen)toggleInventory();
    window.tlrBrowseDeck?.();
  });
  desk.appendChild(deckBtn);

  const vault=tlrReadResonationVault();
  if(_drawerView&&!vault[_drawerView])_drawerView=null;
  if(Object.keys(vault).length&&tlrMetaPuzzleSolved(1)){
    const vaultBtn=document.createElement('button');
    vaultBtn.type='button';
    vaultBtn.className='inv-vault-btn';
    vaultBtn.setAttribute('aria-label','Open the drawer memories');
    vaultBtn.innerHTML='<span class="inv-vault-node inv-vault-node-top"></span><span class="inv-vault-node inv-vault-node-mid"></span><span class="inv-vault-node inv-vault-node-base"></span>';
    vaultBtn.addEventListener('pointerdown',e=>e.stopPropagation());
    vaultBtn.addEventListener('click',e=>{e.stopPropagation();tlrOpenDrawerVault();});
    desk.appendChild(vaultBtn);
  }

  if(_drawerView){
    const res=(window.RESONATIONS||[]).find(r=>r.id===_drawerView);
    const chip=document.createElement('div');
    chip.className='inv-view-chip';
    chip.textContent=res?res.name:_drawerView;
    desk.appendChild(chip);
    (vault[_drawerView]||[]).map(id=>INV_ITEMS.find(i=>i.id===id)).filter(Boolean)
      .forEach(item=>renderDeskItem(desk,item,true));
    return;
  }

  const foundAtticItems=(()=>{try{return JSON.parse(localStorage.getItem('tlr_attic_found_items')||'[]')}catch(e){return []}})();const allItems=[...INV_ITEMS.filter(item=>foundAtticItems.includes(item.id)),...getUnlockedFragments().map(id=>INV_FRAGMENTS[id]).filter(Boolean)];
  allItems.forEach(item=>renderDeskItem(desk,item,false));
}

// memoryView: item belongs to a vaulted resonation being revisited — always
// shown named, taps go straight to the detail view, and the naming flow
// (sound, tutorial, resonation glow refresh) is skipped.
function renderDeskItem(desk,item,memoryView){
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
  el.className='inv-item'+((pos.named||memoryView)?' named':'');
  el.dataset.invId=item.id;
  el.style.cssText='left:'+pos.x+'px;top:'+pos.y+'px;transform:rotate('+pos.rot+'deg)';
  const iconHtml=item.image?'<img class="inv-item-img" src="'+item.image+'" alt="">':`<span class="inv-item-emoji">${item.emoji}</span>`;
  el.innerHTML='<div class="inv-item-paper">'+iconHtml+'<span class="inv-item-type">'+item.type+'</span><span class="inv-item-name">'+item.title+'</span></div>';
  let psx,psy,esx,esy,dw,dh,iw,moved=false,active=false;
  el.addEventListener('pointerdown',e=>{
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    psx=e.clientX;psy=e.clientY;
    esx=parseFloat(el.style.left)||0;esy=parseFloat(el.style.top)||0;
    const desk=document.getElementById('invDesk');
    dw=desk?desk.clientWidth:window.innerWidth;
    dh=desk?desk.clientHeight:300;
    iw=el.offsetWidth||84;
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
      if(memoryView||el.classList.contains('named')){
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
   const headerHtml = item.hideDetailHeader ? '' :
  '<div class="inv-detail-type">'+item.type+'</div><h2 class="inv-detail-title">'+item.title+'</h2>';

bg.innerHTML =
  '<div class="inv-detail-box'+(item.hideDetailHeader?' inv-detail-box--artifact':'')+'">' +
    '<button class="inv-detail-close" onclick="this.closest(\'.inv-detail-bg\').remove()">&#x2715;</button>' +
    headerHtml +
    '<div class="inv-detail-content">'+item.content+'</div>' +
  '</div>';
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
