// Market flow adapter for the modular app.

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || target.persist || {};}
function stateOf(target){return runtime(target).state || target.state || {};}

export function marketRuntime(target = window){
  if(!target.__tlrMarketRuntime){
    target.__tlrMarketRuntime={};
    Object.defineProperties(target.__tlrMarketRuntime,{
      packBuys:{get(){return target._packBuys;},set(v){target._packBuys=v;}},
      shopPacks:{get(){return target._shopPacks;},set(v){target._shopPacks=v;}},
      shopRefreshCount:{get(){return target._shopRefreshCount;},set(v){target._shopRefreshCount=v;}},
      replaceSelectedKey:{get(){return target._replaceSelectedKey;},set(v){target._replaceSelectedKey=v;}},
      relicRackKey:{get(){return target._relicRackKey;},set(v){target._relicRackKey=v;}},
      openRelicKey:{get(){return target._openRelicKey;},set(v){target._openRelicKey=v;}},
    });
  }
  return target.__tlrMarketRuntime;
}

export function nextRefreshCost(target = window){
  const rt=marketRuntime(target);
  if(target.tlrShop&&typeof target.tlrShop.packRefreshCost==='function')return target.tlrShop.packRefreshCost(rt.shopRefreshCount);
  const costs=target._REFRESH_COSTS||[5,8,12,17,23];
  return costs[Math.min(rt.shopRefreshCount,costs.length-1)];
}

export function relicSlots(target = window){
  const persist=persistOf(target);
  if(target.tlrShop&&typeof target.tlrShop.maxRelicSlots==='function')return target.tlrShop.maxRelicSlots(persist.up||{});
  return 3+Math.min((persist.up||{}).relicSlot||0,2);
}

export function relicPool(count = 4,target = window){
  const persist=persistOf(target);
  const relics=target.RELICS||{};
  if(target.tlrShop&&typeof target.tlrShop.buildRelicOffer==='function'){
    return target.tlrShop.buildRelicOffer(Object.keys(relics).map(k=>({id:k,rarity:relics[k].rarity})),persist.relics||[],{count});
  }
  return Object.keys(relics).filter(k=>!(persist.relics||[]).includes(k)).slice(0,count);
}

export function shopPacks(target = window){
  if(target.tlrShop&&typeof target.tlrShop.buildPackOffer==='function')return target.tlrShop.buildPackOffer(Object.keys(target.PACKS||{}));
  return Object.keys(target.PACKS||{}).slice(0,3);
}

export function refreshShopPacks(target = window){
  const persist=persistOf(target),rt=marketRuntime(target),cost=nextRefreshCost(target);
  if((persist.pool||0)<cost)return false;
  const purchased=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'refresh',cost}):false;
  if(purchased!==true)return purchased;
  rt.shopRefreshCount+=1;
  rt.shopPacks=shopPacks(target);
  if(typeof target.openShopMain==='function')target.openShopMain();
  return true;
}

export function packCost(packId,target = window){
  const persist=persistOf(target),rt=marketRuntime(target),pack=(target.PACKS||{})[packId];
  if(!pack)return 0;
  if(target.tlrShop&&typeof target.tlrShop.packCost==='function')return target.tlrShop.packCost(pack.cost,rt.packBuys[packId]||0,persist.relics||[]);
  return pack.cost+(rt.packBuys[packId]||0)*8;
}

export function markPackBought(packId,target = window){
  const rt=marketRuntime(target);
  rt.packBuys[packId]=(rt.packBuys[packId]||0)+1;
  if(rt.shopPacks){const i=rt.shopPacks.indexOf(packId);if(i>=0)rt.shopPacks[i]=null;}
}

export function playRelicVision(target = window){
  if(target.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  try{target.playSound('resonation');}catch(e){}
  try{target.haptic([0,40,30,60,40,80]);}catch(e){}
  const veil=document.createElement('div');veil.className='relic-vision-veil';document.body.appendChild(veil);
  const rays=document.createElement('div');rays.className='relic-vision-rays';document.body.appendChild(rays);
  for(let i=0;i<14;i+=1){
    const mote=document.createElement('div');mote.className='relic-vision-mote';
    const angle=Math.random()*Math.PI*2,radius=140+Math.random()*180;
    mote.style.setProperty('--mx',Math.cos(angle)*radius+'px');
    mote.style.setProperty('--my',(Math.sin(angle)*radius-140)+'px');
    mote.style.animationDelay=(Math.random()*.35)+'s';
    mote.style.width=mote.style.height=(6+Math.random()*8).toFixed(1)+'px';
    document.body.appendChild(mote);setTimeout(()=>mote.remove(),2100);
  }
  setTimeout(()=>{veil.remove();rays.remove();},1800);
}

export function openRelicVisionShop(options,target = window){
  let html='<div class="summary tarot-shop relic-vision-enter">';
  html+='<div class="pack-picker-header"><h3>A Vision Stirs</h3><p>A relic calls to you — choose one to carry, or pass it by</p></div>';
  html+='<div class="shop-items-row relic-picker-row">';
  for(const k of options){
    const r=(target.RELICS||{})[k];if(!r)continue;
    const style=typeof target.relicIconStyle==='function'?target.relicIconStyle(k,64):'';
    html+=`<div class="upg-card relic-option ${r.rarity}" onclick="acquireRelicFree('${k}')">
      <div class="upg-title-strip relic-title-strip"><span>${r.name}</span></div>
      <div class="upg-art relic-art"><div class="relic-art-sprite" style="${style}"></div></div>
      <div class="upg-body"><div class="upg-desc">${r.desc}</div></div>
      <div class="upg-footer"><button class="sbtn sbtn-pick" aria-label="Pick" onclick="acquireRelicFree('${k}');event.stopPropagation()"></button></div>
    </div>`;
  }
  html+='</div><div style="text-align:center;margin-top:10px"><button onclick="openShopMain()" style="background:transparent;border:none;color:#8a7551;font-size:12px;cursor:pointer;text-decoration:underline">Pass — enter the market</button></div></div>';
  if(typeof target.showOverlay==='function')target.showOverlay(html);
}

function preloadMarketImages(target = window){
  if(!target||target.__tlrMarketImagesPreloaded)return;
  target.__tlrMarketImagesPreloaded=true;
  ['Store_Front.png','Refresh_Button.png','Proceed_Button.png'].forEach(src=>{
    const img=new (target.Image||Image)();img.src=src;
  });
}

function clearSpreadForMarket(target = window){
  const state=stateOf(target);
  if(!state||!Array.isArray(state.spread))return;
  state.spread=Array(5).fill(null);
  state.selected=null;
  state.abilitySelect=null;
  state.purgeSelect=null;
  state.busy=false;
  if(typeof target.snapCounter==='function')target.snapCounter(0);
  if(typeof target.render==='function')target.render();
}

function refreshStorefrontOnEntry(target = window){
  target._storeFrontOffers=null;
}

export function openShop(target = window){
  const state=stateOf(target),persist=persistOf(target);
  clearSpreadForMarket(target);
  refreshStorefrontOnEntry(target);
  preloadMarketImages(target);
  if(!state.relicEarned){if(typeof target.openShopMain==='function')target.openShopMain();return;}
  if(state.pendingPool){persist.pool+=state.pendingPool;state.pendingPool=0;if(typeof target.render==='function')target.render();}
  const options=relicPool(4,target);
  if(!options.length){if(typeof target.openShopMain==='function')target.openShopMain();return;}
  playRelicVision(target);
  setTimeout(()=>openRelicVisionShop(options,target),520);
}

export function installMarketFlow(target = window){
  if(!target || target.__tlrMarketFlowInstalled)return;
  target.__tlrMarketFlowInstalled=true;
  preloadMarketImages(target);
  const api={marketRuntime,nextRefreshCost,relicSlots,relicPool,shopPacks,refreshShopPacks,packCost,markPackBought,playRelicVision,openRelicVisionShop,openShop};
  target.tlrMarketFlow=api;
  marketRuntime(target);
  if(typeof target._nextRefreshCost!=='function')target._nextRefreshCost=()=>nextRefreshCost(target);
  if(typeof target.relicSlots!=='function')target.relicSlots=()=>relicSlots(target);
  if(typeof target.relicPool!=='function')target.relicPool=(count=4)=>relicPool(count,target);
  if(typeof target.tlrShopPacks!=='function')target.tlrShopPacks=()=>shopPacks(target);
  if(typeof target.refreshShopPacks!=='function')target.refreshShopPacks=()=>refreshShopPacks(target);
  if(typeof target.playRelicVision!=='function')target.playRelicVision=()=>playRelicVision(target);
  if(typeof target._openRelicVisionShop!=='function')target._openRelicVisionShop=options=>openRelicVisionShop(options,target);
  if(typeof target.openShop!=='function')target.openShop=()=>openShop(target);
}