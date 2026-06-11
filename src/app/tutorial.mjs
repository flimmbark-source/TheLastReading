// Tutorial UI (Step 3d, Phase 16.4). Moved verbatim from index.html.
// Owns tutorial step state, show/hide logic, and the global click-to-advance
// listener. tutShow/tutHide/tutSkip/tutNext/replayTutorial are exported and
// installed on window by main.mjs so onclick attributes and inline script
// calls (continueReading, endSession) find them through the global env.
/* global $ */

const TUT_KEY = 'tlr_tut_done';
const TUT_PATTERN_KEY = 'tlr_tut_pattern';
const TUT_READING_KEY = 'tlr_tut_reading_complete';
const TUT_PURGE_KEY = 'tlr_tut_purge';
const INTRO_LAST_STEP = 5;

export const TUT_STEP = Object.freeze({
  INTRO: 0,
  SELECT_CARD: 1,
  PLACE_CARD: 2,
  SCORE_ADDED: 3,
  THRESHOLD: 4,
  DISCARD_ABILITY: 5,
  PATTERN_NOTICE: 6,
  PATTERN_SCORING: 7,
  THRESHOLD_PROGRESS: 8,
  RELIC: 9,
  PURGE: 10,
  READING_COMPLETE: 11,
});

let tutStep = -1;
let tutTimer = null;
let tutDone = !!localStorage.getItem(TUT_KEY);
let tutIgnoreClicksUntil = 0;
let queuedTipStep = null;

const TUT_STEPS = [
  {center:true, text:'Your relative left behind their tarot deck. You used to play this game together.'},
  {sel:'.handDock', arrow:'down', waitFor:'cardSelected', text:'Tap a card to select it.'},
  {sel:'#spread', arrow:'up', waitFor:'cardPlaced', text:'Tap an empty slot to place it.'},
  {sel:'.score-pill', arrow:'up', text:'That card added points to your total. The red circle on each card shows how many points it adds.'},
  {sel:'.threshold-pill', arrow:'up', text:'When the reading ends, your total is checked against the <b>Threshold</b>.'},
  {sel:'#discardBtn', arrow:'up', text:'<b>Discard</b> a card to use its <b>Ability</b> instead of placing it.'},
  {sel:'.handDock', arrow:'down', key:TUT_PATTERN_KEY, text:'Some of your cards may work together.'},
  {sel:'#scoringBtn', arrow:'up', key:TUT_PATTERN_KEY, text:'Check <b>Scoring</b> to see if you can complete a pattern.'},
  {center:true, key:'tlr_tut_shop', text:'Each cleared Threshold makes the next one harder. Clear the 10th Threshold to win.'},
  {sel:'#relicRack', arrow:'up', key:'tlr_tut_relic', text:'You\'ve found a <b>Relic</b>! Relics carry passive effects across every reading until you lose. Tap a relic icon to see what it does.'},
  {sel:'#purgeBtn', arrow:'up', key:TUT_PURGE_KEY, text:'Remove 3 cards from your hand to gain 1 Discard.'},
  {sel:'#spread', arrow:'up', key:TUT_READING_KEY, text:'One more card completes the reading.'},
];

function stepKey(step) {
  return TUT_STEPS[step]?.key || null;
}

function markStepSeen(step) {
  const key = stepKey(step);
  if (key) localStorage.setItem(key, '1');
}

function canShowStep(step, force = false) {
  const s = TUT_STEPS[step];
  if (!s) return false;
  if (!force && step <= INTRO_LAST_STEP && tutDone) return false;
  const key = stepKey(step);
  if (!force && key && localStorage.getItem(key)) return false;
  return true;
}

function finishIntro() {
  localStorage.setItem(TUT_KEY, '1');
  tutDone = true;
  tutHide();
}

function queueTip(step) {
  if (tutStep >= 0 || queuedTipStep !== null || !canShowStep(step)) return;
  queuedTipStep = step;
  setTimeout(() => {
    const next = queuedTipStep;
    queuedTipStep = null;
    if (next == null || tutStep >= 0 || !canShowStep(next)) return;
    tutShow(next);
  }, 180);
}

export function tutSkip(){
  markStepSeen(tutStep);
  localStorage.setItem(TUT_KEY,'1');
  tutDone=true;
  tutHide();
}

export function replayTutorial(){
  [
    'tlr_tut_done',
    'tlr_tut_relic',
    'tlr_tut_shop',
    'tlr_tut_inv_open',
    'tlr_tut_inv_name',
    'tlr_tut_inv_detail',
    TUT_PATTERN_KEY,
    TUT_READING_KEY,
    TUT_PURGE_KEY,
  ].forEach(k=>localStorage.removeItem(k));
  tutDone=false;
  const p=document.getElementById('settingsPanel');if(p)p.classList.add('hidden');
  const mw=document.getElementById('menuPullWrap');
  if(mw&&mw.classList.contains('open')){mw.classList.remove('open');const mt=document.getElementById('menuPullTab');if(mt)mt.innerHTML='&#9660; Menu';}
  tutShow(TUT_STEP.INTRO, {force:true});
}

export function tutHide(){clearTimeout(tutTimer);tutTimer=null;tutStep=-1;const t=$('#tutTip');if(t){t.classList.remove('show','tut-center');t.style.cssText=''}}

export function tutShow(step, options = {}){
  const force = !!options.force;
  if(!canShowStep(step, force))return;
  clearTimeout(tutTimer);tutTimer=null;
  tutStep=step;
  const s=TUT_STEPS[step];
  if(!s)return;
  const tip=$('#tutTip');
  tip.classList.remove('show','tut-center');
  tip.style.cssText='';
  $('#tutText').innerHTML=s.text;
  if(s.center){
    tip.classList.add('show','tut-center');
  } else {
    const target=document.querySelector(s.sel);
    if(!target){tutHide();return;}
    tip.classList.add('show');
    requestAnimationFrame(()=>posTutTip(target,s.arrow));
  }
}

export function tutNext(){
  if(tutStep<0)return;
  const s=TUT_STEPS[tutStep];
  if(!s)return;
  if(s.waitFor)return;

  if(tutStep<TUT_STEP.DISCARD_ABILITY){
    tutShow(tutStep+1);
    return;
  }

  if(tutStep===TUT_STEP.DISCARD_ABILITY){
    finishIntro();
    return;
  }

  if(tutStep===TUT_STEP.PATTERN_NOTICE){
    tutShow(TUT_STEP.PATTERN_SCORING);
    return;
  }

  markStepSeen(tutStep);
  tutHide();
}

export function tutSignal(eventName){
  if(tutStep<0)return;
  const s=TUT_STEPS[tutStep];
  if(!s || s.waitFor!==eventName)return;
  tutIgnoreClicksUntil=Date.now()+180;
  if(tutStep<TUT_STEP.DISCARD_ABILITY)tutShow(tutStep+1);
  else finishIntro();
}

function hasPatternOpportunity() {
  const st = window.state;
  if (!st || !Array.isArray(st.hand) || !st.hand.length || typeof window.cardHints !== 'function') return false;
  return st.hand.some(card => (window.cardHints(card) || []).some(h => h && (h.level === 'near' || h.level === 'complete')));
}

export function maybeShowPatternTutorial(){
  if(!tutDone || tutStep>=0 || localStorage.getItem(TUT_PATTERN_KEY))return;
  if(hasPatternOpportunity())queueTip(TUT_STEP.PATTERN_NOTICE);
}

export function maybeShowReadingCompletionTutorial(){
  const st = window.state;
  if(!tutDone || tutStep>=0 || localStorage.getItem(TUT_READING_KEY) || !st || !Array.isArray(st.spread))return;
  const placed = st.spread.filter(Boolean).length;
  if(placed===4)queueTip(TUT_STEP.READING_COMPLETE);
}

export function maybeShowPurgeTutorial(){
  const st = window.state;
  if(!tutDone || tutStep>=0 || localStorage.getItem(TUT_PURGE_KEY) || !st)return;
  if(st.discards!==0 || !Array.isArray(st.hand) || st.hand.length<4 || st.busy || st.abilitySelect || st.purgeSelect!==null)return;
  const btn=document.querySelector('#purgeBtn');
  if(!btn || btn.disabled)return;
  queueTip(TUT_STEP.PURGE);
}

function posTutTip(target,arrowDir){
  const tip=$('#tutTip');
  const tipW=Math.min(300,window.innerWidth*0.88);
  tip.style.maxWidth=tipW+'px';
  const r=target.getBoundingClientRect();
  const anchorX=r.left+r.width/2;
  let left=anchorX-tipW/2;
  left=Math.max(8,Math.min(left,window.innerWidth-tipW-8));
  tip.style.left=left+'px';
  tip.style.right='';
  if(arrowDir==='down'){tip.style.top='';tip.style.bottom=(window.innerHeight-r.top+14)+'px'}
  else{tip.style.top=(r.bottom+14)+'px';tip.style.bottom=''}
  const arrow=tip.querySelector('.tut-arrow');
  arrow.className='tut-arrow '+arrowDir;
  const arrowX=anchorX-left;
  arrow.style.left=Math.max(16,Math.min(arrowX,tipW-16))+'px';
  arrow.style.transform='translateX(-50%)';
}

document.addEventListener('click', () => {
  if(Date.now()<tutIgnoreClicksUntil)return;
  tutNext();
});