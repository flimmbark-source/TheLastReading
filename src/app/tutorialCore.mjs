const TUT_KEY = 'tlr_tut_done';
const TUT_PATTERN_KEY = 'tlr_tut_pattern';
const TUT_READING_KEY = 'tlr_tut_reading_complete';
const TUT_PURGE_KEY = 'tlr_tut_purge';
const TUT_ARCHIVES_KEY = 'tlr_tut_archives_found';
const TUT_MARKET_KEY = 'tlr_tut_oracle_market';
const TUT_CONSTELLATION_KEY = 'tlr_tut_constellation';
const TUT_THRESHOLD_KEY = 'tlr_tut_threshold';
const TUT_DISCARD_KEY = 'tlr_tut_discard';
const TUT_ADVENTURE_KEY = 'tlr_tut_adventure';
const TUT_ADV_APPROACH_KEY = 'tlr_tut_adv_approach';
const TUT_ADV_APPROACH_CHAIN_KEY = 'tlr_tut_adv_approach_chain';
const TUT_ADV_APPROACH_GREAT_KEY = 'tlr_tut_adv_approach_great';
const TUT_ADV_REWARD_KEY = 'tlr_tut_adv_reward';
const TUT_ADV_ITEMS_KEY = 'tlr_tut_adv_items';
const TUT_ADV_COMPLETE_KEY = 'tlr_tut_adv_complete';
const INTRO_LAST_STEP = 2;
const ADVENTURE_FIRST_STEP = 21;
const ADVENTURE_LAST_STEP = 27;

export const TUT_STEP = Object.freeze({
  INTRO: 0,
  SELECT_CARD: 1,
  PLACE_CARD: 2,
  SCORE_ADDED: 3,
  CARD_POINTS: 4,
  THRESHOLD: 5,
  DISCARD_ABILITY: 6,
  PATTERN_NOTICE: 7,
  THRESHOLD_PROGRESS: 8,
  RELIC: 9,
  PATTERN_SCORING: 10,
  PURGE: 11,
  READING_COMPLETE: 12,
  ARCHIVES: 13,
  MARKET_RESERVE: 14,
  MARKET_SCORING: 15,
  MARKET_ABILITIES: 16,
  MARKET_RELICS: 17,
  MARKET_REFRESH: 18,
  MARKET_NEXT: 19,
  CONSTELLATION: 20,
  ADVENTURE_INTRO: 21,
  ADVENTURE_EVENT: 22,
  ADVENTURE_SIGIL: 23,
  ADVENTURE_POTENCY: 24,
  ADVENTURE_APPROACH_BTN: 25,
  ADVENTURE_PLACE: 26,
  ADVENTURE_RESOLVE: 27,
  ADVENTURE_APPROACH_WEB: 28,
  ADVENTURE_APPROACH_CHAIN: 29,
  ADVENTURE_APPROACH_GREAT: 30,
  ADVENTURE_REWARD: 31,
  ADVENTURE_ITEMS: 32,
  ADVENTURE_COMPLETE: 33,
});

let tutStep = -1;
let tutTimer = null;
let tutDone = !!localStorage.getItem(TUT_KEY);
let tutIgnoreClicksUntil = 0;
let queuedTipSteps = [];
let queuedTipTimer = null;
let placementCount = 0;
let activeTutTarget = null;
let activeTutArrow = 'up';
let tutPositionTimer = null;

const TUT_STEPS = [
  { center: true, text: 'Your relative left behind their tarot deck. You used to play this game together.' },
  { sel: '#hand .card[data-uid]', fallbackSel: '.handDock .hand', arrow: 'down', waitFor: 'cardSelected', text: 'Tap a card to select it.' },
  { sel: '#spread .slot.empty', fallbackSel: '#spread', arrow: 'up', waitFor: 'cardPlaced', text: 'Tap an empty slot to place it.' },
  { sel: '#current', fallbackSel: '.score-pill', arrow: 'up', text: 'That card added points to your total.' },
  { sel: '#hand .card[data-uid] .seal.tr', fallbackSel: '#hand .card[data-uid]', arrow: 'down', text: 'The red circle on each card shows how many points it adds.' },
  { sel: '#threshold', fallbackSel: '.threshold-pill', arrow: 'up', key: TUT_THRESHOLD_KEY, text: 'You have a set of 2 Spreads in which to beat the Threshold and advance.' },
  { sel: '#discardBtn', arrow: 'down', key: TUT_DISCARD_KEY, text: '<b>Discard</b> a card to use its <b>Ability</b> instead of placing it.' },
  { sel: '#hand .card[data-hint], #hand .card.hint-complete, #hand .card.hint-card', fallbackSel: '#hand .card[data-uid]', arrow: 'down', key: TUT_PATTERN_KEY, text: 'Some of your cards may work together.' },
  { center: true, text: 'Each cleared Threshold makes the next one harder. Clear the 10th Threshold to win.' },
  { sel: '#relicRack .relic-btn', fallbackSel: '#relicRack', arrow: 'up', text: 'You found a <b>Relic</b>. Relics carry passive effects across every reading until you lose. Tap a relic icon to see what it does.' },
  { sel: '#scoringBtn', fallbackSel: '#scoringPullTab', arrow: 'up', key: TUT_PATTERN_KEY, text: 'Check <b>Scoring</b> to see if you can complete a pattern. Place the cards down to activate a pattern.' },
  { sel: '#purgeBtn', arrow: 'down', key: TUT_PURGE_KEY, text: 'Remove 3 cards from your hand to gain 1 Discard.' },
  { sel: '#spread .slot.empty', fallbackSel: '#spread', arrow: 'up', key: TUT_READING_KEY, text: 'One more card completes the reading.' },
  { sel: '#spv2ArchiveBtn', fallbackSel: '#invTab', arrow: 'up', key: TUT_ARCHIVES_KEY, text: 'The <b>Archives</b> hold discovered items. Tap to open and investigate.' },
  { sel: '.store-reserve-display', arrow: 'down', key: TUT_MARKET_KEY, text: '<b>Reserve</b><br>Your currency for upgrades in the Market.' },
  { sel: '.store-offer-row .store-card:nth-child(1)', arrow: 'down', key: TUT_MARKET_KEY, text: '<b>Scoring</b><br>Buy pattern upgrades. Chips and Mult increase by the amount shown.' },
  { sel: '.store-offer-row .store-card:nth-child(2)', arrow: 'down', key: TUT_MARKET_KEY, text: '<b>Pack</b><br>Open a pack to choose a hand, discard, draw, or ability upgrade.' },
  { sel: '.store-offer-row .store-card:nth-child(3)', arrow: 'up', key: TUT_MARKET_KEY, text: '<b>Relic</b><br>Buy a relic to add its passive effect to your relic row.' },
  { sel: '.store-refresh', arrow: 'up', key: TUT_MARKET_KEY, text: '<b>Refresh</b><br>Spend Reserve to replace the Market offers.' },
  { sel: '.store-proceed', arrow: 'up', key: TUT_MARKET_KEY, text: '<b>Next Reading</b><br>Leave the Market and start the next reading.' },
  { sel: '#constellationPill:not(.hidden)', arrow: 'up', key: TUT_CONSTELLATION_KEY, text: '<b>Constellation</b><br>A constellation changes this reading. Tap its sign to see the rule.' },
  { center: true, text: 'In Adventure Mode, each Event is resolved by playing one card.' },
  { sel: '#advEventDeck .adv-event-hero', fallbackSel: '#advEventDeck', arrow: 'up', text: 'Read the Event and decide how you want to respond.' },
  { sel: '#hand .card[data-uid] .adv-sigil-seal', fallbackSel: '#hand .card[data-uid]', arrow: 'down', text: 'The text above this card shows the kind of approach it represents.' },
  { sel: '#hand .card[data-uid] .seal.tr', fallbackSel: '#hand .card[data-uid]', arrow: 'down', text: 'The red number shows how strong that response is.' },
  { sel: '#scoringBtn', fallbackSel: '#scoringPullTab', arrow: 'up', text: 'Tap here to see an approach map — which approaches this Event accepts and which you\'re holding.' },
  { sel: '#spread .slot.empty', fallbackSel: '#spread', arrow: 'up', waitFor: 'advCardPlaced', text: 'Place one card to face the Event and see what happens.' },
  { sel: '#advHud .adv-hud__main', fallbackSel: '#advHud', arrow: 'up', text: 'A failed response costs Resolve. Reach zero and the run ends.' },
  { center: true, key: TUT_ADV_APPROACH_KEY, text: 'Gold nodes show the approaches this Event accepts. Card icons show which approaches you\'re holding.' },
  { center: true, key: TUT_ADV_APPROACH_CHAIN_KEY, text: 'If your approach isn\'t an exact match, it chains to the nearest accepted node.' },
  { center: true, key: TUT_ADV_APPROACH_GREAT_KEY, text: 'An exact match earns a Great Success.' },
  { sel: '.adv-rewards', fallbackSel: '.result-panel', arrow: 'up', key: TUT_ADV_REWARD_KEY, text: 'When you succeed, pick a reward. Rewards shape your run.' },
  { sel: '#relicRack', arrow: 'up', key: TUT_ADV_ITEMS_KEY, text: 'Items you earn are carried here. Tap a consumable to use it.' },
  { center: true, key: TUT_ADV_COMPLETE_KEY, text: "You finished a Set. Complete one more to win the adventure." },
];

const MARKET_TUT_STEPS = [
  TUT_STEP.MARKET_RESERVE,
  TUT_STEP.MARKET_NEXT,
];

function q(sel) { return document.querySelector(sel); }
function stepKey(step) { return TUT_STEPS[step] && TUT_STEPS[step].key ? TUT_STEPS[step].key : null; }
function markStepSeen(step) { const key = stepKey(step); if (key) localStorage.setItem(key, '1'); }
function isAdventureTutorialStep(step) { return step >= ADVENTURE_FIRST_STEP && step <= ADVENTURE_LAST_STEP; }

function isVisibleTarget(element) {
  if (!element || !element.isConnected) return false;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function firstVisibleTarget(sel) {
  if (!sel) return null;
  return [...document.querySelectorAll(sel)].find(isVisibleTarget) || null;
}

function targetForStep(s) {
  return firstVisibleTarget(s.sel) || firstVisibleTarget(s.fallbackSel);
}

function canShowStep(step, force = false) {
  const s = TUT_STEPS[step];
  if (!s) return false;
  if (!force && step <= INTRO_LAST_STEP && tutDone) return false;
  if (!force && isAdventureTutorialStep(step) && localStorage.getItem(TUT_ADVENTURE_KEY)) return false;
  const key = stepKey(step);
  if (!force && key && localStorage.getItem(key)) return false;
  return true;
}

function hasPendingTip() {
  return tutStep >= 0 || queuedTipSteps.length > 0 || !!queuedTipTimer;
}

function finishIntro() {
  localStorage.setItem(TUT_KEY, '1');
  tutDone = true;
  tutHide();
}

function scheduleQueuedTips(delay = 180) {
  clearTimeout(queuedTipTimer);
  queuedTipTimer = setTimeout(() => {
    queuedTipTimer = null;
    if (tutStep >= 0) { scheduleQueuedTips(450); return; }
    while (queuedTipSteps.length) {
      const next = queuedTipSteps.shift();
      if (!canShowStep(next)) continue;
      tutShow(next);
      return;
    }
  }, delay);
}

function queueTip(step, delay = 180) {
  if (!canShowStep(step)) return;
  if (!queuedTipSteps.includes(step)) queuedTipSteps.push(step);
  scheduleQueuedTips(delay);
}

function queuePriorityTip(step, delay = 180) {
  if (!canShowStep(step)) return;
  queuedTipSteps = queuedTipSteps.filter(queuedStep => queuedStep !== step);
  queuedTipSteps.unshift(step);
  scheduleQueuedTips(delay);
}

export function tutSkip() {
  if (isAdventureTutorialStep(tutStep)) {
    localStorage.setItem(TUT_ADVENTURE_KEY, '1');
    tutHide();
    return;
  }
  if (window.__tlrAdventureActive) {
    markStepSeen(tutStep);
    tutHide();
    return;
  }
  markStepSeen(tutStep);
  localStorage.setItem(TUT_KEY, '1');
  tutDone = true;
  tutHide();
}

export function replayTutorial() {
  if (window.__tlrAdventureActive) {
    [TUT_ADVENTURE_KEY, TUT_ADV_APPROACH_KEY, TUT_ADV_APPROACH_CHAIN_KEY, TUT_ADV_APPROACH_GREAT_KEY, TUT_ADV_REWARD_KEY, TUT_ADV_ITEMS_KEY, TUT_ADV_COMPLETE_KEY].forEach(k => localStorage.removeItem(k));
    queuedTipSteps = [];
    clearTimeout(queuedTipTimer);
    queuedTipTimer = null;
    tutHide();
    maybeShowAdventureTutorial({ force: true });
    return;
  }
  [
    TUT_KEY,
    'tlr_tut_relic',
    'tlr_tut_inv_open',
    'tlr_tut_inv_name',
    'tlr_tut_inv_detail',
    TUT_PATTERN_KEY,
    TUT_READING_KEY,
    TUT_PURGE_KEY,
    TUT_ARCHIVES_KEY,
    TUT_MARKET_KEY,
    TUT_CONSTELLATION_KEY,
    TUT_THRESHOLD_KEY,
    TUT_DISCARD_KEY,
  ].forEach(k => localStorage.removeItem(k));
  queuedTipSteps = [];
  clearTimeout(queuedTipTimer);
  queuedTipTimer = null;
  placementCount = 0;
  tutDone = false;
  tutShow(TUT_STEP.INTRO, { force: true });
}

export function tutHide() {
  clearTimeout(tutTimer);
  clearTimeout(tutPositionTimer);
  tutTimer = null;
  tutPositionTimer = null;
  tutStep = -1;
  activeTutTarget = null;
  const tip = q('#tutTip');
  if (!tip) return;
  tip.classList.remove('show', 'tut-center');
  tip.style.cssText = '';
}

function positionActiveTip() {
  if (tutStep < 0 || !activeTutTarget) return;
  posTutTip(activeTutTarget, activeTutArrow);
}

export function tutShow(step, options = {}) {
  const force = !!options.force;
  if (!canShowStep(step, force)) return;
  clearTimeout(tutTimer);
  clearTimeout(tutPositionTimer);
  tutTimer = null;
  tutPositionTimer = null;
  tutStep = step;
  tutIgnoreClicksUntil = Date.now() + (step === TUT_STEP.PATTERN_NOTICE ? 450 : 180);
  const s = TUT_STEPS[step];
  if (!s) return;
  const tip = q('#tutTip');
  const text = q('#tutText');
  if (!tip || !text) return;
  tip.classList.remove('show', 'tut-center');
  tip.style.cssText = '';
  text.innerHTML = s.text;
  const tapPrompt = tip.querySelector('.tut-tap-prompt');
  if (tapPrompt) tapPrompt.style.display = s.waitFor ? 'none' : '';
  if (s.center) {
    activeTutTarget = null;
    tip.classList.add('show', 'tut-center');
  } else {
    const target = targetForStep(s);
    if (!target) { tutHide(); scheduleQueuedTips(300); return; }
    activeTutTarget = target;
    activeTutArrow = s.arrow || 'up';
    tip.classList.add('show');
    requestAnimationFrame(() => {
      positionActiveTip();
      requestAnimationFrame(positionActiveTip);
    });
    tutPositionTimer = setTimeout(positionActiveTip, 180);
  }
}

export function tutNext() {
  if (tutStep < 0) return;
  const s = TUT_STEPS[tutStep];
  if (!s || s.waitFor) return;
  if (isAdventureTutorialStep(tutStep)) {
    if (tutStep < ADVENTURE_LAST_STEP) {
      tutShow(tutStep + 1, { force: true });
    } else {
      localStorage.setItem(TUT_ADVENTURE_KEY, '1');
      tutHide();
    }
    return;
  }
  if (tutStep < TUT_STEP.SELECT_CARD) { tutShow(tutStep + 1); return; }
  if (tutStep === TUT_STEP.DISCARD_ABILITY) {
    markStepSeen(tutStep);
    if (canShowStep(TUT_STEP.PATTERN_NOTICE)) tutShow(TUT_STEP.PATTERN_NOTICE);
    else { tutHide(); scheduleQueuedTips(260); }
    return;
  }
  if (tutStep === TUT_STEP.PATTERN_NOTICE) { tutShow(TUT_STEP.PATTERN_SCORING); return; }
  if (tutStep === TUT_STEP.PATTERN_SCORING) {
    markStepSeen(tutStep);
    if (canShowStep(TUT_STEP.THRESHOLD)) tutShow(TUT_STEP.THRESHOLD);
    else { tutHide(); scheduleQueuedTips(260); }
    return;
  }
  const marketIndex = MARKET_TUT_STEPS.indexOf(tutStep);
  if (marketIndex >= 0 && marketIndex < MARKET_TUT_STEPS.length - 1) {
    tutShow(MARKET_TUT_STEPS[marketIndex + 1]);
    return;
  }
  markStepSeen(tutStep);
  tutHide();
  scheduleQueuedTips(260);
}

function onPlacement() {
  if (window.__tlrAdventureActive) return;
  placementCount++;
  if (!tutDone || localStorage.getItem(TUT_DISCARD_KEY)) return;
  queuePriorityTip(TUT_STEP.DISCARD_ABILITY, 260);
}

export function tutSignal(eventName) {
  if (eventName === 'cardPlaced') onPlacement();
  if (eventName === 'advApproachWebOpened') { queueTip(TUT_STEP.ADVENTURE_APPROACH_WEB, 300); queueTip(TUT_STEP.ADVENTURE_APPROACH_CHAIN, 300); queueTip(TUT_STEP.ADVENTURE_APPROACH_GREAT, 300); return; }
  if (eventName === 'advRewardShown') { queueTip(TUT_STEP.ADVENTURE_REWARD, 350); return; }
  if (eventName === 'advItemGained') { queueTip(TUT_STEP.ADVENTURE_ITEMS, 350); return; }
  if (eventName === 'advSetComplete') { queueTip(TUT_STEP.ADVENTURE_COMPLETE, 350); return; }
  if (tutStep < 0) return;
  const s = TUT_STEPS[tutStep];
  if (!s || s.waitFor !== eventName) return;
  tutIgnoreClicksUntil = Date.now() + 180;
  if (isAdventureTutorialStep(tutStep)) {
    if (tutStep < ADVENTURE_LAST_STEP) { tutShow(tutStep + 1, { force: true }); }
    else { localStorage.setItem(TUT_ADVENTURE_KEY, '1'); tutHide(); }
    return;
  }
  if (tutStep < TUT_STEP.PLACE_CARD) { tutShow(tutStep + 1); return; }
  finishIntro();
  queuePriorityTip(TUT_STEP.DISCARD_ABILITY, 260);
}

export function maybeShowAdventureTutorial(options = {}) {
  if (!window.__tlrAdventureActive) return;
  const force = !!options.force;
  if (!force && localStorage.getItem(TUT_ADVENTURE_KEY)) return;
  queuedTipSteps = [];
  clearTimeout(queuedTipTimer);
  queuedTipTimer = null;
  tutHide();
  tutShow(TUT_STEP.ADVENTURE_INTRO, { force: true });
}

export function maybeShowPatternTutorial() { }

export function maybeShowReadingCompletionTutorial() { }

export function maybeShowDiscardTutorial() { }

export function maybeShowPurgeTutorial() {
  const st = window.state;
  if (!tutDone || tutStep >= 0 || localStorage.getItem(TUT_PURGE_KEY) || !st) return;
  if (st.discards !== 0 || !Array.isArray(st.hand) || st.hand.length < 4 || st.busy || (window.tlrStore?.getState?.()?.run?.ability?.targeting||st.abilitySelect) || st.purgeSelect !== null) return;
  const btn = document.querySelector('#purgeBtn');
  if (!btn || btn.disabled) return;
  queueTip(TUT_STEP.PURGE);
}

export function maybeShowArchivesTutorial() {
  if (localStorage.getItem(TUT_ARCHIVES_KEY)) return;
  queueTip(TUT_STEP.ARCHIVES, 260);
}

export function maybeShowMarketTutorial() {
  if (localStorage.getItem(TUT_MARKET_KEY)) return;
  queueTip(TUT_STEP.MARKET_RESERVE, 260);
}

export function maybeShowConstellationTutorial() {
  if (!tutDone || localStorage.getItem(TUT_CONSTELLATION_KEY)) return;
  const pill = document.querySelector('#constellationPill:not(.hidden)');
  if (!pill) return;
  queueTip(TUT_STEP.CONSTELLATION, hasPendingTip() ? 650 : 500);
}

function posTutTip(target, preferredArrow) {
  const tip = q('#tutTip');
  if (!tip || !isVisibleTarget(target)) return;

  const edge = 8;
  const gap = 14;
  const maxTipWidth = Math.min(300, window.innerWidth * 0.88);
  tip.style.maxWidth = maxTipWidth + 'px';
  tip.style.width = '';

  const targetRect = target.getBoundingClientRect();
  const measuredTip = tip.getBoundingClientRect();
  const tipWidth = Math.min(measuredTip.width || maxTipWidth, maxTipWidth);
  const tipHeight = measuredTip.height;
  const anchorX = targetRect.left + targetRect.width / 2;

  let left = anchorX - tipWidth / 2;
  left = Math.max(edge, Math.min(left, window.innerWidth - tipWidth - edge));

  const roomAbove = targetRect.top - gap - edge;
  const roomBelow = window.innerHeight - targetRect.bottom - gap - edge;
  let arrowDir = preferredArrow === 'down' ? 'down' : 'up';
  const wantsAbove = arrowDir === 'down';

  if (wantsAbove && roomAbove < tipHeight && roomBelow > roomAbove) arrowDir = 'up';
  if (!wantsAbove && roomBelow < tipHeight && roomAbove > roomBelow) arrowDir = 'down';

  let top = arrowDir === 'down'
    ? targetRect.top - gap - tipHeight
    : targetRect.bottom + gap;
  top = Math.max(edge, Math.min(top, window.innerHeight - tipHeight - edge));

  tip.style.left = left + 'px';
  tip.style.right = '';
  tip.style.top = top + 'px';
  tip.style.bottom = '';

  const arrow = tip.querySelector('.tut-arrow');
  if (!arrow) return;
  arrow.className = 'tut-arrow ' + arrowDir;
  const arrowX = anchorX - left;
  arrow.style.left = Math.max(16, Math.min(arrowX, tipWidth - 16)) + 'px';
}

window.addEventListener('resize', () => {
  if (tutStep < 0 || !activeTutTarget) return;
  requestAnimationFrame(positionActiveTip);
});

document.addEventListener('click', () => {
  if (Date.now() < tutIgnoreClicksUntil) return;
  tutNext();
});
