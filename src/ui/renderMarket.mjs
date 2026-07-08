// Market and relic-rack renderer (Phase 15.4). Offers and costs come
// through window.tlrShop (src/systems/shop.mjs); purchase logic stays with
// the game flow. This renderer keeps the market on one mobile screen by
// grouping each offer into anchored decision zones instead of equal-weight
// vertical text stacks.
/* global state, persist, render, _nextRefreshCost, showOverlay, $, relicSlots, _relicRackKey, RELICS, _openRelicKey, RELIC_SPRITE */

const STORE_ABILITY_PACKS = Object.freeze(['innate', 'restless', 'second_sight', 'thread', 'foundation']);
const RELIC_CACHE_PACK_ID = 'relic';
const STORE_FADE_MS = 260;
const STORE_SLOT = Object.freeze({ SCORING: 0, STAMP: 1, PACK: 2, RELIC_A: 3, RELIC_B: 4 });

const STORE_PACK_COPY = Object.freeze({
  innate: 'Choose 1 starting resource upgrade.',
  restless: 'Choose 1 Draw or Discard upgrade.',
  second_sight: 'Choose 1 reveal ability upgrade.',
  thread: 'Choose 1 relational ability upgrade.',
  foundation: 'Choose 1 of 3 Chip upgrades.',
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
  suit_stamp: { name: 'Suit Stamp', desc: 'Choose 1 Major. It counts toward Royal Court.', icon: 'isp-scoring' },
  five_stamp: { name: 'Five Star', desc: 'Choose 1 card. Counts as 5 in Sequences.', icon: 'isp-scoring' },
});

const STORE_RELIC_COPY = Object.freeze({
  gilded_fool: '+10 Chips if spread has a card.',
  hermit_lantern: 'Major Arcana add +0.25 Mult.',
  mirror_shard: 'Matching ranks add +1 Mult.',
  still_pool: 'Gain +1 Mult if you use no Discards.',
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
  watcher: 'Reveal 3, take 1.',
});

function runtime(target = window) { return target.tlrRuntime || {}; }
function persistOf(target = window) { return runtime(target).persist || target.persist || {}; }
function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    .summary.store-front-shell{background:transparent;border:0;box-shadow:none;padding:0;max-width:none;width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
    .summary.store-front-shell.store-exiting{animation:storeShellFadeOut ${STORE_FADE_MS}ms ease-in both;pointer-events:none}
    @keyframes storeShellFadeOut{from{opacity:1}to{opacity:0}}

    .store-dim{position:absolute;inset:0;background:radial-gradient(circle at 50% 8%,rgba(80,54,20,.36),rgba(0,0,0,.9) 42%,rgba(0,0,0,.96));animation:storeDimIn 420ms ease-out both;pointer-events:none;z-index:0}
    @keyframes storeDimIn{from{opacity:0}to{opacity:1}}

    .store-front{--market-gap:clamp(9px,1.25dvh,13px);--market-pad:clamp(8px,1.4dvh,12px);--card-x:clamp(10px,2.2vw,14px);--card-y:clamp(9px,1.25dvh,13px);position:relative;width:min(96vw,560px);height:min(96dvh,790px);max-height:96dvh;overflow:hidden;box-sizing:border-box;padding:var(--market-pad);font-family:Georgia,serif;color:#eadbb9;z-index:1;opacity:0;transition:opacity 280ms ease-out;display:flex;flex-direction:column;gap:var(--market-gap)}
    .store-front.store-visible{opacity:1}

    body.tlr-shop-active .score-stack{visibility:hidden;pointer-events:none}
    body.tlr-shop-active #menuBtn,body.tlr-shop-active #scoringBtn,body.tlr-shop-active #abilitiesBtn,body.tlr-shop-active #spv2ArchiveBtn,body.tlr-shop-active #discardBtn,body.tlr-shop-active #purgeBtn,body.tlr-shop-active #discardZone,body.tlr-shop-active #purgeZone,body.tlr-shop-active .discard-btn,body.tlr-shop-active .purge-btn,body.tlr-shop-active .discard-button,body.tlr-shop-active .purge-button,body.tlr-shop-active .discard-zone,body.tlr-shop-active .purge-zone,body.tlr-shop-active .action-drop-targets,body.tlr-shop-active .action-drop-target,body.tlr-shop-active .gesture-action-drop,body.tlr-shop-active .discard-drop,body.tlr-shop-active .purge-drop,body.tlr-shop-active [data-action="discard"],body.tlr-shop-active [data-action="purge"],body.tlr-shop-active [data-drop-action="discard"],body.tlr-shop-active [data-drop-action="purge"]{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
    .store-front button{font-family:Georgia,serif;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .store-front button:disabled{cursor:not-allowed;opacity:.42}

    .store-meta{display:grid;grid-template-columns:minmax(88px,1fr) 54px minmax(88px,1fr);align-items:center;gap:var(--market-gap);flex:0 0 auto}
    .store-candle{position:relative;width:52px;height:52px;z-index:1;pointer-events:none;animation:storeCandleIn 220ms ease-out both;opacity:.92;justify-self:center;filter:drop-shadow(0 0 10px rgba(218,159,69,.22))}
    .store-candle img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;transition:opacity 90ms linear}
    .store-candle .candle-off{opacity:1}.store-candle .candle-on{opacity:0}.store-candle.lit .candle-off{opacity:0}.store-candle.lit .candle-on{opacity:1}
    @keyframes storeCandleIn{from{opacity:0;transform:translateY(-6px)}to{opacity:.92;transform:translateY(0)}}
    .store-refresh,.store-reserve-display{min-height:40px;border:1px solid rgba(226,181,100,.42);border-radius:10px;background:linear-gradient(180deg,rgba(24,18,13,.8),rgba(6,5,4,.82));box-shadow:inset 0 0 0 1px rgba(255,232,176,.06);color:#f1dfbd;text-transform:uppercase}
    .store-refresh{display:flex;align-items:center;justify-content:center;gap:5px;padding:5px 8px;font-size:clamp(10px,2.7vw,13px);font-weight:900;letter-spacing:.05em;transition:background .15s,opacity .15s}
    .store-refresh:not(:disabled):hover{background:rgba(226,181,100,.1)}.store-refresh:disabled{opacity:.35;cursor:not-allowed}
    .store-refresh-icon{font-size:1.2em;line-height:1}.store-refresh-cost{color:#e0b96a;font-size:.92em;white-space:nowrap}
    .store-reserve-display{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;padding:4px 8px}
    .store-reserve-label{font:800 clamp(9px,2.4vw,11px)/1 system-ui,sans-serif;letter-spacing:.14em;color:#b08040}
    .store-reserve-amount{font-size:clamp(21px,5.8vw,29px);color:#f1d196;text-shadow:0 1px 3px #000;line-height:1}.store-reserve-amount .coin{font-size:.48em;margin-right:.12em;color:#c89445;vertical-align:middle}

    .store-offer-row{display:grid;grid-template-rows:minmax(0,1.12fr) clamp(96px,13.5dvh,116px) minmax(0,1.04fr);gap:var(--market-gap);align-items:stretch;min-height:0;flex:1 1 auto;width:100%}
    .store-grid-top,.store-grid-bottom{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--market-gap);height:100%;width:100%}
    .store-pack-feature{display:block;height:100%;width:100%}

    .store-card{--store-accent:rgba(201,162,74,.55);position:relative;display:flex;gap:8px;border:1px solid rgba(200,160,80,.34);border-radius:12px;background:linear-gradient(180deg,rgba(26,17,10,.82),rgba(9,6,4,.88));box-shadow:inset 0 0 0 1px rgba(255,235,185,.045),0 8px 22px rgba(0,0,0,.24);transition:border-color .13s;overflow:hidden;box-sizing:border-box}
    .store-card::before{content:'';position:absolute;inset:auto 12px -1px 12px;height:2px;border-radius:2px;background:var(--store-accent);opacity:.86;pointer-events:none}
    .store-card::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 24%,var(--store-glow,rgba(205,158,62,.12)),transparent 48%);pointer-events:none;opacity:.9}
    .store-card:not(.disabled):hover{border-color:rgba(225,178,92,.58)}.store-card.disabled{opacity:.55}
    .store-card--scoring{--store-accent:rgba(211,158,65,.74);--store-glow:rgba(205,142,42,.17)}
    .store-card--pack,.store-card--stamp{--store-accent:rgba(145,88,184,.7);--store-glow:rgba(118,64,174,.18)}
    .store-card--relic,.store-card--vessel{--store-accent:rgba(83,151,145,.72);--store-glow:rgba(53,139,134,.22)}

    .store-card-utility{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;min-height:20px}
    .store-card-tag,.store-card-meta{display:inline-flex;align-items:center;min-height:16px;border:1px solid rgba(221,180,103,.28);border-radius:6px;background:rgba(0,0,0,.22);padding:0 7px;font:900 clamp(7.5px,1.95vw,9.5px)/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(217,169,88,.82);white-space:nowrap;box-shadow:none}
    .store-card-meta{opacity:.72}
    .store-card--pack .store-card-tag,.store-card--stamp .store-card-tag{color:rgba(208,166,242,.84);border-color:rgba(163,105,206,.34)}
    .store-card--relic .store-card-tag,.store-card--vessel .store-card-tag,.store-card--relic .store-card-meta,.store-card--vessel .store-card-meta{color:rgba(155,211,204,.82);border-color:rgba(106,184,176,.3)}
    .store-card--relic .store-card-meta,.store-card--vessel .store-card-meta{opacity:.48}
    .store-card--stamp .store-card-meta{color:rgba(229,188,118,.78);border-color:rgba(226,181,100,.28)}

    .store-card-art{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;flex:0 0 auto;overflow:visible}.store-card-art .isp{transform-origin:center;filter:drop-shadow(0 5px 10px rgba(0,0,0,.76))}.store-card-art .relic-art-sprite{filter:drop-shadow(0 5px 12px rgba(0,0,0,.78))}
    .store-relic-art-btn{background:transparent!important;border:0!important;box-shadow:none!important;outline:0!important;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .store-vessel-glyph{font:900 30px/1 Georgia,serif;color:#f1d196;text-shadow:0 2px 6px #000}
    .store-card-main{position:relative;z-index:1;display:flex;flex-direction:column;min-width:0}.store-card-name{font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:#f4e8ca;line-height:1.05;text-shadow:0 1px 5px rgba(0,0,0,.85)}
    .store-card-desc{font:850 clamp(11px,2.95vw,13.5px)/1.28 system-ui,sans-serif;color:#dfd1ac;text-shadow:0 1px 3px rgba(0,0,0,.85)}.store-card-lines{display:flex;flex-direction:column;gap:3px}
    .store-card--stamp .store-card-desc,.store-card--pack .store-card-desc{color:#d8a6ed}.store-card--relic .store-card-desc,.store-card--vessel .store-card-desc{color:#6fe0d4}
    .store-stat-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;width:100%;margin-top:4px}.store-stat-chip{border:1px solid rgba(226,181,100,.44);border-radius:7px;background:rgba(0,0,0,.3);color:#f3d48f;font:900 clamp(10.5px,2.95vw,13px)/1 system-ui,sans-serif;padding:8px 4px;text-align:center;white-space:nowrap;text-shadow:0 1px 4px #000}
    .store-card-buy{position:relative;z-index:1;border:1px solid rgba(226,181,100,.58);border-radius:8px;background:linear-gradient(180deg,rgba(133,84,24,.78),rgba(55,34,13,.86));box-shadow:inset 0 0 0 1px rgba(255,238,190,.08),0 2px 8px rgba(0,0,0,.32);color:#f6dfac;font:900 clamp(11px,3vw,14px)/1 Georgia,serif;text-transform:uppercase;letter-spacing:.06em}.store-card-buy:not(:disabled):hover{background:linear-gradient(180deg,rgba(159,101,28,.82),rgba(67,42,15,.88))}.store-card-buy .coin{color:#f0c46c;margin:0 .16em}
    .store-card--stamp .store-card-buy,.store-card--pack .store-card-buy{background:linear-gradient(180deg,rgba(83,37,105,.86),rgba(38,18,53,.9));border-color:rgba(191,129,229,.55)}.store-card--relic .store-card-buy,.store-card--vessel .store-card-buy{background:linear-gradient(180deg,rgba(31,91,88,.78),rgba(14,45,43,.9));border-color:rgba(108,190,180,.48)}

    .store-grid-top .store-card,.store-grid-bottom .store-card{min-height:0;align-items:stretch;display:grid;text-align:center;padding:var(--card-y) var(--card-x) clamp(10px,1.45dvh,14px);row-gap:clamp(6px,.9dvh,9px)}
    .store-grid-top .store-card{grid-template-rows:minmax(72px,1fr) minmax(68px,auto) auto}.store-grid-bottom .store-card{grid-template-rows:minmax(74px,.85fr) minmax(72px,auto) auto}
    .store-grid-top .store-card .store-card-utility,.store-grid-bottom .store-card .store-card-utility{position:absolute;top:var(--card-y);left:var(--card-x);right:var(--card-x);width:auto;min-height:0}
    .store-grid-top .store-card-art{width:clamp(68px,17.5vw,90px);height:clamp(68px,17.5vw,90px);align-self:end;justify-self:center;border-radius:10px;margin-top:18px}.store-grid-top .store-card-art .isp{transform:scale(clamp(.5,.18vw + .42,.68))}.store-grid-top .store-card-art .store-stamp-art{transform:scale(clamp(.9,.16vw + .82,1.15))}
    .store-grid-bottom .store-card-art{width:clamp(70px,18vw,92px);height:clamp(70px,18vw,92px);align-self:end;justify-self:center;border-radius:10px;margin-top:18px}.store-grid-bottom .store-card-art .relic-art-sprite{width:clamp(70px,18vw,92px);height:clamp(70px,18vw,92px);background-size:contain!important}.store-grid-bottom .store-relic-art-btn{width:100%;height:100%}
    .store-grid-top .store-card-main,.store-grid-bottom .store-card-main{align-items:center;justify-content:center;gap:7px;width:100%;min-height:0}.store-grid-top .store-card-name{font-size:clamp(16px,4.25vw,21px)}.store-grid-bottom .store-card-name{font-size:clamp(14px,3.6vw,18px)}
    .store-grid-bottom .store-card-desc{font-size:clamp(11.5px,3vw,14px)}.store-grid-top .store-card-buy,.store-grid-bottom .store-card-buy{width:100%;min-height:clamp(36px,5dvh,44px);padding:0 8px;margin-top:0;align-self:end;flex:0 0 auto}

    .store-pack-feature .store-card{height:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;text-align:left;padding:8px var(--card-x);column-gap:var(--market-gap);border-color:rgba(157,91,198,.42);background:linear-gradient(180deg,rgba(34,22,38,.84),rgba(10,7,10,.9))}.store-pack-feature .store-card::before{inset:12px auto 12px -1px;width:2px;height:auto}.store-pack-feature .store-card-utility{justify-content:flex-start;min-height:16px}.store-pack-feature .store-card-art{width:clamp(58px,15vw,78px);height:clamp(58px,15vw,78px);border-radius:9px}.store-pack-feature .store-card-art .isp{transform:scale(clamp(.47,.1vw + .42,.64))}.store-pack-feature .store-relic-art-btn{width:clamp(58px,15vw,78px);height:clamp(58px,15vw,78px)}.store-pack-feature .store-card-main{gap:5px}.store-pack-feature .store-card-name{font-size:clamp(16px,4.2vw,22px)}.store-pack-feature .store-card-buy{min-width:clamp(94px,25vw,128px);min-height:clamp(38px,5.2dvh,48px);padding:0 10px;align-self:center}

    .store-footer{display:flex;justify-content:center;flex:0 0 auto;width:100%}.store-proceed{width:100%;min-height:clamp(38px,5.2dvh,46px);background:linear-gradient(180deg,rgba(28,22,16,.84),rgba(7,6,5,.92));border:1px solid rgba(226,181,100,.58);border-radius:10px;color:#f1dfbd;font:900 clamp(14px,4.5vw,20px)/1 Georgia,serif;text-transform:uppercase;letter-spacing:.1em;padding:0 22px;transition:background .15s}.store-proceed:hover{background:rgba(200,160,60,.15)}

    .store-replace-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin-top:12px}.store-replace-card{border:1px solid rgba(210,161,94,.42);border-radius:8px;background:rgba(255,255,255,.04);padding:9px;text-align:center}.store-replace-card button{margin-top:8px}
    .store-relic-callout{z-index:10010;max-width:220px}.store-relic-callout .relic-callout-desc{font-size:12px;line-height:1.35}.store-pack-callout{z-index:10010;max-width:240px}.store-pack-callout .relic-callout-desc{font-size:12px;line-height:1.35;margin-bottom:6px}.store-pack-callout-list{margin:0;padding:0 0 0 16px;list-style:disc}.store-pack-callout-list li{font-size:11px;line-height:1.4;color:#c8b888;margin-bottom:2px}

    @media(prefers-reduced-motion:reduce){.store-dim{animation:none}.store-candle{animation:none}.store-front{opacity:1;transition:none}.summary.store-front-shell.store-exiting{animation:none;opacity:0}}
    @media(max-height:740px){.store-front{height:98dvh;max-height:98dvh;gap:7px;padding:6px;--market-gap:7px;--card-y:8px;--card-x:8px}.store-meta{grid-template-columns:minmax(80px,1fr) 46px minmax(80px,1fr)}.store-candle{width:44px;height:44px}.store-offer-row{grid-template-rows:minmax(0,1.1fr) 88px minmax(0,1fr)}.store-card-desc{font-size:10.5px}.store-stat-chip{padding:6px 3px}.store-proceed{min-height:34px}.store-grid-top .store-card-name{font-size:15px}.store-grid-bottom .store-card-name{font-size:13px}.store-grid-top .store-card-art{width:62px;height:62px}.store-grid-bottom .store-card-art,.store-grid-bottom .store-card-art .relic-art-sprite{width:62px;height:62px}.store-pack-feature .store-card-art,.store-pack-feature .store-relic-art-btn{width:52px;height:52px}}
    @media(max-width:380px){.store-meta{grid-template-columns:minmax(74px,1fr) 44px minmax(74px,1fr);gap:6px}.store-candle{width:42px;height:42px}.store-refresh,.store-reserve-display{min-height:38px}.store-card-tag,.store-card-meta{padding:0 6px;letter-spacing:.07em}.store-stat-row{gap:4px}.store-stat-chip{font-size:9.8px}.store-card-buy{font-size:10.5px}.store-pack-feature .store-card{grid-template-columns:auto minmax(0,1fr) auto;column-gap:7px}.store-pack-feature .store-card-buy{min-width:84px}}
  `;
}

function updateStoreReserveDisplay(target = window) {
  const display = target.document && target.document.querySelector('.store-reserve-amount');
  if (!display) return;
  const amt = persistOf(target).pool || 0;
  const coin = display.querySelector('.coin');
  display.textContent = amt;
  if (coin) display.prepend(coin);
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
    card.innerHTML = '<div class="store-card-utility"><div class="store-card-tag" style="opacity:.45">Purchased</div></div><div style="position:relative;z-index:1;flex:1;display:flex;align-items:center;justify-content:center;color:rgba(200,160,80,.35);font-size:22px">✦</div>';
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
function pickFromUpgradePool(pool, count, target = window) { const shop = target.SHOP || {}; return shuffleValues(pool, target).filter(key => shop[key]).slice(0, count); }
function pickScoringUpgrades(count, target = window) { return pickFromUpgradePool(STORE_NORMAL_SCORING_UPGRADES, count, target); }
function pickStampUpgrades(count, target = window) { return pickFromUpgradePool(STORE_STAMP_UPGRADES, count, target); }
function pickPacks(packIds, count, target = window) { const packs = target.PACKS || {}; return shuffleValues(packIds, target).filter(id => packs[id]).slice(0, count); }
function pickRelics(count, target = window) {
  const owned = new Set((persistOf(target).relics || []));
  const options = typeof target.relicPool === 'function' ? target.relicPool(Math.max(count, 4)) : Object.keys(target.RELICS || {}).filter(key => !owned.has(key));
  return options.filter(key => !owned.has(key)).slice(0, count);
}

export function buildStoreFrontOffers(target = window) { return { scoring: pickScoringUpgrades(1, target), stamps: pickStampUpgrades(1, target), pack: pickPacks(STORE_ABILITY_PACKS, 1, target), relics: pickRelics(2, target) }; }
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

function packCostFor(packId, target = window) { const pack = (target.PACKS || {})[packId]; if (!pack) return 0; return target.tlrShop?.packCost ? target.tlrShop.packCost(pack.cost, (target._packBuys || {})[packId] || 0, (persistOf(target).relics || [])) : pack.cost + (((target._packBuys || {})[packId] || 0) * 8); }
function scoringCostFor(upgradeKey, target = window) { if (typeof target.shopCost === 'function') return target.shopCost(upgradeKey); const item = (target.SHOP || {})[upgradeKey]; const level = (persistOf(target).up || {})[upgradeKey] || 0; return item ? Math.floor(item[2] * Math.pow(item[3], level)) : 0; }
function pairedUpgradeKey(upgradeKey, target = window) { return (target.SHOP || {})[upgradeKey]?.[6] || null; }
function relicCost(target = window) { const pack = (target.PACKS || {})[RELIC_CACHE_PACK_ID]; if (!pack) return 24; return target.tlrShop?.packCost ? target.tlrShop.packCost(pack.cost, (target._packBuys || {})[RELIC_CACHE_PACK_ID] || 0, (persistOf(target).relics || [])) : pack.cost + (((target._packBuys || {})[RELIC_CACHE_PACK_ID] || 0) * 8); }
function storeVesselCost(target = window) { return typeof target.shopCost === 'function' ? target.shopCost('relicSlot') : 35; }

const STAMP_ART = Object.freeze({
  suit_stamp: '<div class="store-stamp-art" style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#3a6bbf,#152a5c 72%,#070e1e);display:flex;align-items:center;justify-content:center;font:900 24px/1 Georgia,serif;color:#f5e0b4;text-shadow:0 2px 4px rgba(0,0,0,.9);border:2px solid rgba(210,175,100,.65);box-shadow:0 2px 8px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.5)">♡</div>',
  five_stamp: '<div class="store-stamp-art" style="width:52px;height:52px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#d4a017,#7a5800 72%,#2a1c00);display:flex;align-items:center;justify-content:center;font:900 16px/1 Georgia,serif;color:#f5e0b4;text-shadow:0 2px 4px rgba(0,0,0,.9);border:2px solid rgba(210,175,100,.65);box-shadow:0 2px 8px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.5)">5★</div>',
});

function renderScoringEffect(upgradeKey, copy, isStamp) {
  if (isStamp) {
    const parts = String(copy.desc || '').split('.').map(s => s.trim()).filter(Boolean).slice(0, 2);
    return `<div class="store-card-lines">${parts.map(part => `<div class="store-card-desc">${escapeHtml(part)}</div>`).join('')}</div>`;
  }
  const stats = String(copy.desc || '').split('/').map(s => s.trim()).filter(Boolean);
  if (stats.length >= 2) return `<div class="store-stat-row"><div class="store-stat-chip">${escapeHtml(stats[0])}</div><div class="store-stat-chip">${escapeHtml(stats[1])}</div></div>`;
  return `<div class="store-card-desc">${escapeHtml(copy.desc)}</div>`;
}

function renderScoringCard(index, upgradeKey, target = window, options = {}) {
  const isStamp = !!options.stamp;
  const tag = isStamp ? 'Stamp' : 'Scoring';
  const cardClass = isStamp ? 'store-card--stamp' : 'store-card--scoring';
  const purchaseSection = isStamp ? 'stamps' : 'scoring';
  const emptyRow = `<div class="store-card ${cardClass} disabled"><div class="store-card-utility"><div class="store-card-tag">${tag}</div></div><div class="store-card-main"><div class="store-card-name">—</div></div></div>`;
  if (!upgradeKey) return emptyRow;
  const item = (target.SHOP || {})[upgradeKey];
  if (!item) return emptyRow;
  const copy = STORE_SCORING_COPY[upgradeKey] || { name: item[0], desc: String(item[1] || '').replace(/<[^>]*>/g, ''), icon: (target.SHOP_ICON || {})[upgradeKey] || 'isp-scoring' };
  const cost = scoringCostFor(upgradeKey, target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const level = (persistOf(target).up || {})[upgradeKey] || 0;
  const art = STAMP_ART[upgradeKey] ? `<div class="store-card-art">${STAMP_ART[upgradeKey]}</div>` : `<div class="store-card-art"><span class="isp isp-108 ${copy.icon}"></span></div>`;
  return `<div class="store-card ${cardClass} ${ok ? '' : 'disabled'}"><div class="store-card-utility"><div class="store-card-tag">${tag}</div><div class="store-card-meta">Lv ${level} → ${level + 1}</div></div>${art}<div class="store-card-main"><div class="store-card-name">${escapeHtml(copy.name)}</div>${renderScoringEffect(upgradeKey, copy, isStamp)}</div><button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreScoringUpgrade(${index},'${upgradeKey}',${cost},'${purchaseSection}')">Buy <span class="coin">✦</span> ${cost}</button></div>`;
}

function packDisplayName(name) { return String(name || '').replace(/\s+pack$/i, ''); }
function renderPackCard(index, packId, target = window) {
  const emptyRow = '<div class="store-card store-card--pack disabled"><div class="store-card-main"><div class="store-card-name">—</div></div></div>';
  if (!packId) return emptyRow;
  const pack = (target.PACKS || {})[packId];
  if (!pack) return emptyRow;
  const cost = packCostFor(packId, target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const desc = STORE_PACK_COPY[packId] || pack.desc || '';
  return `<div class="store-card store-card--pack ${ok ? '' : 'disabled'}"><button type="button" class="store-relic-art-btn" onclick="showStorePackCallout('${packId}',this);event.stopPropagation()" aria-label="Show ${escapeHtml(pack.name)} details"><div class="store-card-art" style="pointer-events:none"><span class="isp isp-108 ${pack.icon}"></span></div></button><div class="store-card-main"><div class="store-card-utility"><div class="store-card-tag">Pack</div></div><div class="store-card-name">${escapeHtml(packDisplayName(pack.name))}</div><div class="store-card-desc">${escapeHtml(desc)}</div></div><button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStorePack('pack',${index},'${packId}',${cost})">Open <span class="coin">✦</span> ${cost}</button></div>`;
}

function relicMetaTag(relicKey, relic) { if (relicKey === 'watcher') return 'Once / reading'; if (relic?.active) return 'Active'; return 'Passive'; }
function renderRelicCard(index, relicKey, target = window) {
  if (!relicKey) return renderVesselCard(index, target);
  const relic = (target.RELICS || {})[relicKey];
  if (!relic) return renderVesselCard(index, target);
  const cost = relicCost(target);
  const ok = (persistOf(target).pool || 0) >= cost;
  const style = typeof target.relicIconStyle === 'function' ? target.relicIconStyle(relicKey, 72) : '';
  const desc = STORE_RELIC_COPY[relicKey] || relic.desc || relic.description || '';
  return `<div class="store-card store-card--relic ${ok ? '' : 'disabled'} ${relic.rarity || ''}"><div class="store-card-utility"><div class="store-card-tag">Relic</div><div class="store-card-meta">${escapeHtml(relicMetaTag(relicKey, relic))}</div></div><div class="store-card-art"><button class="store-relic-art-btn" type="button" onclick="showStoreRelicCallout('${relicKey}',this);event.stopPropagation()" aria-label="Show ${escapeHtml(relic.name)} details"><div class="relic-art-sprite" style="${style}"></div></button></div><div class="store-card-main"><div class="store-card-name">${escapeHtml(relic.name)}</div><div class="store-card-desc">${escapeHtml(desc)}</div></div><button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreRelic(${index},'${relicKey}')">Buy <span class="coin">✦</span> ${cost}</button></div>`;
}

function renderVesselCard(index = 0, target = window) {
  const level = (persistOf(target).up || {}).relicSlot || 0;
  const maxed = level >= 2;
  const cost = storeVesselCost(target);
  const ok = !maxed && index === 0 && (persistOf(target).pool || 0) >= cost;
  const slots = typeof target.relicSlots === 'function' ? target.relicSlots() : 3 + level;
  return `<div class="store-card store-card--vessel ${ok ? '' : 'disabled'}"><div class="store-card-utility"><div class="store-card-tag">${index === 0 ? 'Relic Slot' : 'Empty'}</div>${index === 0 ? `<div class="store-card-meta">${maxed ? 'Max 5' : `Slots ${slots} → ${slots + 1}`}</div>` : ''}</div><div class="store-card-art"><div class="store-vessel-glyph">${index === 0 ? '＋' : '✦'}</div></div><div class="store-card-main"><div class="store-card-name">${index === 0 ? 'Relic Vessel' : 'No Relic'}</div><div class="store-card-desc">${index === 0 ? (maxed ? 'Relic Slots maxed.' : 'Gain +1 Relic Slot') : 'Refresh for new stock.'}</div></div><button class="store-card-buy" ${ok ? '' : 'disabled'} onclick="buyStoreVessel(${index})">${index !== 0 ? 'Empty' : maxed ? 'Maxed' : `Buy <span class="coin">✦</span> ${cost}`}</button></div>`;
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

function playCandleSnuff(target = window) {
  try {
    const ctx = target._tlrACtx || (target._tlrACtx = new (target.AudioContext || target.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const vol = typeof target._sfxVol === 'number' ? target._sfxVol : 1;
    const dur = 0.22;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const t = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2) * Math.min(1, t * 20) * 0.6; }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.18 * vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  } catch(e) {}
}

export function storeExitToNextReading(target = window) {
  const shell = target.document.querySelector('.store-front-shell');
  if (!shell) { if (typeof target.continueReading === 'function') target.continueReading(); return true; }
  if (shell.classList.contains('store-exiting')) return true;
  target.document.querySelectorAll('.relic-callout,.store-relic-callout,.store-pack-callout').forEach(el => el.remove());
  const reduce = target.matchMedia && target.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { shell.classList.add('store-exiting'); target.setTimeout(() => { if (typeof target.continueReading === 'function') target.continueReading(); }, 0); return true; }
  const candle = target.document.getElementById('storeCandle');
  if (candle && candle.classList.contains('lit')) { playCandleSnuff(target); candle.classList.remove('lit'); }
  target.setTimeout(() => { shell.classList.add('store-exiting'); target.setTimeout(() => { if (typeof target.continueReading === 'function') target.continueReading(); }, STORE_FADE_MS); }, 200);
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
  const pool = MARKET_AMBIENCE_FILES.length > 1 ? MARKET_AMBIENCE_FILES.filter(entry => entry.file !== previous) : MARKET_AMBIENCE_FILES;
  const rng = target.Math?.random || Math.random;
  const entry = pool[Math.floor(rng() * pool.length)] || MARKET_AMBIENCE_FILES[0];
  target._lastMarketAmbienceFile = entry.file;
  return entry;
}

function playMarketAmbience(target = window) { const entry = selectMarketAmbienceEntry(target); try { const vol = typeof target._sfxVol === 'number' ? target._sfxVol : 1; const a = new (target.Audio || Audio)(entry.file); a.volume = vol * entry.vol; a.play().catch(() => {}); } catch(e) {} }
function playMatchLight(target = window) {
  try {
    const ctx = target._tlrACtx || (target._tlrACtx = new (target.AudioContext || target.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const vol = typeof target._sfxVol === 'number' ? target._sfxVol : 1;
    const dur = 0.18;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const t = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.2) * Math.min(1, t * 12); }
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
      <button class="store-refresh" ${canRefresh?'':'disabled'} onclick="refreshStoreFront()"><span class="store-refresh-icon">↻</span><span>Refresh</span><span class="store-refresh-cost">✦ ${rc}</span></button>
      <div class="store-candle${alreadyOpen ? ' lit' : ''}" id="storeCandle"><img class="candle-off" src="ui/candle_flame_off.small.webp" alt=""><img class="candle-on" src="ui/candle_flame_on.small.webp" alt=""></div>
      <div class="store-reserve-display"><div class="store-reserve-label">Reserve</div><div class="store-reserve-amount"><span class="coin">✦</span>${persist.pool}</div></div>
    </div>
    <div class="store-offer-row">
      <div class="store-grid-top">${renderScoringCard(0, offers.scoring[0], window)}${renderScoringCard(0, offers.stamps[0], window, { stamp: true })}</div>
      <div class="store-pack-feature">${renderPackCard(0, offers.pack[0], window)}</div>
      <div class="store-grid-bottom">${relicA ? renderRelicCard(0, relicA, window) : renderVesselCard(0, window)}${relicB ? renderRelicCard(1, relicB, window) : renderVesselCard(1, window)}</div>
    </div>
    <div class="store-footer"><button class="store-proceed" onclick="storeExitToNextReading()">Next Reading →</button></div>`;
  const html=`<div class="summary tarot-shop store-front-shell"><div class="store-dim"></div><div class="store-front${alreadyOpen ? ' store-visible' : ''}" id="storeFront">${inner}</div></div>`;
  showOverlay(html);
  if (alreadyOpen || reduce) return;
  setTimeout(() => { const candle = document.getElementById('storeCandle'); if (candle) { playMatchLight(window); candle.classList.add('lit'); } }, 300);
  setTimeout(() => { const front = document.getElementById('storeFront'); if (front) front.classList.add('store-visible'); playMarketAmbience(window); }, 520);
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
export function buyStorePack(sectionKey,index,packId,cost,target = window){ if(target._storeFrontOffers)target._storeFrontOffers.pack=[null]; markCardPurchased(STORE_SLOT.PACK,target); if(typeof target.buyPack==='function')return target.buyPack(packId,cost); return false; }
export function buyStoreScoringUpgrade(index,upgradeKey,cost,sectionKey = 'scoring',target = window){
  const p=persistOf(target); if((p.pool||0)<cost)return false;
  const charged=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'scoringUpgrade',cost}):false; if(charged!==true)return charged;
  const section = sectionKey === 'stamps' ? 'stamps' : 'scoring'; if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers[section]))target._storeFrontOffers[section][index]=null; if(typeof target.render==='function')target.render();
  if(upgradeKey==='suit_stamp'){ if(typeof target.openStampPicker==='function')target.openStampPicker(index); return true; }
  if(upgradeKey==='five_stamp'){ if(typeof target.openFiveStampPicker==='function')target.openFiveStampPicker(index); return true; }
  const pairedKey=pairedUpgradeKey(upgradeKey,target); const upgraded=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'upgrade',upgradeKey,pairedKey}):false; if(upgraded!==true)return upgraded;
  markCardPurchased(section === 'stamps' ? STORE_SLOT.STAMP : STORE_SLOT.SCORING,target); return true;
}
function chargeStoreRelic(cost,target = window){ const p=persistOf(target); if((p.pool||0)<cost)return false; const charged=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:RELIC_CACHE_PACK_ID,cost}):false; if(charged!==true)return charged; target._packBuys ||= {}; target._packBuys[RELIC_CACHE_PACK_ID]=(target._packBuys[RELIC_CACHE_PACK_ID]||0)+1; return true; }
export function buyStoreRelic(index,relicKey,cost,target = window){
  const finalCost = relicCost(target); const p=persistOf(target); if((p.pool||0)<finalCost)return false;
  const slots=typeof target.relicSlots==='function'?target.relicSlots():3; if((p.relics||[]).length>=slots)return showStoreRelicReplace(index,relicKey,finalCost,target);
  const charged=chargeStoreRelic(finalCost,target); if(charged!==true)return charged;
  const acquired=typeof target.doAcquireRelic==='function'?target.doAcquireRelic(relicKey,()=>{ if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers.relics))target._storeFrontOffers.relics[index]=null; if(typeof target.openShopMain==='function')target.openShopMain(); else markCardPurchased(index === 1 ? STORE_SLOT.RELIC_B : STORE_SLOT.RELIC_A,target); },target):false;
  return acquired;
}
export function showStoreRelicReplace(index,relicKey,cost,target = window){
  const relic=(target.RELICS||{})[relicKey]; if(!relic||typeof target.showOverlay!=='function')return false;
  let html='<div class="summary tarot-shop relic-replace-screen">'; html+=`<div class="pack-picker-header"><h3>Relic Slots Full</h3><p>Choose a relic to replace with <b>${escapeHtml(relic.name)}</b>.</p></div>`; html+='<div class="store-replace-grid">';
  for(const oldKey of persistOf(target).relics||[]){ const oldRelic=(target.RELICS||{})[oldKey]; if(!oldRelic)continue; html+=`<div class="store-replace-card"><b>${escapeHtml(oldRelic.name)}</b><p>${escapeHtml(STORE_RELIC_COPY[oldKey]||oldRelic.desc||oldRelic.description||'')}</p><button onclick="confirmStoreRelicReplace(${index},'${oldKey}','${relicKey}',${cost})">Replace</button></div>`; }
  html+='</div><div style="text-align:center;margin-top:10px"><button onclick="openShopMain()" style="background:transparent;border:none;color:#8a7551;font-size:12px;cursor:pointer;text-decoration:underline">Cancel</button></div></div>'; target.showOverlay(html); return true;
}
export function confirmStoreRelicReplace(index,oldKey,newKey,cost,target = window){ const charged=chargeStoreRelic(cost,target); if(charged!==true)return charged; const bought=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'relic',relicId:newKey,replaceRelicId:oldKey}):false; if(bought!==true)return bought; if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers.relics))target._storeFrontOffers.relics[index]=null; if(typeof target.renderRelicRack==='function')target.renderRelicRack(); if(typeof target.openShopMain==='function')target.openShopMain(); return true; }
export function buyStoreVessel(index = 0, target = window){ if(index !== 0)return false; const level=(persistOf(target).up||{}).relicSlot||0; if(level>=2)return false; const cost=storeVesselCost(target); if((persistOf(target).pool||0)<cost)return false; const html=`<div class="summary tarot-shop"><div class="pack-picker-header"><h3>Relic Vessel</h3><p>Gain +1 Relic Slot. Max 5.</p></div><div style="display:flex;justify-content:center;gap:10px;margin-top:12px"><button onclick="confirmStoreVessel(${cost},${index})">Buy — ✦ ${cost}</button><button onclick="openShopMain()">Back</button></div></div>`; if(typeof target.showOverlay==='function')target.showOverlay(html); return true; }
export function confirmStoreVessel(cost,index = 0,target = window){ if(index !== 0)return false; const charged=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'pack',packId:'relicSlot',cost}):false; if(charged!==true)return charged; const upgraded=typeof target.tlrMarketPurchase==='function'?target.tlrMarketPurchase({kind:'upgrade',upgradeKey:'relicSlot'}):false; if(upgraded!==true)return upgraded; if(target._storeFrontOffers&&Array.isArray(target._storeFrontOffers.relics))target._storeFrontOffers.relics[index]=null; if(typeof target.renderRelicRack==='function')target.renderRelicRack(); if(typeof target.openShopMain==='function')target.openShopMain(); return true; }
export function relicIconStyle(key,size){ if(!RELIC_SPRITE[key])return''; return`background-image:url('assets/relic_icons/${key}.webp');background-size:${size}px ${size}px;background-repeat:no-repeat;`; }
export function renderRelicRack(){ const rack=$('#relicRack');if(!rack)return; const key=persist.relics.join(',')+'|'+relicSlots(); if(key===_relicRackKey)return; _relicRackKey=key; rack.innerHTML=''; const slots=relicSlots(); persist.relics.forEach(key=>{ const r=RELICS[key]; const btn=document.createElement('button'); btn.className='relic-btn'+(r.rarity==='rare'?' relic-rare':''); btn.title=r.name; const ic=document.createElement('span'); ic.style.cssText=`display:block;width:30px;height:30px;flex-shrink:0;${relicIconStyle(key,30)}`; btn.appendChild(ic); btn.onclick=e=>{e.stopPropagation();toggleRelicCallout(key,btn);}; rack.appendChild(btn); }); const empty=slots-persist.relics.length; for(let i=0;i<empty;i++){const slot=document.createElement('div');slot.className='relic-slot-empty';rack.appendChild(slot);} }
export function toggleRelicCallout(key,btn){
  document.querySelectorAll('.relic-callout').forEach(el=>el.remove()); if(_openRelicKey===key){_openRelicKey=null;return;} _openRelicKey=key; const r=RELICS[key]; const callout=document.createElement('div'); callout.className='relic-callout'; const used=r.active&&persist.relicUsed[key]; callout.innerHTML=`<div class="relic-callout-name"><div style="display:inline-block;width:24px;height:24px;vertical-align:middle;${relicIconStyle(key,24)}"></div> ${r.name}</div><div class="relic-callout-desc">${r.desc||r.description||''}</div>${r.active?`<button class="relic-activate-btn" ${used?'disabled':''} onclick="activateRelic('${key}')">${used?'Used this session':'Activate'}</button>`:''}`; document.body.appendChild(callout); const rect=btn.getBoundingClientRect(); callout.style.top=(rect.bottom+6)+'px'; callout.style.left='0px'; requestAnimationFrame(function(){ const cw=callout.offsetWidth,ch=callout.offsetHeight,mg=8; let left=rect.right-cw; left=Math.max(mg,Math.min(window.innerWidth-cw-mg,left)); let top=rect.bottom+6; if(top+ch>window.innerHeight-mg)top=Math.max(mg,rect.top-ch-6); callout.style.left=left+'px';callout.style.top=top+'px'; });
}
