// Market and relic-rack renderer (Phase 15.4). Moved verbatim from
// index.html. Offers and costs come through window.tlrShop
// (src/systems/shop.mjs); purchase logic stays with the game flow.
/* global state, persist, render, _nextRefreshCost, showOverlay, $, relicSlots, _relicRackKey, RELICS, _openRelicKey, RELIC_SPRITE */

const STORE_SCORING_PACKS = Object.freeze(['foundation', 'ritual', 'pattern']);
const STORE_ABILITY_PACKS = Object.freeze(['innate', 'restless', 'second_sight', 'thread']);
const RELIC_CACHE_PACK_ID = 'relic';
const STORE_ASSET_PATH = './';

const STORE_PACK_COPY = Object.freeze({
  foundation: 'Chip bonuses.',
  ritual: 'Mult upgrades.',
  pattern: 'Scoring patterns.',
  innate: 'Starting resources.',
  restless: 'Draw and Discards.',
  second_sight: 'Sight abilities.',
  thread: 'Relation abilities.',
});

const STORE_RELIC_COPY = Object.freeze({
  gilded_fool: '+10 Chips if spread has a card.',
  hermit_lantern: 'Major Arcana add +0.25 Mult.',
  mirror_shard: 'Matching ranks add +1 Mult.',
  still_pool: '+1 Mult if no Discards used.',
  loaded_die: 'Court cards add extra Chips.',
  gilded_discard: 'First Discard is free.',
  threadbare_tarot: 'Start with +1 card.',
  merchants_scale: 'Packs cost 3 less.',
  court_favor: 'Court cards add +1 Mult.',
  hanged_coin: 'Discarded cards add Chips.',
  miser: '+5 Reserve after thresholds.',
  arcana_codex: 'Scoring upgrades add Mult.',
  lovers_knot: 'Repeated ranks add Mult.',
  temperance_flask: 'Exactly 1 Discard adds Mult.',
  strengths_grip: '3 Court cards add +3 Mult.',
  the_world: 'Excess Chips carry forward.',
  fool_reversed: '-1 hand size, +3 Chips each.',
  watcher: 'Once: reveal 3, take 1.',
});

function runtime(target = window) { return target.tlrRuntime || {}; }
function persistOf(target = window) { return runtime(target).persist || target.persist || {}; }

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureStoreFrontStyles(target = window) {
  const doc = target.document;
  if (!doc || doc.getElementById('store-front-style')) return;
  const style = doc.createElement('style');
  style.id = 'store-front-style';
  style.textContent = `
    .summary.store-front-shell{background:transparent;border:0;box-shadow:none;padding:0;max-width:none;width:auto;overflow:visible}
    .modal:has(.store-front-shell){padding:clamp(6px,1.4vw,18px);align-items:center;justify-content:center;overflow:auto}
    .store-front{position:relative;width:min(96vw,calc(95dvh * .6667),680px);aspect-ratio:2/3;margin:0 auto;color:#eadbb9;background:url('${STORE_ASSET_PATH}Store_Front.png') center/100% 100% no-repeat;border-radius:18px;filter:drop-shadow(0 22px 46px rgba(0,0,0,.76));font-family:Georgia,serif;isolation:isolate}
    .store-front button{font-family:Georgia,serif;cursor:pointer;-webkit-tap-highlight-color:transparent}.store-front button:disabled{cursor:not-allowed;filter:grayscale(.45);opacity:.45}
    .store-title{position:absolute;left:18%;right:18%;top:3.35%;text-align:center;letter-spacing:.075em;text-transform:uppercase;font-weight:800;font-size:clamp(18px,4.1vw,34px);line-height:.94;text-shadow:0 2px 4px #000}.store-title small{display:block;font-size:.42em;letter-spacing:.18em;margin-bottom:.02em}.store-subtitle{position:absolute;left:19%;right:19%;top:10.35%;text-align:center;color:#d1a15e;font:600 clamp(10px,1.9vw,16px) system-ui,Segoe UI,sans-serif;white-space:nowrap;text-shadow:0 1px 2px #000}.store-reserve{position:absolute;right:5.9%;top:3%;width:15.2%;height:7.4%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid rgba(210,161,94,.32);border-radius:7px;background:rgba(10,9,12,.36);box-shadow:inset 0 0 12px rgba(0,0,0,.3)}.store-reserve-label{font-size:clamp(7px,1.25vw,11px);letter-spacing:.14em;text-transform:uppercase;color:#c7944f}.store-reserve-value{font-size:clamp(19px,4.9vw,40px);line-height:.9;color:#f1d196;text-shadow:0 1px 3px #000}.store-reserve-value .coin{font-size:.4em;margin-left:.08em;color:#c89445}
    .store-section{position:absolute;left:5.3%;right:5.3%;}.store-section.scoring{top:15.2%;height:22.9%}.store-section.abilities{top:41.2%;height:22.7%}.store-section.relics{top:66.7%;height:19.8%}
    .store-plaque{position:absolute;left:50%;top:0;width:43%;height:13%;transform:translate(-50%,-38%);background:url('${STORE_ASSET_PATH}Section_Plaque.png') center/100% 100% no-repeat;display:flex;align-items:center;justify-content:center;gap:.45em;text-align:center;text-transform:uppercase;letter-spacing:.075em;font-size:clamp(13px,2.85vw,24px);font-weight:800;color:#d6b16f;text-shadow:0 2px 3px #000;pointer-events:none}.store-plaque .store-section-icon{font-size:.65em;opacity:.9}.store-section-copy{position:absolute;left:4%;right:4%;top:9.3%;text-align:center;font:600 clamp(9px,1.65vw,14px) system-ui,Segoe UI,sans-serif;color:#dfcda8;text-shadow:0 1px 2px #000;pointer-events:none}.store-offer-row{position:absolute;left:19.8%;right:9.2%;top:25.5%;bottom:10.2%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8.5%}.store-relic-row{position:absolute;left:13.7%;right:3.8%;top:26.5%;bottom:8%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3.8%}
    .store-pack-offer,.store-relic-offer{position:relative;border:1px solid rgba(226,181,100,.36);border-radius:8px;background:rgba(5,5,8,.08);box-shadow:none;overflow:hidden;transition:transform .12s ease,filter .12s ease,border-color .12s ease,background .12s ease}.store-pack-offer:not(.disabled):hover,.store-relic-offer:not(.disabled):hover{transform:translateY(-1px);border-color:rgba(226,181,100,.86);background:rgba(10,9,13,.22);filter:brightness(1.08)}.store-empty-offer{opacity:.12;border:1px dashed rgba(225,181,106,.34);border-radius:8px;background:transparent}
    .store-pack-art{position:absolute;left:5%;top:8%;bottom:11%;width:32%;display:flex;align-items:center;justify-content:center;pointer-events:none}.store-pack-art .isp{transform:scale(.6);transform-origin:center;filter:drop-shadow(0 4px 5px rgba(0,0,0,.65))}.store-pack-body{position:absolute;left:41%;right:5%;top:13%;bottom:30%;display:flex;flex-direction:column;justify-content:center;text-align:left;pointer-events:none}.store-pack-name{font-size:clamp(10px,2.05vw,18px);line-height:1.02;text-transform:uppercase;font-weight:800;color:#f0dfbd;text-shadow:0 1px 3px #000}.store-pack-desc{margin-top:.35em;font:600 clamp(7px,1.35vw,12px) system-ui,Segoe UI,sans-serif;color:#d5c6a8;line-height:1.15}.store-pack-buy,.store-relic-buy{position:absolute;right:5%;bottom:7%;min-width:39%;height:20%;border:1px solid rgba(226,181,100,.7);border-radius:5px;background:rgba(8,8,10,.55);color:#f5d9a0;text-transform:uppercase;letter-spacing:.05em;font-weight:800;font-size:clamp(8px,1.5vw,13px);box-shadow:inset 0 0 10px rgba(0,0,0,.45),0 1px 3px rgba(0,0,0,.4)}.store-pack-buy .coin,.store-relic-buy .coin{color:#c99443;margin-left:.2em}
    .store-relic-offer{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:2.5% 4% 3.5%;text-align:center}.store-relic-art{position:absolute;top:4%;left:50%;width:58px;height:58px;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;pointer-events:none}.store-relic-art .relic-art-sprite{width:58px;height:58px;flex:0 0 58px;filter:drop-shadow(0 5px 5px rgba(0,0,0,.65))}.store-vessel-glyph{font:800 28px/1 Georgia,serif;color:#f1d196;text-shadow:0 2px 5px #000}.store-relic-name{width:100%;font-size:clamp(7px,1.45vw,13px);line-height:1.02;text-transform:uppercase;font-weight:800;color:#f0dfbd;text-shadow:0 1px 3px #000}.store-relic-desc{min-height:2.55em;margin-top:.22em;font:600 clamp(6.5px,1.18vw,10.5px) system-ui,Segoe UI,sans-serif;color:#dfd2ba;line-height:1.08}.store-relic-buy{position:relative;left:auto;right:auto;bottom:auto;width:88%;height:auto;min-height:18%;margin-top:.46em;padding:.31em .15em}.store-relic-offer.disabled .store-relic-buy{pointer-events:none}
    .store-actions{position:absolute;left:5.4%;right:5.4%;bottom:2.2%;height:7.4%;display:grid;grid-template-columns:1fr 1.15fr;gap:3%}.store-refresh,.store-proceed{border:0;background:center/100% 100% no-repeat;color:#f1dfbd;text-transform:uppercase;letter-spacing:.08em;font-weight:800;text-shadow:0 1px 3px #000;box-shadow:none}.store-refresh{background-image:url('${STORE_ASSET_PATH}Refresh_Button.png');font-size:clamp(9px,2vw,18px);display:grid;grid-template-columns:24% 1fr;align-items:center}.store-refresh-icon{font-size:1.38em}.store-refresh-cost{display:block;font-size:.88em;color:#e9c17d;margin-top:.02em}.store-proceed{background-image:url('${STORE_ASSET_PATH}Proceed_Button.png');font-size:clamp(12px,2.8vw,25px);padding-right:11%}.store-replace-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin-top:12px}.store-replace-card{border:1px solid rgba(210,161,94,.42);border-radius:8px;background:rgba(255,255,255,.04);padding:9px;text-align:center}.store-replace-card button{margin-top:8px}
    @media(min-width:900px){.store-front{width:min(62vw,calc(94dvh * .6667),720px)}.store-pack-art .isp{transform:scale(.66)}.store-relic-art,.store-relic-art .relic-art-sprite{width:68px;height:68px;flex-basis:68px}.store-vessel-glyph{font-size:34px}.store-offer-row{left:20.2%;right:9.6%;top:26%;bottom:10.5%;gap:9.5%}.store-relic-row{left:14%;right:4.2%;top:26.5%;bottom:8.8%;gap:4.4%}}
    @media(max-width:640px){.modal:has(.store-front-shell){padding:4px}.store-front{width:min(98vw,calc(96dvh * .6667));}.store-title{top:3.8%;font-size:clamp(17px,5.2vw,23px)}.store-subtitle{top:10.7%;font-size:9px}.store-reserve{right:5.8%;top:3.5%;width:16%;height:7%}.store-reserve-label{font-size:6px}.store-reserve-value{font-size:19px}.store-section.scoring{top:15.5%;height:22.8%}.store-section.abilities{top:41.3%;height:22.7%}.store-section.relics{top:66.9%;height:19.5%}.store-plaque{font-size:12px;width:44%;height:12.5%}.store-section-copy{top:9.8%;font-size:8.5px}.store-offer-row{left:19%;right:8.5%;top:27%;bottom:10.8%;gap:7%}.store-relic-row{left:13.2%;right:3.8%;top:28%;bottom:8%;gap:3.2%}.store-pack-offer,.store-relic-offer{border-radius:6px}.store-pack-art{left:4%;width:33%}.store-pack-art .isp{transform:scale(.5)}.store-pack-body{left:40%;right:4%;bottom:31%}.store-pack-name{font-size:9px}.store-pack-desc{font-size:6.8px}.store-pack-buy,.store-relic-buy{font-size:6.8px;border-radius:4px}.store-relic-art,.store-relic-art .relic-art-sprite{width:42px;height:42px;flex-basis:42px}.store-vessel-glyph{font-size:23px}.store-relic-name{font-size:6.4px}.store-relic-desc{font-size:5.8px}.store-relic-buy{width:90%;padding:.22em .1em}.store-actions{bottom:2.35%;height:7.25%}.store-refresh{font-size:8px}.store-proceed{font-size:12px}}
  `;
  doc.head.appendChild(style);
}

function shuffleValues(values, target = window) {
  const copy = [...values];
  if (typeof target.shuffle === 'function') return target.shuffle(copy);
  return copy.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
}

function pickPacks(packIds, count, target = window) {
  const packs = target.PACKS || {};
  return shuffleValues(packIds, target).filter(id => packs[id]).slice(0, count);
}

function pickRelics(count, target = window) {
  const owned = new Set((persistOf(target).relics || []));
  const options = typeof target.relicPool === 'function'
    ? target.relicPool(Math.max(count, 4))
    : Object.keys(target.RELICS || {}).filter(key => !owned.has(key));
  return options.filter(key => !owned.has(key)).slice(0, count);
}

export function buildStoreFrontOffers(target = window) {
  return {
    scoring: pickPacks(STORE_SCORING_PACKS, 2, target),
    abilities: pickPacks(STORE_ABILITY_PACKS, 2, target),
    relics: pickRelics(2, target),
  };
}

function currentStoreFrontOffers(target = window) {
  const owned = new Set((persistOf(target).relics || []));
  if (!target._storeFrontOffers) target._storeFrontOffers = buildStoreFrontOffers(target);
  const offers = target._storeFrontOffers;
  offers.scoring = Array.isArray(offers.scoring) ? offers.scoring.slice(0, 2) : [];
  offers.abilities = Array.isArray(offers.abilities) ? offers.abilities.slice(0, 2) : [];
  offers.relics = (Array.isArray(offers.relics) ? offers.relics : []).filter(key => key && !owned.has(key)).slice(0, 2);
  if (offers.relics.length < 2) {
    const fill = pickRelics(4, target).filter(key => !offers.relics.includes(key));
    while (offers.relics.length < 2 && fill.length) offers.relics.push(fill.shift());
  }
  target._storeFrontOffers = offers;
  return offers;
}

function packCostFor(packId, target = window) {
  const pack = (target.PACKS || {})[packId];
  if (!pack) return 0;
  return target.tlrShop?.packCost
    ? target.tlrShop.packCost(pack.cost, (target._packBuys || {})[packId] || 0, (persistOf(target).relics || []))
    : pack.cost + (((target._packBuys || {})[packId] || 0) * 8);
}

function relicCost(target = window) {
  const pack = (target.PACKS || {})[RELIC_CACHE_PACK_ID];
  if (!pack) return 24;
  return target.tlrShop?.packCost
    ? target.tlrShop.packCost(pack.cost, (target._packBuys || {})[RELIC_CACHE_PACK_ID] || 0, (persistOf(target).relics || []))
    : pack.cost + (((target._packBuys || {})[RELIC_CACHE_PACK_ID] || 0) * 8);
}

function storeVesselCost(target = window) {
  return typeof target.shopCost === 'function' ? target.shopCost('relicSlot') : 35;
}

function renderStorePackTile(sectionKey, index, packId, target = window) {
  if (!packId) return '<div class="store-empty-offer" aria-hidden="true"></div>';
  const pack = (target.PACKS || {})[packId];
  if (!pack) return '<div class="store-empty-offer" aria-hidden="true"></div>';
  const cost = packCostFor(packId, target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const desc = STORE_PACK_COPY[packId] || pack.desc || '';
  return `<div class="store-pack-offer ${ok ? 'affordable' : 'disabled'}">
    <div class="store-pack-art"><span class="isp isp-108 ${pack.icon}"></span></div>
    <div class="store-pack-body"><div class="store-pack-name">${escapeHtml(pack.name)}</div><div class="store-pack-desc">${escapeHtml(desc)}</div></div>
    <button class="store-pack-buy" ${ok ? '' : 'disabled'} onclick="buyStorePack('${sectionKey}',${index},'${packId}',${cost})">Open <span class="coin">✦</span> ${cost}</button>
  </div>`;
}

function renderStoreSection(sectionKey, title, icon, copy, packIds, target = window) {
  const cells = [0, 1].map(index => renderStorePackTile(sectionKey, index, packIds[index], target)).join('');
  return `<section class="store-section ${sectionKey}">
    <div class="store-plaque"><span class="store-section-icon">${icon}</span>${escapeHtml(title)}</div>
    <div class="store-section-copy">${escapeHtml(copy)}</div>
    <div class="store-offer-row">${cells}</div>
  </section>`;
}

function renderStoreRelicTile(index, relicKey, target = window) {
  if (!relicKey) return '<div class="store-empty-offer" aria-hidden="true"></div>';
  const relic = (target.RELICS || {})[relicKey];
  if (!relic) return '<div class="store-empty-offer" aria-hidden="true"></div>';
  const cost = relicCost(target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const style = typeof target.relicIconStyle === 'function' ? target.relicIconStyle(relicKey, 64) : '';
  const desc = STORE_RELIC_COPY[relicKey] || relic.desc || relic.description || '';
  return `<div class="store-relic-offer ${ok ? 'affordable' : 'disabled'} ${relic.rarity || ''}">
    <div class="store-relic-art"><div class="relic-art-sprite" style="${style}"></div></div>
    <div class="store-relic-name">${escapeHtml(relic.name)}</div>
    <div class="store-relic-desc">${escapeHtml(desc)}</div>
    <button class="store-relic-buy" ${ok ? '' : 'disabled'} onclick="buyStoreRelic(${index},'${relicKey}',${cost})">Buy <span class="coin">✦</span> ${cost}</button>
  </div>`;
}

function renderStoreVesselTile(target = window) {
  const level = (persistOf(target).up || {}).relicSlot || 0;
  const maxed = level >= 2;
  const cost = storeVesselCost(target);
  const ok = !maxed && (persistOf(target).pool || 0) >= cost;
  return `<div class="store-relic-offer vessel ${ok ? 'affordable' : 'disabled'}">
    <div class="store-relic-art"><div class="store-vessel-glyph">＋</div></div>
    <div class="store-relic-name">Relic Vessel</div>
    <div class="store-relic-desc">${maxed ? 'Relic Slots maxed.' : 'Gain +1 Relic Slot. Max 5.'}</div>
    <button class="store-relic-buy" ${ok ? '' : 'disabled'} onclick="buyStoreVessel()">${maxed ? 'Maxed' : `Buy <span class="coin">✦</span> ${cost}`}</button>
  </div>`;
}

function renderRelicStoreSection(relics, target = window) {
  const cells = [renderStoreRelicTile(0, relics[0], target), renderStoreRelicTile(1, relics[1], target), renderStoreVesselTile(target)].join('');
  return `<section class="store-section relics">
    <div class="store-plaque"><span class="store-section-icon">♜</span>Relics</div>
    <div class="store-section-copy">Choose a relic or gain a relic slot.</div>
    <div class="store-relic-row">${cells}</div>
  </section>`;
}

export function openShopMain(){
  ensureStoreFrontStyles(window);
  if(state.pendingPool){persist.pool+=state.pendingPool;state.pendingPool=0;render();}
  const offers = currentStoreFrontOffers(window);
  const rc=_nextRefreshCost(),canRefresh=persist.pool>=rc;
  const html=`<div class="summary tarot-shop store-front-shell"><div class="store-front">
    <div class="store-title"><small>The</small>Oracle's Market</div>
    <div class="store-subtitle">Spend Reserve before the next reading.</div>
    <div class="store-reserve"><div class="store-reserve-label">Reserve</div><div class="store-reserve-value">${persist.pool}<span class="coin">✦</span></div></div>
    ${renderStoreSection('scoring','Scoring','✦','Improve Chips, Mult, or scoring patterns.',offers.scoring,window)}
    ${renderStoreSection('abilities','Draw & Abilities','✋','Improve your hand, Discards, and card abilities.',offers.abilities,window)}
    ${renderRelicStoreSection(offers.relics,window)}
    <div class="store-actions"><button class="store-refresh" ${canRefresh?'':'disabled'} onclick="refreshStoreFront()"><span class="store-refresh-icon">↻</span><span>Refresh Offers <span class="store-refresh-cost">✦ ${rc}</span></span></button><button class="store-proceed" onclick="continueReading()">Next Reading</button></div>
  </div></div>`;
  showOverlay(html);
}

export function refreshStoreFront(target = window){
  const p=persistOf(target),cost=target._nextRefreshCost?target._nextRefreshCost():5;
  if((p.pool||0)<cost)return false;
  const purchased=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'refresh',cost}):false;
  if(purchased!==true)return purchased;
  target._shopRefreshCount=(target._shopRefreshCount||0)+1;
  target._storeFrontOffers=buildStoreFrontOffers(target);
  if(typeof target.openShopMain==='function')target.openShopMain();
  return true;
}

export function buyStorePack(sectionKey,index,packId,cost,target = window){
  if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers[sectionKey]))target._storeFrontOffers[sectionKey][index]=null;
  if(typeof target.buyPack==='function')return target.buyPack(packId,cost);
  return false;
}

function chargeStoreRelic(cost,target = window){
  const p=persistOf(target);
  if((p.pool||0)<cost)return false;
  const charged=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:RELIC_CACHE_PACK_ID,cost}):false;
  if(charged!==true)return charged;
  target._packBuys ||= {};
  target._packBuys[RELIC_CACHE_PACK_ID]=(target._packBuys[RELIC_CACHE_PACK_ID]||0)+1;
  return true;
}

export function buyStoreRelic(index,relicKey,cost,target = window){
  const p=persistOf(target);
  if((p.pool||0)<cost)return false;
  const slots=typeof target.relicSlots==='function'?target.relicSlots():3;
  if((p.relics||[]).length>=slots)return showStoreRelicReplace(index,relicKey,cost,target);
  const charged=chargeStoreRelic(cost,target);
  if(charged!==true)return charged;
  const acquired=typeof target.doAcquireRelic==='function'?target.doAcquireRelic(relicKey,()=>{
    if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers.relics))target._storeFrontOffers.relics[index]=null;
    if(typeof target.openShopMain==='function')target.openShopMain();
  },target):false;
  return acquired;
}

export function showStoreRelicReplace(index,relicKey,cost,target = window){
  const relic=(target.RELICS||{})[relicKey];
  if(!relic||typeof target.showOverlay!=='function')return false;
  let html='<div class="summary tarot-shop relic-replace-screen">';
  html+=`<div class="pack-picker-header"><h3>Relic Slots Full</h3><p>Choose a relic to replace with <b>${escapeHtml(relic.name)}</b>.</p></div>`;
  html+='<div class="store-replace-grid">';
  for(const oldKey of persistOf(target).relics||[]){
    const oldRelic=(target.RELICS||{})[oldKey];
    if(!oldRelic)continue;
    html+=`<div class="store-replace-card"><b>${escapeHtml(oldRelic.name)}</b><p>${escapeHtml(STORE_RELIC_COPY[oldKey]||oldRelic.desc||'')}</p><button onclick="confirmStoreRelicReplace(${index},'${oldKey}','${relicKey}',${cost})">Replace</button></div>`;
  }
  html+='</div><div style="text-align:center;margin-top:10px"><button onclick="openShopMain()" style="background:transparent;border:none;color:#8a7551;font-size:12px;cursor:pointer;text-decoration:underline">Cancel</button></div></div>';
  target.showOverlay(html);
  return true;
}

export function confirmStoreRelicReplace(index,oldKey,newKey,cost,target = window){
  const charged=chargeStoreRelic(cost,target);
  if(charged!==true)return charged;
  const bought=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'relic',relicId:newKey,replaceRelicId:oldKey}):false;
  if(bought!==true)return bought;
  if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers.relics))target._storeFrontOffers.relics[index]=null;
  if(typeof target.renderRelicRack==='function')target.renderRelicRack();
  if(typeof target.openShopMain==='function')target.openShopMain();
  return true;
}

export function buyStoreVessel(target = window){
  const level=(persistOf(target).up||{}).relicSlot||0;
  if(level>=2)return false;
  const cost=storeVesselCost(target);
  if((persistOf(target).pool||0)<cost)return false;
  const html=`<div class="summary tarot-shop"><div class="pack-picker-header"><h3>Relic Vessel</h3><p>Gain +1 Relic Slot. Max 5.</p></div><div style="display:flex;justify-content:center;gap:10px;margin-top:12px"><button onclick="confirmStoreVessel(${cost})">Buy — ✦ ${cost}</button><button onclick="openShopMain()">Back</button></div></div>`;
  if(typeof target.showOverlay==='function')target.showOverlay(html);
  return true;
}

export function confirmStoreVessel(cost,target = window){
  const charged=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'relicSlot',cost}):false;
  if(charged!==true)return charged;
  const upgraded=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'upgrade',upgradeKey:'relicSlot'}):false;
  if(upgraded!==true)return upgraded;
  if(typeof target.renderRelicRack==='function')target.renderRelicRack();
  if(typeof target.openShopMain==='function')target.openShopMain();
  return true;
}

export function relicIconStyle(key,size){
  const p=RELIC_SPRITE[key];if(!p)return'';
  return`background-image:url('relic%20icons.png');background-size:${size*6}px ${size*4}px;background-position:${-p[0]*size}px ${-p[1]*size}px;background-repeat:no-repeat;`;
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
