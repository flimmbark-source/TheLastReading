// Table renderer / orchestrator (Phase 15.1). Moved verbatim from
// index.html: render() drives the bars, spread, hand, prompts, and preview;
// refreshHandState() is the cheap selection-only repaint. Hot DOM elements
// are cached in the legacy global _el* bindings (snapCounter shares them).
/* global state, persist, TH, $, _cachedPlacedScore, _hintsKey, _hintsCacheKey, _hintsCache, _unlockedFragmentsCache, _spreadScoreForHints, _resStateKey, _getPlacedScore, applyResonationGlows, _scoreLegacy, hasMull, maxHand, tlrArchitectureSync, _elThreshold, _elPool, _elDiscards, _elDiscardBtn, _elPurgeBtn, _elMullBtn, _elHand, _elCurrent */
import { renderSpread } from './renderSpread.mjs';
import { renderHand } from './renderHand.mjs';
import { renderAbilityPrompt, renderPurgePrompt } from './renderAbility.mjs';
import { renderRelicRack } from './renderMarket.mjs';
import { cleanName } from './renderCard.mjs';
import { getConstellation, constellationThreshold, blocksDiscard, hasActiveConstellation as runHasActiveConstellation } from '../systems/constellations.mjs';

let constellationCalloutOpen=false;
let constellationOutsideHandlerInstalled=false;

function maybeShowContextualTutorials(){
  if(typeof window.maybeShowPatternTutorial==='function')window.maybeShowPatternTutorial();
  if(typeof window.maybeShowReadingCompletionTutorial==='function')window.maybeShowReadingCompletionTutorial();
  if(typeof window.maybeShowPurgeTutorial==='function')window.maybeShowPurgeTutorial();
}

export function _cacheEls(){
  if(_elThreshold)return;
  _elThreshold=document.getElementById('threshold');
  _elPool=document.getElementById('pool');
  _elDiscards=document.getElementById('discards');
  _elDiscardBtn=document.getElementById('discardBtn');
  _elPurgeBtn=document.getElementById('purgeBtn');
  _elMullBtn=document.getElementById('mullBtn');
  _elHand=document.getElementById('hand');
  _elCurrent=document.getElementById('current');
}

function currentRun(){return window.tlrStore?.getState?.().run || state}
function activeThreshold(){const run=currentRun();return constellationThreshold(TH[state.th]+(state.thBonus||0),run)}
function discardBlocked(){return blocksDiscard(currentRun())}
function ensureConstellationPill(){let el=document.getElementById('constellationPill');if(el)return el;el=document.createElement('button');el.type='button';el.id='constellationPill';el.className='constellation-pill hidden';document.body.appendChild(el);return el}
function escapeHTML(value){return String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}
function activeConstellationId(){const run=currentRun();return runHasActiveConstellation(run)?run.constellationId:null}
function constellationSpriteStyle(c){const s=c?.sprite;if(!s)return'';const cols=s.cols||4,rows=s.rows||3;const x=cols<=1?0:(s.col/(cols-1))*100;const y=rows<=1?0:(s.row/(rows-1))*100;return`--constellation-img:url('${s.image}');--constellation-bg-size:${cols*100}% ${rows*100}%;--constellation-bg-x:${x}%;--constellation-bg-y:${y}%;`}
function constellationIconHTML(c,extraClass=''){if(c?.sprite)return`<span class="constellation-sprite ${extraClass}" aria-hidden="true" style="${constellationSpriteStyle(c)}"></span>`;return''}
function closeConstellationCallout(){constellationCalloutOpen=false;const el=document.getElementById('constellationPill');if(el)el.classList.remove('open');const callout=document.getElementById('constellationCallout');if(callout)callout.remove()}
function hideConstellationPill(el){el.classList.add('hidden');el.innerHTML='';closeConstellationCallout()}
function positionConstellationIcon(el){if(window.innerWidth>640){el.style.left='';el.style.top='';el.style.right='';el.style.transform='';return}requestAnimationFrame(()=>{const reserve=document.querySelector('.reserve-pill');const discards=document.querySelector('.discards-pill');if(!reserve||!discards)return;const a=reserve.getBoundingClientRect();const b=discards.getBoundingClientRect();const leftPill=a.left<=b.left?a:b;const rightPill=a.left<=b.left?b:a;const gapCenter=(leftPill.right+rightPill.left)/2;const sameRow=Math.abs((a.top+a.height/2)-(b.top+b.height/2))<18;const fallbackX=(a.left+a.width/2+b.left+b.width/2)/2;const x=sameRow&&rightPill.left>leftPill.right?gapCenter:fallbackX;const y=(a.top+a.height/2+b.top+b.height/2)/2;el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px';el.style.right='auto';el.style.transform='translate(-50%,-50%)'})}
function positionConstellationCallout(callout,anchor){const rect=anchor.getBoundingClientRect();const margin=8;callout.style.left='0px';callout.style.top='0px';requestAnimationFrame(()=>{const w=callout.offsetWidth;const h=callout.offsetHeight;let left=rect.left+rect.width+8;let top=rect.top+rect.height/2-h/2;if(left+w>window.innerWidth-margin)left=rect.left-w-8;if(window.innerWidth<=640){left=rect.left+rect.width/2-w/2;top=rect.bottom+8}left=Math.max(margin,Math.min(window.innerWidth-w-margin,left));top=Math.max(margin,Math.min(window.innerHeight-h-margin,top));callout.style.left=left+'px';callout.style.top=top+'px'})}
function showConstellationCallout(anchor,constellation,setText,scoreText){closeConstellationCallout();constellationCalloutOpen=true;anchor.classList.add('open');const callout=document.createElement('div');callout.id='constellationCallout';callout.className='constellation-callout';callout.innerHTML=`${constellationIconHTML(constellation,'large')}<div class="constellation-callout-copy"><div class="constellation-callout-kicker">Constellation · ${escapeHTML(setText)} · ${escapeHTML(scoreText)}</div><div class="constellation-callout-title">${escapeHTML(constellation.name)}</div><div class="constellation-callout-rule">${escapeHTML(constellation.rule)}</div></div>`;document.body.appendChild(callout);positionConstellationCallout(callout,anchor)}
function installConstellationOutsideHandler(){if(constellationOutsideHandlerInstalled)return;constellationOutsideHandlerInstalled=true;document.addEventListener('pointerdown',event=>{if(!constellationCalloutOpen)return;const pill=document.getElementById('constellationPill');const callout=document.getElementById('constellationCallout');if(pill&&pill.contains(event.target))return;if(callout&&callout.contains(event.target))return;closeConstellationCallout()},true);window.addEventListener('resize',()=>{closeConstellationCallout();const el=document.getElementById('constellationPill');if(el&&!el.classList.contains('hidden'))positionConstellationIcon(el)})}
function renderConstellationPill(){installConstellationOutsideHandler();const el=ensureConstellationPill();const constellationId=activeConstellationId();if(!constellationId)return hideConstellationPill(el);const constellation=getConstellation(constellationId);if(!constellation||!constellation.sprite)return hideConstellationPill(el);const run=currentRun();const setText='Set '+((run.setIndex||0)+1)+'/'+(run.setsPerRound||2);const scoreText='Round '+(run.roundScore||0)+'/'+activeThreshold();el.classList.remove('hidden');el.setAttribute('aria-label',`${constellation.name}. ${constellation.shortRule||constellation.rule}`);el.innerHTML=constellationIconHTML(constellation);positionConstellationIcon(el);el.onclick=event=>{event.stopPropagation();if(constellationCalloutOpen)closeConstellationCallout();else showConstellationCallout(el,constellation,setText,scoreText)}}

export function render(){
  _cachedPlacedScore=null; // invalidate on every render
  const _newHintsKey=_hintsKey();if(_newHintsKey!==_hintsCacheKey){_hintsCache.clear();_hintsCacheKey=_newHintsKey;_unlockedFragmentsCache=null;_spreadScoreForHints=null;}
  _cacheEls();
  _elThreshold.textContent=activeThreshold();
  const _thNext=document.getElementById('thNext');if(_thNext){const _p=state.thBonusPending||0;_thNext.style.display=_p?'':'none';if(_p)_thNext.textContent='+'+_p+' next';}
  _elPool.textContent=persist.pool;
  _elDiscards.textContent=state.discards;
  renderConstellationPill();
  renderRelicRack();
  const now=_getPlacedScore();
  const ability=state.abilitySelect;
  const inPurge=state.purgeSelect!==null;
  renderSpread(ability,inPurge);
  _resStateKey=null;
  applyResonationGlows(state.spread);
  renderHand(ability,inPurge);
  renderAbilityPrompt();
  renderPurgePrompt();
  updateScorePreview(now);
  _elDiscardBtn.disabled=state.selected===null||state.discards<=0||inPurge||discardBlocked();
  _elDiscardBtn.title=discardBlocked()?'Place 2 cards before discarding.':'';
  _elPurgeBtn.disabled=state.busy||state.hand.length<3||!!state.abilitySelect||inPurge;
  _elMullBtn.style.display=hasMull()?'inline-block':'none';
  _elMullBtn.disabled=!(state.mullCharges>0)||!state.spread.every(x=>!x)||state.hand.length!==maxHand();
  tlrArchitectureSync();
  maybeShowContextualTutorials();
}

export function refreshHandState(){
  _cacheEls();
  const ability=state.abilitySelect;
  const inPurge=state.purgeSelect!==null;
  document.querySelectorAll('#hand .card').forEach(el=>{
    const uid=Number(el.dataset.uid);
    el.classList.toggle('sel',!ability&&!inPurge&&state.selected===uid);
    if(ability){const isPicked=ability.picked.includes(uid);el.classList.toggle('ability-picked',isPicked);el.classList.toggle('ability-target',!isPicked&&ability.validIds.has(uid));}
    if(inPurge){el.classList.toggle('purge-picked',state.purgeSelect.includes(uid));el.classList.toggle('purge-target',!state.purgeSelect.includes(uid));}
  });
  document.querySelectorAll('#spread .slot').forEach(slot=>{
    const el=slot.querySelector('.card[data-uid]');
    if(!el)return;
    const uid=Number(el.dataset.uid);
    if(ability){const isValid=ability.validIds.has(uid);const isPicked=isValid&&ability.picked.includes(uid);el.classList.toggle('ability-picked',isPicked);el.classList.toggle('ability-target',isValid&&!isPicked);el.classList.toggle('ability-disabled',!isValid);slot.classList.toggle('ability-target-slot',isValid&&!isPicked);slot.classList.toggle('ability-picked-slot',isPicked);slot.classList.toggle('ability-disabled-slot',!isValid);}else{el.classList.remove('ability-picked','ability-target','ability-disabled');slot.classList.remove('ability-target-slot','ability-picked-slot','ability-disabled-slot','ability-empty-slot');}
  });
  renderAbilityPrompt();
  renderPurgePrompt();
  updateScorePreview(_getPlacedScore());
  _elDiscardBtn.disabled=state.selected===null||state.discards<=0||inPurge||discardBlocked();
  _elDiscardBtn.title=discardBlocked()?'Place 2 cards before discarding.':'';
  _elPurgeBtn.disabled=state.busy||state.hand.length<3||!!state.abilitySelect||inPurge;
  tlrArchitectureSync();
  maybeShowContextualTutorials();
}

export function updateScorePreview(now){let el=$('#scorePreview');if(!el)return;if(state.selected===null){el.classList.add('hidden');el.innerHTML='';return}let card=state.hand.find(c=>c.uid===state.selected);if(!card){el.classList.add('hidden');el.innerHTML='';return}let after=_scoreLegacy([...state.spread.filter(Boolean),card]);let beforeNames=new Set(now.melds.map(m=>m[0]));let newNames=after.melds.filter(m=>!beforeNames.has(m[0])).map(m=>m[0]);let delta=after.finalScore-now.finalScore;el.classList.remove('hidden');el.innerHTML='<b>'+cleanName(card)+'</b> would add <b>'+delta+'</b>'+(newNames.length?' — forms <b>'+newNames.join(', ')+'</b>':' — no new pattern')}
