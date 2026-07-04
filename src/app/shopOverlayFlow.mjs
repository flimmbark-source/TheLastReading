// Shop overlay flow adapter.
// This prepares pack animation and pack-purchase ownership for the final
// index.html cleanup. Existing inline functions remain authoritative until deleted.

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || {};}
function stateOf(target){return runtime(target).state || target.state || {};}
function market(target){return target.tlrMarketFlow || {};}

const SHORT_UPGRADE_COPY = Object.freeze({
  hand: '+1 starting hand size.',
  deep_current: '+1 card at reading start.',
  blessed_start: '+0.25 starting Mult.',
  first_light: 'First placed card: +3 Chips.',
  deep_reserve: 'Cards left in hand add Chips.',
  discards: '+1 Discard each reading.',
  mulligan: '+1 Mulligan each reading.',
  ritual_depth: '+1 card from draw abilities.',
  nimble_fingers: 'Discarding draws 1 card.',
  quick_release: 'Discarded cards add Chips.',
  lens_mastery: '+1 card reveal for abilities.',
  peek_plus: '+1 card reveal for Peek.',
  sight_cost: 'Once per reading, Peek/Search/Mirror costs no Discard.',
  chosen: 'Taken cards gain +5 Chips.',
  relation_plus: '+1 card reveal for abilities.',
  relation_chips: 'Taken relation cards gain Chips.',
});

function upgradeCopy(key, fallback = ''){
  return SHORT_UPGRADE_COPY[key] || fallback;
}

function markReturningToMarket(target = window){
  const doc = target.document;
  if(!doc || doc.querySelector('.store-front-shell:not(.store-exiting)'))return;
  const summary = doc.getElementById('summary');
  if(!summary)return;
  const marker = doc.createElement('div');
  marker.className = 'store-front-shell';
  marker.style.display = 'none';
  marker.innerHTML = '<div class="store-front"></div>';
  summary.appendChild(marker);
}

function returnToMarket(target = window){
  markReturningToMarket(target);
  if(typeof target.openShopMain==='function')target.openShopMain();
}

export function packAccent(packId){
  return packId==='relic'?'180,80,220':packId==='ritual'?'220,80,80':packId==='pattern'?'255,200,80':packId==='innate'?'255,150,60':packId==='restless'?'80,180,220':'180,160,100';
}

export function animatePackOpen(packId,callback,target = window){
  const pack=(target.PACKS||{})[packId];
  if(!pack){if(typeof callback==='function')callback();return false;}
  const overlay=document.getElementById('packAnim');
  const card=document.getElementById('packAnimCard');
  const icon=document.getElementById('packAnimIcon');
  const label=document.getElementById('packAnimLabel');
  const burst=document.getElementById('packAnimBurst');
  const glow=document.getElementById('packAnimGlow');
  const rays=document.getElementById('packAnimRays');
  if(!overlay||!card||!icon||!label||!burst||!glow||!rays){if(typeof callback==='function')callback();return false;}
  const accent=packAccent(packId);
  glow.style.background=`radial-gradient(circle at 50% 50%,rgba(${accent},.55),rgba(${accent},.12) 60%,transparent 80%)`;
  glow.style.boxShadow=`0 0 28px rgba(${accent},.7),0 0 60px rgba(${accent},.3)`;
  burst.style.background=`radial-gradient(circle,rgba(255,240,180,1) 0%,rgba(${accent},.8) 30%,rgba(${accent},.2) 60%,transparent 75%)`;
  icon.className='isp isp-56 '+pack.icon;
  label.textContent=pack.name;
  rays.innerHTML='';
  const rayCount=12;
  for(let i=0;i<rayCount;i+=1){
    const angle=(i/rayCount)*360;
    const len=140+Math.random()*80;
    const wrapper=document.createElement('div');
    wrapper.style.cssText=`position:absolute;left:50%;top:50%;width:2px;height:${len}px;transform-origin:50% 0%;transform:translateX(-50%) rotate(${angle}deg);pointer-events:none`;
    const inner=document.createElement('div');
    inner.style.cssText=`width:100%;height:100%;background:linear-gradient(rgba(${accent},.9),transparent);border-radius:1px;transform-origin:50% 0%;animation:paRay .4s ease-out forwards;animation-delay:${0.82+i*0.012}s`;
    wrapper.appendChild(inner);
    rays.appendChild(wrapper);
  }
  const srcEl=document.querySelector('.shop-pack-banner .isp.'+pack.icon);
  let dx=0,dy=0;
  if(srcEl){
    const r=srcEl.getBoundingClientRect();
    dx=(r.left+r.width/2)-window.innerWidth/2;
    dy=(r.top+r.height/2)-window.innerHeight/2;
    srcEl.style.opacity='0';
  }
  burst.style.opacity='0';burst.style.transform='scale(0)';
  rays.style.opacity='0';
  overlay.classList.remove('pa-dim');
  overlay.style.opacity='1';
  card.style.cssText=`opacity:1;transform:translate(${dx}px,${dy}px) scale(0.52);transition:none`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    overlay.classList.add('pa-dim');
    card.style.transition='transform .45s cubic-bezier(.2,.8,.2,1),opacity .15s';
    card.style.transform='translate(0,0) scale(1)';
  }));
  setTimeout(()=>{card.style.transition='';glow.style.animation='paGlow .35s ease-in-out forwards';},450);
  setTimeout(()=>{card.style.animation='paShake .5s ease-in-out forwards';},500);
  setTimeout(()=>{
    burst.style.animation='paBurst .5s ease-out forwards';
    rays.style.opacity='1';
    card.style.animation='paFadeOut .22s ease-in forwards';
    overlay.classList.remove('pa-dim');
  },820);
  setTimeout(()=>{
    overlay.style.opacity='0';
    glow.style.animation='';
    burst.style.animation='';
    rays.style.opacity='0';
    if(srcEl)srcEl.style.opacity='';
    if(typeof callback==='function')callback();
  },1280);
  return true;
}

export function buildUpgradePicker(packId,target = window){
  const pack=(target.PACKS||{})[packId];
  if(!pack)return '';
  const pool=Object.keys(target.SHOP||{}).filter(k=>pack.pool==='all'||target.SHOP[k][5]===pack.pool);
  const shuffle=target.shuffle || (a=>a.sort(()=>Math.random()-.5));
  const options=shuffle([...pool]).slice(0,3);
  let html='<div class="summary tarot-shop">';
  html+=`<div class="pack-picker-header"><h3>${pack.name}</h3><p>Pick one upgrade.</p></div>`;
  html+='<div class="shop-items-row">';
  const persist=persistOf(target);
  for(const k of options){
    const s=target.SHOP[k],lvl=(persist.up||{})[k]||0,ic=(target.SHOP_ICON||{})[k]||'isp-scoring';
    html+=`<div class="upg-card pool-${s[5]}">
      <div class="upg-title-strip"><span>${s[0]}</span></div>
      <div class="upg-art"><span class="isp isp-40 ${ic}"></span></div>
      <div class="upg-body"><div class="upg-desc">${upgradeCopy(k, s[1])}</div></div>
      <div class="upg-footer"><span class="upg-lv">Lv <b>${lvl}</b></span>
      <button class="sbtn sbtn-pick" aria-label="Pick" onclick="pickPackUpgrade('${k}')"></button></div>
    </div>`;
  }
  html+='</div></div>';
  return html;
}

export function pickPackUpgrade(upgradeKey,target = window){
  if(!upgradeKey || !(target.SHOP||{})[upgradeKey])return false;
  const purchased=typeof target.tlrMarketPurchase==='function'
    ? target.tlrMarketPurchase({kind:'upgrade',upgradeKey})
    : false;
  if(purchased!==true)return purchased;
  if(typeof target.playSound==='function')target.playSound('pack_pick');
  if(typeof target.render==='function')target.render();
  returnToMarket(target);
  return true;
}

function buildRelicPicker(pack,target = window){
  const options=target.tlrMarketFlow?.relicPool?target.tlrMarketFlow.relicPool(4,target):[];
  let html='<div class="summary tarot-shop">';
  html+=`<div class="pack-picker-header"><h3>${pack.name}</h3><p>Choose one relic.</p></div>`;
  html+='<div class="shop-items-row relic-picker-row">';
  for(const k of options){
    const r=target.RELICS[k];
    if(!r)continue;
    const style=typeof target.relicIconStyle==='function'?target.relicIconStyle(k,64):'';
    html+=`<div class="upg-card relic-option ${r.rarity}" onclick="acquireRelic('${k}')">
      <div class="upg-title-strip relic-title-strip"><span>${r.name}</span></div>
      <div class="upg-art relic-art"><div class="relic-art-sprite" style="${style}"></div></div>
      <div class="upg-body"><div class="upg-desc">${r.desc||r.description||''}</div></div>
      <div class="upg-footer"><button class="sbtn sbtn-pick" aria-label="Pick" onclick="acquireRelic('${k}');event.stopPropagation()"></button></div>
    </div>`;
  }
  html+='</div></div>';
  return html;
}

function showPackContents(packId,target = window){
  const pack=(target.PACKS||{})[packId];
  if(!pack || typeof target.showOverlay!=='function')return false;
  const html=packId==='relic'?buildRelicPicker(pack,target):buildUpgradePicker(packId,target);
  if(!html)return false;
  target.showOverlay(html);
  return true;
}

export function buyPack(packId,cost,target = window){
  const pack=(target.PACKS||{})[packId];
  if(!pack)return false;
  const persist=persistOf(target);
  const finalCost=cost!==undefined?cost:(market(target).packCost?market(target).packCost(packId,target):pack.cost);
  if((persist.pool||0)<finalCost)return false;
  if(typeof target.tlrMarketPurchase==='function'&&target.tlrMarketPurchase({kind:'pack',packId,cost:finalCost})!==true)return false;
  if(market(target).markPackBought)market(target).markPackBought(packId,target);
  if(typeof target.playSound==='function')target.playSound('pack_open');
  let revealed=false;
  const reveal=()=>{if(revealed)return;revealed=true;showPackContents(packId,target);};
  animatePackOpen(packId,reveal,target);
  // The picker is the purchased item. Do not let a missing animation element,
  // interrupted timer, or reduced-motion/browser timing quirk swallow the pack.
  target.setTimeout?.(reveal,1500);
  return true;
}


function openStampChoice(title, prompt, eligible, onPick, target = window) {
  const body = target.document?.body;
  const modal = target.document?.getElementById('modal');
  body?.classList?.add('tlr-stamp-picker-active');
  target.choice(title, prompt, eligible, card => {
    body?.classList?.remove('tlr-stamp-picker-active');
    modal?.style?.removeProperty('z-index');
    onPick(card);
  });
  if (eligible.length > 1) modal?.style?.setProperty('z-index', '10160', 'important');
}

export function openStampPicker(slotIndex, target = window) {
  if (typeof target.choice !== 'function') return;
  const persist = persistOf(target);
  const state = stateOf(target);
  const stampedIds = new Set(persist.stampedMajors || []);
  const stampedFiveIds = new Set(persist.stampedFive || []);
  const allCards = [
    ...(state.deck || []),
    ...(state.hand || []),
    ...(state.discard || []),
    ...(state.spread || []).filter(Boolean),
  ];
  const seen = new Set();
  const eligible = allCards.filter(card => {
    if (card.type !== 'major') return false;
    if (!Array.isArray(card.suits) || !card.suits.length) return false;
    if (stampedIds.has(card.id)) return false;
    if (stampedFiveIds.has(card.id)) return false;
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
  if (!eligible.length) return;
  openStampChoice('Suit Stamp', 'Choose a Major Arcana — its suit counts toward Royal Court.', eligible, card => {
    if (card?.id) applyStampTarget(card.id, target);
  }, target);
}

export function openFiveStampPicker(slotIndex, target = window) {
  if (typeof target.choice !== 'function') return;
  const persist = persistOf(target);
  const state = stateOf(target);
  const stampedFive = new Set(persist.stampedFive || []);
  const stampedMajorIds = new Set(persist.stampedMajors || []);
  const allCards = [
    ...(state.deck || []),
    ...(state.hand || []),
    ...(state.discard || []),
    ...(state.spread || []).filter(Boolean),
  ];
  const seen = new Set();
  const eligible = allCards.filter(card => {
    if (stampedFive.has(card.id)) return false;
    if (stampedMajorIds.has(card.id)) return false;
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
  if (!eligible.length) return;
  openStampChoice('Five Star Stamp', 'Choose any card — it slots into Sequences as a multiple of 5 (5, 10, 15, 20).', eligible, card => {
    if (card?.id) applyFiveStampTarget(card.id, target);
  }, target);
}

export function applyFiveStampTarget(cardId, target = window) {
  if (!cardId) return false;
  const persist = persistOf(target);
  if (!Array.isArray(persist.stampedFive)) persist.stampedFive = [];
  if (!persist.stampedFive.includes(cardId)) persist.stampedFive.push(cardId);
  if (Array.isArray(persist.stampedMajors)) persist.stampedMajors = persist.stampedMajors.filter(id => id !== cardId);
  if (typeof target.tlrSyncPersistToStore === 'function') target.tlrSyncPersistToStore();
  if (typeof target.playSound === 'function') target.playSound('pack_pick');
  if (typeof target.render === 'function') target.render();
  if (typeof target.openShopMain === 'function') target.openShopMain();
  return true;
}

export function applyStampTarget(cardId, target = window) {
  if (!cardId) return false;
  const persist = persistOf(target);
  if (!Array.isArray(persist.stampedMajors)) persist.stampedMajors = [];
  if (!persist.stampedMajors.includes(cardId)) persist.stampedMajors.push(cardId);
  if (Array.isArray(persist.stampedFive)) persist.stampedFive = persist.stampedFive.filter(id => id !== cardId);
  if (typeof target.tlrSyncPersistToStore === 'function') target.tlrSyncPersistToStore();
  if (typeof target.playSound === 'function') target.playSound('pack_pick');
  if (typeof target.render === 'function') target.render();
  if (typeof target.openShopMain === 'function') target.openShopMain();
  return true;
}

export function installShopOverlayFlow(target = window){
  if(!target || target.__tlrShopOverlayFlowInstalled)return;
  target.__tlrShopOverlayFlowInstalled=true;
  const api={packAccent,animatePackOpen,buildUpgradePicker,pickPackUpgrade,buyPack,openStampPicker,applyStampTarget,openFiveStampPicker,applyFiveStampTarget};
  target.tlrShopOverlayFlow=api;
  if(typeof target.animatePackOpen!=='function')target.animatePackOpen=(packId,callback)=>animatePackOpen(packId,callback,target);
  if(typeof target.buyPack!=='function')target.buyPack=(packId,cost)=>buyPack(packId,cost,target);
  if(typeof target.pickPackUpgrade!=='function')target.pickPackUpgrade=upgradeKey=>pickPackUpgrade(upgradeKey,target);
  if(typeof target.openStampPicker!=='function')target.openStampPicker=idx=>openStampPicker(idx,target);
  if(typeof target.applyStampTarget!=='function')target.applyStampTarget=cardId=>applyStampTarget(cardId,target);
  if(typeof target.openFiveStampPicker!=='function')target.openFiveStampPicker=idx=>openFiveStampPicker(idx,target);
  if(typeof target.applyFiveStampTarget!=='function')target.applyFiveStampTarget=cardId=>applyFiveStampTarget(cardId,target);
}
