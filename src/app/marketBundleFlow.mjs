import { MARKET_BUNDLES } from '../data/marketBundleTracks.mjs';
import { SHOP, SHOP_ICON } from '../data/legacyMarket.mjs';

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || target.persist || {};}

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
    .store-card--bundle-sequence{--store-accent:rgba(214,176,86,.62)}
    .store-card--bundle-court{--store-accent:rgba(120,160,220,.58)}
    .store-card--bundle-restless{--store-accent:rgba(110,180,220,.58)}
    .store-card--bundle .store-card-tag{color:#c49a50}
    .store-card--bundle-court .store-card-tag{color:#8faee5}
    .store-card--bundle-restless .store-card-tag{color:#80bdda}
    .store-bundle-note{font:700 11px/1.35 system-ui,sans-serif;color:#8a7551;text-align:center;margin-top:8px}
    .bundle-result-row td{color:#b8a882!important}
    .bundle-result-row.complete td:first-child{color:#f0dfbd!important}
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

function renderBundleMarket(target = window) {
  const persist = persistOf(target);
  const bundles = bundleList(persist);
  if (!bundles.length) return false;

  ensureBundleStyles(target);
  const front = target.document?.getElementById('storeFront') || target.document?.querySelector('.store-front-shell .store-front');
  if (!front) return false;

  front.innerHTML = `
    <div class="store-meta">
      <button class="store-refresh" disabled><span class="store-refresh-icon">↻</span> Refresh</button>
      <div class="store-reserve-display"><div class="store-reserve-label">Bundles</div><div class="store-reserve-amount">${bundles.length}</div></div>
    </div>
    <div class="store-offer-row">
      ${bundles.map(renderBundleCard).join('')}
    </div>
    <div class="store-bundle-note">Open your reward bundle${bundles.length === 1 ? '' : 's'} to continue.</div>
    <div class="store-footer">
      <button class="store-proceed" disabled>Next Reading →</button>
    </div>`;
  return true;
}

function pickerPackIdForBundle(bundle) {
  const display = MARKET_BUNDLES[bundle?.bundleId] || {};
  if (display.sourcePackId) return display.sourcePackId;
  if (bundle?.bundleId === 'sequence_bundle' || bundle?.bundleId === 'court_bundle') return 'pattern';
  return null;
}

function buildRewardBundlePicker(bundle, target = window) {
  const display = MARKET_BUNDLES[bundle.bundleId] || {};
  const title = display.name || 'Reward Bundle';
  const keys = bundle.rewardKeys || [];
  let html = '<div class="summary tarot-shop">';
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
  const bundle = bundleList(persistOf(target)).find(item => item.id === bundleId);
  const reveal = () => showRewardBundleContents(bundleId, target);
  const packId = pickerPackIdForBundle(bundle);
  if (packId && typeof target.animatePackOpen === 'function' && target.PACKS?.[packId]) {
    target.animatePackOpen(packId, reveal);
    target.setTimeout?.(reveal, 1500);
    return true;
  }
  reveal();
  return true;
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
  if (typeof target.openShopMain === 'function') target.openShopMain();
  return true;
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

export function installMarketBundleFlow(target = window) {
  if (!target || target.__tlrMarketBundleFlowInstalled) return;
  target.__tlrMarketBundleFlowInstalled = true;
  ensureBundleStyles(target);

  const originalOpenShopMain = target.openShopMain;
  if (typeof originalOpenShopMain === 'function') {
    target.openShopMain = function openShopMainWithBundles(...args) {
      syncStorePersistToLegacy(target);
      const result = originalOpenShopMain.apply(this, args);
      renderBundleMarket(target);
      return result;
    };
  }

  const originalScoreReading = target.scoreReading;
  if (typeof originalScoreReading === 'function') {
    target.scoreReading = function scoreReadingWithBundleResults(...args) {
      const result = originalScoreReading.apply(this, args);
      target.setTimeout?.(() => patchResultsOverlay(target), 0);
      return result;
    };
  }

  target.openRewardBundleWithAnimation = bundleId => openRewardBundleWithAnimation(bundleId, target);
  target.showRewardBundleContents = bundleId => showRewardBundleContents(bundleId, target);
  target.pickRewardBundleChoice = (bundleId, rewardKey) => pickRewardBundleChoice(bundleId, rewardKey, target);
}
