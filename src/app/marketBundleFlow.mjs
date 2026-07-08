import { MARKET_BUNDLES } from '../data/marketBundleTracks.mjs';
import { SHOP, SHOP_ICON } from '../data/legacyMarket.mjs';

const STORE_FADE_MS = 260;

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || target.persist || {};}
function stateOf(target){return runtime(target).state || target.state || {};}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function bundleList(persist) {
  return (persist.pendingRewardBundles || []).filter(bundle => bundle.state !== 'claimed');
}

function copyStorePersistToLegacy(storePersist, legacyPersist) {
  legacyPersist.pool = storePersist.reserve;
  legacyPersist.up = Object.assign({}, storePersist.upgrades || {});
  legacyPersist.relics = (storePersist.relics || []).slice();
  legacyPersist.relicUsed = Object.assign({}, storePersist.relicUsed || {});
  legacyPersist.stampedMajors = (storePersist.stampedMajors || []).slice();
  legacyPersist.stampedFive = (storePersist.stampedFive || []).slice();
  legacyPersist.marketBundleProgress = Object.assign({}, storePersist.marketBundleProgress || {});
  legacyPersist.pendingRewardBundles = (storePersist.pendingRewardBundles || []).map(bundle => Object.assign({}, bundle));
  legacyPersist.claimedRewardBundleIds = (storePersist.claimedRewardBundleIds || []).slice();
  legacyPersist.pendingCardChoice = storePersist.pendingCardChoice || null;
}

function syncStorePersistToLegacy(target = window) {
  const storePersist = target.tlrStore?.getState?.()?.persist;
  if (!storePersist) return;
  copyStorePersistToLegacy(storePersist, persistOf(target));
}

function ensureBundleStyles(target = window) {
  const doc = target.document;
  if (!doc || doc.getElementById('market-bundle-flow-style')) return;
  const style = doc.createElement('style');
  style.id = 'market-bundle-flow-style';
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
    .store-front button{font-family:Georgia,serif;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .store-front button:disabled{cursor:not-allowed;opacity:.4}
    body.tlr-shop-active .score-stack{visibility:hidden;pointer-events:none}
    body.tlr-shop-active #menuBtn,body.tlr-shop-active #scoringBtn,body.tlr-shop-active #abilitiesBtn,body.tlr-shop-active #spv2ArchiveBtn{visibility:hidden;pointer-events:none}
    .store-meta{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px}
    .store-refresh{display:flex;align-items:center;gap:6px;background:transparent;border:1px solid rgba(226,181,100,.35);border-radius:8px;color:#f1dfbd;padding:7px 12px;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;transition:background .15s,opacity .15s}
    .store-refresh:disabled{opacity:.35;cursor:not-allowed}
    .store-refresh-icon{font-size:1.15em;line-height:1}
    .store-reserve-display{display:flex;flex-direction:column;align-items:flex-end;line-height:1}
    .store-reserve-label{font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:#b08040;font-family:system-ui,sans-serif}
    .store-reserve-amount{font-size:28px;color:#f1d196;text-shadow:0 1px 3px #000;line-height:1}
    .store-offer-row{display:flex;flex-direction:column;gap:12px}
    .store-card{position:relative;display:flex;align-items:center;gap:14px;min-height:96px;padding:27px 14px 12px 18px;border:1px solid rgba(200,160,80,.28);border-radius:12px;background:linear-gradient(180deg,rgba(26,17,10,.55),rgba(9,6,4,.6));text-align:left;transition:border-color .13s}
    .store-card::before{content:'';position:absolute;left:-1px;top:16px;bottom:16px;width:2px;border-radius:2px;background:var(--store-accent,rgba(201,162,74,.5));opacity:.75;pointer-events:none}
    .store-card:not(.disabled):hover{border-color:rgba(200,160,80,.5)}
    .store-card.disabled{opacity:.72}
    .store-card-tag{position:absolute;top:9px;left:18px;font:700 10px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#9a7840}
    .store-card-art{width:56px;height:56px;flex:0 0 56px;display:flex;align-items:center;justify-content:center}
    .store-card-art .isp{transform:scale(.48);transform-origin:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}
    .store-card-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
    .store-card-name{font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#f0dfbd;line-height:1.15}
    .store-card-desc{font:600 12px/1.35 system-ui,sans-serif;color:#b8a882}
    .store-card-lv{font:800 10px/1 system-ui,sans-serif;color:#c89445;text-transform:uppercase;margin-top:2px}
    .store-card-buy{flex:0 0 auto;min-width:104px;min-height:46px;padding:0 14px;border:1px solid rgba(226,181,100,.5);border-radius:8px;background:transparent;color:#f5d9a0;font:800 12px/1.2 Georgia,serif;text-transform:uppercase;letter-spacing:.05em}
    .store-card-buy:not(:disabled):hover{background:rgba(226,181,100,.1)}
    .store-footer{display:flex;justify-content:center;margin-top:16px}
    .store-proceed{background:transparent;border:1px solid rgba(226,181,100,.55);border-radius:8px;color:#f1dfbd;font:800 14px/1 Georgia,serif;text-transform:uppercase;letter-spacing:.07em;padding:10px 22px;transition:background .15s}
    .store-proceed:hover{background:rgba(200,160,60,.15)}
    .store-card--bundle-sequence{--store-accent:rgba(214,176,86,.62)}
    .store-card--bundle-court{--store-accent:rgba(120,160,220,.58)}
    .store-card--bundle-restless{--store-accent:rgba(110,180,220,.58)}
    .store-card--empty{--store-accent:rgba(130,105,70,.42)}
    .store-card--bundle .store-card-tag{color:#c49a50}
    .store-card--bundle-court .store-card-tag{color:#8faee5}
    .store-card--bundle-restless .store-card-tag{color:#80bdda}
    .store-bundle-note{font:700 11px/1.35 system-ui,sans-serif;color:#8a7551;text-align:center;margin-top:8px}
    .bundle-result-row td{color:#b8a882!important}
    .bundle-result-row.complete td:first-child{color:#f0dfbd!important}
    .reward-bundle-picker{width:min(96vw,620px);margin:0 auto;padding:10px 0 4px;background:transparent!important;border:0!important;box-shadow:none!important}
    .reward-bundle-picker .pack-picker-header{margin:0 0 10px;padding:0 10px;background:transparent!important;border:0!important;box-shadow:none!important;text-align:center}
    .reward-bundle-picker .pack-picker-header h3{margin:0 0 4px}
    .reward-bundle-picker .pack-picker-header p{margin:0;color:#b8a882}
    .reward-bundle-picker .shop-items-row{display:flex!important;flex-direction:row!important;align-items:stretch!important;justify-content:center!important;gap:10px!important;flex-wrap:nowrap!important;overflow-x:auto!important;padding:0 6px 8px;scroll-snap-type:x proximity}
    .reward-bundle-picker .upg-card{flex:0 0 min(30vw,170px)!important;max-width:170px!important;min-width:128px!important;scroll-snap-align:center;background:rgba(19,14,10,.74)!important}
    @media(max-width:480px){.store-card{gap:10px;padding-left:14px}.store-card-buy{min-width:86px;padding:0 10px}.reward-bundle-picker{width:98vw}.reward-bundle-picker .shop-items-row{justify-content:flex-start!important;gap:8px!important}.reward-bundle-picker .upg-card{flex-basis:31vw!important;min-width:112px!important}.reward-bundle-picker .upg-desc{font-size:10px!important;line-height:1.25!important}}
    @media(prefers-reduced-motion:reduce){.store-dim,.store-candle{animation:none}.store-front{opacity:1;transition:none}}
  `;
  doc.head.appendChild(style);
}

function renderBundleCard(bundle) {
  const display = MARKET_BUNDLES[bundle.bundleId] || {};
  const icon = display.icon || 'isp-pattern';
  const name = display.name || 'Reward Bundle';
  const desc = display.description || 'Open to reveal a reward.';
  const accent = display.accentClass || '';
  const stateLabel = bundle.state === 'opened' ? 'Choose' : 'Open';
  return `<div class="store-card store-card--bundle ${accent}">
    <div class="store-card-tag">${escapeHtml(display.categoryLabel || 'Bundle')}</div>
    <div class="store-card-art"><span class="isp isp-108 ${escapeHtml(icon)}"></span></div>
    <div class="store-card-main">
      <div class="store-card-name">${escapeHtml(name)}</div>
      <div class="store-card-desc">${escapeHtml(desc)}</div>
    </div>
    <button class="store-card-buy" onclick="openRewardBundleWithAnimation('${escapeHtml(bundle.id)}')">${stateLabel}</button>
  </div>`;
}

function renderQuietMarketCard() {
  return `<div class="store-card store-card--empty disabled">
    <div class="store-card-tag">Market</div>
    <div class="store-card-art"><span class="isp isp-108 isp-scoring"></span></div>
    <div class="store-card-main">
      <div class="store-card-name">The Market Is Quiet</div>
      <div class="store-card-desc">No reward bundles are waiting.</div>
    </div>
  </div>`;
}

function bundleMarketInner(target = window) {
  const persist = persistOf(target);
  const bundles = bundleList(persist);
  const hasBundles = bundles.length > 0;
  return `
    <div class="store-meta">
      <button class="store-refresh" disabled><span class="store-refresh-icon">↻</span> Refresh</button>
      <div class="store-reserve-display"><div class="store-reserve-label">Bundles</div><div class="store-reserve-amount">${bundles.length}</div></div>
    </div>
    <div class="store-offer-row">
      ${hasBundles ? bundles.map(renderBundleCard).join('') : renderQuietMarketCard()}
    </div>
    <div class="store-bundle-note">${hasBundles ? `Open your reward bundle${bundles.length === 1 ? '' : 's'} to continue.` : 'Continue to the next reading.'}</div>
    <div class="store-footer">
      <button class="store-proceed" ${hasBundles ? 'disabled' : ''} onclick="storeExitToNextReading()">Next Reading →</button>
    </div>`;
}

function renderBundleMarket(target = window) {
  ensureBundleStyles(target);
  const front = target.document?.getElementById('storeFront') || target.document?.querySelector('.store-front-shell .store-front');
  if (!front) return false;
  front.innerHTML = bundleMarketInner(target);
  return true;
}

function showBundleMarket(target = window) {
  ensureBundleStyles(target);
  syncStorePersistToLegacy(target);

  const doc = target.document;
  const reduce = target.matchMedia && target.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alreadyOpen = !!doc?.querySelector('.store-front-shell:not(.store-exiting)');
  const html = `<div class="summary store-front-shell">
    <div class="store-dim"></div>
    <div class="store-candle${alreadyOpen ? ' lit' : ''}" id="storeCandle">
      <img class="candle-off" src="ui/candle_flame_off.small.webp" alt="">
      <img class="candle-on"  src="ui/candle_flame_on.small.webp" alt="">
    </div>
    <div class="store-front${alreadyOpen || reduce ? ' store-visible' : ''}" id="storeFront">${bundleMarketInner(target)}</div>
  </div>`;

  if (typeof target.showOverlay === 'function') target.showOverlay(html);
  if (alreadyOpen || reduce) return true;

  target.setTimeout?.(() => {
    const candle = doc.getElementById('storeCandle');
    if (candle) candle.classList.add('lit');
  }, 300);
  target.setTimeout?.(() => {
    const front = doc.getElementById('storeFront');
    if (front) front.classList.add('store-visible');
  }, 520);
  return true;
}

function clearSpreadForBundleMarket(target = window) {
  const state = stateOf(target);
  if (!state || !Array.isArray(state.spread)) return;
  state.spread = Array(5).fill(null);
  state.selected = null;
  state.abilitySelect = null;
  state.purgeSelect = null;
  state.busy = false;
  if (typeof target.snapCounter === 'function') target.snapCounter(0);
  if (typeof target.render === 'function') target.render();
}

function openBundleMarket(target = window) {
  if (typeof target.enterMarket === 'function') target.enterMarket();
  clearSpreadForBundleMarket(target);
  return showBundleMarket(target);
}

function buildRewardBundlePicker(bundle, target = window) {
  const display = MARKET_BUNDLES[bundle.bundleId] || {};
  const title = display.name || 'Reward Bundle';
  const keys = bundle.rewardKeys || [];
  let html = '<div class="reward-bundle-picker">';
  html += `<div class="pack-picker-header"><h3>${escapeHtml(title)}</h3><p>Choose 1 reward.</p></div>`;
  html += '<div class="shop-items-row">';
  const persist = persistOf(target);
  for (const key of keys) {
    const row = SHOP[key];
    if (!row) continue;
    const level = (persist.up || {})[key] || 0;
    const icon = SHOP_ICON[key] || 'isp-scoring';
    const desc = String(row[1] || '').replace(/<[^>]*>/g, '');
    html += `<div class="upg-card pool-${escapeHtml(row[5] || 'bundle')}">
      <div class="upg-title-strip"><span>${escapeHtml(row[0])}</span></div>
      <div class="upg-art"><span class="isp isp-40 ${escapeHtml(icon)}"></span></div>
      <div class="upg-body"><div class="upg-desc">${escapeHtml(desc)}</div></div>
      <div class="upg-footer"><span class="upg-lv">Lv <b>${level}</b></span>
      <button class="sbtn sbtn-pick" aria-label="Pick" onclick="pickRewardBundleChoice('${escapeHtml(bundle.id)}','${escapeHtml(key)}')"></button></div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

export function showRewardBundleContents(bundleId, target = window) {
  const bundle = bundleList(persistOf(target)).find(item => item.id === bundleId);
  if (!bundle || bundle.state !== 'opened') return false;
  if (typeof target.showOverlay !== 'function') return false;
  target.showOverlay(buildRewardBundlePicker(bundle, target));
  return true;
}

export function openRewardBundleWithAnimation(bundleId, target = window) {
  if (!target.tlrStore || !target.tlrActions) return false;
  if (typeof target.tlrSyncPersistToStore === 'function') target.tlrSyncPersistToStore();
  target.tlrStore.dispatch({ type: target.tlrActions.OPEN_REWARD_BUNDLE, bundleId });
  syncStorePersistToLegacy(target);

  // This is a reward bundle, not a paid pack. Do not route through
  // animatePackOpen(packId), because that surfaces the legacy pack object
  // (for example, "Restless Hands Pack") instead of the saved bundle choices.
  if (typeof target.playSound === 'function') target.playSound('pack_open');
  return showRewardBundleContents(bundleId, target);
}

export function pickRewardBundleChoice(bundleId, rewardKey, target = window) {
  if (!target.tlrStore || !target.tlrActions) return false;
  if (typeof target.tlrSyncPersistToStore === 'function') target.tlrSyncPersistToStore();
  target.tlrStore.dispatch({ type: target.tlrActions.CLAIM_REWARD_BUNDLE_CHOICE, bundleId, rewardKey });
  const run = target.tlrStore.getState().run;
  const claim = run.lastBundleClaim;
  if (!claim?.claimed) return false;
  syncStorePersistToLegacy(target);
  if (typeof target.playSound === 'function') target.playSound('pack_pick');
  if (typeof target.render === 'function') target.render();
  if (claim.requiresPicker || rewardKey === 'five_stamp' || rewardKey === 'suit_stamp') {
    if (rewardKey === 'five_stamp' && typeof target.openFiveStampPicker === 'function') return target.openFiveStampPicker(0);
    if (rewardKey === 'suit_stamp' && typeof target.openStampPicker === 'function') return target.openStampPicker(0);
  }
  return showBundleMarket(target);
}

function patchResultsOverlay(target = window) {
  const run = target.tlrStore?.getState?.()?.run;
  const results = run?.lastResults;
  if (!results?.cleared) return;
  const table = target.document?.querySelector('.result-panel.pass .rtable');
  if (!table) return;
  const existing = table.querySelector('.bundle-result-row');
  if (existing) return;

  const deltas = results.trackDeltas || [];
  const generated = results.generatedBundleIds || [];
  const rows = [];
  if (deltas.length) rows.push('<tr class="grouprow bundle-result-row"><td colspan="2">Market Signs</td></tr>');
  for (const delta of deltas) {
    const label = delta.completed ? `${delta.label} Complete` : delta.label;
    const value = delta.completed ? 'Bundle added' : `${delta.after} / ${delta.threshold}`;
    rows.push(`<tr class="mrow bundle-result-row ${delta.completed ? 'complete' : ''}"><td>✦ ${escapeHtml(label)}</td><td class="r">${escapeHtml(value)}</td></tr>`);
  }

  const totals = table.querySelectorAll('tr.totrow');
  const reserveRow = totals[totals.length - 1];
  const bundleSummary = `<tr class="totrow bundle-result-row"><td>Bundles added</td><td class="r">${generated.length}</td></tr>`;
  if (reserveRow && reserveRow.textContent.includes('Added to reserve')) {
    reserveRow.outerHTML = [...rows, bundleSummary].join('');
  } else {
    table.insertAdjacentHTML('beforeend', [...rows, bundleSummary].join(''));
  }
}

function installResultsPatchObserver(target = window) {
  const doc = target.document;
  const summary = doc?.getElementById('summary');
  if (!summary || target.__tlrMarketBundleResultsObserver) return;

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    target.setTimeout?.(() => {
      queued = false;
      patchResultsOverlay(target);
    }, 0);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(summary, { childList: true, subtree: true });
  target.__tlrMarketBundleResultsObserver = observer;
  schedule();
}

export function installMarketBundleFlow(target = window) {
  if (!target || target.__tlrMarketBundleFlowInstalled) return;
  target.__tlrMarketBundleFlowInstalled = true;
  ensureBundleStyles(target);
  installResultsPatchObserver(target);

  target.openShopMain = () => showBundleMarket(target);
  target.openShop = () => openBundleMarket(target);
  target.openRewardBundleWithAnimation = bundleId => openRewardBundleWithAnimation(bundleId, target);
  target.showRewardBundleContents = bundleId => showRewardBundleContents(bundleId, target);
  target.pickRewardBundleChoice = (bundleId, rewardKey) => pickRewardBundleChoice(bundleId, rewardKey, target);
}
