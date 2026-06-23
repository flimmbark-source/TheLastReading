// Scoring runtime bridge for the shell cutover.
// Exposes the legacy tuple-shaped scoring helpers expected by readingFlow and renderers.

function runtime(target){return target.tlrRuntime || {};}
function stateOf(target){return runtime(target).state || target.state;}
function persistOf(target){return runtime(target).persist || target.persist;}

export function scoreLegacy(cards,{skipRelics=false,skipFlatBonuses=false}={},target = window){
  const persist=persistOf(target);
  const state=stateOf(target);
  const scorer=target.tlrScoring;
  if(!scorer||typeof scorer.computeScore!=='function'){
    return {chips:0,mult:1,finalScore:0,baseChips:0,melds:[]};
  }
  const result=scorer.computeScore(cards,{
    upgrades:persist.up,
    relics:skipRelics?[]:persist.relics,
    skipRelics,skipFlatBonuses,
    context:{
      handCount:state.hand?.length||0,
      discardedCount:state.discardedCards?.length||0,
      discardedCards:state.discardedCards||[],
      worldCarry:state.worldCarry||0,
      abilityTakenCardIds:state.abilityTakenUids?[...state.abilityTakenUids]:[],
      resonationBonus:state.resonationBonus||null,
      constellationId:state.constellationId||null,
    },
  });
  return {...result,melds:result.melds.map(m=>[m.name,m.chips,m.mult,m.mode,m.source||null])};
}

export function getPlacedScore(target = window){
  const state=stateOf(target);
  if(!target._cachedPlacedScore)target._cachedPlacedScore=scoreLegacy(state.spread.filter(Boolean),{},target);
  return target._cachedPlacedScore;
}

export function installScoringRuntime(target = window){
  if(!target || target.__tlrScoringRuntimeInstalled)return;
  target.__tlrScoringRuntimeInstalled=true;
  target.tlrScoringRuntime={scoreLegacy,getPlacedScore};
  target._scoreLegacy=(cards,options={})=>scoreLegacy(cards,options,target);
  target._getPlacedScore=()=>getPlacedScore(target);
}
