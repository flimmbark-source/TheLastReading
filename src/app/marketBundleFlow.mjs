import { MARKET_BUNDLES, MARKET_BUNDLE_REWARD_POOLS } from '../data/marketBundleTracks.mjs';
import { SHOP, SHOP_ICON } from '../data/legacyMarket.mjs';
import { copyStorePersistToLegacy } from './legacyBridge.mjs';
import { eligibleFiveStampCards, eligibleSuitStampCards } from './shopOverlayFlow.mjs';
import { ensureStoreFrontStyles } from '../ui/renderMarket.mjs';

function runtime(target){return target.tlrRuntime || {};}
function persistOf(target){return runtime(target).persist || target.persist || {};}
function stateOf(target){return runtime(target).state || target.state || {};}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function stripTags(value = '') {
  return String(value || '').replace(/<[^>]*>/g, '');
}

function bundleList(persist) {
  return (persist.pendingRewardBundles || []).filter(bundle => bundle.state !== 'claimed');
}

function syncStorePersistToLegacy(target = window) {
  const storePersist = target.tlrStore?.getState?.()?.persist;
  if (!storePersist) return;
  copyStorePersistToLegacy(storePersist, persistOf(target));
}

function ensureBundleStyles(target = window) {
  ensureStoreFrontStyles(target);
  const doc = target.document;
  if (!doc || doc.getElementById('market-bundle-flow-style')) return;
  const style = doc.createElement('style');
  style.id = 'market-bundle-flow-style';
  style.textContent = `
    .store-card.disabled{opacity:.72}
    .store-card--bundle-restless{--store-accent:rgba(110,180,220,.58)}
    .store-card--bundle-stillness{--store-accent:rgba(180,205,170,.54)}
    .store-card--bundle-sequence{--store-accent:rgba(214,176,86,.62)}
    .store-card--bundle-echo{--store-accent:rgba(190,145,220,.58)}
    .store-card--bundle-court{--store-accent:rgba(120,160,220,.58)}
    .store-card--empty{--store-accent:rgba(130,105,70,.42)}
    .store-card--bundle .store-card-tag{color:#c49a50}
    .store-card--bundle-restless .store-card-tag{color:#80bdda}
    .store-card--bundle-stillness .store-card-tag{color:#a8c99d}
    .store-card--bundle-echo .store-card-tag{color:#bf97df}
    .store-card--bundle-court .store-card-tag{color:#8faee5}
    .store-card--reward-choice{--store-accent:rgba(214,176,86,.54)}
    .store-card--reward-choice .store-card-tag{color:#c49a50}
    .store-card--reward-choice.reward-role-core{--store-accent:rgba(225,180,88,.64)}
    .store-card--reward-choice.reward-role-tool{--store-accent:rgba(110,180,220,.58)}
    .store-card--reward-choice.reward-role-bridge{--store-accent:rgba(190,145,220,.58)}
    .store-card--reward-choice.reward-role-core .store-card-tag{color:#e6bc68}
    .store-card--reward-choice.reward-role-tool .store-card-tag{color:#80bdda}
    .store-card--reward-choice.reward-role-bridge .store-card-tag{color:#bf97df}
    .store-card-choice-lv{margin-top:6px;font:800 10px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a7551}
    .store-bundle-note{font:700 11px/1.35 system-ui,sans-serif;color:#8a7551;text-align:center;margin-top:8px}
    .bundle-source-reasons{font:700 11px/1.35 system-ui,sans-serif;color:#b8a882;text-align:center;margin:6px auto 0;max-width:620px}
    .bundle-result-row td{color:#b8a882!important}
    .bundle-result-row.complete td:first-child{color:#f0dfbd!important}
    .bundle-result-row .bundle-result-reason{display:block;color:#f0dfbd;font-weight:800}
    .bundle-result-row .bundle-result-track{display:block;color:#8a7551;font:700 10px/1.25 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-top:2px}
    @media(max-width:480px){.store-card-choice-lv{font-size:9px}.bundle-source-reasons{font-size:10px;padding:0 10px}}
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

function poolSetForBundle(bundle) {
  const pools = MARKET_BUNDLE_REWARD_POOLS[bundle?.bundleId];
  if (!pools) return null;
  return bundle.tier > 1 ? pools.tier2 || pools.tier1 || null : pools.tier1 || null;
}

function rewardRoleForKey(bundle, rewardKey) {
  const pools = poolSetForBundle(bundle);
  if (!pools) return 'reward';
  for (const role of ['core', 'tool', 'bridge']) {
    if ((pools[role] || []).includes(rewardKey)) return role;
  }
  return 'reward';
}

function roleLabel(role) {
  if (role === 'core') return 'Core';
  if (role === 'tool') return 'Tool';
  if (role === 'bridge') return 'Bridge';
  return 'Reward';
}

function sourceReasonText(bundle) {
  const reasons = bundle?.source?.reasons || [];
  return reasons.filter(Boolean).join(' · ');
}

function renderRewardChoiceCard(bundle, rewardKey, target = window) {
  const row = SHOP[rewardKey];
  if (!row) return '';
  const persist = persistOf(target);
  const level = (persist.up || {})[rewardKey] || 0;
  const icon = SHOP_ICON[rewardKey] || 'isp-scoring';
  const role = rewardRoleForKey(bundle, rewardKey);
  const desc = stripTags(row[1] || '');
  return `<div class="store-card store-card--reward-choice reward-role-${escapeHtml(role)}">
    <div class="store-card-tag">${escapeHtml(roleLabel(role))}</div>
    <div class="store-card-art"><span class="isp isp-108 ${escapeHtml(icon)}"></span></div>
    <div class="store-card-main">
      <div class="store-card-name">${escapeHtml(row[0])}</div>
      <div class="store-card-desc">${escapeHtml(desc)}</div>
      <div class="store-card-choice-lv">Lv ${level} → ${level + 1}</div>
    </div>
    <button class="store-card-buy" onclick="pickRewardBundleChoice('${escapeHtml(bundle.id)}','${escapeHtml(rewardKey)}')">Take</button>
  </div>`;
}

function rewardBundleChoicesInner(bundle, target = window) {
  const display = MARKET_BUNDLES[bundle.bundleId] || {};
  const keys = bundle.rewardKeys || [];
  const reason = sourceReasonText(bundle);
  return `
    <div class="store-meta">
      <button class="store-refresh" onclick="openShopMain()">← Bundles</button>
      <div class="store-reserve-display"><div class="store-reserve-label">Choose</div><div class="store-reserve-amount">1</div></div>
    </div>
    <div class="store-bundle-note"><strong>${escapeHtml(display.name || 'Reward Bundle')}</strong> — Choose 1 reward.</div>
    ${reason ? `<div class="bundle-source-reasons">${escapeHtml(reason)}</div>` : ''}
    <div class="store-offer-row">
      ${keys.map(key => renderRewardChoiceCard(bundle, key, target)).join('')}
    </div>
    <div class="store-footer">
      <button class="store-proceed" onclick="openShopMain()">Back to Bundles</button>
    </div>`;
}

function renderRewardBundleChoices(bundle, target = window) {
  ensureBundleStyles(target);
  const front = target.document?.getElementById('storeFront') || target.document?.querySelector('.store-front-shell .store-front');
  if (!front) return false;
  front.innerHTML = rewardBundleChoicesInner(bundle, target);
  return true;
}

export function showRewardBundleContents(bundleId, target = window) {
  const bundle = bundleList(persistOf(target)).find(item => item.id === bundleId);
  if (!bundle || bundle.state !== 'opened') return false;
  if (renderRewardBundleChoices(bundle, target)) return true;
  if (typeof target.showOverlay !== 'function') return false;
  showBundleMarket(target);
  return renderRewardBundleChoices(bundle, target);
}

function ineligibleStampRewardKeys(target = window) {
  const persist = persistOf(target);
  const state = stateOf(target);
  const excluded = [];
  if (!eligibleFiveStampCards(persist, state).length) excluded.push('five_stamp');
  if (!eligibleSuitStampCards(persist, state).length) excluded.push('suit_stamp');
  return excluded;
}

export function openRewardBundleWithAnimation(bundleId, target = window) {
  if (!target.tlrStore || !target.tlrActions) return false;
  if (typeof target.tlrSyncPersistToStore === 'function') target.tlrSyncPersistToStore();
  target.tlrStore.dispatch({
    type: target.tlrActions.OPEN_REWARD_BUNDLE,
    bundleId,
    excludeRewardKeys: ineligibleStampRewardKeys(target),
  });
  syncStorePersistToLegacy(target);
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

function trackReason(delta) {
  return (delta.reasons || []).filter(Boolean).join(' · ') || delta.label;
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
    const value = delta.completed ? `${delta.label} +${delta.gained} · Bundle added` : `${delta.label} +${delta.gained} (${delta.after} / ${delta.threshold})`;
    rows.push(`<tr class="mrow bundle-result-row ${delta.completed ? 'complete' : ''}"><td><span class="bundle-result-reason">✦ ${escapeHtml(trackReason(delta))}</span><span class="bundle-result-track">${escapeHtml(delta.label)}</span></td><td class="r">${escapeHtml(value)}</td></tr>`);
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
