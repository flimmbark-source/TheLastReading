// Market flow adapter for the legacy-to-module migration.
// This module centralizes market runtime state and helper behavior. It does not
// replace the inline shop UI while that script still exists.

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || {};}

export function marketRuntime(target = window){
  if(!target.__tlrMarketRuntime){
    target.__tlrMarketRuntime={
      packBuys:{},
      shopPacks:null,
      shopRefreshCount:0,
      replaceSelectedKey:null,
      relicRackKey:'',
      openRelicKey:null,
    };
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
  const persist=persistOf(target);
  const rt=marketRuntime(target);
  const cost=nextRefreshCost(target);
  if((persist.pool||0)<cost)return false;
  const purchased=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'refresh',cost}):false;
  if(purchased!==true)return purchased;
  rt.shopRefreshCount+=1;
  rt.shopPacks=shopPacks(target);
  if(typeof target.openShopMain==='function')target.openShopMain();
  return true;
}

export function packCost(packId,target = window){
  const persist=persistOf(target);
  const rt=marketRuntime(target);
  const pack=(target.PACKS||{})[packId];
  if(!pack)return 0;
  if(target.tlrShop&&typeof target.tlrShop.packCost==='function')return target.tlrShop.packCost(pack.cost,rt.packBuys[packId]||0,persist.relics||[]);
  return pack.cost+(rt.packBuys[packId]||0)*8;
}

export function markPackBought(packId,target = window){
  const rt=marketRuntime(target);
  rt.packBuys[packId]=(rt.packBuys[packId]||0)+1;
  if(rt.shopPacks){const i=rt.shopPacks.indexOf(packId);if(i>=0)rt.shopPacks[i]=null;}
}

export function installMarketFlow(target = window){
  if(!target || target.__tlrMarketFlowInstalled)return;
  target.__tlrMarketFlowInstalled=true;
  const api={marketRuntime,nextRefreshCost,relicSlots,relicPool,shopPacks,refreshShopPacks,packCost,markPackBought};
  target.tlrMarketFlow=api;

  // Fill only missing globals. Existing inline functions stay authoritative until deletion.
  if(typeof target._nextRefreshCost!=='function')target._nextRefreshCost=()=>nextRefreshCost(target);
  if(typeof target.relicSlots!=='function')target.relicSlots=()=>relicSlots(target);
  if(typeof target.relicPool!=='function')target.relicPool=(count=4)=>relicPool(count,target);
  if(typeof target.tlrShopPacks!=='function')target.tlrShopPacks=()=>shopPacks(target);
  if(typeof target.refreshShopPacks!=='function')target.refreshShopPacks=()=>refreshShopPacks(target);
}
