import { MARKET_BUNDLES, MARKET_BUNDLE_REWARD_POOLS } from '../data/marketBundleTracks.mjs';
import { SHOP, SHOP_ICON } from '../data/legacyMarket.mjs';
import { copyStorePersistToLegacy } from './legacyBridge.mjs';
import { eligibleFiveStampCards, eligibleSuitStampCards } from './shopOverlayFlow.mjs';
import { ensureStoreFrontStyles } from '../ui/renderMarket.mjs';
import { rewardOfferKeysForBundle } from '../systems/marketRewardBundles.mjs';

const TRACK_LABELS = Object.freeze({ restless: 'Restless', stillness: 'Stillness', sequence: 'Sequence', echo: 'Echo', court: 'Court', thread: 'Thread' });
const LIVE_TRACK_ORDER = Object.freeze(['restless', 'stillness', 'sequence', 'echo', 'court', 'thread']);

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
    .store-bundle-note{font:800 12px/1.35 system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#b8a882;text-align:center;margin-top:8px}
    .bundle-result-row td{color:#b8a882!important}
    .bundle-result-row.complete td:first-child{color:#f0dfbd!important}
    .bundle-result-row .bundle-result-reason{display:block;color:#f0dfbd;font-weight:800}
    .bundle-result-row .bundle-result-track{display:block;color:#8a7551;font:700 10px/1.25 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-top:2px}
    .store-front.bundle-choice-transition{pointer-events:none}
    .store-front.bundle-choice-transition-out{opacity:.18!important;transform:translateY(10px) scale(.985)!important;filter:blur(1px) brightness(.82)}
    .store-front.bundle-choice-transition-in{animation:bundleChoicesIn .3s cubic-bezier(.16,.84,.24,1) both}
    @keyframes bundleChoicesIn{from{opacity:.35;transform:translateY(-8px) scale(.992);filter:brightness(1.18)}to{opacity:1;transform:translateY(0) scale(1);filter:brightness(1)}}
    @media(prefers-reduced-motion:reduce){.store-front.bundle-choice-transition-out{opacity:1!important;transform:none!important;filter:none}.store-front.bundle-choice-transition-in{animation:none}}
    @media(max-width:480px){.store-card-choice-lv{font-size:9px}}
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
      <div aria-hidden="true"></div>
      <div class="store-reserve-display"><div class="store-reserve-label">Bundles</div><div class="store-reserve-amount">${bundles.length}</div></div>
    </div>
    <div class="store-offer-row">
      ${hasBundles ? bundles.map(renderBundleCard).join('') : renderQuietMarketCard()}
    </div>
    <div class="store-footer">
      <button class="store-proceed" onclick="storeExitToNextReading()">Next Reading →</button>
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
  target.setTimeout?.(() => { const candle = doc.getElementById('storeCandle'); if (candle) candle.classList.add('lit'); }, 300);
  target.setTimeout?.(() => { const front = doc.getElementById('storeFront'); if (front) front.classList.add('store-visible'); }, 520);
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

function rewardKindLabel(rewardKey, row) {
  const category = row?.[5] || '';
  if (rewardKey === 'suit_stamp' || rewardKey === 'five_stamp') return 'Stamp';
  if (category === 'relic' || rewardKey === 'relicSlot') return 'Relic';
  if (category === 'pattern' || category === 'scoring') return 'Scoring';
  if (category === 'hand') return 'Hand Upgrade';
  if (category === 'draw') return 'Draw Upgrade';
  if (category === 'sight') return 'Sight Upgrade';
  if (category === 'thread') return 'Thread Upgrade';
  if (['stillness', 'echo', 'court'].includes(category)) return 'Upgrade';
  if (category === 'foundation' || category === 'ritual') return 'Upgrade';
  return 'Upgrade';
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
    <div class="store-card-tag">${escapeHtml(rewardKindLabel(rewardKey, row))}</div>
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
  const keys = bundle.rewardKeys || [];
  const canRefresh = !bundle.rewardRefreshed;
  return `
    <div class="store-meta">
      <button class="store-refresh" onclick="openShopMain()">← Market</button>
      <button class="store-refresh" ${canRefresh ? '' : 'disabled'} onclick="refreshRewardBundleChoices('${escapeHtml(bundle.id)}')"><span class="store-refresh-icon">↻</span> ${canRefresh ? 'Refresh' : 'Refresh Used'}</button>
    </div>
    <div class="store-bundle-note">Choose 1 Reward</div>
    <div class="store-offer-row">
      ${keys.map(key => renderRewardChoiceCard(bundle, key, target)).join('')}
    </div>`;
}

function renderRewardBundleChoices(bundle, target = window) {
  ensureBundleStyles(target);
  const front = target.document?.getElementById('storeFront') || target.document?.querySelector('.store-front-shell .store-front');
  if (!front) return false;
  front.innerHTML = rewardBundleChoicesInner(bundle, target);
  return true;
}

function transitionToRewardBundleChoices(bundle, target = window) {
  ensureBundleStyles(target);
  const front = target.document?.getElementById('storeFront') || target.document?.querySelector('.store-front-shell .store-front');
  if (!front) return false;
  if (target.__tlrRewardChoiceTransitionActive) return true;
  const reduce = target.matchMedia && target.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return renderRewardBundleChoices(bundle, target);
  target.__tlrRewardChoiceTransitionActive = true;
  front.classList.add('bundle-choice-transition', 'bundle-choice-transition-out');
  target.setTimeout?.(() => {
    renderRewardBundleChoices(bundle, target);
    front.classList.remove('bundle-choice-transition-out');
    front.classList.add('bundle-choice-transition-in');
    target.setTimeout?.(() => {
      front.classList.remove('bundle-choice-transition', 'bundle-choice-transition-in');
      target.__tlrRewardChoiceTransitionActive = false;
    }, 330);
  }, 170);
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
  target.tlrStore.dispatch({ type: target.tlrActions.OPEN_REWARD_BUNDLE, bundleId, excludeRewardKeys: ineligibleStampRewardKeys(target) });
  syncStorePersistToLegacy(target);
  if (typeof target.playSound === 'function') target.playSound('pack_open');
  const bundle = bundleList(persistOf(target)).find(item => item.id === bundleId);
  if (!bundle || bundle.state !== 'opened') return false;
  if (transitionToRewardBundleChoices(bundle, target)) return true;
  return showRewardBundleContents(bundleId, target);
}

export function refreshRewardBundleChoices(bundleId, target = window) {
  if (!target.tlrStore || !target.tlrActions) return false;
  if (typeof target.tlrSyncPersistToStore === 'function') target.tlrSyncPersistToStore();
  const storePersist = target.tlrStore.getState().persist;
  const bundles = storePersist.pendingRewardBundles || [];
  const index = bundles.findIndex(bundle => bundle.id === bundleId && bundle.state === 'opened');
  if (index < 0 || bundles[index].rewardRefreshed) return false;
  const rewardKeys = rewardOfferKeysForBundle(storePersist, bundles[index], { excludeRewardKeys: ineligibleStampRewardKeys(target) });
  const pendingRewardBundles = bundles.map((bundle, i) => i === index ? { ...bundle, rewardKeys, rewardRefreshed: true } : bundle);
  target.tlrStore.dispatch({ type: target.tlrActions.SYNC_LEGACY_PERSIST, persist: { pendingRewardBundles } });
  syncStorePersistToLegacy(target);
  if (typeof target.playSound === 'function') target.playSound('pack_open');
  const updated = bundleList(persistOf(target)).find(bundle => bundle.id === bundleId);
  return updated ? renderRewardBundleChoices(updated, target) : false;
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

function deltaBundleCount(delta) {
  return Array.isArray(delta.bundleIds) && delta.bundleIds.length ? delta.bundleIds.length : (delta.bundleId ? 1 : 0);
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
  if (deltas.length) rows.push('<tr class="grouprow bundle-result-row"><td colspan="2">Track Progress</td></tr>');
  for (const delta of deltas) {
    const bundleCount = deltaBundleCount(delta);
    const bundleText = bundleCount > 1 ? `${bundleCount} Bundles added` : 'Bundle added';
    const value = delta.completed ? `${delta.label} +${delta.gained} · ${bundleText}` : `${delta.label} +${delta.gained} (${delta.after} / ${delta.threshold})`;
    rows.push(`<tr class="mrow bundle-result-row ${delta.completed ? 'complete' : ''}"><td><span class="bundle-result-reason">✦ ${escapeHtml(trackReason(delta))}</span><span class="bundle-result-track">${escapeHtml(delta.label)}</span></td><td class="r">${escapeHtml(value)}</td></tr>`);
  }
  const totals = table.querySelectorAll('tr.totrow');
  const reserveRow = totals[totals.length - 1];
  const bundleSummary = `<tr class="totrow bundle-result-row"><td>Bundles added</td><td class="r">${generated.length}</td></tr>`;
  if (reserveRow && reserveRow.textContent.includes('Added to reserve')) reserveRow.outerHTML = [...rows, bundleSummary].join('');
  else table.insertAdjacentHTML('beforeend', [...rows, bundleSummary].join(''));
}

function maybeDelayResultsOverlayForTrackGhosts(target = window) {
  const summary = target.document?.getElementById('summary');
  if (!summary || !summary.classList.contains('show')) return false;
  if (!summary.querySelector('.result-panel.pass')) return false;
  if (summary.dataset.trackGhostDelay === 'done') return false;
  const run = target.tlrStore?.getState?.()?.run;
  const results = run?.lastResults;
  const labels = finalTrackGhostLabels(results, run, target);
  if (!labels.length) return false;
  const key = resultGhostKey(run || {});
  if (target.__tlrTrackGhostResultDelayKey === key) return true;
  target.__tlrTrackGhostResultDelayKey = key;
  summary.dataset.trackGhostDelay = 'pending';
  summary.style.visibility = 'hidden';
  playTrackGhostLabels(labels, () => {
    summary.style.visibility = '';
    summary.dataset.trackGhostDelay = 'done';
    target.__tlrTrackGhostResultDelayKey = null;
    target.__tlrTrackGhostResultsPlayed = key;
    patchResultsOverlay(target);
  }, target, { blocking: true });
  return true;
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
      if (maybeDelayResultsOverlayForTrackGhosts(target)) return;
      patchResultsOverlay(target);
    }, 0);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(summary, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  target.__tlrMarketBundleResultsObserver = observer;
  schedule();
}

function trackGhostRunKey(run = {}) {
  return `${run.reading || 1}:${run.thresholdIndex || 0}:${run.setIndex || 0}`;
}

function emptyTrackMap() {
  return { restless: 0, stillness: 0, sequence: 0, echo: 0, court: 0, thread: 0 };
}

function emittedTrackState(target, run) {
  const key = trackGhostRunKey(run || {});
  if (!target.__tlrEmittedTrackGhosts || target.__tlrEmittedTrackGhosts.key !== key) {
    target.__tlrEmittedTrackGhosts = { key, emitted: emptyTrackMap() };
  }
  return target.__tlrEmittedTrackGhosts.emitted;
}

function cardRankKey(card) {
  if (!card) return null;
  if (card.rank != null) return `rank:${card.rank}`;
  if (card.number != null) return `num:${card.number}`;
  return null;
}

function echoTrackScoreForCards(cards = []) {
  const counts = new Map();
  cards.filter(Boolean).forEach(card => {
    const key = cardRankKey(card);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const best = Math.max(0, ...counts.values());
  if (best >= 4) return 3;
  if (best >= 3) return 2;
  if (best >= 2) return 1;
  return 0;
}

function sequenceTrackScoreForCards(cards = []) {
  const values = [...new Set(cards.filter(Boolean).map(card => Number(card.number)).filter(Number.isFinite))].sort((a, b) => a - b);
  let best = values.length ? 1 : 0;
  let run = values.length ? 1 : 0;
  for (let i = 1; i < values.length; i += 1) {
    run = values[i] === values[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  if (best >= 5) return 3;
  if (best >= 4) return 2;
  if (best >= 3) return 1;
  return 0;
}

function courtTrackScoreForCards(cards = []) {
  const courts = cards.filter(card => card?.type === 'court');
  let score = courts.length;
  const distinctRanks = new Set(courts.map(card => card.rank).filter(Boolean)).size;
  let hasRoyal = false;
  for (const suit of ['Wands', 'Cups', 'Swords', 'Pentacles']) {
    const ranks = new Set(courts.filter(card => card.suit === suit).map(card => card.rank).filter(Boolean));
    if (ranks.size >= 3) { hasRoyal = true; break; }
  }
  if (hasRoyal) score += 3;
  else if (distinctRanks >= 3) score += 2;
  return Math.min(5, Math.max(0, score));
}

function openingHandCardsInSpread(run = {}) {
  const opening = new Set(run.openingHandCardIds || []);
  return (run.spread || []).filter(card => card && opening.has(card.uid)).length;
}

function liveTrackProgress(run = {}) {
  const cards = (run.spread || []).filter(Boolean);
  const discards = run.roundDiscardCount || 0;
  const abilityTaken = (run.abilityTakenCardIds || []).length;
  const mulligans = run.roundMulliganCount || 0;
  const initialDiscards = Number.isFinite(run.initialDiscards) ? run.initialDiscards : 3;
  const totalInterventions = discards + abilityTaken + mulligans;
  const out = emptyTrackMap();

  if (discards >= 2) out.restless += 1;
  if (abilityTaken >= 2) out.restless += 1;
  if (initialDiscards > 0 && (run.discards || 0) <= 0) out.restless += 1;
  if (totalInterventions >= 4) out.restless += 1;
  out.restless = Math.min(4, out.restless);

  if (openingHandCardsInSpread(run) >= 3) out.stillness += 1;
  out.sequence = sequenceTrackScoreForCards(cards);
  out.echo = echoTrackScoreForCards(cards);
  out.court = courtTrackScoreForCards(cards);
  out.thread = run.threadBondCount || run.roundThreadBondCount || 0;
  return out;
}

function fireLiteralTrackGhost(target, label, delay = 0, options = {}) {
  target.setTimeout?.(() => {
    if (typeof target.fireTrackGhost === 'function') target.fireTrackGhost(label, options);
    else if (typeof target.centerGhost === 'function') target.centerGhost(label);
  }, delay);
}

function trackGhostLabel(trackId, amount, fallbackLabel = null) {
  const label = fallbackLabel || TRACK_LABELS[trackId] || trackId;
  return `+${amount} ${label}`;
}

function playTrackGhostLabels(labels, done = () => {}, target = window, options = {}) {
  if (!labels.length) { done(); return false; }
  const step = options.blocking ? 520 : 170;
  const start = options.blocking ? 160 : 240;
  if (options.blocking) target.__tlrTrackGhostPlaybackActive = true;
  labels.forEach((label, index) => fireLiteralTrackGhost(target, label, start + index * step, { center: !!options.blocking }));
  const finishDelay = start + labels.length * step + (options.blocking ? 120 : 0);
  target.setTimeout?.(() => {
    if (options.blocking) target.__tlrTrackGhostPlaybackActive = false;
    done();
  }, finishDelay);
  return true;
}

export function fireInReadingTrackGhosts(_action, _beforeRun, afterRun, target = window) {
  if (!afterRun || target.__tlrTrackGhostPlaybackActive) return false;
  const emitted = emittedTrackState(target, afterRun);
  const current = liveTrackProgress(afterRun);
  const labels = [];
  for (const trackId of LIVE_TRACK_ORDER) {
    const delta = Math.max(0, (current[trackId] || 0) - (emitted[trackId] || 0));
    if (delta <= 0) continue;
    emitted[trackId] = current[trackId] || 0;
    labels.push(trackGhostLabel(trackId, delta));
  }
  return playTrackGhostLabels(labels, () => {}, target, { blocking: false });
}

function resultGhostKey(run = {}) {
  const ids = run.lastResults?.generatedBundleIds || [];
  return `${run.lastReadingLedger?.id || run.reading || 'reading'}:${ids.join(',')}:${(run.lastResults?.trackDeltas || []).map(delta => `${delta.trackId}:${delta.gained}:${delta.after}`).join('|')}`;
}

function finalTrackGhostLabels(results, run, target = window) {
  if (!results?.cleared) return [];
  const emitted = emittedTrackState(target, run || {});
  const labels = [];
  for (const delta of results.trackDeltas || []) {
    if (!delta || !(delta.gained > 0)) continue;
    const already = emitted[delta.trackId] || 0;
    const missing = Math.max(0, delta.gained - already);
    if (missing <= 0) continue;
    emitted[delta.trackId] = already + missing;
    labels.push(trackGhostLabel(delta.trackId, missing, delta.label));
  }
  return labels;
}

export function playTrackResultsBeforeOverlay(done = () => {}, target = window) {
  const run = target.tlrStore?.getState?.()?.run;
  const results = run?.lastResults;
  const key = resultGhostKey(run || {});
  if (target.__tlrTrackGhostResultsPlayed === key) { done(); return false; }
  const labels = finalTrackGhostLabels(results, run, target);
  if (!labels.length) { target.__tlrTrackGhostResultsPlayed = key; done(); return false; }
  target.__tlrTrackGhostResultsPlayed = key;
  return playTrackGhostLabels(labels, done, target, { blocking: true });
}

function openBundleMarketAfterTrackGhosts(target = window) {
  return playTrackResultsBeforeOverlay(() => openBundleMarket(target), target);
}

function installInReadingTrackGhostWrappers(target = window) {
  if (!target || target.__tlrTrackGhostActionWrappersInstalled) return;
  target.__tlrTrackGhostActionWrappersInstalled = true;
  const wrapAction = (actionFactory, fn) => function wrappedTrackGhostAction(...args) {
    const result = fn.apply(this, args);
    const afterRun = target.tlrStore?.getState?.()?.run;
    fireInReadingTrackGhosts(actionFactory(...args), null, afterRun, target);
    return result;
  };
  if (typeof target.placeCard === 'function') {
    const original = target.placeCard;
    target.placeCard = wrapAction(slotIndex => ({ type: target.tlrActions?.PLACE_CARD || 'PLACE_CARD', slotIndex }), original);
  }
  if (typeof target.discardSelected === 'function') {
    const original = target.discardSelected;
    target.discardSelected = wrapAction(() => ({ type: target.tlrActions?.DISCARD_SELECTED || 'DISCARD_SELECTED' }), original);
  }
  if (typeof target.tlrResolveAbilityThroughStore === 'function') {
    const original = target.tlrResolveAbilityThroughStore;
    target.tlrResolveAbilityThroughStore = function wrappedResolveAbilityThroughStore(result) {
      const out = original.call(this, result);
      const afterRun = target.tlrStore?.getState?.()?.run;
      fireInReadingTrackGhosts({ type: target.tlrActions?.RESOLVE_ABILITY || 'RESOLVE_ABILITY', result }, null, afterRun, target);
      return out;
    };
  }
}

export function installMarketBundleFlow(target = window) {
  if (!target || target.__tlrMarketBundleFlowInstalled) return;
  target.__tlrMarketBundleFlowInstalled = true;
  ensureBundleStyles(target);
  installResultsPatchObserver(target);
  target.openShopMain = () => showBundleMarket(target);
  target.openShop = () => openBundleMarketAfterTrackGhosts(target);
  target.openRewardBundleWithAnimation = bundleId => openRewardBundleWithAnimation(bundleId, target);
  target.refreshRewardBundleChoices = bundleId => refreshRewardBundleChoices(bundleId, target);
  target.showRewardBundleContents = bundleId => showRewardBundleContents(bundleId, target);
  target.pickRewardBundleChoice = (bundleId, rewardKey) => pickRewardBundleChoice(bundleId, rewardKey, target);
  target.tlrMaybeFireTrackGhosts = (action, beforeRun, afterRun) => fireInReadingTrackGhosts(action, beforeRun, afterRun, target);
  target.playTrackResultsBeforeOverlay = done => playTrackResultsBeforeOverlay(done, target);
  installInReadingTrackGhostWrappers(target);
}
