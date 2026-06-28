// Market and relic-rack renderer (Phase 15.4). Moved verbatim from
// index.html. Offers and costs come through window.tlrShop
// (src/systems/shop.mjs); purchase logic stays with the game flow.
/* global state, persist, render, _nextRefreshCost, showOverlay, $, relicSlots, _relicRackKey, RELICS, _openRelicKey, RELIC_SPRITE */

const STORE_ABILITY_PACKS = Object.freeze(['innate', 'restless', 'second_sight', 'thread', 'foundation']);
const RELIC_CACHE_PACK_ID = 'relic';
const STORE_ASSET_PATH = './';
const STORE_FADE_MS = 260;

const STORE_PACK_COPY = Object.freeze({
  innate: 'Starting resources.',
  restless: 'Draw and Discard.',
  second_sight: 'Ability reveals.',
  thread: 'Relational abilities.',
  foundation: 'Chip bonuses.',
});

const STORE_PACK_CALLOUT = Object.freeze({
  foundation: { desc: 'Choose one chip bonus for your spread cards.', upgrades: ['Omen — all cards +1 Chip', 'Resonance — Majors +3 Chips', 'Suit bonuses — +1 Chip per matching card', 'Offering — +5 Reserve per reading'] },
  innate:     { desc: 'Choose one starting-hand improvement.', upgrades: ['Wider Hand — +1 hand size', 'Deep Current — draw +1 per reading', 'Blessed Start — +0.25 Mult on entry', 'First Light — first placed card +3 Chips', 'Deep Reserve — held cards +2 Chips'] },
  restless:   { desc: 'Choose one draw or discard enhancement.', upgrades: ['Extra Discard — +1 discard/reading', 'Mulligan — +1 mulligan charge', 'Nimble Fingers — draw after each discard', 'Quick Release — discards add +3 Chips', 'Ritual Depth — ability draws +1 extra'] },
  second_sight:{ desc: 'Choose one ability or reveal upgrade.', upgrades: ['Lens Mastery — abilities reveal +1 extra', 'Deeper Peek — Peek shows +1 more', 'Sight Discount — sight abilities free once/reading', 'Chosen — ability-taken cards +5 Chips'] },
  thread:     { desc: 'Choose one relational ability upgrade.', upgrades: ['Deeper Threads — Kin/Between/Neighbor reveal +1 more', 'Thread Bond — thread-taken cards +1 Chip each'] },
});

const STORE_SCORING_COPY = Object.freeze({
  rank: { name: 'Rank of a Kind', desc: '+5 Chips / +0.25 Mult', icon: 'isp-scoring' },
  sequence: { name: 'Sequence', desc: '+5 Chips / +0.5 Mult', icon: 'isp-scoring' },
  court_chips: { name: 'Full Court', desc: '+8 Chips / +0.25 Mult', icon: 'isp-kin' },
  royal_court_chips: { name: 'Royal Court', desc: '+8 Chips / +0.25 Mult', icon: 'isp-kin' },
  path_chips: { name: 'Path of the Magi', desc: '+15 Chips / +0.5 Mult', icon: 'isp-scoring' },
  suit_stamp: { name: 'Suit Stamp', desc: 'Major Arcana only. Scores in Royal Court for its suit.', icon: 'isp-scoring' },
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
  if (!doc) return;
  let style = doc.getElementById('store-front-style');
  if (!style) {
    style = doc.createElement('style');
    style.id = 'store-front-style';
    doc.head.appendChild(style);
  }
  style.textContent = `
    .modal:has(.store-front-shell){background:transparent;padding:0;align-items:center;justify-content:center}
    .summary.store-front-shell{background:transparent;border:0;box-shadow:none;padding:0;max-width:none;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
    .summary.store-front-shell.store-exiting{animation:storeShellFadeOut ${STORE_FADE_MS}ms ease-in both;pointer-events:none}
    @keyframes storeShellFadeOut{from{opacity:1}to{opacity:0}}

    .store-dim{position:absolute;inset:0;background:rgba(0,0,0,.82);animation:storeDimIn 420ms ease-out both;pointer-events:none;z-index:0}
    @keyframes storeDimIn{from{opacity:0}to{opacity:1}}

    .store-candle{position:relative;width:80px;height:80px;flex-shrink:0;margin-bottom:-8px;z-index:1;pointer-events:none;align-self:center;animation:storeCandleIn 220ms ease-out both}
    .store-candle img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:opacity 90ms linear}
    .store-candle .candle-off{opacity:1}
    .store-candle .candle-on{opacity:0}
    .store-candle.lit .candle-off{opacity:0}
    .store-candle.lit .candle-on{opacity:1}
    @keyframes storeCandleIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}

    .store-front{position:relative;width:min(96vw,560px);font-family:Georgia,serif;color:#eadbb9;z-index:1;opacity:0;transition:opacity 280ms ease-out}
    .store-front.store-visible{opacity:1}
    .store-front button{font-family:Georgia,serif;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .store-front button:disabled{cursor:not-allowed;opacity:.4}

    .store-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px}
    .store-refresh{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid rgba(226,181,100,.35);border-radius:8px;color:#f1dfbd;padding:7px 12px;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;transition:background .15s,opacity .15s}
    .store-refresh:not(:disabled):hover{background:rgba(255,255,255,.08)}
    .store-refresh:disabled{opacity:.35;cursor:not-allowed}
    .store-refresh-icon{font-size:1.15em;line-height:1}
    .store-refresh-cost{color:#e0b96a;font-size:.88em}
    .store-reserve-display{display:flex;flex-direction:column;align-items:flex-end;line-height:1}
    .store-reserve-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#b08040;font-family:system-ui,sans-serif}
    .store-reserve-amount{font-size:28px;color:#f1d196;text-shadow:0 1px 3px #000;line-height:1}
    .store-reserve-amount .coin{font-size:.42em;margin-left:.1em;color:#c89445;vertical-align:middle}

    .store-offer-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}

    .store-card{position:relative;border-radius:12px;background:transparent;border:1px solid rgba(200,160,80,.22);padding:14px 12px 56px;display:flex;flex-direction:column;align-items:center;text-align:center;transition:transform .13s,border-color .13s;min-height:180px}
    .store-card:not(.disabled):hover{transform:translateY(-2px);border-color:rgba(200,160,80,.5)}
    .store-card.disabled{opacity:.5}
    .store-card-tag{font:700 9px/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#9a7840;margin-bottom:8px;align-self:flex-start}
    .store-card-art{width:56px;height:56px;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;flex-shrink:0}
    .store-card-art .isp{transform:scale(.48);transform-origin:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}
    .store-card-art .relic-art-sprite{width:56px;height:56px;flex:0 0 56px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.65))}
    .store-vessel-glyph{font:800 30px/1 Georgia,serif;color:#f1d196;text-shadow:0 2px 6px #000}
    .store-card-name{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#f0dfbd;line-height:1.1;margin-bottom:4px}
    .store-card-desc{font:600 10px/1.25 system-ui,sans-serif;color:#b8a882;margin-bottom:4px}
    .store-card-lv{font:800 9px/1 system-ui,sans-serif;color:#c89445;text-transform:uppercase;margin-top:2px}
    .store-card-buy{position:absolute;bottom:10px;left:10px;right:10px;height:34px;border:1px solid rgba(226,181,100,.5);border-radius:7px;background:transparent;color:#f5d9a0;font:800 10px/1 Georgia,serif;text-transform:uppercase;letter-spacing:.05em}
    .store-card-buy:not(:disabled):hover{background:rgba(226,181,100,.1)}
    .store-card-buy .coin{color:#c99443;margin-left:.2em}
    .store-relic-art-btn{background:transparent!important;border:0!important;box-shadow:none!important;outline:0!important;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;width:56px;height:56px}

    .store-footer{display:flex;justify-content:flex-end;margin-top:14px}
    .store-proceed{background:transparent;border:1px solid rgba(226,181,100,.55);border-radius:8px;color:#f1dfbd;font:800 14px/1 Georgia,serif;text-transform:uppercase;letter-spacing:.07em;padding:10px 22px;transition:background .15s}
    .store-proceed:hover{background:rgba(200,160,60,.15)}

    .store-replace-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin-top:12px}
    .store-replace-card{border:1px solid rgba(210,161,94,.42);border-radius:8px;background:rgba(255,255,255,.04);padding:9px;text-align:center}
    .store-replace-card button{margin-top:8px}
    .store-relic-callout{z-index:10010;max-width:220px}
    .store-relic-callout .relic-callout-desc{font-size:12px;line-height:1.35}
    .store-pack-callout{z-index:10010;max-width:240px}
    .store-pack-callout .relic-callout-desc{font-size:12px;line-height:1.35;margin-bottom:6px}
    .store-pack-callout-list{margin:0;padding:0 0 0 16px;list-style:disc}
    .store-pack-callout-list li{font-size:11px;line-height:1.4;color:#c8b888;margin-bottom:2px}

    @media(prefers-reduced-motion:reduce){
      .store-dim{animation:none}
      .store-candle{animation:none}
      .store-front{opacity:1;transition:none}
      .summary.store-front-shell.store-exiting{animation:none;opacity:0}
    }
    @media(max-width:480px){
      .store-front{width:min(98vw,380px)}
      .store-offer-row{gap:8px}
      .store-card{padding:10px 8px 50px;min-height:160px}
      .store-card-art{width:48px;height:48px;margin-bottom:6px}
      .store-card-art .isp{transform:scale(.38)}
      .store-card-art .relic-art-sprite{width:48px;height:48px;flex-basis:48px}
      .store-relic-art-btn{width:48px;height:48px}
      .store-card-name{font-size:10px}
      .store-card-desc{font-size:9px}
      .store-card-buy{height:30px;font-size:9px;bottom:8px;left:8px;right:8px}
      .store-vessel-glyph{font-size:24px}
      .store-refresh{font-size:11px;padding:6px 10px}
      .store-reserve-amount{font-size:22px}
      .store-candle{width:60px;height:60px}
    }
  `;
}

function updateStoreReserveDisplay(target = window) {
  const display = target.document && target.document.querySelector('.store-reserve-amount');
  if (display) display.textContent = (persistOf(target).pool || 0) + display.innerHTML.match(/<span[^>]*>.*<\/span>/)?.[0] || '';
  if (display) {
    const amt = persistOf(target).pool || 0;
    const coin = display.querySelector('.coin');
    display.textContent = amt;
    if (coin) display.appendChild(coin);
  }
}

function markCardPurchased(slotIndex, target = window) {
  // Remove any open callouts so they don't block subsequent button clicks
  if (target.document) target.document.querySelectorAll('.relic-callout,.store-relic-callout,.store-pack-callout').forEach(el => el.remove());
  const row = target.document && target.document.querySelector('.store-offer-row');
  if (!row) return;
  const cards = row.querySelectorAll('.store-card');
  const card = cards[slotIndex];
  if (!card) return;
  card.style.transition = 'opacity 220ms ease-out';
  card.style.opacity = '0';
  setTimeout(() => {
    card.innerHTML = '<div class="store-card-tag" style="opacity:.4">Purchased</div><div style="flex:1;display:flex;align-items:center;justify-content:center;color:rgba(200,160,80,.35);font-size:22px">✦</div>';
    card.style.opacity = '1';
    card.style.pointerEvents = 'none';
    updateStoreReserveDisplay(target);
    // also update refresh button
    const rc = target._nextRefreshCost ? target._nextRefreshCost() : 5;
    const refreshBtn = target.document.querySelector('.store-refresh');
    if (refreshBtn) refreshBtn.disabled = (persistOf(target).pool || 0) < rc;
    const refreshCost = target.document.querySelector('.store-refresh-cost');
    if (refreshCost) refreshCost.textContent = `✦ ${rc}`;
  }, 230);
}

function shuffleValues(values, target = window) {
  const copy = [...values];
  const shuffle = target.shuffle;
  if (typeof shuffle === 'function') return shuffle(copy);
  return copy.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
}

const STORE_SCORING_UPGRADES = Object.freeze(['rank', 'sequence', 'court_chips', 'royal_court_chips', 'path_chips', 'suit_stamp']);

function pickScoringUpgrades(count, target = window) {
  const shop = target.SHOP || {};
  return shuffleValues(STORE_SCORING_UPGRADES, target).filter(key => shop[key]).slice(0, count);
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
    scoring: pickScoringUpgrades(1, target),
    pack: pickPacks(STORE_ABILITY_PACKS, 1, target),
    relics: pickRelics(1, target),
  };
}

function currentStoreFrontOffers(target = window) {
  const owned = new Set((persistOf(target).relics || []));
  if (!target._storeFrontOffers) target._storeFrontOffers = buildStoreFrontOffers(target);
  const offers = target._storeFrontOffers;
  offers.scoring = Array.isArray(offers.scoring) ? offers.scoring.slice(0, 1) : [];
  offers.pack = Array.isArray(offers.pack) ? offers.pack.slice(0, 1) : [];
  offers.relics = (Array.isArray(offers.relics) ? offers.relics : []).filter(key => key && !owned.has(key)).slice(0, 1);
  if (offers.relics.length < 1) {
    const fill = pickRelics(4, target).filter(key => !offers.relics.includes(key));
    while (offers.relics.length < 1 && fill.length) offers.relics.push(fill.shift());
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

function scoringCostFor(upgradeKey, target = window) {
  if (typeof target.shopCost === 'function') return target.shopCost(upgradeKey);
  const item = (target.SHOP || {})[upgradeKey];
  const level = (persistOf(target).up || {})[upgradeKey] || 0;
  return item ? Math.floor(item[2] * Math.pow(item[3], level)) : 0;
}

function pairedUpgradeKey(upgradeKey, target = window) {
  return (target.SHOP || {})[upgradeKey]?.[6] || null;
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

function renderScoringCard(index, upgradeKey, target = window) {
  if (!upgradeKey) return '<div class="store-card disabled"><div class="store-card-tag">Scoring</div><div class="store-card-name">—</div></div>';
  const item = (target.SHOP || {})[upgradeKey];
  if (!item) return '<div class="store-card disabled"><div class="store-card-tag">Scoring</div><div class="store-card-name">—</div></div>';
  const copy = STORE_SCORING_COPY[upgradeKey] || { name: item[0], desc: String(item[1] || '').replace(/<[^>]*>/g, ''), icon: (target.SHOP_ICON || {})[upgradeKey] || 'isp-scoring' };
  const cost = scoringCostFor(upgradeKey, target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const level = (persistOf(target).up || {})[upgradeKey] || 0;
  return `<div class="store-card ${ok ? '' : 'disabled'}">
    <div class="store-card-tag">Scoring</div>
    <div class="store-card-art"><span class="isp isp-108 ${copy.icon}"></span></div>
    <div class="store-card-name">${escapeHtml(copy.name)}</div>
    <div class="store-card-desc">${escapeHtml(copy.desc)}</div>
    <div class="store-card-lv">Lv ${level} → ${level + 1}</div>
    <button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreScoringUpgrade(${index},'${upgradeKey}',${cost})">Buy <span class="coin">✦</span> ${cost}</button>
  </div>`;
}

function renderPackCard(index, packId, target = window) {
  if (!packId) return '<div class="store-card disabled"><div class="store-card-tag">Pack</div><div class="store-card-name">—</div></div>';
  const pack = (target.PACKS || {})[packId];
  if (!pack) return '<div class="store-card disabled"><div class="store-card-tag">Pack</div><div class="store-card-name">—</div></div>';
  const cost = packCostFor(packId, target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const desc = STORE_PACK_COPY[packId] || pack.desc || '';
  return `<div class="store-card ${ok ? '' : 'disabled'}">
    <div class="store-card-tag">Pack</div>
    <button type="button" class="store-relic-art-btn" onclick="showStorePackCallout('${packId}',this);event.stopPropagation()" aria-label="Show ${escapeHtml(pack.name)} details"><div class="store-card-art" style="pointer-events:none"><span class="isp isp-108 ${pack.icon}"></span></div></button>
    <div class="store-card-name">${escapeHtml(pack.name)}</div>
    <div class="store-card-desc">${escapeHtml(desc)}</div>
    <button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStorePack('pack',${index},'${packId}',${cost})">Open <span class="coin">✦</span> ${cost}</button>
  </div>`;
}

function renderRelicCard(index, relicKey, target = window) {
  if (!relicKey) return renderVesselCard(target);
  const relic = (target.RELICS || {})[relicKey];
  if (!relic) return renderVesselCard(target);
  const cost = relicCost(target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const style = typeof target.relicIconStyle === 'function' ? target.relicIconStyle(relicKey, 56) : '';
  return `<div class="store-card ${ok ? '' : 'disabled'} ${relic.rarity || ''}">
    <div class="store-card-tag">Relic</div>
    <div class="store-card-art">
      <button class="store-relic-art-btn" type="button" onclick="showStoreRelicCallout('${relicKey}',this);event.stopPropagation()" aria-label="Show ${escapeHtml(relic.name)} details"><div class="relic-art-sprite" style="${style}"></div></button>
    </div>
    <div class="store-card-name">${escapeHtml(relic.name)}</div>
    <button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreRelic(${index},'${relicKey}',${cost})">Buy <span class="coin">✦</span> ${cost}</button>
  </div>`;
}

function renderVesselCard(target = window) {
  const level = (persistOf(target).up || {}).relicSlot || 0;
  const maxed = level >= 2;
  const cost = storeVesselCost(target);
  const ok = !maxed && (persistOf(target).pool || 0) >= cost;
  return `<div class="store-card ${ok ? '' : 'disabled'}">
    <div class="store-card-tag">Relic Slot</div>
    <div class="store-card-art"><div class="store-vessel-glyph">＋</div></div>
    <div class="store-card-name">Relic Vessel</div>
    <div class="store-card-desc">${maxed ? 'Relic Slots maxed.' : 'Gain +1 Relic Slot'}</div>
    <button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreVessel()">${maxed ? 'Maxed' : `Buy <span class="coin">✦</span> ${cost}`}</button>
  </div>`;
}

export function showStorePackCallout(packId, anchor, target = window) {
  const pack = (target.PACKS || {})[packId];
  const info = STORE_PACK_CALLOUT[packId];
  if (!pack || !info) return false;
  target.document.querySelectorAll('.relic-callout,.store-relic-callout,.store-pack-callout').forEach(el => el.remove());
  const callout = target.document.createElement('div');
  callout.className = 'relic-callout store-pack-callout';
  const upgradesList = info.upgrades.map(u => `<li>${escapeHtml(u)}</li>`).join('');
  callout.innerHTML = `<div class="relic-callout-name">${escapeHtml(pack.name)}</div><div class="relic-callout-desc">${escapeHtml(info.desc)}</div><ul class="store-pack-callout-list">${upgradesList}</ul>`;
  target.document.body.appendChild(callout);
  const rect = anchor.getBoundingClientRect();
  callout.style.top = `${rect.bottom + 6}px`;
  callout.style.left = '0px';
  target.requestAnimationFrame(() => {
    const cw = callout.offsetWidth, ch = callout.offsetHeight, mg = 8;
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(mg, Math.min(target.innerWidth - cw - mg, left));
    let top = rect.bottom + 6;
    if (top + ch > target.innerHeight - mg) top = Math.max(mg, rect.top - ch - 6);
    callout.style.left = `${left}px`;
    callout.style.top = `${top}px`;
  });
  return true;
}

export function showStoreRelicCallout(relicKey, anchor, target = window) {
  const relic = (target.RELICS || {})[relicKey];
  if (!relic) return false;
  target.document.querySelectorAll('.relic-callout,.store-relic-callout,.store-pack-callout').forEach(el => el.remove());
  const style = typeof target.relicIconStyle === 'function' ? target.relicIconStyle(relicKey, 24) : '';
  const desc = relic.desc || relic.description || STORE_RELIC_COPY[relicKey] || '';
  const callout = target.document.createElement('div');
  callout.className = 'relic-callout store-relic-callout';
  callout.innerHTML = `<div class="relic-callout-name"><div style="display:inline-block;width:24px;height:24px;vertical-align:middle;${style}"></div> ${escapeHtml(relic.name)}</div><div class="relic-callout-desc">${escapeHtml(desc)}</div>`;
  target.document.body.appendChild(callout);
  const rect = anchor.getBoundingClientRect();
  callout.style.top = `${rect.bottom + 6}px`;
  callout.style.left = '0px';
  target.requestAnimationFrame(() => {
    const cw = callout.offsetWidth;
    const ch = callout.offsetHeight;
    const mg = 8;
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(mg, Math.min(target.innerWidth - cw - mg, left));
    let top = rect.bottom + 6;
    if (top + ch > target.innerHeight - mg) top = Math.max(mg, rect.top - ch - 6);
    callout.style.left = `${left}px`;
    callout.style.top = `${top}px`;
  });
  return true;
}

function playCandleSnuff(target = window) {
  try {
    const ctx = target._tlrACtx || (target._tlrACtx = new (target.AudioContext || target.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const vol = typeof target._sfxVol === 'number' ? target._sfxVol : 1;
    // soft puff/hiss — high-freq noise that decays quickly
    const dur = 0.22;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * Math.min(1, t * 20) * 0.6;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18 * vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  } catch(e) {}
}

export function storeExitToNextReading(target = window) {
  const shell = target.document.querySelector('.store-front-shell');
  if (!shell) {
    if (typeof target.continueReading === 'function') target.continueReading();
    return true;
  }
  if (shell.classList.contains('store-exiting')) return true;
  target.document.querySelectorAll('.relic-callout,.store-relic-callout,.store-pack-callout').forEach(el => el.remove());
  const reduce = target.matchMedia && target.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    shell.classList.add('store-exiting');
    target.setTimeout(() => { if (typeof target.continueReading === 'function') target.continueReading(); }, 0);
    return true;
  }
  // snuff the candle first, then fade out
  const candle = target.document.getElementById('storeCandle');
  if (candle && candle.classList.contains('lit')) {
    playCandleSnuff(target);
    candle.classList.remove('lit');
  }
  target.setTimeout(() => {
    shell.classList.add('store-exiting');
    target.setTimeout(() => {
      if (typeof target.continueReading === 'function') target.continueReading();
    }, STORE_FADE_MS);
  }, 200);
  return true;
}

const MARKET_AMBIENCE_FILES = Object.freeze([
  { file: 'assets/audio/soundreality-bell-fx-410608.mp3', vol: 0.24 },
  { file: 'assets/audio/izafi-gong-sound-419930.mp3',     vol: 0.7  },
  { file: 'assets/audio/olenchic-psycho-1-155031.mp3',    vol: 0.7  },
  { file: 'assets/audio/alex_jauk-witch-laugh-256450.mp3', vol: 1.0  },
]);

function playMarketAmbience(target = window) {
  const entry = MARKET_AMBIENCE_FILES[Math.floor(Math.random() * MARKET_AMBIENCE_FILES.length)];
  try {
    const vol = typeof target._sfxVol === 'number' ? target._sfxVol : 1;
    const a = new (target.Audio || Audio)(entry.file);
    a.volume = vol * entry.vol;
    a.play().catch(() => {});
  } catch(e) {}
}

function playMatchLight(target = window) {
  try {
    const ctx = target._tlrACtx || (target._tlrACtx = new (target.AudioContext || target.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const vol = typeof target._sfxVol === 'number' ? target._sfxVol : 1;
    // scratch/hiss burst
    const dur = 0.18;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.2) * Math.min(1, t * 12);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.28 * vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  } catch(e) {}
}

export function openShopMain(){
  ensureStoreFrontStyles(window);
  if(state.pendingPool){persist.pool+=state.pendingPool;state.pendingPool=0;render();}
  const offers = currentStoreFrontOffers(window);
  const rc=_nextRefreshCost(),canRefresh=persist.pool>=rc;
  const relicKey = offers.relics[0] || null;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // if store is already open (e.g. returning from a pack picker), skip the intro
  const alreadyOpen = !!document.querySelector('.store-front-shell:not(.store-exiting)');

  const inner=`
    <div class="store-meta">
      <button class="store-refresh" ${canRefresh?'':'disabled'} onclick="refreshStoreFront()"><span class="store-refresh-icon">↻</span> Refresh <span class="store-refresh-cost">✦ ${rc}</span></button>
      <div class="store-reserve-display"><div class="store-reserve-label">Reserve</div><div class="store-reserve-amount">${persist.pool}<span class="coin">✦</span></div></div>
    </div>
    <div class="store-offer-row">
      ${renderScoringCard(0, offers.scoring[0], window)}
      ${renderPackCard(0, offers.pack[0], window)}
      ${relicKey ? renderRelicCard(0, relicKey, window) : renderVesselCard(window)}
    </div>
    <div class="store-footer">
      <button class="store-proceed" onclick="storeExitToNextReading()">Next Reading →</button>
    </div>`;

  const html=`<div class="summary tarot-shop store-front-shell">
    <div class="store-dim"></div>
    <div class="store-candle${alreadyOpen ? ' lit' : ''}" id="storeCandle">
      <img class="candle-off" src="ui/candle_flame_off.png" alt="">
      <img class="candle-on"  src="ui/candle_flame_on.png"  alt="">
    </div>
    <div class="store-front${alreadyOpen ? ' store-visible' : ''}" id="storeFront">${inner}</div>
  </div>`;
  showOverlay(html);

  if (alreadyOpen || reduce) return;

  // light the candle after dim appears, then fade in content + play ambience
  setTimeout(() => {
    const candle = document.getElementById('storeCandle');
    if (candle) { playMatchLight(window); candle.classList.add('lit'); }
  }, 300);

  setTimeout(() => {
    const front = document.getElementById('storeFront');
    if (front) front.classList.add('store-visible');
    playMarketAmbience(window);
  }, 520);
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
  if(target._storeFrontOffers)target._storeFrontOffers.pack=[null];
  markCardPurchased(1,target);
  if(typeof target.buyPack==='function')return target.buyPack(packId,cost);
  return false;
}

export function buyStoreScoringUpgrade(index,upgradeKey,cost,target = window){
  const p=persistOf(target);
  if((p.pool||0)<cost)return false;
  const charged=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'scoringUpgrade',cost}):false;
  if(charged!==true)return charged;
  if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers.scoring))target._storeFrontOffers.scoring[index]=null;
  if(typeof target.render==='function')target.render();
  if(upgradeKey==='suit_stamp'){
    if(typeof target.openStampPicker==='function')target.openStampPicker(index);
    return true;
  }
  const pairedKey=pairedUpgradeKey(upgradeKey,target);
  const upgraded=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'upgrade',upgradeKey,pairedKey}):false;
  if(upgraded!==true)return upgraded;
  markCardPurchased(0,target);
  return true;
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
    if(target._storeFrontOffers)target._storeFrontOffers.relics=[];
    markCardPurchased(2,target);
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
    html+=`<div class="store-replace-card"><b>${escapeHtml(oldRelic.name)}</b><p>${escapeHtml(STORE_RELIC_COPY[oldKey]||oldRelic.desc||oldRelic.description||'')}</p><button onclick="confirmStoreRelicReplace(${index},'${oldKey}','${relicKey}',${cost})">Replace</button></div>`;
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
  if(target._storeFrontOffers)target._storeFrontOffers.relics=[];
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
  return`background-image:url('assets/relic_icons.png');background-size:${size*6}px ${size*4}px;background-position:${-p[0]*size}px ${-p[1]*size}px;background-repeat:no-repeat;`;
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
    <div class="relic-callout-desc">${r.desc||r.description||''}</div>
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
