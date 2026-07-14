// Table renderer / orchestrator (Phase 15.1). Moved verbatim from
// index.html: render() drives the bars, spread, hand, prompts, and preview;
// refreshHandState() is the cheap selection-only repaint. Hot DOM elements
// are cached in the legacy global _el* bindings (snapCounter shares them).
/* global state, persist, TH, $, _hintsKey, _hintsCacheKey, _hintsCache, _getPlacedScore, applyResonationGlows, _scoreLegacy, hasMull, maxHand, tlrArchitectureSync, _elThreshold, _elPool, _elDiscards, _elDiscardBtn, _elPurgeBtn, _elMullBtn */
import { renderSpread } from './renderSpread.mjs';
import { renderHand } from './renderHand.mjs';
import { renderAbilityPrompt, renderPurgePrompt } from './renderAbility.mjs';
import { renderRelicRack } from './renderMarket.mjs';
import { cleanName } from './renderCard.mjs';
import { handView as selectHandView, spreadView as selectSpreadView, tableView as selectTableView, scorePreview as selectScorePreview, abilityTargetView as selectAbilityTargetView } from '../game/selectors.mjs';
import { getConstellation, constellationThreshold, blocksDiscard, hasActiveConstellation as runHasActiveConstellation } from '../systems/constellations.mjs';

let constellationCalloutOpen=false;
let constellationHandlersInstalled=false;

const CONSTELLATION_GLYPHS=Object.freeze({
  closed_palm:'♈',aries:'♈',
  unasked_question:'♉',taurus:'♉',
  ashen_hand:'♊',gemini:'♊',
  hungry_threshold:'♋',cancer:'♋',
  narrow_gate:'♌',leo:'♌',
  virgo:'♍',libra:'♎',scorpio:'♏',sagittarius:'♐',capricorn:'♑',aquarius:'♒',pisces:'♓'
});

function maybeShowContextualTutorials(){
  if(typeof window.maybeShowPatternTutorial==='function')window.maybeShowPatternTutorial();
  if(typeof window.maybeShowPurgeTutorial==='function')window.maybeShowPurgeTutorial();
  if(typeof window.maybeShowDiscardTutorial==='function')window.maybeShowDiscardTutorial();
  if(typeof window.maybeShowConstellationTutorial==='function')window.maybeShowConstellationTutorial();
  if(typeof window.maybeShowHandNavTutorial==='function')window.maybeShowHandNavTutorial();
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

function syncStoreBeforeView(){if(typeof window.tlrSyncRunToStore==='function')window.tlrSyncRunToStore()}
function currentStoreState(){return window.tlrStore?.getState?.()||null}
function currentRun(){return currentStoreState()?.run || state}
function activeThreshold(){const run=currentRun();return constellationThreshold(TH[state.th]+(state.thBonus||0),run)}
function discardBlocked(){return blocksDiscard(currentRun())}
function ensureConstellationPill(){let el=document.getElementById('constellationPill');if(el)return el;el=document.createElement('button');el.type='button';el.id='constellationPill';el.className='constellation-pill hidden';document.body.appendChild(el);return el}
function escapeHTML(value){return String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}
function activeConstellationId(){const run=currentRun();return runHasActiveConstellation(run)?run.constellationId:null}
function constellationGlyph(c){const key=String(c?.id||c?.name||c?.label||'').toLowerCase();return CONSTELLATION_GLYPHS[key]||'★'}
function constellationSpriteStyle(c){const s=c?.sprite;if(!s)return'';const cols=s.cols||4,rows=s.rows||3;const x=cols<=1?0:(s.col/(cols-1))*100;const y=rows<=1?0:(s.row/(rows-1))*100;return`background-image:url('${s.image}');--constellation-bg-size:${cols*100}% ${rows*100}%;--constellation-bg-x:${x}%;--constellation-bg-y:${y}%;`}
function constellationGlyphStyle(large=false){const size=large?72:30;const font=large?46:23;return`display:inline-flex!important;align-items:center!important;justify-content:center!important;width:${size}px!important;height:${size}px!important;min-width:${size}px!important;min-height:${size}px!important;color:#ffe09a!important;font:800 ${font}px/1 Georgia,serif!important;text-shadow:0 0 12px rgba(255,217,120,.9),0 2px 8px #000!important;opacity:1!important;visibility:visible!important;position:relative!important;z-index:3!important;background:radial-gradient(circle,rgba(255,217,120,.13),rgba(255,217,120,.02) 58%,transparent 72%)!important;border-radius:50%!important;`}
function constellationIconHTML(c,extraClass=''){
  const large=String(extraClass).split(/\s+/).includes('large');
  const spriteStyle=constellationSpriteStyle(c);
  const glyph=constellationGlyph(c);
  return `<span class="constellation-icon-wrap ${extraClass}" aria-hidden="true" style="display:inline-grid!important;place-items:center!important;width:${large?72:30}px!important;height:${large?72:30}px!important;min-width:${large?72:30}px!important;min-height:${large?72:30}px!important;position:relative!important;opacity:1!important;visibility:visible!important;">
    <span class="constellation-sprite-bg" style="position:absolute!important;inset:0!important;display:block!important;opacity:.95!important;visibility:visible!important;${spriteStyle}background-size:var(--constellation-bg-size)!important;background-position:var(--constellation-bg-x) var(--constellation-bg-y)!important;background-repeat:no-repeat!important;filter:drop-shadow(0 0 7px rgba(255,217,120,.7))!important;"></span>
    <span class="constellation-fallback-glyph" style="${constellationGlyphStyle(large)}">${glyph}</span>
  </span>`;
}
function closeConstellationCallout(){constellationCalloutOpen=false;const el=document.getElementById('constellationPill');if(el)el.classList.remove('open');const callout=document.getElementById('constellationCallout');if(callout)callout.remove()}
function hideConstellationPill(el){el.classList.add('hidden');el.removeAttribute('data-constellation-id');el.innerHTML='';closeConstellationCallout()}
function positionConstellationIcon(el){if(window.innerWidth>640){el.style.left='';el.style.top='';el.style.right='';el.style.transform='';return}requestAnimationFrame(()=>{const reserve=document.querySelector('.reserve-pill');const discards=document.querySelector('.discards-pill');if(!reserve||!discards)return;const a=reserve.getBoundingClientRect();const b=discards.getBoundingClientRect();const leftPill=a.left<=b.left?a:b;const rightPill=a.left<=b.left?b:a;const gapCenter=(leftPill.right+rightPill.left)/2;const sameRow=Math.abs((a.top+a.height/2)-(b.top+b.height/2))<18;const fallbackX=(a.left+a.width/2+b.left+b.width/2)/2;const x=sameRow&&rightPill.left>leftPill.right?gapCenter:fallbackX;const y=(a.top+a.height/2+b.top+b.height/2)/2;el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px';el.style.right='auto';el.style.transform='translate(-50%,-50%)'})}
function positionConstellationCallout(callout,anchor){const rect=anchor.getBoundingClientRect();const margin=8;callout.style.left='0px';callout.style.top='0px';requestAnimationFrame(()=>{const w=callout.offsetWidth;const h=callout.offsetHeight;let left=rect.left+rect.width+8;let top=rect.top+rect.height/2-h/2;if(left+w>window.innerWidth-margin)left=rect.left-w-8;if(window.innerWidth<=640){left=rect.left+rect.width/2-w/2;top=rect.bottom+8}left=Math.max(margin,Math.min(window.innerWidth-w-margin,left));top=Math.max(margin,Math.min(window.innerHeight-h-margin,top));callout.style.left=left+'px';callout.style.top=top+'px'})}
function showConstellationCallout(anchor,constellation){closeConstellationCallout();constellationCalloutOpen=true;anchor.classList.add('open');const callout=document.createElement('div');callout.id='constellationCallout';callout.className='constellation-callout';callout.innerHTML=`${constellationIconHTML(constellation,'large')}<div class="constellation-callout-copy"><div class="constellation-callout-title">${escapeHTML(constellation.name)}</div><div class="constellation-callout-rule">${escapeHTML(constellation.rule)}</div></div>`;document.body.appendChild(callout);positionConstellationCallout(callout,anchor)}
function toggleConstellationCallout(anchor){const constellationId=anchor?.dataset?.constellationId||activeConstellationId();const constellation=constellationId?getConstellation(constellationId):null;if(!constellation)return;if(constellationCalloutOpen)closeConstellationCallout();else showConstellationCallout(anchor,constellation)}
function installConstellationHandlers(){if(constellationHandlersInstalled)return;constellationHandlersInstalled=true;document.addEventListener('click',event=>{const source=window.Element&&event.target instanceof window.Element?event.target:null;const pill=source?.closest?.('#constellationPill');if(!pill||pill.classList.contains('hidden'))return;event.preventDefault();toggleConstellationCallout(pill)},true);document.addEventListener('pointerdown',event=>{if(!constellationCalloutOpen)return;const pill=document.getElementById('constellationPill');const callout=document.getElementById('constellationCallout');if(pill&&pill.contains(event.target))return;if(callout&&callout.contains(event.target))return;closeConstellationCallout()},true);window.addEventListener('resize',()=>{closeConstellationCallout();const el=document.getElementById('constellationPill');if(el&&!el.classList.contains('hidden'))positionConstellationIcon(el)})}
function renderConstellationPill(){installConstellationHandlers();const el=ensureConstellationPill();const constellationId=activeConstellationId();if(!constellationId)return hideConstellationPill(el);const constellation=getConstellation(constellationId);if(!constellation)return hideConstellationPill(el);el.classList.remove('hidden');el.dataset.constellationId=constellationId;el.setAttribute('aria-label',`${constellation.name}. ${constellation.shortRule||constellation.rule}`);el.innerHTML=constellationIconHTML(constellation);positionConstellationIcon(el)}

export function render(){
  syncStoreBeforeView();
  _cachedPlacedScore=null; // invalidate on every render
  const _newHintsKey=_hintsKey();if(_newHintsKey!==_hintsCacheKey){_hintsCache.clear();_hintsCacheKey=_newHintsKey;_unlockedFragmentsCache=null;_spreadScoreForHints=null;}
  _cacheEls();
  const storeState=currentStoreState();
  const ability=storeState?selectAbilityTargetView(storeState):null;
  const inPurge=state.purgeSelect!==null;
  const table=storeState?selectTableView(storeState,{inPurge,inAbility:!!ability}):null;
  _elThreshold.textContent=table?table.threshold:activeThreshold();
  const _thNext=document.getElementById('thNext');if(_thNext){const _p=table?table.thresholdBonusPending:(state.thBonusPending||0);_thNext.style.display=_p?'':'none';if(_p)_thNext.textContent='+'+_p+' next';}
  _elPool.textContent=table?table.reserve:persist.pool;
  _elDiscards.textContent=table?table.discards:state.discards;
  renderConstellationPill();
  renderRelicRack();
  const now=_getPlacedScore();
  const displayHand=storeState?selectHandView(storeState,{purgeSelect:state.purgeSelect}):null;
  const displaySpread=storeState?selectSpreadView(storeState):null;
  renderSpread(ability,inPurge,displaySpread);
  _resStateKey=null;
  applyResonationGlows(state.spread);
  renderHand(ability,inPurge,displayHand);
  renderAbilityPrompt();
  renderPurgePrompt();
  updateScorePreview(now);
  _elDiscardBtn.disabled=table?table.discardDisabled:(state.selected===null||state.discards<=0||inPurge||discardBlocked());
  _elDiscardBtn.title=table?table.discardTitle:(discardBlocked()?'Place 2 cards before discarding.':'');
  _elPurgeBtn.disabled=table?table.purgeDisabled:(state.busy||state.hand.length<3||!!state.abilitySelect||inPurge);
  _elMullBtn.style.display=hasMull()?'inline-block':'none';
  _elMullBtn.disabled=!(state.mullCharges>0)||!state.spread.every(x=>!x)||state.hand.length!==maxHand();
  tlrArchitectureSync();
  maybeShowContextualTutorials();
}

export function refreshHandState(){
  syncStoreBeforeView();
  _cacheEls();
  const storeState=currentStoreState();
  const ability=storeState?selectAbilityTargetView(storeState):null;
  const inPurge=state.purgeSelect!==null;
  const table=storeState?selectTableView(storeState,{inPurge,inAbility:!!ability}):null;
  document.querySelectorAll('#hand .card').forEach(el=>{
    const uid=Number(el.dataset.uid);
    el.classList.remove('sel','ability-picked','ability-target','ability-disabled','purge-picked','purge-target');
    if(!ability&&!inPurge&&state.selected===uid)el.classList.add('sel');
    if(ability){const isPicked=ability.picked.includes(uid);el.classList.toggle('ability-picked',isPicked);el.classList.toggle('ability-target',!isPicked&&ability.validIds.has(uid));el.classList.toggle('ability-disabled',!ability.validIds.has(uid));}
    if(inPurge){const isPicked=state.purgeSelect.includes(uid);el.classList.toggle('purge-picked',isPicked);el.classList.toggle('purge-target',!isPicked);}
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
  _elDiscardBtn.disabled=table?table.discardDisabled:(state.selected===null||state.discards<=0||inPurge||discardBlocked());
  _elDiscardBtn.title=table?table.discardTitle:(discardBlocked()?'Place 2 cards before discarding.':'');
  _elPurgeBtn.disabled=table?table.purgeDisabled:(state.busy||state.hand.length<3||!!state.abilitySelect||inPurge);
  tlrArchitectureSync();
  maybeShowContextualTutorials();
}

export function updateScorePreview(now){const el=$('#scorePreview');if(!el)return;const storeState=currentStoreState();if(storeState){const preview=selectScorePreview(storeState);if(!preview){el.classList.add('hidden');el.innerHTML='';return}const newNames=preview.newMelds.map(m=>m.name);el.classList.remove('hidden');el.innerHTML='<b>'+cleanName(preview.card)+'</b> would add <b>'+preview.delta+'</b>'+(newNames.length?' — forms <b>'+newNames.join(', ')+'</b>':' — no new pattern');return}if(state.selected===null){el.classList.add('hidden');el.innerHTML='';return}const card=state.hand.find(c=>c.uid===state.selected);if(!card){el.classList.add('hidden');el.innerHTML='';return}const after=_scoreLegacy([...state.spread.filter(Boolean),card]);const beforeNames=new Set(now.melds.map(m=>m[0]));const newNames=after.melds.filter(m=>!beforeNames.has(m[0])).map(m=>m[0]);const delta=after.finalScore-now.finalScore;el.classList.remove('hidden');el.innerHTML='<b>'+cleanName(card)+'</b> would add <b>'+delta+'</b>'+(newNames.length?' — forms <b>'+newNames.join(', ')+'</b>':' — no new pattern')}
