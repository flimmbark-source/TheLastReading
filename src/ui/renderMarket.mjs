// Market and relic-rack renderer (Phase 15.4). Moved verbatim from
// index.html. Offers and costs come through window.tlrShop
// (src/systems/shop.mjs); purchase logic stays with the game flow.
/* global state, persist, render, _nextRefreshCost, showOverlay, $, relicSlots, _relicRackKey, RELICS, _openRelicKey, RELIC_SPRITE */

const STORE_ABILITY_PACKS = Object.freeze(['innate', 'restless', 'second_sight', 'thread', 'foundation']);
const RELIC_CACHE_PACK_ID = 'relic';
const STORE_ASSET_PATH = './';
const STORE_FADE_MS = 260;
const STORE_SLOT = Object.freeze({ SCORING: 0, STAMP: 1, PACK: 2, RELIC_A: 3, RELIC_B: 4 });

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
  second_sight:{ desc: 'Choose one ability or reveal upgrade.', upgrades: ['Lens Mastery — abilities reveal +1 extra', 'Deeper Peek — Peek shows +1 more', "Seer's Grace — Peek/Search/Mirror free once per reading", 'Chosen — ability-taken cards +5 Chips'] },
  thread:     { desc: 'Choose one relational ability upgrade.', upgrades: ['Deeper Threads — Kin/Between/Neighbor reveal +1 more', 'Thread Bond — thread-taken cards +1 Chip each'] },
});

const STORE_SCORING_COPY = Object.freeze({
  rank: { name: 'Rank of a Kind', desc: '+5 Chips / +0.25 Mult', icon: 'isp-scoring' },
  sequence: { name: 'Sequence', desc: '+5 Chips / +0.5 Mult', icon: 'isp-scoring' },
  court_chips: { name: 'Full Court', desc: '+8 Chips / +0.25 Mult', icon: 'isp-kin' },
  royal_court_chips: { name: 'Royal Court', desc: '+8 Chips / +0.25 Mult', icon: 'isp-kin' },
  path_chips: { name: 'Path of the Magi', desc: '+15 Chips / +0.5 Mult', icon: 'isp-scoring' },
  suit_stamp: { name: 'Suit Stamp', desc: 'Major Arcana. Suits shown on card art count in Royal Court.', icon: 'isp-scoring' },
  five_stamp: { name: 'Five Star', desc: 'Any card. Slots into Sequences as a multiple of 5.', icon: 'isp-scoring' },
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

    .store-front{position:relative;width:min(96vw,560px);max-height:calc(100dvh - 128px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;font-family:Georgia,serif;color:#eadbb9;z-index:1;opacity:0;transition:opacity 280ms ease-out}
    .store-front.store-visible{opacity:1}

    body.tlr-shop-active .score-stack{visibility:hidden;pointer-events:none}
    body.tlr-shop-active #menuBtn,body.tlr-shop-active #scoringBtn,body.tlr-shop-active #abilitiesBtn,body.tlr-shop-active #spv2ArchiveBtn{visibility:hidden;pointer-events:none}
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

    .store-offer-row{display:flex;flex-direction:column;gap:12px}
    .store-grid-top,.store-grid-bottom{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .store-pack-feature{display:block}

    .store-card{position:relative;display:flex;align-items:center;gap:14px;min-height:96px;padding:27px 14px 12px 18px;border:1px solid rgba(200,160,80,.28);border-radius:12px;background:linear-gradient(180deg,rgba(26,17,10,.55),rgba(9,6,4,.6));text-align:left;transition:border-color .13s}
    .store-card::before{content:'';position:absolute;left:-1px;top:16px;bottom:16px;width:2px;border-radius:2px;background:var(--store-accent,rgba(201,162,74,.5));opacity:.75;pointer-events:none}
    .store-card:not(.disabled):hover{border-color:rgba(200,160,80,.5)}
    .store-card.disabled{opacity:.55}
    .store-card--pack{--store-accent:rgba(157,139,184,.55)}
    .store-card--stamp{--store-accent:rgba(92,126,201,.6)}
    .store-card--relic,.store-card--vessel{--store-accent:rgba(127,168,162,.55)}
    .store-card-tag{position:absolute;top:9px;left:18px;font:700 10px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#9a7840}
    .store-card--pack .store-card-tag{color:#9d8bb8}
    .store-card--stamp .store-card-tag{color:#89a5df}
    .store-card--relic .store-card-tag,.store-card--vessel .store-card-tag{color:#7fa8a2}
    .store-card-art{width:56px;height:56px;flex:0 0 56px;display:flex;align-items:center;justify-content:center}
    .store-card-art .isp{transform:scale(.48);transform-origin:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}
    .store-card-art .relic-art-sprite{width:56px;height:56px;flex:0 0 56px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.65))}
    .store-vessel-glyph{font:800 30px/1 Georgia,serif;color:#f1d196;text-shadow:0 2px 6px #000}
    .store-card-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
    .store-card-name{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#f0dfbd;line-height:1.15}
    .store-card-desc{font:600 12px/1.35 system-ui,sans-serif;color:#b8a882}
    .store-card-lv{font:800 10px/1 system-ui,sans-serif;color:#c89445;text-transform:uppercase;margin-top:2px}
    .store-card--vessel .store-card-lv{color:#7fa8a2}
    .store-card-buy{flex:0 0 auto;min-width:104px;min-height:46px;padding:0 14px;border:1px solid rgba(226,181,100,.5);border-radius:8px;background:transparent;color:#f5d9a0;font:800 12px/1.2 Georgia,serif;text-transform:uppercase;letter-spacing:.05em}
    .store-card-buy:not(:disabled):hover{background:rgba(226,181,100,.1)}
    .store-card-buy .coin{color:#c99443;margin-left:.2em}
    .store-relic-art-btn{background:transparent!important;border:0!important;box-shadow:none!important;outline:0!important;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;width:56px;height:56px;flex:0 0 56px}

    .store-grid-top .store-card,.store-grid-bottom .store-card{min-height:168px;align-items:stretch;flex-direction:column;gap:8px;padding:28px 10px 10px;text-align:center}
    .store-grid-top .store-card::before,.store-grid-bottom .store-card::before{left:14px;right:14px;top:auto;bottom:-1px;width:auto;height:2px}
    .store-grid-top .store-card-tag,.store-grid-bottom .store-card-tag{left:0;right:0;text-align:center}
    .store-grid-top .store-card-art,.store-grid-bottom .store-card-art{width:50px;height:50px;flex:0 0 50px;margin:0 auto}
    .store-grid-top .store-card-art .isp,.store-grid-bottom .store-card-art .isp{transform:scale(.42)}
    .store-grid-top .store-card-art .relic-art-sprite,.store-grid-bottom .store-card-art .relic-art-sprite{width:50px;height:50px;flex-basis:50px}
    .store-grid-top .store-relic-art-btn,.store-grid-bottom .store-relic-art-btn{width:50px;height:50px;flex-basis:50px;margin:0 auto}
    .store-grid-top .store-card-main,.store-grid-bottom .store-card-main{align-items:center;justify-content:flex-start;min-height:0}
    .store-grid-top .store-card-name,.store-grid-bottom .store-card-name{font-size:13px;line-height:1.1}
    .store-grid-top .store-card-desc,.store-grid-bottom .store-card-desc{font-size:10.5px;line-height:1.25}
    .store-grid-top .store-card-lv,.store-grid-bottom .store-card-lv{font-size:9.5px}
    .store-grid-top .store-card-buy,.store-grid-bottom .store-card-buy{width:100%;min-width:0;min-height:38px;margin-top:auto;padding:0 8px;font-size:10.5px}
    .store-pack-feature .store-card{min-height:112px;border-color:rgba(157,139,184,.42);background:linear-gradient(180deg,rgba(34,22,38,.62),rgba(10,7,10,.7))}

    .store-footer{display:flex;justify-content:center;margin-top:16px}
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
      .store-front{width:96vw;max-height:calc(100dvh - 108px)}
      .store-offer-row{gap:10px}
      .store-card{gap:10px;min-height:88px;padding:25px 10px 10px 14px}
      .store-card-tag{left:14px}
      .store-card-art{width:48px;height:48px;flex-basis:48px}
      .store-card-art .isp{transform:scale(.4)}
      .store-card-art .relic-art-sprite{width:48px;height:48px;flex-basis:48px}
      .store-relic-art-btn{width:48px;height:48px;flex-basis:48px}
      .store-card-name{font-size:13.5px}
      .store-card-desc{font-size:11.5px}
      .store-card-buy{min-width:92px;min-height:44px;padding:0 10px;font-size:11px}
      .store-vessel-glyph{font-size:26px}
      .store-refresh{font-size:11px;padding:8px 10px}
      .store-reserve-amount{font-size:24px}
      .store-candle{width:60px;height:60px}
      .store-grid-top,.store-grid-bottom{gap:8px}
      .store-grid-top .store-card,.store-grid-bottom .store-card{min-height:158px;padding:27px 8px 8px}
      .store-grid-top .store-card-tag,.store-grid-bottom .store-card-tag{left:0}
      .store-grid-top .store-card-art,.store-grid-bottom .store-card-art{width:46px;height:46px;flex-basis:46px}
      .store-grid-top .store-card-art .isp,.store-grid-bottom .store-card-art .isp{transform:scale(.39)}
      .store-grid-top .store-card-name,.store-grid-bottom .store-card-name{font-size:12.5px}
      .store-grid-top .store-card-desc,.store-grid-bottom .store-card-desc{font-size:10px}
      .store-grid-top .store-card-buy,.store-grid-bottom .store-card-buy{min-height:36px;font-size:10px}
      .store-pack-feature .store-card{min-height:108px}
    }
  `;
}

function updateStoreReserveDisplay(target = window) {
  const display = target.document && target.document.querySelector('.store-reserve-amount');
  if (!display) return;
  const amt = persistOf(target).pool || 0;
  const coin = display.querySelector('.coin');
  display.textContent = amt;
  if (coin) display.appendChild(coin);
}

function markCardPurchased(slotIndex, target = window) {
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

const STORE_SCORING_UPGRADES = Object.freeze(['rank', 'sequence', 'court_chips', 'royal_court_chips', 'path_chips', 'suit_stamp', 'five_stamp']);
const STORE_STAMP_UPGRADES = Object.freeze(['suit_stamp', 'five_stamp']);
const STORE_NORMAL_SCORING_UPGRADES = Object.freeze(STORE_SCORING_UPGRADES.filter(key => !STORE_STAMP_UPGRADES.includes(key)));

function pickFromUpgradePool(pool, count, target = window) {
  const shop = target.SHOP || {};
  return shuffleValues(pool, target).filter(key => shop[key]).slice(0, count);
}
function pickScoringUpgrades(count, target = window) { return pickFromUpgradePool(STORE_NORMAL_SCORING_UPGRADES, count, target); }
function pickStampUpgrades(count, target = window) { return pickFromUpgradePool(STORE_STAMP_UPGRADES, count, target); }
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
    stamps: pickStampUpgrades(1, target),
    pack: pickPacks(STORE_ABILITY_PACKS, 1, target),
    relics: pickRelics(2, target),
  };
}

function currentStoreFrontOffers(target = window) {
  const owned = new Set((persistOf(target).relics || []));
  if (!target._storeFrontOffers) target._storeFrontOffers = buildStoreFrontOffers(target);
  const offers = target._storeFrontOffers;
  offers.scoring = Array.isArray(offers.scoring) ? offers.scoring.slice(0, 1) : [];
  offers.stamps = Array.isArray(offers.stamps) ? offers.stamps.slice(0, 1) : [];
  offers.pack = Array.isArray(offers.pack) ? offers.pack.slice(0, 1) : [];
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
function scoringCostFor(upgradeKey, target = window) {
  if (typeof target.shopCost === 'function') return target.shopCost(upgradeKey);
  const item = (target.SHOP || {})[upgradeKey];
  const level = (persistOf(target).up || {})[upgradeKey] || 0;
  return item ? Math.floor(item[2] * Math.pow(item[3], level)) : 0;
}
function pairedUpgradeKey(upgradeKey, target = window) { return (target.SHOP || {})[upgradeKey]?.[6] || null; }
function relicCost(target = window) {
  const pack = (target.PACKS || {})[RELIC_CACHE_PACK_ID];
  if (!pack) return 24;
  return target.tlrShop?.packCost
    ? target.tlrShop.packCost(pack.cost, (target._packBuys || {})[RELIC_CACHE_PACK_ID] || 0, (persistOf(target).relics || []))
    : pack.cost + (((target._packBuys || {})[RELIC_CACHE_PACK_ID] || 0) * 8);
}
function storeVesselCost(target = window) { return typeof target.shopCost === 'function' ? target.shopCost('relicSlot') : 35; }

const STAMP_ART = Object.freeze({
  suit_stamp: '<div style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#3a6bbf,#152a5c 72%,#070e1e);display:flex;align-items:center;justify-content:center;font:900 24px/1 Georgia,serif;color:#f5e0b4;text-shadow:0 2px 4px rgba(0,0,0,.9);border:2px solid rgba(210,175,100,.65);box-shadow:0 2px 8px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.5)">♡</div>',
  five_stamp: '<div style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#d4a017,#7a5800 72%,#2a1c00);display:flex;align-items:center;justify-content:center;font:900 16px/1 Georgia,serif;color:#f5e0b4;text-shadow:0 2px 4px rgba(0,0,0,.9);border:2px solid rgba(210,175,100,.65);box-shadow:0 2px 8px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.5)">5★</div>',
});

function renderScoringCard(index, upgradeKey, target = window, options = {}) {
  const isStamp = !!options.stamp;
  const tag = isStamp ? 'Stamp' : 'Scoring';
  const cardClass = isStamp ? 'store-card--stamp' : 'store-card--scoring';
  const purchaseSection = isStamp ? 'stamps' : 'scoring';
  const emptyRow = `<div class="store-card ${cardClass} disabled"><div class="store-card-tag">${tag}</div><div class="store-card-main"><div class="store-card-name">—</div></div></div>`;
  if (!upgradeKey) return emptyRow;
  const item = (target.SHOP || {})[upgradeKey];
  if (!item) return emptyRow;
  const copy = STORE_SCORING_COPY[upgradeKey] || { name: item[0], desc: String(item[1] || '').replace(/<[^>]*>/g, ''), icon: (target.SHOP_ICON || {})[upgradeKey] || 'isp-scoring' };
  const cost = scoringCostFor(upgradeKey, target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const level = (persistOf(target).up || {})[upgradeKey] || 0;
  const art = STAMP_ART[upgradeKey]
    ? `<div class="store-card-art">${STAMP_ART[upgradeKey]}</div>`
    : `<div class="store-card-art"><span class="isp isp-108 ${copy.icon}"></span></div>`;
  return `<div class="store-card ${cardClass} ${ok ? '' : 'disabled'}">
    <div class="store-card-tag">${tag}</div>
    ${art}
    <div class="store-card-main">
      <div class="store-card-name">${escapeHtml(copy.name)}</div>
      <div class="store-card-desc">${escapeHtml(copy.desc)}</div>
      <div class="store-card-lv">Lv ${level} → ${level + 1}</div>
    </div>
    <button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreScoringUpgrade(${index},'${upgradeKey}',${cost},'${purchaseSection}')">Buy <span class="coin">✦</span> ${cost}</button>
  </div>`;
}

function renderPackCard(index, packId, target = window) {
  const emptyRow = '<div class="store-card store-card--pack disabled"><div class="store-card-tag">Pack</div><div class="store-card-main"><div class="store-card-name">—</div></div></div>';
  if (!packId) return emptyRow;
  const pack = (target.PACKS || {})[packId];
  if (!pack) return emptyRow;
  const cost = packCostFor(packId, target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const desc = STORE_PACK_COPY[packId] || pack.desc || '';
  return `<div class="store-card store-card--pack ${ok ? '' : 'disabled'}">
    <div class="store-card-tag">Pack</div>
    <button type="button" class="store-relic-art-btn" onclick="showStorePackCallout('${packId}',this);event.stopPropagation()" aria-label="Show ${escapeHtml(pack.name)} details"><div class="store-card-art" style="pointer-events:none"><span class="isp isp-108 ${pack.icon}"></span></div></button>
    <div class="store-card-main">
      <div class="store-card-name">${escapeHtml(pack.name)}</div>
      <div class="store-card-desc">${escapeHtml(desc)}</div>
    </div>
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
  const desc = STORE_RELIC_COPY[relicKey] || relic.desc || relic.description || '';
  return `<div class="store-card store-card--relic ${ok ? '' : 'disabled'} ${relic.rarity || ''}">
    <div class="store-card-tag">Relic</div>
    <div class="store-card-art">
      <button class="store-relic-art-btn" type="button" onclick="showStoreRelicCallout('${relicKey}',this);event.stopPropagation()" aria-label="Show ${escapeHtml(relic.name)} details"><div class="relic-art-sprite" style="${style}"></div></button>
    </div>
    <div class="store-card-main">
      <div class="store-card-name">${escapeHtml(relic.name)}</div>
      <div class="store-card-desc">${escapeHtml(desc)}</div>
    </div>
    <button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreRelic(${index},'${relicKey}')">Buy <span class="coin">✦</span> ${cost}</button>
  </div>`;
}

function renderVesselCard(target = window) {
  const level = (persistOf(target).up || {}).relicSlot || 0;
  const maxed = level >= 2;
  const cost = storeVesselCost(target);
  const ok = !maxed && (persistOf(target).pool || 0) >= cost;
  const slots = typeof target.relicSlots === 'function' ? target.relicSlots() : 3 + level;
  return `<div class="store-card store-card--vessel ${ok ? '' : 'disabled'}">
    <div class="store-card-tag">Relic Slot</div>
    <div class="store-card-art"><div class="store-vessel-glyph">＋</div></div>
    <div class="store-card-main">
      <div class="store-card-name">Relic Vessel</div>
      <div class="store-card-desc">${maxed ? 'Relic Slots maxed.' : 'Gain +1 Relic Slot'}</div>
      <div class="store-card-lv">${maxed ? 'Max 5' : `Slots ${slots} → ${slots + 1}`}</div>
    </div>
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
  { file: 'assets/audio/alex_jauk-witch-laugh-256450.mp3', vol: 0.4 },
]);

export function selectMarketAmbienceEntry(target = window) {
  const previous = target._lastMarketAmbienceFile || null;
  const pool = MARKET_AMBIENCE_FILES.length > 1
    ? MARKET_AMBIENCE_FILES.filter(entry => entry.file !== previous)
    : MARKET_AMBIENCE_FILES;
  const rng = target.Math?.random || Math.random;
  const entry = pool[Math.floor(rng() * pool.length)] || MARKET_AMBIENCE_FILES[0];
  target._lastMarketAmbienceFile = entry.file;
  return entry;
}

function playMarketAmbience(target = window) {
  const entry = selectMarketAmbienceEntry(target);
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
  const relicA = offers.relics[0] || null;
  const relicB = offers.relics[1] || null;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alreadyOpen = !!document.querySelector('.store-front-shell:not(.store-exiting)');
  const inner=`
    <div class="store-meta">
      <button class="store-refresh" ${canRefresh?'':'disabled'} onclick="refreshStoreFront()"><span class="store-refresh-icon">↻</span> Refresh <span class="store-refresh-cost">✦ ${rc}</span></button>
      <div class="store-reserve-display"><div class="store-reserve-label">Reserve</div><div class="store-reserve-amount">${persist.pool}<span class="coin">✦</span></div></div>
    </div>
    <div class="store-offer-row">
      <div class="store-grid-top">
        ${renderScoringCard(0, offers.scoring[0], window)}
        ${renderScoringCard(0, offers.stamps[0], window, { stamp: true })}
      </div>
      <div class="store-pack-feature">
        ${renderPackCard(0, offers.pack[0], window)}
      </div>
      <div class="store-grid-bottom">
        ${relicA ? renderRelicCard(0, relicA, window) : renderVesselCard(window)}
        ${relicB ? renderRelicCard(1, relicB, window) : renderVesselCard(window)}
      </div>
    </div>
    <div class="store-footer">
      <button class="store-proceed" onclick="storeExitToNextReading()">Next Reading →</button>
    </div>`;
  const html=`<div class="summary tarot-shop store-front-shell">
    <div class="store-dim"></div>
    <div class="store-candle${alreadyOpen ? ' lit' : ''}" id="storeCandle">
      <img class="candle-off" src="ui/candle_flame_off.small.webp" alt="">
      <img class="candle-on"  src="ui/candle_flame_on.small.webp"  alt="">
    </div>
    <div class="store-front${alreadyOpen ? ' store-visible' : ''}" id="storeFront">${inner}</div>
  </div>`;
  showOverlay(html);
  if (alreadyOpen || reduce) return;
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
  markCardPurchased(STORE_SLOT.PACK,target);
  if(typeof target.buyPack==='function')return target.buyPack(packId,cost);
  return false;
}

export function buyStoreScoringUpgrade(index,upgradeKey,cost,sectionKey = 'scoring',target = window){
  const p=persistOf(target);
  if((p.pool||0)<cost)return false;
  const charged=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'scoringUpgrade',cost}):false;
  if(charged!==true)return charged;
  const section = sectionKey === 'stamps' ? 'stamps' : 'scoring';
  if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers[section]))target._storeFrontOffers[section][index]=null;
  if(typeof target.render==='function')target.render();
  if(upgradeKey==='suit_stamp'){
    if(typeof target.openStampPicker==='function')target.openStampPicker(index);
    return true;
  }
  if(upgradeKey==='five_stamp'){
    if(typeof target.openFiveStampPicker==='function')target.openFiveStampPicker(index);
    return true;
  }
  const pairedKey=pairedUpgradeKey(upgradeKey,target);
  const upgraded=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'upgrade',upgradeKey,pairedKey}):false;
  if(upgraded!==true)return upgraded;
  markCardPurchased(section === 'stamps' ? STORE_SLOT.STAMP : STORE_SLOT.SCORING,target);
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
  const finalCost = relicCost(target);
  const p=persistOf(target);
  if((p.pool||0)<finalCost)return false;
  const slots=typeof target.relicSlots==='function'?target.relicSlots():3;
  if((p.relics||[]).length>=slots)return showStoreRelicReplace(index,relicKey,finalCost,target);
  const charged=chargeStoreRelic(finalCost,target);
  if(charged!==true)return charged;
  const acquired=typeof target.doAcquireRelic==='function'?target.doAcquireRelic(relicKey,()=>{
    if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers.relics))target._storeFrontOffers.relics[index]=null;
    if(typeof target.openShopMain==='function')target.openShopMain();
    else markCardPurchased(index === 1 ? STORE_SLOT.RELIC_B : STORE_SLOT.RELIC_A,target);
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
  if(!RELIC_SPRITE[key])return'';
  return`background-image:url('assets/relic_icons/${key}.webp');background-size:${size}px ${size}px;background-repeat:no-repeat;`;
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
