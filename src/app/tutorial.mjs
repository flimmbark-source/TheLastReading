// Tutorial UI (Step 3d, Phase 16.4). Moved verbatim from index.html.
// Owns tutorial step state, show/hide logic, and the global click-to-advance
// listener. tutShow/tutHide/tutSkip/tutNext/replayTutorial are exported and
// installed on window by main.mjs so onclick attributes and inline script
// calls (continueReading, endSession) find them through the global env.
/* global $ */

const TUT_KEY = 'tlr_tut_done';
let tutStep = -1, tutTimer = null, tutDone = !!localStorage.getItem(TUT_KEY);

const TUT_STEPS = [
  {center:true, text:'Your relative passed away recently, leaving behind their tarot deck. You used to play this game with them using it.'},
  {center:true, text:'Tap a card to select it, then tap an empty slot in the spread to score it.'},
  {sel:'.threshold-pill',arrow:'up',text:'Score enough points to beat the <b>Threshold</b>.'},
  {sel:'.handDock',arrow:'down',text:'Glowing cards form <b>potential</b> scoring patterns. Check <b>Scoring</b> to see what\'s possible, and use card <b>Abilities</b> to form a scoring pattern.'},
  {sel:'#discardBtn',arrow:'up',text:'<b>Discard</b> a card to use its <b>Ability</b> instead of scoring it, a way to reshape your hand before placing.'},
  {sel:'#purgeBtn',arrow:'up',text:'<b>Purge</b> lets you sacrifice 3 cards from your hand in exchange for 1 Discard, useful for clearing cards that don\'t fit your pattern.'},
  {sel:'.handDock',arrow:'down',text:'The red circle shows how much a card scores for. Tap a card to see potential scoring patterns for it.'},
  {sel:'#invTab',arrow:'up',text:'The <b>Archives</b> hold items discoved among the personal effects of your deceased relative. Tap to open and investigate.'},
  {sel:'#spread',arrow:'up',text:'Fill all 5 slots to complete a reading. Beat the <b>Threshold</b> to clear it. Fall short and the reading fails.'},
  {center:true, text:'Each time you reach a Threshold, it increases in difficulty. Beat the 10th Threshold to win.'},
  {sel:'#relicRack',arrow:'up', text:'You\'ve found a <b>Relic</b>! Relics carry powerful passive effects across every reading until you lose. Tap a relic icon to see what it does.'},
];

export function tutSkip(){localStorage.setItem(TUT_KEY,'1');tutDone=true;tutHide()}

export function replayTutorial(){
  ['tlr_tut_done','tlr_tut_relic','tlr_tut_shop','tlr_tut_inv_open','tlr_tut_inv_name','tlr_tut_inv_detail'].forEach(k=>localStorage.removeItem(k));
  tutDone=false;
  const p=document.getElementById('settingsPanel');if(p)p.classList.add('hidden');
  const mw=document.getElementById('menuPullWrap');
  if(mw&&mw.classList.contains('open')){mw.classList.remove('open');const mt=document.getElementById('menuPullTab');if(mt)mt.innerHTML='&#9660; Menu';}
  tutShow(0);
}

export function tutHide(){clearTimeout(tutTimer);tutTimer=null;tutStep=-1;const t=$('#tutTip');if(t){t.classList.remove('show','tut-center');t.style.cssText=''}}

export function tutShow(step){
  if(tutDone&&step<9)return;
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
    if(!target)return;
    tip.classList.add('show');
    requestAnimationFrame(()=>posTutTip(target,s.arrow));
  }
}

export function tutNext(){
  if(tutStep<0)return;
  if(tutStep===8){tutSkip();return}
  if(tutStep===9||tutStep===10){tutHide();return}
  tutShow(tutStep+1);
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

document.addEventListener('click', () => tutNext());
