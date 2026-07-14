const TUT_KEY = 'tlr_tut_done';
const TUT_PATTERN_KEY = 'tlr_tut_pattern';
const TUT_PURGE_KEY = 'tlr_tut_purge';
const TUT_ARCHIVES_KEY = 'tlr_tut_archives_found';
const TUT_MARKET_KEY = 'tlr_tut_oracle_market';
const TUT_CONSTELLATION_KEY = 'tlr_tut_constellation';
const TUT_ABILITY_KEY = 'tlr_tut_ability';
const TUT_RELIC_KEY = 'tlr_tut_relic';
const TUT_HANDNAV_KEY = 'tlr_tut_hand_nav';
const TUT_ADVENTURE_KEY = 'tlr_tut_adventure';
const TUT_ADV_APPROACH_KEY = 'tlr_tut_adv_approach';
const TUT_ADV_APPROACH_CHAIN_KEY = 'tlr_tut_adv_approach_chain';
const TUT_ADV_APPROACH_GREAT_KEY = 'tlr_tut_adv_approach_great';
const TUT_ADV_REWARD_KEY = 'tlr_tut_adv_reward';
const TUT_ADV_ITEMS_KEY = 'tlr_tut_adv_items';
const TUT_ADV_COMPLETE_KEY = 'tlr_tut_adv_complete';

const TUT_STEPS = [
  // ─────────────────────────────────────────────
  // BASE GAME: FIRST READING
  // ─────────────────────────────────────────────

  // ── MANDATORY OPENING ──────────────────────────
  // Forced, exclusive first-run chain. No contextual tutorial interrupts while
  // any of these are active. Chips and Mult are deliberately NOT explained here;
  // they are introduced only when the player forms their first Pattern.

  {
    id: 'story-intro',
    center: true,
    text: 'Your relative left behind their tarot deck. You used to play this game together.',
  },

  {
    id: 'select-card',
    sel: '#hand .card[data-uid]',
    fallbackSel: '.handDock .hand',
    arrow: 'up',
    waitFor: 'cardSelected',
    text: 'Tap a card in your [[hand]].',
  },

  {
    id: 'play-card',
    sel: '#spread .slot.empty',
    fallbackSel: '#spread',
    arrow: 'down',
    waitFor: 'cardPlaced',
    text: 'Tap an empty slot to [[play]] it into the [[spread]].',
  },

  {
    id: 'reading-goal',
    sel: '#spread',
    fallbackSel: '.spread-wrap',
    arrow: 'up',
    text: 'Fill all 5 slots to complete the [[reading]]. Reach the [[threshold]] to continue.',
  },

  {
    id: 'patterns-intro',
    sel: '#scoringBtn',
    fallbackSel: '#scoringPullTab',
    arrow: 'up',
    waitFor: 'scoringOpened',
    text: 'Your cards can form [[pattern|Patterns]]. Open Scoring to see these [[pattern|Patterns]].',
  },

  {
    id: 'pattern-hints',
    sel: '#hintLevelBar',
    fallbackSel: '#settingsPanel',
    arrow: 'up',
    text: 'Control your [[pattern]] Hint level here.',
  },

  // ─────────────────────────────────────────────
  // CONTEXTUAL BASE-GAME SYSTEMS
  // Surfaced independently once each system becomes relevant; they do not form
  // another compulsory chain.
  // ─────────────────────────────────────────────

  {
    id: 'ability-flick',
    sel: '#hand .card[data-uid]',
    fallbackSel: '.handDock .hand',
    arrow: 'up',
    demo: 'flick',
    key: TUT_ABILITY_KEY,
    text: 'Use a card’s [[ability|Ability]] by flicking it. It is then [[discard|discarded]].',
  },

  {
    id: 'first-pattern',
    sel: '#current',
    fallbackSel: '.score-pill',
    arrow: 'up',
    key: TUT_PATTERN_KEY,
    text: 'You formed a [[pattern|Pattern]]. It added [[chips]] and [[mult]] to your [[score]].',
  },

  {
    id: 'first-pattern-formula',
    sel: '#current',
    fallbackSel: '.score-pill',
    arrow: 'up',
    key: TUT_PATTERN_KEY,
    text: '[[chips]] × [[mult]] determines your [[score]].',
  },

  {
    id: 'remove-cards',
    sel: '#purgeBtn',
    arrow: 'down',
    key: TUT_PURGE_KEY,
    text: 'With no [[discard_charge|Discards]] left, Remove Cards trades 3 cards from your [[hand]] for 1 [[discard_charge|Discard]].',
  },

  {
    id: 'market-visit',
    sel: '.store-reserve-display',
    fallbackSel: '.store-front',
    arrow: 'down',
    key: TUT_MARKET_KEY,
    text: 'Spend [[reserve]] on Scoring upgrades, Packs, and Relics.',
  },

  {
    id: 'constellation',
    sel: '#constellationPill:not(.hidden)',
    arrow: 'up',
    key: TUT_CONSTELLATION_KEY,
    text: 'A Constellation changes the current [[reading]]. Tap its sign to read the rule.',
  },

  {
    id: 'relic',
    sel: '#relicRack .relic-btn',
    fallbackSel: '#relicRack',
    arrow: 'up',
    key: TUT_RELIC_KEY,
    text: 'Relics grant passive effects. Tap a [[relic|Relic]] to read its rule.',
  },

  {
    id: 'archives',
    sel: '#spv2ArchiveBtn',
    fallbackSel: '#invTab',
    arrow: 'up',
    key: TUT_ARCHIVES_KEY,
    text: 'Discovered items and clues are stored in the Archives.',
  },

  {
    id: 'hand-nav',
    sel: '#handSwipeZone',
    fallbackSel: '.handDock',
    arrow: 'up',
    waitFor: 'handScrolled',
    key: TUT_HANDNAV_KEY,
    text: 'Swipe to move through your [[hand]].',
  },

  // ─────────────────────────────────────────────
  // ADVENTURE MODE
  // ─────────────────────────────────────────────

  {
    id: 'adventure-intro',
    center: true,
    text: 'In Adventure Mode, [[play]] 1 card to resolve each [[event]].',
  },

  {
    id: 'adventure-event',
    sel: '#advEventDeck .adv-event-hero',
    fallbackSel: '#advEventDeck',
    arrow: 'up',
    text: 'The [[event]] shows which [[approach|Approaches]] it accepts.',
  },

  {
    id: 'adventure-approach',
    sel: '#hand .card[data-uid] .adv-sigil-seal',
    fallbackSel: '#hand .card[data-uid]',
    arrow: 'down',
    text: 'The sigil shows the card’s [[approach]].',
  },

  {
    id: 'adventure-potency',
    sel: '#hand .card[data-uid] .seal.tr',
    fallbackSel: '#hand .card[data-uid]',
    arrow: 'down',
    text: 'The red number is the card’s [[potency]].',
  },

  {
    id: 'adventure-approach-map',
    sel: '#scoringBtn',
    fallbackSel: '#scoringPullTab',
    arrow: 'up',
    key: TUT_ADV_APPROACH_KEY,
    text: 'Open the approach map to preview the nearest accepted [[approach]] for each card.',
  },

  {
    id: 'adventure-play-card',
    sel: '#spread .slot.empty',
    fallbackSel: '#spread',
    arrow: 'up',
    waitFor: 'advCardPlaced',
    text: 'Choose a card and [[play]] it to face the [[event]].',
  },

  {
    id: 'adventure-resolve',
    sel: '#advHud .adv-hud__main',
    fallbackSel: '#advHud',
    arrow: 'up',
    text: 'Failure can cost [[resolve]]. The run ends at 0.',
  },

  {
    id: 'adventure-difficulty',
    center: true,
    key: TUT_ADV_APPROACH_CHAIN_KEY,
    text: 'Each accepted [[approach]] has a hidden difficulty. Your [[potency]] must meet it.',
  },

  {
    id: 'adventure-great-success',
    center: true,
    key: TUT_ADV_APPROACH_GREAT_KEY,
    text: 'Matching the [[event]]’s exact [[approach]] can produce a Great Success and stronger rewards.',
  },

  {
    id: 'adventure-reward',
    sel: '.adv-rewards',
    fallbackSel: '.result-panel',
    arrow: 'up',
    key: TUT_ADV_REWARD_KEY,
    text: 'After a Success, [[choose]] a reward to shape the run.',
  },

  {
    id: 'adventure-items',
    sel: '#relicRack',
    arrow: 'up',
    key: TUT_ADV_ITEMS_KEY,
    text: 'Adventure items are carried here. Tap a Consumable to use it.',
  },

  {
    id: 'adventure-complete',
    center: true,
    key: TUT_ADV_COMPLETE_KEY,
    text: 'Set complete. Finish 1 more Set to win the Adventure.',
  },
];

// Steps are addressed by their stable `id`, never by array position, so they can
// be inserted, removed, or reordered without silently rerouting the flow or
// invalidating saved progress. STEP_INDEX only backs "the next step in reading
// order" for the linear walk-throughs; it is never persisted or branched on.
const STEP_INDEX = new Map(TUT_STEPS.map((step, index) => [step.id, index]));
function stepById(id) { const i = STEP_INDEX.get(id); return i === undefined ? null : TUT_STEPS[i]; }
function nextStepId(id) {
  const i = STEP_INDEX.get(id);
  return i === undefined || i + 1 >= TUT_STEPS.length ? null : TUT_STEPS[i + 1].id;
}

// Semantic names for the steps the flow logic references by id.
export const TUT_STEP = Object.freeze({
  INTRO: 'story-intro',
  SELECT_CARD: 'select-card',
  PLACE_CARD: 'play-card',
  READING_GOAL: 'reading-goal',
  PATTERNS_INTRO: 'patterns-intro',
  HINT_SETTING: 'pattern-hints',
  ABILITY_FLICK: 'ability-flick',
  FIRST_PATTERN: 'first-pattern',
  FIRST_PATTERN_FORMULA: 'first-pattern-formula',
  RELIC: 'relic',
  PURGE: 'remove-cards',
  ARCHIVES: 'archives',
  MARKET: 'market-visit',
  CONSTELLATION: 'constellation',
  HAND_NAV: 'hand-nav',
  ADVENTURE_INTRO: 'adventure-intro',
  ADVENTURE_EVENT: 'adventure-event',
  ADVENTURE_SIGIL: 'adventure-approach',
  ADVENTURE_POTENCY: 'adventure-potency',
  ADVENTURE_APPROACH_MAP: 'adventure-approach-map',
  ADVENTURE_PLACE: 'adventure-play-card',
  ADVENTURE_RESOLVE: 'adventure-resolve',
  ADVENTURE_DIFFICULTY: 'adventure-difficulty',
  ADVENTURE_GREAT: 'adventure-great-success',
  ADVENTURE_REWARD: 'adventure-reward',
  ADVENTURE_ITEMS: 'adventure-items',
  ADVENTURE_COMPLETE: 'adventure-complete',
});

// The forced first-run onboarding steps: hidden once the intro is complete.
// This is the full mandatory opening chain; no contextual tip interrupts while
// any of these is active.
const INTRO_STEP_IDS = new Set([
  TUT_STEP.INTRO,
  TUT_STEP.SELECT_CARD,
  TUT_STEP.PLACE_CARD,
  TUT_STEP.READING_GOAL,
  TUT_STEP.PATTERNS_INTRO,
  TUT_STEP.HINT_SETTING,
]);
// The linear Adventure walk-through (tap/place to advance, one after another).
// The remaining adventure-* steps are contextual tips surfaced by signals.
const ADVENTURE_WALKTHROUGH_IDS = new Set([
  TUT_STEP.ADVENTURE_INTRO,
  TUT_STEP.ADVENTURE_EVENT,
  TUT_STEP.ADVENTURE_SIGIL,
  TUT_STEP.ADVENTURE_POTENCY,
  TUT_STEP.ADVENTURE_APPROACH_MAP,
  TUT_STEP.ADVENTURE_PLACE,
  TUT_STEP.ADVENTURE_RESOLVE,
]);
const ADVENTURE_WALKTHROUGH_LAST = TUT_STEP.ADVENTURE_RESOLVE;

// Set true after the player opens Scoring during the patterns-intro step; the
// Pattern Hint tip then waits for Scoring to close before pointing at the menu.
let awaitingScoringClose = false;

let tutStep = null;
let tutTimer = null;
let tutDone = !!localStorage.getItem(TUT_KEY);
let tutIgnoreClicksUntil = 0;
let queuedTipSteps = [];
let queuedTipTimer = null;
let activeTutTarget = null;
let activeTutArrow = 'up';
let tutPositionTimer = null;

function q(sel) { return document.querySelector(sel); }
function stepKey(id) { const s = stepById(id); return s && s.key ? s.key : null; }
function markStepSeen(id) { const key = stepKey(id); if (key) localStorage.setItem(key, '1'); }
function isAdventureTutorialStep(id) { return ADVENTURE_WALKTHROUGH_IDS.has(id); }

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
  const s = stepById(step);
  if (!s) return false;
  if (!force && INTRO_STEP_IDS.has(step) && tutDone) return false;
  if (!force && isAdventureTutorialStep(step) && localStorage.getItem(TUT_ADVENTURE_KEY)) return false;
  const key = stepKey(step);
  if (!force && key && localStorage.getItem(key)) return false;
  return true;
}

function hasPendingTip() {
  return tutStep !== null || queuedTipSteps.length > 0 || !!queuedTipTimer;
}

function finishIntro() {
  localStorage.setItem(TUT_KEY, '1');
  tutDone = true;
  window.dispatchEvent(new CustomEvent('tlr:tutorial-complete', { detail: { step: tutStep } }));
  tutHide();
}

// Temporary conditions are rechecked at display time, not just when queued: a
// tip whose triggering game state has since changed is dropped, never shown
// stale. Persistent discoveries (no live condition) always return true.
function stillValidAtShowTime(step) {
  if (step === TUT_STEP.PURGE) {
    const st = window.state;
    if (!st || st.discards !== 0 || !Array.isArray(st.hand) || st.hand.length < 4) return false;
    const btn = document.querySelector('#purgeBtn');
    return !!btn && !btn.disabled;
  }
  if (step === TUT_STEP.CONSTELLATION) return !!document.querySelector('#constellationPill:not(.hidden)');
  return true;
}

function scheduleQueuedTips(delay = 180) {
  clearTimeout(queuedTipTimer);
  queuedTipTimer = setTimeout(() => {
    queuedTipTimer = null;
    if (tutStep !== null) { scheduleQueuedTips(450); return; }
    while (queuedTipSteps.length) {
      const next = queuedTipSteps.shift();
      if (!canShowStep(next) || !stillValidAtShowTime(next)) continue;
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

// Every base-game contextual tip key. Skip Tutorial marks them all seen so no
// further instructional prompt appears (normal game feedback still shows).
const BASE_CONTEXTUAL_KEYS = [
  TUT_ABILITY_KEY, TUT_PATTERN_KEY, TUT_PURGE_KEY, TUT_MARKET_KEY,
  TUT_CONSTELLATION_KEY, TUT_RELIC_KEY, TUT_ARCHIVES_KEY, TUT_HANDNAV_KEY,
];

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
  // Suppress all remaining instructional prompts, opening and contextual alike.
  BASE_CONTEXTUAL_KEYS.forEach(key => localStorage.setItem(key, '1'));
  queuedTipSteps = [];
  clearTimeout(queuedTipTimer);
  queuedTipTimer = null;
  awaitingScoringClose = false;
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
    TUT_RELIC_KEY,
    'tlr_tut_inv_open',
    'tlr_tut_inv_name',
    'tlr_tut_inv_detail',
    TUT_PATTERN_KEY,
    TUT_ABILITY_KEY,
    TUT_PURGE_KEY,
    TUT_ARCHIVES_KEY,
    TUT_MARKET_KEY,
    TUT_CONSTELLATION_KEY,
    TUT_HANDNAV_KEY,
  ].forEach(k => localStorage.removeItem(k));
  queuedTipSteps = [];
  clearTimeout(queuedTipTimer);
  queuedTipTimer = null;
  awaitingScoringClose = false;
  tutDone = false;
  tutShow(TUT_STEP.INTRO, { force: true });
}

export function tutHide() {
  clearTimeout(tutTimer);
  clearTimeout(tutPositionTimer);
  tutTimer = null;
  tutPositionTimer = null;
  tutStep = null;
  activeTutTarget = null;
  const tip = q('#tutTip');
  if (!tip) return;
  tip.classList.remove('show', 'tut-center', 'tut-demo-flick');
  tip.style.cssText = '';
}

export function tutResetTransient() {
  queuedTipSteps = [];
  clearTimeout(queuedTipTimer);
  queuedTipTimer = null;
  tutHide();
}

function positionActiveTip() {
  if (tutStep === null || !activeTutTarget) return;
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
  window.dispatchEvent(new CustomEvent('tlr:tutorial-step', { detail: { step } }));
  tutIgnoreClicksUntil = Date.now() + (step === TUT_STEP.FIRST_PATTERN ? 450 : 180);
  const s = stepById(step);
  if (!s) return;
  const tip = q('#tutTip');
  const text = q('#tutText');
  if (!tip || !text) return;
  tip.classList.remove('show', 'tut-center', 'tut-demo-flick');
  tip.style.cssText = '';
  // A looping visual demonstration of the flick gesture accompanies the ability
  // tip. The class drives the animation from tutTip.css; it never blocks input.
  if (s.demo === 'flick') tip.classList.add('tut-demo-flick');
  // The settings drawer opens above nearly everything (menuPullWrap.open is
  // z-index 2147483250, see drawers.css) so it can never be covered by the
  // table underneath it. This is the one step that points at something
  // inside that drawer, so it alone needs to outrank it; every other step
  // keeps the tip's normal stacking position (cssText reset above clears
  // this for the next tutShow call regardless of which step follows).
  if (step === TUT_STEP.HINT_SETTING) tip.style.setProperty('z-index', '2147483300', 'important');
  text.innerHTML = s.text;
  window.tlrApplyGameTerms?.(text, { auto: true });
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

// The hint-level control lives inside the settings drawer, which is hidden
// (visibility:hidden!important on its content, per drawers.css) until
// #menuPullWrap gets .open. Both helpers check the drawer's own open state
// first so they're idempotent regardless of what the player already had
// open, and fall back to the pre-drawer #settingsPanel.hidden toggle for
// any host page that hasn't installed the gesture-drawer system.
function openHintSettingsMenu() {
  const wrap = q('#menuPullWrap');
  if (wrap) {
    if (!wrap.classList.contains('open') && typeof window.tlrTogglePullTab === 'function') window.tlrTogglePullTab('menu');
    return;
  }
  q('#settingsPanel')?.classList.remove('hidden');
}

function closeHintSettingsMenu() {
  const wrap = q('#menuPullWrap');
  if (wrap) {
    if (wrap.classList.contains('open') && typeof window.tlrTogglePullTab === 'function') window.tlrTogglePullTab('menu');
    return;
  }
  q('#settingsPanel')?.classList.add('hidden');
}

// Mandatory onboarding is done. Persist completion and, once the hand is back
// in normal play, introduce the flick ability.
function completeIntro() {
  finishIntro();
  queuePriorityTip(TUT_STEP.ABILITY_FLICK, 320);
}

export function tutNext() {
  if (tutStep === null) return;
  const s = stepById(tutStep);
  // waitFor steps (select-card, play-card, patterns-intro, hand-nav) advance
  // only when their action succeeds, never on a stray tap.
  if (!s || s.waitFor) return;
  if (isAdventureTutorialStep(tutStep)) {
    if (tutStep !== ADVENTURE_WALKTHROUGH_LAST) {
      tutShow(nextStepId(tutStep), { force: true });
    } else {
      localStorage.setItem(TUT_ADVENTURE_KEY, '1');
      tutHide();
    }
    return;
  }
  // ── Mandatory opening (tap-advanced links) ──
  if (tutStep === TUT_STEP.INTRO) { tutShow(TUT_STEP.SELECT_CARD); return; }
  if (tutStep === TUT_STEP.READING_GOAL) { tutShow(TUT_STEP.PATTERNS_INTRO); return; }
  if (tutStep === TUT_STEP.HINT_SETTING) {
    // Final onboarding step. The player need not change the setting; tapping
    // closes the menu and ends the forced chain.
    closeHintSettingsMenu();
    completeIntro();
    return;
  }
  // ── Contextual: First Pattern is a two-beat message ──
  if (tutStep === TUT_STEP.FIRST_PATTERN) { tutShow(TUT_STEP.FIRST_PATTERN_FORMULA, { force: true }); return; }
  // Every other contextual tip is single-tap dismiss.
  markStepSeen(tutStep);
  tutHide();
  scheduleQueuedTips(260);
}

function onPlacement() {
  if (window.__tlrAdventureActive) return;
  // The flick ability tip belongs to normal play, once onboarding is complete.
  if (!tutDone || localStorage.getItem(TUT_ABILITY_KEY)) return;
  queuePriorityTip(TUT_STEP.ABILITY_FLICK, 320);
}

// A real scoring Pattern just formed: introduce Chips and Mult, tied to
// something the player has just caused and observed. Not triggered by a
// possible pattern, a hint, opening Scoring, or a mere placement.
function onPatternFormed() {
  if (window.__tlrAdventureActive) return;
  // Opening exclusivity: never interrupt the mandatory chain. If the first
  // Pattern forms during onboarding, Chips/Mult are taught on the next one.
  if (!tutDone || localStorage.getItem(TUT_PATTERN_KEY)) return;
  queueTip(TUT_STEP.FIRST_PATTERN, 400);
}

// Opening Scoring advances the patterns-intro step. Hide the tip so the Scoring
// sheet is readable, then wait for it to close before pointing at Pattern Hints.
function onScoringOpened() {
  if (tutStep !== TUT_STEP.PATTERNS_INTRO) return;
  awaitingScoringClose = true;
  tutHide();
}

function onScoringClosed() {
  if (!awaitingScoringClose) return;
  awaitingScoringClose = false;
  clearTimeout(tutTimer);
  // Deferred a tick so menuControls' outside-click handler (bound after this
  // module's) doesn't treat the opening tap as an outside click that would
  // immediately re-close the drawer we are about to open.
  tutTimer = setTimeout(() => {
    openHintSettingsMenu();
    tutTimer = setTimeout(() => tutShow(TUT_STEP.HINT_SETTING, { force: true }), 480);
  }, 0);
}

// Interface hint completion: only a real horizontal hand move counts, never a
// tap or selection. Mark it seen regardless of whether the tip was showing so
// it never nags a player who already swipes.
function onHandScrolled() {
  if (localStorage.getItem(TUT_HANDNAV_KEY)) return;
  localStorage.setItem(TUT_HANDNAV_KEY, '1');
  queuedTipSteps = queuedTipSteps.filter(step => step !== TUT_STEP.HAND_NAV);
  if (tutStep === TUT_STEP.HAND_NAV) { tutHide(); scheduleQueuedTips(260); }
}

export function tutSignal(eventName) {
  if (eventName === 'cardPlaced') onPlacement();
  if (eventName === 'patternFormed') { onPatternFormed(); return; }
  if (eventName === 'scoringOpened') { onScoringOpened(); return; }
  if (eventName === 'scoringClosed') { onScoringClosed(); return; }
  if (eventName === 'handScrolled') { onHandScrolled(); return; }
  if (eventName === 'advApproachWebOpened') { queueTip(TUT_STEP.ADVENTURE_DIFFICULTY, 300); queueTip(TUT_STEP.ADVENTURE_GREAT, 300); return; }
  if (eventName === 'advRewardShown') { queueTip(TUT_STEP.ADVENTURE_REWARD, 350); return; }
  if (eventName === 'advItemGained') { queueTip(TUT_STEP.ADVENTURE_ITEMS, 350); return; }
  if (eventName === 'advSetComplete') { queueTip(TUT_STEP.ADVENTURE_COMPLETE, 350); return; }
  if (tutStep === null) return;
  const s = stepById(tutStep);
  if (!s || s.waitFor !== eventName) return;
  tutIgnoreClicksUntil = Date.now() + 180;
  if (isAdventureTutorialStep(tutStep)) {
    if (tutStep !== ADVENTURE_WALKTHROUGH_LAST) { tutShow(nextStepId(tutStep), { force: true }); }
    else { localStorage.setItem(TUT_ADVENTURE_KEY, '1'); tutHide(); }
    return;
  }
  // cardSelected (SELECT_CARD) and cardPlaced (PLACE_CARD) advance in reading
  // order: select-card -> play-card -> reading-goal, the first tap-advanced step.
  if (tutStep === TUT_STEP.SELECT_CARD || tutStep === TUT_STEP.PLACE_CARD) { tutShow(nextStepId(tutStep)); return; }
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
  if (!tutDone || tutStep !== null || localStorage.getItem(TUT_PURGE_KEY) || !st) return;
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
  queueTip(TUT_STEP.MARKET, 260);
}

export function maybeShowConstellationTutorial() {
  if (!tutDone || localStorage.getItem(TUT_CONSTELLATION_KEY)) return;
  const pill = document.querySelector('#constellationPill:not(.hidden)');
  if (!pill) return;
  queueTip(TUT_STEP.CONSTELLATION, hasPendingTip() ? 650 : 500);
}

// Interface hint: shown only with touch controls when the Hand actually
// overflows the readable area. Completed by tutSignal('handScrolled').
export function maybeShowHandNavTutorial() {
  if (!tutDone || localStorage.getItem(TUT_HANDNAV_KEY)) return;
  // Touch only: a mouse/keyboard player is not being taught a swipe gesture.
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return;
  const zone = document.querySelector('#handSwipeZone');
  // The swipe zone marks its own overflow state (see gestureHand.mjs).
  if (!zone || !zone.classList.contains('has-overflow')) return;
  queueTip(TUT_STEP.HAND_NAV, hasPendingTip() ? 650 : 500);
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
  if (tutStep === null || !activeTutTarget) return;
  requestAnimationFrame(positionActiveTip);
});

document.addEventListener('click', event => {
  if (Date.now() < tutIgnoreClicksUntil) return;
  // Tapping a highlighted game term (or its definition popover/glossary) opens
  // an explanation; it must not also advance the current tutorial step.
  const el = event.target instanceof Element ? event.target : null;
  if (el && el.closest('.game-term, .game-term-popover, .game-terms-glossary')) return;
  // On the Pattern Hint step, tapping the hint-level control changes the setting
  // in place; the player advances by tapping elsewhere, not by adjusting it.
  if (tutStep === TUT_STEP.HINT_SETTING && el && el.closest('#hintLevelBar')) return;
  tutNext();
});
