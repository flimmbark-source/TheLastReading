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

export function render(){
  _cachedPlacedScore=null; // invalidate on every render
  const _newHintsKey=_hintsKey();if(_newHintsKey!==_hintsCacheKey){_hintsCache.clear();_hintsCacheKey=_newHintsKey;_unlockedFragmentsCache=null;_spreadScoreForHints=null;}
  _cacheEls();
  _elThreshold.textContent=TH[state.th]+(state.thBonus||0);
  const _thNext=document.getElementById('thNext');if(_thNext){const _p=state.thBonusPending||0;_thNext.style.display=_p?'':'none';if(_p)_thNext.textContent='+'+_p+' next';}
  _elPool.textContent=persist.pool;
  _elDiscards.textContent=state.discards;
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
  _elDiscardBtn.disabled=state.selected===null||state.discards<=0||inPurge;
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
    if(inPurge){
      el.classList.toggle('purge-picked',state.purgeSelect.includes(uid));
      el.classList.toggle('purge-target',!state.purgeSelect.includes(uid));
    }
  });
  document.querySelectorAll('#spread .slot').forEach(slot=>{
    const el=slot.querySelector('.card[data-uid]');
    if(!el)return;
    const uid=Number(el.dataset.uid);
    if(ability){
      const isValid=ability.validIds.has(uid);
      const isPicked=isValid&&ability.picked.includes(uid);
      el.classList.toggle('ability-picked',isPicked);
      el.classList.toggle('ability-target',isValid&&!isPicked);
      el.classList.toggle('ability-disabled',!isValid);
      slot.classList.toggle('ability-target-slot',isValid&&!isPicked);
      slot.classList.toggle('ability-picked-slot',isPicked);
      slot.classList.toggle('ability-disabled-slot',!isValid);
    }else{
      el.classList.remove('ability-picked','ability-target','ability-disabled');
      slot.classList.remove('ability-target-slot','ability-picked-slot','ability-disabled-slot','ability-empty-slot');
    }
  });
  renderAbilityPrompt();
  renderPurgePrompt();
  updateScorePreview(_getPlacedScore());
  _elDiscardBtn.disabled=state.selected===null||state.discards<=0||inPurge;
  _elPurgeBtn.disabled=state.busy||state.hand.length<3||!!state.abilitySelect||inPurge;
  tlrArchitectureSync();
  maybeShowContextualTutorials();
}

export function updateScorePreview(now){let el=$('#scorePreview');if(!el)return;if(state.selected===null){el.classList.add('hidden');el.innerHTML='';return}let card=state.hand.find(c=>c.uid===state.selected);if(!card){el.classList.add('hidden');el.innerHTML='';return}let after=_scoreLegacy([...state.spread.filter(Boolean),card]);let beforeNames=new Set(now.melds.map(m=>m[0]));let newNames=after.melds.filter(m=>!beforeNames.has(m[0])).map(m=>m[0]);let delta=after.finalScore-now.finalScore;el.classList.remove('hidden');el.innerHTML='<b>'+cleanName(card)+'</b> would add <b>'+delta+'</b>'+(newNames.length?' — forms <b>'+newNames.join(', ')+'</b>':' — no new pattern')}
