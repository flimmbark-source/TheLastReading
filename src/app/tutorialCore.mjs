const TUT_KEY = 'tlr_tut_done';
const TUT_PATTERN_KEY = 'tlr_tut_pattern';
const TUT_READING_KEY = 'tlr_tut_reading_complete';
const TUT_PURGE_KEY = 'tlr_tut_purge';
const TUT_ARCHIVES_KEY = 'tlr_tut_archives_found';
const TUT_MARKET_KEY = 'tlr_tut_oracle_market';
const TUT_CONSTELLATION_KEY = 'tlr_tut_constellation';
const INTRO_LAST_STEP = 6;

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
});

let tutStep = -1;
let tutTimer = null;
let tutDone = !!localStorage.getItem(TUT_KEY);
let tutIgnoreClicksUntil = 0;
let queuedTipSteps = [];
let queuedTipTimer = null;

const TUT_STEPS = [
  { center: true, text: 'Your relative left behind their tarot deck. You used to play this game together.' },
  { sel: '.handDock', arrow: 'down', waitFor: 'cardSelected', text: 'Tap a card to select it.' },
  { sel: '#spread', arrow: 'up', waitFor: 'cardPlaced', text: 'Tap an empty slot to place it.' },
  { sel: '.score-pill', arrow: 'up', text: 'That card added points to your total.' },
  { sel: '#hand .card[data-uid]', arrow: 'down', text: 'The red circle on each card shows how many points it adds.' },
  { sel: '.threshold-pill', arrow: 'up', text: 'Try to beat the <b>Threshold</b> with your <b>Score</b> by the time you place 5 cards.' },
  { sel: '#discardBtn', arrow: 'up', text: '<b>Discard</b> a card to use its <b>Ability</b> instead of placing it.' },
  { sel: '#hand .card[data-hint], #hand .card.hint-complete, #hand .card.hint-card', fallbackSel: '.handDock', arrow: 'down', key: TUT_PATTERN_KEY, text: 'Some of your cards may work together.' },
  { center: true, text: 'Each cleared Threshold makes the next one harder. Clear the 10th Threshold to win.' },
  { sel: '#relicRack', arrow: 'up', text: 'You found a <b>Relic</b>. Relics carry passive effects across every reading until you lose. Tap a relic icon to see what it does.' },
  { sel: '#scoringPullTab', arrow: 'up', key: TUT_PATTERN_KEY, text: 'Check <b>Scoring</b> to see if you can complete a pattern. Place the cards down to activate a pattern.' },
  { sel: '#purgeBtn', arrow: 'up', key: TUT_PURGE_KEY, text: 'Remove 3 cards from your hand to gain 1 Discard.' },
  { sel: '#spread', arrow: 'up', key: TUT_READING_KEY, text: 'One more card completes the reading.' },
  { sel: '#invTab', arrow: 'up', key: TUT_ARCHIVES_KEY, text: 'The <b>Archives</b> hold discovered items. Tap to open and investigate.' },
  { sel: '.store-reserve-display', arrow: 'down', key: TUT_MARKET_KEY, text: '<b>Reserve</b><br>Your currency for upgrades in the Market.' },
  { sel: '.store-offer-row .store-card:nth-child(1)', arrow: 'down', key: TUT_MARKET_KEY, text: '<b>Scoring</b><br>Buy pattern upgrades. Chips and Mult increase by the amount shown.' },
  { sel: '.store-offer-row .store-card:nth-child(2)', arrow: 'down', key: TUT_MARKET_KEY, text: '<b>Pack</b><br>Open a pack to choose a hand, discard, draw, or ability upgrade.' },
  { sel: '.store-offer-row .store-card:nth-child(3)', arrow: 'up', key: TUT_MARKET_KEY, text: '<b>Relic</b><br>Buy a relic to add its passive effect to your relic row.' },
  { sel: '.store-refresh', arrow: 'up', key: TUT_MARKET_KEY, text: '<b>Refresh</b><br>Spend Reserve to replace the Market offers.' },
  { sel: '.store-proceed', arrow: 'up', key: TUT_MARKET_KEY, text: '<b>Next Reading</b><br>Leave the Market and start the next reading.' },
  { sel: '#constellationPill:not(.hidden)', arrow: 'up', key: TUT_CONSTELLATION_KEY, text: '<b>Constellation</b><br>A constellation changes this reading. Tap its sign to see the rule.' },
];

const MARKET_TUT_STEPS = [
  TUT_STEP.MARKET_RESERVE,
  TUT_STEP.MARKET_SCORING,
  TUT_STEP.MARKET_ABILITIES,
  TUT_STEP.MARKET_RELICS,
  TUT_STEP.MARKET_REFRESH,
  TUT_STEP.MARKET_NEXT,
];

function q(sel) { return document.querySelector(sel); }
function stepKey(step) { return TUT_STEPS[step] && TUT_STEPS[step].key ? TUT_STEPS[step].key : null; }
function markStepSeen(step) { const key = stepKey(step); if (key) localStorage.setItem(key, '1'); }
function targetForStep(s) { return document.querySelector(s.sel) || (s.fallbackSel ? document.querySelector(s.fallbackSel) : null); }

function canShowStep(step, force = false) {
  const s = TUT_STEPS[step];
  if (!s) return false;
  if (!force && step <= INTRO_LAST_STEP && tutDone) return false;
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

export function tutSkip() {
  markStepSeen(tutStep);
  localStorage.setItem(TUT_KEY, '1');
  tutDone = true;
  tutHide();
}

export function replayTutorial() {
  [
    TUT_KEY,
    'tlr_tut_relic',
    'tlr_tut_shop',
    'tlr_tut_inv_open',
    'tlr_tut_inv_name',
    'tlr_tut_inv_detail',
    TUT_PATTERN_KEY,
    TUT_READING_KEY,
    TUT_PURGE_KEY,
    TUT_ARCHIVES_KEY,
    TUT_MARKET_KEY,
    TUT_CONSTELLATION_KEY,
  ].forEach(k => localStorage.removeItem(k));
  queuedTipSteps = [];
  clearTimeout(queuedTipTimer);
  queuedTipTimer = null;
  tutDone = false;
  tutShow(TUT_STEP.INTRO, { force: true });
}

export function tutHide() {
  clearTimeout(tutTimer);
  tutTimer = null;
  tutStep = -1;
  const tip = q('#tutTip');
  if (!tip) return;
  tip.classList.remove('show', 'tut-center');
  tip.style.cssText = '';
}

export function tutShow(step, options = {}) {
  const force = !!options.force;
  if (!canShowStep(step, force)) return;
  clearTimeout(tutTimer);
  tutTimer = null;
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
    tip.classList.add('show', 'tut-center');
  } else {
    const target = targetForStep(s);
    if (!target) { tutHide(); scheduleQueuedTips(300); return; }
    tip.classList.add('show');
    requestAnimationFrame(() => posTutTip(target, s.arrow));
  }
}

export function tutNext() {
  if (tutStep < 0) return;
  const s = TUT_STEPS[tutStep];
  if (!s || s.waitFor) return;
  if (tutStep < TUT_STEP.DISCARD_ABILITY) { tutShow(tutStep + 1); return; }
  if (tutStep === TUT_STEP.DISCARD_ABILITY) { finishIntro(); scheduleQueuedTips(260); return; }
  if (tutStep === TUT_STEP.PATTERN_NOTICE) { tutShow(TUT_STEP.PATTERN_SCORING); return; }
  const marketIndex = MARKET_TUT_STEPS.indexOf(tutStep);
  if (marketIndex >= 0 && marketIndex < MARKET_TUT_STEPS.length - 1) {
    tutShow(MARKET_TUT_STEPS[marketIndex + 1]);
    return;
  }
  markStepSeen(tutStep);
  tutHide();
  scheduleQueuedTips(260);
}

export function tutSignal(eventName) {
  if (tutStep < 0) return;
  const s = TUT_STEPS[tutStep];
  if (!s || s.waitFor !== eventName) return;
  tutIgnoreClicksUntil = Date.now() + 180;
  if (tutStep < TUT_STEP.DISCARD_ABILITY) tutShow(tutStep + 1);
  else { finishIntro(); scheduleQueuedTips(260); }
}

function hasPatternOpportunity() {
  const st = window.state;
  if (!st || !Array.isArray(st.hand) || !st.hand.length || typeof window.cardHints !== 'function') return false;
  return st.hand.some(card => (window.cardHints(card) || []).some(h => h && (h.level === 'near' || h.level === 'complete')));
}

export function maybeShowPatternTutorial() {
  if (!tutDone || tutStep >= 0 || localStorage.getItem(TUT_PATTERN_KEY)) return;
  if (hasPatternOpportunity()) queueTip(TUT_STEP.PATTERN_NOTICE, 220);
}

export function maybeShowReadingCompletionTutorial() {
  const st = window.state;
  if (!tutDone || tutStep >= 0 || localStorage.getItem(TUT_READING_KEY) || !st || !Array.isArray(st.spread)) return;
  if (st.spread.filter(Boolean).length === 4) queueTip(TUT_STEP.READING_COMPLETE);
}

export function maybeShowPurgeTutorial() {
  const st = window.state;
  if (!tutDone || tutStep >= 0 || localStorage.getItem(TUT_PURGE_KEY) || !st) return;
  if (st.discards !== 0 || !Array.isArray(st.hand) || st.hand.length < 4 || st.busy || st.abilitySelect || st.purgeSelect !== null) return;
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
  if (!tutDone || hasPendingTip() || localStorage.getItem(TUT_CONSTELLATION_KEY)) return;
  const pill = document.querySelector('#constellationPill:not(.hidden)');
  if (!pill) return;
  queueTip(TUT_STEP.CONSTELLATION, 500);
}

function posTutTip(target, arrowDir) {
  const tip = q('#tutTip');
  if (!tip) return;
  const tipW = Math.min(300, window.innerWidth * 0.88);
  tip.style.maxWidth = tipW + 'px';
  const r = target.getBoundingClientRect();
  const anchorX = r.left + r.width / 2;
  let left = anchorX - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  tip.style.left = left + 'px';
  tip.style.right = '';
  if (arrowDir === 'down') {
    tip.style.top = '';
    tip.style.bottom = (window.innerHeight - r.top + 14) + 'px';
  } else {
    tip.style.top = (r.bottom + 14) + 'px';
    tip.style.bottom = '';
  }
  const arrow = tip.querySelector('.tut-arrow');
  if (!arrow) return;
  arrow.className = 'tut-arrow ' + arrowDir;
  const arrowX = anchorX - left;
  arrow.style.left = Math.max(16, Math.min(arrowX, tipW - 16)) + 'px';
}

document.addEventListener('click', () => {
  if (Date.now() < tutIgnoreClicksUntil) return;
  tutNext();
});