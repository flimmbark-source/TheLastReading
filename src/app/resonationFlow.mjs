// App-side resonation flow adapter. Pure matching lives in systems/resonations.
// This exposes module-owned helpers without replacing the inline functions yet.

import {
  checkResonationState as checkMatches,
  itemRequirementsNamed,
  resonationDisplayLevel,
  readUnlockedFragments,
  writeUnlockedFragments,
  triggeredResonations,
} from '../systems/resonations.mjs';

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state;}
function invPosOf(target){
  try{return Function("try{return typeof invPos==='undefined'?undefined:invPos}catch(e){return undefined}")() || {};}
  catch(e){return {};}
}

export function getUnlockedFragments(target = window){return readUnlockedFragments(target.localStorage);}

export function checkResonationState(spread,target = window){
  return checkMatches(spread,target.RESONATIONS||[]);
}

export function applyResonationGlows(spread,target = window){
  const runtimeCaches=runtime(target).caches || {};
  const cheapKey=spread.map(c=>c?c.id+c.uid:'0').join(',');
  if(cheapKey===runtimeCaches.resonationStateKey)return;
  runtimeCaches.resonationStateKey=cheapKey;
  const state=stateOf(target);
  const invPos=invPosOf(target);
  const states=checkResonationState(spread,target);
  const slots=document.querySelectorAll('.slot');
  slots.forEach(s=>s.classList.remove('res-1','res-2','res-3'));
  for(const match of states){
    if(!match.level)continue;
    if(!itemRequirementsNamed(match.res,invPos))continue;
    const displayLevel=resonationDisplayLevel(match,state);
    for(const {idx} of match.matchedConditions){
      if(slots[idx])slots[idx].classList.add('res-'+displayLevel);
    }
  }
}

export function checkResonationTriggers(target = window){
  const state=stateOf(target);
  for(const match of triggeredResonations(state.spread,target.RESONATIONS||[],state)){
    const key='res_'+match.res.id;
    if(!state.resonationTriggeredThisReading)state.resonationTriggeredThisReading={};
    state.resonationTriggeredThisReading[key]=true;
    triggerResonation(match.res,target);
  }
}

export function triggerResonation(res,target = window){
  const state=stateOf(target);
  if(typeof target.centerGhost==='function')target.centerGhost(res.name,true);
  if(typeof target.playSound==='function')target.playSound('resonation');
  if(typeof target.haptic==='function')target.haptic([0,30,70,150]);
  if(typeof target.holdEffects==='function')target.holdEffects(2000);
  if(res.id==='sophias_fall'){
    const veil=document.getElementById('sophiaVeil');
    if(veil){veil.classList.remove('active');requestAnimationFrame(()=>requestAnimationFrame(()=>{veil.classList.add('active');setTimeout(()=>veil.classList.remove('active'),4100);}));}
  }
  if(!state.resonationBonus)state.resonationBonus={chips:0,mult:0,name:res.name};
  state.resonationBonus.chips+=res.chips;
  state.resonationBonus.mult+=res.mult;
  state.resonationBonus.name=res.name;
  if(target.tlrStore&&target.tlrActions)target.tlrStore.dispatch({type:target.tlrActions.UPDATE_RESONATION_BONUS,chips:res.chips,mult:res.mult,name:res.name});
  state.thBonusPending=(state.thBonusPending||0)+10;
  if(typeof target.render==='function')target.render();
  setTimeout(()=>{if(runtime(target).caches)runtime(target).caches.resonationStateKey=null;applyResonationGlows(state.spread,target);},2100);
  setTimeout(()=>{if(res.chips&&typeof target.fireScoreGhost==='function')target.fireScoreGhost();if(res.mult&&typeof target.fireMultGhost==='function')target.fireMultGhost('×'+res.mult);},400);
  if(typeof target.setCounterTarget==='function'&&typeof target._scoreLegacy==='function')target.setCounterTarget(target._scoreLegacy(state.spread.filter(Boolean)).finalScore);
  const alreadyUnlocked=getUnlockedFragments(target).includes(res.fragmentId);
  if(!alreadyUnlocked&&target.INV_FRAGMENTS&&target.INV_FRAGMENTS[res.fragmentId]){
    const unlocked=getUnlockedFragments(target);
    unlocked.push(res.fragmentId);
    writeUnlockedFragments(unlocked,target.localStorage);
    if(target.tlrStore&&target.tlrActions)target.tlrStore.dispatch({type:target.tlrActions.UNLOCK_FRAGMENT,fragmentId:res.fragmentId});
    // First completion of a puzzle resonation: move its archive items out of
    // the current drawer into the resonation vault (see archives.mjs). Their
    // invPos records stay, so glows/scoring keep working on later runs.
    const puzzleItemIds=(res.conditions||[]).map(c=>c.itemId).filter(Boolean);
    if(puzzleItemIds.length&&typeof target.tlrVaultResonationItems==='function')target.tlrVaultResonationItems(res.id,puzzleItemIds);
    if(typeof target.renderInventory==='function')target.renderInventory();
    setTimeout(()=>{
      if(typeof target.showToast==='function')target.showToast('Something stirs in the Archives…',4200);
      setTimeout(()=>{
        try{
          const invOpen=Function("try{return typeof invOpen==='undefined'?false:invOpen}catch(e){return false}")();
          if(!invOpen&&typeof target.toggleInventory==='function')target.toggleInventory();
        }catch(e){}
      },1400);
    },500);
  }
}

export function installResonationFlow(target = window){
  if(!target || target.__tlrResonationFlowInstalled)return;
  target.__tlrResonationFlowInstalled=true;
  target.tlrResonations={getUnlockedFragments,checkResonationState,applyResonationGlows,checkResonationTriggers,triggerResonation};
  if(typeof target.getUnlockedFragments!=='function')target.getUnlockedFragments=()=>getUnlockedFragments(target);
  if(typeof target.checkResonationState!=='function')target.checkResonationState=spread=>checkResonationState(spread,target);
  if(typeof target.applyResonationGlows!=='function')target.applyResonationGlows=spread=>applyResonationGlows(spread,target);
  if(typeof target.checkResonationTriggers!=='function')target.checkResonationTriggers=()=>checkResonationTriggers(target);
  if(typeof target.triggerResonation!=='function')target.triggerResonation=res=>triggerResonation(res,target);
}
