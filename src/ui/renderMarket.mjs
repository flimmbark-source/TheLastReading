// Market and relic-rack renderer (Phase 15.4). Moved verbatim from
// index.html. Offers and costs come through window.tlrShop
// (src/systems/shop.mjs); purchase logic stays with the game flow.
/* global state, persist, render, _shopPacks, tlrShopPacks, PACKS, _packBuys, _nextRefreshCost, showOverlay, $, relicSlots, _relicRackKey, RELICS, _openRelicKey, RELIC_SPRITE */

export function relicIconStyle(key,size){
  const p=RELIC_SPRITE[key];if(!p)return'';
  return`background-image:url('relic%20icons.png');background-size:${size*6}px ${size*4}px;background-position:${-p[0]*size}px ${-p[1]*size}px;background-repeat:no-repeat;`;
}

export function openShopMain(){
  if(state.pendingPool){persist.pool+=state.pendingPool;state.pendingPool=0;render();}
  if(!_shopPacks)_shopPacks=tlrShopPacks();
  let html='<div class="summary tarot-shop">';
  html+='<div class="shop-header"><span class="shop-orn">✦ &nbsp; ✦ &nbsp; ✦</span><h3>The Oracle\'s Market</h3><p class="shop-reserve-display">Reserve <b>'+persist.pool+'</b></p></div>';
  html+='<div class="shop-section-title"></div><div class="shop-packs-row">';
  for(const pk of _shopPacks){
    if(pk===null) continue;
    const p=PACKS[pk];
    // Phase 12: pack pricing through the shop system (incl. Merchant's Scale).
    const cost=window.tlrShop.packCost(p.cost,_packBuys[pk]||0,persist.relics);
    const ok=persist.pool>=cost;
    html+=`<div class="shop-pack ${ok?'affordable':''}">
      <div class="shop-pack-banner"><span class="isp isp-108 ${p.icon}"></span></div>
      <div class="shop-pack-desc">${p.desc}</div>
      <div class="shop-pack-footer"><span class="shop-pack-cost">✦ ${cost}</span>
      <button class="sbtn sbtn-open" ${ok?'':'disabled'} aria-label="Open" onclick="buyPack('${pk}',${cost})"></button></div>
    </div>`;
  }
  const rc=_nextRefreshCost(),canRefresh=persist.pool>=rc;
  html+=`</div><div class="shop-refresh-row"><button class="shop-refresh-btn" ${canRefresh?'':'disabled'} onclick="refreshShopPacks()">↺ Refresh &nbsp;✦ ${rc}</button></div>`;
  html+='<button class="sbtn sbtn-leave" aria-label="Leave Market" onclick="continueReading()"></button></div>';
  showOverlay(html);
}

export function renderRelicRack(){
  const rack=$('#relicRack');if(!rack)return;
  const key=persist.relics.join(',')+'|'+relicSlots();
  if(key===_relicRackKey)return;
  _relicRackKey=key;
  rack.innerHTML='';
  const slots=relicSlots();
  persist.relics.forEach(key=>{
    const r=RELICS[key];
    const btn=document.createElement('button');
    btn.className='relic-btn'+(r.rarity==='rare'?' relic-rare':'');
    btn.title=r.name;
    const ic=document.createElement('span');
    ic.style.cssText=`display:block;width:30px;height:30px;flex-shrink:0;${relicIconStyle(key,30)}`;
    btn.appendChild(ic);
    btn.onclick=e=>{e.stopPropagation();toggleRelicCallout(key,btn);};
    rack.appendChild(btn);
  });
  const empty=slots-persist.relics.length;
  for(let i=0;i<empty;i++){const slot=document.createElement('div');slot.className='relic-slot-empty';rack.appendChild(slot);}
}

export function toggleRelicCallout(key,btn){
  document.querySelectorAll('.relic-callout').forEach(el=>el.remove());
  if(_openRelicKey===key){_openRelicKey=null;return;}
  _openRelicKey=key;
  const r=RELICS[key];
  const callout=document.createElement('div');
  callout.className='relic-callout';
  const used=r.active&&persist.relicUsed[key];
  callout.innerHTML=`<div class="relic-callout-name"><div style="display:inline-block;width:24px;height:24px;vertical-align:middle;${relicIconStyle(key,24)}"></div> ${r.name}</div>
    <div class="relic-callout-desc">${r.desc}</div>
    ${r.active?`<button class="relic-activate-btn" ${used?'disabled':''} onclick="activateRelic('${key}')">${used?'Used this session':'Activate'}</button>`:''}`;
  document.body.appendChild(callout);
  const rect=btn.getBoundingClientRect();
  callout.style.top=(rect.bottom+6)+'px';
  callout.style.left='0px';
  requestAnimationFrame(function(){
    const cw=callout.offsetWidth,ch=callout.offsetHeight,mg=8;
    let left=rect.right-cw;
    left=Math.max(mg,Math.min(window.innerWidth-cw-mg,left));
    let top=rect.bottom+6;
    if(top+ch>window.innerHeight-mg)top=Math.max(mg,rect.top-ch-6);
    callout.style.left=left+'px';callout.style.top=top+'px';
  });
}
